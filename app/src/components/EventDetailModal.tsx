import { Suspense, lazy, useId } from 'react';
import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  alertCircle,
  calendarOutline,
  checkmarkCircle,
  closeCircle,
  helpCircle,
  homeOutline,
  locationOutline,
  navigateOutline,
  peopleOutline,
  trophyOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { usePresentingElement } from '../hooks/usePresentingElement';
import { useRespondToEvent, type AgendaEvent } from '../hooks/useAgenda';
import { useToast } from '../hooks/useToast';
import { ListSection } from './ListSection';
import { ManageSection } from './ManageSection';
import { TextSection } from './TextSection';
import { AttendanceStatusIcon } from './AttendanceStatusIcon';
import { canRespond, groupAttendance, respondsViaShifts } from '../lib/attendance';
import { formatDateTime, formatTime } from '../lib/format';
import { eventTypeIcon } from '../lib/eventIcons';
import { addToDeviceCalendar, eventCalendarEntry } from '../lib/calendar';
import { federationOf } from '../lib/federation';
import { coordinatesOf, openNavigation } from '../lib/map';

/**
 * Die Karte kommt erst mit dem ersten Termin, der eine Lage hat: MapLibre
 * wiegt rund 800 kB und gehört nicht in den Startchunk (PWA-Vorrat).
 */
const VenueMap = lazy(() => import('./VenueMap').then((module) => ({ default: module.VenueMap })));

/** Was das Detail von einem Mitglied braucht. */
export interface AttendanceMember {
  id: string;
  display_name: string;
}

/**
 * Die Wege, die vom Detail aus weiterführen. Jeder ist `undefined`, wo er
 * dieser Person bei diesem Termin nicht offensteht – die Seite entscheidet
 * das, das Blatt zeigt nur, was es bekommt.
 *
 * Sie standen früher als Knöpfe in der Agenda-Zeile. Dort stecken sie in
 * einem klickbaren Item, und Ionic ist da eindeutig: «Items should never
 * render nested interactives.» Hier haben sie Platz und einen Namen.
 */
export interface EventDetailActions {
  /** UC-014 Schritt 3: der eigene Check-in über die Kamera. */
  onCheckIn?: () => void;
  /** UC-014: Die Trainer:in zeigt den Code und erfasst, wer da ist. */
  onShowQr?: () => void;
  /** UC-015: Unentschlossene erinnern. */
  onRemind?: () => void;
  /** UC-009 A2 und FR-023: ändern oder absagen. */
  onEdit?: () => void;
  /** UC-012: die Schichten ansehen und eine übernehmen. */
  onOpenShifts?: () => void;
  /** UC-013: die Einsätze eines vergangenen Aufrufs bestätigen. */
  onOpenRoster?: () => void;
  /** UC-011 A2: den gesicherten Entwurf ausschreiben. */
  onPublish?: () => void;
  isPublishing?: boolean;
  /** Den Termin löschen – die Seite fragt zuerst nach (Entscheid 2026-09-13). */
  onDelete?: () => void;
}

interface EventDetailProps extends EventDetailActions {
  event: AgendaEvent;
  /** Die Mitglieder, für die der Termin gilt – das Team oder der Verein. */
  members: AttendanceMember[];
  /** Die eigene Mitgliedschaft; `null`, wenn der Termin nicht für einen gilt. */
  memberId: string | null;
  isTrainer: boolean;
  eventLabel: (type: AgendaEvent['type']) => string;
  /** Absagen läuft über das Blatt mit dem Grund (A1) – das öffnet die Seite. */
  onDecline: () => void;
  /** FR-029: wie viele Zusagen bis zum Bedarf fehlen; 0, wo keiner steht. */
  coverageGap?: number;
  /** BR-041: die Besetzung der Schichten, wenn der Termin welche hat. */
  shiftCoverage?: { filled: number; needed: number } | null;
}

/**
 * Das Termin-Detail (UC-010, Schritt 2) im Schnitt der bestehenden myclub-App:
 * oben die Eckdaten mit Symbol je Zeile, darunter «Mein Status» als runder
 * Knopf in der Ampelfarbe, zuletzt die drei aufklappbaren Listen «Zugesagt»,
 * «Abgesagt» und «Keine Antwort». Dazwischen die Wege, die die Agenda-Zeile
 * nicht mehr trägt: Check-in, Code zeigen, Erinnern, Bearbeiten, Einsätze.
 * Ein Termin mit Schichten hat weder «Mein Status» noch die Listen (BR-196):
 * Dort ist die Schicht die Antwort, und die Zeile «Schichten» führt hin.
 *
 * Eigene Komponente ohne die Blatt-Hülle, weil `IonModal` seinen Inhalt im
 * Test nicht rendert (docs/TESTING.md).
 */
export function EventDetail({
  event,
  members,
  memberId,
  isTrainer,
  eventLabel,
  onDecline,
  coverageGap = 0,
  shiftCoverage = null,
  onCheckIn,
  onShowQr,
  onRemind,
  onEdit,
  onOpenShifts,
  onOpenRoster,
  onPublish,
  isPublishing = false,
  onDelete,
}: EventDetailProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const respond = useRespondToEvent();

  const isCancelled = event.cancelled_at !== null;
  const isDraft = event.published_at === null;
  const hasStarted = new Date(event.starts_at) <= new Date();
  // BR-196: Bei einem Termin mit Schichten ist die Schicht die Antwort – das
  // Blatt zeigt dann weder «Mein Status» noch die drei Listen.
  const viaShifts = respondsViaShifts(event);
  const respondable =
    memberId !== null && !isDraft && canRespond({ isCancelled, hasStarted, viaShifts });

  const attendance = event.attendance ?? [];
  const mine =
    attendance.find((entry) => entry.member_id === memberId && entry.shift_id === null) ??
    null;
  const groups = groupAttendance(attendance, members);
  // C-006 und UC-039: Die Lage und den Verband nennt nur ein Spiel aus dem
  // Abgleich; ein Termin von Hand hat weder das eine noch das andere.
  const point = coordinatesOf(event);
  const federation = federationOf(event);


  // FR-156: Der Kalender des Geräts bekommt den Termin angeboten – nach der
  // Zusage von selbst, danach jederzeit über die Zeile. Die Zusage hängt
  // nicht daran: Sie ist gespeichert, bevor das Blatt des Systems aufgeht,
  // und bleibt es, wenn die Person dort verwirft (BR-187).
  function offerCalendar() {
    void addToDeviceCalendar(eventCalendarEntry(event, eventLabel(event.type))).catch(() =>
      toast.failure(t('agenda.calendarFailed')),
    );
  }

  function toggle(next: 'registered' | 'excused') {
    if (next === 'excused') {
      onDecline();
      return;
    }
    respond.mutate(
      { eventId: event.id, status: 'registered' },
      {
        onSuccess: () => {
          toast.success(t('agenda.attending'));
          offerCalendar();
        },
        onError: (cause) => toast.failure(cause.message),
      },
    );
  }

  return (
    <>
      {/* C-006: der Spielort auf der swisstopo-Karte, wie im Spiel-Detail der
          bestehenden App – zuoberst, über den Eckdaten. Der Platzhalter hält
          die Höhe, bis die Bibliothek da ist, damit nichts springt. */}
      {point && (
        <Suspense fallback={<div className="app-venue-map" aria-hidden="true" />}>
          <VenueMap point={point} label={event.location} title={t('agenda.venueMap')} />
        </Suspense>
      )}
      {/* Die Symbole vor den Eckdaten sind Schmuck – der Text daneben sagt
          alles; für Bedienhilfen sind sie deshalb unsichtbar. */}
      <ListSection footnote={isDraft ? t('helperEvent.draftHint') : undefined}>
        {/* A3: Die Absage steht zuoberst, samt Grund. */}
        {isCancelled && (
          <IonItem>
            <IonIcon slot="start" color="danger" icon={alertCircle} aria-hidden="true" />
            <IonLabel className="ion-text-wrap">
              <h2>
                {t('agenda.cancelledWithReason', {
                  reason: event.cancelled_reason ?? '',
                })}
              </h2>
            </IonLabel>
          </IonItem>
        )}
        <IonItem>
          <IonIcon slot="start" icon={homeOutline} aria-hidden="true" />
          <IonLabel className="ion-text-wrap">
            <h2>{event.title}</h2>
          </IonLabel>
        </IonItem>
        <IonItem>
          <IonIcon slot="start" icon={calendarOutline} aria-hidden="true" />
          <IonLabel>
            <h2>
              {formatDateTime(event.starts_at)}
              {event.ends_at ? ` – ${formatTime(event.ends_at)}` : ''}
            </h2>
          </IonLabel>
        </IonItem>
        {event.location && (
          <IonItem>
            <IonIcon slot="start" icon={locationOutline} aria-hidden="true" />
            <IonLabel className="ion-text-wrap">
              <h2>{event.location}</h2>
            </IonLabel>
          </IonItem>
        )}
        {/* Die Route dorthin in der Navigation des Geräts – eine Zeile wie
            «In den Kalender eintragen», nicht das Karten-Symbol in der
            Ortszeile der alten App (kein Knopf im Item). Der Pfeil steht
            rechts, weil die Zeile weiterführt (guidelines §2). */}
        {point && (
          <IonItem button detail onClick={() => openNavigation(point, event.location)}>
            <IonIcon slot="start" icon={navigateOutline} aria-hidden="true" />
            <IonLabel>{t('agenda.navigate')}</IonLabel>
          </IonItem>
        )}
        <IonItem>
          {/* Das Symbol der Terminart, dieselbe Zuordnung wie in der Agenda
              (`eventTypeIcon`) – wer die Zeile sieht, erkennt sie in der
              Liste wieder. */}
          <IonIcon slot="start" icon={eventTypeIcon(event.type)} aria-hidden="true" />
          <IonLabel className="ion-text-wrap">
            <h2>
              {eventLabel(event.type)}
              {federation ? ` · ${t(`federation.name.${federation}`)}` : ''}
            </h2>
          </IonLabel>
        </IonItem>
        {/* UC-039/BR-180: Das Resultat kommt vom Verband – gezeigt, nicht
            gerechnet; Tabellen bleiben FR-128. */}
        {event.result && (
          <IonItem>
            <IonIcon slot="start" icon={trophyOutline} aria-hidden="true" />
            <IonLabel className="ion-text-wrap">
              <h2>{t('agenda.result', { result: event.result })}</h2>
            </IonLabel>
          </IonItem>
        )}
        {/* BR-041: die Unterdeckung der Schichten, und der Weg zu ihnen. */}
        {shiftCoverage && (
          <IonItem button={Boolean(onOpenShifts)} detail={Boolean(onOpenShifts)} onClick={onOpenShifts}>
            <IonIcon slot="start" icon={peopleOutline} aria-hidden="true" />
            <IonLabel className="ion-text-wrap">
              <h2>{t('shifts.title')}</h2>
              <p>
                {t('agenda.shiftNeeded', {
                  filled: shiftCoverage.filled,
                  needed: shiftCoverage.needed,
                })}
              </p>
            </IonLabel>
          </IonItem>
        )}
        {/* FR-029: die Unterdeckung. Sie steht **allen** da, nicht nur der
            Trainer:in – ein Termin, dem Leute fehlen, ist genau der, bei dem
            die eigene Zusage zählt. */}
        {coverageGap > 0 && (
          <IonItem>
            <IonIcon slot="start" color="warning" icon={peopleOutline} aria-hidden="true" />
            <IonLabel className="ion-text-wrap">
              <h2>
                <IonNote color="warning">
                  {t('agenda.undercovered', { count: coverageGap })}
                </IonNote>
              </h2>
            </IonLabel>
          </IonItem>
        )}
      </ListSection>

      {/* Das Warum gehört zu den Eckdaten (K3a) – wer es kennt, sagt anders
          zu. Es ist Fliesstext, also kein Item (Befund 13). */}
      {event.why && (
        <TextSection title={t('helperEvent.whyTitle')} preserveLines>
          {event.why}
        </TextSection>
      )}

      {respondable && (
        <ListSection title={t('agenda.attendances')}>
          {/* Der Knopf ist das Ampel-Symbol selbst, wie in der Agenda-Zeile
              der alten App; die Zeile darum ist kein `button`. */}
          <IonItem lines="none" className="app-status-row">
            <AttendanceStatusIcon
              slot="start"
              status={mine?.status ?? null}
              isCancelled={isCancelled}
              isLocked={hasStarted}
              eventType={event.type}
              disabled={respond.isPending}
              onToggle={toggle}
            />
            <IonLabel>{t('agenda.myStatus')}</IonLabel>
          </IonItem>
          {/* Wer zugesagt hat, holt sich den Eintrag hier noch einmal – etwa
              auf dem zweiten Gerät oder nach einem «Abbrechen» im Blatt. Der
              Pfeil steht rechts: Die Zeile öffnet das Blatt des Systems
              (guidelines §2). */}
          {mine?.status === 'registered' && (
            <IonItem button detail onClick={offerCalendar}>
              <IonIcon slot="start" icon={calendarOutline} aria-hidden="true" />
              <IonLabel>{t('agenda.addToCalendar')}</IonLabel>
            </IonItem>
          )}
        </ListSection>
      )}

      {/* FR-034 und UC-014 Schritt 4: beide nur, solange das Fenster offen
          ist – der Code nützt sonst niemandem, und der Scan wird abgewiesen.
          Knöpfe, weil sie etwas **tun** (guidelines §2). */}
      {(onCheckIn || onShowQr) && (
        <div className="app-actions">
          {onCheckIn && (
            <IonButton expand="block" onClick={onCheckIn}>
              {t('agenda.checkIn')}
            </IonButton>
          )}
          {onShowQr && (
            <IonButton expand="block" fill="outline" onClick={onShowQr}>
              {t('checkIn.showQr')}
            </IonButton>
          )}
        </div>
      )}

      {/* FR-027: der Teilnehmerstand, Person für Person. Die Zusagen stehen
          aufgeklappt, die beiden anderen Listen zugeklappt – wie gehabt. Ein
          Entwurf hat keinen Stand: In ihn antwortet niemand. Ein Termin mit
          Schichten auch nicht (BR-196): Wer dort «Keine Antwort» zählte,
          zählte den ganzen Verein. */}
      {!isDraft && !viaShifts && (
        <IonList inset>
          <IonAccordionGroup multiple value={['registered']}>
            {groups.registered.length > 0 && (
              <IonAccordion value="registered">
                <IonItem slot="header" color="light">
                  <IonLabel>
                    {t('agenda.listRegistered', { count: groups.registered.length })}
                  </IonLabel>
                </IonItem>
                <div slot="content">
                  <IonList>
                    {groups.registered.map(({ member, entry }) => (
                      <IonItem key={member.id}>
                        <IonIcon
                          slot="start"
                          color="success"
                          icon={checkmarkCircle}
                          aria-hidden="true"
                        />
                        <IonLabel>
                          <h2>{member.display_name}</h2>
                          {entry.responded_at && <p>{formatDateTime(entry.responded_at)}</p>}
                        </IonLabel>
                      </IonItem>
                    ))}
                  </IonList>
                </div>
              </IonAccordion>
            )}
            {groups.excused.length > 0 && (
              <IonAccordion value="excused">
                <IonItem slot="header" color="light">
                  <IonLabel>
                    {t('agenda.listExcused', { count: groups.excused.length })}
                  </IonLabel>
                </IonItem>
                <div slot="content">
                  <IonList>
                    {groups.excused.map(({ member, entry }) => (
                      <IonItem key={member.id}>
                        <IonIcon
                          slot="start"
                          color="danger"
                          icon={closeCircle}
                          aria-hidden="true"
                        />
                        <IonLabel className="ion-text-wrap">
                          <h2>{member.display_name}</h2>
                          {entry.responded_at && <p>{formatDateTime(entry.responded_at)}</p>}
                          {/* FR-026: Der Grund ist für die Organisation da, nicht
                              für das ganze Team. */}
                          {isTrainer && entry.decline_reason && (
                            <p>
                              <IonNote>{entry.decline_reason}</IonNote>
                            </p>
                          )}
                        </IonLabel>
                      </IonItem>
                    ))}
                  </IonList>
                </div>
              </IonAccordion>
            )}
            {groups.undecided.length > 0 && (
              <IonAccordion value="undecided">
                <IonItem slot="header" color="light">
                  <IonLabel>
                    {t('agenda.listUndecided', { count: groups.undecided.length })}
                  </IonLabel>
                </IonItem>
                <div slot="content">
                  <IonList>
                    {groups.undecided.map((member) => (
                      <IonItem key={member.id}>
                        <IonIcon
                          slot="start"
                          color="warning"
                          icon={helpCircle}
                          aria-hidden="true"
                        />
                        <IonLabel>
                          <h2>{member.display_name}</h2>
                        </IonLabel>
                      </IonItem>
                    ))}
                  </IonList>
                </div>
              </IonAccordion>
            )}
          </IonAccordionGroup>
        </IonList>
      )}

      {/* Die Wege der planenden Seite, als Zeilen unter «Verwalten»: Erinnern,
          Bearbeiten, Einsätze bestätigen, Ausschreiben, Löschen. Hier hat
          jeder einen Namen und eine Trefferfläche, an derselben Stelle wie in
          jedem anderen Blatt – am Ende des Inhalts, nach dem Teilnehmerstand
          (guidelines §2); die Wischoptionen der Zeile bleiben der kurze
          Weg für die, die ihn kennen. */}
      <ManageSection
        actions={[
          onRemind && { label: t('reminder.remind'), onClick: onRemind },
          onEdit && { label: t('eventEdit.open'), onClick: onEdit, detail: true },
          onOpenRoster && { label: t('roster.open'), onClick: onOpenRoster, detail: true },
          onPublish && {
            label: t('helperEvent.publish'),
            onClick: onPublish,
            disabled: isPublishing,
          },
          onDelete && { label: t('eventEdit.delete'), onClick: onDelete, destructive: true },
        ]}
      />
    </>
  );
}

/**
 * Blatt-Hülle. Kein `FormModal`: Hier wird nichts erfasst – der Stand wird
 * gelesen, und die eine Antwort hat ihren eigenen Knopf.
 */
export function EventDetailModal({
  event,
  ...props
}: Omit<EventDetailProps, 'event'> & {
  event: AgendaEvent | null;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const presentingElement = usePresentingElement();
  // Das Blatt ist ein `role="dialog"` und braucht einen Namen (ion-modal:
  // «developers must properly label their modals»); der Titel ist er.
  const titleId = useId();

  return (
    <IonModal
      isOpen={event !== null}
      onDidDismiss={props.onDismiss}
      presentingElement={presentingElement}
      aria-labelledby={titleId}
    >
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={props.onDismiss}>{t('common.close')}</IonButton>
          </IonButtons>
          <IonTitle id={titleId} role="heading" aria-level={2}>
            {t('common.details')}
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {event && <EventDetail event={event} {...props} />}
      </IonContent>
    </IonModal>
  );
}

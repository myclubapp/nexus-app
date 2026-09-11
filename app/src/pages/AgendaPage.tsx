import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonButtons,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSegment,
  IonSegmentButton,
} from '@ionic/react';
import {
  alertCircle,
  calendarOutline,
  checkmarkCircle,
  closeCircle,
  locationOutline,
  trophyOutline,
  peopleOutline,
  pricetagOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useAgenda, useRespondToEvent } from '../hooks/useAgenda';
import { usePublishEvent } from '../hooks/useHelperEvents';
import { useRemindUndecided } from '../hooks/useReminders';
import { useClub } from '../hooks/useClub';
import { useMembers } from '../hooks/useMembers';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { useTeams } from '../hooks/useInvites';
import { useToast } from '../hooks/useToast';
import { formatDateTime, formatTime } from '../lib/format';
import { AttendanceStatusIcon } from '../components/AttendanceStatusIcon';
import { CheckInModal } from '../components/CheckInModal';
import { EventDetailModal } from '../components/EventDetailModal';
import { EventFormModal } from '../components/EventFormModal';
import { DeclineModal } from '../components/DeclineModal';
import { HelperEventModal } from '../components/HelperEventModal';
import { ShiftListModal } from '../components/ShiftListModal';
import { ShiftRosterModal } from '../components/ShiftRosterModal';
import { EventQrModal } from '../components/EventQrModal';
import { canRespond, coverageGap, tallyAttendance } from '../lib/attendance';
import { EventEditModal } from '../components/EventEditModal';
import { canActOn, isSample } from '../lib/sample';
import { isCheckInOpen } from '../lib/checkInWindow';
import { canRemind, reminderMessage } from '../lib/reminder';
import { shiftCoverage } from '../lib/shift';

type Range = 'upcoming' | 'past';

/** Die Knöpfe in der Zeile lösen nicht zugleich das Detail dahinter aus. */
function stopBubbling(event: MouseEvent) {
  event.stopPropagation();
}

/** Die Wischleiste fährt nach der Wahl von selbst zu, wie in der alten App. */
function closeSliding(event: MouseEvent) {
  const sliding = (event.currentTarget as HTMLElement).closest('ion-item-sliding');
  void (sliding as HTMLIonItemSlidingElement | null)?.close();
}

export function AgendaPage() {
  const { t } = useTranslation();
  const { activeMembership, eventLabel, isAdmin, isTrainer } = useClub();
  const toast = useToast();
  const [range, setRange] = useState<Range>('upcoming');
  const [checkInEventId, setCheckInEventId] = useState<string | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isHelperOpen, setHelperOpen] = useState(false);
  // UC-012 Schritt 1: Der Aufruf öffnet sich aus der Agenda heraus.
  const [shiftEventId, setShiftEventId] = useState<string | null>(null);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  // UC-013 Schritt 1: der vergangene Aufruf, dessen Einsätze zu bestätigen sind.
  const [rosterEventId, setRosterEventId] = useState<string | null>(null);
  // UC-014 Schritt 1: Die Trainer:in zeigt den Code und erfasst, wer da ist.
  const [qrEventId, setQrEventId] = useState<string | null>(null);
  // UC-010 Schritt 1: Der Termin öffnet sich als Blatt mit Eckdaten und Stand.
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [decliningEvent, setDecliningEvent] = useState<{
    id: string;
    startsAt: string;
  } | null>(null);

  // BR-062: Die Erinnerung verlinkt `/tabs/agenda?event=<id>` und soll «direkt
  // zur Antwortmöglichkeit» führen – nicht in eine Liste, in der die Person
  // ihren Termin erst sucht.
  const location = useLocation();
  const highlightId = new URLSearchParams(location.search).get('event');
  const highlightRef = useRef<HTMLIonItemElement | null>(null);

  const members = useMembers();
  // Dieselbe Grundgesamtheit wie `count_undecided()` auf dem Server: wer kein
  // Anmeldekonto hat, lässt sich nicht erreichen und zählt deshalb auch nicht
  // als «noch offen». Sonst nennt die Rückfrage eine Zahl, die niemand erhält.
  const activeMembers = (members.data ?? []).filter(
    (m) => m.status !== 'left' && m.user_id !== null,
  );
  /** Solange die Mitglieder nicht geladen sind, ist die Zahl unbekannt. */
  const membersKnown = members.data !== undefined && !members.error;
  /** Die eigenen Teams – entscheiden, ob ein Team-Termin einen betrifft. */
  const myTeamIds =
    activeMembers.find((m) => m.id === activeMembership?.id)?.teamIds ?? [];
  const agenda = useAgenda(range);
  const respond = useRespondToEvent();
  const publish = usePublishEvent();
  const remind = useRemindUndecided();
  // UC-015 Schritt 4: Erst sagen, wie viele es trifft, dann fragen.
  const [remindEvent, setRemindEvent] = useState<{
    id: string;
    undecided: number;
  } | null>(null);
  // Team-Filter für die, die alle Teams sehen (Trainer:innen, Vorstand) – wie
  // der Chip in der Trainingsliste der bestehenden myclub-App. Mitglieder
  // sehen seit C-032 ohnehin nur ihre Teams und den Verein.
  const teams = useTeams();
  const events = (agenda.data ?? []).filter(
    (event) => teamFilter === null || event.team_id === teamFilter || event.team_id === null,
  );
  const shiftEvent = events.find((entry) => entry.id === shiftEventId);
  const rosterEvent = events.find((entry) => entry.id === rosterEventId);
  const editEvent = events.find((entry) => entry.id === editEventId);
  const detailEvent = events.find((entry) => entry.id === detailEventId) ?? null;

  /** Betroffen ist bei einem Team-Termin nur dieses Team, sonst der ganze Verein. */
  function affectedMembers(teamId: string | null) {
    return teamId ? activeMembers.filter((m) => m.teamIds.includes(teamId)) : activeMembers;
  }

  function register(eventId: string) {
    respond.mutate(
      { eventId, status: 'registered' },
      {
        onSuccess: () => toast.success(t('agenda.attending')),
        onError: (cause) => toast.failure(cause.message),
      },
    );
  }

  useEffect(() => {
    if (!highlightId) return;
    // Erst nach dem Zeichnen: Vorher hat die Liste den Eintrag noch nicht.
    const timer = window.setTimeout(
      () => highlightRef.current?.scrollIntoView({ block: 'center' }),
      120,
    );
    return () => window.clearTimeout(timer);
  }, [highlightId, events.length]);

  return (
    <AppPage
      title={t('agenda.title')}
      createActions={
        // BR-033: Termine erfassen Trainer:innen und der Vorstand. Der
        // Helferaufruf dagegen erreicht den ganzen Verein und kennt kein
        // Team – ihn schreibt nur der Vorstand aus (UC-011 Precondition).
        // Der Termin steht zuerst: Er ist der häufigere Weg und liegt damit
        // in der aufgeklappten Liste am nächsten beim Plus.
        isTrainer
          ? [
              {
                icon: calendarOutline,
                label: t('eventForm.title'),
                onClick: () => setFormOpen(true),
              },
              ...(isAdmin
                ? [
                    {
                      icon: peopleOutline,
                      label: t('helperEvent.title'),
                      onClick: () => setHelperOpen(true),
                    },
                  ]
                : []),
            ]
          : undefined
      }
      subToolbar={
        <IonSegment
          value={range}
          onIonChange={(e) => setRange(e.detail.value as Range)}
        >
          <IonSegmentButton value="upcoming">
            <IonLabel>{t('agenda.upcoming')}</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="past">
            <IonLabel>{t('agenda.past')}</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      }
      onRefresh={() => agenda.refetch()}
    >
      {isTrainer && (teams.data ?? []).length > 1 && (
        <ListSection>
          <IonItem>
            <IonSelect
              label={t('agenda.teamFilter')}
              value={teamFilter}
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
              onIonChange={(e) => setTeamFilter((e.detail.value as string | null) ?? null)}
            >
              <IonSelectOption value={null}>{t('agenda.allTeams')}</IonSelectOption>
              {(teams.data ?? []).map((team) => (
                <IonSelectOption key={team.id} value={team.id}>
                  {team.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </ListSection>
      )}

      {agenda.isLoading ? (
        <SkeletonList />
      ) : agenda.error ? (
        <ErrorState error={agenda.error as Error} onRetry={() => void agenda.refetch()} />
      ) : events.length === 0 ? (
        <EmptyState
          message={t('agenda.empty')}
          action={
            isTrainer
              ? { label: t('eventForm.title'), onClick: () => setFormOpen(true) }
              : { label: t('marketplace.title'), routerLink: '/tabs/marketplace' }
          }
        />
      ) : (
        <IonList inset>
          {/* Die Spaltenköpfe der bestehenden myclub-App: links der eigene
              Stand, rechts die Zahl der Zusagen. */}
          <IonItem>
            <IonLabel slot="start">
              <p>{t('agenda.statusColumn')}</p>
            </IonLabel>
            <IonLabel slot="end">
              <p>{t('agenda.participantsColumn')}</p>
            </IonLabel>
          </IonItem>

          {events.map((event) => {
            // Seit 0025 trägt `attendance` je Schicht eine eigene Zeile. Die
            // Antwort auf den **Termin** ist die ohne Schicht – ohne diesen
            // Filter behauptete die App eine Zusage, sobald jemand eine
            // Schicht übernommen hat.
            const mine = event.attendance?.find(
              (entry) =>
                entry.member_id === activeMembership?.id && entry.shift_id === null,
            );
            const isCancelled = event.cancelled_at !== null;
            // A2: Ein Entwurf ist nur für Trainer:innen und den Vorstand
            // überhaupt sichtbar – die Policy aus 0018 blendet ihn für alle
            // anderen aus. Wer ihn sieht, soll ihn auch als Entwurf erkennen.
            const isDraft = event.published_at === null;
            const hasStarted = new Date(event.starts_at) <= new Date();
            // Ein Team-Termin gilt nur für das Team – wer nicht dazugehört,
            // bekommt keinen Antwortstand, sondern ein «nicht dabei».
            const isAffected = event.team_id === null || myTeamIds.includes(event.team_id);
            const respondable =
              !isDraft && isAffected && canRespond({ isCancelled, hasStarted });
            // Der Check-in folgt seinem eigenen Fenster (BR-054) und nicht der
            // Einteilung der Agenda: Die teilt bei `starts_at`, das Fenster
            // reicht aber bis zum Ende. Wer um 19:05 die Halle betritt, fände
            // den Termin sonst nur unter «Vergangen» – ohne Knopf, obwohl der
            // Server bis 20:30 bucht.
            const checkInOpen = isCheckInOpen({
              startsAt: event.starts_at,
              endsAt: event.ends_at,
              isCancelled,
              isDraft,
            });
            // Nähme man immer die Vereinsgrösse, stünde bei jedem Team-Termin
            // eine zu hohe Zahl Unentschlossener.
            const affectedCount = affectedMembers(event.team_id).length;
            // Aus demselben Grund zählt der Teilnehmerstand nur Antworten auf
            // den Termin. Zwei Personen mit je zwei Schichten ergäben sonst
            // vier Zusagen – und UC-015 erbte den Fehler.
            const eventAnswers = (event.attendance ?? []).filter(
              (entry) => entry.shift_id === null,
            );
            const tally = tallyAttendance(eventAnswers, affectedCount);
            const attending = tally.registered + tally.present;
            // FR-029: Wie viele Zusagen fehlen noch bis zum hinterlegten
            // Bedarf? Ohne Bedarf null – ein Termin ohne ihn ist nie zu leer.
            const gap = coverageGap(event.capacity_needed, tally);
            // BR-041: die Unterdeckung, und zwar richtig gezählt. Eine Absage
            // belegt keinen Platz – wer nur `shift_id` zählt, hält eine
            // Schicht für besetzt, aus der sich längst jemand abgemeldet hat.
            const coverage = (event.shifts ?? []).map((shift) =>
              shiftCoverage(shift, event.attendance ?? []),
            );
            const shiftsFilled = coverage.reduce((sum, c) => sum + c.filled, 0);
            const shiftsNeeded = coverage.reduce((sum, c) => sum + c.needed, 0);

            const isHighlighted = event.id === highlightId;
            const openDetail = () => setDetailEventId(event.id);
            const openDecline = () =>
              setDecliningEvent({ id: event.id, startsAt: event.starts_at });

            return (
              <IonItemSliding key={event.id}>
                <IonItem
                  ref={isHighlighted ? highlightRef : undefined}
                  color={isHighlighted ? 'light' : undefined}
                  detail={!isDraft}
                >
                  {/* Der Antwortstand am Zeilenanfang; ein Tippen schaltet um.
                      Ein Entwurf hat noch keinen – in ihn antwortet niemand. */}
                  {!isDraft && (
                    <AttendanceStatusIcon
                      slot="start"
                      status={mine?.status ?? null}
                      isCancelled={isCancelled}
                      isLocked={hasStarted}
                      isAffected={isAffected}
                      onToggle={
                        respondable
                          ? (next) => (next === 'registered' ? register(event.id) : openDecline())
                          : undefined
                      }
                    />
                  )}

                  <IonLabel className="ion-text-wrap" onClick={isDraft ? undefined : openDetail}>
                    <h2>{event.title}</h2>
                    <h3>
                      <IonIcon className="app-inline-icon" icon={calendarOutline} />
                      {formatDateTime(event.starts_at)}
                      {event.ends_at ? ` – ${formatTime(event.ends_at)}` : ''}
                    </h3>
                    {event.location && (
                      <h3>
                        <IonIcon className="app-inline-icon" icon={locationOutline} />
                        {event.location}
                      </h3>
                    )}
                    {/* UC-039/BR-180: Das Resultat kommt vom Verband – gezeigt,
                        nicht gerechnet; Tabellen bleiben FR-128. */}
                    {event.result && (
                      <h3>
                        <IonIcon className="app-inline-icon" icon={trophyOutline} />
                        {t('agenda.result', { result: event.result })}
                      </h3>
                    )}
                    <h3>
                      <IonIcon className="app-inline-icon" icon={pricetagOutline} />
                      {eventLabel(event.type)}
                      {event.external_id ? ` · ${t('agenda.fromFederation')}` : ''}
                    </h3>

                    {/* A3: Ein abgesagter Termin zeigt den Grund und sperrt. */}
                    {isCancelled && (
                      <h3>
                        <IonIcon className="app-inline-icon" color="danger" icon={alertCircle} />
                        <IonNote color="danger">
                          {t('agenda.cancelledWithReason', {
                            reason: event.cancelled_reason ?? '',
                          })}
                        </IonNote>
                      </h3>
                    )}

                    {/* BR-160: Beispielinhalte sind immer gekennzeichnet. */}
                    {isSample(event) && (
                      <p>
                        <IonBadge color="medium">{t('sample.badge')}</IonBadge>
                      </p>
                    )}

                    {shiftsNeeded > 0 && (
                      <p>
                        <IonBadge color="tertiary">
                          {t('agenda.shiftNeeded', {
                            filled: shiftsFilled,
                            needed: shiftsNeeded,
                          })}
                        </IonBadge>
                      </p>
                    )}

                    {/* FR-027: der Stand in Zahlen – für die, die damit planen.
                        Alle anderen sehen die Zusagen rechts und die Namen im
                        Detail. */}
                    {isTrainer && !isDraft && (
                      <p>
                        <IonNote>
                          {t('agenda.tally', {
                            yes: tally.registered,
                            no: tally.excused,
                            open: tally.undecided,
                          })}
                        </IonNote>
                      </p>
                    )}

                    {/* FR-029: die Unterdeckung. Sie steht **allen** da, nicht
                        nur der Trainer:in – ein Termin, dem Leute fehlen, ist
                        genau der, bei dem die eigene Zusage zählt. Ohne
                        hinterlegten Bedarf gibt es sie nicht. */}
                    {!isDraft && !isCancelled && !hasStarted && gap > 0 && (
                      <p>
                        <IonNote color="warning">
                          {t('agenda.undercovered', { count: gap })}
                        </IonNote>
                      </p>
                    )}

                    {/* UC-015: A2 blendet den Weg aus, sobald alle geantwortet
                        haben – erinnern liesse sich dann ohnehin niemand. */}
                    {range === 'upcoming' &&
                      canRemind({
                        isDraft,
                        isCancelled,
                        hasStarted,
                        undecided: membersKnown ? tally.undecided : null,
                        isTrainer,
                      }) && (
                        <IonButtons onClick={stopBubbling}>
                          <IonButton
                            size="small"
                            fill="clear"
                            disabled={remind.isPending}
                            onClick={() =>
                              setRemindEvent({ id: event.id, undecided: tally.undecided })
                            }
                          >
                            {t('reminder.remind')}
                          </IonButton>
                        </IonButtons>
                      )}

                    {/* FR-034 und Schritt 4: beide nur, solange das Fenster offen
                        ist – der Code nützt sonst niemandem, und der Scan wird
                        abgewiesen. */}
                    {checkInOpen && (
                      <IonButtons onClick={stopBubbling}>
                        <IonButton
                          size="small"
                          onClick={() => setCheckInEventId(event.id)}
                        >
                          {t('agenda.checkIn')}
                        </IonButton>
                        {isTrainer && (
                          <IonButton
                            size="small"
                            fill="outline"
                            onClick={() => setQrEventId(event.id)}
                          >
                            {t('checkIn.showQr')}
                          </IonButton>
                        )}
                      </IonButtons>
                    )}

                    {/* A2 zu Ende gedacht: Der gesicherte Entwurf lässt sich
                        von hier aus ausschreiben, sonst wäre er eine Sackgasse. */}
                    {isDraft && isAdmin && (
                      <IonButtons onClick={stopBubbling}>
                        <IonButton
                          size="small"
                          fill="outline"
                          disabled={publish.isPending}
                          onClick={() =>
                            publish.mutate(event.id, {
                              onSuccess: (result) =>
                                // Auch der gedrosselte Aufruf ist ergangen –
                                // die Schreibaktion war erfolgreich (§5).
                                toast.success(
                                  result.muted
                                    ? t('helperEvent.mutedHint')
                                    : t('helperEvent.published'),
                                ),
                              onError: (cause) => toast.failure(cause.message),
                            })
                          }
                        >
                          {t('helperEvent.publish')}
                        </IonButton>
                      </IonButtons>
                    )}
                  </IonLabel>

                  {/* Rechts die Zahl der Zusagen, wie in der alten App – ein
                      Tippen darauf führt zu den Namen. */}
                  {isDraft ? (
                    <IonBadge slot="end" color="medium">
                      {t('agenda.draft')}
                    </IonBadge>
                  ) : (
                    <IonBadge slot="end" color="primary" onClick={openDetail}>
                      {attending}
                    </IonBadge>
                  )}
                </IonItem>

                {/* Zeilenaktionen nach links gewischt – der Schnitt der
                    bestehenden myclub-App und guidelines §2: kein dritter
                    Knopf in der Zeile. Schichten und Einsätze gehören zum
                    Termin, Bearbeiten der planenden Seite. */}
                {(shiftsNeeded > 0 || (isTrainer && canActOn(event))) && !isDraft && (
                  <IonItemOptions side="end">
                    {shiftsNeeded > 0 && !isCancelled && (
                      <IonItemOption
                        color="tertiary"
                        onClick={(e) => {
                          closeSliding(e);
                          setShiftEventId(event.id);
                        }}
                      >
                        {t('shifts.open')}
                      </IonItemOption>
                    )}
                    {shiftsNeeded > 0 && isAdmin && range === 'past' && (
                      <IonItemOption
                        color="secondary"
                        onClick={(e) => {
                          closeSliding(e);
                          setRosterEventId(event.id);
                        }}
                      >
                        {t('roster.open')}
                      </IonItemOption>
                    )}
                    {isTrainer && canActOn(event) && (
                      <IonItemOption
                        color="medium"
                        onClick={(e) => {
                          closeSliding(e);
                          setEditEventId(event.id);
                        }}
                      >
                        {t('eventEdit.open')}
                      </IonItemOption>
                    )}
                  </IonItemOptions>
                )}

                {/* Zu- und Absagen durch Wischen nach rechts: grün der Haken,
                    rot das Kreuz – nur die Gegenantwort zum aktuellen Stand. */}
                {range === 'upcoming' && respondable && (
                  <IonItemOptions side="start">
                    {mine?.status !== 'registered' && (
                      <IonItemOption
                        color="success"
                        aria-label={t('agenda.attend')}
                        disabled={respond.isPending}
                        onClick={(e) => {
                          closeSliding(e);
                          register(event.id);
                        }}
                      >
                        <IonIcon slot="icon-only" icon={checkmarkCircle} />
                      </IonItemOption>
                    )}
                    {mine?.status !== 'excused' && (
                      <IonItemOption
                        color="danger"
                        aria-label={t('agenda.decline')}
                        disabled={respond.isPending}
                        onClick={(e) => {
                          closeSliding(e);
                          openDecline();
                        }}
                      >
                        <IonIcon slot="icon-only" icon={closeCircle} />
                      </IonItemOption>
                    )}
                  </IonItemOptions>
                )}
              </IonItemSliding>
            );
          })}
        </IonList>
      )}

      <CheckInModal
        eventId={checkInEventId}
        onDismiss={() => setCheckInEventId(null)}
      />

      {/* Schritte 4 und 5: Die Zahl steht in der Frage, nicht erst in der
          Antwort – wer bestätigt, weiss, wie viele Geräte gleich klingeln. */}
      <IonAlert
        isOpen={remindEvent !== null}
        header={t('reminder.title')}
        message={t('reminder.confirm', { count: remindEvent?.undecided ?? 0 })}
        onDidDismiss={() => setRemindEvent(null)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('reminder.send'),
            handler: () => {
              if (!remindEvent) return;
              remind.mutate(remindEvent.id, {
                onSuccess: (result) => {
                  const message = reminderMessage(result);
                  if (message.kind === 'sent') {
                    toast.success(t('reminder.sent', { count: message.count }));
                  } else if (message.kind === 'tooSoon') {
                    // A1: Die Frist läuft noch – der Zeitpunkt erklärt es.
                    toast.success(
                      t('reminder.tooSoon', {
                        when: formatDateTime(message.lastReminder),
                      }),
                    );
                  } else {
                    // A2: Zwischenzeitlich haben alle geantwortet. Das ist
                    // keine Erinnerung von gestern, sondern gar keine.
                    toast.success(t('reminder.noneLeft'));
                  }
                },
                onError: (cause) => toast.failure(cause.message),
              });
            },
          },
        ]}
      />

      <EventQrModal eventId={qrEventId} onDismiss={() => setQrEventId(null)} />

      {/* UC-010 Schritt 2: Eckdaten, «Mein Status» und die Namen hinter den
          Zahlen. Absagen schliesst das Blatt und öffnet das mit dem Grund –
          zwei Karten übereinander stünden sonst auf derselben Ebene. */}
      <EventDetailModal
        event={detailEvent}
        members={detailEvent ? affectedMembers(detailEvent.team_id) : []}
        memberId={
          detailEvent &&
          (detailEvent.team_id === null || myTeamIds.includes(detailEvent.team_id))
            ? (activeMembership?.id ?? null)
            : null
        }
        isTrainer={isTrainer}
        eventLabel={eventLabel}
        onDecline={() => {
          if (!detailEvent) return;
          setDetailEventId(null);
          setDecliningEvent({ id: detailEvent.id, startsAt: detailEvent.starts_at });
        }}
        onDismiss={() => setDetailEventId(null)}
      />

      {/* UC-009 A2 und FR-023. Das Blatt entsteht erst mit dem Termin: Ohne
          ihn hätte es nichts zu bearbeiten, und `IonModal` behielte den Stand
          des zuletzt geöffneten. */}
      <EventEditModal
        event={editEvent ?? null}
        onDismiss={() => setEditEventId(null)}
        onDone={(outcome) => {
          setEditEventId(null);
          toast.success(
            t(outcome === 'cancelled' ? 'eventEdit.cancelled' : 'eventEdit.changed'),
          );
        }}
      />

      <ShiftRosterModal
        isOpen={rosterEventId !== null}
        shifts={rosterEvent?.shifts ?? []}
        onDismiss={() => setRosterEventId(null)}
      />

      <ShiftListModal
        isOpen={shiftEventId !== null}
        why={shiftEvent?.why ?? null}
        shifts={shiftEvent?.shifts ?? []}
        attendance={shiftEvent?.attendance ?? []}
        memberId={activeMembership?.id ?? null}
        onDismiss={() => setShiftEventId(null)}
      />

      <DeclineModal
        isOpen={decliningEvent !== null}
        startsAt={decliningEvent?.startsAt ?? ''}
        isSubmitting={respond.isPending}
        error={respond.error ? (respond.error as Error).message : null}
        onDismiss={() => setDecliningEvent(null)}
        onSubmit={(reason) => {
          if (!decliningEvent) return;
          respond.mutate(
            { eventId: decliningEvent.id, status: 'excused', reason },
            {
              onSuccess: (result) => {
                setDecliningEvent(null);
                // A1 Schritt 4: Die Prämie wird genannt, wenn sie entstand.
                toast.success(
                  result.pointsAwarded > 0
                    ? t('agenda.declinedWithPoints', { points: result.pointsAwarded })
                    : t('agenda.declined'),
                );
              },
              onError: (cause) => toast.failure(cause.message),
            },
          );
        }}
      />

      <HelperEventModal
        isOpen={isHelperOpen}
        onDismiss={() => setHelperOpen(false)}
        onDone={(published, muted) => {
          setHelperOpen(false);
          if (!published) {
            toast.success(t('helperEvent.draftSaved'));
          } else {
            // A3: Sichtbar, aber ohne Push. Die Schreibaktion ist trotzdem
            // durchgegangen – der Grund gehört genannt, nicht als Fehler (§5).
            toast.success(
              muted ? t('helperEvent.mutedHint') : t('helperEvent.published'),
            );
          }
        }}
      />

      <EventFormModal
        isOpen={isFormOpen}
        onDismiss={() => setFormOpen(false)}
        onDone={() => {
          setFormOpen(false);
          toast.success(t('eventForm.created'));
        }}
      />
    </AppPage>
  );
}

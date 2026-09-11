import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonButtons,
  IonContent,
  IonFabButton,
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
  informationCircleOutline,
  locationOutline,
  pricetagOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { usePresentingElement } from '../hooks/usePresentingElement';
import { useRespondToEvent, type AgendaEvent } from '../hooks/useAgenda';
import { useToast } from '../hooks/useToast';
import { ListSection } from './ListSection';
import { nextResponse, statusLook } from './AttendanceStatusIcon';
import { canRespond, groupAttendance } from '../lib/attendance';
import { formatDateTime, formatTime } from '../lib/format';

/** Was das Detail von einem Mitglied braucht. */
export interface AttendanceMember {
  id: string;
  display_name: string;
}

interface EventDetailProps {
  event: AgendaEvent;
  /** Die Mitglieder, für die der Termin gilt – das Team oder der Verein. */
  members: AttendanceMember[];
  /** Die eigene Mitgliedschaft; `null`, wenn der Termin nicht für einen gilt. */
  memberId: string | null;
  isTrainer: boolean;
  eventLabel: (type: AgendaEvent['type']) => string;
  /** Absagen läuft über das Blatt mit dem Grund (A1) – das öffnet die Seite. */
  onDecline: () => void;
}

/**
 * Das Termin-Detail (UC-010, Schritt 2) im Schnitt der bestehenden myclub-App:
 * oben die Eckdaten mit Symbol je Zeile, darunter «Mein Status» als runder
 * Knopf in der Ampelfarbe, zuletzt die drei aufklappbaren Listen «Zugesagt»,
 * «Abgesagt» und «Keine Antwort».
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
}: EventDetailProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const respond = useRespondToEvent();

  const isCancelled = event.cancelled_at !== null;
  const hasStarted = new Date(event.starts_at) <= new Date();
  const respondable =
    memberId !== null &&
    event.published_at !== null &&
    canRespond({ isCancelled, hasStarted });

  const attendance = event.attendance ?? [];
  const mine =
    attendance.find((entry) => entry.member_id === memberId && entry.shift_id === null) ??
    null;
  const look = statusLook(mine?.status ?? null, { isCancelled, isLocked: hasStarted });
  const groups = groupAttendance(attendance, members);

  function toggle() {
    if (nextResponse(mine?.status ?? null) === 'excused') {
      onDecline();
      return;
    }
    respond.mutate(
      { eventId: event.id, status: 'registered' },
      {
        onSuccess: () => toast.success(t('agenda.attending')),
        onError: (cause) => toast.failure(cause.message),
      },
    );
  }

  return (
    <>
      <ListSection>
        {/* A3: Die Absage steht zuoberst, samt Grund. */}
        {isCancelled && (
          <IonItem>
            <IonIcon slot="start" color="danger" icon={alertCircle} />
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
          <IonIcon slot="start" icon={homeOutline} />
          <IonLabel className="ion-text-wrap">
            <h2>{event.title}</h2>
          </IonLabel>
        </IonItem>
        <IonItem>
          <IonIcon slot="start" icon={calendarOutline} />
          <IonLabel>
            <h2>
              {formatDateTime(event.starts_at)}
              {event.ends_at ? ` – ${formatTime(event.ends_at)}` : ''}
            </h2>
          </IonLabel>
        </IonItem>
        {event.location && (
          <IonItem>
            <IonIcon slot="start" icon={locationOutline} />
            <IonLabel className="ion-text-wrap">
              <h2>{event.location}</h2>
            </IonLabel>
          </IonItem>
        )}
        <IonItem>
          <IonIcon slot="start" icon={pricetagOutline} />
          <IonLabel className="ion-text-wrap">
            <h2>{eventLabel(event.type)}</h2>
          </IonLabel>
        </IonItem>
        {/* Das Warum gehört zu den Eckdaten (K3a) – wer es kennt, sagt anders zu. */}
        {event.why && (
          <IonItem>
            <IonIcon slot="start" icon={informationCircleOutline} />
            <IonLabel className="ion-text-wrap">
              <h2>{event.why}</h2>
            </IonLabel>
          </IonItem>
        )}
      </ListSection>

      {respondable && (
        <ListSection title={t('agenda.attendances')}>
          <IonItem lines="none" className="app-status-row">
            <IonFabButton
              slot="start"
              size="small"
              color={look.color}
              aria-label={t(`agenda.statusLabel.${look.labelKey}`)}
              disabled={respond.isPending}
              onClick={toggle}
            >
              <IonIcon icon={look.icon} />
            </IonFabButton>
            <IonLabel>{t('agenda.myStatus')}</IonLabel>
          </IonItem>
        </ListSection>
      )}

      {/* FR-027: der Teilnehmerstand, Person für Person. Die Zusagen stehen
          aufgeklappt, die beiden anderen Listen zugeklappt – wie gehabt. */}
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
                      <IonIcon slot="start" color="success" icon={checkmarkCircle} />
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
                      <IonIcon slot="start" color="danger" icon={closeCircle} />
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
                      <IonIcon slot="start" color="warning" icon={helpCircle} />
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

  return (
    <IonModal
      isOpen={event !== null}
      onDidDismiss={props.onDismiss}
      presentingElement={presentingElement}
    >
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={props.onDismiss}>{t('common.close')}</IonButton>
          </IonButtons>
          <IonTitle>{t('common.details')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {event && <EventDetail event={event} {...props} />}
      </IonContent>
    </IonModal>
  );
}

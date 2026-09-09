import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonButtons,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
} from '@ionic/react';
import { addOutline, peopleOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useAgenda, useRespondToEvent } from '../hooks/useAgenda';
import { usePublishEvent } from '../hooks/useHelperEvents';
import { useRemindUndecided } from '../hooks/useReminders';
import { useClub } from '../hooks/useClub';
import { useMembers } from '../hooks/useMembers';
import { AppPage } from '../components/AppPage';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { useToast } from '../hooks/useToast';
import { formatDateTime } from '../lib/format';
import { CheckInModal } from '../components/CheckInModal';
import { EventFormModal } from '../components/EventFormModal';
import { DeclineModal } from '../components/DeclineModal';
import { HelperEventModal } from '../components/HelperEventModal';
import { ShiftListModal } from '../components/ShiftListModal';
import { ShiftRosterModal } from '../components/ShiftRosterModal';
import { EventQrModal } from '../components/EventQrModal';
import { canRespond, tallyAttendance } from '../lib/attendance';
import { isCheckInOpen } from '../lib/checkInWindow';
import { canRemind, reminderMessage } from '../lib/reminder';
import { shiftCoverage } from '../lib/shift';

type Range = 'upcoming' | 'past';

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
  // UC-013 Schritt 1: der vergangene Aufruf, dessen Einsätze zu bestätigen sind.
  const [rosterEventId, setRosterEventId] = useState<string | null>(null);
  // UC-014 Schritt 1: Die Trainer:in zeigt den Code und erfasst, wer da ist.
  const [qrEventId, setQrEventId] = useState<string | null>(null);
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
  const agenda = useAgenda(range);
  const respond = useRespondToEvent();
  const publish = usePublishEvent();
  const remind = useRemindUndecided();
  // UC-015 Schritt 4: Erst sagen, wie viele es trifft, dann fragen.
  const [remindEvent, setRemindEvent] = useState<{
    id: string;
    undecided: number;
  } | null>(null);
  const events = agenda.data ?? [];
  const shiftEvent = events.find((entry) => entry.id === shiftEventId);
  const rosterEvent = events.find((entry) => entry.id === rosterEventId);

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
      toolbarEnd={
        // BR-033: Termine erfassen Trainer:innen und der Vorstand. Der
        // Helferaufruf dagegen erreicht den ganzen Verein und kennt kein
        // Team – ihn schreibt nur der Vorstand aus (UC-011 Precondition).
        isTrainer ? (
          <IonButtons slot="end">
            {isAdmin && (
              <IonButton onClick={() => setHelperOpen(true)}>
                <IonIcon
                  slot="icon-only"
                  icon={peopleOutline}
                  aria-label={t('helperEvent.title')}
                />
              </IonButton>
            )}
            <IonButton onClick={() => setFormOpen(true)}>
              <IonIcon
                slot="icon-only"
                icon={addOutline}
                aria-label={t('eventForm.title')}
              />
            </IonButton>
          </IonButtons>
        ) : undefined
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
      {agenda.isLoading ? (
        <SkeletonList />
      ) : agenda.error ? (
        <ErrorState error={agenda.error as Error} onRetry={() => void agenda.refetch()} />
      ) : events.length === 0 ? (
        <EmptyState message={t('agenda.empty')} />
      ) : (
        <IonList inset>
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
            const respondable =
              !isDraft &&
              canRespond({
                isCancelled,
                hasStarted: new Date(event.starts_at) <= new Date(),
              });
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
            // Betroffen ist bei einem Team-Termin nur dieses Team, sonst der
            // ganze Verein. Nähme man immer die Vereinsgrösse, stünde bei jedem
            // Team-Termin eine zu hohe Zahl Unentschlossener.
            const affectedCount = event.team_id
              ? activeMembers.filter((m) => m.teamIds.includes(event.team_id!)).length
              : activeMembers.length;
            // Aus demselben Grund zählt der Teilnehmerstand nur Antworten auf
            // den Termin. Zwei Personen mit je zwei Schichten ergäben sonst
            // vier Zusagen – und UC-015 erbte den Fehler.
            const eventAnswers = (event.attendance ?? []).filter(
              (entry) => entry.shift_id === null,
            );
            const tally = tallyAttendance(eventAnswers, affectedCount);
            // BR-041: die Unterdeckung, und zwar richtig gezählt. Eine Absage
            // belegt keinen Platz – wer nur `shift_id` zählt, hält eine
            // Schicht für besetzt, aus der sich längst jemand abgemeldet hat.
            const coverage = (event.shifts ?? []).map((shift) =>
              shiftCoverage(shift, event.attendance ?? []),
            );
            const shiftsFilled = coverage.reduce((sum, c) => sum + c.filled, 0);
            const shiftsNeeded = coverage.reduce((sum, c) => sum + c.needed, 0);

            const isHighlighted = event.id === highlightId;

            return (
              <IonItem
                key={event.id}
                ref={isHighlighted ? highlightRef : undefined}
                color={isHighlighted ? 'light' : undefined}
              >
                <IonLabel className="ion-text-wrap">
                  <h2>{event.title}</h2>
                  <IonNote>
                    {eventLabel(event.type)} · {formatDateTime(event.starts_at)}
                    {event.location ? ` · ${event.location}` : ''}
                  </IonNote>

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

                  {/* UC-012 Schritt 1: der Weg zu den Schichten. Ein Entwurf
                      hat noch keinen, in ihn trägt sich niemand ein. */}
                  {shiftsNeeded > 0 && !isDraft && !isCancelled && (
                    <IonButtons>
                      <IonButton
                        size="small"
                        fill="outline"
                        onClick={() => setShiftEventId(event.id)}
                      >
                        {t('shifts.open')}
                      </IonButton>

                      {/* UC-013 Schritt 1: bestätigt wird, was stattgefunden
                          hat – deshalb erst im vergangenen Bereich. */}
                      {isAdmin && range === 'past' && (
                        <IonButton
                          size="small"
                          fill="outline"
                          onClick={() => setRosterEventId(event.id)}
                        >
                          {t('roster.open')}
                        </IonButton>
                      )}
                    </IonButtons>
                  )}

                  {/* Schritt 2: der Teilnehmerstand */}
                  <p>
                    <IonNote>
                      {t('agenda.tally', {
                        yes: tally.registered,
                        no: tally.excused,
                        open: tally.undecided,
                      })}
                    </IonNote>
                  </p>

                  {/* UC-015: A2 blendet den Weg aus, sobald alle geantwortet
                      haben – erinnern liesse sich dann ohnehin niemand. */}
                  {range === 'upcoming' &&
                    canRemind({
                      isDraft,
                      isCancelled,
                      hasStarted: new Date(event.starts_at) <= new Date(),
                      undecided: membersKnown ? tally.undecided : null,
                      isTrainer,
                    }) && (
                      <IonButtons>
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
                    <IonButtons>
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

                  {/* A3: Ein abgesagter Termin zeigt den Grund und sperrt. */}
                  {isCancelled && (
                    <p>
                      <IonNote color="danger">
                        {t('agenda.cancelledWithReason', {
                          reason: event.cancelled_reason ?? '',
                        })}
                      </IonNote>
                    </p>
                  )}

                  {/* A2 zu Ende gedacht: Der gesicherte Entwurf lässt sich
                      von hier aus ausschreiben, sonst wäre er eine Sackgasse. */}
                  {isDraft && isAdmin && (
                    <IonButtons>
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

                  {range === 'upcoming' && respondable && (
                    <IonButtons>
                      <IonButton
                        size="small"
                        fill={mine?.status === 'registered' ? 'solid' : 'outline'}
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate(
                            { eventId: event.id, status: 'registered' },
                            {
                              onSuccess: () => toast.success(t('agenda.attending')),
                              onError: (cause) => toast.failure(cause.message),
                            },
                          )
                        }
                      >
                        {t('agenda.attend')}
                      </IonButton>
                      <IonButton
                        size="small"
                        color="medium"
                        fill={mine?.status === 'excused' ? 'solid' : 'outline'}
                        disabled={respond.isPending}
                        onClick={() =>
                          setDecliningEvent({ id: event.id, startsAt: event.starts_at })
                        }
                      >
                        {t('agenda.decline')}
                      </IonButton>
                    </IonButtons>
                  )}
                </IonLabel>

                {isDraft ? (
                  <IonBadge slot="end" color="medium">
                    {t('agenda.draft')}
                  </IonBadge>
                ) : (
                  mine?.status === 'present' && (
                    <IonBadge slot="end" color="success">
                      {t('agenda.checkedIn')}
                    </IonBadge>
                  )
                )}
              </IonItem>
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

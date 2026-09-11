import { useState } from 'react';
import { IonBadge, IonButton, IonItem, IonLabel, IonNote } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { MeetingInputModal } from '../components/MeetingInputModal';
import { InputTriageModal } from '../components/InputTriageModal';
import { MeetingAgendaModal } from '../components/MeetingAgendaModal';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import {
  useAnonInputs,
  useMeetingInputs,
  useMeetingTicketHashes,
  useMeetings,
} from '../hooks/useMeeting';
import { useToast } from '../hooks/useToast';
import { formatDateTime } from '../lib/format';
import { isInbox, isInputClosed } from '../lib/meeting';
import type { AppEvent } from '../lib/database.types';

/**
 * Der Dialog um die Sitzung (UC-031).
 *
 * Eine Seite für beide Rollen, wie schon bei «Stimme»: oben der Eingangskorb
 * mit dem, was zu triagieren ist (Schritte 7–9), darunter die eigenen
 * Vorschläge mit ihrem Stand (BR-134), dann die kommenden Sitzungen mit ihrer
 * Sammelansicht (A2) und zuunterst die anonymen Vorgänge dieses Geräts (A1).
 *
 * Zwei Seiten für Einreichen und Triagieren wären zwei Orte für dieselbe Sache
 * – und wer beide Rollen hat, müsste zwischen ihnen wechseln.
 *
 * Was hier **nicht** steht, steht nicht aus Versehen nicht da: kein Traktandum,
 * kein Protokoll, keine Aufgabenliste (BR-132).
 */
export function MeetingPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const inputs = useMeetingInputs();
  const meetings = useMeetings();
  const ticketHashes = useMeetingTicketHashes();
  const anonymous = useAnonInputs(ticketHashes);

  const [writing, setWriting] = useState(false);
  const [triagedId, setTriagedId] = useState<string | null>(null);
  const [agendaFor, setAgendaFor] = useState<AppEvent | null>(null);

  const rows = inputs.data ?? [];
  // Zwei Körbe aus **einer** Abfrage: Was überhaupt sichtbar ist, entscheidet
  // die Policy aus `0049`; hier wird nur sortiert.
  const inbox = rows.filter((input) => isInbox(input));
  const mine = rows.filter((input) => input.isMine);
  // Nur die Kennung im Zustand: Setzt das Blatt den Status, lädt die Abfrage
  // neu – eine Kopie zeigte danach den alten Stand.
  const triaged = rows.find((input) => input.id === triagedId) ?? null;

  const empty =
    rows.length === 0 &&
    (meetings.data ?? []).length === 0 &&
    (anonymous.data ?? []).length === 0;

  return (
    <AppPage
      title={t('meeting.title')}
      backHref="/tabs/profile"
      onRefresh={() =>
        Promise.all([inputs.refetch(), meetings.refetch(), anonymous.refetch()])
      }
    >
      {/* FR-144: Ist noch nichts da, trägt der Leerzustand den Knopf – nicht
          beide. */}
      {!empty && (
        <div className="app-actions">
          <IonButton expand="block" onClick={() => setWriting(true)}>
            {t('meeting.submitTitle')}
          </IonButton>
        </div>
      )}

      {inputs.isLoading || meetings.isLoading ? (
        <SkeletonList />
      ) : inputs.error ? (
        <ErrorState
          error={inputs.error as Error}
          onRetry={() => void inputs.refetch()}
        />
      ) : empty ? (
        <EmptyState
          message={t('meeting.empty')}
          action={{ label: t('meeting.submitTitle'), onClick: () => setWriting(true) }}
        />
      ) : (
        <>
          {/* Schritte 2–3 der Vorstandsseite: der Eingangskorb. */}
          {inbox.length > 0 && (
            <ListSection title={t('meeting.inbox')} footnote={t('meeting.inboxHint')}>
              {inbox.map((input) => (
                <IonItem
                  key={input.id}
                  button
                  detail
                  onClick={() => setTriagedId(input.id)}
                >
                  <IonLabel className="ion-text-wrap">
                    <h2>
                      {input.isAnonymous
                        ? t('meeting.anonymousInput')
                        : t('meeting.personalInput')}
                    </h2>
                    <p>{input.body}</p>
                    <IonNote>{formatDateTime(input.createdAt)}</IonNote>
                  </IonLabel>
                  <IonBadge
                    slot="end"
                    color={isInputClosed(input.status) ? 'medium' : 'primary'}
                  >
                    {t(`meeting.status.${input.status}`)}
                  </IonBadge>
                </IonItem>
              ))}
            </ListSection>
          )}

          {/* BR-134: Der Stand ist die Auskunft, auf die die einreichende
              Person wartet. */}
          {mine.length > 0 && (
            <ListSection title={t('meeting.mine')} footnote={t('meeting.mineHint')}>
              {mine.map((input) => (
                <IonItem key={input.id}>
                  <IonLabel className="ion-text-wrap">
                    <p>{input.body}</p>
                    <IonNote>{formatDateTime(input.createdAt)}</IonNote>
                    {input.response && <p>«{input.response}»</p>}
                  </IonLabel>
                  <IonBadge slot="end" color="medium">
                    {t(`meeting.status.${input.status}`)}
                  </IonBadge>
                </IonItem>
              ))}
            </ListSection>
          )}

          {(meetings.data ?? []).length > 0 && (
            <ListSection
              title={t('meeting.meetings')}
              footnote={t('meeting.meetingsHint')}
            >
              {(meetings.data ?? []).map((meeting) => (
                <IonItem
                  key={meeting.id}
                  button
                  detail
                  onClick={() => setAgendaFor(meeting)}
                >
                  <IonLabel className="ion-text-wrap">
                    <h2>{meeting.title}</h2>
                    <IonNote>{formatDateTime(meeting.starts_at)}</IonNote>
                  </IonLabel>
                </IonItem>
              ))}
            </ListSection>
          )}

          {/* A1: der anonyme Rückweg. Er hängt am Ticket dieses Geräts – nicht
              an der angemeldeten Person. */}
          {(anonymous.data ?? []).length > 0 && (
            <ListSection
              title={t('meeting.anonymousTitle')}
              footnote={t('meeting.anonymousTrackHint')}
            >
              {(anonymous.data ?? []).map((row) => (
                <IonItem key={row.inputId}>
                  <IonLabel className="ion-text-wrap">
                    <p>{row.body}</p>
                    {row.meetingAt && (
                      <IonNote>
                        {t('meeting.scheduledFor', {
                          date: formatDateTime(row.meetingAt),
                        })}
                      </IonNote>
                    )}
                    {row.response && <p>«{row.response}»</p>}
                  </IonLabel>
                  <IonBadge slot="end" color="medium">
                    {t(`meeting.status.${row.status}`)}
                  </IonBadge>
                </IonItem>
              ))}
            </ListSection>
          )}
        </>
      )}

      <MeetingInputModal
        isOpen={writing}
        onDismiss={() => setWriting(false)}
        onDone={(wasAnonymous, ticketLost) => {
          setWriting(false);
          if (ticketLost) toast.failure(t('meeting.ticketLost'));
          else
            toast.success(
              wasAnonymous ? t('meeting.sentAnonymous') : t('meeting.sent'),
            );
        }}
      />

      <InputTriageModal
        input={triaged}
        onDismiss={() => setTriagedId(null)}
        onDone={(outcome) => {
          setTriagedId(null);
          toast.success(t(`meeting.done.${outcome}`));
        }}
      />

      <MeetingAgendaModal meeting={agendaFor} onDismiss={() => setAgendaFor(null)} />
    </AppPage>
  );
}

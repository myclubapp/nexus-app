import { useState } from 'react';
import {
  IonButton,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import {
  useAnswerInput,
  useAssignInput,
  useForwardInput,
  useMeetings,
  useOffices,
} from '../hooks/useMeeting';
import { FormModal } from './FormModal';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import { formatDateTime } from '../lib/format';
import { canDecide, isInputClosed, type MeetingInput } from '../lib/meeting';

interface InputTriageProps {
  input: MeetingInput;
  onDone: (outcome: 'scheduled' | 'running' | 'forwarded' | 'answered' | 'declined') => void;
  onDismiss: () => void;
}

/** Der Sentinel für «laufend bearbeiten» – eine Auswahl ohne Sitzung. */
const RUNNING = 'running';

/**
 * Einen Input triagieren und beantworten (UC-031, Schritte 7–9).
 *
 * Schritt 7 kennt genau zwei Entscheide: **laufend bearbeiten** oder **einer
 * Sitzung zuordnen**. Beide stehen deshalb in einer Auswahl und nicht als zwei
 * Knöpfe – es ist eine Entscheidung, keine zwei.
 *
 * BR-134 ist der Grund, warum die Zuordnung hier so prominent steht: Der Status
 * **ist** schon eine Antwort. «Eingeplant für den 14.3.» erreicht die
 * einreichende Person, lange bevor der Entscheid fällt.
 */
export function InputTriage({ input, onDone, onDismiss }: InputTriageProps) {
  const { t } = useTranslation();
  const meetings = useMeetings();
  const offices = useOffices();
  const assign = useAssignInput();
  const forward = useForwardInput();
  const answer = useAnswerInput();

  const [target, setTarget] = useState<string | null>(
    input.meetingEventId ?? (input.status === 'in_progress' ? RUNNING : null),
  );
  const [text, setText] = useState('');
  const [forwardTo, setForwardTo] = useState<string[]>([]);

  const closed = isInputClosed(input.status);
  // An welches Gremium der Vorschlag ging. Ohne diese Zeile beantwortete man
  // ihn, ohne zu wissen, wer sonst noch zuständig ist – und A4 («falsches
  // Gremium») liesse sich gar nicht beurteilen.
  const addressed = (offices.data ?? [])
    .filter((office) => input.committeeRoleIds.includes(office.id))
    .map((office) => office.title);
  const isBusy = assign.isPending || forward.isPending || answer.isPending;
  const error =
    (assign.error as Error | null)?.message ??
    (forward.error as Error | null)?.message ??
    (answer.error as Error | null)?.message ??
    null;

  async function decide(decline: boolean) {
    await answer.mutateAsync({ inputId: input.id, answer: text, decline });
    onDone(decline ? 'declined' : 'answered');
  }

  function applyTriage() {
    if (target === null) {
      onDismiss();
      return;
    }
    assign.mutate(
      { inputId: input.id, meetingEventId: target === RUNNING ? null : target },
      { onSuccess: () => onDone(target === RUNNING ? 'running' : 'scheduled') },
    );
  }

  return (
    <FormModal
      isOpen
      title={t('meeting.triageTitle')}
      submitLabel={closed ? t('common.close') : t('meeting.applyTriage')}
      canSubmit={closed ? true : target !== null && !isBusy}
      isSubmitting={isBusy}
      error={error}
      onDismiss={onDismiss}
      onSubmit={() => (closed ? onDismiss() : applyTriage())}
    >
      {/* Der Vorschlag – ungekürzt, so wie er eingereicht wurde. */}
      <ListSection
        title={
          input.isAnonymous ? t('meeting.anonymousInput') : t('meeting.personalInput')
        }
        footnote={formatDateTime(input.createdAt)}
      >
        <IonItem lines="none">
          <IonLabel className="ion-text-wrap">
            <p>{input.body}</p>
            {addressed.length > 0 && (
              <IonNote>
                {t('meeting.addressedTo', { offices: addressed.join(', ') })}
              </IonNote>
            )}
          </IonLabel>
        </IonItem>
      </ListSection>

      {closed ? (
        <ListSection title={t('meeting.answerTitle')} footnote={t('meeting.closedHint')}>
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <h2>{t(`meeting.status.${input.status}`)}</h2>
              <p>{input.response}</p>
              <IonNote>{formatDateTime(input.respondedAt)}</IonNote>
            </IonLabel>
          </IonItem>
        </ListSection>
      ) : (
        <>
          {/* Schritt 7: laufend bearbeiten **oder** einer Sitzung zuordnen. */}
          <ListSection
            title={t('meeting.triageStep')}
            footnote={t('meeting.triageHint')}
          >
            <IonItem>
              <IonSelect
                label={t('meeting.triageLabel')}
                labelPlacement="stacked"
                value={target}
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
                onIonChange={(e) => setTarget(e.detail.value as string)}
              >
                <IonSelectOption value={RUNNING}>
                  {t('meeting.handleRunning')}
                </IonSelectOption>
                {(meetings.data ?? []).map((meeting) => (
                  <IonSelectOption key={meeting.id} value={meeting.id}>
                    {meeting.title} – {formatDateTime(meeting.starts_at)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </ListSection>

          {/* Schritt 9: die dokumentierte Antwort. */}
          <ListSection title={t('meeting.answerTitle')} footnote={t('meeting.answerHint')}>
            <IonItem>
              <IonTextarea
                label={t('meeting.answerLabel')}
                labelPlacement="stacked"
                autoGrow
                rows={4}
                value={text}
                onIonInput={(e) => setText(e.detail.value ?? '')}
              />
            </IonItem>
          </ListSection>

          {/* A4: an das zuständige Gremium weiterleiten. */}
          <ListSection
            title={t('meeting.forwardTitle')}
            footnote={t('meeting.forwardHint')}
          >
            <IonItem>
              <IonSelect
                multiple
                label={t('meeting.forwardLabel')}
                labelPlacement="stacked"
                value={forwardTo}
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
                onIonChange={(e) => setForwardTo(e.detail.value as string[])}
              >
                {(offices.data ?? []).map((office) => (
                  <IonSelectOption key={office.id} value={office.id}>
                    {office.title}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </ListSection>

          {!canDecide(text) && <InlineError message={t('meeting.problem.answerMissing')} />}

          <div className="app-actions">
            <IonButton
              expand="block"
              disabled={!canDecide(text) || isBusy}
              onClick={() => void decide(false).catch(() => undefined)}
            >
              {t('meeting.answerAndClose')}
            </IonButton>
            <IonButton
              expand="block"
              fill="outline"
              color="warning"
              disabled={!canDecide(text) || isBusy}
              onClick={() => void decide(true).catch(() => undefined)}
            >
              {t('meeting.decline')}
            </IonButton>
            <IonButton
              expand="block"
              fill="clear"
              disabled={forwardTo.length === 0 || isBusy}
              onClick={() =>
                forward.mutate(
                  { inputId: input.id, committeeRoleIds: forwardTo },
                  { onSuccess: () => onDone('forwarded') },
                )
              }
            >
              {t('meeting.forward')}
            </IonButton>
          </div>
        </>
      )}
    </FormModal>
  );
}

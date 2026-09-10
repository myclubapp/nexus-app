import { useState } from 'react';
import {
  IonButton,
  IonItem,
  IonLabel,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useCheckinPrompts, useSkipCheckin, useSubmitCheckin } from '../hooks/useContextCheckin';
import { FormModal } from './FormModal';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import { SkeletonList } from './Skeletons';
import {
  scaleSteps,
  validateCheckin,
  visibilitiesFor,
  type CheckinAnswer,
  type CheckinInvitation,
  type Visibility,
} from '../lib/contextCheckin';

interface CheckinPromptProps {
  invitation: CheckinInvitation;
  onDone: (outcome: 'answered' | 'skipped') => void;
  onDismiss: () => void;
}

/**
 * Ein Kontext-Check-in beantworten (UC-032, Schritte 3–7).
 *
 * Die Reihenfolge im Blatt ist die Reihenfolge der Spezifikation, und sie ist
 * kein Zufall: **Zuerst steht, wer die Antwort sehen wird** (Schritt 4), dann
 * kommt die Frage. Wer erst nach dem Antippen erfährt, wer mitliest, hat nicht
 * gewählt (FR-104, BR-139).
 *
 * Der letzte Abschnitt sagt ausdrücklich, dass es dafür keine Punkte gibt
 * (Schritt 7). Das ist keine Beiläufigkeit: Belohntes Befinden wäre verzerrtes
 * Befinden (BR-138), und wer das nicht liest, rechnet damit.
 */
export function CheckinPrompt({ invitation, onDone, onDismiss }: CheckinPromptProps) {
  const { t } = useTranslation();
  const prompts = useCheckinPrompts(invitation.context);
  const submit = useSubmitCheckin();
  const skip = useSkipCheckin();

  const [answers, setAnswers] = useState<Record<string, CheckinAnswer>>({});
  const [visibility, setVisibility] = useState<Visibility>('private');

  const rows = prompts.data ?? [];
  const choices = visibilitiesFor(invitation.context);
  const given = rows.map(
    (prompt) => answers[prompt.id] ?? { promptId: prompt.id, value: null, text: '' },
  );
  const problems = validateCheckin(given);

  const isBusy = submit.isPending || skip.isPending;
  const error =
    (submit.error as Error | null)?.message ??
    (skip.error as Error | null)?.message ??
    null;

  function setValue(promptId: string, value: number) {
    setAnswers((current) => ({
      ...current,
      [promptId]: { promptId, value, text: current[promptId]?.text ?? '' },
    }));
  }

  function setText(promptId: string, text: string) {
    setAnswers((current) => ({
      ...current,
      [promptId]: { promptId, value: current[promptId]?.value ?? null, text },
    }));
  }

  return (
    <FormModal
      isOpen
      title={t('checkin.title')}
      submitLabel={t('checkin.send')}
      canSubmit={problems.length === 0 && !isBusy}
      isSubmitting={isBusy}
      error={error}
      onDismiss={onDismiss}
      onSubmit={() =>
        submit.mutate(
          { invitationId: invitation.id, answers: given, visibility },
          { onSuccess: () => onDone('answered') },
        )
      }
    >
      {invitation.eventTitle && (
        <ListSection title={t(`checkin.context.${invitation.context}`)}>
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <p>{invitation.eventTitle}</p>
            </IonLabel>
          </IonItem>
        </ListSection>
      )}

      {/* Schritt 4: **zuerst** die Sichtbarkeit. Sie ist die Voraussetzung
          dafür, dass die Antwort danach ehrlich ausfällt. */}
      <ListSection
        title={t('checkin.visibilityTitle')}
        footnote={t(`checkin.visibilityHint.${visibility}`)}
      >
        {choices.length === 1 ? (
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <h2>{t('checkin.visibility.private')}</h2>
            </IonLabel>
          </IonItem>
        ) : (
          <IonItem>
            <IonSelect
              label={t('checkin.visibilityLabel')}
              labelPlacement="stacked"
              value={visibility}
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
              onIonChange={(e) => setVisibility(e.detail.value as Visibility)}
            >
              {choices.map((choice) => (
                <IonSelectOption key={choice} value={choice}>
                  {t(`checkin.visibility.${choice}`)}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        )}
      </ListSection>

      {prompts.isLoading ? (
        <SkeletonList rows={2} />
      ) : (
        rows.map((prompt) => (
          <ListSection key={prompt.id} title={prompt.question}>
            {prompt.scale === 'freetext' ? (
              <IonItem>
                <IonTextarea
                  label={t('checkin.textLabel')}
                  labelPlacement="stacked"
                  autoGrow
                  rows={3}
                  value={answers[prompt.id]?.text ?? ''}
                  onIonInput={(e) => setText(prompt.id, e.detail.value ?? '')}
                />
              </IonItem>
            ) : (
              <IonItem lines="none">
                {/* Fünf Stufen als Segment – die Ionic-Entsprechung einer
                    kurzen Skala. Ein nachgebauter Sternebalken wäre ein
                    Eigenbau ohne Not (guidelines §11.6). */}
                <IonSegment
                  value={answers[prompt.id]?.value?.toString()}
                  onIonChange={(e) => setValue(prompt.id, Number(e.detail.value))}
                >
                  {scaleSteps(prompt.scale).map((step) => (
                    <IonSegmentButton key={step} value={step.toString()}>
                      <IonLabel>{t(`checkin.step.${prompt.scale}.${step}`)}</IonLabel>
                    </IonSegmentButton>
                  ))}
                </IonSegment>
              </IonItem>
            )}
          </ListSection>
        ))
      )}

      {problems.map((problem) => (
        <InlineError key={problem} message={t(`checkin.problem.${problem}`)} />
      ))}

      {/* Schritt 7: ausdrücklich, nicht im Kleingedruckten. */}
      <IonNote className="app-footnote">{t('checkin.noPoints')}</IonNote>

      <div className="app-actions">
        {/* A1: Überspringen ist ein gleichwertiger Ausgang, kein Abbruch. */}
        <IonButton
          expand="block"
          fill="clear"
          disabled={isBusy}
          onClick={() =>
            skip.mutate(invitation.id, { onSuccess: () => onDone('skipped') })
          }
        >
          {t('checkin.skip')}
        </IonButton>
      </div>
    </FormModal>
  );
}

import {
  IonBadge,
  IonButton,
  IonItem,
  IonLabel,
  IonNote,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useClub } from '../hooks/useClub';
import { useSetSignalStatus } from '../hooks/useHealth';
import { FormModal } from './FormModal';
import { ListSection } from './ListSection';
import { formatDate } from '../lib/format';
import {
  PROMPTS_PER_SIGNAL,
  canTakeOver,
  isClubSignal,
  severityColor,
  signalKey,
  type HealthSignal,
} from '../lib/health';

interface HealthSignalProps {
  signal: HealthSignal;
  onDone: (outcome: string) => void;
  onDismiss: () => void;
}

/**
 * Einen Fürsorge-Hinweis ansehen und triagieren (UC-023, Schritte 4–8).
 *
 * Die Reihenfolge im Blatt ist die Reihenfolge der Regeln: zuerst der Anlass
 * in fürsorglicher Sprache (BR-095), dann zwei bis drei Gesprächsimpulse
 * (FR-065) – oder bei einem Vereinssignal die Frage danach, was **wir** ändern
 * können (FR-066, BR-095). Erst ganz unten der Statuswechsel.
 *
 * Was hier **nicht** steht: eine Historie, eine Anwesenheitsliste, eine Zahl
 * über die Person. Der Hinweis ist ein Anlass für ein Gespräch, keine Akte.
 */
export function HealthSignalDetail({ signal, onDone, onDismiss }: HealthSignalProps) {
  const { t } = useTranslation();
  const { activeMembership } = useClub();
  const setStatus = useSetSignalStatus();

  const isClub = isClubSignal(signal);
  const mayTakeOver = canTakeOver(signal, activeMembership?.id ?? null);
  const prompts = Array.from({ length: PROMPTS_PER_SIGNAL }, (_, index) =>
    t(signalKey(signal.signalType, `prompt${index + 1}`), { defaultValue: '' }),
  ).filter((prompt) => prompt.length > 0);

  return (
    <FormModal
      isOpen
      title={isClub ? t('health.club') : (signal.memberName ?? t('health.member'))}
      submitLabel={t('common.close')}
      canSubmit={!setStatus.isPending}
      isSubmitting={setStatus.isPending}
      error={setStatus.error ? (setStatus.error as Error).message : null}
      onDismiss={onDismiss}
      onSubmit={onDismiss}
    >
      {/* Schritt 3 und 5: der Anlass, fürsorglich formuliert. */}
      <ListSection>
        <IonItem>
          <IonLabel className="ion-text-wrap">
            <h2>{t(signalKey(signal.signalType, 'title'))}</h2>
            <p>
              {t(signalKey(signal.signalType, 'body'), { detail: signal.detail })}
            </p>
            <IonNote>{formatDate(signal.detectedAt)}</IonNote>
          </IonLabel>
          <IonBadge slot="end" color={severityColor(signal.severity)}>
            {t(`health.severity.${signal.severity}`)}
          </IonBadge>
        </IonItem>
      </ListSection>

      {/* FR-065 beziehungsweise FR-066. Ein Signaltyp ohne Impulse – etwa
          einer aus einem Modul, das erst später Texte mitbringt – bekommt hier
          keinen leeren Abschnitt mit Überschrift. */}
      {prompts.length > 0 && (
        <ListSection
          title={isClub ? t('health.actionQuestion') : t('health.prompts')}
          footnote={isClub ? t('health.actionHint') : t('health.promptsHint')}
        >
          {prompts.map((prompt) => (
            <IonItem key={prompt}>
              <IonLabel className="ion-text-wrap">
                <p>{prompt}</p>
              </IonLabel>
            </IonItem>
          ))}
        </ListSection>
      )}

      {/* A1: Wer sich kümmert, steht hier – und wird nicht verdrängt. */}
      {signal.status === 'in_contact' && signal.ownerName && (
        <IonNote className="app-footnote">
          {t('health.ownedBy', { name: signal.ownerName })}
        </IonNote>
      )}

      <div className="app-actions">
        {mayTakeOver && signal.status !== 'in_contact' && (
          <IonButton
            expand="block"
            disabled={setStatus.isPending}
            onClick={() =>
              setStatus.mutate(
                { signalId: signal.id, status: 'in_contact' },
                { onSuccess: (outcome) => onDone(outcome) },
              )
            }
          >
            {t('health.markInContact')}
          </IonButton>
        )}

        {/* Lösen darf jede zuständige Person – sonst bliebe ein Hinweis
            liegen, wenn die zuständige Person ausfällt. */}
        <IonButton
          expand="block"
          fill="outline"
          disabled={setStatus.isPending}
          onClick={() =>
            setStatus.mutate(
              { signalId: signal.id, status: 'resolved' },
              { onSuccess: (outcome) => onDone(outcome) },
            )
          }
        >
          {t('health.resolve')}
        </IonButton>
        <IonNote>{t('health.resolveHint')}</IonNote>
      </div>
    </FormModal>
  );
}

/** Blatt-Hülle; der Inhalt entsteht erst beim Öffnen. */
export function HealthSignalModal({
  signal,
  ...props
}: Omit<HealthSignalProps, 'signal'> & { signal: HealthSignal | null }) {
  if (!signal) return null;
  return <HealthSignalDetail signal={signal} {...props} />;
}

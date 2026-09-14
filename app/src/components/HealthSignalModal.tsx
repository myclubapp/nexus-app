import {
  IonBadge,
  IonButton,
  IonItem,
  IonLabel,
  IonNote,
  IonSpinner,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useClub } from '../hooks/useClub';
import { useSetSignalStatus } from '../hooks/useHealth';
import { FormModal } from './FormModal';
import { useSheetProps } from '../hooks/useSheetProps';
import { ListSection } from './ListSection';
import { TextSection } from './TextSection';
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
  /** Das Blatt fährt mit `false` zu; der Inhalt bleibt, bis es unten ist. */
  isOpen?: boolean;
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
export function HealthSignalDetail({ signal, onDone, onDismiss, isOpen = true }: HealthSignalProps) {
  const { t } = useTranslation();
  const { activeMembership } = useClub();
  const setStatus = useSetSignalStatus();

  const isClub = isClubSignal(signal);
  const mayTakeOver = canTakeOver(signal, activeMembership?.id ?? null);
  const prompts = Array.from({ length: PROMPTS_PER_SIGNAL }, (_, index) =>
    t(signalKey(signal.signalType, `prompt${index + 1}`), { defaultValue: '' }),
  ).filter((prompt) => prompt.length > 0);

  return (
    // Ein Blatt, das anzeigt: «Schliessen» steht einmal in der Kopfzeile; was
    // etwas tut, steht unten als Knopf, der es sagt (guidelines.md §2).
    <FormModal
      isOpen={isOpen}
      title={isClub ? t('health.club') : (signal.memberName ?? t('health.member'))}
      error={setStatus.error ? (setStatus.error as Error).message : null}
      onDismiss={onDismiss}
    >
      {/* Schritt 3 und 5: der Anlass, fürsorglich formuliert. Die Zeile trägt
          Titel, Datum und Dringlichkeit; der Satz dazu steht als Text darunter,
          nicht eingezwängt in die Zeile. */}
      <ListSection>
        <IonItem>
          <IonLabel className="ion-text-wrap">
            <h2>{t(signalKey(signal.signalType, 'title'))}</h2>
            <IonNote>{formatDate(signal.detectedAt)}</IonNote>
          </IonLabel>
          <IonBadge slot="end" color={severityColor(signal.severity)}>
            {t(`health.severity.${signal.severity}`)}
          </IonBadge>
        </IonItem>
      </ListSection>
      <TextSection>
        <p>{t(signalKey(signal.signalType, 'body'), { detail: signal.detail })}</p>
      </TextSection>

      {/* FR-065 beziehungsweise FR-066. Ein Signaltyp ohne Impulse – etwa
          einer aus einem Modul, das erst später Texte mitbringt – bekommt hier
          keinen leeren Abschnitt mit Überschrift. */}
      {prompts.length > 0 && (
        <TextSection title={isClub ? t('health.actionQuestion') : t('health.prompts')}>
          {prompts.map((prompt) => (
            <p key={prompt}>{prompt}</p>
          ))}
          <p>
            <IonNote>{isClub ? t('health.actionHint') : t('health.promptsHint')}</IonNote>
          </p>
        </TextSection>
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
            {setStatus.isPending && setStatus.variables?.status === 'in_contact' ? (
              <IonSpinner name="crescent" />
            ) : (
              t('health.markInContact')
            )}
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
          {setStatus.isPending && setStatus.variables?.status === 'resolved' ? (
            <IonSpinner name="crescent" />
          ) : (
            t('health.resolve')
          )}
        </IonButton>
        <IonNote>{t('health.resolveHint')}</IonNote>
      </div>
    </FormModal>
  );
}


/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function HealthSignalModal({
  signal,
  ...props
}: Omit<HealthSignalProps, 'signal'> & { signal: HealthSignal | null }) {
  const sheet = useSheetProps(signal ? { signal, ...props } : null);
  return sheet && <HealthSignalDetail {...sheet} />;
}

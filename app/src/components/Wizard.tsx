import type { ReactNode } from 'react';
import { IonButton, IonNote, IonProgressBar, IonSpinner, IonText } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { InlineError } from './StateViews';

export interface WizardStep {
  /** Stabiler Schlüssel, auch der React-Key des Schritts. */
  id: string;
  /** Frage über dem Schritt, in der Sprache der Person. */
  title: string;
  /** Erklärung unter der Frage. */
  hint?: string;
  /** Blockiert «Weiter», solange die Eingabe unvollständig ist. */
  isComplete: boolean;
  content: ReactNode;
}

interface WizardProps {
  steps: WizardStep[];
  /** Index des sichtbaren Schritts; der Zustand liegt bei der Seite. */
  current: number;
  onCurrentChange: (index: number) => void;
  /** Beschriftung im letzten Schritt, z.B. «Verein erstellen». */
  finishLabel: string;
  onFinish: () => void;
  isSubmitting?: boolean;
  /** Fehler des letzten Versuchs. Die Eingaben bleiben dabei stehen. */
  error?: string | null;
  /**
   * Der Ausstieg, für Schrittführungen, die niemand durchlaufen **muss** –
   * die Einrichtung eines Vereins etwa (UC-051, BR-259). Ohne ihn gibt es
   * keinen Knopf: Die Gründung hat keinen Ausstieg, sie hat ein Ziel.
   */
  onSkip?: () => void;
  skipLabel?: string;
}

/**
 * Schrittführung ohne Fachwissen.
 *
 * Ein Schritt, eine Frage: auf einem Telefon ist ein Formular mit sechs Feldern
 * eine Wand, drei Fragen nacheinander sind ein Gespräch. Der Fortschrittsbalken
 * beantwortet die Frage «wie lange noch», die sonst zum Abbruch führt
 * (NFR-024).
 *
 * Die Eingaben bleiben bei einem Fehler stehen: Der Wizard hält keinen eigenen
 * Formularzustand, sondern zeigt nur, was die Seite ihm gibt.
 *
 * `onSkip` ist der Ausstieg für Schrittführungen, die niemand durchlaufen
 * muss – die Einrichtung eines Vereins (UC-051). Die Gründung selbst hat ihn
 * nicht: Ein Wizard ohne Ausstieg ist eine Aufgabe, einer mit Ausstieg ein
 * Angebot, und die Gründung ist eine Aufgabe.
 */
export function Wizard({
  steps,
  current,
  onCurrentChange,
  finishLabel,
  onFinish,
  isSubmitting = false,
  error,
  onSkip,
  skipLabel,
}: WizardProps) {
  const { t } = useTranslation();

  const index = Math.min(Math.max(current, 0), steps.length - 1);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  if (!step) return null;

  return (
    <>
      <IonProgressBar
        value={(index + 1) / steps.length}
        aria-label={t('common.stepOf', { current: index + 1, total: steps.length })}
      />

      <div className="app-wizard">
        <IonNote>
          {t('common.stepOf', { current: index + 1, total: steps.length })}
        </IonNote>
        <IonText>
          <h2 className="app-wizard__title">{step.title}</h2>
        </IonText>
        {step.hint && <IonNote>{step.hint}</IonNote>}
      </div>

      {step.content}

      {error && <InlineError message={error} />}

      <div className="app-actions">
        <IonButton
          expand="block"
          disabled={!step.isComplete || isSubmitting}
          onClick={() => (isLast ? onFinish() : onCurrentChange(index + 1))}
        >
          {isSubmitting ? (
            <IonSpinner name="crescent" />
          ) : isLast ? (
            finishLabel
          ) : (
            t('common.next')
          )}
        </IonButton>

        {index > 0 && (
          <IonButton
            expand="block"
            fill="clear"
            disabled={isSubmitting}
            onClick={() => onCurrentChange(index - 1)}
          >
            {t('common.back')}
          </IonButton>
        )}

        {onSkip && (
          <IonButton
            expand="block"
            fill="clear"
            color="medium"
            disabled={isSubmitting}
            onClick={onSkip}
          >
            {skipLabel ?? t('common.skip')}
          </IonButton>
        )}
      </div>
    </>
  );
}

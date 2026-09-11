import { useState } from 'react';
import { IonInput, IonItem, IonNote, IonRadio, IonRadioGroup } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { FormModal } from './FormModal';
import { useSheetProps } from '../hooks/useSheetProps';
import { ListSection } from './ListSection';
import {
  DECLINE_REASONS,
  isEarlyDecline,
  type DeclineReasonKey,
} from '../lib/attendance';

interface DeclineFormProps {
  /** Beginn des Termins – entscheidet, ob die Absage noch rechtzeitig ist. */
  startsAt: string;
  isSubmitting: boolean;
  error?: string | null;
  onSubmit: (reason: string) => void;
  onDismiss: () => void;
  /** Das Blatt fährt mit `false` zu; der Inhalt bleibt, bis es unten ist. */
  isOpen?: boolean;
}

/**
 * Absagen mit Grund (UC-010 A1).
 *
 * Vorformulierte Gründe **und** ein Freitextfeld, wie die Spezifikation es
 * verlangt: Die Liste macht die häufigen Fälle zu einem Tap, das Feld lässt
 * Raum für alles andere.
 *
 * Der Hinweis auf die Abmeldeprämie steht hier und nicht erst danach – wer
 * weiss, dass eine rechtzeitige Absage zählt, sagt eher rechtzeitig ab. Das
 * ist der ganze Zweck von BR-040.
 */
export function DeclineForm({
  startsAt,
  isSubmitting,
  error,
  onSubmit,
  onDismiss,
  isOpen = true,
}: DeclineFormProps) {
  const { t } = useTranslation();
  const [reasonKey, setReasonKey] = useState<DeclineReasonKey>('ill');
  const [freeText, setFreeText] = useState('');

  const isEarly = isEarlyDecline(startsAt);
  const reason = reasonKey === 'other' ? freeText : t(`agenda.declineReasons.${reasonKey}`);
  const canSubmit = reasonKey !== 'other' || freeText.trim().length > 0;

  return (
    <FormModal
      isOpen={isOpen}
      title={t('agenda.decline')}
      submitLabel={t('agenda.declineConfirm')}
      canSubmit={canSubmit}
      isSubmitting={isSubmitting}
      error={error}
      onDismiss={onDismiss}
      onSubmit={() => onSubmit(reason)}
    >
      <ListSection footnote={t('agenda.declineReasonHint')}>
        <IonRadioGroup
          value={reasonKey}
          onIonChange={(e) => setReasonKey(e.detail.value as DeclineReasonKey)}
        >
          {DECLINE_REASONS.map((key) => (
            <IonItem key={key}>
              <IonRadio value={key} justify="start" labelPlacement="end">
                {t(`agenda.declineReasons.${key}`)}
              </IonRadio>
            </IonItem>
          ))}
        </IonRadioGroup>
      </ListSection>

      {reasonKey === 'other' && (
        <ListSection>
          <IonItem>
            <IonInput
              label={t('agenda.declineFreeText')}
              labelPlacement="stacked"
              value={freeText}
              onIonInput={(e) => setFreeText(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      )}

      {/* BR-039: Eine Absage kostet nie Punkte – das steht ausdrücklich da,
          damit niemand aus Angst vor Abzug schweigt. */}
      <div className="app-hint">
        <IonNote color={isEarly ? 'success' : 'medium'}>
          {isEarly ? t('agenda.declineEarly') : t('agenda.declineLate')}
        </IonNote>
      </div>
    </FormModal>
  );
}


/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function DeclineModal({
  isOpen,
  ...props
}: DeclineFormProps & { isOpen: boolean }) {
  const sheet = useSheetProps(isOpen ? props : null);
  return sheet && <DeclineForm {...sheet} />;
}

import type { ReactNode } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { InlineError } from './StateViews';

interface FormModalProps {
  isOpen: boolean;
  title: string;
  /** Beschriftung der Bestätigung; Standard ist «Speichern». */
  submitLabel?: string;
  /** Deaktiviert die Bestätigung, solange Pflichtfelder fehlen. */
  canSubmit?: boolean;
  isSubmitting?: boolean;
  /** Fehlermeldung des letzten Versuchs; wird über den Feldern angezeigt. */
  error?: string | null;
  onSubmit: () => void;
  onDismiss: () => void;
  children: ReactNode;
}

/**
 * Formular als Blatt über der Seite – das iOS-Muster für «etwas erfassen».
 *
 * Abbrechen links, Bestätigen rechts: dieselbe Anordnung wie in den
 * Systemdialogen, damit der Daumen sie nicht suchen muss. Der Fehler des
 * letzten Versuchs steht im Formular und nicht in einem Toast, weil er sich
 * auf ein Feld bezieht, das die Person gerade korrigieren soll.
 */
export function FormModal({
  isOpen,
  title,
  submitLabel,
  canSubmit = true,
  isSubmitting = false,
  error,
  onSubmit,
  onDismiss,
  children,
}: FormModalProps) {
  const { t } = useTranslation();

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>{t('common.cancel')}</IonButton>
          </IonButtons>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <IonButton
              strong
              disabled={!canSubmit || isSubmitting}
              onClick={onSubmit}
            >
              {isSubmitting ? (
                <IonSpinner name="crescent" />
              ) : (
                (submitLabel ?? t('common.save'))
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {error && <InlineError message={error} />}
        {children}
      </IonContent>
    </IonModal>
  );
}

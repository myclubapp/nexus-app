import { IonButton, IonIcon, IonNote, IonSpinner, IonText } from '@ionic/react';
import { alertCircleOutline, fileTrayOutline, settingsOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';

/**
 * Die drei Zustände, in denen eine Ansicht keine Daten zeigt. Sie sehen überall
 * gleich aus, damit «lädt», «leer» und «kaputt» nicht verwechselt werden; das
 * Layout steht in `theme/variables.css` unter `.app-state`.
 */
export function LoadingState() {
  const { t } = useTranslation();
  return (
    <div className="app-state" role="status">
      <IonSpinner name="crescent" />
      <IonNote>{t('common.loading')}</IonNote>
    </div>
  );
}

export function EmptyState({ message, icon }: { message: string; icon?: string }) {
  return (
    <div className="app-state">
      <IonIcon
        icon={icon ?? fileTrayOutline}
        color="medium"
        className="app-state__icon"
        aria-hidden="true"
      />
      <IonNote>{message}</IonNote>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="app-state" role="alert">
      <IonIcon
        icon={alertCircleOutline}
        color="danger"
        className="app-state__icon"
        aria-hidden="true"
      />
      <IonText>
        <strong>{t('common.error')}</strong>
      </IonText>
      <IonNote>{error.message}</IonNote>
      {onRetry && (
        <IonButton fill="outline" size="small" onClick={onRetry}>
          {t('common.retry')}
        </IonButton>
      )}
    </div>
  );
}

/**
 * Fehlertext im Fluss einer Seite – etwa unter einem Formular.
 *
 * Das `role="alert"` sitzt bewusst auf dem `div` und nicht auf dem `IonNote`:
 * Ionic-Komponenten nehmen Eigenschaften als DOM-Properties entgegen, nicht als
 * Attribute. Auf einer Web-Komponente käme die Rolle in jsdom gar nicht und im
 * Browser nur über ARIA-Reflexion an – auf einem gewöhnlichen Element kommt sie
 * überall an.
 */
export function InlineError({ message }: { message: string }) {
  return (
    <div className="app-hint" role="alert">
      <IonNote color="danger">{message}</IonNote>
    </div>
  );
}

/**
 * Bestätigung im Fluss einer Seite. Wie {@link InlineError} trägt das
 * gewöhnliche `div` die Rolle – `role="status"` auf einem `IonNote` käme nicht
 * an. `status` statt `alert`, weil eine Bestätigung nicht unterbrechen soll.
 */
export function InlineSuccess({ message }: { message: string }) {
  return (
    <div className="app-hint" role="status">
      <IonNote color="success">{message}</IonNote>
    </div>
  );
}

/** Shown when the Supabase environment variables are still missing. */
export function NotConfiguredState() {
  const { t } = useTranslation();
  return (
    <div className="app-state">
      <IonIcon
        icon={settingsOutline}
        color="warning"
        className="app-state__icon"
        aria-hidden="true"
      />
      <IonNote>{t('common.notConfigured')}</IonNote>
    </div>
  );
}

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

/**
 * Die leere Ansicht – mit Erklärung und mindestens einem nächsten Schritt.
 *
 * **BR-165: «Kein Bildschirm ohne Inhalt oder Erklärung.»** Eine leere Fläche
 * ohne Text ist kein zulässiger Zustand. Seit UC-037 ist das Handlungsangebot
 * Teil der Komponente und nicht mehr etwas, woran jede Ansicht selbst denken
 * muss: `action` erscheint als Knopf unter der Erklärung.
 */
export function EmptyState({
  message,
  icon,
  action,
}: {
  message: string;
  icon?: string;
  /** Der nächste Schritt. Ohne ihn bleibt es bei der Erklärung. */
  action?: { label: string; onClick?: () => void; routerLink?: string };
}) {
  return (
    <div className="app-state">
      <IonIcon
        icon={icon ?? fileTrayOutline}
        color="medium"
        className="app-state__icon"
        aria-hidden="true"
      />
      <IonNote>{message}</IonNote>
      {action && (
        <IonButton
          className="app-state__action"
          fill="outline"
          size="small"
          onClick={action.onClick}
          routerLink={action.routerLink}
        >
          {action.label}
        </IonButton>
      )}
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

/** Steht, solange die Supabase-Umgebungsvariablen fehlen. */
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

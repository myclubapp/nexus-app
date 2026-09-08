import type { ReactNode } from 'react';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
} from '@ionic/react';

interface AppPageProps {
  /** Titel in der Kopfzeile und – sofern nicht abgewählt – als grosser Titel. */
  title: string;
  /**
   * Abweichender grosser Titel. `false` unterdrückt die zweite Kopfzeile für
   * Seiten, die direkt mit Inhalt beginnen sollen (z.B. Formulare).
   */
  largeTitle?: string | false;
  /** Zielroute des Zurück-Knopfs. Ohne Angabe erscheint keiner. */
  backHref?: string;
  /** Aktionen rechts in der Kopfzeile, üblicherweise `IonButtons`. */
  toolbarEnd?: ReactNode;
  /** Zweite Kopfzeile, üblicherweise ein `IonSegment` oder `IonSearchbar`. */
  subToolbar?: ReactNode;
  /** Aktiviert «Ziehen zum Aktualisieren». */
  onRefresh?: () => Promise<unknown>;
  children: ReactNode;
}

/**
 * Seitengerüst aller Ansichten.
 *
 * Der grosse, beim Scrollen zusammenfallende Titel ist das iOS-Muster von
 * Ionic: eine durchscheinende Kopfzeile aussen, eine zweite mit
 * `collapse="condense"` im Inhalt, und `fullscreen` am `IonContent`. Fehlt
 * eines der drei Teile, bleibt der grosse Titel stehen oder verschwindet ganz.
 *
 * Die Aktionsknöpfe stehen bewusst nur in der äusseren Kopfzeile: eine zweite
 * Kopie im eingeklappten Titel wäre für Bedienhilfen und Tests ein zweiter
 * gleichnamiger Knopf.
 */
export function AppPage({
  title,
  largeTitle,
  backHref,
  toolbarEnd,
  subToolbar,
  onRefresh,
  children,
}: AppPageProps) {
  const large = largeTitle === false ? null : (largeTitle ?? title);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          {backHref && (
            <IonButtons slot="start">
              <IonBackButton defaultHref={backHref} />
            </IonButtons>
          )}
          <IonTitle>{title}</IonTitle>
          {toolbarEnd}
        </IonToolbar>
        {subToolbar && <IonToolbar>{subToolbar}</IonToolbar>}
      </IonHeader>

      <IonContent fullscreen>
        {onRefresh && (
          <IonRefresher
            slot="fixed"
            onIonRefresh={(event) => {
              void onRefresh().finally(() => event.detail.complete());
            }}
          >
            <IonRefresherContent />
          </IonRefresher>
        )}

        {large && (
          <IonHeader collapse="condense">
            <IonToolbar>
              <IonTitle size="large">{large}</IonTitle>
            </IonToolbar>
          </IonHeader>
        )}

        {children}
      </IonContent>
    </IonPage>
  );
}

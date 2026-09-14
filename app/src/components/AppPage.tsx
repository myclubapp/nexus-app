import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { CreateFab, type CreateAction } from './CreateFab';

interface AppPageProps {
  /**
   * Titel in der Kopfzeile und – sofern nicht abgewählt – als grosser Titel.
   * `ReactNode` statt `string`, damit die Ladeansicht ein `IonSkeletonText`
   * an die Stelle des Titels setzen kann (guidelines §4): Ein Platzhaltertext
   * wäre eine Ankündigung, die gleich darauf durch ein anderes Wort ersetzt
   * wird.
   */
  title: ReactNode;
  /**
   * Abweichender grosser Titel. `false` unterdrückt die zweite Kopfzeile für
   * Seiten, die direkt mit Inhalt beginnen sollen (z.B. Formulare).
   */
  largeTitle?: ReactNode | false;
  /**
   * Zielroute des Zurück-Knopfs. Ohne Angabe steht links der Menüknopf –
   * eine Detailseite führt zurück, eine Hauptseite öffnet die Seitenleiste.
   */
  backHref?: string;
  /**
   * Aktionen rechts in der Kopfzeile, üblicherweise `IonButtons`. Nichts,
   * was etwas Neues anlegt – das gehört in `createActions`.
   */
  toolbarEnd?: ReactNode;
  /**
   * Aktionen rechts in der Zeile des grossen Titels, üblicherweise
   * `IonButtons`. Für das, was zum Inhalt direkt darunter gehört – etwa
   * «Heute» über dem Kalender – und mit dem grossen Titel mitscrollt. Der
   * Knopf steht nur dort, nicht zusätzlich in `toolbarEnd`.
   */
  largeTitleEnd?: ReactNode;
  /**
   * Die Erstellen-Wege der Seite. Sie erscheinen als rundes Plus unten
   * rechts (`CreateFab`), nie als Symbol in der Kopfzeile.
   */
  createActions?: CreateAction[];
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
 * Jeder Aktionsknopf steht genau einmal: entweder in der äusseren Kopfzeile
 * (`toolbarEnd`) oder in der Zeile des grossen Titels (`largeTitleEnd`). Eine
 * Kopie in beiden wäre für Bedienhilfen und Tests ein zweiter gleichnamiger
 * Knopf. Was in der Zeile des grossen Titels steht, scrollt mit ihm weg – das
 * passt für Knöpfe, die zum Inhalt direkt darunter gehören.
 *
 * Was etwas Neues anlegt, steht nicht dort, sondern als Plus unten rechts:
 * `createActions` gibt es an `CreateFab` weiter, das als direktes Kind des
 * `IonContent` im `fixed`-Slot sitzt.
 */
export function AppPage({
  title,
  largeTitle,
  backHref,
  toolbarEnd,
  largeTitleEnd,
  createActions,
  subToolbar,
  onRefresh,
  children,
}: AppPageProps) {
  const { t } = useTranslation();
  const large = largeTitle === false ? null : (largeTitle ?? title);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            {backHref ? (
              /* Ohne `text` beschriftet Ionic den Knopf im iOS-Modus fest mit
                 «Back» – die Voreinstellung kennt keine Übersetzung. */
              <IonBackButton defaultHref={backHref} text={t('common.back')} />
            ) : (
              /* `autoHide` ist die Voreinstellung und trägt hier die halbe
                 Logik: Der Knopf verschwindet von selbst, sobald kein Menü
                 angemeldet ist (Anmeldung, Onboarding) oder das Menü als
                 Spalte danebensteht (ab lg). Keine Abfrage der Breite im
                 Code. */
              <IonMenuButton aria-label={t('menu.open')} />
            )}
          </IonButtons>
          {/* Ionic vergibt dem Titel keine Überschriften-Rolle; die Doku
              empfiehlt, sie von Hand zu setzen. */}
          <IonTitle role="heading" aria-level={1}>
            {title}
          </IonTitle>
          {toolbarEnd}
        </IonToolbar>
        {subToolbar && <IonToolbar>{subToolbar}</IonToolbar>}
      </IonHeader>

      {/* Der Freiraum unten gehört zum Fab: Ohne ihn liegt die letzte
          Listenzeile unter dem runden Knopf, sobald ganz nach unten
          gescrollt ist. */}
      {/* `fixedSlotPlacement="before"`: Der Fab kommt in der Tab-Reihenfolge
          vor der Liste, nicht erst nach der letzten Zeile. */}
      <IonContent
        fullscreen
        fixedSlotPlacement="before"
        className={createActions ? 'app-content--fab' : undefined}
      >
        {createActions && <CreateFab actions={createActions} />}

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
              {largeTitleEnd}
            </IonToolbar>
          </IonHeader>
        )}

        {children}
      </IonContent>
    </IonPage>
  );
}

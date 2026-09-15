import type { ReactNode } from 'react';

/**
 * Eine Seitenhülle, die sich **nicht** beim Router anmeldet.
 *
 * Für Zwischenbilder einer Weiche – Skelett, Spinner, Fehlerseite –, die im
 * selben Route-Element stehen wie die Seite, die danach kommt.
 *
 * Warum das nötig ist: Ionic blendet eine Seite nicht über CSS ein, sondern
 * über einen Übergang, den der `StackManager` beim **Routenwechsel** startet.
 * Jede frisch eingehängte `IonPage` meldet sich beim Outlet an und trägt bis
 * zu diesem Übergang `ion-page-invisible` (`opacity: 0`). Tauscht eine Weiche
 * innerhalb derselben Route ein Zwischenbild gegen die echte Seite, wechselt
 * die Route nicht – und für Wildcard-Container wie `/tabs/*` bricht
 * `handleReadyEnteringView` ohnehin vorzeitig ab. Die neue Seite steht dann
 * vollständig im DOM und bleibt unsichtbar: schwarzer Bildschirm im
 * Dunkelmodus, weisser im Hellmodus, den nur ein Neuladen auflöst.
 *
 * Gemessen trifft es jeden Tausch, der zwischen etwa 30 und 200 ms nach dem
 * Routenwechsel landet – genau die Zeit, die eine Supabase-Abfrage braucht.
 * Deshalb trat es nach der Anmeldung «manchmal» auf.
 *
 * Ein schlichtes `div.ion-page` sieht identisch aus, meldet sich aber nicht
 * an. Das Outlet wartet weiter auf seine echte Seite, blendet sie beim
 * Eintreffen regulär ein und lässt das Zwischenbild so lange stehen, wie es
 * gebraucht wird.
 *
 * Gegenstück: {@link AppPage} mit `detached`.
 */
export function DetachedPage({ children }: { children: ReactNode }) {
  return <div className="ion-page">{children}</div>;
}

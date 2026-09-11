import { useSyncExternalStore } from 'react';
import { APP_CONTENT_ID } from '../components/AppMenu';

function findOutlet(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined;
  return (
    document.querySelector<HTMLElement>(`ion-router-outlet#${APP_CONTENT_ID}`) ??
    undefined
  );
}

/** Das Outlet meldet sich nicht; React fragt nach jedem Rendern selbst nach. */
function subscribe() {
  return () => undefined;
}

/**
 * Das Element, hinter das ein Blatt gelegt wird – Ionics `presentingElement`.
 *
 * Ohne dieses Element steht ein `IonModal` als Vollbild über der App. Mit ihm
 * fährt die darunterliegende Seite zurück und das Blatt bekommt runde Ecken
 * und einen abgedunkelten Rand: das Karten-Muster, das iOS für «etwas
 * erfassen, dann zurück» verwendet.
 *
 * Es ist immer das äussere `ion-router-outlet` (`#main` in `App.tsx`), nie das
 * verschachtelte Outlet der Tabs – sonst bliebe der Tab-Balken vor der
 * zurückgefahrenen Seite stehen und die Karte läge halb darauf.
 *
 * Gesucht wird **schon beim Rendern**, nicht erst in einem Effekt danach.
 * Ionic liest das Element im Moment des Präsentierens; ein Blatt, das mit
 * `isOpen` in den Baum kommt – jede Erfassung entsteht erst beim Öffnen –,
 * präsentiert sich noch vor dem ersten Effekt und stünde sonst als Vollbild
 * da. Nachträglich gesetzt holt Ionic die Karte nicht mehr nach.
 *
 * `useSyncExternalStore` liest das Dokument bei jedem Rendern und prüft nach
 * dem Anhängen noch einmal nach. Das deckt den allerersten Aufbau der App ab:
 * Dort rendert die Seite, bevor das Outlet im Dokument steht, und die
 * Blätter, die mit ihr entstehen, öffnen erst später. Findet sich gar keines –
 * in Tests, in jsdom –, ist das Ergebnis `undefined` und Ionic zeigt das Blatt
 * als Vollbild.
 */
export function usePresentingElement(): HTMLElement | undefined {
  return useSyncExternalStore(subscribe, findOutlet, () => undefined);
}

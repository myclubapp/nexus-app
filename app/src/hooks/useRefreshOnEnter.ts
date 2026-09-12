import { useEffect, useRef } from 'react';
import { useIonViewWillEnter } from '@ionic/react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

/**
 * Frischt die Daten einer Seite auf, sobald sie erneut betreten wird.
 *
 * Ionic hält eine Tab-Seite nach dem ersten Besuch gemountet; ein `useEffect`
 * läuft dort nur einmal, und react-query kennt ohne neuen Observer keinen
 * Anlass mehr, nachzuladen (`refetchOnWindowFocus` ist in `main.tsx`
 * abgeschaltet, damit die App im Zug bedienbar bleibt). Genau dafür gibt es
 * Ionics `ionViewWillEnter`: Es feuert bei **jedem** Betreten der Seite.
 *
 * Nachgeladen wird nur, was nach `staleTime` wirklich veraltet ist – ein
 * Tab-Wechsel innerhalb einer Minute löst keinen Netzverkehr aus. Der erste
 * Eintritt wird übersprungen: Dort läuft der Erstabruf des Mounts noch, und
 * ein zweiter Abruf würde ihn nur abbrechen und neu starten.
 *
 * Aufgerufen wird der Hook in der **gerouteten** Komponente selbst, nicht in
 * `AppPage`: Ionic hängt den Lebenszyklus an das Element, das die Route
 * rendert.
 *
 * @param queryKeys Präfixe der Queries, die die Seite zeigt.
 */
export function useRefreshOnEnter(queryKeys: readonly QueryKey[]): void {
  const queryClient = useQueryClient();
  // Die Schlüssel werden beim Rendern als neues Array übergeben; das Ref hält
  // die aktuelle Fassung, ohne den Ionic-Hook bei jedem Rendern neu zu binden.
  const keys = useRef(queryKeys);
  useEffect(() => {
    keys.current = queryKeys;
  });
  const entered = useRef(false);

  useIonViewWillEnter(() => {
    if (!entered.current) {
      entered.current = true;
      return;
    }
    for (const queryKey of keys.current) {
      void queryClient.refetchQueries({ queryKey, type: 'active', stale: true });
    }
  }, [queryClient]);
}

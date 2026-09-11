/* oxlint-disable react/refs -- Das Ref wird beim Rendern gelesen, aber nur
   in der Zeit des Zufahrens, in der es sich nicht mehr ändert; siehe unten. */
import { useCallback, useEffect, useRef, useState } from 'react';

interface Dismissable {
  onDismiss: () => void;
}

/**
 * Hält die Eigenschaften eines Blattes fest, bis es zu Ende geschlossen hat.
 *
 * Ein Blatt, das erst beim Öffnen entsteht – jede Erfassung, jedes Detail mit
 * eigenem Zustand –, darf nicht im selben Moment aus dem Baum fallen, in dem
 * die Seite es schliesst. Ionic nimmt ein Blatt, das mitten im Präsentieren
 * entfernt wird, **ohne** Übergang heraus, und die Seite darunter bleibt in
 * ihrer zurückgefahrenen Karten-Stellung stehen: verkleinert, abgedunkelt,
 * ohne Weg zurück (guidelines.md §2).
 *
 * Deshalb liegt zwischen «die Seite schliesst» und «der Inhalt ist weg» das
 * `onDidDismiss` von Ionic. Dieser Hook überbrückt die Zeit dazwischen: Gibt
 * die Seite `null`, bleiben die zuletzt gesehenen Eigenschaften stehen, das
 * Blatt bekommt `isOpen: false` und fährt zu; erst sein `onDismiss` gibt den
 * Inhalt frei. Öffnet die Seite erneut, beginnt das Blatt leer – der Inhalt
 * wurde dazwischen abgebaut, genau wie vorher.
 *
 * @param props Die Eigenschaften des Inhalts, solange das Blatt offen sein
 *   soll; `null`, sobald die Seite es schliesst.
 * @returns Die Eigenschaften samt `isOpen`, solange etwas zu rendern ist –
 *   sonst `null`.
 */
export function useSheetProps<P extends Dismissable>(
  props: P | null,
): (P & { isOpen: boolean }) | null {
  const isOpen = props !== null;

  // Die zuletzt gesehenen Eigenschaften, damit das Blatt beim Zufahren noch
  // etwas zu zeigen hat. Ein Ref und kein State: Sie werden nicht gerendert,
  // sondern nur nachgeschlagen, wenn die Seite schon `null` gibt.
  const last = useRef<P | null>(null);
  useEffect(() => {
    if (props !== null) last.current = props;
  });

  // Steht der Inhalt? Er entsteht mit dem Öffnen und fällt erst nach dem
  // Schliessen. Der Abgleich steht im Rendern und nicht in einem Effekt: React
  // verwirft den angefangenen Durchlauf und rendert gleich neu, statt erst
  // ohne Blatt zu zeichnen und dann nachzubessern.
  const [isMounted, setMounted] = useState(isOpen);
  if (isOpen && !isMounted) setMounted(true);

  const release = useCallback(() => setMounted(false), []);

  // Gelesen wird das Ref nur, wenn die Seite schon `null` gibt – und dann
  // steht darin, was der letzte Durchlauf mit Inhalt gezeichnet hat. Das ist
  // die Zeit des Zufahrens, in der sich am Inhalt nichts mehr ändern soll;
  // deshalb ist das Lesen beim Rendern hier richtig (siehe Kopf der Datei).
  const held = props ?? (isMounted ? last.current : null);
  if (held === null) return null;

  return {
    ...held,
    isOpen,
    onDismiss: () => {
      release();
      held.onDismiss();
    },
  };
}

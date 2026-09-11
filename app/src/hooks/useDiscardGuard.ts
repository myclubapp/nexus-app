import { useCallback, useRef, useState } from 'react';

/**
 * Die Rollen, unter denen ein Blatt seinen Inhalt **wegwirft**: die Wischgeste
 * nach unten, der Griff daneben und der Abbrechen-Knopf. Bei allen dreien
 * fragt ein beschriebenes Blatt nach – wie Mail und Kalender.
 *
 * Was hier fehlt, ist das gesteuerte Schliessen ohne Rolle: Ionic ruft
 * `dismiss()` auch dann, wenn die Seite nach dem Speichern `isOpen={false}`
 * setzt (`onIsOpenChange`). Diese Auslassung ist der Kern des Wächters. Ein
 * Wächter, der jede Rolle abfängt, fragt nach dem erfolgreichen Speichern
 * «verwerfen oder weiterbearbeiten?» und sperrt das Blatt zu.
 */
const GUARDED_ROLES = ['gesture', 'backdrop', 'cancel'];

export interface DiscardGuard {
  /** Wert für `canDismiss` am `IonModal`. */
  canDismiss: true | ((data?: unknown, role?: string) => Promise<boolean>);
  /** Meldet, dass jemand etwas eingegeben hat. */
  markTouched: () => void;
  /** Steht die Rückfrage gerade offen? */
  isAsking: boolean;
  /** Beantwortet die Rückfrage: verwerfen oder weiterbearbeiten. */
  answer: (discard: boolean) => void;
}

/**
 * Fängt das versehentliche Wegwischen eines beschriebenen Blattes ab.
 *
 * Zur Karte über der Seite gehört, dass sie sich nach unten wegwischen lässt
 * (guidelines.md §2). Bei einem halb ausgefüllten Formular ist das ein
 * Datenverlust mit einer Fingerbewegung, und iOS fragt an dieser Stelle in Mail
 * und Kalender nach. Genau das macht dieser Wächter – für die Geste, für den
 * Griff neben das Blatt und für den Abbrechen-Knopf, der denselben Entwurf
 * genauso endgültig wegwirft.
 *
 * Unbeschrieben bleibt `canDismiss` **der Wert `true`**, nicht eine Funktion,
 * die `true` zurückgibt: Ionic liest zu Beginn der Geste `canDismiss !== true`
 * und lässt das Blatt sonst nur 20 % weit mitlaufen, statt es dem Finger folgen
 * zu lassen. Ein leeres Blatt behielte damit das gebremste Gefühl, obwohl es
 * nichts zu retten gibt.
 *
 * Das Versprechen aus `canDismiss` bleibt offen, bis die Rückfrage beantwortet
 * ist – so lange hält Ionic das Blatt angeschnappt. Sagt jemand «verwerfen»,
 * schliesst Ionic selbst mit der Rolle `handler` und prüft nicht erneut.
 *
 * @param isOpen Der Öffnungszustand des Blattes; jedes Öffnen beginnt leer.
 */
export function useDiscardGuard(isOpen: boolean): DiscardGuard {
  const [isTouched, setTouched] = useState(false);
  const [isAsking, setAsking] = useState(false);
  // Die Auflösung des laufenden `canDismiss`-Versprechens. Ein Ref und kein
  // State: Sie wird aus einem Ereignis heraus gesetzt und gelesen, nicht
  // gerendert.
  const pending = useRef<((discard: boolean) => void) | null>(null);

  // Jedes Öffnen beginnt leer; ein wiederverwendetes Blatt trüge sonst den
  // Merker des letzten Mals. Der Abgleich steht bewusst im Rendern und nicht
  // in einem Effekt: React verwirft den angefangenen Durchlauf und rendert
  // gleich neu, statt erst zu zeichnen und dann nachzubessern.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setTouched(false);
  }

  const markTouched = useCallback(() => setTouched(true), []);

  const answer = useCallback((discard: boolean) => {
    setAsking(false);
    pending.current?.(discard);
    pending.current = null;
  }, []);

  const ask = useCallback(
    (_data?: unknown, role?: string) =>
      new Promise<boolean>((resolve) => {
        if (!GUARDED_ROLES.includes(role ?? '')) {
          resolve(true);
          return;
        }
        pending.current = resolve;
        setAsking(true);
      }),
    [],
  );

  return { canDismiss: isTouched ? ask : true, markTouched, isAsking, answer };
}

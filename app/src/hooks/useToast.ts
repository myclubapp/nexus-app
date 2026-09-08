import { useIonToast } from '@ionic/react';
import { useMemo } from 'react';

export interface Toast {
  /** Eine Schreibaktion ist durchgegangen. */
  success: (message: string) => void;
  /** Ein Fehler ohne Bezug zu einem Eingabefeld. */
  failure: (message: string) => void;
}

/**
 * Kurzrückmeldung am oberen Rand.
 *
 * Der einzige Weg zu einem Toast in dieser App (guidelines §5). Die Position
 * steckt im Hook und nicht im Aufruf: Unten liegen Tab-Leiste und Daumen, ein
 * Toast dort verdeckt genau das, was gerade bedient wird.
 *
 * Ein Fehler, den die Person durch eine Korrektur beheben soll, gehört
 * dagegen ins Formular – er muss stehen bleiben, solange sie korrigiert.
 */
export function useToast(): Toast {
  const [present] = useIonToast();

  return useMemo(
    () => ({
      success: (message: string) => {
        void present({ message, position: 'top', color: 'success', duration: 2000 });
      },
      failure: (message: string) => {
        void present({ message, position: 'top', color: 'danger', duration: 3500 });
      },
    }),
    [present],
  );
}

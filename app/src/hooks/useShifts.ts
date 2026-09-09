import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useClub } from './useClub';

export interface ShiftResult {
  filled: number;
  needed: number;
}

/** A4: Das Signal des Servers, dass sich zwei Schichten überschneiden. */
export const OVERLAP_SIGNAL = 'overlap';

/**
 * Eine Schicht übernehmen (UC-012, Schritte 3–5).
 *
 * Die Besetzungsgrenze prüft der Server hinter einer Zeilensperre (BR-046):
 * Zwei Personen, die gleichzeitig auf den letzten Platz tippen, kämen sonst
 * beide durch. Der Client kann das nicht verhindern, egal wie er zählt.
 *
 * Punkte entstehen hier keine (BR-045) – erst die Bestätigung des
 * tatsächlichen Einsatzes bucht sie (UC-013).
 */
export function useTakeShift() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      shiftId: string;
      /** A4: erst nach ausdrücklicher Bestätigung der Überschneidung. */
      acceptOverlap?: boolean;
    }): Promise<ShiftResult> => {
      const { data, error } = await supabase.rpc('take_shift', {
        p_shift_id: input.shiftId,
        p_accept_overlap: input.acceptOverlap ?? false,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      return { filled: row?.filled ?? 0, needed: row?.needed ?? 0 };
    },
    // A1 verlangt beides: abweisen **und** den aktuellen Stand zeigen. Wer
    // den letzten Platz knapp verpasst, sähe sonst weiter «1 von 2 besetzt»
    // und einen aktiven Knopf.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda', activeClub?.id] });
    },
  });
}

export interface ReleaseResult extends ShiftResult {
  /** A2: Die Organisation wurde über die kurzfristige Unterdeckung informiert. */
  warned: boolean;
}

/**
 * Sich wieder austragen (A2, BR-047).
 *
 * Keine Sperrfrist und kein Punkteabzug. Ob die Organisation informiert wird,
 * entscheidet der Server anhand der verbleibenden Zeit – nicht der Client.
 */
export function useReleaseShift() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (shiftId: string): Promise<ReleaseResult> => {
      const { data, error } = await supabase.rpc('release_shift', {
        p_shift_id: shiftId,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      return {
        filled: row?.filled ?? 0,
        needed: row?.needed ?? 0,
        warned: row?.warned ?? false,
      };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda', activeClub?.id] });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useClub } from './useClub';

export interface RosterEntry {
  memberId: string;
  displayName: string;
  status: string;
  confirmed: boolean;
}

/**
 * Die Eingetragenen einer Schicht (UC-013, Schritt 2).
 *
 * Über eine Funktion und nicht über einen Join im Client: Die Einsatzliste
 * einer Schicht geht den Verein nichts an, sie geht den Vorstand etwas an –
 * und diese Prüfung gehört auf den Server (BR-053).
 */
export function useShiftRoster(shiftId: string | null) {
  const { isAdmin } = useClub();

  return useQuery({
    queryKey: ['shiftRoster', shiftId],
    enabled: Boolean(shiftId) && isAdmin && isConfigured,
    queryFn: async (): Promise<RosterEntry[]> => {
      const { data, error } = await supabase.rpc('shift_roster', {
        p_shift_id: shiftId!,
      });
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        memberId: row.member_id,
        displayName: row.display_name,
        status: row.status,
        confirmed: row.confirmed,
      }));
    },
  });
}

export interface ConfirmResult {
  points: number;
  /** Ob **jetzt** gebucht wurde – `false` heisst «stand schon» (A3). */
  booked: boolean;
}

/**
 * Einen Einsatz bestätigen (Schritt 3–5, A2, A3).
 *
 * Die Buchung, die Statusänderung und die Zustellung liegen in einer
 * Datenbankfunktion und damit in einer Transaktion (BR-050).
 *
 * `points` und `booked` sind getrennt, weil `0` beides heissen kann: schon
 * gebucht (BR-051) oder im Nur-Dank-Modus mit dem Wert 0 gebucht. Aus einer
 * Zahl allein liesse sich das nicht auseinanderhalten.
 */
export function useConfirmShift(shiftId: string | null) {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (memberId: string): Promise<ConfirmResult> => {
      const { data, error } = await supabase.rpc('confirm_shift', {
        p_shift_id: shiftId!,
        p_member_id: memberId,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      return { points: row?.points ?? 0, booked: row?.booked ?? false };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['shiftRoster', shiftId] });
      void queryClient.invalidateQueries({ queryKey: ['shiftCandidates', shiftId] });
      void queryClient.invalidateQueries({ queryKey: ['agenda', activeClub?.id] });
    },
  });
}

export interface Candidate {
  memberId: string;
  displayName: string;
}

/**
 * A2: Wer noch nicht auf der Liste steht.
 *
 * Serverseitig gefiltert, damit die Rollenprüfung an einer Stelle bleibt und
 * die Liste nicht im Client aus zwei Abfragen entsteht.
 */
export function useShiftCandidates(shiftId: string | null) {
  const { isAdmin } = useClub();

  return useQuery({
    queryKey: ['shiftCandidates', shiftId],
    enabled: Boolean(shiftId) && isAdmin && isConfigured,
    queryFn: async (): Promise<Candidate[]> => {
      const { data, error } = await supabase.rpc('shift_candidates', {
        p_shift_id: shiftId!,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        memberId: row.member_id,
        displayName: row.display_name,
      }));
    },
  });
}

/**
 * A1: Wer nicht erschienen ist, bekommt keine Punkte – aber einen Status.
 *
 * Eine bereits gebuchte Bestätigung lässt sich damit nicht zurücknehmen; dafür
 * verlangt BR-052 eine Gegenbuchung (UC-021).
 */
export function useSetShiftAbsence(shiftId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      memberId: string;
      status: 'excused' | 'absent';
    }): Promise<void> => {
      const { error } = await supabase.rpc('set_shift_absence', {
        p_shift_id: shiftId!,
        p_member_id: input.memberId,
        p_status: input.status,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['shiftRoster', shiftId] });
    },
  });
}

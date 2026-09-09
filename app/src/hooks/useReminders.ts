import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useClub } from './useClub';

export interface ReminderResult {
  notified: number;
  /** A1: Zeitpunkt der letzten Erinnerung, wenn die Frist noch läuft. */
  lastReminder: string | null;
}

/**
 * Unentschlossene erinnern (UC-015, Schritte 3–7).
 *
 * Frist, Empfängerkreis und Vermerk entscheidet der Server: Ein Client, der
 * die 24 Stunden selbst rechnet, kann sie auch umgehen (BR-060), und wer
 * erinnert wird, ergibt sich aus der Antwortlage – nicht aus einer Auswahl
 * (BR-059).
 */
export function useRemindUndecided() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (eventId: string): Promise<ReminderResult> => {
      const { data, error } = await supabase.rpc('remind_undecided', {
        p_event_id: eventId,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      return {
        notified: row?.notified ?? 0,
        lastReminder: row?.last_reminder ?? null,
      };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda', activeClub?.id] });
    },
  });
}

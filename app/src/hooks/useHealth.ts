import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useClub } from './useClub';
import type { HealthSignal, HealthStatus } from '../lib/health';

/**
 * Die offenen Fürsorge-Hinweise im eigenen Bereich (UC-023, Schritt 2).
 *
 * Was «eigener Bereich» heisst, entscheidet die Policy aus `0040` – nicht
 * diese Abfrage. Eine Trainer:in bekommt die Hinweise ihres Teams, der
 * Vorstand die des Vereins, ein Mitglied gar keine. Der Client filtert
 * **nichts**: Eine zweite Reichweite wäre eine zweite Regel.
 */
export function useHealthSignals() {
  const { activeClub, isTrainer } = useClub();

  return useQuery({
    queryKey: ['health-signals', activeClub?.id],
    enabled: Boolean(activeClub) && isTrainer && isConfigured,
    queryFn: async (): Promise<HealthSignal[]> => {
      const { data, error } = await supabase
        .from('health_signals')
        .select(
          'id, member_id, team_id, signal_type, severity, detail, status, owned_by, detected_at, member:club_members!health_signals_member_id_fkey(display_name), owner:club_members!health_signals_owned_by_fkey(display_name)',
        )
        .eq('club_id', activeClub!.id)
        .order('detected_at', { ascending: false });
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => {
        const entry = row as unknown as {
          id: string;
          member_id: string | null;
          team_id: string | null;
          signal_type: string;
          severity: HealthSignal['severity'];
          detail: string;
          status: HealthStatus;
          owned_by: string | null;
          detected_at: string;
          member: { display_name: string } | null;
          owner: { display_name: string } | null;
        };
        return {
          id: entry.id,
          memberId: entry.member_id,
          memberName: entry.member?.display_name ?? null,
          teamId: entry.team_id,
          signalType: entry.signal_type,
          severity: entry.severity,
          detail: entry.detail,
          status: entry.status,
          ownedBy: entry.owned_by,
          ownerName: entry.owner?.display_name ?? null,
          detectedAt: entry.detected_at,
        };
      });
    },
  });
}

/**
 * Den Status setzen (Schritte 6–9, FR-064).
 *
 * «Gelöst» heisst gelöscht: Der Server entfernt den Hinweis, statt ihn
 * abzuhaken (BR-097). Die Antwort sagt, was geschah – `taken`, wenn sich
 * jemand anderes bereits kümmert (A1).
 */
export function useSetSignalStatus() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      signalId: string;
      status: HealthStatus;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('set_signal_status', {
        p_signal_id: input.signalId,
        p_status: input.status,
      });
      if (error) throw new Error(error.message);
      return data ?? '';
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['health-signals', activeClub?.id],
      });
    },
  });
}

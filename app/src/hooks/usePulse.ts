import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useClub } from './useClub';
import type { ClubPulse, ConnectionRatio, PulseItem } from '../lib/pulse';

function toPulse(row: Record<string, unknown>): ClubPulse {
  return {
    id: row.id as string,
    happening: (row.happening ?? []) as PulseItem[],
    workingOn: (row.working_on ?? []) as PulseItem[],
    joinIn: (row.join_in ?? []) as PulseItem[],
    intro: (row.intro ?? null) as string | null,
    status: row.status as ClubPulse['status'],
    composedAt: row.composed_at as string,
    sentAt: (row.sent_at ?? null) as string | null,
  };
}

/**
 * Der offene Entwurf des Vereins (UC-027, Schritt 3).
 *
 * Die Policy aus `0044` zeigt Entwürfe nur dem Vorstand – der Client filtert
 * nicht mit.
 */
export function usePulseDraft() {
  const { activeClub, isAdmin } = useClub();

  return useQuery({
    queryKey: ['pulse-draft', activeClub?.id],
    enabled: Boolean(activeClub) && isAdmin && isConfigured,
    queryFn: async (): Promise<ClubPulse | null> => {
      const { data, error } = await supabase
        .from('club_pulses')
        .select('*')
        .eq('club_id', activeClub!.id)
        .eq('status', 'draft')
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toPulse(data as Record<string, unknown>) : null;
    },
  });
}

/** Ein einzelner, versendeter Puls – die Leseansicht (A4). */
export function usePulse(pulseId: string | null) {
  return useQuery({
    queryKey: ['pulse', pulseId],
    enabled: Boolean(pulseId) && isConfigured,
    queryFn: async (): Promise<ClubPulse | null> => {
      const { data, error } = await supabase
        .from('club_pulses')
        .select('*')
        .eq('id', pulseId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toPulse(data as Record<string, unknown>) : null;
    },
  });
}

/**
 * Freigeben (Schritte 6–8).
 *
 * `keep` ist die Liste der **behaltenen** Einträge. Wer nichts streicht,
 * übergibt nichts und bekommt den Entwurf, wie er ist – das ist BR-115.
 */
export function useReleasePulse() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      pulseId: string;
      intro: string;
      keep: string[] | null;
    }): Promise<number> => {
      const { data, error } = await supabase.rpc('release_pulse', {
        p_pulse_id: input.pulseId,
        p_intro: input.intro || undefined,
        p_keep: input.keep ?? undefined,
      });
      if (error) throw new Error(error.message);
      return data ?? 0;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['pulse-draft', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['connection-ratio'] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

/** A2: «Diese Woche nicht». */
export function useDiscardPulse() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (pulseId: string) => {
      const { error } = await supabase.rpc('discard_pulse', { p_pulse_id: pulseId });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['pulse-draft', activeClub?.id] });
    },
  });
}

/**
 * Die Verbindungs-Quote (FR-070).
 *
 * Gezählt wird sie seit `0018`. Dass sie nirgends stand, ist der Grund, warum
 * ein Vorstand bis heute nicht sah, ob sein Verein nur bittet.
 */
export function useConnectionRatio(days = 56) {
  const { activeClub, isTrainer } = useClub();

  return useQuery({
    queryKey: ['connection-ratio', activeClub?.id, days],
    enabled: Boolean(activeClub) && isTrainer && isConfigured,
    queryFn: async (): Promise<ConnectionRatio> => {
      const { data, error } = await supabase.rpc('connection_ratio', {
        p_club_id: activeClub!.id,
        p_days: days,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      return {
        connections: row?.connections ?? 0,
        calls: row?.calls ?? 0,
        lastConnection: row?.last_connection ?? null,
      };
    },
  });
}

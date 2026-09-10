import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useClub } from './useClub';
import type { VoiceKind, VoiceNote } from '../lib/voice';

/**
 * Die Anliegen, die mich betreffen (UC-029).
 *
 * Was das heisst, entscheidet die Policy aus `0046`: eigene jeder Art,
 * an mich oder meine Rolle gerichtete, und – für den Vorstand – anonyme.
 * Der Client filtert **nichts**.
 */
export function useVoiceNotes() {
  const { activeClub, activeMembership } = useClub();

  return useQuery({
    queryKey: ['voice-notes', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<VoiceNote[]> => {
      const { data, error } = await supabase
        .from('voice_notes')
        .select('id, kind, transcript, status, response, created_week, created_at, author_member_id')
        .eq('club_id', activeClub!.id)
        .order('created_week', { ascending: false });
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        id: row.id,
        kind: row.kind as VoiceKind,
        transcript: row.transcript,
        status: row.status,
        response: row.response,
        createdWeek: row.created_week,
        createdAt: row.created_at,
        isMine: row.author_member_id === activeMembership?.id,
      }));
    },
  });
}

/** Wie viele Anliegen diesen Monat noch möglich sind (A5). */
export function useVoiceQuota() {
  const { activeClub, activeMembership } = useClub();

  return useQuery({
    queryKey: ['voice-quota', activeClub?.id, activeMembership?.id],
    enabled: Boolean(activeClub) && Boolean(activeMembership) && isConfigured,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('voice_quota_left', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);
      return data ?? 0;
    },
  });
}

/**
 * Ein Anliegen absenden (Schritte 6–9).
 *
 * Beim anonymen Weg geht **nur der Prüfwert** des Tickets an den Server. Das
 * Ticket selbst bleibt auf dem Gerät.
 */
export function useSubmitVoiceNote() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      kind: VoiceKind;
      transcript: string;
      targetMemberId?: string | null;
      targetRole?: string | null;
      targetTeamId?: string | null;
      tokenHash?: string | null;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('submit_voice_note', {
        p_club_id: activeClub!.id,
        p_kind: input.kind,
        p_transcript: input.transcript,
        p_target_member: input.targetMemberId ?? undefined,
        p_target_role: input.targetRole ?? undefined,
        p_target_team: input.targetTeamId ?? undefined,
        p_token_hash: input.tokenHash ?? undefined,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['voice-notes', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['voice-quota'] });
    },
  });
}

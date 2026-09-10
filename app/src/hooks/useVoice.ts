import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useClub } from './useClub';
import { hashTicket, readStoredTickets } from '../lib/voice';
import type { AnonMessage, AnonThread, NoteStatus, VoiceKind, VoiceNote } from '../lib/voice';

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
        .select(
          'id, kind, transcript, status, response, created_week, created_at, author_member_id, flagged_at, converted_task_id',
        )
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
        flagged: row.flagged_at !== null,
        taskId: row.converted_task_id,
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

/** Den Status setzen (UC-030, Schritt 4, FR-092). */
export function useSetNoteStatus() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: { noteId: string; status: NoteStatus }) => {
      const { error } = await supabase.rpc('set_note_status', {
        p_note_id: input.noteId,
        p_status: input.status,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['voice-notes', activeClub?.id] });
    },
  });
}

/**
 * Antworten (Schritte 5–7, FR-099) – oder ablehnen (A4).
 *
 * Beides ist derselbe Weg: BR-128 lässt keinen Endstatus ohne Begründung zu.
 */
export function useAnswerNote() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      noteId: string;
      answer: string;
      decline?: boolean;
    }) => {
      const { error } = await supabase.rpc('answer_voice_note', {
        p_note_id: input.noteId,
        p_answer: input.answer,
        p_decline: input.decline ?? false,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['voice-notes', activeClub?.id] });
    },
  });
}

/**
 * Den anonymen Faden abholen (A1, FR-091, BR-129).
 *
 * Der Aufruf übergibt **nur** den Prüfwert des Tickets. Wer ihn macht, spielt
 * keine Rolle – sonst liefe der Rückkanal doch über die Identität.
 */
export function useAnonThreads(tokenHashes: readonly string[]) {
  return useQuery({
    queryKey: ['anon-threads', [...tokenHashes].sort()],
    enabled: tokenHashes.length > 0 && isConfigured,
    queryFn: async (): Promise<AnonThread[]> => {
      const threads: AnonThread[] = [];
      for (const hash of tokenHashes) {
        const { data, error } = await supabase.rpc('anon_thread', {
          p_token_hash: hash,
        });
        if (error) throw new Error(error.message);
        const row = data?.[0];
        if (row) {
          threads.push({
            tokenHash: hash,
            noteId: row.note_id,
            transcript: row.transcript,
            status: row.status,
            createdWeek: row.created_week,
            messages: (row.messages ?? []) as unknown as AnonThread['messages'],
          });
        }
      }
      return threads;
    },
  });
}

/** Im anonymen Faden nachfassen, ohne sich zu erkennen zu geben (FR-091). */
export function useFollowUpAnon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { tokenHash: string; body: string }) => {
      const { error } = await supabase.rpc('follow_up_anon', {
        p_token_hash: input.tokenHash,
        p_body: input.body,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['anon-threads'] });
    },
  });
}

/** A6: ein Anliegen melden. */
export function useFlagNote() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.rpc('flag_note', { p_note_id: noteId });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['voice-notes', activeClub?.id] });
    },
  });
}

/**
 * A3: aus dem Anliegen eine Aufgabe machen (FR-093).
 *
 * Das Transkript wird zur Beschreibung – das besorgt die Serverfunktion, damit
 * die Verknüpfung zurück zum Anliegen und die Aufgabe in **einem** Schritt
 * entstehen. Eine Aufgabe ohne Rückverweis wäre nach BR-130 nicht zählbar.
 */
export function useConvertNoteToTask() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      noteId: string;
      title: string;
      why: string;
      category: string;
      points: number;
      dueAt?: string | null;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('convert_note_to_task', {
        p_note_id: input.noteId,
        p_title: input.title,
        p_why: input.why,
        p_category: input.category,
        p_points: input.points,
        p_due_at: input.dueAt || undefined,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['voice-notes', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', activeClub?.id] });
    },
  });
}

/**
 * Die Prüfwerte der Tickets auf diesem Gerät (A1).
 *
 * Gehasht wird erst hier und nicht beim Ablegen: Auf dem Gerät liegt das
 * Ticket, auf dem Server sein Prüfwert – und `crypto.subtle` arbeitet
 * asynchron, weshalb der Wert nicht direkt aus dem Speicher fällt.
 */
export function useTicketHashes(): string[] {
  const [hashes, setHashes] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const tickets = readStoredTickets();
    if (tickets.length === 0) {
      setHashes([]);
      return;
    }
    void Promise.all(tickets.map(hashTicket))
      .then((result) => {
        if (active) setHashes(result);
      })
      .catch(() => {
        // Ohne WebCrypto (unsicherer Kontext) gibt es keinen Rückkanal; die
        // Seite bleibt trotzdem bedienbar.
        if (active) setHashes([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return hashes;
}

/**
 * Der Faden zu einem Anliegen – aus der Sicht der Empfänger:in.
 *
 * Die Gegenrichtung zu `useAnonThreads()`: Dieselben Nachrichten, nur über die
 * Kennung statt über das Ticket. Ohne sie sähe der Vorstand ein Nachfassen
 * nicht, das er beantworten soll (A1, Schritt 2).
 */
export function useNoteThread(noteId: string | null) {
  return useQuery({
    queryKey: ['note-thread', noteId],
    enabled: Boolean(noteId) && isConfigured,
    queryFn: async (): Promise<AnonMessage[]> => {
      const { data, error } = await supabase
        .from('voice_note_messages')
        .select('author_side, body, created_at')
        .eq('note_id', noteId!)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        side: row.author_side as AnonMessage['side'],
        body: row.body,
        at: row.created_at,
      }));
    },
  });
}

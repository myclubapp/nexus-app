import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useClub } from './useClub';
import { hashTicket, readStoredTickets } from '../lib/tickets';
import { MEETING_TICKET_KEY } from '../lib/meeting';
import type { AgendaRow, InputStatus, MeetingInput } from '../lib/meeting';
import type { AppEvent } from '../lib/database.types';

// Seit UC-041 stehen die Amts-Hooks in `useOffices.ts`; die Sitzungs-Blätter
// importieren sie weiterhin von hier.
export { useDeleteOffice, useOffices, useSaveOffice } from './useOffices';

/**
 * Die Inputs, die mich betreffen.
 *
 * Was das heisst, entscheidet die Policy aus `0049`: eigene, an ein von mir
 * gehaltenes Amt gerichtete – und für den Vorstand alle, weil Schritt 7 ihm die
 * Triage zuweist. Der Client filtert **nichts**.
 */
export function useMeetingInputs() {
  const { activeClub, activeMembership } = useClub();

  return useQuery({
    queryKey: ['meeting-inputs', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<MeetingInput[]> => {
      const { data, error } = await supabase
        .from('meeting_inputs')
        .select(
          'id, body, status, committee_role_ids, meeting_event_id, decision_response, responded_at, author_member_id, anon_token_hash, created_at',
        )
        .eq('club_id', activeClub!.id)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        id: row.id,
        body: row.body,
        status: row.status as InputStatus,
        committeeRoleIds: (row.committee_role_ids ?? []) as unknown as string[],
        meetingEventId: row.meeting_event_id,
        response: row.decision_response,
        respondedAt: row.responded_at,
        isMine: row.author_member_id === activeMembership?.id,
        isAnonymous: row.author_member_id === null,
        createdAt: row.created_at,
      }));
    },
  });
}

/** Die kommenden Sitzungen – die möglichen Ziele einer Zuordnung (Schritt 7). */
export function useMeetings() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['meetings', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<AppEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('club_id', activeClub!.id)
        .eq('type', 'meeting')
        .is('cancelled_at', null)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at');
      if (error) throw new Error(error.message);
      return (data ?? []) as AppEvent[];
    },
  });
}

/**
 * Einen Input einreichen (Schritte 5–6, FR-097).
 *
 * Beim anonymen Weg geht **nur der Prüfwert** des Tickets an den Server. Das
 * Ticket selbst bleibt auf dem Gerät (A1).
 */
export function useSubmitInput() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      body: string;
      committeeRoleIds: string[];
      anonymous: boolean;
      tokenHash?: string | null;
      sourceNoteId?: string | null;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('submit_meeting_input', {
        p_club_id: activeClub!.id,
        p_body: input.body,
        p_roles: input.committeeRoleIds,
        p_anonymous: input.anonymous,
        p_token_hash: input.tokenHash ?? undefined,
        p_source_note: input.sourceNoteId ?? undefined,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['meeting-inputs', activeClub?.id],
      });
    },
  });
}

/**
 * Zuordnen (Schritte 7–8, FR-098).
 *
 * Ohne Sitzung heisst «laufend bearbeiten», mit Sitzung «eingeplant» – ein
 * Aufruf, zwei Ausgänge, wie in der Serverfunktion.
 */
export function useAssignInput() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: { inputId: string; meetingEventId: string | null }) => {
      const { error } = await supabase.rpc('assign_input', {
        p_input_id: input.inputId,
        p_meeting_event_id: input.meetingEventId ?? undefined,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['meeting-inputs', activeClub?.id],
      });
      void queryClient.invalidateQueries({ queryKey: ['meeting-agenda'] });
    },
  });
}

/** A4: an das zuständige Gremium weiterleiten. */
export function useForwardInput() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: { inputId: string; committeeRoleIds: string[] }) => {
      const { error } = await supabase.rpc('forward_input', {
        p_input_id: input.inputId,
        p_roles: input.committeeRoleIds,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['meeting-inputs', activeClub?.id],
      });
    },
  });
}

/** Die dokumentierte Antwort (Schritt 9, §13.3) – oder die Ablehnung. */
export function useAnswerInput() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      inputId: string;
      answer: string;
      decline?: boolean;
      /** FR-100, wie bei den Anliegen: Der Titel ist der Schalter. */
      newsTitle?: string | null;
    }) => {
      const { error } = await supabase.rpc('answer_meeting_input', {
        p_input_id: input.inputId,
        p_answer: input.answer,
        p_decline: input.decline ?? false,
        p_news_title: input.newsTitle || undefined,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['meeting-inputs', activeClub?.id],
      });
      void queryClient.invalidateQueries({ queryKey: ['meeting-agenda'] });
      void queryClient.invalidateQueries({ queryKey: ['news', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

/** Die Sammelansicht einer Sitzung (A2, FR-101, BR-135). */
export function useMeetingAgenda(eventId: string | null) {
  return useQuery({
    queryKey: ['meeting-agenda', eventId],
    enabled: Boolean(eventId) && isConfigured,
    queryFn: async (): Promise<AgendaRow[]> => {
      const { data, error } = await supabase.rpc('meeting_agenda', {
        p_event_id: eventId!,
      });
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        kind: row.kind as AgendaRow['kind'],
        refId: row.ref_id,
        title: row.title,
        detail: row.detail,
      }));
    },
  });
}

export interface AnonInput {
  inputId: string;
  body: string;
  status: InputStatus;
  response: string | null;
  meetingAt: string | null;
  createdAt: string;
}

/**
 * Den Stand eines anonymen Inputs abholen (A1).
 *
 * Der Aufruf übergibt **nur** den Prüfwert des Tickets. Wer ihn macht, spielt
 * keine Rolle – sonst liefe der Rückweg doch über die Identität.
 */
export function useAnonInputs(tokenHashes: readonly string[]) {
  return useQuery({
    queryKey: ['anon-inputs', [...tokenHashes].sort()],
    enabled: tokenHashes.length > 0 && isConfigured,
    queryFn: async (): Promise<AnonInput[]> => {
      const rows: AnonInput[] = [];
      for (const hash of tokenHashes) {
        const { data, error } = await supabase.rpc('anon_input', {
          p_token_hash: hash,
        });
        if (error) throw new Error(error.message);
        const row = data?.[0];
        if (row) {
          rows.push({
            inputId: row.input_id,
            body: row.body,
            status: row.status as InputStatus,
            response: row.response,
            meetingAt: row.meeting_at,
            createdAt: row.created_at,
          });
        }
      }
      return rows;
    },
  });
}

/**
 * Die Prüfwerte der Sitzungs-Tickets auf diesem Gerät (A1).
 *
 * Gehasht wird erst hier: Auf dem Gerät liegt das Ticket, auf dem Server sein
 * Prüfwert – und `crypto.subtle` arbeitet asynchron, weshalb der Wert nicht
 * direkt aus dem Speicher fällt.
 */
export function useMeetingTicketHashes(): string[] {
  const [hashes, setHashes] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const tickets = readStoredTickets(MEETING_TICKET_KEY);
    if (tickets.length === 0) {
      setHashes([]);
      return;
    }
    void Promise.all(tickets.map(hashTicket))
      .then((result) => {
        if (active) setHashes(result);
      })
      .catch(() => {
        // Ohne WebCrypto (unsicherer Kontext) gibt es keinen Rückweg; die Seite
        // bleibt trotzdem bedienbar.
        if (active) setHashes([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return hashes;
}

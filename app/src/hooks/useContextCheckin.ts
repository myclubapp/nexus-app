import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useClub } from './useClub';
import { isGroupBigEnough, toPayload } from '../lib/contextCheckin';
import type {
  CheckinAnswer,
  CheckinContext,
  CheckinInvitation,
  CheckinPrompt,
  CheckinScale,
  TrendPoint,
  Visibility,
} from '../lib/contextCheckin';

/**
 * Die offenen Check-ins dieser Person.
 *
 * Die Policy aus `0050` gibt **nur** die eigenen heraus – auch dem Vorstand
 * nicht die fremden: Schon zu wissen, wer gefragt wurde und wer nicht
 * geantwortet hat, wäre eine Auskunft über Befinden (BR-139).
 */
export function useOpenCheckins() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['checkins', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<CheckinInvitation[]> => {
      const { data, error } = await supabase
        .from('checkin_invitations')
        .select('id, context, asked_on, event:events(title)')
        .eq('club_id', activeClub!.id)
        .is('answered_at', null)
        .is('skipped_at', null)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        id: row.id,
        context: row.context as CheckinContext,
        eventTitle: (row.event as { title: string } | null)?.title ?? null,
        askedOn: row.asked_on,
      }));
    },
  });
}

/** Die Fragen eines Kontexts – der Wortlaut gehört dem Verein, nicht der App. */
export function useCheckinPrompts(context: CheckinContext | null) {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['checkin-prompts', activeClub?.id, context],
    enabled: Boolean(activeClub) && Boolean(context) && isConfigured,
    queryFn: async (): Promise<CheckinPrompt[]> => {
      const { data, error } = await supabase
        .from('checkin_prompts')
        .select('id, question, scale, sort')
        .eq('club_id', activeClub!.id)
        .eq('context', context!)
        .eq('is_active', true)
        .order('sort');
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        id: row.id,
        question: row.question,
        scale: row.scale as CheckinScale,
        sort: row.sort,
      }));
    },
  });
}

/**
 * Antworten (Schritte 5–7).
 *
 * Die Sichtbarkeit geht **mit** der Antwort raus, weil sie in Schritt 4 vor ihr
 * steht: Wer erst danach erfährt, wer mitliest, hat nicht gewählt (FR-104).
 *
 * Was hier fehlt, fehlt mit Absicht: keine Punkte-Abfrage, keine
 * Ungültigmachung von `['points']` – zu einem Check-in entsteht keine Buchung
 * (BR-138).
 */
export function useSubmitCheckin() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      invitationId: string;
      answers: CheckinAnswer[];
      visibility: Visibility;
    }): Promise<number> => {
      const { data, error } = await supabase.rpc('submit_checkin', {
        p_invitation_id: input.invitationId,
        p_answers: toPayload(input.answers),
        p_visibility: input.visibility,
      });
      if (error) throw new Error(error.message);
      return (data as number) ?? 0;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['checkins', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['checkin-trend'] });
      void queryClient.invalidateQueries({ queryKey: ['checkin-responses'] });
      void queryClient.invalidateQueries({ queryKey: ['team-mood'] });
    },
  });
}

/**
 * A1: überspringen.
 *
 * Es wird nichts gespeichert ausser der Tatsache, dass nicht mehr gefragt
 * werden soll. Ein Überspringen ist keine Antwort.
 */
export function useSkipCheckin() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase.rpc('skip_checkin', {
        p_invitation_id: invitationId,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['checkins', activeClub?.id] });
    },
  });
}

/** A5: genau **diese** Antwort teilen – nicht den Verlauf und nicht die nächste. */
export function useShareCheckin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (responseId: string) => {
      const { error } = await supabase.rpc('share_checkin', {
        p_response_id: responseId,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['checkin-trend'] });
      void queryClient.invalidateQueries({ queryKey: ['checkin-responses'] });
      void queryClient.invalidateQueries({ queryKey: ['team-mood'] });
    },
  });
}

/**
 * Der eigene Verlauf (FR-105).
 *
 * Die Serverfunktion nimmt keine fremde Kennung entgegen – es gibt keinen
 * Parameter, über den sich jemand anderes einsetzen liesse.
 */
export function useMyCheckinTrend() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['checkin-trend', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<TrendPoint[]> => {
      const { data, error } = await supabase.rpc('my_checkin_trend', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        at: row.at,
        context: row.context as CheckinContext,
        value: row.value,
      }));
    },
  });
}

export interface MyResponse {
  id: string;
  question: string;
  value: number | null;
  text: string | null;
  visibility: Visibility;
  eventTitle: string | null;
  eventId: string | null;
  createdAt: string;
}

/**
 * Die eigenen Antworten – die Grundlage für A5.
 *
 * Ohne sie liesse sich die Sichtbarkeit nur **vor** dem Antworten wählen. A5
 * beschreibt aber genau den anderen Fall: Eine Antwort ist längst gegeben, und
 * das Mitglied entscheidet sich später, sie zu zeigen.
 */
export function useMyCheckinResponses() {
  const { activeClub, activeMembership } = useClub();

  return useQuery({
    queryKey: ['checkin-responses', activeClub?.id, activeMembership?.id],
    enabled: Boolean(activeClub) && Boolean(activeMembership) && isConfigured,
    queryFn: async (): Promise<MyResponse[]> => {
      const { data, error } = await supabase
        .from('checkin_responses')
        .select(
          'id, value_num, value_text, visibility, event_id, created_at, prompt:checkin_prompts(question), event:events(title)',
        )
        .eq('club_id', activeClub!.id)
        .eq('member_id', activeMembership!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        id: row.id,
        question: (row.prompt as { question: string } | null)?.question ?? '',
        value: row.value_num,
        text: row.value_text,
        visibility: row.visibility as Visibility,
        eventTitle: (row.event as { title: string } | null)?.title ?? null,
        eventId: row.event_id,
        createdAt: row.created_at,
      }));
    },
  });
}

export interface TeamMood {
  average: number;
  responses: number;
}

/**
 * Die Team-Stimmung (FR-106, BR-140).
 *
 * Unter fünf Antworten liefert die Serverfunktion **keine Zeile** – nicht eine
 * Zahl mit einem Hinweis daneben. `null` heisst hier deshalb «zu klein», und
 * die Ansicht zeigt dann gar nichts.
 */
export function useTeamMood(teamId: string | null) {
  return useQuery({
    queryKey: ['team-mood', teamId],
    enabled: Boolean(teamId) && isConfigured,
    queryFn: async (): Promise<TeamMood | null> => {
      const { data, error } = await supabase.rpc('team_mood', {
        p_team_id: teamId!,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      if (!row) return null;

      // Zweite Sperre am anderen Ende der Leitung. Die Serverfunktion gibt
      // unter fünf Antworten ohnehin nichts heraus; dass die Zahl auch hier
      // steht, macht sie im Client lesbar – und eine Regel, die zweimal
      // dasselbe sagt, ist bei einer Datenschutzregel keine Verschwendung.
      if (!isGroupBigEnough(row.responses)) return null;

      return { average: Number(row.average), responses: row.responses };
    },
  });
}

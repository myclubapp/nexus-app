import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import type { Tables } from '../lib/database.types';
import type { JoinDecision, JoinRequestStatus } from '../lib/joinRequest';
import { resolveJoinDecision } from '../lib/joinRequest';
import { useAuth } from './useAuth';
import { useClub } from './useClub';

export type JoinRequest = Omit<Tables<'join_requests'>, 'status'> & {
  status: JoinRequestStatus;
};

/** Eine Anfrage mit dem Anzeigenamen, den der Vorstand braucht (Schritt 3). */
export interface PendingJoinRequest extends JoinRequest {
  /** Name des Teams, das sich die Person wünscht; `null` heisst ganzer Verein. */
  teamName: string | null;
}

/**
 * Offene Anfragen des aktiven Vereins (Schritt 2).
 *
 * Sichtbar sind sie nur dem Vorstand – das erzwingt die Policy
 * `join_requests_own`, nicht das `enabled` hier.
 */
export function usePendingJoinRequests() {
  const { activeClub, isAdmin } = useClub();

  return useQuery({
    queryKey: ['join-requests', activeClub?.id],
    enabled: Boolean(activeClub) && isAdmin && isConfigured,
    queryFn: async (): Promise<PendingJoinRequest[]> => {
      const { data, error } = await supabase
        .from('join_requests')
        .select('*, team:teams(name)')
        .eq('club_id', activeClub!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown as (JoinRequest & {
        team: { name: string } | null;
      })[]).map(({ team, ...request }) => ({
        ...request,
        teamName: team?.name ?? null,
      }));
    },
  });
}

/**
 * Die eigene offene Anfrage.
 *
 * Ohne sie wüsste die anfragende Person nach dem Absenden nicht, dass sie
 * wartet – der Entscheid kommt erst später und die Inbox entsteht mit UC-028.
 */
export function useMyJoinRequest() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-join-request', user?.id],
    enabled: Boolean(user) && isConfigured,
    queryFn: async (): Promise<(JoinRequest & { clubName: string | null }) | null> => {
      const { data, error } = await supabase
        .from('join_requests')
        .select('*, club:clubs(name)')
        .eq('user_id', user!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);

      const row = (data ?? [])[0] as unknown as
        | (JoinRequest & { club: { name: string } | null })
        | undefined;
      if (!row) return null;

      const { club, ...request } = row;
      return { ...request, clubName: club?.name ?? null };
    },
  });
}

export interface ClubLookup {
  clubId: string;
  clubName: string;
  /**
   * Nimmt dieser Verein offene Anfragen an (BR-258)?
   *
   * Steht hier und nicht erst im Fehler des Absendens: Ein Knopf, der sicher
   * abgewiesen wird, ist ein falsches Versprechen – die Ansicht zeigt
   * stattdessen den Weg über die Einladung.
   */
  acceptsRequests: boolean;
}

/**
 * Verein über den Kurznamen finden.
 *
 * Ein Verzeichnis gibt es nicht (C-028); die Funktion antwortet nur auf einen
 * exakten Kurznamen. Deshalb eine Mutation und keine Abfrage: Sie läuft auf
 * ausdrückliche Suche, nicht bei jedem Tastendruck.
 */
export function useFindClub() {
  return useMutation({
    mutationFn: async (slug: string): Promise<ClubLookup | null> => {
      const { data, error } = await supabase.rpc('find_club_by_slug', {
        p_slug: slug,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      return row?.club_id && row.club_name
        ? {
            clubId: row.club_id,
            clubName: row.club_name,
            acceptsRequests: row.accepts_requests === true,
          }
        : null;
    },
  });
}

/** Anfrage stellen (FR-009). */
export function useRequestJoin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { clubId: string; teamId?: string | null }) => {
      const { error } = await supabase.rpc('request_join', {
        p_club_id: input.clubId,
        p_team_id: input.teamId ?? undefined,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-join-request'] });
    },
  });
}

/** Anfrage zurückziehen (A3). */
export function useWithdrawJoinRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc('withdraw_join_request', {
        p_request_id: requestId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-join-request'] });
    },
  });
}

/**
 * Über eine Anfrage entscheiden (Schritt 5–7, A1).
 *
 * Die Prüfung auf die Rolle admin steht in `decide_join_request()` und nicht
 * hier (BR-013, C-011).
 */
export function useDecideJoinRequest() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (
      input: { requestId: string } & JoinDecision,
    ): Promise<string> => {
      const decision = resolveJoinDecision(input);
      const { data, error } = await supabase.rpc('decide_join_request', {
        p_request_id: input.requestId,
        p_approve: decision.approve,
        p_role: decision.role ?? undefined,
        p_team_id: decision.teamId ?? undefined,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['join-requests', activeClub?.id],
      });
      // Eine Aufnahme verändert die Mitgliederliste.
      await queryClient.invalidateQueries({ queryKey: ['members', activeClub?.id] });
    },
  });
}

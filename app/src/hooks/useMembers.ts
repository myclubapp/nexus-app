import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import type { ClubMember, MemberRole, TablesUpdate } from '../lib/database.types';
import type { MemberStatus } from '../lib/member';
import { useClub } from './useClub';

/** Ein Mitglied mit seinen Team-Zugehörigkeiten (Schritt 2). */
export interface ClubMemberWithTeams extends Omit<ClubMember, 'role' | 'status'> {
  role: MemberRole;
  status: MemberStatus;
  teamIds: string[];
  teamNames: string[];
}

/**
 * Alle Mitglieder des Vereins.
 *
 * Lesbar sind sie für jedes Mitglied (Policy `members_read`); ändern darf sie
 * nur der Vorstand. Die Teams kommen in derselben Abfrage mit, weil die Liste
 * sie in jeder Zeile zeigt – sonst wären es N+1 Abfragen.
 */
export function useMembers() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['members', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<ClubMemberWithTeams[]> => {
      const { data, error } = await supabase
        .from('club_members')
        .select('*, team_members(team_id, teams(name))')
        .eq('club_id', activeClub!.id);
      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown as (ClubMember & {
        team_members: { team_id: string; teams: { name: string } | null }[];
      })[]).map(({ team_members, ...member }) => ({
        ...(member as ClubMemberWithTeams),
        teamIds: team_members.map((entry) => entry.team_id),
        teamNames: team_members
          .map((entry) => entry.teams?.name)
          .filter((name): name is string => Boolean(name)),
      }));
    },
  });
}

/**
 * Rolle und Status eines Mitglieds ändern (Schritt 5, A3).
 *
 * Die Untergrenze aus BR-026 hängt an einem Trigger auf `club_members` und
 * nicht hier – so greift sie auch bei einem direkten Aufruf über die REST-API
 * (BR-027, C-011).
 */
export function useUpdateMember() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      memberId: string;
      role?: MemberRole;
      status?: MemberStatus;
      displayName?: string;
    }) => {
      // Ein typisiertes Teil-Update statt eines Record<string, string>: Sonst
      // akzeptiert supabase-js jeden Spaltennamen, auch einen falsch
      // geschriebenen, und die Änderung liefe still ins Leere.
      const patch: TablesUpdate<'club_members'> = {};
      if (input.role) patch.role = input.role;
      if (input.status) patch.status = input.status;
      if (input.displayName) patch.display_name = input.displayName.trim();

      if (Object.keys(patch).length === 0) return;

      const { error } = await supabase
        .from('club_members')
        .update(patch)
        .eq('id', input.memberId);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['members', activeClub?.id] });
      // Die eigene Rolle steuert, was die App überhaupt anbietet.
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

/** Team-Zuordnungen eines Mitglieds in einem Schritt setzen (Schritt 6). */
export function useSetMemberTeams() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: { memberId: string; teamIds: string[] }) => {
      const { error } = await supabase.rpc('set_member_teams', {
        p_member_id: input.memberId,
        p_team_ids: input.teamIds,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['members', activeClub?.id] });
      await queryClient.invalidateQueries({ queryKey: ['agenda', activeClub?.id] });
    },
  });
}

/** Team anlegen (A1). */
export function useCreateTeam() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (name: string): Promise<string> => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      const { data, error } = await supabase
        .from('teams')
        .insert({ club_id: activeClub.id, name: name.trim() })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams', activeClub?.id] });
    },
  });
}

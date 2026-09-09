import { useQuery } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { seasonLabel } from '../lib/season';
import type {
  LeaderboardRow,
  PointRule,
  PointTransaction,
} from '../lib/database.types';
import { useClub } from './useClub';

/** Punktestand und Verlauf des angemeldeten Mitglieds in der laufenden Saison. */
export function useMyPoints() {
  const { activeMembership, activeClub } = useClub();
  const season = seasonLabel(activeClub?.season_start);

  const query = useQuery({
    queryKey: ['points', activeMembership?.id, season],
    enabled: Boolean(activeMembership) && isConfigured,
    queryFn: async (): Promise<PointTransaction[]> => {
      const { data, error } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('member_id', activeMembership!.id)
        .eq('season', season)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const transactions = query.data ?? [];
  const total = transactions.reduce((sum, entry) => sum + entry.points, 0);

  return { ...query, transactions, total, season };
}

/**
 * «Nächste Punkte» auf dem Dashboard: die aktiven Regeln des Vereins, nach
 * Punktwert sortiert. Zeigt dem Mitglied konkret, wie es weiterkommt.
 */
export function usePointRules() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['point-rules', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<PointRule[]> => {
      const { data, error } = await supabase
        .from('point_rules')
        .select('*')
        .eq('club_id', activeClub!.id)
        .eq('is_active', true)
        .order('points', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useLeaderboard(scope: 'club' | 'team', teamId?: string | null) {
  const { activeClub } = useClub();
  const season = seasonLabel(activeClub?.season_start);

  return useQuery({
    queryKey: ['leaderboard', activeClub?.id, scope, teamId, season],
    enabled: Boolean(activeClub) && isConfigured && (scope === 'club' || Boolean(teamId)),
    queryFn: async (): Promise<LeaderboardRow[]> => {
      let request = supabase
        .from('leaderboard')
        .select('*')
        .eq('club_id', activeClub!.id)
        .eq('season', season)
        .order('rank', { ascending: true })
        .limit(100);

      if (scope === 'team' && teamId) request = request.eq('team_id', teamId);

      const { data, error } = await request;
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

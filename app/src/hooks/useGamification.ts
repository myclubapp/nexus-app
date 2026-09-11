import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { seasonLabel } from '../lib/season';
import type { PointRule, PointTransaction } from '../lib/database.types';
import type { LeaderboardEntry, LeaderboardPeriod } from '../lib/leaderboard';
import type { Dimension, ValueDimension } from '../lib/dimensions';
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

  // Der Punktestand kommt aus `useMyPointsSummary()`: Er zählt Saison **und**
  // Gesamt in einer Abfrage (BR-081). Hier stehen nur die Buchungen selbst.
  return { ...query, transactions: query.data ?? [], season };
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

export interface LeaderboardOptions {
  teamId?: string | null;
  period?: LeaderboardPeriod;
  pillar?: number | null;
  limit?: number;
  /** Konzept §7.3, Saisonarchiv: eine vergangene Saison; leer heisst die laufende. */
  season?: string | null;
}

/**
 * Die Rangliste (UC-022).
 *
 * Sie kommt aus **einer** Serverfunktion: Zeitraum, Säule, Team, der
 * Teilnahme-Opt-out und die Regel, dass die eigene Zeile immer mitkommt
 * (BR-090), stehen dort an einer Stelle. Eine zweite Beschreibung derselben
 * Rangfolge im Client wäre eine zweite Rangfolge.
 */
export function useLeaderboard(options: LeaderboardOptions = {}) {
  const { activeClub } = useClub();
  const { teamId = null, period = 'season', pillar = null, limit = 20, season = null } = options;

  return useQuery({
    queryKey: ['leaderboard', activeClub?.id, teamId, period, pillar, limit, season],
    enabled: Boolean(activeClub) && isConfigured,
    // BR-092: höchstens fünf Minuten alt. Gerechnet wird live, gehalten wird
    // fünf Minuten – die Rangliste ist damit nie älter, als die Regel erlaubt.
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const { data, error } = await supabase.rpc('leaderboard_rows', {
        p_club_id: activeClub!.id,
        p_team_id: teamId ?? undefined,
        p_period: period,
        p_pillar: pillar ?? undefined,
        p_limit: limit,
        p_season: season ?? undefined,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        memberId: row.member_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        totalPoints: row.total_points,
        rank: row.rank,
        isSelf: row.is_self,
      }));
    },
  });
}

export interface TeamRankingEntry {
  teamId: string;
  teamName: string;
  memberCount: number;
  totalPoints: number;
  avgPoints: number;
  rank: number;
  isMine: boolean;
}

/**
 * Team gegen Team (Konzept §7.3): der Durchschnitt je Mitglied.
 *
 * Wie `useLeaderboard()` aus **einer** Serverfunktion (`0062`): Zeitraum,
 * Säule, Opt-out und die Regel, dass ein Team aus einer Person nicht
 * erscheint, stehen dort.
 */
export function useTeamRanking(
  options: Pick<LeaderboardOptions, 'period' | 'pillar' | 'season'> = {},
) {
  const { activeClub } = useClub();
  const { period = 'season', pillar = null, season = null } = options;

  return useQuery({
    queryKey: ['team-ranking', activeClub?.id, period, pillar, season],
    enabled: Boolean(activeClub) && isConfigured,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TeamRankingEntry[]> => {
      const { data, error } = await supabase.rpc('team_ranking_rows', {
        p_club_id: activeClub!.id,
        p_period: period,
        p_pillar: pillar ?? undefined,
        p_season: season ?? undefined,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        teamId: row.team_id,
        teamName: row.team_name,
        memberCount: row.member_count,
        totalPoints: row.total_points,
        avgPoints: Number(row.avg_points),
        rank: row.rank,
        isMine: row.is_mine,
      }));
    },
  });
}

/**
 * Die Saisons, in denen der Verein gebucht hat – neueste zuerst (Konzept §7.3,
 * Saisonarchiv). Aus `club_seasons()`: Seit `0037` liest ein Mitglied fremde
 * Buchungen nicht, die Liste der Saisons darf es aber kennen.
 */
export function useClubSeasons() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['club-seasons', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('club_seasons', { p_club_id: activeClub!.id });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/**
 * Die eigene Trainingsserie in Wochen (Konzept §4.1, Säule 1; `0064`).
 *
 * `training_streak()` gibt für fremde Personen 0 zurück, ausser man ist
 * Trainer:in oder Vorstand – hier wird nur die eigene gefragt.
 */
export function useMyStreak() {
  const { activeMembership } = useClub();

  return useQuery({
    queryKey: ['my-streak', activeMembership?.id],
    enabled: Boolean(activeMembership) && isConfigured,
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('training_streak', {
        p_member_id: activeMembership!.id,
      });
      if (error) throw new Error(error.message);
      return data ?? 0;
    },
  });
}

/** Die Teams, denen das angemeldete Mitglied angehört (A4). */
export function useMyTeams() {
  const { activeMembership } = useClub();

  return useQuery({
    queryKey: ['my-teams', activeMembership?.id],
    enabled: Boolean(activeMembership) && isConfigured,
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data, error } = await supabase
        .from('team_members')
        .select('team_id, teams(name)')
        .eq('member_id', activeMembership!.id);
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => {
        const entry = row as unknown as {
          team_id: string;
          teams: { name: string } | null;
        };
        return { id: entry.team_id, name: entry.teams?.name ?? '' };
      });
    },
  });
}


/**
 * Alle Regeln des Vereins – auch abgeschaltete (FR-041).
 *
 * `usePointRules()` filtert auf `is_active`, weil es um Vorschläge geht. Für
 * die **Historie** ist das falsch: Eine Buchung aus einer inzwischen
 * abgeschalteten Regel bekäme sonst den Regelcode als Überschrift, und ein
 * Code ist keine Auskunft.
 */
export function useRuleLabels() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['rule-labels', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<PointRule[]> => {
      const { data, error } = await supabase
        .from('point_rules')
        .select('*')
        .eq('club_id', activeClub!.id);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export interface PointsSummary {
  season: string;
  seasonPoints: number;
  careerPoints: number;
  bookingCount: number;
}

/**
 * Saison- **und** Gesamtstand (BR-081).
 *
 * Beide Zahlen aus einer Serverabfrage, damit sie nie aus zwei Zeitpunkten
 * stammen – und die Saison rechnet dort `season_label()`, dieselbe Funktion,
 * die jede Buchung einordnet (BR-082).
 */
export function useMyPointsSummary() {
  const { activeClub, activeMembership } = useClub();

  return useQuery({
    queryKey: ['points-summary', activeClub?.id, activeMembership?.id],
    enabled: Boolean(activeClub) && Boolean(activeMembership) && isConfigured,
    // A3: Der Stand soll sich ohne Zutun aktualisieren. Die App hat
    // `refetchOnWindowFocus` global abgeschaltet, damit sie im Zug bedienbar
    // bleibt – für den Punktestand wird das hier zurückgenommen, denn eine
    // Buchung entsteht typischerweise, während die App im Hintergrund liegt.
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<PointsSummary> => {
      const { data, error } = await supabase.rpc('my_points_summary', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      return {
        season: row?.season ?? '',
        seasonPoints: row?.season_points ?? 0,
        careerPoints: row?.career_points ?? 0,
        bookingCount: row?.booking_count ?? 0,
      };
    },
  });
}

export interface NextContribution {
  kind: 'event' | 'shift' | 'task';
  refId: string;
  title: string;
  detail: string | null;
  /** `null` heisst: an diesem Anlass hängt keine Regel – keine Zahl behaupten. */
  points: number | null;
  whenAt: string | null;
}

/**
 * «Nächste Punkte» als konkrete Beiträge (Schritt 4, BR-083).
 *
 * Der Server stellt sie zusammen: Er kennt die Team-Zugehörigkeit, die
 * Unterdeckung jeder Schicht und den Geltungsbereich jeder Aufgabe. Im Client
 * wären das drei Abfragen und drei Kopien derselben Regeln.
 */
export function useNextContributions(limit = 5) {
  const { activeClub, activeMembership } = useClub();

  return useQuery({
    queryKey: ['next-contributions', activeClub?.id, activeMembership?.id, limit],
    enabled: Boolean(activeClub) && Boolean(activeMembership) && isConfigured,
    queryFn: async (): Promise<NextContribution[]> => {
      const { data, error } = await supabase.rpc('next_contributions', {
        p_club_id: activeClub!.id,
        p_limit: limit,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        kind: row.kind as NextContribution['kind'],
        refId: row.ref_id,
        title: row.title,
        detail: row.detail,
        points: row.points,
        whenAt: row.when_at,
      }));
    },
  });
}

/**
 * Die vollständige Historie (A2, FR-041) – über alle Saisons.
 *
 * Eigene Abfrage neben `useMyPoints()`: Das Dashboard braucht die laufende
 * Saison, die Historie alles. Beide über denselben Schlüssel zu führen hiesse,
 * dem Dashboard bei jedem Besuch die ganze Vereinsgeschichte zu laden.
 */
export function useAllPoints() {
  const { activeMembership } = useClub();

  return useQuery({
    queryKey: ['points-history', activeMembership?.id],
    enabled: Boolean(activeMembership) && isConfigured,
    queryFn: async (): Promise<PointTransaction[]> => {
      const { data, error } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('member_id', activeMembership!.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/**
 * Der Ledger eines Mitglieds – für den Vorstand (UC-021, Schritt 1 und A1).
 *
 * Seit `0037` liest den fremden Ledger nur noch der Vorstand. Er braucht ihn:
 * Er bucht von Hand und gleicht Fehlbuchungen aus.
 */
export function useMemberPoints(memberId: string | null) {
  const { isAdmin } = useClub();

  return useQuery({
    queryKey: ['member-points', memberId],
    enabled: Boolean(memberId) && isAdmin && isConfigured,
    queryFn: async (): Promise<PointTransaction[]> => {
      const { data, error } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('member_id', memberId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/**
 * Punkte von Hand buchen (Schritte 5–7, A3).
 *
 * Rolle, Notizpflicht und Vorzeichen prüft der Server – das Formular ist
 * bequem, nicht massgebend (C-011).
 */
export function useBookPoints() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      memberIds: string[];
      pillar: number;
      points: number;
      note: string;
    }): Promise<number> => {
      const { data, error } = await supabase.rpc('book_points_manually', {
        p_club_id: activeClub!.id,
        p_member_ids: input.memberIds,
        p_pillar: input.pillar,
        p_points: input.points,
        p_note: input.note,
      });
      if (error) throw new Error(error.message);
      return data ?? 0;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['member-points'] });
      void queryClient.invalidateQueries({ queryKey: ['points-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['points-history'] });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

/**
 * Eine Buchung ausgleichen (A1, BR-085).
 *
 * «Korrigieren» heisst hier nicht ändern: Die ursprüngliche Buchung bleibt
 * stehen, daneben entsteht eine Gegenbuchung mit Verweis. Der Ledger ist
 * unveränderlich, und das soll man ihm ansehen.
 */
export function useReversePoints() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { transactionId: string; note: string }) => {
      const { error } = await supabase.rpc('reverse_points', {
        p_transaction_id: input.transactionId,
        p_note: input.note,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['member-points'] });
      void queryClient.invalidateQueries({ queryKey: ['points-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['points-history'] });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

/**
 * Die fünf Wertdimensionen (UC-024).
 *
 * Gerechnet wird auf dem Server: Seit `0037` liest niemand mehr fremde
 * Buchungen, ein Team-Durchschnitt liesse sich im Client gar nicht bilden.
 * `memberId` ist die Führungssicht (A4) – wer sie sehen darf, entscheidet
 * ebenfalls der Server.
 */
export function useValueDimensions(memberId?: string | null) {
  const { activeClub, activeMembership } = useClub();

  return useQuery({
    queryKey: ['dimensions', activeClub?.id, memberId ?? activeMembership?.id],
    enabled: Boolean(activeClub) && Boolean(activeMembership) && isConfigured,
    queryFn: async (): Promise<ValueDimension[]> => {
      const { data, error } = await supabase.rpc('value_dimensions', {
        p_club_id: activeClub!.id,
        p_member_id: memberId ?? undefined,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        dimension: row.dimension as Dimension,
        ownValue: row.own_value,
        teamValue: row.team_value,
        clubValue: row.club_value,
        collected: row.collected,
        groupSize: row.group_size,
      }));
    },
  });
}

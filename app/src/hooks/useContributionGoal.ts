import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import { useClub } from './useClub';
import type { ContributionRow, GoalState } from '../lib/contributionGoal';

/**
 * Das Saisonziel für den Beitrag (UC-042).
 *
 * Zwei Sichten, zwei Endpunkte: `contribution_overview()` prüft im Rumpf auf
 * den Vorstand, `my_contribution_goal()` gibt nur den eigenen Stand. Das ist
 * BR-201 und NFR-039 – die Trennung liegt im Server, nicht in einem Filter im
 * Client, den man umgehen könnte.
 */

export interface MyContributionGoal {
  season: string;
  goal: number;
  earned: number;
  /**
   * Zugesagt und noch nicht gebucht (FR-198): angemeldete Schichten,
   * übernommene Aufgaben, das laufende Amt. **Nicht** in `earned` enthalten –
   * eine Zusage ist keine Leistung, und die Ampel hängt am Geleisteten.
   */
  planned: number;
  remaining: number;
  state: GoalState;
}

/**
 * Der eigene Stand.
 *
 * Gibt `null`, wenn das Modul aus ist, kein Ziel gilt oder die Person befreit
 * ist (A2, A3, A7). Die Karte erscheint dann gar nicht – ein Fortschritt ohne
 * Ziel wäre ein Balken ohne Ende.
 */
export function useMyContributionGoal() {
  const { activeClub, activeMembership } = useClub();

  return useQuery({
    queryKey: ['contribution-goal', activeClub?.id, activeMembership?.id],
    enabled: Boolean(activeClub) && Boolean(activeMembership) && isConfigured,
    // Wie beim Punktestand: Eine Buchung entsteht, während die App im
    // Hintergrund liegt.
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<MyContributionGoal | null> => {
      const { data, error } = await supabase.rpc('my_contribution_goal', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      if (!row) return null;
      return {
        season: row.season ?? '',
        goal: row.goal ?? 0,
        earned: row.earned ?? 0,
        planned: row.planned ?? 0,
        remaining: row.remaining ?? 0,
        state: row.state as GoalState,
      };
    },
  });
}

/** Die Übersicht des Vorstands: jedes aktive Mitglied mit Ist, Soll und Rest. */
export function useContributionOverview(enabled = true) {
  const { activeClub, isAdmin } = useClub();

  return useQuery({
    queryKey: ['contribution-overview', activeClub?.id],
    enabled: enabled && Boolean(activeClub) && isAdmin && isConfigured,
    queryFn: async (): Promise<ContributionRow[]> => {
      const { data, error } = await supabase.rpc('contribution_overview', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        member_id: row.member_id,
        name: row.name,
        avatar_url: row.avatar_url,
        goal: row.goal,
        earned: row.earned ?? 0,
        planned: row.planned ?? 0,
        remaining: row.remaining,
        state: row.state as GoalState,
      }));
    },
  });
}

/**
 * Das abweichende Ziel eines Mitglieds setzen (FR-159).
 *
 * `null` heisst «es gilt das Vereinsziel», `0` heisst «befreit». Der
 * Unterschied kommt von der Eingabe bis in die Spalte durch (BR-200).
 */
export function useSetContributionGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { memberId: string; goal: number | null }) => {
      const { error } = await supabase.rpc('set_contribution_goal', {
        p_member_id: input.memberId,
        // Postgres kann die Nullbarkeit eines Arguments nicht ausdrücken, also
        // erzeugt `types:generate` hier `number`. `null` ist trotzdem gültig
        // und bedeutet «es gilt das Vereinsziel» – die Funktion prüft das
        // selbst (BR-200). Der Cast steht hier und nicht in der Signatur des
        // Hooks, damit der Aufrufer den Unterschied weiterhin sieht.
        p_goal: input.goal as number,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contribution-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['contribution-goal'] });
    },
  });
}

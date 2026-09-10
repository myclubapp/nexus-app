import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useClub } from './useClub';
import { readInterests } from '../lib/contribution';
import type {
  ContributionDraft,
  ContributionProfile,
  TimeBudget,
} from '../lib/contribution';

/**
 * Das eigene Beitrags-Profil.
 *
 * Die Policy aus `0051` gibt **nur** die eigene Zeile heraus – nicht dem
 * Vorstand, nicht den Trainer:innen. Das Profil ist nicht Teil der
 * Führungssicht (BR-145); wer damit arbeitet, ist der Server.
 */
export function useContributionProfile() {
  const { activeClub, activeMembership } = useClub();

  return useQuery({
    queryKey: ['contribution-profile', activeClub?.id, activeMembership?.id],
    enabled: Boolean(activeClub) && Boolean(activeMembership) && isConfigured,
    queryFn: async (): Promise<ContributionProfile | null> => {
      const { data, error } = await supabase
        .from('member_contribution_profiles')
        .select('interests, strengths, time_budget, updated_at')
        .eq('member_id', activeMembership!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;

      return {
        interests: readInterests(data.interests),
        strengths: data.strengths ?? '',
        timeBudget: (data.time_budget as TimeBudget | null) ?? null,
        updatedAt: data.updated_at,
      };
    },
  });
}

/**
 * Das Profil speichern (Schritte 2–5, A2).
 *
 * Ein **leeres** Profil ist ein gültiges Profil: Es hält fest, dass gefragt
 * wurde und die Person später ausfüllen wollte (A1).
 */
export function useSaveContributionProfile() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (draft: ContributionDraft) => {
      const { error } = await supabase.rpc('save_contribution_profile', {
        p_club_id: activeClub!.id,
        p_interests: draft.interests,
        p_strengths: draft.strengths.trim() || undefined,
        p_time_budget: draft.timeBudget ?? undefined,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['contribution-profile'] });
      // Schritt 7: Die passenden Aufgaben stehen **unmittelbar** danach da.
      void queryClient.invalidateQueries({ queryKey: ['matching-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['matching-vacancies'] });
      void queryClient.invalidateQueries({ queryKey: ['contribution-budget'] });
    },
  });
}

export interface MatchingTask {
  id: string;
  title: string;
  why: string | null;
  category: string;
  points: number;
}

/** Was zu meinem Profil passt (FR-059, Schritt 7). */
export function useMatchingTasks(limit = 5) {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['matching-tasks', activeClub?.id, limit],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<MatchingTask[]> => {
      const { data, error } = await supabase.rpc('matching_tasks', {
        p_club_id: activeClub!.id,
        p_limit: limit,
      });
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        id: row.task_id,
        title: row.title,
        why: row.why,
        category: row.category,
        points: row.points,
      }));
    },
  });
}

export interface MatchingVacancy {
  id: string;
  title: string;
}

/**
 * Vakante Ämter, die zum Profil passen.
 *
 * Der zweite Teil des Ziels: «Aufgaben **und Ämter**». Eine Vakanz-Anzeige im
 * Marktplatz ist Ausbaustufe 2 – ein Amt jemandem anzubieten, der Organisation
 * oder Finanzen genannt hat, ist es nicht.
 */
export function useMatchingVacancies() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['matching-vacancies', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<MatchingVacancy[]> => {
      const { data, error } = await supabase.rpc('matching_vacancies', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({ id: row.role_id, title: row.title }));
    },
  });
}

/**
 * Das eigene Zeitbudget (BR-144, A4).
 *
 * `null` heisst «kein Budget gesetzt» und damit unbeschränkt – nicht null. Ohne
 * diesen Wert könnte die Ansicht im Fall A4 nur eine leere Liste zeigen und
 * nicht sagen, warum.
 */
export function useContributionBudget() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['contribution-budget', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase.rpc('my_contribution_budget', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);
      return (data as number | null) ?? null;
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import type { Json, PointRule, TablesUpdate } from '../lib/database.types';
import type { Pillar, RuleLimit } from '../lib/pointRule';
import { normaliseRuleCode, writeRuleLimit } from '../lib/pointRule';
import { useClub } from './useClub';

/**
 * Alle Punkteregeln des Vereins – auch die stillgelegten.
 *
 * Bewusst nicht `is_active` gefiltert: BR-067 verlangt, dass sich eine
 * deaktivierte Standardregel jederzeit wieder einschalten lässt, und dafür
 * muss sie sichtbar bleiben.
 */
export function useAllPointRules() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['point-rules-all', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<PointRule[]> => {
      const { data, error } = await supabase
        .from('point_rules')
        .select('*')
        .eq('club_id', activeClub!.id)
        .order('pillar')
        .order('label');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/** Alles, was React Query nach einer Regeländerung neu holen muss. */
function invalidateRuleQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  clubId: string | undefined,
) {
  void queryClient.invalidateQueries({ queryKey: ['point-rules-all', clubId] });
  // Das Dashboard zeigt aktive Regeln unter «Nächste Punkte».
  void queryClient.invalidateQueries({ queryKey: ['point-rules', clubId] });
}

export interface RulePatch {
  ruleId: string;
  label?: string;
  points?: number;
  isActive?: boolean;
  limit?: RuleLimit;
  /** Bestehendes `meta`, damit die Grenze es ergänzt statt es zu ersetzen. */
  meta?: unknown;
}

/**
 * Eine Regel ändern (Schritt 4–6, A1, A4, A5).
 *
 * BR-063: Die Änderung wirkt nur nach vorne. Bereits erfolgte Buchungen tragen
 * ihren damaligen Wert und werden hier nicht angefasst.
 */
export function useUpdatePointRule() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (patch: RulePatch) => {
      // Typisiert statt Record<string, unknown>: Sonst nimmt supabase-js jeden
      // Spaltennamen an, auch einen falsch geschriebenen, und die Änderung
      // liefe still ins Leere.
      const update: TablesUpdate<'point_rules'> = {};
      if (patch.label !== undefined) update.label = patch.label.trim();
      if (patch.points !== undefined) update.points = patch.points;
      if (patch.isActive !== undefined) update.is_active = patch.isActive;
      if (patch.limit !== undefined) {
        update.meta = writeRuleLimit(patch.meta, patch.limit) as Json;
      }
      if (Object.keys(update).length === 0) return;

      const { error } = await supabase
        .from('point_rules')
        .update(update)
        .eq('id', patch.ruleId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateRuleQueries(queryClient, activeClub?.id),
  });
}

/** Eine ganze Säule aus- oder einschalten (A2). */
export function useSetPillarActive() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: { pillar: Pillar; isActive: boolean }) => {
      if (!activeClub) throw new Error('Kein aktiver Verein');
      const { error } = await supabase.rpc('set_pillar_active', {
        p_club_id: activeClub.id,
        p_pillar: input.pillar,
        p_active: input.isActive,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateRuleQueries(queryClient, activeClub?.id),
  });
}

export interface NewRule {
  label: string;
  code: string;
  pillar: Pillar;
  points: number;
}

/** Eigene Regel anlegen (A3, FR-038). */
export function useCreatePointRule() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (rule: NewRule) => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      const { error } = await supabase.from('point_rules').insert({
        club_id: activeClub.id,
        pillar: rule.pillar,
        code: normaliseRuleCode(rule.code),
        label: rule.label.trim(),
        points: rule.points,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateRuleQueries(queryClient, activeClub?.id),
  });
}

/**
 * Eine Regel löschen (Entscheid vom 2026-09-13).
 *
 * Der Riegel sitzt in `delete_point_rule()` (0074): Eine Regel mit Buchungen
 * oder Terminen bleibt, und die Meldung sagt, was noch dranhängt – der Weg
 * dafür ist das Stilllegen (BR-067).
 */
export function useDeletePointRule() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase.rpc('delete_point_rule', { p_rule_id: ruleId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateRuleQueries(queryClient, activeClub?.id),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import type { TablesUpdate } from '../lib/database.types';
import { useClub } from './useClub';

/**
 * Teams verwalten (UC-007 A1 und S2 der Prüfung vom 2026-09-11).
 *
 * Die bestehende myclub-App hat drei Seiten dafür – Teamliste, Team-Detail,
 * Mitglieder je Team –, hier gab es nur ein Kästchen im Mitglied-Detail. Und
 * UC-039 setzt in Schritt 1 ein Teamformular voraus, das es nicht gab.
 *
 * Gelesen wird über `useTeams()` aus `useInvites.ts`; hier stehen nur die
 * Schreibwege, die dazukommen. Das Löschen geht über `delete_team()`: Der
 * Riegel gegen ein Team mit Terminen gehört in die Datenbank, nicht in einen
 * Knopf (guidelines §9).
 */

/** Name und Bereich eines Teams ändern. */
export function useUpdateTeam() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: { teamId: string; name?: string; area?: string | null }) => {
      const patch: TablesUpdate<'teams'> = {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.area !== undefined) patch.area = input.area?.trim() || null;
      if (Object.keys(patch).length === 0) return;

      const { error } = await supabase.from('teams').update(patch).eq('id', input.teamId);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams', activeClub?.id] });
      await queryClient.invalidateQueries({ queryKey: ['members', activeClub?.id] });
    },
  });
}

/** Ein Team löschen – der Riegel sitzt in `delete_team()`. */
export function useDeleteTeam() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.rpc('delete_team', { p_team_id: teamId });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams', activeClub?.id] });
      await queryClient.invalidateQueries({ queryKey: ['members', activeClub?.id] });
    },
  });
}

/**
 * Die Bereiche, die der Verein schon verwendet – als Vorschläge.
 *
 * Ein Bereich ist ein Wort, kein Objekt (0059). Damit «Junioren» nicht dreimal
 * verschieden geschrieben wird, zeigt das Formular, was es schon gibt.
 */
export function useAreas() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['areas', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('teams')
        .select('area')
        .eq('club_id', activeClub!.id)
        .not('area', 'is', null);
      if (error) throw new Error(error.message);
      const seen = new Set<string>();
      for (const row of data ?? []) if (row.area) seen.add(row.area);
      return [...seen].sort((a, b) => a.localeCompare(b));
    },
  });
}

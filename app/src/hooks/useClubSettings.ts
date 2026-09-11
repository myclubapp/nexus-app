import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useClub } from './useClub';
import type { ClubSettings } from '../lib/database.types';

export interface ClubSettingsInput {
  name: string;
  seasonStart: string | null;
  settings: ClubSettings;
}

/**
 * Vereinseinstellungen speichern: Name, Saisonstart, Farben und Begriffe.
 *
 * Geschrieben wird auf `clubs`; die Berechtigung prüft die Policy
 * `clubs_update` über `is_club_admin()`. Das Ausblenden der Seite für
 * Nicht-Vorstände ist Bequemlichkeit, nicht der Schutz.
 */
export function useSaveClubSettings() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: ClubSettingsInput) => {
      if (!activeClub) return;

      const { error } = await supabase
        .from('clubs')
        .update({
          name: input.name.trim(),
          season_start: input.seasonStart,
          settings: input.settings,
        })
        .eq('id', activeClub.id);

      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
      // Die Saison steckt im Schlüssel der Punkte- und Ranglisten-Abfragen.
      await queryClient.invalidateQueries({ queryKey: ['points'] });
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

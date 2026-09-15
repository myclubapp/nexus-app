import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { buildClubSettings } from '../lib/clubSettings';
import i18n from '../i18n';
import { useClub } from './useClub';
import type { ClubModule, ClubSettings } from '../lib/database.types';

export interface ClubSettingsInput {
  name: string;
  seasonStart: string | null;
  settings: ClubSettings;
}

/** Was an `clubs` geschrieben wird – jedes Feld wahlfrei, siehe `writeClub()`. */
interface ClubPatch {
  name?: string;
  season_start?: string | null;
  settings?: ClubSettings;
}

/**
 * Den Verein schreiben – und **belegen lassen, dass geschrieben wurde**.
 *
 * Ein `update`, das die Policy `clubs_update` nicht durchlässt, trifft keine
 * Zeile, und PostgREST meldet dafür **keinen** Fehler. Ohne das `select`
 * bekäme der Aufrufer einen Erfolg zurück, zeigte «Gespeichert» und die
 * Einstellung stünde beim nächsten Laden wieder auf dem alten Wert. Bleibt die
 * getroffene Zeile aus, ist das hier ein Fehler.
 *
 * Nur die mitgeschickten Spalten werden angefasst: Wer bloss ein Modul
 * umlegt, schreibt nicht nebenbei den Vereinsnamen aus einem halb getippten
 * Entwurf mit.
 */
async function writeClub(clubId: string, patch: ClubPatch): Promise<void> {
  const { data, error } = await supabase
    .from('clubs')
    .update(patch)
    .eq('id', clubId)
    .select('id');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error(i18n.t('clubSettings.notWritten'));
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

      await writeClub(activeClub.id, {
        name: input.name.trim(),
        season_start: input.seasonStart,
        settings: input.settings,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
      // Die Saison steckt im Schlüssel der Punkte- und Ranglisten-Abfragen.
      await queryClient.invalidateQueries({ queryKey: ['points'] });
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

/**
 * Die Module schreiben – **sofort beim Umlegen**, nicht erst beim Speichern.
 *
 * Ein Modul entscheidet, ob es einen ganzen Bereich gibt. Es gehört damit
 * nicht in denselben Entwurf wie eine Farbe: Wer den Schalter umlegt und die
 * Seite verlässt, hat das Modul eingeschaltet – nicht einen Entwurf verworfen.
 * Der Speichern-Knopf am Fuss der Seite gilt weiter für alles Übrige.
 *
 * Mitgeschickt wird die **ganze** Modulkarte, nicht das einzelne Modul: So
 * schreibt der Aufrufer, was seine Schalter zeigen, und zwei rasch
 * aufeinanderfolgende Umlegungen können sich nicht gegenseitig zurücknehmen.
 */
export function useSaveClubModules() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (modules: Partial<Record<ClubModule, boolean>>) => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      await writeClub(activeClub.id, {
        settings: buildClubSettings(activeClub.settings, { modules }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });
}

/**
 * Nimmt der Verein offene Beitritts-Anfragen an (UC-051, FR-196)?
 *
 * **Sofort beim Umlegen**, wie die Module: Der Schalter öffnet einen Weg in
 * den Verein hinein – wer ihn umlegt und die Seite verlässt, hat ihn geöffnet
 * und nicht einen Entwurf verworfen.
 *
 * Wirksam wird er in `request_join()` (`0101`), nicht hier: Das Formular
 * auszublenden ist Bequemlichkeit, die Regel steht im Server (C-011).
 */
export function useSaveJoinPolicy() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (isPublic: boolean) => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      await writeClub(activeClub.id, {
        settings: buildClubSettings(activeClub.settings, { join: { public: isPublic } }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });
}

/**
 * Welches Amt den Vereins-Puls unterschreibt (UC-050, FR-191).
 *
 * **Sofort beim Wählen**, wie die Module: Es ist eine einzelne Entscheidung
 * und kein Entwurf, der zu einem Speichern-Knopf gehört. Ein leerer Wert
 * heisst «niemand grüsst» – dann endet das Blatt nach den Abschnitten (A1).
 *
 * Der Grusstext selbst steht am Amt und nicht hier (BR-252): Wechselt die
 * Besetzung, wechselt die Unterschrift mit, ohne dass jemand diese Einstellung
 * nachzieht.
 */
export function useSavePulseGreetingRole() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (roleId: string) => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      await writeClub(activeClub.id, {
        settings: buildClubSettings(activeClub.settings, {
          pulse: { greetingRoleId: roleId },
        }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
      await queryClient.invalidateQueries({ queryKey: ['pulse-preview'] });
    },
  });
}

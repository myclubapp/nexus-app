import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import type { TablesUpdate } from '../lib/database.types';
import type { Federation, GamesSync } from '../lib/federation';
import { useClub } from './useClub';
import { syncFederationNow } from './useFederation';

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

/**
 * Name, Bereich und Zusatz eines Teams ändern.
 *
 * Bei einem verknüpften Team greift `name` nicht: Der Trigger in `0060` setzt
 * ihn aus Grundname und Zusatz zusammen (BR-176). Das Formular zeigt dort
 * deshalb den Zusatz statt des Namens.
 */
export function useUpdateTeam() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      teamId: string;
      name?: string;
      area?: string | null;
      nameAddition?: string | null;
    }) => {
      const patch: TablesUpdate<'teams'> = {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.area !== undefined) patch.area = input.area?.trim() || null;
      if (input.nameAddition !== undefined) patch.name_addition = input.nameAddition?.trim() || null;
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

/** Was `link_team()` und `import_federation_teams()` über ein Verbands-Team wissen wollen. */
export interface TeamLinkInput {
  federation: Federation;
  federationTeamId: string;
  name: string;
  league: string | null;
  nameAddition: string;
}

function invalidateTeams(
  queryClient: ReturnType<typeof useQueryClient>,
  clubId: string | undefined,
) {
  void queryClient.invalidateQueries({ queryKey: ['teams', clubId] });
  void queryClient.invalidateQueries({ queryKey: ['members', clubId] });
  void queryClient.invalidateQueries({ queryKey: ['areas', clubId] });
}

/**
 * Nach dem Verknüpfen: Teams neu lesen **und** die Agenda – der Abgleich hat
 * eben Spiele angelegt (Schritt 9), und ein Zeitpunkt am Team gesetzt.
 */
function invalidateTeamsAndAgenda(
  queryClient: ReturnType<typeof useQueryClient>,
  clubId: string | undefined,
) {
  invalidateTeams(queryClient, clubId);
  void queryClient.invalidateQueries({ queryKey: ['agenda', clubId] });
}

/**
 * UC-039, Schritte 5–9: ein bestehendes Team mit einem Verbands-Team
 * verknüpfen und gleich die Spiele holen. Die Regeln – nur Vorstand, nur bei
 * aktiver Verbindung, ein Verbands-Team je Team (A3) – sitzen in
 * `link_team()`. Der Abgleich danach wirft nicht: Steht die Verknüpfung,
 * ist die Mutation gelungen; was die Spiele machten, sagt das Ergebnis (A7).
 */
export function useLinkTeam() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: TeamLinkInput & { teamId: string }): Promise<GamesSync> => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      const { error } = await supabase.rpc('link_team', {
        p_team_id: input.teamId,
        p_federation: input.federation,
        p_federation_team_id: input.federationTeamId,
        p_name: input.name,
        p_league: input.league ?? undefined,
        p_name_addition: input.nameAddition || undefined,
      });
      if (error) throw new Error(error.message);

      return syncFederationNow(activeClub.id, input.federation);
    },
    onSuccess: () => invalidateTeamsAndAgenda(queryClient, activeClub?.id),
  });
}

/** A5: die Verknüpfung lösen. Name und Termine bleiben (BR-181). */
export function useUnlinkTeam() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.rpc('unlink_team', { p_team_id: teamId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateTeams(queryClient, activeClub?.id),
  });
}

/** Was A1 zurückgibt: die Zahlen der Übernahme und was der Abgleich brachte. */
export interface ImportOutcome {
  created: number;
  linked: number;
  sync: GamesSync;
}

/**
 * A1: Teams aus dem Verband übernehmen – und der Weg aus «Team anlegen»,
 * wenn dort gleich ein Verbands-Team gewählt wurde. Ein Eintrag ohne
 * `team_id` wird angelegt, einer mit `team_id` verknüpft; alles in einer
 * Transaktion. Danach holt der Abgleich die Spiele (Schritt 9).
 */
export function useImportFederationTeams() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      federation: Federation;
      items: {
        federation_team_id: string;
        name: string;
        league: string | null;
        team_id: string | null;
        name_addition?: string | null;
      }[];
    }): Promise<ImportOutcome> => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      const { data, error } = await supabase.rpc('import_federation_teams', {
        p_club_id: activeClub.id,
        p_federation: input.federation,
        p_items: input.items,
      });
      if (error) throw new Error(error.message);
      const row = (data ?? [])[0];

      const sync = await syncFederationNow(activeClub.id, input.federation);
      return { created: row?.created ?? 0, linked: row?.linked ?? 0, sync };
    },
    onSuccess: () => invalidateTeamsAndAgenda(queryClient, activeClub?.id),
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import { functionErrorMessage } from '../lib/functionError';
import { useClub } from './useClub';
import {
  readGamesSync,
  type Federation,
  type FederationConnection,
  type FederationStatus,
  type FederationSyncResult,
  type GamesSync,
} from '../lib/federation';

/** Ein Team, wie der Verband es kennt (Schritt 7, Grundlage für UC-039). */
export interface FederationTeam {
  id: string;
  name: string;
  league: string | null;
}

/** Was der Testaufruf zurückgibt (Schritt 5, A1). */
export interface FederationCheck {
  ok: boolean;
  teams?: FederationTeam[];
  error?: string;
}

/**
 * Die Verbindungen des aktiven Vereins (Schritt 1).
 *
 * Die Policy aus `0058` zeigt sie nur dem Vorstand – der Client filtert nicht
 * mit. Der Schlüssel steht nicht in der Zeile: `api_key_secret` trägt bloss
 * den Namen des Tresor-Eintrags, und auch der bleibt hier ungelesen (BR-153).
 */
export function useFederationConnections() {
  const { activeClub, isAdmin } = useClub();

  return useQuery({
    queryKey: ['federation', activeClub?.id],
    enabled: Boolean(activeClub) && isAdmin && isConfigured,
    queryFn: async (): Promise<FederationConnection[]> => {
      const { data, error } = await supabase
        .from('federation_connections')
        .select(
          'federation, federation_club_id, api_key_secret, status, last_sync_at, last_error, news_enabled',
        )
        .eq('club_id', activeClub!.id)
        .order('federation');
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => {
        const entry = row as unknown as {
          federation: string;
          federation_club_id: string;
          api_key_secret: string | null;
          status: string;
          last_sync_at: string | null;
          last_error: string | null;
          news_enabled: boolean | null;
        };
        return {
          federation: entry.federation as Federation,
          federationClubId: entry.federation_club_id,
          status: entry.status as FederationStatus,
          lastSyncAt: entry.last_sync_at,
          lastError: entry.last_error,
          hasKey: entry.api_key_secret !== null,
          newsEnabled: entry.news_enabled === true,
        };
      });
    },
  });
}

/**
 * Schritt 5: der Testaufruf – **ohne** zu speichern.
 *
 * Er ist eine eigene Mutation und nicht Teil des Verbindens, weil A1 genau das
 * verlangt: Schlägt er fehl, entsteht nichts, und der Vorstand korrigiert die
 * Kennung. Dass der Aufruf die Teams zurückgibt, ist der zweite Zweck – so
 * sieht die Person sofort, ob sie den richtigen Verein erwischt hat.
 */
export function useCheckFederation() {
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      federation: Federation;
      federationClubId: string;
      apiKey: string;
    }): Promise<FederationCheck> => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      const { data, error } = await supabase.functions.invoke<FederationCheck>(
        'sync-federation',
        {
          body: {
            mode: 'check',
            clubId: activeClub.id,
            federation: input.federation,
            federationClubId: input.federationClubId,
            apiKey: input.apiKey || undefined,
          },
        },
      );
      if (error) throw new Error(await functionErrorMessage(error));
      return data ?? { ok: false, error: 'Keine Antwort' };
    },
  });
}

/**
 * UC-039, Schritte 3–4: die Teams des Verbands zum Verknüpfen.
 *
 * Der Schlüssel kommt aus dem Tresor, nicht vom Gerät (BR-178): Der Client
 * nennt nur Verein und Verband, die Edge Function holt die Liste. Gelingt der
 * Abruf, gilt die Verbindung als aktiv – deshalb wird sie danach neu gelesen.
 */
export function useFederationTeams() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (federation: Federation): Promise<FederationCheck> => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      const { data, error } = await supabase.functions.invoke<FederationCheck>(
        'sync-federation',
        { body: { mode: 'teams', clubId: activeClub.id, federation } },
      );
      if (error) throw new Error(await functionErrorMessage(error));
      return data ?? { ok: false, error: 'Keine Antwort' };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['federation', activeClub?.id] });
    },
  });
}

/**
 * UC-039, Schritt 9: den Abgleich dieser Verbindung sofort anstossen.
 *
 * Aufgerufen, nachdem `link_team()` oder `import_federation_teams()` gelungen
 * ist – sonst stünden die Spiele erst nach dem nächtlichen Lauf in der
 * Agenda, und wer eben verknüpft hat, sähe eine leere Agenda ohne Erklärung.
 *
 * Wirft nie: Die Verknüpfung ist da, ein misslungener Abgleich darf nicht wie
 * ein misslungenes Verknüpfen aussehen (A7). Was er brachte, sagt `GamesSync`.
 */
export async function syncFederationNow(
  clubId: string,
  federation: Federation,
): Promise<GamesSync> {
  try {
    const { data, error } = await supabase.functions.invoke<FederationSyncResult>(
      'sync-federation',
      { body: { mode: 'sync', clubId, federation } },
    );
    if (error) return { games: null, error: await functionErrorMessage(error) };
    return readGamesSync(data);
  } catch (cause) {
    return { games: null, error: cause instanceof Error ? cause.message : String(cause) };
  }
}

/** Schritt 6: verbinden. Der Schlüssel geht in den Tresor, nicht in die Zeile. */
export function useConnectFederation() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      federation: Federation;
      federationClubId: string;
      apiKey: string;
    }) => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      const { error } = await supabase.rpc('connect_federation', {
        p_club_id: activeClub.id,
        p_federation: input.federation,
        p_federation_club_id: input.federationClubId,
        p_api_key: input.apiKey || undefined,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['federation', activeClub?.id] });
    },
  });
}

/** Was aus dem Umlegen wurde – die Grundlage der Meldung an die Person. */
export interface NewsToggleResult {
  enabled: boolean;
  /** Warum noch keine Beiträge dastehen. `null`, wenn sie da sind. */
  syncError: string | null;
}

/**
 * UC-035, Schritt 7: die Verbandsnews zu- oder abschalten (FR-197).
 *
 * **Einschalten und abgleichen gehören zusammen.** Der nächtliche Lauf käme
 * erst am nächsten Morgen; bis dahin sähe der Schalter wirkungslos aus. Es ist
 * derselbe Griff wie nach dem Verknüpfen eines Teams (UC-039, Schritt 9) – und
 * er steht **hier**, nicht in den beiden Ansichten, die ihn brauchen
 * (`FederationPage` und der Einrichtungs-Assistent). Zweimal geschrieben liefe
 * er auseinander.
 *
 * Ein misslungener Abgleich ist **kein** Fehlschlag: Die Verbindung steht, nur
 * die Beiträge fehlen noch (BR-155). Deshalb `syncError` im Ergebnis und keine
 * Ausnahme.
 *
 * Abschalten entfernt **nichts**: Was schon im Feed steht, gehört dem Verein
 * (BR-170 sinngemäss). Es kommt nur nichts mehr nach.
 */
export function useSetFederationNews() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      federation: Federation;
      enabled: boolean;
    }): Promise<NewsToggleResult> => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      const { error } = await supabase.rpc('set_federation_news', {
        p_club_id: activeClub.id,
        p_federation: input.federation,
        p_enabled: input.enabled,
      });
      if (error) throw new Error(error.message);

      if (!input.enabled) return { enabled: false, syncError: null };

      return {
        enabled: true,
        syncError: (await syncFederationNow(activeClub.id, input.federation)).error,
      };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['federation', activeClub?.id] });
      // Erst **nach** dem Abgleich: Sonst läse der Feed neu, bevor die Beiträge
      // dastehen, und bliebe bis zum nächsten Betreten leer.
      void queryClient.invalidateQueries({ queryKey: ['news'] });
    },
  });
}

/** A4: trennen. Die importierten Termine bleiben. */
export function useDisconnectFederation() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (federation: Federation) => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      const { error } = await supabase.rpc('disconnect_federation', {
        p_club_id: activeClub.id,
        p_federation: federation,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['federation', activeClub?.id] });
    },
  });
}

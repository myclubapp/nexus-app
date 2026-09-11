import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import { useClub } from './useClub';
import type {
  Federation,
  FederationConnection,
  FederationStatus,
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
 * Die Fehlermeldung aus einer Edge Function lesen.
 *
 * Wortgleich zum Weg in `useNewsSources.ts`: supabase-js macht aus jeder
 * Antwort ausserhalb von 2xx einen `FunctionsHttpError` und lässt `data` leer.
 * Ohne dieses Auspacken sähe der Vorstand «non-2xx status code» statt der
 * Meldung des Verbands, die A1 ausdrücklich verlangt.
 */
async function functionErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (typeof body?.error === 'string') return body.error;
    } catch {
      // Antwort ohne JSON-Rumpf: Es bleibt die Meldung von supabase-js.
    }
  }
  return error instanceof Error ? error.message : String(error);
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
        .select('federation, federation_club_id, api_key_secret, status, last_sync_at, last_error')
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
        };
        return {
          federation: entry.federation as Federation,
          federationClubId: entry.federation_club_id,
          status: entry.status as FederationStatus,
          lastSyncAt: entry.last_sync_at,
          lastError: entry.last_error,
          hasKey: entry.api_key_secret !== null,
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

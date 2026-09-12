import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import { functionErrorMessage } from '../lib/functionError';
import {
  readLegacySync,
  type LegacyCheck,
  type LegacySource,
  type LegacyStatus,
  type LegacySync,
  type LegacySyncResult,
} from '../lib/legacy';
import { useClub } from './useClub';

/**
 * Die Quelle des aktiven Vereins (Schritt 1).
 *
 * Die Policy aus `0069` zeigt sie nur dem Vorstand – der Client filtert nicht
 * mit. Ein Schlüssel steht nicht in der Zeile; das Service-Konto kennt nur der
 * Server (BR-185).
 */
export function useLegacySource() {
  const { activeClub, isAdmin } = useClub();

  return useQuery({
    queryKey: ['legacy', activeClub?.id],
    enabled: Boolean(activeClub) && isAdmin && isConfigured,
    queryFn: async (): Promise<LegacySource | null> => {
      const { data, error } = await supabase
        .from('legacy_sources')
        .select('firebase_club_id, status, last_sync_at, last_error, imported_events')
        .eq('club_id', activeClub!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        firebaseClubId: data.firebase_club_id,
        status: data.status as LegacyStatus,
        lastSyncAt: data.last_sync_at,
        lastError: data.last_error,
        importedEvents: data.imported_events,
      };
    },
  });
}

/**
 * Schritt 4: der Testaufruf – **ohne** zu speichern.
 *
 * Er zeigt, was unter der Kennung liegt: den Namen des Vereins in der alten
 * App und die Zahl der aktuellen Anlässe, Helfer-Events und Schichten. So
 * sieht die Person sofort, ob sie den richtigen Verein erwischt hat (A1).
 */
export function useCheckLegacy() {
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (firebaseClubId: string): Promise<LegacyCheck> => {
      if (!activeClub) throw new Error('Kein aktiver Verein');
      const { data, error } = await supabase.functions.invoke<LegacyCheck>('sync-legacy', {
        body: { mode: 'check', clubId: activeClub.id, firebaseClubId },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      return data ?? { ok: false, error: 'Keine Antwort' };
    },
  });
}

/**
 * Schritt 6 und A3: die Übernahme sofort anstossen.
 *
 * Wirft nie: Die Quelle ist gespeichert, eine misslungene Übernahme darf
 * nicht wie ein misslungenes Verbinden aussehen. Was sie brachte, sagt
 * `LegacySync`.
 */
export async function syncLegacyNow(clubId: string): Promise<LegacySync> {
  try {
    const { data, error } = await supabase.functions.invoke<LegacySyncResult>('sync-legacy', {
      body: { mode: 'sync', clubId },
    });
    if (error) return { count: null, error: await functionErrorMessage(error) };
    return readLegacySync(data);
  } catch (cause) {
    return { count: null, error: cause instanceof Error ? cause.message : String(cause) };
  }
}

/** Schritt 5: verbinden, dann gleich übernehmen (Schritt 6). */
export function useConnectLegacy() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (firebaseClubId: string): Promise<LegacySync> => {
      if (!activeClub) throw new Error('Kein aktiver Verein');
      const { error } = await supabase.rpc('connect_legacy_source', {
        p_club_id: activeClub.id,
        p_firebase_club_id: firebaseClubId,
      });
      if (error) throw new Error(error.message);
      return syncLegacyNow(activeClub.id);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['legacy', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['agenda'] });
    },
  });
}

/** A3: «Jetzt übernehmen» bei bestehender Quelle. */
export function useSyncLegacy() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (): Promise<LegacySync> => {
      if (!activeClub) throw new Error('Kein aktiver Verein');
      return syncLegacyNow(activeClub.id);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['legacy', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['agenda'] });
    },
  });
}

/** A4: trennen. Die übernommenen Termine bleiben (BR-184). */
export function useDisconnectLegacy() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async () => {
      if (!activeClub) throw new Error('Kein aktiver Verein');
      const { error } = await supabase.rpc('disconnect_legacy_source', { p_club_id: activeClub.id });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['legacy', activeClub?.id] });
    },
  });
}

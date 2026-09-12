import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import { functionErrorMessage } from '../lib/functionError';
import type { NewsSource } from '../lib/database.types';
import type { ApiStyle, CategoryChoice, SiteCategory } from '../lib/wordpress';
import { useClub } from './useClub';

/** Was die Edge Function nach einem Abgleich zurückgibt. */
export interface ImportResult {
  clubId: string;
  imported: number;
  error: string | null;
}

/**
 * Was die Prüfung der Website zurückgibt (UC-038, Schritt 6).
 *
 * Sie schreibt nichts: Das Ergebnis lebt in der Ansicht, bis der Vorstand
 * «Beiträge holen» wählt (BR-173).
 */
export interface SiteCheck {
  url: string;
  apiStyle: ApiStyle;
  /** Der Name der Website aus der Schnittstelle – oder `null`, wenn sie ihn nicht nennt. */
  siteName: string | null;
  /** Zahl der veröffentlichten Beiträge, sofern die Website sie meldet. */
  totalPosts: number | null;
  categories: SiteCategory[];
}

/** Umfang und Auswahl, mit denen verbunden oder aktualisiert wird. */
export interface ConnectInput {
  url: string;
  postLimit: number;
  categories: CategoryChoice[];
}

/** Die verbundene Website des aktiven Vereins (UC-038). */
export function useNewsSource() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['news-source', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<NewsSource | null> => {
      const { data, error } = await supabase
        .from('news_sources')
        .select('*')
        .eq('club_id', activeClub!.id)
        .eq('kind', 'wordpress')
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/**
 * Website prüfen, ohne etwas zu speichern (UC-038, Schritte 5–6).
 *
 * Die Prüfung beantwortet drei Fragen auf einmal: Läuft dort überhaupt
 * WordPress, wie viele Beiträge stehen bereit und welche Kategorien gibt es.
 * Erst mit dieser Antwort kann der Vorstand den Umfang einstellen – vorher
 * wüsste er nicht, worüber er entscheidet (FR-149).
 */
export function useCheckWebsite() {
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (url: string): Promise<SiteCheck> => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      const { data, error } = await supabase.functions.invoke<SiteCheck>(
        'import-wordpress-news',
        { body: { mode: 'check', clubId: activeClub.id, url } },
      );
      if (error) throw new Error(await functionErrorMessage(error));
      if (!data) throw new Error('Die Prüfung lieferte keine Antwort.');
      return data;
    },
  });
}

/**
 * Website verbinden und sofort abgleichen (UC-038, Schritte 8–10).
 *
 * Verbinden und Holen sind bewusst ein Aufruf: Eine gespeicherte Adresse, aus
 * der nie ein Beitrag kam, wäre eine Einstellung, die etwas verspricht und
 * nichts hält. Die Function prüft deshalb zuerst dieselbe Schnittstelle wie
 * die Prüfung und legt die Quelle erst danach an (BR-173).
 *
 * Dieselbe Mutation trägt «Jetzt aktualisieren» und die geänderten
 * Einstellungen (A6): Der Abgleich ist idempotent, ein zweiter Aufruf
 * aktualisiert dieselben Beiträge.
 */
export function useConnectWebsite() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: ConnectInput): Promise<ImportResult> => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      const { data, error } = await supabase.functions.invoke<ImportResult>(
        'import-wordpress-news',
        {
          body: {
            clubId: activeClub.id,
            url: input.url,
            postLimit: input.postLimit,
            categories: input.categories,
          },
        },
      );
      if (error) throw new Error(await functionErrorMessage(error));
      if (!data) throw new Error('Der Abgleich lieferte keine Antwort.');
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['news-source', activeClub?.id] });
      await queryClient.invalidateQueries({ queryKey: ['news'] });
    },
  });
}

/**
 * Verbindung trennen (A4).
 *
 * Die bereits übernommenen Beiträge bleiben stehen – sie sind im Feed
 * verlinkt und teilweise gelesen. Getrennt wird die Zufuhr, nicht die
 * Vergangenheit.
 */
export function useDisconnectWebsite() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (sourceId: string): Promise<void> => {
      const { error } = await supabase.from('news_sources').delete().eq('id', sourceId);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['news-source', activeClub?.id] });
    },
  });
}

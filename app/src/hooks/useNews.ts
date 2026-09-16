import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import type { News, Notification } from '../lib/database.types';
import { useClub } from './useClub';
import { NEWS_ORIGINS, sourcesOf, type NewsDraft, type NewsOrigin } from '../lib/news';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { canShareNatively } from '../lib/invite';
import { Share } from '@capacitor/share';
import { useTranslation } from 'react-i18next';

/**
 * Der Feed – wahlweise nur die eine oder die andere Herkunft.
 *
 * Die Eingrenzung läuft in der **Abfrage**, nicht über dem Ergebnis: Die Liste
 * bricht nach `limit` Zeilen ab, und ein Verband, der wöchentlich schreibt,
 * füllt die längst (siehe `NewsOrigin`). Ein Filter über den bereits geholten
 * fünf Zeilen zeigte in genau dem Fall, der ihn nötig macht, nichts an.
 */
export function useNews(limit = 20, origin: NewsOrigin = 'all') {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['news', activeClub?.id, limit, origin],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<News[]> => {
      const sources = sourcesOf(origin);
      let query = supabase.from('news').select('*').eq('club_id', activeClub!.id);
      if (sources) query = query.in('source', sources);

      const { data, error } = await query
        .order('published_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/**
 * Wie viele Beiträge je Herkunft im Feed stehen.
 *
 * Die Wahl über dem Feed zeigt nur Herkünfte, die es wirklich gibt – ein
 * Verein ohne Verbandsverbindung soll keinen Schalter sehen, der nichts tut
 * (dasselbe Muster wie das Saison-Segment in `PointHistoryPage`). Ob eine
 * Verbindung besteht, steht in `federation_connections`; die liest die Policy
 * aus `0058` aber nur dem Vorstand vor. Gezählt wird deshalb hier, wo jedes
 * Mitglied lesen darf: eine `head`-Abfrage je Herkunft, ohne Nutzlast,
 * parallel.
 */
export function useNewsOrigins() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['news-origins', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<Record<Exclude<NewsOrigin, 'all'>, number>> => {
      const count = async (origin: NewsOrigin) => {
        const { count: rows, error } = await supabase
          .from('news')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', activeClub!.id)
          .in('source', sourcesOf(origin) ?? []);
        if (error) throw new Error(error.message);
        return rows ?? 0;
      };

      const counted = await Promise.all(NEWS_ORIGINS.map((entry) => count(entry)));
      return Object.fromEntries(
        NEWS_ORIGINS.map((entry, index) => [entry, counted[index]]),
      ) as Record<Exclude<NewsOrigin, 'all'>, number>;
    },
  });
}

/** Wie viele Beiträge die News-Seite je Nachladen holt. */
export const NEWS_PAGE_SIZE = 20;

/**
 * Der ganze Feed, seitenweise (UC-026, A5).
 *
 * Die Startseite zeigt fünf Karten; alles Ältere lag bisher unerreichbar
 * dahinter. Geblättert wird wie in der Punktehistorie: `range()` je Seite,
 * nachgeladen vom `IonInfiniteScroll`.
 *
 * Sortiert wird über zwei Schlüssel. Übernommene Beiträge tragen häufig
 * dieselbe Zeit – die Website-Beiträge dieses Vereins stehen zu dritt auf
 * derselben Minute –, und zwei Zeilen mit gleichem `published_at` sprängen
 * sonst zwischen zwei Seiten hin und her: einmal doppelt, einmal gar nicht.
 */
export function useAllNews(origin: NewsOrigin = 'all') {
  const { activeClub } = useClub();

  return useInfiniteQuery({
    queryKey: ['news-all', activeClub?.id, origin],
    enabled: Boolean(activeClub) && isConfigured,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<News[]> => {
      const sources = sourcesOf(origin);
      let query = supabase.from('news').select('*').eq('club_id', activeClub!.id);
      if (sources) query = query.in('source', sources);

      const { data, error } = await query
        .order('published_at', { ascending: false })
        .order('id', { ascending: false })
        .range(pageParam, pageParam + NEWS_PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    // Eine volle Seite verspricht eine nächste; eine kürzere war die letzte.
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < NEWS_PAGE_SIZE ? undefined : pages.length * NEWS_PAGE_SIZE,
  });
}

/**
 * Eine übernommene News weitergeben – über das Teilen-Blatt des Geräts, im
 * Browser als kopierter Link.
 *
 * Geteilt wird die **Quelle**, nicht die App: Der Verweis führt Aussenstehende
 * auf die Website des Vereins oder des Verbands. Ein Beitrag ohne
 * `external_url` – alles selbst Geschriebene und jeder Verbandsbeitrag, denn
 * Publishr liefert keine Adresse – lässt sich nicht teilen; die Karte bietet
 * den Knopf dann gar nicht erst an.
 *
 * Als Hook und nicht als Funktion, weil zwei Seiten denselben Weg brauchen
 * (Startseite und News-Seite) und beide Übersetzung und Meldung dazu.
 */
export function useShareNews() {
  const { t } = useTranslation();
  const toast = useToast();

  return async function shareNews(entry: News): Promise<void> {
    const url = entry.external_url;
    if (!url) return;
    if (canShareNatively()) {
      try {
        await Share.share({ title: entry.title, url });
        return;
      } catch {
        // Abbruch im Teilen-Dialog ist kein Fehler – dann bleibt Kopieren.
      }
    }
    await navigator.clipboard?.writeText(url);
    toast.success(t('news.linkCopied'));
  };
}

/**
 * In-App-Inbox. Sie ist der Fallback, der 100% der Mitglieder erreicht, auch
 * ohne Push-Erlaubnis (Architektur §3.3).
 */
export function useInbox() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['inbox', user?.id],
    enabled: Boolean(user) && isConfigured,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/**
 * Eine Benachrichtigung als gelesen markieren (FR-078).
 *
 * `read_at` besteht seit 0004; gesetzt hat es bisher niemand. Ohne diesen
 * Schritt bleibt die Inbox eine Liste, die nur wächst.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['inbox', user?.id] });
    },
  });
}

/**
 * Eine News schreiben (UC-026, Schritte 5–8).
 *
 * Anlegen, in die Inbox zustellen und als Verbindung zählen gehören zusammen –
 * deshalb **eine** Serverfunktion. Eine News, die im Feed steht und niemanden
 * erreicht hat, ist die halbe Nachricht; eine, die nicht gezählt wird, hilft
 * dem Verein bei der Verbindungs-Quote nicht (BR-111).
 */
export function usePublishNews() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (draft: NewsDraft): Promise<string> => {
      const { data, error } = await supabase.rpc('publish_news', {
        p_title: draft.title,
        p_body: draft.body,
        p_club_id: activeClub!.id,
        p_team_id: draft.teamId ?? undefined,
        p_image_url: draft.imageUrl || undefined,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['news', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['news-all', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['news-origins', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

/**
 * A3: eine publizierte News korrigieren.
 *
 * **Ohne** erneute Zustellung – gewöhnliches Update über die Policy, nicht
 * über `publish_news()`. Wer einen Tippfehler behebt, soll nicht den ganzen
 * Verein ein zweites Mal aufschrecken.
 */
export function useUpdateNews() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: { id: string; draft: NewsDraft }) => {
      const { error } = await supabase
        .from('news')
        .update({
          title: input.draft.title.trim(),
          body: input.draft.body.trim() || null,
          image_url: input.draft.imageUrl.trim() || null,
          team_id: input.draft.teamId,
        })
        .eq('id', input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['news', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['news-all', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['news-origins', activeClub?.id] });
    },
  });
}

/**
 * A4: eine News zurückziehen.
 *
 * Sie verschwindet aus dem Feed, der Eintrag in der Inbox bleibt. Eine
 * Nachricht, die rückwirkend verschwindet, wäre schlimmer als ein Verweis, der
 * ins Leere führt.
 */
export function useRetractNews() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (newsId: string) => {
      const { error } = await supabase.rpc('retract_news', { p_news_id: newsId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['news', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['news-all', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['news-origins', activeClub?.id] });
    },
  });
}

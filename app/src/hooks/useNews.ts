import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import type { News, Notification } from '../lib/database.types';
import { useClub } from './useClub';
import type { NewsDraft } from '../lib/news';
import { useAuth } from './useAuth';

export function useNews(limit = 20) {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['news', activeClub?.id, limit],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<News[]> => {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('club_id', activeClub!.id)
        .order('published_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
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
    },
  });
}

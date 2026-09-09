import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import type { News, Notification } from '../lib/database.types';
import { useClub } from './useClub';
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

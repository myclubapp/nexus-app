import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { PushPlatform } from '../lib/push';
import {
  EMPTY_SETTINGS,
  toEmailMode,
  type NotificationSettings,
  type PushCategory,
} from '../lib/notifications';
import { toLanguage } from './useLocaleSync';
import i18n from '../i18n';

/**
 * Die Benachrichtigungs-Einstellungen des Kontos (UC-028).
 *
 * Sie hängen am **Konto** und nicht an der Mitgliedschaft: Wer in zwei
 * Vereinen ist, hat eine Einstellung. Zwei Matrizen für dieselbe Person wären
 * mehr Last als Nutzen.
 */
export function useNotificationSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notification-settings', user?.id],
    enabled: Boolean(user) && isConfigured,
    queryFn: async (): Promise<NotificationSettings> => {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('push, quiet_from, quiet_to, email, email_mode')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return EMPTY_SETTINGS;

      return {
        push: (data.push ?? {}) as Partial<Record<PushCategory, boolean>>,
        email: (data.email ?? {}) as Partial<Record<PushCategory, boolean>>,
        emailMode: toEmailMode(data.email_mode),
        quietFrom: data.quiet_from,
        quietTo: data.quiet_to,
      };
    },
  });
}

/**
 * Einstellungen speichern (Schritte 4–6).
 *
 * Die Matrix wird **vollständig** übergeben. Der Server liesse `null` als
 * «unverändert» zu, aber eine Oberfläche, die einen Teilstand schickt, kann
 * einen Zustand herbeiführen, den niemand gewählt hat.
 */
export function useSaveNotificationSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (settings: NotificationSettings) => {
      const { error } = await supabase.rpc('set_notification_settings', {
        p_push: settings.push,
        p_quiet_from: settings.quietFrom ?? undefined,
        p_quiet_to: settings.quietTo ?? undefined,
        p_email: settings.email,
        p_email_mode: settings.emailMode,
        // UC-044: Die Sprache der Oberfläche fährt mit – die Mail soll in
        // ihr geschrieben sein.
        p_locale: toLanguage(i18n.language),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['notification-settings', user?.id],
      });
    },
  });
}

export interface PushDevice {
  id: string;
  platform: PushPlatform;
  createdAt: string;
}

/** Die registrierten Geräte (A4). */
export function usePushDevices() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['push-devices', user?.id],
    enabled: Boolean(user) && isConfigured,
    queryFn: async (): Promise<PushDevice[]> => {
      const { data, error } = await supabase
        .from('push_tokens')
        .select('id, platform, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        platform: row.platform as PushPlatform,
        createdAt: row.created_at,
      }));
    },
  });
}

/** A4: ein Gerät abmelden. */
export function useForgetDevice() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase.rpc('forget_device', { p_token_id: tokenId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['push-devices', user?.id] });
    },
  });
}

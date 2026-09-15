import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { env } from '../lib/env';
import { useAuth } from './useAuth';
import {
  pushChannel,
  pushReadiness,
  subscriptionToken,
  type PushChannel,
  type PushReadiness,
} from '../lib/push';
import { registerNativePush } from '../lib/nativePush';

/** Der Weg, den dieses Gerät nimmt (UC-052). */
export function readPushChannel(): PushChannel {
  return pushChannel({
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
    hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    hasPushManager: typeof window !== 'undefined' && 'PushManager' in window,
  });
}

/**
 * Wie weit dieses Gerät für Push bereit ist (UC-028, A1 und A2).
 *
 * Keine Abfrage, sondern eine Frage an das Gerät – sie hat kein Ergebnis, das
 * veralten könnte, und gehört deshalb nicht in den Query-Cache.
 *
 * **Auf dem Apple-Weg bleibt die Erlaubnis hier unbekannt.** Das Plugin
 * beantwortet sie nur asynchron (`checkPermissions()`), und diese Funktion ist
 * bewusst synchron. Der Preis ist gering: Wer Push im Betriebssystem
 * abgelehnt hat, bekommt beim Tippen auf «Gerät anmelden» sofort die Antwort
 * aus A2 – statt sie schon vorher zu lesen.
 */
export function readPushReadiness(): PushReadiness {
  const channel = readPushChannel();

  return pushReadiness({
    channel,
    permission:
      channel === 'webpush' && typeof Notification !== 'undefined'
        ? Notification.permission
        : null,
    vapidKey: env.vapidPublicKey,
  });
}

/**
 * A1: Das Gerät anmelden.
 *
 * Drei Schritte, die voneinander abhängen: Erlaubnis holen, beim Browser
 * abonnieren, die Anmeldung speichern. Bricht einer ab, entsteht nichts
 * Halbes – deshalb nacheinander und nicht nebeneinander.
 *
 * **A2 ist kein Fehlerfall, sondern eine Antwort.** Wird die Erlaubnis
 * verweigert, bleibt die Inbox vollständig (BR-117); die Ansicht sagt das,
 * statt eine Fehlermeldung zu zeigen.
 */
export function useRegisterPush() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (): Promise<'registered' | 'denied'> => {
      if (!user) throw new Error('Nicht angemeldet');
      const channel = readPushChannel();
      if (readPushReadiness() !== 'ready') {
        throw new Error('Dieses Gerät kann keine Push-Nachrichten empfangen');
      }

      // Der Apple-Weg: Das Betriebssystem fragt, Apple antwortet mit einem
      // Token. Kein Service Worker, kein VAPID-Schlüssel (UC-052).
      if (channel === 'ios_apns') {
        const result = await registerNativePush();
        if (result.status === 'denied') return 'denied';

        const { error } = await supabase.from('push_tokens').upsert(
          {
            user_id: user.id,
            token: result.token,
            platform: 'ios_apns',
          },
          { onConflict: 'token' },
        );
        if (error) throw new Error(error.message);

        return 'registered';
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return 'denied';

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: env.vapidPublicKey,
        }));

      // `token` ist `unique`: Derselbe Browser meldet sich nicht zweimal an,
      // er erneuert seine Zeile.
      const { error } = await supabase.from('push_tokens').upsert(
        {
          user_id: user.id,
          token: subscriptionToken(subscription.toJSON()),
          platform: 'webpush',
        },
        { onConflict: 'token' },
      );
      if (error) throw new Error(error.message);

      return 'registered';
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['push-devices', user?.id] });
    },
  });
}

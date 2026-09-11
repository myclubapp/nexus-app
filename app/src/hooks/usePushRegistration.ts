import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { env } from '../lib/env';
import { useAuth } from './useAuth';
import { pushReadiness, subscriptionToken, type PushReadiness } from '../lib/push';

/**
 * Wie weit dieses Gerät für Push bereit ist (UC-028, A1 und A2).
 *
 * Keine Abfrage, sondern eine Frage an den Browser – sie hat kein Ergebnis,
 * das veralten könnte, und gehört deshalb nicht in den Query-Cache.
 */
export function readPushReadiness(): PushReadiness {
  const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const hasPushManager = typeof window !== 'undefined' && 'PushManager' in window;
  const permission =
    typeof Notification !== 'undefined' ? Notification.permission : null;

  return pushReadiness({
    hasServiceWorker,
    hasPushManager,
    permission,
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
      if (readPushReadiness() !== 'ready') {
        throw new Error('Dieses Gerät kann keine Push-Nachrichten empfangen');
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

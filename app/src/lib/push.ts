/**
 * Push-Registrierung (UC-028, A1 und A2).
 *
 * **Der Transport fehlt weiterhin** – es gibt keinen Versanddienst, der
 * `notifications.push_wanted` abholt (FR-079). Was hier entsteht, ist die
 * Hälfte, die ohne ihn schon Sinn ergibt und ohne die er nichts ausrichten
 * könnte: die **Anmeldung des Geräts**. Bis heute konnte die App registrierte
 * Geräte auflisten und abmelden – registrieren konnte sie keines.
 *
 * **Kein Google** (CLAUDE.md): Der Weg hier ist Web Push mit VAPID, also der
 * Standard des Browsers. FCM kommt nicht vor; auf Android läuft derselbe Weg
 * über UnifiedPush/ntfy, auf iOS über APNs – beides sind native Kanäle und
 * gehören zu `cap sync`, nicht hierher.
 */

/** Die Kanäle, die `push_tokens.platform` kennt (Constraint aus `0004`). */
export const PUSH_PLATFORMS = ['webpush', 'ios_apns', 'android_ntfy'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

/**
 * Der VAPID-Schlüssel kommt als base64url und muss als Bytefolge an
 * `pushManager.subscribe()`.
 *
 * Eigene Funktion und keine Zeile im Hook: Sie ist die einzige Stelle, an der
 * ein Tippfehler im Schlüssel zu einer unverständlichen Ausnahme des Browsers
 * führt – hier lässt sie sich prüfen.
 */
export function vapidKeyToBytes(base64Url: string): Uint8Array {
  const padded = base64Url.trim().replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (padded.length % 4)) % 4);
  const raw = atob(padded + padding);

  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type PushReadiness =
  | 'ready'
  /** Der Browser kennt keine Push-Schnittstelle – etwa iOS-Safari ohne PWA. */
  | 'unsupported'
  /** Es ist kein VAPID-Schlüssel hinterlegt; ohne ihn gibt es nichts zu abonnieren. */
  | 'notConfigured'
  /** Die Person hat Push abgelehnt (A2). */
  | 'denied';

/**
 * Kann dieses Gerät überhaupt angemeldet werden?
 *
 * Die Frage steht als reine Funktion, weil die Antwort vier verschiedene Sätze
 * auf dem Bildschirm ergibt – und weil sich `Notification.permission` in jsdom
 * nicht bedienen lässt (docs/TESTING.md §6.4).
 */
export function pushReadiness(input: {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  permission: NotificationPermission | null;
  vapidKey: string;
}): PushReadiness {
  if (!input.hasServiceWorker || !input.hasPushManager) return 'unsupported';
  if (input.vapidKey.trim() === '') return 'notConfigured';
  if (input.permission === 'denied') return 'denied';
  return 'ready';
}

/**
 * Der Endpunkt einer Anmeldung ist ihre Kennung.
 *
 * `push_tokens.token` ist `unique`; zwei Anmeldungen desselben Browsers tragen
 * denselben Endpunkt und dürfen deshalb keine zweite Zeile erzeugen. Die
 * vollständige Anmeldung – Endpunkt **und** Schlüssel – gehört in dieselbe
 * Zeile, weil der Versand beides braucht.
 */
export function subscriptionToken(subscription: PushSubscriptionJSON): string {
  return JSON.stringify({
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  });
}

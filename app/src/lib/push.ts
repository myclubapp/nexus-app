/**
 * Push-Registrierung (UC-028, A1 und A2; seit UC-052 auch der Apple-Weg).
 *
 * **Kein Google** (CLAUDE.md): Im Browser und in der PWA läuft Push über
 * VAPID, den Standard des Browsers – der Push-Dienst transportiert einen
 * Umschlag, den nur das Gerät öffnen kann. In der iOS-App läuft er über APNs,
 * weil es dort keinen zweiten Weg gibt. FCM kommt in keinem der beiden vor.
 *
 * **Android nativ bleibt vorerst aussen vor.** `push_tokens` kennt den Kanal
 * `android_ntfy` seit `0004`, aber es gibt keinen betriebenen ntfy-Dienst –
 * und ein Kanal ohne Dienst ist ein Knopf, der nichts tut. Die Android-App
 * verweist deshalb auf die Inbox (BR-117), und wer dort Push will, installiert
 * die PWA. Sobald ein ntfy-Dienst steht, kommt der Kanal hier dazu.
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

/**
 * Auf welchem Weg dieses Gerät Push empfängt.
 *
 * Die Entscheidung fällt **vor** der Frage nach der Erlaubnis, weil sie über
 * zwei völlig verschiedene Abläufe entscheidet: Der Browser braucht einen
 * Service Worker, ein Abonnement und den VAPID-Schlüssel; die iOS-App braucht
 * nichts davon, sondern das Plugin und ein Token von Apple.
 */
export type PushChannel = 'webpush' | 'ios_apns' | 'unsupported';

export function pushChannel(input: {
  isNative: boolean;
  /** `Capacitor.getPlatform()`: 'ios', 'android' oder 'web'. */
  platform: string;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
}): PushChannel {
  // In der nativen App entscheidet das Betriebssystem, nicht der WebView: Ein
  // `PushManager` im WKWebView wäre wirkungslos, und auf Android fehlt der
  // Dienst (siehe oben).
  if (input.isNative) return input.platform === 'ios' ? 'ios_apns' : 'unsupported';

  return input.hasServiceWorker && input.hasPushManager ? 'webpush' : 'unsupported';
}

export type PushReadiness =
  | 'ready'
  /** Kein Weg auf diesem Gerät – iOS-Safari ohne PWA, die Android-App. */
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
  channel: PushChannel;
  permission: NotificationPermission | null;
  vapidKey: string;
}): PushReadiness {
  if (input.channel === 'unsupported') return 'unsupported';
  // Der Schlüssel betrifft allein den Browser-Weg. Für APNs wäre
  // «noch nicht eingerichtet» die falsche Auskunft: Dort hängt nichts an einer
  // Variablen der App, sondern am Schlüssel des Versanddienstes.
  if (input.channel === 'webpush' && input.vapidKey.trim() === '') return 'notConfigured';
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

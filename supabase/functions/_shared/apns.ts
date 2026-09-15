/**
 * APNs – der Weg auf ein iPhone, das die App aus dem Store hat.
 *
 * **Warum überhaupt Apple?** Weil es auf iOS keinen zweiten Weg gibt: Ein
 * natives iOS-Programm empfängt Push ausschliesslich über Apples Dienst. Das
 * ist der eine Punkt, an dem die Architektur (§3.3) eine fremde Infrastruktur
 * hinnimmt – und der Grund, warum sie überall sonst keine braucht: Android
 * läuft über ntfy, der Browser über Web Push, beide ohne Google.
 *
 * **Token statt Zertifikat.** Der Nachweis ist ein JWT, signiert mit einem
 * `.p8`-Schlüssel aus dem Developer-Portal. Er gilt teamweit, für alle Apps,
 * und läuft nicht ab – ein Zertifikat müsste jedes Jahr erneuert werden, und
 * der Tag, an dem es abläuft, ist erfahrungsgemäss der Tag, an dem niemand
 * daran denkt.
 */

const encoder = new TextEncoder();

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  /** Der Inhalt der `.p8`-Datei, PEM. */
  privateKey: string;
  /** Die Bundle-ID – `apns-topic`. */
  topic: string;
}

export interface ApnsResult {
  ok: boolean;
  /** Das Gerät kennt die App nicht mehr – die Zeile gehört gelöscht (BR-269). */
  gone: boolean;
  status: number;
  reason?: string;
  /**
   * Was der Versand über dieses Gerät gelernt hat: an welchem Tor sein Token
   * gilt. Nur gesetzt, wenn es vorher unbekannt war.
   */
  learnedEnvironment?: 'sandbox' | 'production';
}

export type ApnsEnvironment = 'sandbox' | 'production';

const HOSTS: Record<ApnsEnvironment, string> = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
};

/**
 * Liest den Zugang aus den Secrets; nennt die **erste fehlende** Variable.
 * Form wie `readSmtpConfig()` und `readVapidKeys()`.
 */
export function readApnsConfig(): ApnsConfig | string {
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const privateKey = Deno.env.get('APNS_KEY_P8');
  if (!keyId) return 'Secret APNS_KEY_ID fehlt';
  if (!teamId) return 'Secret APNS_TEAM_ID fehlt';
  if (!privateKey) return 'Secret APNS_KEY_P8 fehlt';

  return {
    keyId,
    teamId,
    privateKey,
    topic: Deno.env.get('APNS_TOPIC') || 'ch.myclub.nexus.app',
  };
}

/**
 * Der `.p8`-Schlüssel als Signierschlüssel.
 *
 * Der Inhalt darf mit echten Zeilenumbrüchen **oder** mit `\n` als zwei
 * Zeichen ankommen: `supabase secrets set` aus einer Datei liefert das eine,
 * ein Wert aus der Weboberfläche gern das andere.
 */
async function importP8(pem: string): Promise<CryptoKey> {
  const base64 = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  const raw = atob(base64);
  const der = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) der[i] = raw.charCodeAt(i);

  return await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Der Nachweis, höchstens alle 30 Minuten neu.
 *
 * Apple verlangt beides: Ein Nachweis, der älter als eine Stunde ist, wird mit
 * `ExpiredProviderToken` abgewiesen – und wer ihn **öfter als alle 20 Minuten**
 * erneuert, mit `TooManyProviderTokenUpdates`. Dazwischen liegt das Fenster,
 * und 30 Minuten liegen in seiner Mitte.
 */
let cachedToken: { token: string; issued: number } | null = null;

async function providerToken(config: ApnsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now - cachedToken.issued < 30 * 60) return cachedToken.token;

  const header = bytesToBase64Url(
    encoder.encode(JSON.stringify({ alg: 'ES256', kid: config.keyId })),
  );
  const payload = bytesToBase64Url(
    encoder.encode(JSON.stringify({ iss: config.teamId, iat: now })),
  );
  const data = `${header}.${payload}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    await importP8(config.privateKey),
    encoder.encode(data),
  );

  const token = `${data}.${bytesToBase64Url(new Uint8Array(signature))}`;
  cachedToken = { token, issued: now };
  return token;
}

export interface ApnsMessage {
  title: string;
  body?: string | null;
  /** Wohin das Antippen führt – die App liest es aus den Zusatzdaten. */
  link?: string | null;
  category?: string | null;
  badge?: number | null;
}

async function postOnce(
  host: string,
  deviceToken: string,
  message: ApnsMessage,
  config: ApnsConfig,
): Promise<{ status: number; reason?: string }> {
  const response = await fetch(`${host}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${await providerToken(config)}`,
      'apns-topic': config.topic,
      'apns-push-type': 'alert',
      // 10 heisst «sofort zustellen» und ist für eine sichtbare Meldung der
      // vorgesehene Wert; 5 gilt stillen Meldungen, die es hier nicht gibt.
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 86400),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      aps: {
        alert: { title: message.title, body: message.body ?? undefined },
        sound: 'default',
        ...(message.badge === null || message.badge === undefined
          ? {}
          : { badge: message.badge }),
      },
      // Zusatzdaten neben `aps`: Sie kommen im `pushNotificationActionPerformed`
      // der App an und führen das Antippen an die richtige Stelle.
      link: message.link ?? undefined,
      category: message.category ?? undefined,
    }),
  });

  if (response.ok) {
    await response.body?.cancel();
    return { status: response.status };
  }

  const text = await response.text();
  let reason = text.slice(0, 300);
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.reason === 'string') reason = parsed.reason;
  } catch {
    // Kein JSON – dann steht der Rohtext da, und das ist besser als nichts.
  }
  return { status: response.status, reason };
}

/**
 * Eine Meldung an ein Apple-Gerät.
 *
 * **Die Umgebung ist geraten, bis sie feststeht.** Ist `environment` leer,
 * geht der erste Versuch an die Produktion; antwortet Apple mit
 * `BadDeviceToken`, war es ein Token aus einem Xcode-Build, und der zweite
 * Versuch geht an die Sandbox. Was funktioniert hat, gibt die Funktion als
 * `learnedEnvironment` zurück – der Aufrufer schreibt es an die Zeile, und ab
 * dann gibt es nur noch einen Versuch.
 *
 * `BadDeviceToken` heisst deshalb **nicht** «Gerät weg»: Dasselbe Token ist am
 * anderen Tor gültig. Weg ist ein Gerät nur bei `410 Unregistered`.
 */
export async function sendApns(
  deviceToken: string,
  environment: ApnsEnvironment | null,
  message: ApnsMessage,
  config: ApnsConfig,
): Promise<ApnsResult> {
  const order: ApnsEnvironment[] = environment ? [environment] : ['production', 'sandbox'];

  let last = { status: 0, reason: 'Kein Versuch' } as { status: number; reason?: string };

  for (const candidate of order) {
    last = await postOnce(HOSTS[candidate], deviceToken, message, config);

    if (last.status === 200) {
      return {
        ok: true,
        gone: false,
        status: 200,
        ...(environment ? {} : { learnedEnvironment: candidate }),
      };
    }

    // Am falschen Tor: weitersuchen, solange ein Tor übrig ist.
    if (last.reason === 'BadDeviceToken' && !environment) continue;

    return {
      ok: false,
      gone: last.status === 410 || last.reason === 'Unregistered',
      status: last.status,
      reason: last.reason,
    };
  }

  return {
    ok: false,
    // Beide Tore lehnen das Token ab – dann ist es wirklich keines mehr.
    gone: true,
    status: last.status,
    reason: last.reason,
  };
}

/**
 * Web Push nach RFC 8291 – der Weg in die PWA und in jeden Browser.
 *
 * **Von Hand und ohne Paket.** Web Push ist zwei Dinge: ein signierter
 * Nachweis, dass der Absender der ist, dessen Schlüssel im Abonnement steht
 * (VAPID, RFC 8292), und ein Umschlag, den nur das Gerät öffnen kann
 * (`aes128gcm`, RFC 8188/8291). Beides beherrscht die Web-Crypto-Schnittstelle
 * der Deno-Laufzeit; die üblichen Pakete bringen dafür Node-Kryptografie mit,
 * die hier nicht läuft. Die rund hundert Zeilen unten sind der ganze Umfang.
 *
 * **Der Dienst erfährt den Inhalt nicht.** Die Meldung wird mit einem
 * Schlüssel verschlüsselt, der aus dem öffentlichen Schlüssel des Geräts und
 * einem Zufallsschlüssel dieses Versands entsteht; der Push-Dienst von Mozilla,
 * Apple oder Microsoft transportiert nur den Umschlag. Das ist der Grund,
 * warum dieser Weg auch ohne Google auskommt – es gibt keinen Mittelsmann, der
 * mitlesen könnte, also auch keinen, dem man vertrauen müsste.
 */

const encoder = new TextEncoder();

/** Der Inhalt von `push_tokens.token` für `platform = 'webpush'`. */
export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface VapidKeys {
  /** base64url, der unkomprimierte Punkt (65 Byte) – derselbe wie in der App. */
  publicKey: string;
  /** base64url, der private Skalar (32 Byte). Nur hier, nie in der App. */
  privateKey: string;
  /** `mailto:` oder `https:` – wen der Push-Dienst bei Problemen erreicht. */
  subject: string;
}

export interface WebPushResult {
  ok: boolean;
  /** Das Abonnement gibt es nicht mehr – die Zeile gehört gelöscht (BR-269). */
  gone: boolean;
  status: number;
  reason?: string;
}

/**
 * Liest die Schlüssel aus den Secrets; nennt die **erste fehlende** Variable.
 *
 * Gibt eine Zeichenkette zurück statt zu werfen – dieselbe Form wie
 * `readSmtpConfig()`: Der Aufrufer sagt damit, was fehlt, statt still nichts
 * zu tun.
 */
export function readVapidKeys(): VapidKeys | string {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!publicKey) return 'Secret VAPID_PUBLIC_KEY fehlt';
  if (!privateKey) return 'Secret VAPID_PRIVATE_KEY fehlt';

  return {
    publicKey,
    privateKey,
    subject: Deno.env.get('VAPID_SUBJECT') || 'mailto:support@my-club.ch',
  };
}

export function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/**
 * HKDF in einem Zug: Extract mit `salt`, Expand mit `info`.
 *
 * Web Crypto kennt keine getrennten Schritte – `deriveBits` macht beide. Das
 * passt, weil RFC 8291 sie auch nur in dieser Kombination braucht.
 */
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Der private VAPID-Schlüssel als Signierschlüssel.
 *
 * Web Crypto nimmt einen rohen privaten Skalar nicht an – es braucht das
 * ganze JWK samt Punkt. Den liefert der **öffentliche** Schlüssel: Byte 1–32
 * sind x, Byte 33–64 sind y (Byte 0 ist die 0x04 des unkomprimierten Punkts).
 */
async function importSigningKey(keys: VapidKeys): Promise<CryptoKey> {
  const publicKey = base64UrlToBytes(keys.publicKey);
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) {
    throw new Error(
      'VAPID_PUBLIC_KEY ist kein unkomprimierter P-256-Punkt (65 Byte, beginnend mit 0x04)',
    );
  }

  return await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: bytesToBase64Url(publicKey.slice(1, 33)),
      y: bytesToBase64Url(publicKey.slice(33, 65)),
      d: bytesToBase64Url(base64UrlToBytes(keys.privateKey)),
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

/**
 * Der VAPID-Nachweis, je Push-Dienst einer.
 *
 * `aud` ist die Herkunft des Endpunkts – ein Nachweis für Mozilla taugt nicht
 * für Apple. Gültig zwölf Stunden; innerhalb eines Laufs wird er
 * wiederverwendet, weil ein Lauf hundert Geräte an denselben Dienst bedienen
 * kann und jede Signatur Rechenzeit kostet.
 */
const vapidTokens = new Map<string, { token: string; expires: number }>();

async function vapidToken(origin: string, keys: VapidKeys): Promise<string> {
  const cached = vapidTokens.get(origin);
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expires - 300 > now) return cached.token;

  const expires = now + 12 * 60 * 60;
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = bytesToBase64Url(
    encoder.encode(JSON.stringify({ aud: origin, exp: expires, sub: keys.subject })),
  );
  const data = `${header}.${payload}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    await importSigningKey(keys),
    encoder.encode(data),
  );

  const token = `${data}.${bytesToBase64Url(new Uint8Array(signature))}`;
  vapidTokens.set(origin, { token, expires });
  return token;
}

/**
 * Der Umschlag (RFC 8188, Inhaltskodierung `aes128gcm`).
 *
 * Der Aufbau ist festgelegt und nicht verhandelbar:
 *
 *     salt (16) | rs (4) | idlen (1) | Zufallsschlüssel (65) | Geheimtext
 *
 * Die 0x02 am Ende des Klartexts ist das Ende-Zeichen des **letzten**
 * Datensatzes. Ohne sie verwirft der Browser die Nachricht wortlos – der
 * Versand meldet 201, und angezeigt wird nichts.
 */
const RECORD_SIZE = 4096;

async function encryptPayload(
  subscription: WebPushSubscription,
  payload: string,
): Promise<Uint8Array> {
  const uaPublic = base64UrlToBytes(subscription.keys.p256dh);
  const authSecret = base64UrlToBytes(subscription.keys.auth);

  const ephemeral = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));

  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: await crypto.subtle.importKey(
          'raw',
          uaPublic,
          { name: 'ECDH', namedCurve: 'P-256' },
          false,
          [],
        ),
      },
      ephemeral.privateKey,
      256,
    ),
  );

  // RFC 8291 §3.3: Aus dem gemeinsamen Geheimnis und dem Auth-Geheimnis des
  // Geräts wird das Ausgangsmaterial – die Reihenfolge der beiden Punkte ist
  // vorgeschrieben (erst das Gerät, dann der Absender).
  const ikm = await hkdf(
    authSecret,
    shared,
    concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic),
    32,
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentKey = await hkdf(
    salt,
    ikm,
    encoder.encode('Content-Encoding: aes128gcm\0'),
    16,
  );
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);

  const plaintext = concat(encoder.encode(payload), new Uint8Array([0x02]));
  if (plaintext.length + 16 > RECORD_SIZE) {
    throw new Error('Die Meldung ist zu lang für einen Datensatz');
  }

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']),
      plaintext,
    ),
  );

  const head = new Uint8Array(21 + asPublic.length);
  head.set(salt, 0);
  new DataView(head.buffer).setUint32(16, RECORD_SIZE);
  head[20] = asPublic.length;
  head.set(asPublic, 21);

  return concat(head, ciphertext);
}

/**
 * Eine Meldung an ein Gerät.
 *
 * `404` und `410` heissen: Das Abonnement gibt es nicht mehr. Alles andere ist
 * ein Fehlschlag, der sich wiederholen lässt.
 */
export async function sendWebPush(
  subscription: WebPushSubscription,
  payload: string,
  keys: VapidKeys,
  options: { ttlSeconds?: number } = {},
): Promise<WebPushResult> {
  let origin: string;
  try {
    origin = new URL(subscription.endpoint).origin;
  } catch {
    return { ok: false, gone: true, status: 0, reason: 'Unbrauchbarer Endpunkt' };
  }

  const body = await encryptPayload(subscription, payload);

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${await vapidToken(origin, keys)}, k=${keys.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      // Einen Tag aufheben, falls das Gerät aus ist. Länger nicht: Was zwei
      // Tage alt ist, liest man in der Inbox, nicht als Push.
      TTL: String(options.ttlSeconds ?? 86400),
      // `normal` ist die Vorgabe des Standards und die richtige Antwort: Der
      // Dienst darf die Meldung zurückhalten, bis das Gerät ohnehin wach ist.
      // `high` gehört Meldungen, die eine Handlung erzwingen – die gibt es hier
      // nicht, und die Dringlichkeit entscheidet ohnehin die Person selbst
      // (Kategorien und stille Zeit).
      Urgency: 'normal',
    },
    body,
  });

  if (response.ok) {
    // Der Körper interessiert nicht, muss aber gelesen werden, sonst bleibt
    // die Verbindung in der Laufzeit offen.
    await response.body?.cancel();
    return { ok: true, gone: false, status: response.status };
  }

  const reason = (await response.text()).slice(0, 300);
  return {
    ok: false,
    gone: response.status === 404 || response.status === 410,
    status: response.status,
    reason: reason || `HTTP ${response.status}`,
  };
}

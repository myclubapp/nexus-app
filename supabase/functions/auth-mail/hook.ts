/**
 * Der Hook selbst: Signatur und Bestätigungsadresse (UC-048).
 *
 * Eigenes Modul, damit beides unter `deno test` läuft – `index.ts` ruft auf
 * oberster Ebene `Deno.serve()` auf und würde beim Import einen Server öffnen.
 */

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Zeitkonstanter Vergleich – ein früher Abbruch verrät die Signatur. */
function equals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

/**
 * Prüft die Signatur nach «Standard Webhooks», wie Supabase sie schickt.
 *
 * Signiert wird `id.timestamp.body`; das Secret steht als
 * `v1,whsec_<base64>` im Secret. Das Kopffeld kann mehrere durch Leerzeichen
 * getrennte Signaturen tragen (Schlüsselwechsel) – eine muss passen.
 *
 * Der Zeitstempel wird mitgeprüft: Ohne ihn liesse sich eine einmal
 * abgefangene Mailanforderung beliebig oft wiederholen.
 */
export async function verifySignature(
  secret: string,
  headers: Headers,
  body: string,
  now: Date = new Date(),
): Promise<string | null> {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signature = headers.get('webhook-signature');
  if (!id || !timestamp || !signature) return 'Signaturfelder fehlen';

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return 'Zeitstempel ist keine Zahl';
  if (Math.abs(now.getTime() / 1000 - seconds) > 300) return 'Zeitstempel zu alt';

  const raw = secret.replace(/^v1,whsec_/, '').replace(/^whsec_/, '');
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(raw);
  } catch {
    return 'Secret ist kein Base64';
  }

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  const expected = bytesToBase64(new Uint8Array(mac));

  const offered = signature.split(' ').map((part) => part.replace(/^v1,/, ''));
  return offered.some((candidate) => equals(candidate, expected)) ? null : 'Signatur stimmt nicht';
}

/**
 * Die Adresse hinter der Schaltfläche.
 *
 * GoTrue baut sie sonst selbst aus `{{ .ConfirmationURL }}`; hier entsteht sie
 * aus denselben Teilen: der Prüfendpunkt des Projekts, der Token-Hash, der
 * Anlass und das Ziel, das GoTrue bereits gegen die Erlaubnisliste geprüft hat.
 */
export function confirmUrl(
  supabaseUrl: string,
  tokenHash: string,
  action: string,
  redirectTo: string | null,
): string {
  const url = new URL('/auth/v1/verify', supabaseUrl);
  url.searchParams.set('token', tokenHash);
  url.searchParams.set('type', action);
  if (redirectTo) url.searchParams.set('redirect_to', redirectTo);
  return url.toString();
}

/**
 * Die Adresse zum Kopieren – derselbe Anmeldelink, nur ohne Gerätebindung.
 *
 * `confirmUrl()` oben zeigt auf den Prüfendpunkt von GoTrue. Der prüft den
 * Token und schickt danach einen **PKCE-Code** an das Ziel, das die App bei
 * der Anfrage genannt hat. Einlösen lässt sich der Code nur dort, wo der
 * Verifier liegt: im Browser, der die Anmeldung gestartet hat, oder in der
 * App hinter `ch.myclub.nexus://`. Kopiert man die Adresse in einen anderen
 * Browser oder auf ein anderes Gerät, scheitert der Tausch wortlos – genau
 * das, was eine kopierbare Adresse können müsste.
 *
 * Diese hier geht den anderen Weg: Sie trägt den Token-Hash an `/auth/verify`
 * in der App, und die löst ihn über `verifyOtp()` selbst ein. Dieser Weg
 * kennt kein PKCE, braucht keinen Verifier und wirkt deshalb in jedem
 * Browser.
 *
 * Ohne `APP_URL` gibt es sie nicht; die Mail trägt dann nur die Schaltfläche.
 */
export function verifyLink(
  appUrl: string | null | undefined,
  tokenHash: string,
  action: string,
): string | null {
  if (!appUrl) return null;
  let url: URL;
  try {
    // Absolut gesetzt: Ein Pfad in `APP_URL` gehört nicht in die Adresse.
    url = new URL('/auth/verify', appUrl);
  } catch {
    return null;
  }
  // Dieselbe Schranke wie in `safeUrl()`: Ein Anmeldelink ohne TLS wäre einer
  // zum Mitlesen.
  if (url.protocol !== 'https:') return null;
  url.searchParams.set('token_hash', tokenHash);
  url.searchParams.set('type', action);
  return url.toString();
}

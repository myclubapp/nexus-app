/**
 * Firestore lesen – ohne Firebase-SDK.
 *
 * Das Projekt kennt keinen Google-Stack (CLAUDE.md); die Übernahme aus der
 * alten App ist die eine Stelle, die Google **lesen** muss, und dafür genügt
 * die REST-Schnittstelle plus ein selbst signiertes Service-Konto-Token. Kein
 * Paket, keine Abhängigkeit, die nach dem Wechsel übrig bliebe.
 *
 * BR-185: Das Service-Konto kommt aus dem Secret `FIREBASE_SERVICE_ACCOUNT`
 * der Edge Function. Es verlässt den Server nie.
 */
import type { LegacyDoc } from './mapping.ts';

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const FETCH_TIMEOUT_MS = 20_000;
const SCOPE = 'https://www.googleapis.com/auth/datastore';

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Ein Zugriffstoken für das Service-Konto (RS256-JWT gegen OAuth 2.0). */
export async function accessToken(account: ServiceAccount): Promise<string> {
  const pem = account.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const tokenUri = account.token_uri ?? 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.` +
    base64url(JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }));
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64url(signature)}`;

  const response = await fetchWithTimeout(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.access_token !== 'string') {
    throw new Error(`Google verweigert das Token (${response.status})`);
  }
  return body.access_token;
}

/** Ein Firestore-Wert als einfacher Wert. */
function plain(value: unknown): unknown {
  const field = value as Record<string, unknown>;
  if (!field || typeof field !== 'object') return null;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return field.doubleValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('timestampValue' in field) return field.timestampValue;
  if ('nullValue' in field) return null;
  if ('mapValue' in field) {
    const fields = (field.mapValue as { fields?: Record<string, unknown> })?.fields ?? {};
    return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, plain(v)]));
  }
  if ('arrayValue' in field) {
    return ((field.arrayValue as { values?: unknown[] })?.values ?? []).map(plain);
  }
  return null;
}

export function flatten(document: { name: string; fields?: Record<string, unknown> }): LegacyDoc {
  const doc: LegacyDoc = { id: document.name.split('/').pop() ?? '' };
  for (const [key, value] of Object.entries(document.fields ?? {})) {
    if (key === 'id') continue; // Die alte App speichert ein leeres `id`-Feld; der Pfad zählt.
    doc[key] = plain(value);
  }
  return doc;
}

export class FirestoreReader {
  private readonly base: string;

  constructor(private readonly account: ServiceAccount, private readonly token: string) {
    this.base = `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents`;
  }

  static async open(account: ServiceAccount): Promise<FirestoreReader> {
    return new FirestoreReader(account, await accessToken(account));
  }

  private async get(path: string): Promise<Record<string, unknown>> {
    const response = await fetchWithTimeout(`${this.base}/${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (response.status === 404) return {};
    if (!response.ok) throw new Error(`Firestore antwortet mit ${response.status}`);
    return await response.json();
  }

  /** Ein einzelnes Dokument, oder `null`, wenn es fehlt. */
  async document(path: string): Promise<LegacyDoc | null> {
    const body = await this.get(path);
    if (typeof body.name !== 'string') return null;
    return flatten(body as { name: string; fields?: Record<string, unknown> });
  }

  /** Alle Dokumente einer Sammlung, seitenweise. */
  async collection(path: string): Promise<LegacyDoc[]> {
    const docs: LegacyDoc[] = [];
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({ pageSize: '300' });
      if (pageToken) query.set('pageToken', pageToken);
      const body = await this.get(`${path}?${query}`);
      for (const document of (body.documents ?? []) as Array<{ name: string; fields?: Record<string, unknown> }>) {
        docs.push(flatten(document));
      }
      pageToken = typeof body.nextPageToken === 'string' ? body.nextPageToken : undefined;
    } while (pageToken);
    return docs;
  }
}

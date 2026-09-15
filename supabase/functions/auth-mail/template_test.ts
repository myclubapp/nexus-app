/**
 * Die Anmeldemail (UC-048) – `deno test` in diesem Ordner.
 */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { authAction, authMail } from './template.ts';
import { confirmUrl, verifyLink, verifySignature } from './hook.ts';

const brand = { clubName: 'Kadetten', color: '#1a73e8', logoUrl: null };

Deno.test('Unbekannter Anlass gilt als Anmeldelink', () => {
  assertEquals(authAction('recovery'), 'recovery');
  assertEquals(authAction('email_change'), 'email_change');
  assertEquals(authAction('quatsch'), 'magiclink');
  assertEquals(authAction(null), 'magiclink');
});

Deno.test('Betreff nennt den Verein, das Blatt trägt seine Farbe', () => {
  const mail = authMail({
    action: 'magiclink',
    locale: 'de',
    brand,
    confirmUrl: 'https://p.supabase.co/auth/v1/verify?token=abc',
    copyUrl: 'https://app.my-club.ch/auth/verify?token_hash=abc&type=magiclink',
    year: 2026,
  });
  assertEquals(mail.subject, 'Kadetten: Dein Anmeldelink');
  assertStringIncludes(mail.html, 'bgcolor="#1a73e8"');
  assertStringIncludes(mail.html, 'Jetzt anmelden');
  assertStringIncludes(mail.html, 'ignoriere die Mail');
});

Deno.test('Ohne Verein steht myclub im Betreff und im Kopfband', () => {
  const mail = authMail({
    action: 'signup',
    locale: 'fr',
    brand: { clubName: null, color: null, logoUrl: null },
    confirmUrl: 'https://p.supabase.co/auth/v1/verify?token=abc',
    copyUrl: 'https://app.my-club.ch/auth/verify?token_hash=abc&type=magiclink',
    year: 2026,
  });
  assertEquals(mail.subject, 'Confirme ton adresse');
  assertStringIncludes(mail.html, '>myclub</td>');
});

Deno.test('Jede Sprache und jeder Anlass ergeben ein Blatt mit Warum', () => {
  const actions = ['signup', 'magiclink', 'invite', 'recovery', 'email_change', 'email'] as const;
  for (const locale of ['de', 'fr', 'it', 'en'] as const) {
    for (const action of actions) {
      const mail = authMail({
        action,
        locale,
        brand,
        confirmUrl: 'https://p.supabase.co/auth/v1/verify?token=abc',
    copyUrl: 'https://app.my-club.ch/auth/verify?token_hash=abc&type=magiclink',
      copyUrl: 'https://app.my-club.ch/auth/verify?token_hash=abc&type=magiclink',
        year: 2026,
      });
      assert(mail.subject.length > 0, `${locale}/${action}`);
      assertStringIncludes(mail.html, 'https://p.supabase.co/auth/v1/verify?token=abc');
    }
  }
});

// Die Mail bot einmal einen Code zum Abtippen an. Die App hat ihn nie
// eingelöst – es gibt kein `verifyOtp` –, also verspricht die Mail ihn auch
// nicht mehr. Dieser Test hält fest, dass keiner zurückkommt.
Deno.test('Die Mail bietet keinen Code zum Abtippen an', () => {
  for (const locale of ['de', 'fr', 'it', 'en'] as const) {
    const mail = authMail({
      action: 'magiclink',
      locale,
      brand,
      confirmUrl: 'https://p.supabase.co/auth/v1/verify?token=abc',
    copyUrl: 'https://app.my-club.ch/auth/verify?token_hash=abc&type=magiclink',
      copyUrl: 'https://app.my-club.ch/auth/verify?token_hash=abc&type=magiclink',
      year: 2026,
    });
    for (const text of ['Oder gib diesen Code', 'saisis ce code', 'inserisci questo codice', 'enter this code']) {
      assert(!mail.html.includes(text), `${locale}: ${text}`);
      assert(!mail.text.includes(text), `${locale} (Text): ${text}`);
    }
  }
});

// --- Der zweite Weg: die Adresse zum Kopieren -------------------------------

Deno.test('Jede Sprache bietet die Adresse zum Kopieren an – als Text und im Blatt', () => {
  const copyUrl = 'https://app.my-club.ch/auth/verify?token_hash=abc&type=magiclink';
  for (const locale of ['de', 'fr', 'it', 'en'] as const) {
    const mail = authMail({
      action: 'magiclink',
      locale,
      brand,
      confirmUrl: 'https://p.supabase.co/auth/v1/verify?token=abc',
      copyUrl,
      year: 2026,
    });
    // Im Blatt ausgeschrieben – eine Schaltfläche lässt sich nicht markieren.
    // Das `&` steht dort als `&amp;`; so verlangt es HTML, und so liest der
    // Browser es wieder als `&`.
    const inHtml = copyUrl.replace('&', '&amp;');
    assertStringIncludes(mail.html, `href="${inHtml}"`, locale);
    assertStringIncludes(mail.html, `>${inHtml}</a>`, locale);
    // Und im Textteil auf einer eigenen Zeile, ohne Satzzeichen daneben.
    assertStringIncludes(mail.text, `\n${copyUrl}`, locale);
  }
});

// Ohne `APP_URL` gibt es die zweite Adresse nicht. Die Mail muss dann trotzdem
// hinausgehen – sie steht auf dem Weg zur Anmeldung.
Deno.test('Ohne Kopieradresse bleibt das Blatt vollständig', () => {
  const mail = authMail({
    action: 'magiclink',
    locale: 'de',
    brand,
    confirmUrl: 'https://p.supabase.co/auth/v1/verify?token=abc',
    copyUrl: null,
    year: 2026,
  });
  assertStringIncludes(mail.html, 'Jetzt anmelden');
  assert(!mail.html.includes('/auth/verify'));
  assert(!mail.html.includes('Kopiere diese Adresse'));
});

Deno.test('Die Kopieradresse führt in die App und trägt den Token-Hash', () => {
  const url = verifyLink('https://app.my-club.ch', 'hash123', 'recovery');
  assertEquals(
    url,
    'https://app.my-club.ch/auth/verify?token_hash=hash123&type=recovery',
  );
  // Ein Pfad in APP_URL gehört nicht in die Adresse.
  assertStringIncludes(
    verifyLink('https://app.my-club.ch/tabs/dashboard', 'h', 'magiclink')!,
    'https://app.my-club.ch/auth/verify?',
  );
});

Deno.test('Ohne App-Adresse und ohne TLS gibt es keine Kopieradresse', () => {
  assertEquals(verifyLink(null, 'hash123', 'magiclink'), null);
  assertEquals(verifyLink(undefined, 'hash123', 'magiclink'), null);
  assertEquals(verifyLink('', 'hash123', 'magiclink'), null);
  assertEquals(verifyLink('http://app.my-club.ch', 'hash123', 'magiclink'), null);
  assertEquals(verifyLink('kein-url', 'hash123', 'magiclink'), null);
});

Deno.test('Die Bestätigungsadresse entsteht aus dem Prüfendpunkt des Projekts', () => {
  const url = confirmUrl(
    'https://p.supabase.co',
    'hash123',
    'magiclink',
    'https://app.my-club.ch/auth/callback',
  );
  assertStringIncludes(url, 'https://p.supabase.co/auth/v1/verify?');
  assertStringIncludes(url, 'token=hash123');
  assertStringIncludes(url, 'type=magiclink');
  assertStringIncludes(url, 'redirect_to=https%3A%2F%2Fapp.my-club.ch%2Fauth%2Fcallback');
  assert(!confirmUrl('https://p.supabase.co', 'h', 'signup', null).includes('redirect_to'));
});

// --- Die Signatur -----------------------------------------------------------

const SECRET_BYTES = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
const SECRET = 'v1,whsec_' + btoa(String.fromCharCode(...SECRET_BYTES));

async function sign(id: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    SECRET_BYTES as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return 'v1,' + btoa(String.fromCharCode(...new Uint8Array(mac)));
}

function headers(id: string, timestamp: string, signature: string): Headers {
  return new Headers({
    'webhook-id': id,
    'webhook-timestamp': timestamp,
    'webhook-signature': signature,
  });
}

Deno.test('Eine gültige Signatur geht durch', async () => {
  const now = new Date('2026-09-15T10:00:00Z');
  const stamp = String(Math.floor(now.getTime() / 1000));
  const body = '{"user":{"email":"a@example.ch"}}';
  const signature = await sign('msg_1', stamp, body);
  assertEquals(await verifySignature(SECRET, headers('msg_1', stamp, signature), body, now), null);
});

Deno.test('Ein veränderter Rumpf fällt durch', async () => {
  const now = new Date('2026-09-15T10:00:00Z');
  const stamp = String(Math.floor(now.getTime() / 1000));
  const signature = await sign('msg_1', stamp, '{"a":1}');
  assertEquals(
    await verifySignature(SECRET, headers('msg_1', stamp, signature), '{"a":2}', now),
    'Signatur stimmt nicht',
  );
});

Deno.test('Ein alter Zeitstempel fällt durch, auch mit gültiger Signatur', async () => {
  const now = new Date('2026-09-15T10:00:00Z');
  const stamp = String(Math.floor(now.getTime() / 1000) - 3600);
  const body = '{}';
  const signature = await sign('msg_1', stamp, body);
  assertEquals(
    await verifySignature(SECRET, headers('msg_1', stamp, signature), body, now),
    'Zeitstempel zu alt',
  );
});

Deno.test('Fehlende Kopffelder fallen durch', async () => {
  assertEquals(await verifySignature(SECRET, new Headers(), '{}'), 'Signaturfelder fehlen');
});

Deno.test('Mehrere Signaturen im Kopffeld – eine passende genügt', async () => {
  const now = new Date('2026-09-15T10:00:00Z');
  const stamp = String(Math.floor(now.getTime() / 1000));
  const body = '{}';
  const good = await sign('msg_1', stamp, body);
  const offered = `v1,ZmFsc2No ${good}`;
  assertEquals(await verifySignature(SECRET, headers('msg_1', stamp, offered), body, now), null);
});

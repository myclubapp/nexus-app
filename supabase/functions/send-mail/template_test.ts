/**
 * Die Mail aus den Meldungen (UC-044, UC-048) – `deno test` in diesem Ordner.
 */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  appLink,
  brandOf,
  headerColor,
  renderMail,
  singleClub,
  subjectFor,
  whyText,
  type MailGroup,
  type MailItem,
} from './template.ts';

function item(overrides: Partial<MailItem> = {}): MailItem {
  return {
    id: 'n1',
    category: 'event',
    title: 'Training Herren 1',
    body: 'Mo, 14.09., 19:00',
    link: '/tabs/agenda?event=e1',
    createdAt: '2026-09-14T08:00:00Z',
    why: null,
    template: null,
    clubName: 'Kadetten',
    clubColor: '#1a73e8',
    clubLogo: 'https://cdn.example.ch/logo.png',
    clubWhy: null,
    ...overrides,
  };
}

function group(items: MailItem[], overrides: Partial<MailGroup> = {}): MailGroup {
  return { email: 'x@example.ch', locale: 'de', displayName: 'Sandro', mode: 'daily', items, ...overrides };
}

Deno.test('Betreff: eine Meldung trägt den Verein und ihren Titel', () => {
  assertEquals(subjectFor(group([item()])), 'Kadetten: Training Herren 1');
});

Deno.test('Betreff: mehrere Meldungen nennen die Zahl', () => {
  assertEquals(subjectFor(group([item(), item({ id: 'n2', title: 'Kommst du?' })])), 'Kadetten: 2 neue Meldungen');
});

Deno.test('Betreff: zwei Vereine, kein Vereinsname', () => {
  const g = group([item(), item({ id: 'n2', clubName: 'Andere' })]);
  assertEquals(singleClub(g.items), null);
  assertEquals(subjectFor(g), '2 neue Meldungen');
});

Deno.test('Links entstehen nur mit App-Adresse und nur relativ', () => {
  assertEquals(appLink(null, '/tabs/agenda'), null);
  assertEquals(appLink('https://app.example.ch/', '/tabs/agenda'), 'https://app.example.ch/tabs/agenda');
  assertEquals(appLink('https://app.example.ch', 'https://evil.example/x'), null);
});

Deno.test('Kopfband: Vereinsfarbe, sonst Grundfarbe', () => {
  assertEquals(headerColor([item()]), '#1a73e8');
  assertEquals(headerColor([item({ clubColor: 'rot' })]), '#795deb');
  assertEquals(headerColor([item({ clubColor: null })]), '#795deb');
});

Deno.test('Marke: Logo nur aus einer Zeile, die eines trägt', () => {
  assertEquals(brandOf([item({ clubLogo: null }), item({ id: 'n2' })]).logoUrl, 'https://cdn.example.ch/logo.png');
  assertEquals(brandOf([item({ clubLogo: null })]).logoUrl, null);
});

Deno.test('HTML: Inhalte sind maskiert, Zeit in Europe/Zurich, Sprache gilt', () => {
  const mail = renderMail(
    group([item({ title: 'Absage <Halle> & Co', body: null })], { locale: 'fr', mode: 'immediate' }),
    { appUrl: 'https://app.example.ch' },
  );
  assertStringIncludes(mail.html, 'Absage &lt;Halle&gt; &amp; Co');
  assert(!mail.html.includes('<Halle>'));
  assertStringIncludes(mail.html, 'Bonjour Sandro');
  assertStringIncludes(mail.html, '10:00'); // 08:00Z = 10:00 in Zürich im September
  assertStringIncludes(mail.html, 'https://app.example.ch/tabs/agenda?event=e1');
  assertStringIncludes(mail.html, 'https://app.example.ch/tabs/profile/notifications');
  assertStringIncludes(mail.text, 'Absage <Halle> & Co');
});

Deno.test('Zusammenfassung: Wochenmodus sagt «diese Woche», ohne App-Adresse kein Link', () => {
  const mail = renderMail(
    group([item({ clubLogo: null }), item({ id: 'n2', title: 'Punkte', clubLogo: null })], { mode: 'weekly' }),
    { appUrl: null },
  );
  assertStringIncludes(mail.html, '2 Meldungen aus deinem Verein in dieser Woche');
  assert(!mail.html.includes('href='));
  assert(!mail.text.includes('http'));
});

Deno.test('Unbekannte Kategorie fällt auf «Meldung» zurück', () => {
  const mail = renderMail(group([item({ category: 'whatever' })]), { appUrl: null });
  assertStringIncludes(mail.html, 'Meldung · ');
});

// --- Das Warum (FR-183) -----------------------------------------------------

Deno.test('Warum: der eigene Satz sticht den Standardsatz', () => {
  assertEquals(whyText('de', 'task', 'Damit die Halle offen ist.', true), 'Damit die Halle offen ist.');
  assertEquals(whyText('de', 'task', '   ', true), 'Weil der Verein für diese Arbeit Hände braucht.');
});

Deno.test('Warum: der Standardsatz nur bei einer einzelnen Meldung', () => {
  assertEquals(whyText('de', 'event', null, false), null);
  assertEquals(whyText('de', 'event', 'Eigenes', false), 'Eigenes');
  assertEquals(whyText('fr', 'invoice', null, true), 'Les cotisations font vivre le club.');
  assertEquals(whyText('de', 'unbekannt', null, true), 'Aus deinem Verein.');
});

Deno.test('Warum steht im Blatt und im Textteil', () => {
  const mail = renderMail(
    group([item({ why: 'Ohne Zusagen steht die Halle leer.' })]),
    { appUrl: null },
  );
  assertStringIncludes(mail.html, 'Ohne Zusagen steht die Halle leer.');
  assertStringIncludes(mail.text, 'Warum: Ohne Zusagen steht die Halle leer.');
});

// --- Das Willkommensblatt (FR-184) ------------------------------------------

Deno.test('Willkommen: eigenes Blatt statt Meldungsliste', () => {
  const mail = renderMail(
    group([
      item({
        template: 'welcome',
        category: 'join_request',
        title: 'Willkommen bei Kadetten',
        body: null,
        link: '/tabs/dashboard',
        clubWhy: 'Wir bringen Kinder in Bewegung.',
      }),
    ]),
    { appUrl: 'https://app.example.ch', helpUrl: 'https://www.my-club.ch' },
  );
  assertEquals(mail.subject, 'Kadetten: Willkommen bei Kadetten');
  assertStringIncludes(mail.html, 'So funktioniert es');
  assertStringIncludes(mail.html, 'Wir bringen Kinder in Bewegung.');
  assertStringIncludes(mail.html, 'Warum das Ganze');
  assertStringIncludes(mail.html, 'https://app.example.ch/tabs/dashboard');
  assertStringIncludes(mail.html, 'https://www.my-club.ch');
  assertStringIncludes(mail.html, 'weil du Kadetten beigetreten bist');
  // Keine Meldungsliste: der Kanalhinweis der Zusammenfassung fehlt.
  assert(!mail.html.includes('E-Mail-Kanal eingeschaltet'));
});

Deno.test('Willkommen: ohne Vereins-Warum und ohne Website bleibt das Blatt ganz', () => {
  const mail = renderMail(
    group([item({ template: 'welcome', title: 'Willkommen', body: null, link: '/tabs/dashboard' })], {
      locale: 'it',
    }),
    { appUrl: null },
  );
  assertStringIncludes(mail.html, 'Come funziona');
  assert(!mail.html.includes('href='));
  assertStringIncludes(mail.text, 'Perché tutto questo');
});

Deno.test('Willkommen gilt nur allein – mit einer zweiten Zeile ist es eine Liste', () => {
  const mail = renderMail(
    group([item({ template: 'welcome', title: 'Willkommen' }), item({ id: 'n2' })]),
    { appUrl: null },
  );
  assertStringIncludes(mail.html, '2 neue Meldungen');
});

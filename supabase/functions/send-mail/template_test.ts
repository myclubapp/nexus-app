/**
 * Die Mail aus den Meldungen (UC-044) – `deno test` in diesem Ordner.
 */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { appLink, headerColor, renderMail, singleClub, subjectFor, type MailGroup, type MailItem } from './template.ts';

function item(overrides: Partial<MailItem> = {}): MailItem {
  return {
    id: 'n1',
    category: 'event',
    title: 'Training Herren 1',
    body: 'Mo, 14.09., 19:00',
    link: '/tabs/agenda?event=e1',
    createdAt: '2026-09-14T08:00:00Z',
    clubName: 'Kadetten',
    clubColor: '#1a73e8',
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
  const mail = renderMail(group([item(), item({ id: 'n2', title: 'Punkte' })], { mode: 'weekly' }), { appUrl: null });
  assertStringIncludes(mail.html, '2 Meldungen aus deinem Verein in dieser Woche');
  assert(!mail.html.includes('href='));
  assert(!mail.text.includes('http'));
});

Deno.test('Unbekannte Kategorie fällt auf «Meldung» zurück', () => {
  const mail = renderMail(group([item({ category: 'whatever' })]), { appUrl: null });
  assertStringIncludes(mail.html, 'Meldung · ');
});

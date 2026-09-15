/** Die Regeln, die auf dem Blatt stehen – dieselben wie in der App. */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { billLanguage, groupReference, invoiceMail, PDF_LABELS, swissDate } from './mail.ts';

Deno.test('gruppiert die Referenz von rechts (SIX)', () => {
  // Dieselbe Erwartung wie `formatQrReference()` in `src/lib/invoicing.ts`.
  assertEquals(groupReference('210000000003139471430009017'), '21 00000 00003 13947 14300 09017');
  assertEquals(groupReference('99 11000 00000 00000 00000 00111'), '99 11000 00000 00000 00000 00111');
});

Deno.test('Datum in Schweizer Schreibweise', () => {
  assertEquals(swissDate(new Date(2026, 8, 14)), '14.9.2026');
});

Deno.test('jede Sprache hat ihre Beschriftungen', () => {
  for (const locale of ['de', 'fr', 'it', 'en'] as const) {
    assertEquals(typeof PDF_LABELS[locale].total, 'string');
    assertEquals(billLanguage(locale).length, 2);
  }
  assertEquals(billLanguage('fr'), 'FR');
});

// --- Die Begleitmail im Vereins-Look (UC-048) -------------------------------

const BASE = {
  clubName: 'TV Musterhausen',
  name: 'Sandro',
  purpose: 'Mitgliederbeitrag 2026/27',
  amount: 'CHF 120.00',
  dueDate: '31.10.2026',
  incompleteAddress: false,
  color: '#1a73e8',
  logoUrl: 'https://cdn.example.ch/logo.png',
  appUrl: 'https://app.my-club.ch',
};

Deno.test('Begleitmail: Kopfband, Logo, Betrag, Warum und Weg in die App', () => {
  const mail = invoiceMail('de', BASE);
  assertEquals(mail.subject, 'Rechnung TV Musterhausen – Mitgliederbeitrag 2026/27');
  assertStringIncludes(mail.html, 'bgcolor="#1a73e8"');
  assertStringIncludes(mail.html, 'src="https://cdn.example.ch/logo.png"');
  assertStringIncludes(mail.html, 'CHF 120.00');
  assertStringIncludes(mail.html, 'Wofür:');
  assertStringIncludes(mail.html, 'https://app.my-club.ch/tabs/profile/invoices');
  assertStringIncludes(mail.text, 'Zahlbar bis: 31.10.2026');
  // BR-158: kein Wort über Folgen einer späten Zahlung.
  assert(!/Mahn|Gebühr|Verzug/i.test(mail.html));
});

Deno.test('Begleitmail: unvollständige Adresse wird gesagt, nicht verschwiegen', () => {
  const mail = invoiceMail('fr', { ...BASE, incompleteAddress: true });
  assertStringIncludes(mail.html, 'Tes coordonnées sont incomplètes');
});

Deno.test('Begleitmail: ohne App-Adresse kein Knopf, ohne Vereinsfarbe die Grundfarbe', () => {
  const mail = invoiceMail('it', { ...BASE, appUrl: null, color: null, logoUrl: null });
  assert(!mail.html.includes('/tabs/profile/invoices'));
  assertStringIncludes(mail.html, 'bgcolor="#795deb"');
  assertStringIncludes(mail.text, 'A cosa serve:');
});

Deno.test('Begleitmail: der Vereinsname wird maskiert', () => {
  const mail = invoiceMail('en', { ...BASE, clubName: 'Rock & <Roll>' });
  assertStringIncludes(mail.html, 'Rock &amp; &lt;Roll&gt;');
  assert(!mail.html.includes('<Roll>'));
});

/** Die Regeln, die auf dem Blatt stehen – dieselben wie in der App. */
import { assertEquals } from 'jsr:@std/assert@1';
import { billLanguage, groupReference, PDF_LABELS, swissDate } from './mail.ts';

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

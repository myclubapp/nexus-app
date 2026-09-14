import { afterAll, describe, expect, it } from 'vitest';
import { setLanguage } from '../test/utils';
import {
  DATETIME_DEFAULTS,
  appLocale,
  formatDateTime,
  formatDayLong,
  formatTime,
} from './format';

/** Sonntag, 13. September 2026, 00:05 – lokal. */
const midnight = new Date(2026, 8, 13, 0, 5);

afterAll(async () => {
  await setLanguage('de');
});

describe('appLocale', () => {
  it('nimmt je Sprache die Schweizer Ausprägung', async () => {
    const expected = { de: 'de-CH', fr: 'fr-CH', it: 'it-CH', en: 'en-GB' } as const;
    for (const [language, locale] of Object.entries(expected)) {
      await setLanguage(language as keyof typeof expected);
      expect(appLocale()).toBe(locale);
    }
  });
});

describe('DATETIME_DEFAULTS', () => {
  it('beginnt die Woche am Montag und zählt die Stunden 00–23', () => {
    expect(DATETIME_DEFAULTS).toEqual({ firstDayOfWeek: 1, hourCycle: 'h23' });
  });
});

describe('formatTime und formatDateTime', () => {
  it('zeigt Mitternacht als 00, nicht als 24 oder 12 AM', async () => {
    await setLanguage('en');
    expect(formatTime(midnight.toISOString())).toBe('00:05');
    await setLanguage('de');
    expect(formatTime(midnight.toISOString())).toBe('00:05');
    expect(formatDateTime(midnight.toISOString())).toContain('00:05');
  });

  it('nennt bei Tag und Uhrzeit auch das Jahr (Entscheid 2026-09-13)', async () => {
    await setLanguage('de');
    expect(formatDateTime(midnight.toISOString())).toBe('So., 13.09.2026, 00:05');
    await setLanguage('en');
    expect(formatDateTime(midnight.toISOString())).toContain('2026');
  });

  it('gibt bei leerem oder ungültigem Wert nichts zurück', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime('kein Datum')).toBe('');
  });
});

describe('formatDayLong', () => {
  it('schreibt den Tag aus, mit Wochentag', async () => {
    await setLanguage('de');
    expect(formatDayLong(midnight)).toBe('Sonntag, 13. September 2026');
  });
});

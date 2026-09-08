import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LIMIT_PERIODS,
  PILLARS,
  groupByPillar,
  isCodeAvailable,
  isThanksOnly,
  normaliseRuleCode,
  readRuleLimit,
  writeRuleLimit,
} from './pointRule';

/**
 * Gegenstück zu `rule_limit_reached()` in `0014_point_rules.sql`. Laufen die
 * beiden auseinander, zeigt die App eine andere Grenze an, als der Server
 * prüft – und niemand merkt es, bis Punkte fehlen (BR-065).
 */
describe('readRuleLimit', () => {
  it('liest die Kurzform max_per_week', () => {
    expect(readRuleLimit({ max_per_week: 4 })).toEqual({ max: 4, period: 'week' });
  });

  it('liest die allgemeine Form mit Zeitraum', () => {
    expect(readRuleLimit({ max_per_period: 2, period: 'month' })).toEqual({
      max: 2,
      period: 'month',
    });
  });

  it('bevorzugt die Kurzform, wie es die Datenbank tut', () => {
    // `rule_limit_reached()` prüft `max_per_week` zuerst.
    expect(readRuleLimit({ max_per_week: 4, max_per_period: 99, period: 'month' })).toEqual(
      { max: 4, period: 'week' },
    );
  });

  it('fällt auf die Woche zurück, wenn der Zeitraum unbekannt ist', () => {
    expect(readRuleLimit({ max_per_period: 3, period: 'jahrzehnt' })).toEqual({
      max: 3,
      period: 'week',
    });
  });

  it('meldet ohne Grenze null', () => {
    expect(readRuleLimit({})).toEqual({ max: null, period: 'week' });
    expect(readRuleLimit(null)).toEqual({ max: null, period: 'week' });
    expect(readRuleLimit({ max_per_week: 0 })).toEqual({ max: null, period: 'week' });
    expect(readRuleLimit({ max_per_week: 'viel' })).toEqual({ max: null, period: 'week' });
  });
});

describe('writeRuleLimit', () => {
  it('schreibt die allgemeine Form', () => {
    expect(writeRuleLimit({}, { max: 3, period: 'month' })).toEqual({
      max_per_period: 3,
      period: 'month',
    });
  });

  it('entfernt die Kurzform, statt sie stehen zu lassen', () => {
    // Sonst läse die Datenbank weiter die Wochenform und die neue Grenze
    // hätte keine Wirkung.
    expect(writeRuleLimit({ max_per_week: 4 }, { max: 2, period: 'season' })).toEqual({
      max_per_period: 2,
      period: 'season',
    });
  });

  it('entfernt die Grenze ganz', () => {
    expect(writeRuleLimit({ max_per_week: 4 }, { max: null, period: 'week' })).toEqual({});
  });

  it('lässt andere Angaben in meta unberührt', () => {
    expect(
      writeRuleLimit({ note: 'behalten', max_per_week: 4 }, { max: null, period: 'week' }),
    ).toEqual({ note: 'behalten' });
  });

  it('ist mit readRuleLimit deckungsgleich', () => {
    for (const period of LIMIT_PERIODS) {
      expect(readRuleLimit(writeRuleLimit({}, { max: 7, period }))).toEqual({
        max: 7,
        period,
      });
    }
  });
});

describe('isThanksOnly', () => {
  it('erkennt den Nur-Dank-Modus (A4, FR-040)', () => {
    expect(isThanksOnly({ points: 0, is_active: true })).toBe(true);
  });

  it('unterscheidet ihn von einer ausgeschalteten Regel', () => {
    // Ausgeschaltet heisst «gibt es bei uns nicht», null heisst «zählt, aber
    // ohne Zahl». Das ist nicht dasselbe.
    expect(isThanksOnly({ points: 0, is_active: false })).toBe(false);
  });

  it('verneint bei einem Punktwert', () => {
    expect(isThanksOnly({ points: 10, is_active: true })).toBe(false);
  });
});

describe('groupByPillar', () => {
  it('gruppiert in der festen Reihenfolge der Säulen', () => {
    const rules = [{ pillar: 7 }, { pillar: 1 }, { pillar: 3 }, { pillar: 1 }];
    expect(groupByPillar(rules).map((group) => group.pillar)).toEqual([1, 3, 7]);
    expect(groupByPillar(rules)[0].rules).toHaveLength(2);
  });

  it('lässt leere Säulen weg', () => {
    expect(groupByPillar([{ pillar: 4 }]).map((g) => g.pillar)).toEqual([4]);
  });

  it('kennt sieben Säulen', () => {
    expect(PILLARS).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('normaliseRuleCode', () => {
  it('macht aus einer Eingabe einen technischen Code', () => {
    expect(normaliseRuleCode('  Kuchen Gebacken ')).toBe('kuchen_gebacken');
  });

  it('entfernt, was in keinem Code vorkommt', () => {
    expect(normaliseRuleCode('Kuchen-für-alle!')).toBe('kuchenfralle');
  });

  it('liefert für eine unbrauchbare Eingabe eine leere Zeichenkette', () => {
    expect(normaliseRuleCode('!!!')).toBe('');
  });
});

describe('isCodeAvailable', () => {
  const rules = [{ code: 'training_attend' }, { code: 'task_done' }];

  it('erkennt einen freien Code', () => {
    expect(isCodeAvailable(rules, 'kuchen_gebacken')).toBe(true);
  });

  it('erkennt einen belegten Code (BR-064)', () => {
    expect(isCodeAvailable(rules, 'task_done')).toBe(false);
  });

  it('vergleicht nach der Vereinheitlichung', () => {
    // «Task Done» wird zu task_done und ist damit belegt.
    expect(isCodeAvailable(rules, 'Task Done')).toBe(false);
  });

  it('lehnt eine leere Eingabe ab', () => {
    expect(isCodeAvailable(rules, '   ')).toBe(false);
  });
});

/**
 * Architekturprüfung: Die Zeiträume der App und die der Datenbankfunktion
 * müssen dieselben sein.
 */
describe('Gleichlauf mit rule_limit_reached() in SQL', () => {
  const migration = readFileSync(
    '../supabase/migrations/0014_point_rules.sql',
    'utf8',
  );

  it.each(LIMIT_PERIODS)('kennt den Zeitraum %s auch in SQL', (period) => {
    expect(migration).toContain(`when '${period}'`);
  });

  it('prüft die Wochenform zuerst, wie die App', () => {
    const weekIndex = migration.indexOf('max_per_week');
    const generalIndex = migration.indexOf('max_per_period');
    expect(weekIndex).toBeGreaterThan(-1);
    expect(weekIndex).toBeLessThan(generalIndex);
  });
});

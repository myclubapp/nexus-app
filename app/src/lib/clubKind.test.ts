import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLUB_KINDS, SEASON_START_MONTH, defaultSeasonStart } from './clubKind';

describe('defaultSeasonStart', () => {
  it('liefert den ersten Tag des Monats der Vereinsart', () => {
    const today = new Date('2026-03-14T12:00:00');
    expect(defaultSeasonStart('sport', today)).toBe('2026-07-01');
    expect(defaultSeasonStart('music', today)).toBe('2026-09-01');
    expect(defaultSeasonStart('youth', today)).toBe('2026-08-01');
    expect(defaultSeasonStart('neighborhood', today)).toBe('2026-01-01');
  });

  it('füllt den Monat zweistellig auf', () => {
    // '2026-1-01' wäre kein gültiger Wert für ein Datumsfeld.
    expect(defaultSeasonStart('other', new Date('2026-03-14T12:00:00'))).toBe(
      '2026-01-01',
    );
  });

  it('verschiebt den Tag nicht über die Zeitzone', () => {
    // toISOString() würde den 1. Januar in Mitteleuropa zum 31. Dezember
    // machen – deshalb rechnet die Funktion mit lokalen Feldern.
    const silvester = new Date('2026-12-31T23:30:00');
    expect(defaultSeasonStart('other', silvester)).toBe('2026-01-01');
  });

  it('kennt jede Vereinsart', () => {
    for (const kind of CLUB_KINDS) {
      expect(SEASON_START_MONTH[kind]).toBeGreaterThanOrEqual(1);
      expect(SEASON_START_MONTH[kind]).toBeLessThanOrEqual(12);
    }
  });
});

/**
 * Architekturprüfung: Der Vorschlag im Wizard und der Wert, den die Datenbank
 * ohne Angabe einsetzt, müssen derselbe sein. Laufen sie auseinander, sieht die
 * gründende Person einen anderen Saisonbeginn als den gespeicherten – und die
 * Saisonzuordnung der Punkte wäre eine andere als angezeigt (NFR-035).
 */
describe('Gleichlauf mit default_season_start() in SQL', () => {
  // Relativ zum Arbeitsverzeichnis (app/): `import.meta.url` zeigt unter
  // Vitest nicht auf eine Datei, die readFileSync öffnen kann.
  const migration = readFileSync(
    '../supabase/migrations/0008_club_founding.sql',
    'utf8',
  );

  const block = migration.slice(
    migration.indexOf('function public.default_season_start'),
  );

  it.each(CLUB_KINDS.filter((kind) => kind !== 'other' && kind !== 'neighborhood'))(
    'verwendet für %s denselben Monat wie die Migration',
    (kind) => {
      const match = new RegExp(`when '${kind}'\\s+then\\s+(\\d+)`).exec(block);
      expect(match, `Vereinsart ${kind} fehlt in default_season_start()`).not.toBeNull();
      expect(Number(match![1])).toBe(SEASON_START_MONTH[kind]);
    },
  );

  it('behandelt Quartier und Anderes über den else-Zweig als Januar', () => {
    // Beide stehen nicht als eigener when-Zweig in der Migration, sondern
    // fallen auf `else 1`. Fiele der Zweig weg, wäre der Vergleich hinfällig.
    expect(block).toMatch(/else\s+1\b/);
    expect(SEASON_START_MONTH.neighborhood).toBe(1);
    expect(SEASON_START_MONTH.other).toBe(1);
  });
});

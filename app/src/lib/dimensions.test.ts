import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DIMENSIONS,
  axisPoint,
  hasSeries,
  polygonPoints,
  seriesOf,
  strongestDimension,
  type ValueDimension,
} from './dimensions';

function dim(overrides: Partial<ValueDimension> = {}): ValueDimension {
  return {
    dimension: 'engagement',
    ownValue: 50,
    teamValue: 40,
    clubValue: 30,
    collected: true,
    groupSize: 5,
    ...overrides,
  };
}

describe('axisPoint', () => {
  it('legt die erste Achse nach oben', () => {
    const point = axisPoint(0, 5, 100, 100, 80);
    expect(point.x).toBeCloseTo(100, 5);
    expect(point.y).toBeCloseTo(20, 5);
  });

  it('setzt den Wert null in die Mitte', () => {
    const point = axisPoint(2, 5, 0, 100, 80);
    expect(point.x).toBeCloseTo(100, 5);
    expect(point.y).toBeCloseTo(100, 5);
  });

  it('begrenzt Werte über hundert auf den Rand', () => {
    // Ein Wert über hundert entsteht nicht, aber ein Diagramm, das über seinen
    // Rahmen hinausragt, sähe kaputt aus.
    const capped = axisPoint(0, 5, 150, 100, 80);
    const edge = axisPoint(0, 5, 100, 100, 80);
    expect(capped).toEqual(edge);
  });
});

describe('polygonPoints', () => {
  it('lässt eine Achse ohne Wert aus (BR-103, BR-104)', () => {
    // Eine ausgelassene Achse ist ehrlicher als eine Null, die wie ein
    // Ergebnis aussieht.
    const withGap = polygonPoints([50, null, 50, 50, 50]);
    expect(withGap.split(' ')).toHaveLength(4);
  });

  it('ergibt für lauter Lücken einen leeren Linienzug', () => {
    expect(polygonPoints([null, null, null, null, null])).toBe('');
  });
});

describe('seriesOf', () => {
  const rows = [
    dim({ dimension: 'engagement', ownValue: 80, teamValue: 40, clubValue: 30 }),
    dim({ dimension: 'volunteering', ownValue: 20, teamValue: null, clubValue: 25 }),
    dim({ dimension: 'finance', collected: false, ownValue: 0, teamValue: null, clubValue: null }),
    dim({ dimension: 'network', ownValue: 10, teamValue: 5, clubValue: 7 }),
    dim({ dimension: 'loyalty', ownValue: 0, teamValue: 1, clubValue: 2 }),
  ];

  it('lässt eine nicht erhobene Dimension in **jeder** Reihe aus (BR-103)', () => {
    expect(seriesOf(rows, 'own')[2]).toBeNull();
    expect(seriesOf(rows, 'team')[2]).toBeNull();
    expect(seriesOf(rows, 'club')[2]).toBeNull();
  });

  it('lässt eine zu kleine Bezugsgruppe aus, ohne den eigenen Wert zu verlieren (BR-104)', () => {
    expect(seriesOf(rows, 'team')[1]).toBeNull();
    expect(seriesOf(rows, 'own')[1]).toBe(20);
  });

  it('unterscheidet den Wert null von «nicht erhoben»', () => {
    // `loyalty` ist erhoben und steht bei null – das ist eine Aussage.
    // `finance` ist nicht erhoben – das ist keine.
    expect(seriesOf(rows, 'own')[4]).toBe(0);
    expect(seriesOf(rows, 'own')[2]).toBeNull();
  });
});

describe('hasSeries', () => {
  it('erkennt, dass gar keine Team-Linie zur Verfügung steht (A3)', () => {
    const rows = [dim({ teamValue: null }), dim({ dimension: 'loyalty', teamValue: null })];
    expect(hasSeries(rows, 'team')).toBe(false);
    expect(hasSeries(rows, 'club')).toBe(true);
  });
});

describe('strongestDimension', () => {
  it('benennt die stärkste erhobene Dimension (Schritt 4, BR-101)', () => {
    const rows = [
      dim({ dimension: 'engagement', ownValue: 40 }),
      dim({ dimension: 'volunteering', ownValue: 90 }),
      dim({ dimension: 'network', ownValue: 10 }),
    ];
    expect(strongestDimension(rows)).toBe('volunteering');
  });

  it('übergeht eine nicht erhobene Dimension, auch bei hohem Wert', () => {
    const rows = [
      dim({ dimension: 'finance', ownValue: 99, collected: false }),
      dim({ dimension: 'engagement', ownValue: 40 }),
    ];
    expect(strongestDimension(rows)).toBe('engagement');
  });

  it('erfindet ohne Beiträge keine Stärke (A1)', () => {
    // «Deine Stärke ist eine Dimension, in der du nichts hast» wäre keine
    // Würdigung.
    const rows = DIMENSIONS.map((dimension) => dim({ dimension, ownValue: 0 }));
    expect(strongestDimension(rows)).toBeNull();
  });
});

describe('BR-101 und BR-102', () => {
  it('kennt keine Gesamtnote und keine Sortierung', () => {
    // Es gibt bewusst nichts, was die fünf Dimensionen zu **einer** Zahl
    // zusammenfasst oder Personen danach ordnet: Beides wäre eine Note über
    // einen Menschen. Geprüft wird die Quelle, weil sich das Fehlen einer
    // Funktion nicht aufrufen lässt.
    const source = readFileSync(`${process.cwd()}/src/lib/dimensions.ts`, 'utf8');

    expect(source).not.toMatch(/overall|score|grade|ranking/i);
    expect(source).not.toMatch(/\.sort\(/);
  });

  it('führt genau fünf Dimensionen in fester Reihenfolge', () => {
    expect([...DIMENSIONS]).toEqual([
      'engagement',
      'volunteering',
      'finance',
      'network',
      'loyalty',
    ]);
  });
});

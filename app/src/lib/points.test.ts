import { describe, expect, it } from 'vitest';
import type { PointTransaction } from './database.types';
import {
  bookingLabel,
  bookingPillar,
  filterBookings,
  seasonsOf,
  sumPoints,
} from './points';
import { seasonLabel } from './season';

const RULES = [
  { code: 'task_done', label: 'Aufgabe erledigt', pillar: 7 },
  { code: 'training_attend', label: 'Training besucht', pillar: 1 },
];

function booking(overrides: Partial<PointTransaction> = {}): PointTransaction {
  return {
    id: 'p-1',
    club_id: 'c-1',
    member_id: 'm-1',
    rule_code: 'task_done',
    points: 20,
    season: '2026/27',
    source_type: 'task',
    source_id: 's-1',
    note: null,
    created_at: '2026-09-01T10:00:00Z',
    created_by: null,
    ...overrides,
  } as PointTransaction;
}

describe('bookingLabel', () => {
  it('nennt den Anlass, wenn er in der Notiz steht (FR-041)', () => {
    expect(bookingLabel(booking({ note: 'Festbeiz-Bewilligung' }), RULES)).toBe(
      'Festbeiz-Bewilligung',
    );
  });

  it('fällt auf die Beschriftung der Regel zurück', () => {
    expect(bookingLabel(booking({ note: '   ' }), RULES)).toBe('Aufgabe erledigt');
  });

  it('zeigt den Regelcode erst, wenn es nichts Besseres gibt', () => {
    // Ein Code als Überschrift ist keine Auskunft – aber besser als nichts.
    expect(bookingLabel(booking({ note: null, rule_code: 'unbekannt' }), RULES)).toBe(
      'unbekannt',
    );
  });

  it('nennt die Quelle, wenn auch der Regelcode fehlt', () => {
    expect(
      bookingLabel(booking({ note: null, rule_code: null, source_type: 'manual' }), RULES),
    ).toBe('manual');
  });
});

describe('bookingPillar', () => {
  it('liest die Säule aus der Regel, denn der Ledger führt sie nicht', () => {
    expect(bookingPillar(booking(), RULES)).toBe(7);
  });

  it('gibt null zurück, wenn die Regel nicht mehr besteht', () => {
    expect(bookingPillar(booking({ rule_code: 'geloescht' }), RULES)).toBeNull();
  });
});

describe('seasonsOf', () => {
  it('nennt jede Saison einmal, die neueste zuerst', () => {
    const entries = [
      booking({ season: '2024/25' }),
      booking({ season: '2026/27' }),
      booking({ season: '2024/25' }),
    ];
    expect(seasonsOf(entries)).toEqual(['2026/27', '2024/25']);
  });

  it('kommt mit einer leeren Historie zurecht', () => {
    expect(seasonsOf([])).toEqual([]);
  });
});

describe('filterBookings', () => {
  const entries = [
    booking({ id: 'a', season: '2026/27', rule_code: 'task_done' }),
    booking({ id: 'b', season: '2026/27', rule_code: 'training_attend' }),
    booking({ id: 'c', season: '2024/25', rule_code: 'task_done' }),
  ];

  it('lässt ohne Filter alles durch (A2)', () => {
    expect(
      filterBookings(entries, { season: null, pillar: null }, RULES),
    ).toHaveLength(3);
  });

  it('schränkt auf eine Saison ein', () => {
    const shown = filterBookings(entries, { season: '2024/25', pillar: null }, RULES);
    expect(shown.map((e) => e.id)).toEqual(['c']);
  });

  it('schränkt auf eine Säule ein', () => {
    const shown = filterBookings(entries, { season: null, pillar: 1 }, RULES);
    expect(shown.map((e) => e.id)).toEqual(['b']);
  });

  it('kombiniert beide Filter', () => {
    const shown = filterBookings(entries, { season: '2026/27', pillar: 7 }, RULES);
    expect(shown.map((e) => e.id)).toEqual(['a']);
  });
});

describe('sumPoints', () => {
  it('zählt Korrekturbuchungen negativ mit (FR-043)', () => {
    expect(sumPoints([booking({ points: 50 }), booking({ points: -20 })])).toBe(30);
  });

  it('gibt für eine leere Auswahl 0 zurück', () => {
    expect(sumPoints([])).toBe(0);
  });
});

/**
 * BR-082: «Die Saisonzuordnung einer Buchung folgt derselben Berechnung in
 * Datenbank und App. Eine Abweichung ist ein Fehler.»
 *
 * Die Werte rechts sind gegen `season_label()` in der laufenden Datenbank
 * **nachgemessen** (Saisonstart 1. Juni). Laufen die beiden auseinander, zeigt
 * die App eine andere Saison an, als die Rangliste ausrechnet.
 */
describe('seasonLabel gegen season_label() (BR-082)', () => {
  const start = '2026-06-01';

  it('ordnet den letzten Tag vor dem Saisonstart der Vorsaison zu', () => {
    expect(seasonLabel(start, new Date('2027-05-31T12:00:00'))).toBe('2026/27');
  });

  it('beginnt die neue Saison am Starttag', () => {
    expect(seasonLabel(start, new Date('2027-06-01T12:00:00'))).toBe('2027/28');
  });

  it('stimmt am Stichtag des laufenden Jahres überein', () => {
    expect(seasonLabel(start, new Date('2026-09-09T12:00:00'))).toBe('2026/27');
  });
});

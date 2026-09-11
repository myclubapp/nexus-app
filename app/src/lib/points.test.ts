import { describe, expect, it } from 'vitest';
import type { PointTransaction } from './database.types';
import {
  bookingLabel,
  bookingPillar,
  canCorrect,
  filterBookings,
  monthBars,
  pointsPerMonth,
  seasonsOf,
  sumPoints,
  validateManualBooking,
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
    pillar: null,
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

  it('nimmt die Säule der Buchung, wenn sie eine trägt (UC-021)', () => {
    // Eine Buchung von Hand hat keine Regel, aus der sich die Säule ableiten
    // liesse – sie trägt sie selbst.
    const manual = booking({ rule_code: null, pillar: 3 });
    expect(bookingPillar(manual, RULES)).toBe(3);
  });

  it('lässt die eigene Säule der Regel vorgehen', () => {
    expect(bookingPillar(booking({ rule_code: 'task_done', pillar: 2 }), RULES)).toBe(2);
  });

  it('ignoriert eine Säule ausserhalb der sieben', () => {
    expect(bookingPillar(booking({ rule_code: null, pillar: 9 }), RULES)).toBeNull();
  });
});

describe('validateManualBooking', () => {
  const ok = { memberIds: ['m-1'], points: 10, note: 'Kuchen gebacken' };

  it('lässt eine vollständige Buchung durch', () => {
    expect(validateManualBooking(ok)).toEqual([]);
  });

  it('verlangt mindestens eine Person', () => {
    expect(validateManualBooking({ ...ok, memberIds: [] })).toContain('noMembers');
  });

  it('verlangt eine Notiz (BR-086)', () => {
    expect(validateManualBooking({ ...ok, note: '   ' })).toContain('noteMissing');
  });

  it('weist negative Werte und die Null ab (BR-087)', () => {
    // Ein Abzug entsteht ausschliesslich als Korrektur einer Buchung.
    expect(validateManualBooking({ ...ok, points: -5 })).toContain('pointsNotPositive');
    expect(validateManualBooking({ ...ok, points: 0 })).toContain('pointsNotPositive');
  });

  it('begrenzt die Sammelbuchung wie der Server (A3)', () => {
    const many = Array.from({ length: 101 }, (_, i) => `m-${i}`);
    expect(validateManualBooking({ ...ok, memberIds: many })).toContain(
      'tooManyMembers',
    );
  });
});

describe('canCorrect', () => {
  it('verlangt eine Begründung (A1)', () => {
    expect(canCorrect('')).toBe(false);
    expect(canCorrect('  ')).toBe(false);
    expect(canCorrect('Versehentlich zweimal gebucht')).toBe(true);
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

describe('pointsPerMonth (Konzept §7.1)', () => {
  const today = new Date(2026, 10, 15); // 15.11.2026, Saison ab 1. August

  it('führt jeden Monat vom Saisonstart bis heute, auch die leeren', () => {
    const months = pointsPerMonth(
      [
        { created_at: '2026-08-03T18:00:00', points: 10, season: '2026/27' },
        { created_at: '2026-08-20T18:00:00', points: 15, season: '2026/27' },
        { created_at: '2026-10-01T00:30:00', points: 20, season: '2026/27' },
        // Die Vorsaison zählt nicht mit.
        { created_at: '2026-07-20T18:00:00', points: 99, season: '2025/26' },
      ],
      '2026-08-01',
      today,
    );
    expect(months.map((entry) => entry.month.getMonth())).toEqual([7, 8, 9, 10]);
    expect(months.map((entry) => entry.points)).toEqual([25, 0, 20, 0]);
  });

  it('nimmt ohne Saisonstart das Kalenderjahr', () => {
    const months = pointsPerMonth([], null, new Date(2026, 2, 1));
    expect(months).toHaveLength(3);
    expect(months[0].month.getMonth()).toBe(0);
  });
});

describe('monthBars', () => {
  it('skaliert den höchsten Monat auf die volle Höhe und lässt Nullen leer', () => {
    const bars = monthBars([
      { month: new Date(2026, 7, 1), points: 20 },
      { month: new Date(2026, 8, 1), points: 0 },
      { month: new Date(2026, 9, 1), points: 40 },
    ]);
    expect(bars.map((bar) => bar.height)).toEqual([20, 0, 40]);
    expect(bars[0].x).toBeLessThan(bars[1].x);
  });

  it('zeichnet nichts ohne Punkte', () => {
    expect(monthBars([{ month: new Date(2026, 7, 1), points: 0 }])).toEqual([]);
  });
});

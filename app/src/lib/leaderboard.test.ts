import { describe, expect, it } from 'vitest';
import {
  ALL_POINTS,
  DEFAULT_LEADERBOARD_LIMIT,
  LEADERBOARD_PERIODS,
  hidesPoints,
  hasRankGap,
  leaderboardLimit,
  ownRank,
  parseSourceKey,
  sourceGroups,
  sourceKey,
  sourceQuery,
  type ClubPillar,
  type LeaderboardEntry,
} from './leaderboard';

function row(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    memberId: 'm-1',
    displayName: 'Anna',
    avatarUrl: null,
    totalPoints: 100,
    rank: 1,
    isSelf: false,
    ...overrides,
  };
}

describe('hasRankGap', () => {
  it('erkennt die Lücke vor der eigenen, weit hinteren Zeile (A3, BR-090)', () => {
    const rows = [
      row({ memberId: 'a', rank: 1 }),
      row({ memberId: 'b', rank: 2 }),
      row({ memberId: 'me', rank: 27, isSelf: true }),
    ];
    expect(hasRankGap(rows)).toBe(true);
  });

  it('zeigt keine Lücke, wenn die eigene Zeile direkt anschliesst', () => {
    const rows = [
      row({ memberId: 'a', rank: 1 }),
      row({ memberId: 'me', rank: 2, isSelf: true }),
    ];
    expect(hasRankGap(rows)).toBe(false);
  });

  it('zeigt keine Lücke, wenn die letzte Zeile nicht die eigene ist', () => {
    // Zwei Personen mit gleichem Rang stehen nebeneinander – das ist keine
    // Lücke, sondern ein geteilter Platz.
    const rows = [
      row({ memberId: 'me', rank: 1, isSelf: true }),
      row({ memberId: 'b', rank: 9 }),
    ];
    expect(hasRankGap(rows)).toBe(false);
  });

  it('kommt mit einer sehr kurzen Liste zurecht', () => {
    expect(hasRankGap([])).toBe(false);
    expect(hasRankGap([row({ isSelf: true })])).toBe(false);
  });
});

describe('ownRank', () => {
  it('nennt den eigenen Rang, auch weit hinten', () => {
    const rows = [row({ memberId: 'a', rank: 1 }), row({ rank: 42, isSelf: true })];
    expect(ownRank(rows)).toBe(42);
  });

  it('gibt null zurück, wenn man nicht in der Liste steht (BR-091)', () => {
    // Wer die Teilnahme abgewählt hat, erscheint in keiner Rangliste – auch
    // nicht in seiner eigenen Ansicht.
    expect(ownRank([row({ rank: 1 })])).toBeNull();
  });
});

describe('LEADERBOARD_PERIODS', () => {
  it('nennt dieselben vier Zeiträume wie der Server (FR-049)', () => {
    expect([...LEADERBOARD_PERIODS]).toEqual(['week', 'month', 'season', 'all']);
  });
});

describe('leaderboardLimit', () => {
  it('nimmt die Vorgabe, wenn der Verein nichts einstellt (A3)', () => {
    expect(leaderboardLimit(null)).toBe(DEFAULT_LEADERBOARD_LIMIT);
    expect(leaderboardLimit({})).toBe(DEFAULT_LEADERBOARD_LIMIT);
  });

  it('folgt der Einstellung des Vereins', () => {
    expect(leaderboardLimit({ leaderboard: { topOnly: 5 } })).toBe(5);
  });

  it('ignoriert eine Begrenzung, die keine Rangliste übrig liesse', () => {
    expect(leaderboardLimit({ leaderboard: { topOnly: 0 } })).toBe(
      DEFAULT_LEADERBOARD_LIMIT,
    );
    expect(leaderboardLimit({ leaderboard: { topOnly: -3 } })).toBe(
      DEFAULT_LEADERBOARD_LIMIT,
    );
  });
});

describe('hidesPoints (Konzept §7.2)', () => {
  it('zeigt Zahlen, solange der Verein nichts anderes sagt', () => {
    expect(hidesPoints(undefined)).toBe(false);
    expect(hidesPoints({})).toBe(false);
    expect(hidesPoints({ leaderboard: { topOnly: 10 } })).toBe(false);
  });

  it('lässt die Zahl weg, wenn der Verein es so eingestellt hat', () => {
    expect(hidesPoints({ leaderboard: { hidePoints: true } })).toBe(true);
  });
});

/** Die Säulen des Kadetten-Vereins, wie `club_pillars()` sie liefert. */
const clubPillars: ClubPillar[] = [
  { pillar: 1, dimension: 'engagement' },
  { pillar: 2, dimension: 'engagement' },
  { pillar: 3, dimension: 'volunteering' },
  { pillar: 4, dimension: 'network' },
  { pillar: 7, dimension: 'volunteering' },
];

describe('sourceKey / parseSourceKey', () => {
  it('führt jede Wahl unverändert hin und zurück', () => {
    const sources = [
      ALL_POINTS,
      { kind: 'dimension', dimension: 'volunteering' } as const,
      { kind: 'pillar', pillar: 3 } as const,
    ];

    for (const source of sources) {
      expect(parseSourceKey(sourceKey(source))).toEqual(source);
    }
  });

  it('fällt bei unbekannten Werten auf «alles» zurück, statt leer zu filtern', () => {
    // Ein Schlüssel aus einer älteren Fassung darf keine leere Rangliste
    // erzeugen – dann stünde die Seite ohne erkennbaren Grund leer da.
    expect(parseSourceKey(null)).toEqual(ALL_POINTS);
    expect(parseSourceKey('dimension:sportlichkeit')).toEqual(ALL_POINTS);
    expect(parseSourceKey('pillar:9')).toEqual(ALL_POINTS);
    expect(parseSourceKey('pillar:')).toEqual(ALL_POINTS);
  });
});

describe('sourceQuery', () => {
  it('schickt für «alles» weder Säule noch Dimension', () => {
    expect(sourceQuery(ALL_POINTS)).toEqual({ pillar: null, dimension: null });
  });

  it('schickt genau eine der beiden Achsen', () => {
    expect(sourceQuery({ kind: 'pillar', pillar: 3 })).toEqual({
      pillar: 3,
      dimension: null,
    });
    expect(sourceQuery({ kind: 'dimension', dimension: 'volunteering' })).toEqual({
      pillar: null,
      dimension: 'volunteering',
    });
  });
});

describe('sourceGroups', () => {
  it('gruppiert die Säulen in der Reihenfolge des Netzdiagramms', () => {
    const groups = sourceGroups(clubPillars);

    expect(groups.map((group) => group.dimension)).toEqual([
      'engagement',
      'volunteering',
      'network',
    ]);
    expect(groups[0].pillars).toEqual([1, 2]);
    // Säule 7 kommt nach 3, obwohl sie in der Eingabe zuletzt steht.
    expect(groups[1].pillars).toEqual([3, 7]);
  });

  it('macht die ganze Dimension nur dann wählbar, wenn mehrere Säulen darunter liegen', () => {
    const groups = sourceGroups(clubPillars);

    expect(groups[0].selectable).toBe(true);
    // «Netzwerk» besteht allein aus «Vereinsleben» – eine zweite Zeile für
    // dieselbe Menge wäre eine Wahl ohne Unterschied.
    expect(groups[2].selectable).toBe(false);
  });

  it('zeigt nur, was der Verein führt', () => {
    const groups = sourceGroups(clubPillars);
    const pillars = groups.flatMap((group) => group.pillars);

    // Säule 5 und 6 hat dieser Verein nie verwendet: Sie standen bisher
    // trotzdem zur Wahl und führten auf eine leere Rangliste.
    expect(pillars).not.toContain(5);
    expect(pillars).not.toContain(6);
  });

  it('hängt eine Säule ohne Dimension hinten an, statt sie zu verlieren', () => {
    const groups = sourceGroups([...clubPillars, { pillar: 5, dimension: null }]);

    expect(groups[groups.length - 1]).toEqual({
      dimension: null,
      pillars: [5],
      selectable: false,
    });
  });

  it('kommt mit einem Verein ohne jede Buchung zurecht', () => {
    expect(sourceGroups([])).toEqual([]);
  });
});

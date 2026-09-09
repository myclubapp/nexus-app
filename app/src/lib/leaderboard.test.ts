import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEADERBOARD_LIMIT,
  LEADERBOARD_PERIODS,
  hasRankGap,
  leaderboardLimit,
  ownRank,
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

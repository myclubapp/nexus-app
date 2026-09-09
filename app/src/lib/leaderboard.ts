import type { ClubSettings } from './database.types';

/** Zeiträume der Rangliste (FR-049) – dieselben Werte wie in `0039`. */
export const LEADERBOARD_PERIODS = ['week', 'month', 'season', 'all'] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

/** Vorgabe, wenn der Verein die Anzeige nicht selbst begrenzt (A3). */
export const DEFAULT_LEADERBOARD_LIMIT = 20;

/**
 * Wie viele Ränge der Verein anzeigen lässt (A3).
 *
 * Ein Wert unter 1 wäre eine Rangliste ohne Ränge – dann gilt die Vorgabe.
 * Die eigene Zeile kommt ohnehin immer mit (BR-090), die Begrenzung kann
 * also niemanden aus seiner eigenen Ansicht drängen.
 */
export function leaderboardLimit(settings: ClubSettings | null | undefined): number {
  const configured = settings?.leaderboard?.topOnly;
  if (typeof configured !== 'number' || !Number.isFinite(configured) || configured < 1) {
    return DEFAULT_LEADERBOARD_LIMIT;
  }
  return Math.floor(configured);
}

export interface LeaderboardEntry {
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  totalPoints: number;
  rank: number;
  /** Die eigene Zeile – sie kommt auch ausserhalb des Ausschnitts mit (BR-090). */
  isSelf: boolean;
}

/**
 * Steht die eigene Zeile abgesetzt unter dem Ausschnitt (A3, BR-090)?
 *
 * Der Server liefert die vorderen Ränge **und** die eigene Zeile. Liegt
 * dazwischen eine Lücke, soll man sie sehen – sonst liest sich Rang 3 direkt
 * vor Rang 27 wie eine durchgehende Liste, und die Rangfolge stimmte nicht
 * mehr.
 */
export function hasRankGap(rows: readonly LeaderboardEntry[]): boolean {
  if (rows.length < 2) return false;

  const last = rows[rows.length - 1];
  if (!last.isSelf) return false;

  return last.rank > rows[rows.length - 2].rank + 1;
}

/**
 * Der eigene Rang, auch wenn er ausserhalb des Ausschnitts liegt (BR-090).
 *
 * `null` heisst: Die eigene Person steht in dieser Rangliste nicht – weil sie
 * die Teilnahme abgewählt hat (BR-091), weil sie im gewählten Zeitraum keine
 * Punkte gesammelt hat, oder weil sie dem gewählten Team nicht angehört.
 */
export function ownRank(rows: readonly LeaderboardEntry[]): number | null {
  return rows.find((row) => row.isSelf)?.rank ?? null;
}

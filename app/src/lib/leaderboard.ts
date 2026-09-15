import type { ClubSettings } from './database.types';
import { DIMENSIONS, type Dimension } from './dimensions';
import { PILLARS, type Pillar } from './pointRule';

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

/**
 * Zeigt der Verein Ränge ohne Punktzahl (Konzept §7.2)?
 *
 * Eine Anonymisierungsoption, keine Verschleierung: Die Reihenfolge bleibt,
 * nur die Zahl, an der sich Vergleiche entzünden, fällt weg. Die eigene Zahl
 * steht weiterhin auf dem Dashboard.
 */
export function hidesPoints(settings: ClubSettings | null | undefined): boolean {
  return settings?.leaderboard?.hidePoints === true;
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

// ---------------------------------------------------------------------------
// Woher die Punkte stammen: Säule oder Dimension (FR-048, `0092`)
// ---------------------------------------------------------------------------

/**
 * Eine Säule, die dieser Verein führt, mit der Dimension, an der sie hängt.
 *
 * Beides kommt aus `club_pillars()`. Die Zuordnung Säule → Dimension steht
 * **einmal**, in `dimension_of_pillar()` (`0042`); hier wird sie gelesen und
 * nie nachgebaut – sonst zeigte die Auswahl eine andere Gruppierung an, als
 * die Rangliste rechnet.
 */
export interface ClubPillar {
  pillar: Pillar;
  /** `null`, falls der Server eine Säule ohne Dimension führt. */
  dimension: Dimension | null;
}

/**
 * Die Punktequelle, nach der die Rangliste gefiltert wird.
 *
 * Drei Weiten derselben Frage: alles, eine ganze Dimension («Ehrenamt»), oder
 * eine einzelne Säule («Freiwilliges Engagement»). Die Säule bleibt einzeln
 * wählbar, weil FR-048 ausdrücklich die Helferpunkte aus Säule 3 meint – und
 * «Ehrenamt» zusätzlich den Marktplatz enthält.
 */
export type PointSource =
  | { kind: 'all' }
  | { kind: 'dimension'; dimension: Dimension }
  | { kind: 'pillar'; pillar: Pillar };

/** Die Vorgabe: die Rangliste über alle Säulen. */
export const ALL_POINTS: PointSource = { kind: 'all' };

/**
 * Die Wahl als Zeichenkette – als Wert einer Listenzeile und als Teil des
 * Query-Keys. Ein Objekt taugt für keines von beidem.
 */
export function sourceKey(source: PointSource): string {
  switch (source.kind) {
    case 'dimension':
      return `dimension:${source.dimension}`;
    case 'pillar':
      return `pillar:${source.pillar}`;
    default:
      return 'all';
  }
}

/** Gegenstück zu `sourceKey()`; alles Unbekannte fällt auf «alles» zurück. */
export function parseSourceKey(key: string | null | undefined): PointSource {
  if (!key) return ALL_POINTS;

  const [kind, value] = key.split(':');
  if (kind === 'dimension' && DIMENSIONS.includes(value as Dimension)) {
    return { kind: 'dimension', dimension: value as Dimension };
  }
  if (kind === 'pillar') {
    const pillar = Number(value);
    if (PILLARS.includes(pillar as Pillar)) return { kind: 'pillar', pillar: pillar as Pillar };
  }
  return ALL_POINTS;
}

/** Die beiden Argumente, die `leaderboard_rows()` daraus braucht. */
export function sourceQuery(source: PointSource): {
  pillar: Pillar | null;
  dimension: Dimension | null;
} {
  return {
    pillar: source.kind === 'pillar' ? source.pillar : null,
    dimension: source.kind === 'dimension' ? source.dimension : null,
  };
}

/** Eine Dimension mit den Säulen, die dieser Verein darunter führt. */
export interface SourceGroup {
  /** `null` sammelt Säulen, die an keiner Dimension hängen. */
  dimension: Dimension | null;
  pillars: Pillar[];
  /**
   * Ist die ganze Dimension eine eigene Wahl?
   *
   * Nur, wenn mehr als eine Säule darunter liegt. «Netzwerk» besteht allein
   * aus «Vereinsleben» – zwei Zeilen für dieselbe Menge wären eine Wahl ohne
   * Unterschied.
   */
  selectable: boolean;
}

/**
 * Die Auswahl, nach Dimensionen gruppiert (Reihenfolge wie im Netzdiagramm).
 *
 * Gezeigt wird nur, was der Verein wirklich führt: `club_pillars()` liefert
 * die Säulen mit aktiver Regel **oder** mit Buchungen. Eine Säule, die dieser
 * Verein nie verwendet hat, stand bisher trotzdem in der Auswahl und führte
 * zuverlässig auf eine leere Rangliste.
 */
export function sourceGroups(rows: readonly ClubPillar[]): SourceGroup[] {
  const byDimension = new Map<Dimension | null, Pillar[]>();

  for (const row of rows) {
    const pillars = byDimension.get(row.dimension) ?? [];
    if (!pillars.includes(row.pillar)) pillars.push(row.pillar);
    byDimension.set(row.dimension, pillars);
  }

  const order = (dimension: Dimension | null) =>
    dimension === null ? DIMENSIONS.length : DIMENSIONS.indexOf(dimension);

  return [...byDimension.entries()]
    .sort(([a], [b]) => order(a) - order(b))
    .map(([dimension, pillars]) => ({
      dimension,
      pillars: [...pillars].sort((a, b) => a - b),
      selectable: dimension !== null && pillars.length > 1,
    }));
}

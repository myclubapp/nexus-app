/** Die fünf Wertdimensionen – dieselbe Reihenfolge wie in `0042`. */
export const DIMENSIONS = [
  'engagement',
  'volunteering',
  'finance',
  'network',
  'loyalty',
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

export interface ValueDimension {
  dimension: Dimension;
  ownValue: number;
  /** `null` heisst: die Bezugsgruppe ist zu klein (BR-104, A3). */
  teamValue: number | null;
  clubValue: number | null;
  /** `false` heisst **nicht erhoben** – und das ist nicht dasselbe wie null (BR-103). */
  collected: boolean;
  groupSize: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Ein Punkt auf der Achse `index` von `count`, bei `value` von hundert.
 *
 * Die erste Achse zeigt nach oben (−90°), danach im Uhrzeigersinn – so liest
 * sich das Netz wie eine Uhr und nicht wie ein Zufall.
 */
export function axisPoint(
  index: number,
  count: number,
  value: number,
  centre = 100,
  radius = 80,
): Point {
  const angle = (-90 + (360 / count) * index) * (Math.PI / 180);
  const scaled = (Math.max(0, Math.min(100, value)) / 100) * radius;
  return {
    x: centre + scaled * Math.cos(angle),
    y: centre + scaled * Math.sin(angle),
  };
}

/**
 * Die Punkte eines Linienzugs für das SVG.
 *
 * `null` lässt die Achse aus – für eine nicht erhobene Dimension (BR-103) und
 * für eine Vergleichslinie ohne genügend grosse Bezugsgruppe (BR-104). Eine
 * ausgelassene Achse ist ehrlicher als eine Null, die wie ein Ergebnis
 * aussieht.
 */
export function polygonPoints(
  values: readonly (number | null)[],
  centre = 100,
  radius = 80,
): string {
  return values
    .map((value, index) =>
      value === null ? null : axisPoint(index, values.length, value, centre, radius),
    )
    .filter((point): point is Point => point !== null)
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');
}

/** Die Eckpunkte des äusseren Netzes – die Hundert-Linie. */
export function gridPoints(count: number, centre = 100, radius = 80): string {
  return polygonPoints(Array.from({ length: count }, () => 100), centre, radius);
}

/**
 * Die stärkste Dimension (Schritt 4, BR-101).
 *
 * Nur erhobene Dimensionen kommen infrage, und nur solche mit einem Wert über
 * null: «Deine Stärke ist eine Dimension, in der du nichts hast» wäre keine
 * Würdigung. Ohne Beiträge gibt es keine Stärke zu benennen – dann sagt die
 * Ansicht das (A1), statt eine zu erfinden.
 */
export function strongestDimension(
  dimensions: readonly ValueDimension[],
): Dimension | null {
  const candidates = dimensions.filter((entry) => entry.collected && entry.ownValue > 0);
  if (candidates.length === 0) return null;

  return candidates.reduce((best, entry) =>
    entry.ownValue > best.ownValue ? entry : best,
  ).dimension;
}

/** Die Werte einer Reihe, mit `null` für alles, was nicht gezeigt werden darf. */
export function seriesOf(
  dimensions: readonly ValueDimension[],
  series: 'own' | 'team' | 'club',
): (number | null)[] {
  return dimensions.map((entry) => {
    if (!entry.collected) return null;
    if (series === 'own') return entry.ownValue;
    return series === 'team' ? entry.teamValue : entry.clubValue;
  });
}

/** Steht überhaupt eine Vergleichslinie zur Verfügung (A3)? */
export function hasSeries(
  dimensions: readonly ValueDimension[],
  series: 'team' | 'club',
): boolean {
  return seriesOf(dimensions, series).some((value) => value !== null);
}

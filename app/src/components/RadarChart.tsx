import { axisPoint, gridPoints, polygonPoints } from '../lib/dimensions';

export interface RadarSeries {
  /** `null` an einer Achse lässt sie aus – nicht erhoben oder zu kleine Gruppe. */
  values: (number | null)[];
  /** Ionic-Farbrolle, etwa `primary`. */
  tone: 'own' | 'team' | 'club';
}

interface RadarChartProps {
  labels: string[];
  series: RadarSeries[];
  /** Beschriftung für Bedienhilfen – das Diagramm selbst sagt ihnen nichts. */
  description: string;
}

const SIZE = 200;
const CENTRE = SIZE / 2;
const RADIUS = 74;
/** Die Beschriftung sitzt ausserhalb des Netzes, sonst liegt sie auf den Linien. */
const LABEL_RADIUS = 92;
const RINGS = [25, 50, 75, 100];

/**
 * Ein Netzdiagramm als SVG (UC-024).
 *
 * Eigenes Bauteil, weil es dafür keine Ionic-Komponente gibt und eine
 * Chart-Bibliothek eine Abhängigkeit wäre, die dieses eine Diagramm nicht
 * rechtfertigt (guidelines.md §1, Schritt 3). Die Farben kommen aus den
 * bestehenden Ionic-Variablen; die Klassen stehen zentral in
 * `theme/variables.css`.
 *
 * Für Bedienhilfen trägt das SVG eine Beschreibung: Ein Netz aus Linien ist
 * für eine Sprachausgabe nichts.
 */
export function RadarChart({ labels, series, description }: RadarChartProps) {
  const count = labels.length;

  return (
    <svg
      className="app-radar"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={description}
    >
      {/* Die Ringe geben der Skala einen Massstab, ohne Zahlen zu behaupten. */}
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          className="app-radar__grid"
          points={polygonPoints(
            Array.from({ length: count }, () => ring),
            CENTRE,
            RADIUS,
          )}
        />
      ))}

      {Array.from({ length: count }, (_, index) => {
        const outer = axisPoint(index, count, 100, CENTRE, RADIUS);
        return (
          <line
            key={index}
            className="app-radar__axis"
            x1={CENTRE}
            y1={CENTRE}
            x2={outer.x}
            y2={outer.y}
          />
        );
      })}

      {series.map((entry) => (
        <polygon
          key={entry.tone}
          className={`app-radar__series app-radar__series--${entry.tone}`}
          points={polygonPoints(entry.values, CENTRE, RADIUS)}
        />
      ))}

      {/* Der äussere Rahmen zuletzt, damit er über den Flächen liegt. */}
      <polygon
        className="app-radar__outline"
        points={gridPoints(count, CENTRE, RADIUS)}
      />

      {/* Ohne Beschriftung wäre das Netz Zierde: Man sähe eine Form und
          wüsste nicht, wovon sie handelt. */}
      {labels.map((label, index) => {
        const at = axisPoint(index, count, 100, CENTRE, LABEL_RADIUS);
        // Links vom Mittelpunkt endet der Text rechts und umgekehrt – sonst
        // ragt er über den Rand hinaus.
        const anchor =
          Math.abs(at.x - CENTRE) < 1 ? 'middle' : at.x > CENTRE ? 'start' : 'end';
        return (
          <text
            key={label}
            className="app-radar__label"
            x={at.x}
            y={at.y}
            textAnchor={anchor}
            dominantBaseline="middle"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

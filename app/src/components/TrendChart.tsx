import { trendPath, type TrendPoint } from '../lib/contextCheckin';

interface TrendChartProps {
  points: TrendPoint[];
  /** Beschriftung für Bedienhilfen – eine Linie sagt einer Sprachausgabe nichts. */
  description: string;
}

/**
 * Der eigene Zufriedenheitsverlauf als Linie (UC-032, FR-105).
 *
 * Eigenes Bauteil aus demselben Grund wie `RadarChart`: Es gibt dafür keine
 * Ionic-Komponente, und eine Chart-Bibliothek wäre eine Abhängigkeit, die
 * diese eine Linie nicht rechtfertigt (guidelines §1, Schritt 3). Die Rechnung
 * steht in `trendPath()` und ist dort geprüft; hier wird nur gezeichnet.
 *
 * Die Kurve trägt **keine** Zahlen an den Achsen. Der eigene Verlauf soll ein
 * Gefühl für die Richtung geben, keine Bewertung – und eine Skala mit
 * Beschriftung lädt zum Vergleichen ein, wo es nichts zu vergleichen gibt.
 */
export function TrendChart({ points, description }: TrendChartProps) {
  const path = trendPath(points);

  return (
    <svg
      className="app-trend"
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      role="img"
      aria-label={description}
    >
      {/* Die Mittellinie gibt der Kurve einen Bezug, ohne eine Note zu setzen. */}
      <line className="app-trend__grid" x1="0" y1="20" x2="100" y2="20" />
      {path && <path className="app-trend__line" d={path} />}
    </svg>
  );
}

import { useTranslation } from 'react-i18next';
import { monthBars, type MonthPoints } from '../lib/points';
import { appLocale } from '../lib/format';

interface MonthBarsProps {
  months: readonly MonthPoints[];
  /** Beschriftung für Bedienhilfen – Balken sagen einer Sprachausgabe nichts. */
  description: string;
}

/**
 * Der Saisonverlauf als Balken je Monat (Konzept §7.1).
 *
 * Eigenes Bauteil aus demselben Grund wie `TrendChart`: keine
 * Chart-Bibliothek für eine Handvoll Rechtecke (guidelines §1, Schritt 3).
 * Die Rechnung steht in `monthBars()` und ist dort geprüft.
 *
 * Auch hier keine Zahlen an einer Achse: Der Verlauf zeigt, wann etwas
 * geschah – die Summe steht darüber als Kennzahl, und die einzelnen Buchungen
 * stehen im Verlauf. Die Monatsnamen kommen aus der Sprache der Person.
 */
export function MonthBars({ months, description }: MonthBarsProps) {
  // Nur wegen des Neu-Renderns beim Sprachwechsel – `appLocale()` liest die Sprache selbst.
  useTranslation();
  const bars = monthBars(months);
  const label = new Intl.DateTimeFormat(appLocale(), { month: 'short' });

  return (
    <div className="app-bars" role="img" aria-label={description}>
      <svg className="app-bars__chart" viewBox="0 0 100 40" preserveAspectRatio="none">
        <line className="app-bars__grid" x1="0" y1="40" x2="100" y2="40" />
        {bars.map((bar, index) => (
          <rect
            key={months[index].month.toISOString()}
            className="app-bars__bar"
            x={bar.x}
            y={40 - bar.height}
            width={bar.width}
            height={bar.height}
          />
        ))}
      </svg>
      <div className="app-bars__labels" aria-hidden="true">
        {months.map((entry) => (
          <span key={entry.month.toISOString()}>{label.format(entry.month)}</span>
        ))}
      </div>
    </div>
  );
}

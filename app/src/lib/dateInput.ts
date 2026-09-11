/**
 * Datumsfelder (S4 der Prüfung vom 2026-09-11).
 *
 * Die Formulare halten ihre Werte in den Formaten der rohen Browser-Felder,
 * die sie vorher benutzt haben: `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`, `HH:mm`.
 * `IonDatetime` spricht ISO 8601 und gibt je nach Darstellung mehr zurück
 * (Sekunden, manchmal die ganze Zeit an einem reinen Datum). Diese beiden
 * Funktionen übersetzen an genau einer Stelle – die Formulare bleiben, wie
 * sie sind, und die Prüflogik dahinter (`validateEventDraft()` & Co.) sieht
 * dieselben Werte wie zuvor.
 */

export type DatePresentation = 'date' | 'date-time' | 'time';

/** Was das Bedienfeld anzeigen soll – `undefined` heisst «noch nichts gewählt». */
export function toPickerValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Was das Formular bekommt.
 *
 * `IonDatetime` liefert bei mehreren Werten ein Array; ein Datumsfeld hier
 * kennt immer nur einen. `null` und `undefined` heissen «gelöscht».
 */
export function fromPickerValue(
  raw: string | string[] | null | undefined,
  presentation: DatePresentation,
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return '';

  if (presentation === 'date') return value.slice(0, 10);
  if (presentation === 'date-time') return value.slice(0, 16);

  // time: «13:45:00» oder «2026-09-11T13:45:00» – gemeint sind fünf Zeichen.
  const at = value.indexOf('T');
  return (at >= 0 ? value.slice(at + 1) : value).slice(0, 5);
}

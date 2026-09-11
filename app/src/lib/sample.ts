/**
 * Beispielinhalte (UC-037).
 *
 * **BR-160: «Beispielinhalte sind immer gekennzeichnet.»** Ein Beispiel, das
 * aussieht wie ein echter Vereinsinhalt, ist schlimmer als eine leere Fläche –
 * es erzeugt eine Erwartung, die niemand einlöst.
 *
 * **BR-161: «Beispiele sind folgenlos.»** Sie erzeugen keine Punktebuchung,
 * kein Signal, keine Zustellung – und sie lassen sich weder übernehmen noch
 * zusagen (A2). Gesperrt ist das am Server (`claim_task()`, `take_shift()` und
 * die Policy `attendance_write_self` seit `0053`); diese Funktionen
 * entscheiden nur, ob ein Knopf erscheint.
 */

/** Die drei Arten, die als Beispiel entstehen – dieselben wie in `adopt_sample()`. */
export const SAMPLE_KINDS = ['event', 'task', 'news'] as const;
export type SampleKind = (typeof SAMPLE_KINDS)[number];

/** Trägt dieser Inhalt die Kennzeichnung? */
export function isSample(row: { is_sample?: boolean | null } | null | undefined): boolean {
  return row?.is_sample === true;
}

/**
 * Was an einem Beispielinhalt **nicht** geht (A2).
 *
 * Eine eigene Funktion und kein `!isSample(...)` an jeder Stelle: Die Regel ist
 * eine, und sie soll auch eine bleiben, wenn eine vierte Ansicht dazukommt.
 */
export function canActOn(row: { is_sample?: boolean | null } | null | undefined): boolean {
  return !isSample(row);
}

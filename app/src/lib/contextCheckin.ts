/**
 * Der Kontext-Check-in (UC-032).
 *
 * **Nicht zu verwechseln mit `check_in()`** aus UC-013: Das ist die Anwesenheit
 * über einen QR-Code. Hier geht es um Befinden – gleicher Wortstamm, andere
 * Sache. Deshalb heisst dieses Modul `contextCheckin` und nicht `checkIn`.
 *
 * Vier der sechs Regeln sind Verzichte: Gefragt wird nur das Subjektive
 * (BR-136), nie nach dem Grund einer Abwesenheit (BR-137), es gibt **keine
 * Punkte** (BR-138), und privat ist die Vorgabe (BR-139).
 */

/**
 * Die Kontexte – dieselben Werte wie der Constraint in `0050`.
 *
 * Es gibt **keinen** Wert für Abwesenheit, und das ist kein Versehen: BR-137
 * ist als Schema umgesetzt, nicht als Prüfung. Wo kein Wert existiert, lässt
 * sich auch keine Frage anlegen.
 */
export const CHECKIN_CONTEXTS = [
  'training_attended',
  'match_lineup',
  'match_bench',
  'helper_shift',
  'office_load',
] as const;
export type CheckinContext = (typeof CHECKIN_CONTEXTS)[number];

/** Die Antwortformate – dieselben Werte wie in `0050`. */
export const CHECKIN_SCALES = ['emoji5', 'stars5', 'freetext'] as const;
export type CheckinScale = (typeof CHECKIN_SCALES)[number];

/**
 * Wer eine Antwort sehen darf.
 *
 * Die Reihenfolge ist die der Offenheit, und `private` steht zuerst: Es ist die
 * Vorgabe, nicht eine Option unter dreien (BR-139).
 */
export const VISIBILITIES = ['private', 'shared_trainer', 'event_organizer'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** Die Höchstlänge eines Freitexts – derselbe Wert wie der Constraint in `0050`. */
export const MAX_CHECKIN_TEXT = 2000;

/** Ab dieser Zahl Antworten wird ein Team-Wert überhaupt ausgewiesen (BR-140). */
export const MIN_GROUP_SIZE = 5;

export interface CheckinPrompt {
  id: string;
  question: string;
  scale: CheckinScale;
  sort: number;
}

export interface CheckinInvitation {
  id: string;
  context: CheckinContext;
  eventTitle: string | null;
  askedOn: string;
}

export interface CheckinAnswer {
  promptId: string;
  /** Wert auf der Skala; `null` bei einer reinen Textfrage. */
  value: number | null;
  text: string;
}

export interface TrendPoint {
  at: string;
  context: CheckinContext;
  value: number;
}

/**
 * Welche Sichtbarkeiten dieser Kontext überhaupt anbietet.
 *
 * Ein Helfereinsatz kann an die organisierende Person gehen (A4) – ein
 * Training nicht: Dort gibt es keine solche Person, und ein Eintrag, der ins
 * Leere zeigt, wäre schlimmer als einer weniger.
 *
 * `office_load` bietet nur `private`: Der Entlastungs-Index ist die Frage, bei
 * der eine Weitergabe an die eigene Vorgesetzte am wenigsten harmlos wäre.
 */
export function visibilitiesFor(context: CheckinContext): Visibility[] {
  if (context === 'helper_shift') return ['private', 'event_organizer'];
  if (context === 'office_load') return ['private'];
  return ['private', 'shared_trainer'];
}

/**
 * Die Stufen einer Skala.
 *
 * Fünf, weil das Entitätsmodell fünf vorsieht – und weil eine gerade Zahl die
 * Mitte wegnimmt und damit eine Entscheidung erzwingt, die niemand treffen
 * wollte.
 */
export function scaleSteps(scale: CheckinScale): number[] {
  return scale === 'freetext' ? [] : [1, 2, 3, 4, 5];
}

export type CheckinProblem = 'answerMissing' | 'textTooLong';

/**
 * Was an einem Check-in fehlt (Schritt 5).
 *
 * Es genügt **eine** beantwortete Frage: Ein Check-in soll in unter zehn
 * Sekunden erledigt sein (FR-102), und wer die zweite Frage überspringt, hat
 * trotzdem etwas gesagt. Dieselbe Regel steht als Prüfung in `submit_checkin()`
 * – diese hier erspart der Person die Fehlermeldung, sie ersetzt sie nicht
 * (C-011).
 */
export function validateCheckin(answers: readonly CheckinAnswer[]): CheckinProblem[] {
  const problems: CheckinProblem[] = [];

  const answered = answers.filter(
    (answer) => answer.value !== null || answer.text.trim().length > 0,
  );
  if (answered.length === 0) problems.push('answerMissing');

  if (answers.some((answer) => answer.text.trim().length > MAX_CHECKIN_TEXT)) {
    problems.push('textTooLong');
  }

  return problems;
}

/** Die Antworten so, wie `submit_checkin()` sie erwartet – Leeres fällt weg. */
export function toPayload(answers: readonly CheckinAnswer[]) {
  return answers
    .filter((answer) => answer.value !== null || answer.text.trim().length > 0)
    .map((answer) => ({
      promptId: answer.promptId,
      value: answer.value === null ? '' : String(answer.value),
      text: answer.text.trim(),
    }));
}

/**
 * Reicht diese Gruppe für einen ausgewiesenen Wert (BR-140)?
 *
 * Die Frage steht hier und nicht in der Ansicht, damit sie an **einer** Stelle
 * beantwortet wird – und weil die Datenbank dasselbe noch einmal prüft.
 */
export function isGroupBigEnough(responses: number): boolean {
  return responses >= MIN_GROUP_SIZE;
}

/**
 * Die Punkte einer Verlaufskurve, auf eine Fläche von 100 × 40 gelegt.
 *
 * Reine Rechnung, damit sie prüfbar ist: Die Ansicht zeichnet nur noch.
 * Ein einzelner Punkt landet in der Mitte – eine Kurve aus einem Wert wäre
 * sonst eine Linie am Rand, die eine Entwicklung behauptet.
 */
export function trendPath(points: readonly TrendPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M 50 ${valueToY(points[0].value)}`;

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      return `${index === 0 ? 'M' : 'L'} ${round(x)} ${valueToY(point.value)}`;
    })
    .join(' ');
}

/** Fünf ist gut und gehört nach oben; die Skala ist im SVG umgekehrt. */
function valueToY(value: number): number {
  const clamped = Math.min(5, Math.max(1, value));
  return round(40 - ((clamped - 1) / 4) * 40);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Der Mittelwert des eigenen Verlaufs.
 *
 * Für die eigene Kurve gibt es **keine** Mindestgruppengrösse: BR-140 schützt
 * einzelne Personen in einer Gruppe, nicht die Person vor sich selbst.
 */
export function trendAverage(points: readonly TrendPoint[]): number | null {
  if (points.length === 0) return null;
  const sum = points.reduce((total, point) => total + point.value, 0);
  return round(sum / points.length);
}

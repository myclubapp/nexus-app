import type { AttendanceStatus } from './database.types';

/** Frist der Abmeldeprämie in Stunden – Gegenstück zu `decline_is_early()`. */
export const EARLY_DECLINE_HOURS = 24;

/**
 * Ist eine Absage jetzt noch «rechtzeitig» (BR-040)?
 *
 * Gegenstück zu `decline_is_early()` in `0017_attendance_response.sql`. Die App
 * zeigt damit vorab an, ob die Abmeldung noch Punkte bringt; entschieden wird
 * es auf dem Server. Laufen die beiden auseinander, verspricht die App Punkte,
 * die niemand bekommt.
 */
export function isEarlyDecline(
  startsAt: string | Date,
  now: Date = new Date(),
): boolean {
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  if (Number.isNaN(start.getTime())) return false;
  return start.getTime() - now.getTime() > EARLY_DECLINE_HOURS * 3_600_000;
}

/** Vorformulierte Absagegründe (A1 Schritt 1); der Schlüssel geht in die i18n. */
export const DECLINE_REASONS = [
  'ill',
  'work',
  'family',
  'travel',
  'injured',
  'other',
] as const;
export type DeclineReasonKey = (typeof DECLINE_REASONS)[number];

export interface EventResponseState {
  /** `null` heisst: noch nicht geantwortet. */
  status: AttendanceStatus | null;
  isCancelled: boolean;
  hasStarted: boolean;
}

/**
 * Darf jetzt noch geantwortet werden?
 *
 * A3 sperrt einen abgesagten Termin, BR-038 einen begonnenen. Beides prüft
 * auch `respond_to_event()` – hier geht es darum, die Knöpfe gar nicht erst
 * anzubieten.
 */
export function canRespond(state: Pick<EventResponseState, 'isCancelled' | 'hasStarted'>): boolean {
  return !state.isCancelled && !state.hasStarted;
}

export interface AttendanceTally {
  registered: number;
  excused: number;
  present: number;
  /** Betroffene ohne jede Antwort (Schritt 2, Grundlage für UC-015). */
  undecided: number;
}

/**
 * Teilnehmerstand eines Termins (Schritt 2).
 *
 * `affectedCount` ist die Zahl der Mitglieder, für die der Termin gilt –
 * ohne sie liesse sich «unentschlossen» nicht ausrechnen.
 */
export function tallyAttendance(
  entries: readonly { status: string }[],
  affectedCount: number,
): AttendanceTally {
  const count = (status: string) =>
    entries.filter((entry) => entry.status === status).length;

  const registered = count('registered');
  const excused = count('excused');
  const present = count('present');
  // Auch wer als abwesend vermerkt wurde, ist keine offene Frage mehr – die
  // Antwort steht, sie lautet nur nicht «ja». Ohne diese Zeile gälte die
  // Person weiter als unentschlossen und bekäme eine Erinnerung, obwohl der
  // Server sie als beantwortet führt (BR-059).
  const absent = count('absent');

  return {
    registered,
    excused,
    present,
    // Wer anwesend ist, hat sich damit auch entschieden.
    undecided: Math.max(0, affectedCount - registered - excused - present - absent),
  };
}

/**
 * Der hinterlegte Teilnehmerbedarf aus einer Eingabe (FR-029).
 *
 * Leer heisst **kein Bedarf**, nicht null: Die meisten Termine brauchen keine
 * Mindestzahl, und eine Null läse sich wie «null Leute genügen». Alles, was
 * keine positive ganze Zahl ist, gilt als leer – ein Tippfehler soll keine
 * Unterdeckung erfinden.
 */
export function parseCapacity(input: string): number | null {
  const value = Number(input.trim());
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

/**
 * Fehlen Zusagen (FR-029)?
 *
 * Gezählt werden Zusagen **und** bereits Anwesende: Wer eingecheckt ist, ist
 * da, auch wenn nie eine Zusage kam. Ohne hinterlegten Bedarf gibt es keine
 * Unterdeckung – ein Termin ohne Bedarf ist nie zu leer.
 */
export function coverageGap(
  capacityNeeded: number | null | undefined,
  tally: Pick<AttendanceTally, 'registered' | 'present'>,
): number {
  if (!capacityNeeded || capacityNeeded <= 0) return 0;
  return Math.max(0, capacityNeeded - tally.registered - tally.present);
}

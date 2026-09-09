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

  return {
    registered,
    excused,
    present,
    // Wer anwesend ist, hat sich damit auch entschieden.
    undecided: Math.max(0, affectedCount - registered - excused - present),
  };
}

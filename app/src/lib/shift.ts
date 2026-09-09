import type { EventShift } from './database.types';

/**
 * Vorgeschlagener Punktwert einer Schicht nach ihrer Dauer (Schritt 5).
 *
 * Die Spezifikation nennt «eine Punkteregel passend zur Dauer», weil ein
 * halber Tag und ein ganzer Tag unterschiedlich zählen (BR-042). Die Stufen
 * sind bewusst grob: Sie sind ein Vorschlag, den der Vorstand überschreibt.
 */
export function suggestedShiftPoints(durationMinutes: number): number {
  if (durationMinutes <= 0) return 0;
  if (durationMinutes <= 120) return 25; // bis zwei Stunden
  if (durationMinutes <= 300) return 50; // halber Tag
  return 100; // ganzer Tag
}

export interface ShiftDraft {
  title: string;
  /** Lokale Eingaben `YYYY-MM-DDTHH:mm`. */
  startsAt: string;
  endsAt: string;
  needed: number;
  points: number;
}

export type ShiftProblem =
  | 'titleMissing'
  | 'timesMissing'
  | 'endBeforeStart'
  | 'neededTooLow';

/** Was an einer Schicht noch fehlt (BR-041, Constraint aus `0018`). */
export function validateShift(draft: ShiftDraft): ShiftProblem[] {
  const problems: ShiftProblem[] = [];

  if (draft.title.trim().length < 2) problems.push('titleMissing');
  if (!draft.startsAt || !draft.endsAt) {
    problems.push('timesMissing');
  } else {
    const start = new Date(draft.startsAt);
    const end = new Date(draft.endsAt);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
      problems.push('endBeforeStart');
    }
  }
  if (!Number.isFinite(draft.needed) || draft.needed < 1) problems.push('neededTooLow');

  return problems;
}

export interface ShiftCoverage {
  filled: number;
  needed: number;
  /** Wie viele Plätze noch offen sind; nie negativ. */
  open: number;
  isFull: boolean;
}

/**
 * Besetzung einer Schicht (BR-041, BR-046).
 *
 * Gezählt werden Eintragungen und bestätigte Anwesenheiten – eine Absage
 * belegt keinen Platz. `open` ist die Unterdeckung, die die App «jederzeit»
 * zeigen soll.
 */
export function shiftCoverage(
  shift: Pick<EventShift, 'id' | 'needed'>,
  attendance: readonly { shift_id: string | null; status: string }[],
): ShiftCoverage {
  const filled = attendance.filter(
    (entry) =>
      entry.shift_id === shift.id &&
      (entry.status === 'registered' || entry.status === 'present'),
  ).length;

  return {
    filled,
    needed: shift.needed,
    open: Math.max(0, shift.needed - filled),
    isFull: filled >= shift.needed,
  };
}

/**
 * Überschneiden sich zwei Schichten zeitlich (UC-012 A4)?
 *
 * Berührung zählt nicht als Überschneidung: Wer um 12:00 aufhört und um 12:00
 * anfängt, hat zwei anschliessende Schichten, kein Problem.
 */
export function shiftsOverlap(
  a: Pick<EventShift, 'starts_at' | 'ends_at'>,
  b: Pick<EventShift, 'starts_at' | 'ends_at'>,
): boolean {
  const aStart = new Date(a.starts_at).getTime();
  const aEnd = new Date(a.ends_at).getTime();
  const bStart = new Date(b.starts_at).getTime();
  const bEnd = new Date(b.ends_at).getTime();

  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false;
  return aStart < bEnd && bStart < aEnd;
}

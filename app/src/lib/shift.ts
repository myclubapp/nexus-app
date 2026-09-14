import type { EventShift } from './database.types';

/**
 * Vorgeschlagener Punktwert einer Schicht nach ihrer Dauer (Schritt 5).
 *
 * Die Spezifikation nennt «eine Punkteregel passend zur Dauer», weil ein
 * halber Tag und ein ganzer Tag unterschiedlich zählen (BR-042). Die Stufen
 * sind bewusst grob: Sie sind ein Vorschlag, den der Vorstand überschreibt.
 *
 * **Gegenstück zu `suggested_shift_points()` in `0080`.** Dort leitet die
 * Übernahme aus der bisherigen App denselben Wert ab, weil ein fremder
 * Punktwert keine Punktzahl dieser Skala ist (BR-204). Laufen die beiden
 * auseinander, zählt eine übernommene Schicht anders als eine hier angelegte –
 * dieselbe Gefahr wie bei `season_label()`/`seasonLabel()`.
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
 * Wie viele Einsätze der Marktplatz zeigt, bevor «Mehr anzeigen» übernimmt.
 *
 * Der Marktplatz ist eine Übersicht über mehrere Angebote – Aufgaben, Ämter,
 * Einsätze. Ein einzelner Abschnitt darf sie deshalb nicht ausfüllen; der
 * Rest steht in der Agenda, gefiltert auf Einsätze.
 */
export const MARKETPLACE_SHIFT_LIMIT = 5;

/**
 * Termine mit offenen Schichten (UC-011, Schritt 9 und A3).
 *
 * Die Postcondition verlangt das Helfer-Event «in Agenda **und** Marktplatz».
 * Der Marktplatz fragt nur eines: Wo kann ich beitragen? Also zählt hier
 * ausschliesslich, wo noch Plätze frei sind – und nur in der Zukunft: Eine
 * Schicht von gestern ist kein Angebot, sondern eine Lücke in der Geschichte.
 *
 * Ein Entwurf, eine Absage und ein Beispielinhalt kommen nicht vor; das
 * entscheidet die aufrufende Seite über die Termine, die sie übergibt.
 */
export interface ShiftOffer<E> {
  event: E;
  open: number;
  needed: number;
}

export function openShiftOffers<
  E extends {
    shifts?: readonly (Pick<EventShift, 'id' | 'needed'> & { ends_at: string })[] | null;
    attendance?: readonly { shift_id: string | null; status: string }[] | null;
  },
>(events: readonly E[], now: Date = new Date()): ShiftOffer<E>[] {
  const offers: ShiftOffer<E>[] = [];

  for (const event of events) {
    let open = 0;
    let needed = 0;

    for (const shift of event.shifts ?? []) {
      if (new Date(shift.ends_at) <= now) continue;
      const coverage = shiftCoverage(shift, event.attendance ?? []);
      open += coverage.open;
      needed += coverage.needed;
    }

    if (open > 0) offers.push({ event, open, needed });
  }

  return offers;
}

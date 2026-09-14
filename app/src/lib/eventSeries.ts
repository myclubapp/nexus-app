import type { EventType } from './database.types';
import { toLocalInput } from './format';

/** Rhythmus einer Terminserie (A1). */
export const SERIES_RHYTHMS = ['weekly', 'biweekly', 'monthly'] as const;
export type SeriesRhythm = (typeof SERIES_RHYTHMS)[number];

export interface SeriesRule {
  rhythm: SeriesRhythm;
  /** Erster Termin der Serie, als `YYYY-MM-DDTHH:mm`. */
  startsAt: string;
  /** Letzter möglicher Termin, als `YYYY-MM-DD`. */
  until: string;
  /** Dauer eines Termins in Minuten; `null` heisst ohne Endzeit. */
  durationMinutes: number | null;
}

/**
 * Obergrenze der Vorschau.
 *
 * Ein Tippfehler im Enddatum – 2036 statt 2026 – erzeugte sonst Hunderte von
 * Terminen. Die Grenze schützt die Agenda und die Benachrichtigungen.
 */
export const MAX_SERIES_EVENTS = 60;

export interface SeriesOccurrence {
  startsAt: string;
  endsAt: string | null;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  // Der 31. eines Monats fällt im nächsten sonst auf den 1. des übernächsten.
  if (next.getDate() < day) next.setDate(0);
  return next;
}

/**
 * Die Termine einer Serie berechnen (A1, Schritt 2 «Vorschau»).
 *
 * Reine Funktion: Dieselbe Liste zeigt die Vorschau und legt die Termine an –
 * sonst entstünden andere Termine als angekündigt.
 */
export function expandSeries(rule: SeriesRule): SeriesOccurrence[] {
  const start = new Date(rule.startsAt);
  if (Number.isNaN(start.getTime())) return [];

  const until = new Date(`${rule.until}T23:59:59`);
  if (Number.isNaN(until.getTime()) || until < start) return [];

  const occurrences: SeriesOccurrence[] = [];
  let current = start;

  while (current <= until && occurrences.length < MAX_SERIES_EVENTS) {
    const endsAt =
      rule.durationMinutes && rule.durationMinutes > 0
        ? toLocalInput(new Date(current.getTime() + rule.durationMinutes * 60_000))
        : null;

    occurrences.push({ startsAt: toLocalInput(current), endsAt });

    current =
      rule.rhythm === 'monthly'
        ? addMonths(current, 1)
        : addDays(current, rule.rhythm === 'biweekly' ? 14 : 7);
  }

  return occurrences;
}

/** Dauer zwischen zwei lokalen Eingabewerten in Minuten; `null` ohne Ende. */
export function durationInMinutes(
  startsAt: string,
  endsAt: string | null | undefined,
): number | null {
  if (!endsAt) return null;
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  return minutes > 0 ? minutes : null;
}

/** Termintypen, die ein ausgefülltes Warum verlangen (BR-036). */
export const TYPES_REQUIRING_WHY: readonly EventType[] = ['helper', 'gv', 'social'];

export function requiresWhy(type: EventType): boolean {
  return TYPES_REQUIRING_WHY.includes(type);
}

/**
 * Vorgeschlagene Punkteregel zum Termintyp (Schritt 6).
 *
 * Die Codes stammen aus `seed_point_rules()`. Ein Verein, der eine Regel
 * umbenannt oder gelöscht hat, bekommt keinen Vorschlag – dann wählt die
 * Trainer:in selbst.
 */
const RULE_BY_TYPE: Partial<Record<EventType, string>> = {
  training: 'training_attend',
  match: 'match_attend',
  gv: 'assembly_attend',
  social: 'event_attend',
  helper: 'shift_done',
};

export function suggestedRuleCode(
  type: EventType,
  availableCodes: readonly string[],
): string | null {
  const suggestion = RULE_BY_TYPE[type];
  return suggestion && availableCodes.includes(suggestion) ? suggestion : null;
}

export interface EventDraft {
  type: EventType;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  why: string;
  teamId: string | null;
  pointRuleCode: string | null;
}

export type EventDraftProblem =
  | 'titleMissing'
  | 'startMissing'
  | 'endBeforeStart'
  | 'whyMissing';

/**
 * Was am Entwurf noch fehlt (A5, BR-036).
 *
 * Reine Funktion, weil sich Ionic-Eingaben im Test nicht bedienen lassen –
 * die Prüfung selbst ist damit vollständig abgedeckt.
 */
export function validateEventDraft(draft: EventDraft): EventDraftProblem[] {
  const problems: EventDraftProblem[] = [];

  if (draft.title.trim().length < 2) problems.push('titleMissing');
  if (!draft.startsAt) problems.push('startMissing');

  if (draft.startsAt && draft.endsAt) {
    const start = new Date(draft.startsAt);
    const end = new Date(draft.endsAt);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
      problems.push('endBeforeStart');
    }
  }

  if (requiresWhy(draft.type) && draft.why.trim().length === 0) {
    problems.push('whyMissing');
  }

  return problems;
}

// --- Ändern und Absagen (UC-009, A2 und Schritt 11) ------------------------

/** Was ein Termin zum Ändern und Absagen mitbringen muss. */
export interface EditableEvent {
  cancelledAt: string | null;
  startsAt: string;
  seriesId: string | null;
}

/**
 * Lässt sich dieser Termin noch absagen (FR-023)?
 *
 * Ein bereits abgesagter Termin nicht – die Absage steht, und ein zweiter
 * Grund überschriebe den ersten, den alle Betroffenen bereits gelesen haben.
 * Ein vergangener Termin ebenso wenig: Was stattgefunden hat, sagt man nicht
 * mehr ab; es wäre eine Geschichtsfälschung gegenüber den Anwesenden.
 */
export function canCancelEvent(event: EditableEvent, now: Date = new Date()): boolean {
  return event.cancelledAt === null && new Date(event.startsAt) > now;
}

/**
 * Ist der Termin Teil einer Serie und kann die Änderung sie mitnehmen (A2)?
 *
 * Die Frage stellt sich nur bei Terminen mit Serie – sonst wäre sie eine
 * Auswahl mit einer Möglichkeit.
 */
export function hasSeriesChoice(event: EditableEvent): boolean {
  return event.seriesId !== null;
}

export type CancelProblem = 'reasonMissing';

/**
 * BR-035: Eine Absage braucht einen Grund.
 *
 * Die Regel steht am Server (`cancel_event()` weist ohne Grund ab) und hier –
 * nicht damit sie zweimal gilt, sondern damit der Knopf gesperrt ist, statt
 * eine Fehlermeldung zu erzeugen.
 */
export function validateCancel(reason: string): CancelProblem[] {
  return reason.trim().length < 3 ? ['reasonMissing'] : [];
}

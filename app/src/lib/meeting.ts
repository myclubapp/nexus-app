/**
 * Der Dialog um die Sitzung (UC-031).
 *
 * Der Leitsatz des Moduls steht in `MVP_Scope_myclub.md` §13: **«Die App
 * verwaltet nicht die Sitzung, sondern den Dialog um die Sitzung.»** Was hier
 * fehlt, fehlt deshalb mit Absicht – kein Traktandum, kein Protokoll, keine
 * Beschlussverwaltung (BR-132).
 *
 * Die Entscheidungen stehen als reine Funktionen hier und nicht in den
 * Ereignis-Handlern der Seiten: In jsdom lässt sich keine Ionic-Eingabe
 * bedienen (docs/TESTING.md §6.4, guidelines §9), und eine Regel, die nur im
 * Handler steht, ist eine ungeprüfte Regel.
 */

/** Wo die Tickets der anonymen Inputs liegen (A1). */
export const MEETING_TICKET_KEY = 'myclub.meetingTickets';

/** Die Höchstlänge des Textes – derselbe Wert wie der Constraint in `0049`. */
export const MAX_INPUT_BODY = 5000;

/** Die Bearbeitungsstände eines Inputs – dieselben Werte wie in `0049`. */
export const INPUT_STATUSES = [
  'open',
  'scheduled',
  'in_progress',
  'answered',
  'declined',
] as const;
export type InputStatus = (typeof INPUT_STATUSES)[number];

// Seit UC-041 lebt das Amt in `lib/office.ts` – mit Factsheet, Belegung und
// der Sitzrechnung (BR-183). Die Sitzungs-Blätter lesen es weiterhin von hier.
export {
  isVacant,
  validateOffice,
  type Office,
  type OfficeDraft,
  type OfficeProblem,
} from './office';

export interface MeetingInput {
  id: string;
  body: string;
  status: InputStatus;
  committeeRoleIds: string[];
  meetingEventId: string | null;
  response: string | null;
  respondedAt: string | null;
  isMine: boolean;
  isAnonymous: boolean;
  createdAt: string;
}

/** Ein Input mit Endstatus ist abgeschlossen. */
export function isInputClosed(status: InputStatus): boolean {
  return status === 'answered' || status === 'declined';
}

/**
 * Darf ich diesen Input triagieren (Schritt 7)?
 *
 * Die Policy aus `0049` gibt nur heraus, was mir gehört oder an ein Amt
 * gerichtet ist, das ich halte – und dem Vorstand alles. Was **nicht** meines
 * ist, ist folglich an mich gerichtet. Der Server prüft es ohnehin nochmals;
 * diese Frage entscheidet nur, in welchem Korb die Zeile erscheint.
 */
export function isInbox(input: MeetingInput): boolean {
  return !input.isMine;
}

export type InputProblem = 'bodyMissing' | 'bodyTooLong' | 'committeeMissing';

export interface InputDraft {
  body: string;
  /** Die Ämter, die das Zielgremium bilden (BR-133). */
  committeeRoleIds: string[];
  anonymous: boolean;
  /** Ein eigenes Anliegen als Quelle (Schritt 3, über UC-029). */
  sourceNoteId: string | null;
}

/**
 * Was an einem Input fehlt (Schritte 2–5).
 *
 * Ein Gremium ist Pflicht: Ein Eingangskorb ohne Eigentümer wäre genau das
 * Versanden, das §13.3 ausschliesst. Dieselbe Regel steht als Constraint in
 * der Datenbank – diese Prüfung erspart der Person die Fehlermeldung, sie
 * ersetzt sie nicht (C-011).
 */
export function validateInput(draft: InputDraft): InputProblem[] {
  const problems: InputProblem[] = [];

  const body = draft.body.trim();
  if (body.length === 0) problems.push('bodyMissing');
  if (body.length > MAX_INPUT_BODY) problems.push('bodyTooLong');
  if (draft.committeeRoleIds.length === 0) problems.push('committeeMissing');

  return problems;
}

/** Zu jedem Entscheid gehört seine Begründung (§13.3). */
export function canDecide(text: string): boolean {
  return text.trim().length > 0;
}

/** Die drei Arten, die `meeting_agenda()` liefert – und **nur** diese. */
export const AGENDA_KINDS = ['input', 'vacancy', 'shift'] as const;
export type AgendaKind = (typeof AGENDA_KINDS)[number];

export interface AgendaRow {
  kind: AgendaKind;
  refId: string;
  title: string;
  detail: string | null;
}

export interface Agenda {
  inputs: AgendaRow[];
  vacancies: AgendaRow[];
  shifts: AgendaRow[];
}

/**
 * Die Sammelansicht in ihre drei Körbe teilen (BR-135).
 *
 * Alles, was keine der drei Arten ist, fällt heraus. Das ist die Stelle, an der
 * BR-132 im Client steht: Selbst wenn die Datenbank eines Tages eine vierte Art
 * lieferte, entstünde in dieser Ansicht kein Traktandum – sie hätte keinen Korb
 * dafür.
 */
export function groupAgenda(rows: readonly AgendaRow[]): Agenda {
  return {
    inputs: rows.filter((row) => row.kind === 'input'),
    vacancies: rows.filter((row) => row.kind === 'vacancy'),
    shifts: rows.filter((row) => row.kind === 'shift'),
  };
}

/**
 * Ist diese Sammelansicht leer?
 *
 * Eine Sitzung ohne Input und ohne Dauerthema ist eine gute Nachricht, keine
 * Fehlanzeige – die Ansicht sagt das, statt drei leere Abschnitte zu zeigen.
 */
export function isAgendaEmpty(agenda: Agenda): boolean {
  return (
    agenda.inputs.length === 0 &&
    agenda.vacancies.length === 0 &&
    agenda.shifts.length === 0
  );
}

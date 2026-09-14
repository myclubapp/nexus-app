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
  /** Der Termin hat Schichten – dann ist die Schicht die Antwort (BR-196). */
  viaShifts?: boolean;
}

/**
 * Darf jetzt noch geantwortet werden?
 *
 * A3 sperrt einen abgesagten Termin, BR-038 einen begonnenen. Beides prüft
 * auch `respond_to_event()` – hier geht es darum, die Knöpfe gar nicht erst
 * anzubieten. BR-196 sperrt dazu den Anlass mit Schichten: Dort gibt es keine
 * Zusage zum Termin, nur die zur Schicht (`respondsViaShifts()`).
 */
export function canRespond(
  state: Pick<EventResponseState, 'isCancelled' | 'hasStarted' | 'viaShifts'>,
): boolean {
  return !state.isCancelled && !state.hasStarted && !state.viaShifts;
}

/**
 * Läuft die Verbindlichkeit bei diesem Termin über Schichten (BR-196)?
 *
 * Ein Termin mit Schichten kennt keine Zusage zum Anlass. Die Schicht ist die
 * Antwort (BR-048): Nur sie zählt für die Besetzung, die Punkte (BR-045) und
 * den Kalender (UC-012, Schritt 7). Ein Haken daneben hätte keine Folge – bei
 * vollen Schichten sähe er aus wie eine Anmeldung, die es nicht gibt –, und
 * «Keine Antwort» listete bei einem Anlass ohne Team den ganzen Verein.
 */
export function respondsViaShifts(event: { shifts?: readonly unknown[] | null }): boolean {
  return (event.shifts?.length ?? 0) > 0;
}

/**
 * Hält die Person eine Schicht dieses Termins (UC-012)?
 *
 * Gezählt wird wie in `shiftCoverage()`: Eintragung oder bestätigte
 * Anwesenheit. Eine Absage hält keinen Platz.
 */
export function holdsShift(
  entries: readonly { member_id: string; shift_id: string | null; status: string }[],
  memberId: string | null | undefined,
): boolean {
  if (!memberId) return false;
  return entries.some(
    (entry) =>
      entry.member_id === memberId &&
      entry.shift_id !== null &&
      (entry.status === 'registered' || entry.status === 'present'),
  );
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

/** Was die Gruppierung von einer Antwort braucht. */
export interface AttendanceEntry {
  member_id: string;
  shift_id: string | null;
  status: string;
  responded_at: string | null;
  decline_reason: string | null;
}

export interface AttendanceGroups<M> {
  /** Zugesagt oder schon anwesend. */
  registered: { member: M; entry: AttendanceEntry }[];
  /** Abgesagt oder als abwesend vermerkt. */
  excused: { member: M; entry: AttendanceEntry }[];
  /** Betroffene ohne jede Antwort. */
  undecided: M[];
}

/**
 * Die Antworten eines Termins nach Personen gruppiert – die drei Listen
 * «Zugesagt», «Abgesagt» und «Keine Antwort» aus der bestehenden myclub-App.
 *
 * Gezählt werden nur Antworten auf den **Termin** (`shift_id === null`); eine
 * übernommene Schicht ist keine Zusage zum Anlass. Und es zählen nur die
 * Betroffenen: Wer nicht zum Team gehört, taucht in keiner Liste auf – auch
 * nicht in «Keine Antwort», dort wäre er eine falsche Erwartung.
 */
export function groupAttendance<M extends { id: string }>(
  entries: readonly AttendanceEntry[],
  members: readonly M[],
): AttendanceGroups<M> {
  const byMember = new Map(
    entries
      .filter((entry) => entry.shift_id === null)
      .map((entry) => [entry.member_id, entry] as const),
  );

  const groups: AttendanceGroups<M> = { registered: [], excused: [], undecided: [] };

  for (const member of members) {
    const entry = byMember.get(member.id);
    if (!entry) {
      groups.undecided.push(member);
    } else if (entry.status === 'registered' || entry.status === 'present') {
      groups.registered.push({ member, entry });
    } else {
      groups.excused.push({ member, entry });
    }
  }

  return groups;
}

/** Die vier Arten eines Anliegens – dieselben Werte wie in `0046`. */
export const VOICE_KINDS = [
  'self_reflection',
  'coach_log',
  'feedback',
  'anonymous',
] as const;
export type VoiceKind = (typeof VOICE_KINDS)[number];

export type VoiceTarget = 'person' | 'trainer' | 'admin' | 'team';

export interface VoiceNote {
  id: string;
  kind: VoiceKind;
  transcript: string;
  status: string;
  response: string | null;
  createdWeek: string;
  createdAt: string | null;
  isMine: boolean;
  flagged: boolean;
  taskId: string | null;
}

/**
 * Darf ich dieses Anliegen bearbeiten (UC-030)?
 *
 * Die Policy aus `0046` gibt nur heraus, was mir gehört oder an mich gerichtet
 * ist. Was **nicht** meines ist und keine private Art hat, ist folglich an
 * mich gerichtet – und genau das darf ich beantworten. Der Server prüft es
 * ohnehin nochmals; diese Frage entscheidet nur, ob der Knopf erscheint.
 */
export function canHandle(note: VoiceNote): boolean {
  return !note.isMine && !isPrivate(note.kind) && !note.flagged;
}

/** Ein Anliegen mit Endstatus ist abgeschlossen (BR-128). */
export function isClosed(note: VoiceNote): boolean {
  return note.status === 'answered' || note.status === 'declined';
}

/**
 * Die Zwischenstände, die von Hand gesetzt werden (Schritt 4).
 *
 * Die Endstände fehlen mit Absicht: Sie entstehen nur zusammen mit einer
 * Antwort (BR-128) – `set_note_status()` lehnt sie in `0047` ebenso ab.
 */
export const NOTE_STATUSES = ['open', 'in_progress'] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export interface AnonMessage {
  side: 'board' | 'author';
  body: string;
  at: string;
}

export interface AnonThread {
  /**
   * Der Prüfwert des Tickets, über den dieser Faden geholt wurde.
   *
   * Er hängt am Faden und nicht an seiner Position in einer Liste: Nicht jedes
   * Ticket führt zu einem Faden, und ein Nachfassen am falschen Faden wäre
   * genau der Fehler, den BR-129 ausschliesst.
   */
  tokenHash: string;
  noteId: string;
  transcript: string;
  status: string;
  createdWeek: string;
  messages: AnonMessage[];
}

/**
 * Wo die Tickets des anonymen Rückkanals liegen (A2).
 *
 * Der Schlüssel steht hier und nicht in der Ansicht: Die Seite, die ein Ticket
 * ablegt, und die, die den Faden abholt, müssen denselben Speicher meinen.
 */
export const TICKET_KEY = 'myclub.voiceTickets';

/** Die Tickets auf diesem Gerät (A2). */
export function readTickets(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/** Die Tickets dieses Geräts, ohne dass der Speicher die Seite umbringt. */
export function readStoredTickets(): string[] {
  try {
    return readTickets(window.localStorage.getItem(TICKET_KEY));
  } catch {
    // Privates Fenster oder gesperrter Speicher: kein Rückkanal, kein Absturz.
    return [];
  }
}

/**
 * Ein Ticket ablegen. Der Rückgabewert sagt, ob der Rückweg besteht.
 *
 * Wo der Speicher gesperrt ist, geht das Anliegen trotzdem raus – nur die
 * Antwort erreicht niemanden mehr. Das muss die Person erfahren, statt es
 * später zu bemerken.
 */
export function storeTicket(ticket: string): boolean {
  try {
    window.localStorage.setItem(
      TICKET_KEY,
      JSON.stringify([...readStoredTickets(), ticket]),
    );
    return true;
  } catch {
    return false;
  }
}

/** Die Höchstlänge des Textes – dieselbe wie der Constraint in `0046`. */
export const MAX_TRANSCRIPT = 5000;

/**
 * Ist ein Anliegen privat?
 *
 * Selbstreflexion und Trainer-Logbuch erreichen niemanden – sie sind das
 * Gegenteil einer Nachricht (BR-123).
 */
export function isPrivate(kind: VoiceKind): boolean {
  return kind === 'self_reflection' || kind === 'coach_log';
}

/** Braucht diese Art eine Adressierung? */
export function needsTarget(kind: VoiceKind): boolean {
  return kind === 'feedback';
}

/** Zu einem Entscheid gehört seine Begründung (BR-128). */
export function canAnswer(text: string): boolean {
  return text.trim().length > 0;
}

export type AnswerProblem = 'answerMissing' | 'taskTitleMissing' | 'taskWhyMissing';

export interface AnswerDraft {
  text: string;
  /** A3: Aus dem Anliegen soll eine Aufgabe entstehen. */
  asTask: boolean;
  taskTitle: string;
  taskWhy: string;
}

/**
 * Was einer Antwort fehlt (UC-030, Schritte 5–6).
 *
 * Die Entscheidung steht hier und nicht im Ereignis-Handler des Blattes: In
 * jsdom lässt sich eine Ionic-Eingabe nicht bedienen (docs/TESTING.md §6),
 * und eine Regel, die nur im Handler steht, ist eine ungeprüfte Regel.
 *
 * Der Text ist für **beide** Ausgänge Pflicht – die Ablehnung ist eine
 * Antwort, kein Ausbleiben (BR-128). Die Aufgabe verlangt zusätzlich, was
 * `create_task()` verlangt: Titel und Warum (BR-069).
 */
export function validateAnswer(draft: AnswerDraft): AnswerProblem[] {
  const problems: AnswerProblem[] = [];

  if (!canAnswer(draft.text)) problems.push('answerMissing');

  if (draft.asTask) {
    if (draft.taskTitle.trim().length < 2) problems.push('taskTitleMissing');
    if (draft.taskWhy.trim().length === 0) problems.push('taskWhyMissing');
  }

  return problems;
}

/**
 * Ein Titelvorschlag aus dem Transkript (A3, Schritt 1).
 *
 * Der Vorschlag ersetzt das Nachdenken nicht – er erspart das Abtippen.
 */
export function taskTitleFrom(transcript: string): string {
  const line = transcript.split('\n')[0]?.trim() ?? '';
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}

export type VoiceProblem =
  | 'textMissing'
  | 'textTooLong'
  | 'targetMissing'
  | 'quotaSpent';

export interface VoiceDraft {
  kind: VoiceKind;
  text: string;
  target: VoiceTarget | null;
  targetMemberId: string | null;
  targetTeamId: string | null;
}

/**
 * Was an einem Anliegen fehlt (BR-121).
 *
 * Der Text ist immer Pflicht – auch dann, wenn er einmal aus einer Aufnahme
 * entstehen wird: Geprüft wird er in jedem Fall von der absendenden Person.
 */
export function validateVoiceNote(
  draft: VoiceDraft,
  quotaLeft: number,
): VoiceProblem[] {
  const problems: VoiceProblem[] = [];

  const text = draft.text.trim();
  if (text.length === 0) problems.push('textMissing');
  if (text.length > MAX_TRANSCRIPT) problems.push('textTooLong');
  if (quotaLeft <= 0) problems.push('quotaSpent');

  if (needsTarget(draft.kind)) {
    if (draft.target === null) problems.push('targetMissing');
    else if (draft.target === 'person' && !draft.targetMemberId) {
      problems.push('targetMissing');
    } else if (draft.target === 'team' && !draft.targetTeamId) {
      problems.push('targetMissing');
    }
  }

  return problems;
}

/**
 * Das Ticket für den anonymen Rückkanal (A2).
 *
 * Es entsteht **auf dem Gerät** und bleibt dort; der Server bekommt nur seinen
 * Prüfwert. Wer den Speicher löscht, verliert den Rückweg – das ist der Preis
 * echter Anonymität, und er ist gewollt.
 */
export function createAnonTicket(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Der Prüfwert, den der Server sieht – nie das Ticket selbst. */
export async function hashTicket(ticket: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ticket),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

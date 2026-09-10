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

/**
 * Die Signaltypen, für die es heute eine Datengrundlage gibt.
 *
 * Das Entitätsmodell und der Constraint in `0040` kennen neun; vier davon –
 * `invoice_overdue`, `inputs_unanswered`, `succession_gap` und
 * `streak_broken` – hängen an Modulen, die es noch nicht gibt. Ein Signal
 * ohne Datengrundlage wäre eine Behauptung, also erzeugt der Server sie nicht.
 */
export const LIVE_SIGNAL_TYPES = [
  'no_response',
  'silent_churn',
  'attendance_drop',
  'comms_pause',
  'connection_ratio',
] as const;

export type LiveSignalType = (typeof LIVE_SIGNAL_TYPES)[number];

export type HealthSeverity = 'info' | 'attention' | 'urgent';
export type HealthStatus = 'open' | 'in_contact' | 'resolved';

export interface HealthSignal {
  id: string;
  memberId: string | null;
  memberName: string | null;
  teamId: string | null;
  signalType: string;
  severity: HealthSeverity;
  /** Der konkrete Anlass, etwa «3/3» – die Worte stehen in der Übersetzung. */
  detail: string;
  status: HealthStatus;
  ownedBy: string | null;
  ownerName: string | null;
  detectedAt: string;
}

/** Ampelfarbe – Ionic-Standard, keine eigene Klasse. */
export function severityColor(severity: HealthSeverity): string {
  if (severity === 'urgent') return 'danger';
  if (severity === 'attention') return 'warning';
  return 'success';
}

const SEVERITY_ORDER: Record<HealthSeverity, number> = {
  urgent: 0,
  attention: 1,
  info: 2,
};

/**
 * Die Reihenfolge der Liste: dringend zuerst, dann nach Alter.
 *
 * Ausdrücklich **nicht** nach Person oder Team gruppiert – eine nach Namen
 * sortierte Liste von Hinweisen wäre der Anfang einer Akte (BR-097).
 */
export function sortSignals(signals: readonly HealthSignal[]): HealthSignal[] {
  return [...signals].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.detectedAt.localeCompare(b.detectedAt);
  });
}

/**
 * Betrifft der Hinweis den Verein statt eine Person (A3)?
 *
 * Dann steht statt eines Gesprächsimpulses eine Handlungsfrage an den Verein
 * (BR-066, K5) – die Frage danach, was **wir** ändern können, nicht danach,
 * wer versagt hat.
 */
export function isClubSignal(signal: Pick<HealthSignal, 'memberId'>): boolean {
  return signal.memberId === null;
}

/**
 * Übersetzungsschlüssel eines Signaltyps – mit Rückfallebene.
 *
 * Erzeugt ein späteres Modul einen der vier noch datenlosen Typen, steht auf
 * dem Bildschirm ein neutraler Satz und nicht ein roher Schlüssel.
 */
export function signalKey(signalType: string, part: string): string {
  return (LIVE_SIGNAL_TYPES as readonly string[]).includes(signalType)
    ? `health.signal.${signalType}.${part}`
    : `health.signal.unknown.${part}`;
}

/**
 * Wie viele Gesprächsimpulse ein Typ mitbringt (FR-065: zwei bis drei).
 *
 * Die Zahl steht hier und nicht im JSX, damit die Ansicht keine Schlüssel
 * erfindet, die es nicht gibt.
 */
export const PROMPTS_PER_SIGNAL = 3;

/** Darf diese Person den Hinweis noch übernehmen (A1)? */
export function canTakeOver(
  signal: Pick<HealthSignal, 'status' | 'ownedBy'>,
  memberId: string | null,
): boolean {
  if (signal.status !== 'in_contact') return true;
  if (signal.ownedBy === null) return true;
  return signal.ownedBy === memberId;
}

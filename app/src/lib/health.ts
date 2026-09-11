/**
 * Die Signaltypen, für die es heute eine Datengrundlage gibt.
 *
 * Das Entitätsmodell und der Constraint in `0040` kennen neun; drei davon –
 * `invoice_overdue`, `inputs_unanswered` und `streak_broken` – hängen an
 * Daten, die es noch nicht gibt. Ein Signal ohne Datengrundlage wäre eine
 * Behauptung, also erzeugt der Server sie nicht.
 *
 * `succession_gap` ist seit `0056` dabei: Die Ämter aus UC-031 sind seine
 * Grundlage.
 */
export const LIVE_SIGNAL_TYPES = [
  'no_response',
  'silent_churn',
  'attendance_drop',
  'comms_pause',
  'connection_ratio',
  'succession_gap',
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

/**
 * Signale, die den **Verein** betreffen und deshalb dem Vorstand gehören (A3).
 *
 * Sie stehen hier und nicht als Bedingung in einer Ansicht: Wer einen neuen
 * Vereinstyp hinzufügt, ergänzt eine Zeile – und nicht drei Stellen, von denen
 * er zwei übersieht.
 */
export const CLUB_SIGNAL_TYPES: readonly string[] = [
  'comms_pause',
  'connection_ratio',
  'succession_gap',
];

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

/**
 * Die Datenarten, aus denen überhaupt Signale entstehen können (Schritt 2).
 *
 * `invoice` steht dabei, obwohl Rechnungen erst mit UC-036 kommen: Die Seite
 * beschreibt, was das System erhebt – und ein Modul, das später etwas erhebt,
 * gehört benannt, bevor es das tut. Die Ansicht kennzeichnet es als noch nicht
 * in Betrieb.
 */
export const COLLECTED_DATA = ['attendance', 'response', 'invoice'] as const;

/**
 * BR-108: Was **nicht** erhoben wird – und das ausdrücklich.
 *
 * Der ungewöhnlichere Teil der Seite. Eine Aufzählung dessen, was ein System
 * nicht tut, ist keine Selbstverständlichkeit, sondern eine Zusage.
 */
export const NOT_COLLECTED = ['usage', 'readReceipts', 'location', 'content'] as const;

export interface MyHealthSignal {
  id: string;
  signalType: string;
  severity: HealthSeverity;
  status: HealthStatus;
  detectedAt: string;
  expiresAt: string;
}

/**
 * Wer sieht diesen Hinweis (Schritt 4)?
 *
 * Personenbezogene Hinweise gehen an die Trainer:innen der eigenen Teams und
 * an den Vorstand; Vereinssignale nur an den Vorstand (BR-096, A3). Die
 * Auskunft der eigenen Seite kennt nur die erste Art – die Unterscheidung
 * steht hier trotzdem, damit die Antwort aus der Regel kommt und nicht aus
 * einem festen Satz.
 */
export function signalAudienceKey(signal: { signalType: string }): string {
  return (LIVE_SIGNAL_TYPES as readonly string[]).includes(signal.signalType) &&
    CLUB_SIGNAL_TYPES.includes(signal.signalType)
    ? 'transparency.audience.board'
    : 'transparency.audience.trainers';
}

// --- Die Kennzahlen (UC-023, FR-060, FR-061, FR-068, FR-069) ---------------
//
// Alle Zahlen entstehen am Server und werden hier nur **gedeutet**. Die
// Deutung steht als reine Funktion, weil sie die eigentliche Entscheidung ist:
// Eine Quote von 0,62 sagt nichts, «zwei von sieben tragen alles» schon.

export interface ClubHealth {
  members: number;
  activated: number;
  prevActivated: number;
  active: number;
  activeDays: number;
}

export interface TeamHealth {
  teamId: string;
  teamName: string;
  members: number;
  invitations: number;
  answered: number;
  attended: number;
}

export interface Responsibility {
  contributors: number;
  carriers: number;
  members: number;
  efforts: number;
}

export interface SuccessionCase {
  roleId: string;
  title: string;
  isVacant: boolean;
  years: number | null;
}

/**
 * Ein Anteil in Prozent, auf ganze Zahlen gerundet.
 *
 * Ohne Grundgesamtheit gibt es keinen Anteil – und `null` ist hier nicht
 * dasselbe wie null Prozent. Ein Verein ohne Mitglieder hat keine Quote von
 * 0 %, er hat keine.
 */
export function percent(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

/**
 * Der Trend zur Vorsaison (FR-060).
 *
 * Verglichen werden **Anzahlen**, nicht Quoten: Wie gross der Verein in der
 * Vorsaison war, weiss diese Datenbank nicht – die Historie dafür schliesst
 * BR-097 aus. `null` heisst «keine Vorsaison», nicht «keine Veränderung»:
 * Ein Verein im ersten Jahr bekommt keinen Pfeil.
 */
export function seasonTrend(health: Pick<ClubHealth, 'activated' | 'prevActivated'>): number | null {
  if (health.prevActivated === 0) return null;
  return health.activated - health.prevActivated;
}

/**
 * Trägt eine kleine Gruppe die Hauptlast? (FR-068, K4)
 *
 * Die Frage ist nicht, ob Verantwortung ungleich verteilt ist – das ist sie
 * in jedem Verein. Die Frage ist, ob sie auf so wenigen Schultern liegt, dass
 * ein einziger Rücktritt den Verein trifft. Angesetzt bei **einem Fünftel**:
 * Tragen weniger als 20 % der Mitglieder vier Fünftel der Einsätze, ist das
 * ein Anlass – und zwar für den Verein, nicht für die Tragenden (BR-095).
 */
export function isConcentrated(value: Responsibility): boolean {
  if (value.members === 0 || value.efforts === 0) return false;
  return value.carriers / value.members < 0.2;
}

/** Die Antwortquote eines Teams – `null`, solange niemand eingeladen war. */
export function responseRate(team: Pick<TeamHealth, 'answered' | 'invitations'>): number | null {
  return percent(team.answered, team.invitations);
}

/** Die Beteiligung eines Teams: wie viele der Eingeladenen tatsächlich kamen. */
export function attendanceRate(team: Pick<TeamHealth, 'attended' | 'invitations'>): number | null {
  return percent(team.attended, team.invitations);
}

/**
 * Die Reihenfolge des Nachfolge-Vorlaufs (FR-069).
 *
 * Vakante Ämter zuerst – sie sind der dringendere Fall –, danach die am
 * längsten gehaltenen. Ein Amt ohne Datum steht bei den Gehaltenen zuletzt:
 * «seit unbekannt» ist kein Grund zur Eile.
 */
export function sortSuccession(cases: readonly SuccessionCase[]): SuccessionCase[] {
  return [...cases].sort((a, b) => {
    if (a.isVacant !== b.isVacant) return a.isVacant ? -1 : 1;
    return (b.years ?? -1) - (a.years ?? -1);
  });
}

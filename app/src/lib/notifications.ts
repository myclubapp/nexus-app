/**
 * Die Kategorien, unter denen `notify()` tatsächlich schreibt.
 *
 * Die Spezifikation nennt sie gruppiert («News und Puls», «Aufgaben und
 * Aufrufe»); die Datenbank kennt einzelne Werte. Hier stehen die Werte, dort
 * gruppiert die Oberfläche sie – und `join_request` steht dazu, weil es
 * zugestellt wird, auch wenn die Spezifikation es nicht aufzählt.
 */
export const PUSH_CATEGORIES = [
  'event',
  'points',
  'task',
  'news',
  'pulse',
  'health',
  // Seit UC-030 stellt `notify()` unter dieser Kategorie zu – ohne sie hier
  // wäre sie in den Einstellungen nicht abschaltbar.
  'input',
  // Seit UC-032: die Frage nach dem Befinden. Sie ist die Kategorie, die man
  // am ehesten abschalten will – deshalb muss sie in der Liste stehen.
  'checkin',
  // Seit UC-035: technische Meldungen zu Anschlüssen – heute die
  // Verbandsverbindung. Sie erreicht nur den Vorstand, und auch er soll sie
  // abschalten können; eine Kategorie ohne Schalter wäre die einzige.
  'system',
  'join_request',
] as const;

export type PushCategory = (typeof PUSH_CATEGORIES)[number];

/**
 * Was nie per E-Mail geht (UC-044, BR-210): Ein Postfach lesen auch andere;
 * «Ein Hinweis wartet auf dich» und die Frage nach dem Befinden gehören nicht
 * dorthin (NFR-022). Dieselbe Liste steht in `email_decision()` (0084) –
 * hier, damit die Seite die Zeilen gar nicht erst anbietet.
 */
export const MAIL_EXCLUDED_CATEGORIES: readonly PushCategory[] = ['health', 'checkin'];

/** Die Kategorien, die die E-Mail-Matrix zeigt. */
export const EMAIL_CATEGORIES: readonly PushCategory[] = PUSH_CATEGORIES.filter(
  (category) => !MAIL_EXCLUDED_CATEGORIES.includes(category),
);

/**
 * Wie E-Mails gebündelt werden (BR-211). `daily` ist die Vorgabe – auch für
 * Konten, die die Seite nie geöffnet haben; `email_decision()` nimmt
 * denselben Wert, wenn keine Zeile existiert.
 */
export const EMAIL_MODES = ['immediate', 'daily', 'weekly', 'off'] as const;
export type EmailMode = (typeof EMAIL_MODES)[number];

export interface NotificationSettings {
  /** Fehlt eine Kategorie, gilt sie als erlaubt – neue sind nie stumm. */
  push: Partial<Record<PushCategory, boolean>>;
  /** Dieselbe Regel für den E-Mail-Kanal (UC-044). */
  email: Partial<Record<PushCategory, boolean>>;
  emailMode: EmailMode;
  quietFrom: string | null;
  quietTo: string | null;
}

export const EMPTY_SETTINGS: NotificationSettings = {
  push: {},
  email: {},
  emailMode: 'daily',
  quietFrom: null,
  quietTo: null,
};

/** Ist Push für diese Kategorie erlaubt (BR-118)? */
export function isPushEnabled(
  settings: NotificationSettings,
  category: PushCategory,
): boolean {
  return settings.push[category] !== false;
}

/**
 * Geht diese Kategorie per E-Mail hinaus?
 *
 * Drei Stufen, in dieser Reihenfolge – wortgleich zu `email_decision()`:
 * ausgeschlossene Kategorie, Modus «aus», Abwahl je Kategorie.
 */
export function isEmailEnabled(
  settings: NotificationSettings,
  category: PushCategory,
): boolean {
  if (MAIL_EXCLUDED_CATEGORIES.includes(category)) return false;
  if (settings.emailMode === 'off') return false;
  return settings.email[category] !== false;
}

/** Ein Wert aus der Datenbank, auf die bekannten Modi verengt. */
export function toEmailMode(value: string | null | undefined): EmailMode {
  return (EMAIL_MODES as readonly string[]).includes(value ?? '')
    ? (value as EmailMode)
    : 'daily';
}

/**
 * Sind die stillen Zeiten gültig?
 *
 * Ein halbes Fenster ist kein Fenster – dieselbe Regel wie in `0045`. Ein
 * Fenster über Mitternacht ist dagegen erlaubt und der häufigere Fall.
 */
export function isQuietWindowValid(settings: NotificationSettings): boolean {
  const from = settings.quietFrom;
  const to = settings.quietTo;
  if (from === null && to === null) return true;
  if (from === null || to === null) return false;
  return from !== to;
}

/** Sind stille Zeiten überhaupt eingeschaltet? */
export function hasQuietHours(settings: NotificationSettings): boolean {
  return settings.quietFrom !== null && settings.quietTo !== null;
}

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

export interface NotificationSettings {
  /** Fehlt eine Kategorie, gilt sie als erlaubt – neue sind nie stumm. */
  push: Partial<Record<PushCategory, boolean>>;
  quietFrom: string | null;
  quietTo: string | null;
}

export const EMPTY_SETTINGS: NotificationSettings = {
  push: {},
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

/**
 * Das Warum einer Meldung (FR-183, BR-239).
 *
 * Eine Meldung, die sagt «Kommst du?», ist eine Aufforderung. Eine Meldung,
 * die dazu sagt, warum die Antwort gebraucht wird, ist eine Information – und
 * nur die zweite lässt sich einordnen, ohne jemanden zu fragen.
 *
 * Zwei Quellen, in dieser Reihenfolge:
 *   1. Das Warum, das der Auslöser mitgegeben hat (`notifications.why`) – der
 *      Satz, den der Vorstand an der Aufgabe oder am Amt geschrieben hat.
 *   2. Der Standardsatz der Kategorie. Er erklärt nicht den Anlass, sondern
 *      die Zustellung: «Der Verein plant mit deiner Antwort.»
 *
 * Die Standardsätze stehen unter `notifications.why.*` in den vier
 * Sprachdateien **und**, für die Mail, in `supabase/functions/send-mail/
 * template.ts`. Eine Edge Function hat keinen Zugang zu `src/i18n`; wer einen
 * Satz ändert, ändert ihn an beiden Stellen.
 */

/** Die Kategorien, die einen eigenen Standardsatz haben. */
export const WHY_CATEGORIES = [
  'event',
  'points',
  'task',
  'news',
  'pulse',
  'health',
  'join_request',
  'input',
  'checkin',
  'system',
  'invoice',
  'general',
] as const;

export type WhyCategory = (typeof WHY_CATEGORIES)[number];

/**
 * Der i18n-Schlüssel für den Standardsatz einer Kategorie.
 *
 * Eine unbekannte Kategorie fällt auf `general` zurück statt einen Schlüssel
 * zu erfinden: `i18n:check` kennt nur die Schlüssel, die in den Dateien
 * stehen, und ein fehlender zeigt dem Mitglied seinen eigenen Namen an.
 */
export function whyKey(category: string | null | undefined): string {
  const known = (WHY_CATEGORIES as readonly string[]).includes(category ?? '');
  return `notifications.why.${known ? category : 'general'}`;
}

/**
 * Das Warum, das eine Zeile anzeigt – der eigene Satz oder der Standardsatz.
 *
 * `translate` ist die `t`-Funktion; so bleibt das Modul frei von
 * react-i18next und damit ohne Einrichtung prüfbar.
 */
export function notificationWhy(
  entry: { category: string | null; why?: string | null },
  translate: (key: string) => string,
): string {
  const own = entry.why?.trim();
  return own && own.length > 0 ? own : translate(whyKey(entry.category));
}

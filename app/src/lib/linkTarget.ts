/**
 * Wohin ein Verweis aus der Inbox führt (FR-078).
 *
 * `notify()` legt an jeder Benachrichtigung einen Pfad ab – mal eine Seite
 * (`/tabs/profile/meeting`), mal einen einzelnen Gegenstand
 * (`/tabs/agenda?event=<id>`). Der Unterschied entscheidet über die Bedienung:
 * Eine Seite wird angesteuert, ein Gegenstand öffnet sich als Blatt **über**
 * der Liste. Ein Tab-Wechsel für einen einzelnen Termin führt sonst in einen
 * fremden Verlauf, aus dem der Weg zurück in die Inbox erst gesucht werden
 * muss (Ionic, Navigation: Inhalt quer über Tabs gehört ins Modal).
 *
 * Die Zuordnung steht hier und nicht in der Seite, damit sie sich prüfen
 * lässt, ohne die Inbox zu rendern.
 */
export type LinkTarget =
  /** Ein Termin – öffnet `EventDetailModal`. */
  | { kind: 'event'; id: string }
  /** Eine Aufgabe – öffnet `TaskDetailModal`. */
  | { kind: 'task'; id: string }
  /** Alles andere: eine Seite, die angesteuert wird. */
  | { kind: 'page'; href: string };

/**
 * Die Verweise, hinter denen ein einzelner Gegenstand steht. Wächst eine
 * Quelle dazu, gehört sie hierher – und in `LinkedDetail`, das die Blätter
 * dazu hält.
 */
const SHEETS = [
  { path: '/tabs/agenda', param: 'event', kind: 'event' },
  { path: '/tabs/marketplace', param: 'task', kind: 'task' },
] as const;

/**
 * Den Verweis einer Benachrichtigung lesen.
 *
 * @param link Der Pfad aus `notifications.link`; `null`, wo die Nachricht
 *   nirgendwohin führt.
 * @returns Der Gegenstand oder die Seite – `null`, wenn es nichts zu öffnen
 *   gibt.
 */
export function linkTarget(link: string | null | undefined): LinkTarget | null {
  if (!link) return null;

  const [path, query = ''] = link.split('?');
  for (const sheet of SHEETS) {
    if (path !== sheet.path) continue;
    const id = new URLSearchParams(query).get(sheet.param);
    // Ohne Kennung meint der Verweis die Liste selbst, nicht einen Gegenstand
    // darin – `/tabs/marketplace` etwa führt in den Marktplatz.
    if (id) return { kind: sheet.kind, id };
  }

  return { kind: 'page', href: link };
}

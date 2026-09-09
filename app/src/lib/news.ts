import type { News } from './database.types';

export interface NewsDraft {
  title: string;
  body: string;
  imageUrl: string;
  teamId: string | null;
}

export type NewsProblem = 'titleMissing' | 'imageNotALink';

/**
 * Was an einer News fehlt (UC-026, Schritt 3).
 *
 * Der Titel ist das Einzige, was die Datenbank verlangt – ein Text ohne Titel
 * hätte in der Inbox keine Überschrift. Das Bild ist ein **Verweis**: Einen
 * Vereinsspeicher gibt es noch nicht (A1), und ein Fragment ohne Schema führt
 * niemanden irgendwohin.
 */
export function validateNews(draft: NewsDraft): NewsProblem[] {
  const problems: NewsProblem[] = [];

  if (draft.title.trim().length < 2) problems.push('titleMissing');

  const image = draft.imageUrl.trim();
  if (image !== '' && !/^https?:\/\/\S+$/i.test(image)) {
    problems.push('imageNotALink');
  }

  return problems;
}

/**
 * Darf diese News bearbeitet werden?
 *
 * Übernommene News der Vereins-Website gehören nicht dem Verein, sondern der
 * Quelle: Wer sie hier ändert, verliert die Änderung beim nächsten Abgleich
 * (UC-038). Sie werden deshalb gar nicht erst zum Bearbeiten angeboten.
 */
export function isEditable(entry: Pick<News, 'source'>): boolean {
  return entry.source !== 'website';
}

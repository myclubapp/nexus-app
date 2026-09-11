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

/**
 * FR-100 «Aus dem Vorstand»: Wird diese Antwort publiziert – und unter welchem
 * Titel?
 *
 * Zwei Blätter stellen dieselbe Frage – das Anliegen (UC-030, A2) und der
 * Sitzungs-Input (UC-031). Die Regel steht deshalb hier und nicht zweimal in
 * einer Ansicht, und sie steht als reine Funktion, weil sich ein `ion-toggle`
 * in jsdom nicht bedienen lässt (docs/TESTING.md §6.4).
 *
 * **Eine Ablehnung wird nie publiziert.** «Aus dem Vorstand» erzählt dem
 * Verein, was aus Vorschlägen wurde; ein Nein an eine einzelne Person ist
 * keine Meldung an alle. Der Server hält dieselbe Regel ein zweites Mal
 * (`0055`) – hier verschwindet nur der Weg dorthin.
 *
 * Rückgabe `null` heisst: nicht publizieren. Der Server nimmt den Titel als
 * Schalter, ein zweites Kennzeichen wäre eine zweite Wahrheit.
 */
export function publishedTitle(
  asNews: boolean,
  decline: boolean,
  title: string,
): string | null {
  if (!asNews || decline) return null;
  return title.trim() === '' ? null : title.trim();
}

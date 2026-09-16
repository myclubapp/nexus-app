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
 * Übernommene Beiträge gehören nicht dem Verein, sondern der Quelle: Wer sie
 * hier ändert, verliert die Änderung beim nächsten Abgleich – bei der
 * Vereins-Website (UC-038) wie beim Verband (FR-197, `upsert_federation_news`
 * überschreibt Titel, Anriss und Bild). Sie werden deshalb gar nicht erst zum
 * Bearbeiten angeboten.
 */
export function isEditable(entry: Pick<News, 'source'>): boolean {
  return entry.source !== 'website' && entry.source !== 'federation';
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

/**
 * Woher ein Beitrag kommt – die Wahl über dem Feed.
 *
 * Drei Herkünfte aus fünf `news.source`-Werten. Zusammengelegt ist nur, was
 * dieselbe Hand geschrieben hat: `club`, `team` und `board` sind der Verein,
 * der in dieser App tippt. Getrennt bleiben die beiden **übernommenen**
 * Quellen – die eigene Website (UC-038) und der Verband (FR-197) –, denn wer
 * den Feed durchsucht, sucht meist genau eine davon.
 *
 * Die Wahl ist nötig geworden, weil der Feed nach Datum sortiert und sonst
 * nichts: Ein Verband veröffentlicht wöchentlich, eine Vereins-Website in der
 * Sommerpause monatelang nicht – dann füllen die Verbandsbeiträge jeden Platz,
 * und die Vereinsbeiträge verschwinden, ohne gelöscht worden zu sein.
 */
export type NewsOrigin = 'all' | 'own' | 'website' | 'federation';

/** Die Herkünfte in der Reihenfolge, in der sie im Segment stehen. */
export const NEWS_ORIGINS: Exclude<NewsOrigin, 'all'>[] = ['own', 'website', 'federation'];

/**
 * Die `news.source`-Werte hinter einer Herkunft – `null` heisst «alle».
 *
 * Jeder Wert des Constraints `news_source_check` muss in **genau einer**
 * Herkunft stehen. Eine Quelle, die in keiner steht, wäre nur noch unter
 * «Alle» zu sehen und aus jeder gefilterten Ansicht verschwunden;
 * `news.test.ts` hält die Vollständigkeit fest.
 */
export function sourcesOf(origin: NewsOrigin): string[] | null {
  if (origin === 'own') return ['club', 'team', 'board'];
  if (origin === 'website') return ['website'];
  if (origin === 'federation') return ['federation'];
  return null;
}

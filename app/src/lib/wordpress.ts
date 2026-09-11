/**
 * Die Adresse der Vereins-Website (UC-038).
 *
 * Normalisiert wird genau hier – der Constraint auf `news_sources.url` in
 * `0022_news_sources.sql` hält nur fest, was dabei herauskommt, und die Edge
 * Function hängt `/wp-json/wp/v2/posts` an das Ergebnis an. Läuft eine zweite
 * Normalisierung daneben, verbindet der Verein am Ende zwei Quellen für
 * dieselbe Website.
 */
import type { ApiStyle } from './database.types';

/**
 * Endungen, die auf die Schnittstelle statt auf die Website zeigen. Wer die
 * Adresse aus dem Browser kopiert, hat oft schon einen Unterpfad im Feld; die
 * Function braucht aber die Wurzel, an die sie `/wp-json` anhängt.
 */
const API_SUFFIX = /\/(wp-json|wp-admin|feed|rss)(\/.*)?$/i;

/**
 * Eingabe auf die gespeicherte Form bringen, oder `null`, wenn daraus keine
 * Website-Adresse wird.
 *
 * `verein.ch` genügt als Eingabe: Wer eine Website hat, tippt selten das
 * Schema mit. Ein `http://` wird zu `https://` – die Schnittstelle wird nicht
 * über eine unverschlüsselte Verbindung abgefragt.
 */
export function normaliseSiteUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  // Ohne Punkt im Hostnamen ist es kein öffentlicher Auftritt, sondern ein
  // Tippfehler oder `localhost` – von dort holt die Function nichts.
  if (!url.hostname.includes('.')) return null;

  const path = url.pathname.replace(API_SUFFIX, '').replace(/\/+$/, '');
  return `https://${url.host}${path}`;
}

/** Ist die Eingabe eine brauchbare Website-Adresse? */
export function isSiteUrl(input: string): boolean {
  return normaliseSiteUrl(input) !== null;
}

/**
 * Kurzform für die Anzeige: der Hostname ohne `www.`. Die volle Adresse steht
 * im Eingabefeld, die Statuszeile braucht nur den Namen der Website.
 */
export function siteLabel(url: string): string {
  return url.replace(/^https:\/\//, '').replace(/^www\./, '');
}

// --- Umfang und Auswahl des Imports (UC-038, FR-149) -----------------------

/**
 * Wie die Schnittstelle der Website erreichbar ist. Welcher Weg trägt,
 * ermittelt die Edge Function beim Prüfen; die App zeigt ihn nur an.
 */
export type { ApiStyle } from './database.types';

/** Eine Kategorie der Website, wie die Prüfung sie zurückgibt. */
export interface SiteCategory {
  id: number;
  name: string;
  /** Zahl der Beiträge in dieser Kategorie, von der Website gemeldet. */
  count: number;
}

/** Die gespeicherte Auswahl in `news_sources.categories`. */
export interface CategoryChoice {
  id: number;
  name: string;
}

/**
 * Vorgabe und Grenzen für die Zahl der Beiträge je Abgleich (BR-174).
 *
 * Die hundert ist keine gegriffene Zahl: Die WordPress-Schnittstelle liefert
 * pro Anfrage höchstens hundert Beiträge. Dieselben Grenzen stehen im
 * `check`-Constraint von `news_sources.post_limit` und in der Edge Function –
 * laufen sie auseinander, lehnt die Datenbank ab, was die App anbietet.
 */
export const DEFAULT_POST_LIMIT = 20;
export const MAX_POST_LIMIT = 100;

/** Die Stufen, die die Ansicht zur Wahl stellt. */
export const POST_LIMIT_OPTIONS = [5, 10, 20, 50, 100] as const;

/** Eine Zahl auf den erlaubten Bereich bringen. */
export function clampPostLimit(value: unknown): number {
  const limit = Math.trunc(Number(value));
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_POST_LIMIT;
  return Math.min(limit, MAX_POST_LIMIT);
}

/**
 * Die Adresse, unter der die Beiträge geholt werden – zur Anzeige nach der
 * Prüfung. Sie muss zu `apiUrl()` in der Edge Function passen, sonst zeigt die
 * App eine andere Adresse an als die, die tatsächlich abgefragt wird.
 */
export function postsEndpoint(url: string, style: ApiStyle): string {
  return style === 'query'
    ? `${url}/?rest_route=/wp/v2/posts`
    : `${url}/wp-json/wp/v2/posts`;
}

/**
 * Die gespeicherte Auswahl aus der `jsonb`-Spalte lesen.
 *
 * Die Spalte kommt als `Json` an: Was dort steht, hat die Edge Function
 * geschrieben, stammt aber ursprünglich von einer fremden Website. Alles, was
 * nicht Id und Name ist, fällt hier heraus, statt später als `undefined` in
 * der Ansicht zu stehen.
 */
export function parseCategories(value: unknown): CategoryChoice[] {
  if (!Array.isArray(value)) return [];
  const result: CategoryChoice[] = [];
  const seen = new Set<number>();
  for (const entry of value) {
    const id = Math.trunc(Number((entry as { id?: unknown })?.id));
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    const raw = (entry as { name?: unknown })?.name;
    result.push({ id, name: typeof raw === 'string' && raw.trim() ? raw : `#${id}` });
  }
  return result;
}

/**
 * Die Auswahlliste der Ansicht: was die Prüfung gefunden hat, ergänzt um das,
 * was der Verein einmal gewählt hat.
 *
 * Ohne die Ergänzung verschwände eine gewählte Kategorie aus der Liste, sobald
 * sie auf der Website leer läuft (`hide_empty`) – die Auswahl im `IonSelect`
 * stünde dann auf einer Id ohne Eintrag und sähe aus wie «nichts gewählt».
 */
export function categoryOptions(
  found: SiteCategory[],
  chosen: CategoryChoice[],
): SiteCategory[] {
  const options = [...found];
  for (const choice of chosen) {
    if (!options.some((option) => option.id === choice.id)) {
      options.push({ ...choice, count: 0 });
    }
  }
  return options;
}

/**
 * Den Verband verbinden und abgleichen (UC-035, UC-039).
 *
 * Gegenstück zu `syncAssociation.scheduler.ts` im alten Backend
 * (github.com/myclubapp/backend): dieselben Verbände, dieselben Endpunkte –
 * nur holt der Abgleich hier ausschliesslich Daten **verbundener** Vereine
 * (BR-152) und schreibt nach Postgres statt nach Firestore.
 *
 * Warum serverseitig: Die Verbandsschnittstellen sprechen kein CORS, der
 * Schlüssel darf das Gerät nie erreichen (BR-153, BR-178), und der nächtliche
 * Lauf (`0058_federation.sql`) kann im Client gar nicht stattfinden.
 *
 * Vier Betriebsarten:
 *   { mode: 'check', clubId, federation, federationClubId, apiKey? }
 *       – Testaufruf des Vorstands (UC-035, Schritt 5). **Schreibt nichts.**
 *   { mode: 'teams', clubId, federation }
 *       – die Teamliste zum Verknüpfen (UC-039, Schritte 3–4), mit dem
 *         Schlüssel aus dem Tresor. Gelingt der Abruf, gilt die Verbindung
 *         als aktiv.
 *   { mode: 'sync', clubId, federation }
 *       – der Abgleich **eines** Verbands sofort, vom Vorstand angestossen
 *         (UC-039, Schritt 9): derselbe Lauf wie in der Nacht, nur für diese
 *         Verbindung. Ohne ihn stünden die Spiele eines eben verknüpften
 *         Teams erst am nächsten Morgen in der Agenda.
 *   { mode: 'all' } – der nächtliche Abgleich, nur für `service_role`:
 *         Teams nachführen, Spiele der verknüpften Teams als Termine anlegen
 *         (UC-039, Schritt 9), verschwundene Teams als veraltet vermerken (A6).
 *
 * **BR-154: Es gibt hier keinen Weg, der an einen Verband schreibt.** Jeder
 * Aufruf nach aussen ist ein `GET`.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/** Eine Verbandsschnittstelle, die nicht antwortet, blockiert den Lauf nicht. */
const FETCH_TIMEOUT_MS = 15_000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Federation = 'swissunihockey' | 'swissvolley' | 'swisshandball' | 'swissturnverband';

/**
 * Was ein Verband anbietet.
 *
 * `teamsUrl` ist der **Testaufruf** aus UC-035, Schritt 5, und zugleich die
 * Auswahlliste aus UC-039, Schritt 4. `gamesUrl` holt die Spiele eines Teams
 * der laufenden Saison – die Grundlage für die Termine (UC-039, Schritt 9).
 *
 * Heute trägt nur Swiss Unihockey eine offen dokumentierte Schnittstelle. Die
 * übrigen drei stehen in der Liste, weil das alte Backend sie kennt; ohne
 * Endpunkt bleibt ihr Eintrag `null` und die Verbindung `pending` – das ist
 * ehrlicher als ein Testaufruf, der immer gelingt.
 */
const ENDPOINTS: Record<
  Federation,
  {
    teamsUrl: ((clubId: string, season: number) => string) | null;
    gamesUrl: ((teamId: string, season: number) => string) | null;
  }
> = {
  swissunihockey: {
    teamsUrl: (clubId, season) =>
      `https://api-v2.swissunihockey.ch/api/teams?mode=by_club&club_id=${encodeURIComponent(clubId)}&season=${season}`,
    gamesUrl: (teamId, season) =>
      `https://api-v2.swissunihockey.ch/api/games?mode=team&season=${season}&team_id=${encodeURIComponent(teamId)}&games_per_page=100`,
  },
  swissvolley: { teamsUrl: null, gamesUrl: null },
  swisshandball: { teamsUrl: null, gamesUrl: null },
  swissturnverband: { teamsUrl: null, gamesUrl: null },
};

/**
 * Die Beiträge eines Verbands (UC-035, Schritt 7; FR-197).
 *
 * Swiss unihockey veröffentlicht über **Publishr**; `fkMediahouse=61` ist sein
 * Newsraum, und `tags=!top&tags=!pin` blendet die angehefteten Kacheln der
 * Website aus. Dieselbe Schnittstelle liest `getNews()` im alten Backend
 * (`myclubapp/backend`, `graphql/swissunihockey/resolvers.ts`) – dort steht der
 * Token im Quelltext, hier kommt er aus der Umgebung:
 *
 *   supabase secrets set SWISSUNIHOCKEY_NEWS_TOKEN=<Token>
 *
 * **Ohne gesetztes Secret gibt es keine Verbandsnews**, und der Abgleich sagt
 * das auch. Ein Endpunkt mit eingebautem Schlüssel wäre ein Schlüssel im
 * Repository – genau das, was BR-153 für die Vereinsschlüssel ausschliesst.
 *
 * Die übrigen drei Verbände stehen mit `null` da, wie schon bei Teams und
 * Spielen: Das alte Backend kratzt ihre Websites (`handball.ch/Umbraco/Api`,
 * `volleyball.ch/de/news`), und eine abgeschriebene HTML-Seite ist keine
 * Schnittstelle, auf die sich ein Verein verlassen soll.
 *
 * **Dieselbe Liste steht in `app/src/lib/federation.ts` als `deliversNews()`.**
 * Sie muss es: Die App entscheidet damit, ob sie überhaupt einen Schalter
 * anbietet, und sie kennt weder Secrets noch Endpunkte. Kommt ein Verband dazu,
 * ändern sich **beide** Stellen – die dortige Notiz sagt dasselbe. Auseinander
 * laufen sie nur in eine Richtung: Fehlt das Secret, steht der Schalter zwar da,
 * und der Abgleich meldet beim Einschalten ehrlich, warum noch nichts kommt.
 */
function newsEndpoint(
  federation: Federation,
): { url: string; token: string | null } | null {
  if (federation !== 'swissunihockey') return null;

  const token = Deno.env.get('SWISSUNIHOCKEY_NEWS_TOKEN')?.trim();
  if (!token) return null;

  return {
    url:
      'https://app.publishr.ch/api/v2/contenthub-story/list' +
      '?orderBy=timestamp&fkMediahouse=61&limit=20&tags=!top&tags=!pin&social=false',
    token,
  };
}

const BROWSER_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'myclub-nexus/1.0 (+https://myclub.ch)',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Die Rolle aus dem Token – dieselbe Prüfung wie beim Website-Abgleich. */
function tokenRole(authorization: string | null): string | null {
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * Die laufende Saison, wie der Verband sie zählt: Sie beginnt im Sommer und
 * trägt die Jahreszahl ihres Beginns. Dieselbe Rechnung wie im alten Backend.
 */
function federationSeason(now: Date = new Date()): number {
  return now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

async function getJson(url: string, apiKey: string | null): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { ...BROWSER_HEADERS };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Der Verband antwortet mit ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Lesen, was der Verband liefert.
// ---------------------------------------------------------------------------

/** Ein Team, wie der Verband es kennt. */
interface FederationTeam {
  id: string;
  name: string;
  league: string | null;
}

/**
 * Die Teams eines Vereins beim Verband.
 *
 * Swiss Unihockey liefert `by_club` als **Dropdown**: `entries[].text` ist der
 * Name («Herren NLB»), `entries[].set_in_context.team_id` die Kennung. Eine
 * Liga steht dort nicht getrennt; sie kommt beim Spielplan (`data.title`)
 * und wird beim Abgleich nachgetragen (BR-176). Belegt am 2026-09-11 gegen
 * die echte Schnittstelle (Verein 463820, 12 Teams).
 *
 * Die Tabellenform bleibt als zweiter Weg: Sie ist die, die der Website-
 * Abgleich des alten Backends liest, und eine Schnittstelle, die sich ändert,
 * soll einen leeren Befund geben und nicht einen Absturz.
 */
function readTeams(payload: unknown): FederationTeam[] {
  const dropdown = payload as {
    entries?: Array<{ text?: unknown; set_in_context?: { team_id?: unknown } }>;
  };
  if (Array.isArray(dropdown?.entries)) {
    const teams: FederationTeam[] = [];
    for (const entry of dropdown.entries) {
      const id = entry?.set_in_context?.team_id;
      const name = String(entry?.text ?? '').trim();
      if (id === undefined || id === null || name.length === 0) continue;
      teams.push({ id: String(id), name, league: null });
    }
    return teams;
  }

  const rows = (payload as { data?: { regions?: Array<{ rows?: unknown[] }> } })?.data
    ?.regions?.[0]?.rows;
  if (!Array.isArray(rows)) return [];

  const teams: FederationTeam[] = [];
  for (const row of rows as Array<{
    cells?: Array<{ text?: unknown }>;
    link?: { ids?: unknown[] };
  }>) {
    const id = row?.link?.ids?.[0];
    const cells = row?.cells ?? [];
    const name = cells[0]?.text;
    const league = cells[1]?.text;
    if (id === undefined || id === null) continue;

    teams.push({
      id: String(id),
      name: Array.isArray(name) ? String(name[0] ?? '') : String(name ?? ''),
      league: Array.isArray(league) ? String(league[0] ?? '') : (league ? String(league) : null),
    });
  }
  return teams;
}

/** Ein Spiel, wie es zum Termin wird (BR-180). */
interface FederationGame {
  id: string;
  title: string;
  startsAt: string;
  location: string | null;
  /** Die Lage des Spielorts (WGS84) – beide oder keiner (`0076`). */
  latitude: number | null;
  longitude: number | null;
  result: string | null;
}

/**
 * Die Lage aus der Ortszelle: `link.x` ist die Länge, `link.y` die Breite –
 * WGS84, als Zahlen (belegt 2026-09-13, Team 431869: «Turnhalle Hatzenbühl,
 * Nürensdorf» bei 8.6474 / 47.4522); `Number()` nimmt auch Zeichenketten. Ein halber,
 * unlesbarer oder leerer Punkt ist keiner: Die Karte zeigt dann nichts,
 * statt irgendwo im Golf von Guinea zu stehen.
 */
function readCoordinates(
  y: unknown,
  x: unknown,
): { latitude: number; longitude: number } | null {
  if (y === undefined || y === null || x === undefined || x === null) return null;
  const latitude = Number(y);
  const longitude = Number(x);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

/**
 * Der Versatz von Europe/Zurich zur UTC zu einem Zeitpunkt, in Minuten.
 *
 * Der Verband nennt Ortszeit ohne Zone. Ein Spiel um 20:00 ist im Winter
 * 19:00Z und im Sommer 18:00Z – wer das mit einer festen Zahl rechnet, hat
 * zweimal im Jahr eine Stunde Unterschied in der Agenda.
 */
function zurichOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const local = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'));
  return Math.round((local - at.getTime()) / 60_000);
}

function zurichToIso(year: number, month: number, day: number, hour: number, minute: number): string {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = zurichOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60_000).toISOString();
}

/**
 * «28.06.2025» und «20:00» – oder «Heute», «Morgen», «Gestern», wie das alte
 * Backend sie kennt. Ohne lesbares Datum gibt es keinen Termin: Ein Spiel
 * ohne Zeit ist in der Agenda ein Fehler, kein Eintrag.
 */
function readStartsAt(dateText: string, timeText: string, now: Date = new Date()): string | null {
  const time = /(\d{1,2}):(\d{2})/.exec(timeText);
  const hour = time ? Number(time[1]) : 0;
  const minute = time ? Number(time[2]) : 0;

  const absolute = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(dateText);
  if (absolute) {
    return zurichToIso(Number(absolute[3]), Number(absolute[2]), Number(absolute[1]), hour, minute);
  }

  const relative: Record<string, number> = { heute: 0, morgen: 1, gestern: -1 };
  const shift = relative[dateText.trim().toLowerCase()];
  if (shift === undefined) return null;

  const local = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const read = (type: string) => Number(local.find((part) => part.type === type)?.value ?? 0);
  const base = new Date(Date.UTC(read('year'), read('month') - 1, read('day') + shift));
  return zurichToIso(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hour, minute);
}

/**
 * Der Spielplan eines Teams.
 *
 * Belegte Form (2026-09-11, Team 431869): `data.regions[0].rows[]` mit
 * `link.ids[0]` als Spielkennung und fünf Zellen – Datum/Zeit, Halle/Ort,
 * Heimteam, Gastteam, Resultat («3:4», «n.V.»). Die Liga steht in
 * `data.title` nach dem Komma («…, Herren NLB Gr. 1»). Die Ortszelle trägt
 * dazu `link: { type: 'map', x, y }` mit der Lage der Halle.
 */
function readGames(payload: unknown): { league: string | null; games: FederationGame[] } {
  const data = (payload as {
    data?: { title?: unknown; regions?: Array<{ rows?: unknown[] }> };
  })?.data;
  const title = typeof data?.title === 'string' ? data.title : '';
  const comma = title.indexOf(',');
  const league = comma >= 0 ? title.slice(comma + 1).trim() || null : null;

  const rows = data?.regions?.[0]?.rows;
  if (!Array.isArray(rows)) return { league, games: [] };

  const text = (cell: { text?: unknown } | undefined): string[] =>
    Array.isArray(cell?.text) ? cell!.text.map((entry) => String(entry ?? '').trim()) : [];

  const games: FederationGame[] = [];
  for (const row of rows as Array<{
    cells?: Array<{ text?: unknown; link?: { x?: unknown; y?: unknown } }>;
    link?: { ids?: unknown[] };
  }>) {
    const id = row?.link?.ids?.[0];
    if (id === undefined || id === null) continue;
    const cells = row?.cells ?? [];

    const [dateText = '', timeText = ''] = text(cells[0]);
    const startsAt = readStartsAt(dateText, timeText);
    if (!startsAt) continue;

    const [hall = '', city = ''] = text(cells[1]);
    const place = readCoordinates(cells[1]?.link?.y, cells[1]?.link?.x);
    const home = text(cells[2])[0] ?? '';
    const away = text(cells[3])[0] ?? '';
    const result = text(cells[4]).filter((part) => part.length > 0).join(' ');

    games.push({
      id: String(id),
      title: `${home} – ${away}`.trim(),
      startsAt,
      location: [hall, city].filter((part) => part.length > 0 && part !== '-').join(', ') || null,
      latitude: place?.latitude ?? null,
      longitude: place?.longitude ?? null,
      result: result.length > 0 ? result : null,
    });
  }
  return { league, games };
}

/** Ein Beitrag des Verbands, wie er in den Feed geht. */
interface FederationStory {
  id: string;
  title: string;
  /** Der Anriss – das, was die Karte in der Liste zeigt. */
  lead: string | null;
  /** Der Volltext, wenn der Verband ihn mitliefert; sonst `null` (BR-169). */
  html: string | null;
  imageUrl: string | null;
  author: string | null;
  url: string | null;
  publishedAt: string;
}

/**
 * Publishr legt einen Beitrag in **Elemente**: 1 ist der Titel, 6 der Anriss,
 * 13 das Bild, 61 der Volltext. Dieselben Nummern liest das alte Backend.
 *
 * Belegt am 15.09.2026 gegen die echte Schnittstelle (`fkMediahouse=61`,
 * 3 Beiträge): Titel, Anriss und Bild kommen, **Element 61 fehlt dort** – der
 * Newsraum von swiss unihockey führt keinen Volltext. Ein Beitrag ohne
 * Volltext ist kein Fehler: Die Karte zeigt den Anriss, und das Detail zeigt
 * ihn ebenfalls (`NewsCard`). Deshalb wird hier nichts erfunden.
 */
function storyElement(story: unknown, element: number): string | null {
  const items = (story as { storyItem?: Array<{ fkElement?: unknown; contentA?: unknown }> })
    ?.storyItem;
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    if (Number(item?.fkElement) !== element) continue;
    const value = typeof item?.contentA === 'string' ? item.contentA.trim() : '';
    if (value.length > 0) return value;
  }
  return null;
}

/**
 * Der Volltext ohne Skripte, Stile, Rahmen und Formulare.
 *
 * Das ist **nicht** die Sicherung – die sitzt vor dem DOM
 * (`app/src/lib/newsHtml.ts`, DOMPurify), weil in `news.body_html` auch
 * schreiben kann, wer eine News verfasst. Hier fällt nur weg, was nie
 * gespeichert gehört; wortgleich zu `toArticleHtml()` im Website-Abgleich.
 */
function toArticleHtml(html: string | null): string | null {
  if (!html) return null;
  const article = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(iframe|embed|input|button)\b[^>]*\/?>/gi, '')
    .trim();
  return article === '' ? null : article;
}

/**
 * Die Beiträge aus der Antwort von Publishr.
 *
 * Ein Beitrag ohne Kennung oder ohne Titel wird übersprungen: Er hätte im Feed
 * keine Überschrift und beim nächsten Abgleich keinen Schlüssel, über den er
 * sich wiedererkennen liesse.
 */
function readStories(payload: unknown, federation: Federation): FederationStory[] {
  const rows = (payload as { status?: unknown; data?: unknown })?.data;
  if (!Array.isArray(rows)) return [];

  const stories: FederationStory[] = [];
  for (const row of rows) {
    const entry = row as {
      id?: unknown;
      title?: unknown;
      creationTimestamp?: unknown;
      contenthubStory?: { publishTimestamp?: unknown; canonicalUrl?: unknown };
      storyAuthor?: Array<{ contact?: { firstName?: unknown; lastName?: unknown } }>;
    };

    const id = entry?.id;
    if (id === undefined || id === null) continue;

    const title = storyElement(row, 1) ?? (typeof entry.title === 'string' ? entry.title.trim() : '');
    if (!title) continue;

    const contact = entry.storyAuthor?.[0]?.contact;
    const author = [contact?.firstName, contact?.lastName]
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter((part) => part.length > 0)
      .join(' ');

    // Der Zeitpunkt der Veröffentlichung, nicht der des Anlegens: Ein Beitrag,
    // der drei Tage im Entwurf lag, gehört im Feed an seinen Erscheinungstag.
    const published = entry.contenthubStory?.publishTimestamp ?? entry.creationTimestamp;
    const publishedAt =
      typeof published === 'string' && !Number.isNaN(Date.parse(published))
        ? new Date(published).toISOString()
        : new Date().toISOString();

    const canonical = entry.contenthubStory?.canonicalUrl;

    stories.push({
      id: `${federation}:${id}`,
      title,
      lead: storyElement(row, 6),
      html: toArticleHtml(storyElement(row, 61)),
      imageUrl: storyElement(row, 13),
      // Die Herkunft steht am Beitrag, auch wenn niemand sie geschrieben hat:
      // «swiss unihockey» ist ehrlicher als eine leere Zeile.
      author: author.length > 0 ? author : null,
      // Publishr führt `canonicalUrl` meist nicht. Eine aus dem Kurznamen
      // zusammengebaute Adresse wäre geraten – und ein Verweis ins Leere ist
      // schlechter als keiner.
      url: typeof canonical === 'string' && canonical.startsWith('https://') ? canonical : null,
      publishedAt,
    });
  }
  return stories;
}

// ---------------------------------------------------------------------------
// Der Abgleich.
// ---------------------------------------------------------------------------

interface Credentials {
  club_id: string;
  federation: Federation;
  federation_club_id: string;
  api_key: string | null;
  /** FR-197: Will dieser Verein die Beiträge dieses Verbands im Feed? */
  news_enabled: boolean;
}

/**
 * Die Beiträge eines Verbands, **einmal je Lauf** geholt.
 *
 * Die News eines Verbands sind für alle seine Vereine dieselben. Ohne diesen
 * Zwischenspeicher fragte der nächtliche Lauf die Schnittstelle einmal pro
 * verbundenem Verein – dasselbe Ergebnis, zwanzigmal, und zwanzig Gelegenheiten
 * für ein Zeitlimit.
 *
 * Ein Fehlschlag wird mitgespeichert: Was einmal nicht ging, geht in derselben
 * Minute nicht noch einmal.
 */
type StoryCache = Map<Federation, { stories: FederationStory[] } | { error: string }>;

async function loadStories(
  cache: StoryCache,
  federation: Federation,
): Promise<{ stories: FederationStory[] } | { error: string }> {
  const known = cache.get(federation);
  if (known) return known;

  const endpoint = newsEndpoint(federation);
  const result = !endpoint
    ? { error: 'Für diesen Verband sind keine News eingerichtet' }
    : await getJson(endpoint.url, endpoint.token)
        .then((payload) => {
          const stories = readStories(payload, federation);
          return stories.length > 0
            ? { stories }
            : { error: 'Der Verband liefert derzeit keine Beiträge' };
        })
        .catch((cause: unknown) => ({
          error: cause instanceof Error ? cause.message : String(cause),
        }));

  cache.set(federation, result);
  return result;
}

/**
 * Die Beiträge des Verbands in den Feed **eines** Vereins (FR-197).
 *
 * Gibt zurück, wie viele Beiträge stehen – oder warum keiner. Ein
 * **Fehlschlag hier setzt die Verbindung nicht auf `error`**: Der Spielplan
 * ist der Zweck der Verbindung (BR-152), die News sind die Zugabe. Eine
 * Verbandsverbindung als kaputt zu melden, weil ein Newsraum nicht antwortet,
 * schickte den Vorstand einen Fehler suchen, der seine Termine nicht betrifft
 * (BR-155).
 */
async function syncNews(
  admin: SupabaseClient,
  row: Credentials,
  cache: StoryCache,
): Promise<{ news: number; newsError?: string }> {
  const loaded = await loadStories(cache, row.federation);
  if ('error' in loaded) return { news: 0, newsError: loaded.error };

  let written = 0;
  for (const story of loaded.stories) {
    const { data, error } = await admin.rpc('upsert_federation_news', {
      p_club_id: row.club_id,
      p_federation: row.federation,
      p_external_id: story.id,
      p_title: story.title,
      p_body: story.lead,
      p_body_html: story.html,
      p_image_url: story.imageUrl,
      p_author: story.author,
      p_external_url: story.url,
      p_published_at: story.publishedAt,
    });
    if (error) return { news: written, newsError: error.message };
    // `false` heisst: Der Verein will diese News (nicht mehr). Kein Fehler.
    if (data === false) return { news: 0 };
    written += 1;
  }
  return { news: written };
}

interface LinkedTeam {
  id: string;
  name: string;
  federation_team_id: string;
}

/**
 * Die Spiele **eines** verknüpften Teams als Termine (UC-039, Schritt 9).
 *
 * Gibt die Zahl der Spiele zurück; wirft, wenn der Spielplan nicht lesbar
 * ist – der Aufrufer entscheidet, was das für die Verbindung heisst.
 */
async function syncGames(
  admin: SupabaseClient,
  row: Credentials,
  team: LinkedTeam,
  remote: FederationTeam,
): Promise<number> {
  const endpoint = ENDPOINTS[row.federation].gamesUrl;
  let league = remote.league;
  let games: FederationGame[] = [];

  if (endpoint) {
    const parsed = readGames(await getJson(endpoint(remote.id, federationSeason()), row.api_key));
    league = parsed.league ?? league;
    games = parsed.games;
  }

  // Erst der Name und die Liga (BR-176), dann die Spiele: `report_team_sync`
  // löscht einen etwaigen Vermerk «veraltet», ohne den kein Spiel entstünde.
  const { error: teamError } = await admin.rpc('report_team_sync', {
    p_team_id: team.id,
    p_found: true,
    p_name: remote.name,
    p_league: league,
  });
  if (teamError) throw new Error(teamError.message);

  for (const game of games) {
    const { error } = await admin.rpc('upsert_federation_game', {
      p_team_id: team.id,
      p_external_id: `${row.federation}:${game.id}`,
      p_title: game.title,
      p_starts_at: game.startsAt,
      p_location: game.location,
      p_result: game.result,
      p_latitude: game.latitude,
      p_longitude: game.longitude,
    });
    if (error) throw new Error(error.message);
  }
  return games.length;
}

/**
 * Ein Verein, ein Verband, ein Lauf.
 *
 * Erst die Teams – sie sind der Testaufruf, der die Verbindung bestätigt –,
 * dann je verknüpftem Team die Spiele (BR-152: nur, was verknüpft ist). Ein
 * Team, das der Verband nicht mehr nennt, wird veraltet vermerkt (A6).
 */
async function syncOne(
  admin: SupabaseClient,
  row: Credentials,
  cache: StoryCache = new Map(),
): Promise<{
  club: string;
  federation: string;
  ok: boolean;
  teams?: number;
  games?: number;
  stale?: number;
  news?: number;
  newsError?: string;
  error?: string;
}> {
  const endpoint = ENDPOINTS[row.federation]?.teamsUrl;

  // Die News hängen nicht am Spielplan: Sie kommen auch dann, wenn der Verein
  // noch kein Team verknüpft hat (BR-152 gilt den Spielen, nicht den
  // Beiträgen) – und sie fehlen, ohne die Verbindung zu beschädigen.
  const news = row.news_enabled ? await syncNews(admin, row, cache) : { news: 0 };

  const fail = async (error: string) => {
    await admin.rpc('report_federation_sync', {
      p_club_id: row.club_id,
      p_federation: row.federation,
      p_ok: false,
      p_error: error,
    });
    // Auch ein misslungener Spielplan-Abgleich sagt, was aus den News wurde:
    // Sie hängen nicht aneinander, und wer nur die Meldung liest, soll nicht
    // raten müssen.
    return { club: row.club_id, federation: row.federation, ok: false, error, ...news };
  };

  if (!endpoint) return fail('Für diesen Verband besteht noch keine Schnittstelle');

  let teams: FederationTeam[];
  try {
    teams = readTeams(await getJson(endpoint(row.federation_club_id, federationSeason()), row.api_key));
    if (teams.length === 0) {
      throw new Error('Der Verband kennt zu dieser Vereinskennung keine Teams');
    }
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : String(cause));
  }

  const { data: linked, error: linkedError } = await admin
    .from('teams')
    .select('id, name, federation_team_id')
    .eq('club_id', row.club_id)
    .eq('federation', row.federation)
    .not('federation_team_id', 'is', null);
  if (linkedError) return fail(linkedError.message);

  let games = 0;
  let stale = 0;
  const problems: string[] = [];

  for (const team of (linked ?? []) as LinkedTeam[]) {
    const remote = teams.find((entry) => entry.id === team.federation_team_id);
    if (!remote) {
      stale += 1;
      await admin.rpc('report_team_sync', { p_team_id: team.id, p_found: false });
      continue;
    }
    try {
      games += await syncGames(admin, row, team, remote);
    } catch (cause) {
      // Ein Spielplan, der nicht lesbar ist, hält die anderen nicht auf – aber
      // er steht am Ende in der Meldung, damit jemand hinsieht.
      problems.push(`${team.name}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  if (problems.length > 0) {
    const result = await fail(problems.join(' · '));
    return { ...result, teams: teams.length, games, stale };
  }

  await admin.rpc('report_federation_sync', {
    p_club_id: row.club_id,
    p_federation: row.federation,
    p_ok: true,
  });
  return {
    club: row.club_id,
    federation: row.federation,
    ok: true,
    teams: teams.length,
    games,
    stale,
    ...news,
  };
}

// ---------------------------------------------------------------------------
// Einstieg.
// ---------------------------------------------------------------------------

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authorization = request.headers.get('Authorization');

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let body: {
    mode?: string;
    clubId?: string;
    federation?: string;
    federationClubId?: string;
    apiKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Ungültige Anfrage' }, 400);
  }

  // --- Nächtlicher Abgleich (BR-152: nur verbundene Vereine) ---------------
  if (body.mode === 'all') {
    if (tokenRole(authorization) !== 'service_role') {
      return json({ error: 'Nur der Zeitplan darf alle Verbindungen abgleichen' }, 403);
    }

    // Der Schlüssel kommt aus dem Tresor und nie aus der Tabelle.
    const { data, error } = await admin.rpc('federation_credentials', {
      p_club_id: null,
    });
    if (error) return json({ error: error.message }, 500);

    // Nacheinander: Zwanzig Verbandsabfragen gleichzeitig bringen nichts ein,
    // kosten aber jedes Zeitlimit gleichzeitig.
    //
    // Der Zwischenspeicher hält die Beiträge je Verband über den ganzen Lauf:
    // Sie sind für alle Vereine desselben Verbands dieselben (FR-197).
    const cache: StoryCache = new Map();
    const results = [];
    for (const row of (data ?? []) as Credentials[]) {
      results.push(await syncOne(admin, row, cache));
    }
    return json({ synced: results.length, results });
  }

  // --- Die Aufrufe des Vorstands ------------------------------------------
  const clubId = body.clubId?.trim();
  const federation = body.federation as Federation | undefined;

  if (!clubId || !federation) {
    return json({ error: 'clubId und federation sind nötig' }, 400);
  }
  if (!(federation in ENDPOINTS)) {
    return json({ error: 'Unbekannter Verband' }, 400);
  }
  if (!authorization) return json({ error: 'Nicht angemeldet' }, 401);

  // Die Berechtigung prüft die Datenbank, nicht diese Function: `is_club_admin`
  // ist dieselbe Funktion, die auch in den Policies steht (§9). Auch das
  // Prüfen ruft eine fremde Schnittstelle vom Server aus auf und steht deshalb
  // nicht jedem Mitglied offen.
  const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: isAdmin, error: adminError } = await caller.rpc('is_club_admin', {
    p_club_id: clubId,
  });
  if (adminError) return json({ error: adminError.message }, 400);
  if (isAdmin !== true) {
    return json({ error: 'Nur der Vorstand verbindet den Verband' }, 403);
  }

  // --- UC-039, Schritt 9: den Abgleich dieser Verbindung sofort ------------
  if (body.mode === 'sync') {
    // Wie in der Nacht: der Schlüssel aus dem Tresor (BR-178), `syncOne` für
    // genau diese Verbindung. Ein Verband ohne Schnittstelle oder ohne
    // Verbindung ist eine Antwort mit `ok: false`, kein Fehlerstatus – die
    // Verknüpfung ist da, nur die Spiele fehlen noch.
    const { data, error } = await admin.rpc('federation_credentials', { p_club_id: clubId });
    if (error) return json({ error: error.message }, 500);
    const row = ((data ?? []) as Credentials[]).find((entry) => entry.federation === federation);
    if (!row) {
      return json({ ok: false, error: 'Dieser Verband ist nicht verbunden' });
    }
    return json(await syncOne(admin, row));
  }

  const endpoint = ENDPOINTS[federation].teamsUrl;
  if (!endpoint) {
    return json({ error: 'Für diesen Verband besteht noch keine Schnittstelle' }, 400);
  }

  // --- UC-039, Schritte 3–4: die Teamliste zum Verknüpfen ------------------
  if (body.mode === 'teams') {
    // BR-178: Der Schlüssel kommt aus dem Tresor; der Client hat ihn nie.
    const { data, error } = await admin.rpc('federation_credentials', { p_club_id: clubId });
    if (error) return json({ error: error.message }, 500);
    const row = ((data ?? []) as Credentials[]).find((entry) => entry.federation === federation);
    if (!row) {
      return json({ ok: false, error: 'Dieser Verband ist nicht verbunden' });
    }

    try {
      const teams = readTeams(await getJson(endpoint(row.federation_club_id, federationSeason()), row.api_key));
      if (teams.length === 0) {
        throw new Error('Der Verband kennt zu dieser Vereinskennung keine Teams');
      }
      // Ein gelungener Abruf mit dem hinterlegten Schlüssel **ist** ein
      // Abgleich: Die Verbindung gilt ab jetzt als aktiv (Vorbedingung von
      // UC-039) – ohne auf die Nacht zu warten.
      await admin.rpc('report_federation_sync', {
        p_club_id: clubId,
        p_federation: federation,
        p_ok: true,
      });
      return json({ ok: true, teams });
    } catch (cause) {
      // A4: Die Meldung des Verbands, wörtlich – das Formular bleibt bedienbar.
      const message = cause instanceof Error ? cause.message : String(cause);
      await admin.rpc('report_federation_sync', {
        p_club_id: clubId,
        p_federation: federation,
        p_ok: false,
        p_error: message,
      });
      return json({ ok: false, error: message });
    }
  }

  // --- UC-035, Schritt 5: der Testaufruf des Vorstands ---------------------
  const federationClubId = body.federationClubId?.trim();
  if (!federationClubId) {
    return json({ error: 'federationClubId ist nötig' }, 400);
  }

  try {
    const payload = await getJson(
      endpoint(federationClubId, federationSeason()),
      body.apiKey?.trim() || null,
    );
    const teams = readTeams(payload);

    if (teams.length === 0) {
      // A1: Der Testaufruf schlägt fehl. **Nichts wird gespeichert** – die
      // Meldung des Verbands steht im Blatt, und der Vorstand korrigiert die
      // Kennung.
      return json({ ok: false, error: 'Der Verband kennt zu dieser Vereinskennung keine Teams' });
    }

    return json({ ok: true, teams });
  } catch (cause) {
    return json({ ok: false, error: cause instanceof Error ? cause.message : String(cause) });
  }
});

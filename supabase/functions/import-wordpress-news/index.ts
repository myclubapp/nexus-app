/**
 * News von der Vereins-Website übernehmen (UC-038).
 *
 * Gegenstück zu `updateClubNewsFromWordpress()` im alten Backend
 * (github.com/myclubapp/backend, functions/src/scheduler/syncAssociation.scheduler.ts).
 * Gleiche Quelle, gleiche Felder, gleiche Deduplikation über die Beitrags-ID
 * der Website – nur schreibt sie hier nach Postgres statt nach Firestore.
 *
 * Warum überhaupt serverseitig: Vereinswebsites antworten langsam, stehen
 * hinter Firewalls und weisen Aufrufe ohne browserähnlichen User-Agent ab.
 * Dazu kommt der nächtliche Abgleich (0023_news_sync_schedule.sql), den es im
 * Client gar nicht geben kann.
 *
 * Drei Betriebsarten:
 *   { mode: 'check', clubId, url }   – Website prüfen, nichts speichern (BR-173)
 *   { clubId, url, postLimit, … }    – Vorstand verbindet (Berechtigung: is_club_admin)
 *   { mode: 'all' }                  – nächtlicher Abgleich (nur service_role)
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/** Vorgabe und Obergrenze für `news_sources.post_limit` (BR-174). */
const DEFAULT_POST_LIMIT = 20;
/** Die Schnittstelle liefert pro Anfrage nicht mehr – dieselbe Zahl wie in 0048. */
const MAX_POST_LIMIT = 100;

/** Eine langsame Vereinswebsite darf den Abgleich nicht blockieren. */
const FETCH_TIMEOUT_MS = 15_000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Ein Aufruf ohne diese Kopfzeilen wird von Firewalls vor Vereinswebsites als
 * Bot abgewiesen. Das alte Backend schickte zusätzlich ein festes
 * `Host: kadettensh.ch` mit – ein Kopierfehler, der für jede andere Website
 * die falsche Zieladresse behauptet. Deshalb hier nicht übernommen.
 */
const BROWSER_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'de,fr;q=0.8,it;q=0.7,en;q=0.6',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 myclub-nexus/1.0',
};

/**
 * Wie die Schnittstelle erreichbar ist (Spalte `news_sources.api_style`).
 * `pretty` ist der Normalfall, `query` der Weg für Websites ohne sprechende
 * Adressen – dort liegt dieselbe Schnittstelle unter `?rest_route=`.
 */
type ApiStyle = 'pretty' | 'query';
const API_STYLES: ApiStyle[] = ['pretty', 'query'];

interface WordpressPost {
  id: number;
  date?: string;
  date_gmt?: string;
  link?: string;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  content?: { rendered?: string };
  _embedded?: {
    author?: Array<{ name?: string; avatar_urls?: Record<string, string> }>;
    'wp:featuredmedia'?: Array<{
      code?: string;
      source_url?: string;
      media_details?: { sizes?: Record<string, { source_url?: string }> };
    }>;
  };
}

interface NewsRow {
  club_id: string;
  source: 'website';
  external_id: string;
  external_url: string | null;
  title: string;
  body: string | null;
  body_html: string | null;
  image_url: string | null;
  author: string | null;
  author_image_url: string | null;
  published_at: string;
  synced_at: string;
}

/** Eine Kategorie der Website, wie die Ansicht sie zur Auswahl stellt. */
interface Category {
  id: number;
  name: string;
  count: number;
}

interface SourceRow {
  id: string;
  club_id: string;
  url: string;
  api_style: ApiStyle;
  post_limit: number;
  categories: Array<{ id?: number }> | null;
}

// --- HTML aus der Website in das, was die App anzeigen darf -----------------
// Zwei Felder, wie in der bestehenden myclub-App (`leadText` und `text`):
// `body` ist der Anriss als reiner Text für die Karte in der Liste,
// `body_html` der Volltext für das Detail – mit Absätzen und den Bildern im
// Text. Entschärft wird der Volltext nicht hier, sondern beim Anzeigen
// (app/src/lib/newsHtml.ts, DOMPurify mit fester Liste erlaubter Elemente):
// Was in der Datenbank steht, kann jede Trainer:in über die Policy auch
// direkt schreiben, deshalb muss die Sicherung vor dem DOM sitzen, nicht vor
// der Tabelle. Hier fällt nur weg, was nie gespeichert gehört (BR-169).

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '',
  hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»',
  bdquo: '„', ldquo: '“', rdquo: '”', sbquo: '‚', lsquo: '‘', rsquo: '’',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  agrave: 'à', eacute: 'é', egrave: 'è', ccedil: 'ç', euro: '€', deg: '°',
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name] ?? match);
}

function toPlainText(html: string | undefined): string {
  if (!html) return '';
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, ' ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Der Volltext, wie die Website ihn liefert – ohne Skripte, Stile, Rahmen und
 * Formulare. Das ist **nicht** die Sicherung (die sitzt in der App), sondern
 * Entlastung: Ein Skriptrumpf oder ein eingebettetes Video wären totes
 * Gewicht in jeder Zeile und in jedem Abruf der App.
 */
function toArticleHtml(html: string | undefined): string | null {
  if (!html) return null;
  const article = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(iframe|embed|input|button)\b[^>]*\/?>/gi, '')
    .trim();
  return article === '' ? null : article;
}

/**
 * Das Beitragsbild. `_embed=1` liefert es mit dem Beitrag zusammen; das alte
 * Backend holte dafür pro Beitrag zwei weitere Aufrufe über `_links`. Gleiche
 * Daten, ein Aufruf statt einundvierzig.
 */
function featuredImage(post: WordpressPost): string | null {
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  // Ein nicht lesbares Medium kommt als Fehlerobjekt zurück, nicht als 404.
  if (!media || media.code) return null;
  const sizes = media.media_details?.sizes;
  return (
    sizes?.medium_large?.source_url ??
    sizes?.medium?.source_url ??
    media.source_url ??
    null
  );
}

function mapPost(post: WordpressPost, clubId: string, syncedAt: string): NewsRow | null {
  const title = toPlainText(post.title?.rendered);
  if (!post.id || !title) return null;

  const author = post._embedded?.author?.[0];
  const avatars = author?.avatar_urls ?? {};

  // `date` ist Ortszeit ohne Zeitzone und würde je nach Server um Stunden
  // danebenliegen; `date_gmt` ist UTC und wird hier als solche markiert.
  const publishedAt = post.date_gmt
    ? `${post.date_gmt.replace(/Z$/, '')}Z`
    : (post.date ?? syncedAt);

  return {
    club_id: clubId,
    source: 'website',
    external_id: String(post.id),
    external_url: post.link ?? null,
    title,
    body: toPlainText(post.excerpt?.rendered) || null,
    body_html: toArticleHtml(post.content?.rendered),
    image_url: featuredImage(post),
    author: author?.name ?? null,
    author_image_url: avatars['96'] ?? avatars['48'] ?? avatars['24'] ?? null,
    published_at: publishedAt,
    synced_at: syncedAt,
  };
}

// --- Die Schnittstelle der Website -----------------------------------------

/**
 * Adresse einer Route der WordPress-Schnittstelle.
 *
 * Beide Wege führen zur selben Route; welcher trägt, hängt an den
 * Permalink-Einstellungen der Website und wird beim Prüfen einmal ermittelt.
 */
function apiUrl(
  site: string,
  style: ApiStyle,
  route: string,
  params: Record<string, string> = {},
): string {
  const query = new URLSearchParams(params).toString();
  if (style === 'query') {
    return `${site}/?rest_route=/${route}${query ? `&${query}` : ''}`;
  }
  return `${site}/wp-json/${route}${query ? `?${query}` : ''}`;
}

/** Eine Route holen. Der Rumpf muss JSON sein, sonst ist es keine Schnittstelle. */
async function fetchApi(url: string): Promise<{ payload: unknown; response: Response }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) {
      // Der Rumpf wird verworfen, aber gelesen: Eine offene Antwort ohne
      // gelesenen Rumpf hält die Verbindung im Laufzeitsystem fest.
      await response.body?.cancel();
      throw new Error(`${response.status} ${response.statusText}`);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      // Eine Website ohne Schnittstelle liefert unter dieser Adresse ihre
      // Startseite. Ohne diese Prüfung stünde später ein «not iterable».
      throw new Error('Antwort ist kein JSON');
    }
    return { payload, response };
  } finally {
    clearTimeout(timer);
  }
}

interface Discovery {
  style: ApiStyle;
  siteName: string | null;
}

/**
 * Ist das eine WordPress-Schnittstelle, und wie ist sie erreichbar? (BR-173)
 *
 * Zuerst die Wurzel der Schnittstelle: Sie nennt den Namen der Website und die
 * angebotenen Namensräume; `wp/v2` darunter ist der Beleg für WordPress.
 * Sperrt ein Sicherheits-Plugin die Wurzel – auf Vereinsseiten nicht selten –,
 * entscheidet der Beitrags-Endpunkt selbst. Erst wenn beide Wege in beiden
 * Schreibweisen schweigen, ist es keine WordPress-Website.
 */
async function discover(site: string): Promise<Discovery> {
  const notes: string[] = [];

  for (const style of API_STYLES) {
    try {
      const { payload } = await fetchApi(
        apiUrl(site, style, '', { _fields: 'name,namespaces' }),
      );
      const root = payload as { name?: unknown; namespaces?: unknown };
      if (Array.isArray(root.namespaces) && root.namespaces.includes('wp/v2')) {
        const name = typeof root.name === 'string' ? toPlainText(root.name) : '';
        return { style, siteName: name || null };
      }
      notes.push(`${style}: Antwort ohne wp/v2`);
    } catch (cause) {
      notes.push(`${style}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  for (const style of API_STYLES) {
    try {
      const { payload } = await fetchApi(
        apiUrl(site, style, 'wp/v2/posts', { per_page: '1', _fields: 'id' }),
      );
      if (Array.isArray(payload)) return { style, siteName: null };
    } catch {
      // Die Ursache steht bereits in `notes`; ein zweiter Eintrag derselben
      // Adresse machte die Meldung länger, nicht klarer.
    }
  }

  throw new Error(
    `Unter dieser Adresse antwortet keine WordPress-Schnittstelle (${notes.join('; ')})`,
  );
}

/** Die Kategorien der Website, die häufigste zuerst. */
async function fetchCategories(site: string, style: ApiStyle): Promise<Category[]> {
  try {
    const { payload } = await fetchApi(
      apiUrl(site, style, 'wp/v2/categories', {
        per_page: '100',
        orderby: 'count',
        order: 'desc',
        hide_empty: 'true',
        _fields: 'id,name,count',
      }),
    );
    if (!Array.isArray(payload)) return [];
    return (payload as Array<{ id?: number; name?: string; count?: number }>)
      .filter((term) => typeof term.id === 'number')
      .map((term) => ({
        id: term.id!,
        name: toPlainText(term.name) || `#${term.id}`,
        count: typeof term.count === 'number' ? term.count : 0,
      }));
  } catch {
    // Eine Website ohne lesbare Kategorien ist kein Grund, die Prüfung
    // scheitern zu lassen: Dann kommen eben alle Beiträge.
    return [];
  }
}

/**
 * Wie viele Beiträge die Website veröffentlicht hat. Die Zahl steht in der
 * Kopfzeile `X-WP-Total`; ein Beitrag wird geholt, nicht alle.
 */
async function fetchTotalPosts(site: string, style: ApiStyle): Promise<number | null> {
  try {
    const { response } = await fetchApi(
      apiUrl(site, style, 'wp/v2/posts', { per_page: '1', _fields: 'id' }),
    );
    const total = Number(response.headers.get('X-WP-Total'));
    return Number.isFinite(total) && total >= 0 ? total : null;
  } catch {
    return null;
  }
}

async function fetchPosts(
  site: string,
  style: ApiStyle,
  limit: number,
  categoryIds: number[],
): Promise<WordpressPost[]> {
  const params: Record<string, string> = {
    per_page: String(limit),
    orderby: 'date',
    order: 'desc',
    _embed: '1',
  };
  // Leere Auswahl heisst alle Kategorien (BR-174); die Schnittstelle nimmt
  // eine Liste von Ids und liefert Beiträge aus jeder davon.
  if (categoryIds.length > 0) params.categories = categoryIds.join(',');

  const { payload } = await fetchApi(apiUrl(site, style, 'wp/v2/posts', params));
  if (!Array.isArray(payload)) {
    throw new Error('Keine WordPress-Beiträge unter dieser Adresse');
  }
  return payload as WordpressPost[];
}

// --- Abgleich ---------------------------------------------------------------

/** Die gewählten Kategorie-Ids aus der gespeicherten Auswahl. */
function categoryIdsOf(source: SourceRow): number[] {
  if (!Array.isArray(source.categories)) return [];
  return source.categories
    .map((entry) => Number(entry?.id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

/** Eine Quelle abgleichen und ihren Status festhalten. */
async function syncSource(
  admin: SupabaseClient,
  source: SourceRow,
): Promise<{ clubId: string; imported: number; error: string | null }> {
  const syncedAt = new Date().toISOString();

  try {
    const posts = await fetchPosts(
      source.url,
      source.api_style ?? 'pretty',
      clampPostLimit(source.post_limit),
      categoryIdsOf(source),
    );
    const rows = posts
      .map((post) => mapPost(post, source.club_id, syncedAt))
      .filter((row): row is NewsRow => row !== null);

    if (rows.length > 0) {
      // Der zweite Abgleich aktualisiert denselben Beitrag, statt ihn erneut
      // anzulegen – der Schlüssel ist `news_external_key` aus 0022.
      const { error } = await admin
        .from('news')
        .upsert(rows, { onConflict: 'club_id,source,external_id' });
      if (error) throw new Error(error.message);
    }

    await admin
      .from('news_sources')
      .update({
        last_sync_at: syncedAt,
        last_status: 'ok',
        last_error: null,
        last_imported: rows.length,
      })
      .eq('id', source.id);

    return { clubId: source.club_id, imported: rows.length, error: null };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);

    // Der Fehler gehört an die Quelle, nicht nur ins Log: Der Vorstand soll in
    // den Vereinseinstellungen sehen, warum seit drei Wochen nichts ankommt.
    await admin
      .from('news_sources')
      .update({ last_sync_at: syncedAt, last_status: 'error', last_error: message })
      .eq('id', source.id);

    return { clubId: source.club_id, imported: 0, error: message };
  }
}

// --- Eingaben ---------------------------------------------------------------

function clampPostLimit(value: unknown): number {
  const limit = Math.trunc(Number(value));
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_POST_LIMIT;
  return Math.min(limit, MAX_POST_LIMIT);
}

/**
 * Die gewählten Kategorien so, wie sie in `news_sources.categories` stehen.
 * Der Name kommt aus der Auswahl der Ansicht und wird entschärft: Er wird
 * später als Text angezeigt, stammt aber von einer fremden Website.
 */
function cleanCategories(value: unknown): Array<{ id: number; name: string }> {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const result: Array<{ id: number; name: string }> = [];
  for (const entry of value) {
    const id = Math.trunc(Number((entry as { id?: unknown })?.id));
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    const name = toPlainText(String((entry as { name?: unknown })?.name ?? '')).slice(0, 120);
    result.push({ id, name: name || `#${id}` });
  }
  return result.slice(0, 50);
}

/**
 * Zeigt die Adresse ins eigene Netz?
 *
 * Die Function holt eine Adresse, die eine angemeldete Person bestimmt. Ohne
 * diese Schranke wäre sie ein Fernrohr in jedes Netz, das der Server erreicht.
 * Namen, die erst über DNS auf eine private Adresse zeigen, fängt sie nicht –
 * dafür bräuchte es eine Auflösung vor dem Abruf, die Deno nicht anbietet.
 */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (host === 'localhost' || /\.(localhost|local|internal|home|lan)$/.test(host)) return true;

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  // Nur echte IPv6-Literale prüfen: Ein Vereinsname wie «fcbasel.ch» beginnt
  // ebenfalls mit «fc», ist aber keine Adresse im lokalen Netz.
  if (host.includes(':')) {
    return host === '::1' || /^(fc|fd|fe80)/.test(host);
  }
  return false;
}

/** Die vom Client geschickte Adresse annehmen oder mit einem Grund ablehnen. */
function acceptSiteUrl(raw: string | undefined): { url: string } | { error: string } {
  const url = raw?.trim().replace(/\/+$/, '') ?? '';
  if (!url) return { error: 'clubId und url sind nötig' };
  if (!url.startsWith('https://')) {
    return { error: 'Die Adresse muss mit https:// beginnen' };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: 'Die Adresse ist keine gültige Website-Adresse' };
  }
  if (!parsed.hostname.includes('.') || isPrivateHost(parsed.hostname)) {
    return { error: 'Diese Adresse zeigt nicht auf eine öffentliche Website' };
  }
  return { url };
}

// --- Berechtigung -----------------------------------------------------------

/** Rolle aus dem bereits vom Gateway geprüften JWT. */
function tokenRole(authorization: string | null): string | null {
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role ?? null;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

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
    url?: string;
    postLimit?: unknown;
    categories?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Ungültige Anfrage' }, 400);
  }

  // --- Nächtlicher Abgleich ------------------------------------------------
  if (body.mode === 'all') {
    if (tokenRole(authorization) !== 'service_role') {
      return json({ error: 'Nur der Zeitplan darf alle Quellen abgleichen' }, 403);
    }

    const { data: sources, error } = await admin
      .from('news_sources')
      .select('id, club_id, url, api_style, post_limit, categories')
      .eq('kind', 'wordpress')
      .eq('active', true);
    if (error) return json({ error: error.message }, 500);

    // Nacheinander, nicht parallel: Zwanzig Vereinswebsites gleichzeitig
    // anzufragen bringt nichts ein, kostet aber jedes Zeitlimit gleichzeitig.
    const results = [];
    for (const source of (sources ?? []) as SourceRow[]) {
      results.push(await syncSource(admin, source));
    }
    return json({ synced: results.length, results });
  }

  // --- Vorstand: prüfen oder verbinden -------------------------------------
  const clubId = body.clubId?.trim();
  const accepted = acceptSiteUrl(body.url);

  if (!clubId) return json({ error: 'clubId und url sind nötig' }, 400);
  if ('error' in accepted) return json({ error: accepted.error }, 400);
  if (!authorization) return json({ error: 'Nicht angemeldet' }, 401);

  // Die Berechtigung prüft die Datenbank, nicht diese Function: `is_club_admin`
  // ist dieselbe Funktion, die auch in den RLS-Policies steht (§9). Sie gilt
  // für beide Betriebsarten – auch das Prüfen ruft eine fremde Website vom
  // Server aus auf und steht deshalb nicht jedem Mitglied offen.
  const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: isAdmin, error: adminError } = await caller.rpc('is_club_admin', {
    p_club_id: clubId,
  });
  if (adminError) return json({ error: adminError.message }, 400);
  if (isAdmin !== true) {
    return json({ error: 'Nur der Vorstand kann die Website verbinden' }, 403);
  }

  const site = accepted.url;

  // Beide Betriebsarten beginnen mit derselben Frage: Ist da WordPress?
  // Erst wenn sie mit Ja beantwortet ist, entsteht eine Quelle (BR-173).
  let found: Discovery;
  try {
    found = await discover(site);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);

    // Antwortet die **verbundene** Website beim Aktualisieren nicht mehr,
    // gehört das an die Quelle und nicht nur in eine Meldung, die mit der
    // Ansicht verschwindet (A2). Zwei Einschränkungen: Das Prüfen schreibt
    // nichts – es ist die Betriebsart, die nichts verändert –, und eine
    // andere Adresse lässt die bestehende Quelle unberührt, damit ein
    // Tippfehler beim Umstellen keine laufende Verbindung als kaputt
    // markiert.
    if (body.mode !== 'check') {
      await admin
        .from('news_sources')
        .update({
          last_sync_at: new Date().toISOString(),
          last_status: 'error',
          last_error: message,
        })
        .eq('club_id', clubId)
        .eq('kind', 'wordpress')
        .eq('url', site);
    }

    return json({ error: message }, 422);
  }

  // --- Prüfen: melden, was da ist, und nichts speichern --------------------
  if (body.mode === 'check') {
    const [categories, totalPosts] = await Promise.all([
      fetchCategories(site, found.style),
      fetchTotalPosts(site, found.style),
    ]);
    return json({
      url: site,
      apiStyle: found.style,
      siteName: found.siteName,
      totalPosts,
      categories,
    });
  }

  // --- Verbinden -----------------------------------------------------------
  const { data: member } = await caller
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .single();

  const { data: source, error: sourceError } = await admin
    .from('news_sources')
    .upsert(
      {
        club_id: clubId,
        kind: 'wordpress',
        url: site,
        api_style: found.style,
        site_name: found.siteName,
        post_limit: clampPostLimit(body.postLimit),
        categories: cleanCategories(body.categories),
        active: true,
        created_by: member?.id ?? null,
      },
      { onConflict: 'club_id,kind' },
    )
    .select('id, club_id, url, api_style, post_limit, categories')
    .single();
  if (sourceError) return json({ error: sourceError.message }, 400);

  const result = await syncSource(admin, source as SourceRow);
  // Ein Tippfehler in der Adresse ist ein Fehler der Eingabe und gehört als
  // solcher zurück – sonst meldet der Wizard «0 Beiträge» und verschweigt ihn.
  return json(result, result.error ? 422 : 200);
});

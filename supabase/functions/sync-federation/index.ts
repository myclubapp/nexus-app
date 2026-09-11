/**
 * Den Verband verbinden und abgleichen (UC-035).
 *
 * Gegenstück zu `syncAssociation.scheduler.ts` im alten Backend
 * (github.com/myclubapp/backend): dieselben Verbände, dieselben Endpunkte –
 * nur holt der Abgleich hier ausschliesslich Daten **verbundener** Vereine
 * (BR-152) und schreibt nach Postgres statt nach Firestore.
 *
 * Warum serverseitig: Die Verbandsschnittstellen sprechen kein CORS, der
 * Schlüssel darf das Gerät nie erreichen (BR-153), und der nächtliche Lauf
 * (`0058_federation.sql`) kann im Client gar nicht stattfinden.
 *
 * Zwei Betriebsarten:
 *   { mode: 'check', clubId, federation, federationClubId, apiKey? }
 *       – Testaufruf des Vorstands (Schritt 5). **Schreibt nichts.**
 *   { mode: 'all' } – der nächtliche Abgleich, nur für `service_role`.
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
 * `teamsUrl` ist der **Testaufruf** aus Schritt 5: Antwortet er mit den Teams
 * des Vereins, stimmt die Kennung – und der Vorstand sieht sofort, dass er den
 * richtigen Verein erwischt hat. Eine Prüfung, die nur «ok» sagt, liesse ihn
 * mit einer fremden Vereinskennung zufrieden zurück.
 *
 * Heute trägt nur Swiss Unihockey eine offen dokumentierte Schnittstelle. Die
 * übrigen drei stehen in der Liste, weil das alte Backend sie kennt; ohne
 * Endpunkt bleibt ihr Eintrag `null` und die Verbindung `pending` – das ist
 * ehrlicher als ein Testaufruf, der immer gelingt.
 */
const ENDPOINTS: Record<Federation, { teamsUrl: ((clubId: string, season: number) => string) | null }> = {
  swissunihockey: {
    teamsUrl: (clubId, season) =>
      `https://api-v2.swissunihockey.ch/api/teams?mode=by_club&club_id=${encodeURIComponent(clubId)}&season=${season}`,
  },
  swissvolley: { teamsUrl: null },
  swisshandball: { teamsUrl: null },
  swissturnverband: { teamsUrl: null },
};

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

/**
 * Die Teams eines Vereins beim Verband.
 *
 * Swiss Unihockey liefert eine Tabelle mit Zeilen; die Kennung des Teams steht
 * im `set_in_context` der Zeile. Die Form ist bewusst defensiv gelesen: Eine
 * Schnittstelle, die sich ändert, soll einen Fehler geben und nicht eine
 * Verbindung als kaputt melden, die es nicht ist.
 */
interface FederationTeam {
  id: string;
  name: string;
  league: string | null;
}

function readTeams(payload: unknown): FederationTeam[] {
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

interface Credentials {
  club_id: string;
  federation: Federation;
  federation_club_id: string;
  api_key: string | null;
}

/**
 * Ein Verein, ein Verband, ein Lauf.
 *
 * Der Abgleich holt heute die **Teams** – das ist, was UC-035 braucht, damit
 * der Vorstand in UC-039 verknüpfen kann. Spiele entstehen erst dort, weil
 * BR-152 sie an eine bestehende Verknüpfung bindet.
 */
async function syncOne(admin: SupabaseClient, row: Credentials): Promise<{
  club: string;
  federation: string;
  ok: boolean;
  teams?: number;
  error?: string;
}> {
  const endpoint = ENDPOINTS[row.federation]?.teamsUrl;

  if (!endpoint) {
    const error = 'Für diesen Verband besteht noch keine Schnittstelle';
    await admin.rpc('report_federation_sync', {
      p_club_id: row.club_id,
      p_federation: row.federation,
      p_ok: false,
      p_error: error,
    });
    return { club: row.club_id, federation: row.federation, ok: false, error };
  }

  try {
    const payload = await getJson(
      endpoint(row.federation_club_id, federationSeason()),
      row.api_key,
    );
    const teams = readTeams(payload);

    if (teams.length === 0) {
      throw new Error('Der Verband kennt zu dieser Vereinskennung keine Teams');
    }

    await admin.rpc('report_federation_sync', {
      p_club_id: row.club_id,
      p_federation: row.federation,
      p_ok: true,
    });
    return { club: row.club_id, federation: row.federation, ok: true, teams: teams.length };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    await admin.rpc('report_federation_sync', {
      p_club_id: row.club_id,
      p_federation: row.federation,
      p_ok: false,
      p_error: error,
    });
    return { club: row.club_id, federation: row.federation, ok: false, error };
  }
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
    const results = [];
    for (const row of (data ?? []) as Credentials[]) {
      results.push(await syncOne(admin, row));
    }
    return json({ synced: results.length, results });
  }

  // --- Schritt 5: der Testaufruf des Vorstands -----------------------------
  const clubId = body.clubId?.trim();
  const federation = body.federation as Federation | undefined;
  const federationClubId = body.federationClubId?.trim();

  if (!clubId || !federation || !federationClubId) {
    return json({ error: 'clubId, federation und federationClubId sind nötig' }, 400);
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

  const endpoint = ENDPOINTS[federation].teamsUrl;
  if (!endpoint) {
    return json({ error: 'Für diesen Verband besteht noch keine Schnittstelle' }, 400);
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

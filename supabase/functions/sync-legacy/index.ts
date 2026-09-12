/**
 * Termine aus der bisherigen myclub-App übernehmen (UC-040).
 *
 * Gegenstück zur Ionic-Angular-App (github.com/myclubapp/app): Sie hält je
 * Verein `club/<id>/events` (Anlässe), `club/<id>/helferEvents` mit der
 * Untersammlung `schichten`, `club/<id>/members` (mit `userProfile/<uid>`),
 * `club/<id>/teams` und je Team `teams/<id>/trainings` und `teams/<id>/games`;
 * Antworten liegen als `…/attendees/<uid>` unter dem jeweiligen Termin.
 * Dieser Dienst liest das und schreibt es nach Postgres – Anlässe als
 * `social`, Helfer-Events als `helper` mit Schichten, Trainings als
 * `training` am Team, Mitglieder ohne Konto, Zusagen als `attendance`.
 * Spiele kommen weiterhin vom Verband (UC-039); hier hängen nur ihre
 * Antworten daran (BR-194).
 *
 * Warum serverseitig: Das Service-Konto darf das Gerät nie erreichen
 * (BR-185), und der nächtliche Lauf (`0068_legacy_sources.sql`) hat keine
 * angemeldete Person.
 *
 * Drei Betriebsarten:
 *   { mode: 'check', clubId, firebaseClubId }
 *       – Testaufruf des Vorstands (Schritt 4). **Schreibt nichts.** Nennt
 *         den Namen des Vereins in der alten App und die Zahl der aktuellen
 *         Anlässe und Helfer-Events.
 *   { mode: 'sync', clubId }
 *       – die Übernahme für diesen Verein sofort (Schritte 6 und A3).
 *   { mode: 'all' }
 *       – der nächtliche Lauf über alle verbundenen Vereine, nur `service_role`.
 *
 * **Es gibt hier keinen Weg, der an Firebase schreibt.** Jeder Aufruf nach
 * aussen ist ein `GET`.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { FirestoreReader, type ServiceAccount } from './firestore.ts';
import {
  gameExternalId,
  isCurrent,
  isCurrentGame,
  isCurrentTraining,
  mapEvent,
  mapMember,
  mapResponse,
  mapTeam,
  mapTraining,
  type LegacyDoc,
  type LegacyEvent,
  type LegacyMember,
  type LegacyResponse,
  type LegacyTeam,
} from './mapping.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Die Rolle aus dem Token – dieselbe Prüfung wie bei den anderen Diensten. */
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

function serviceAccount(): ServiceAccount {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) throw new Error('Das Secret FIREBASE_SERVICE_ACCOUNT fehlt');
  const account = JSON.parse(raw) as Partial<ServiceAccount>;
  if (!account.project_id || !account.client_email || !account.private_key) {
    throw new Error('Das Secret FIREBASE_SERVICE_ACCOUNT ist unvollständig');
  }
  return account as ServiceAccount;
}

// ---------------------------------------------------------------------------
// Lesen, was die alte App hat.
// ---------------------------------------------------------------------------

interface LegacyClub {
  name: string | null;
  members: LegacyMember[];
  teams: LegacyTeam[];
  events: LegacyEvent[];
  /** Spiele der alten App, die hier schon als Verbandsspiele stehen sollten (BR-194). */
  games: number;
  responses: LegacyResponse[];
}

/** Firestore-Aufrufe gebündelt, aber nicht alle auf einmal: zehn zugleich. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Der Verein in der alten App: Name, Mitglieder, Teams und die **aktuellen**
 * Termine samt Antworten.
 *
 * Vergangenes bleibt dort, wo es war – die Punkte dafür sind in der alten
 * App gebucht, und eine Agenda voller alter Einsätze hilft niemandem.
 */
async function readClub(reader: FirestoreReader, firebaseClubId: string, now: Date): Promise<LegacyClub | null> {
  const base = `club/${encodeURIComponent(firebaseClubId)}`;
  const club = await reader.document(base);
  if (!club) return null;

  const events: LegacyEvent[] = [];
  const responses: LegacyResponse[] = [];
  const answers = async (path: string, eventExternalId: string, shiftExternalId: string | null = null) => {
    for (const attendee of await reader.collection(path)) {
      const response = mapResponse(attendee, eventExternalId, shiftExternalId);
      if (response) responses.push(response);
    }
  };

  // Mitglieder: das Vereinsdokument nennt Namen und Rollen, das Profil die Adresse.
  const memberDocs = await reader.collection(`${base}/members`);
  const members = await mapLimit(memberDocs, 10, async (member) =>
    mapMember(member, await reader.document(`userProfile/${encodeURIComponent(member.id)}`)));

  // Anlässe.
  for (const doc of (await reader.collection(`${base}/events`)).filter((doc) => isCurrent(doc, now))) {
    const mapped = mapEvent(doc, 'event');
    if (!mapped) continue;
    events.push(mapped);
    await answers(`${base}/events/${encodeURIComponent(doc.id)}/attendees`, mapped.external_id);
  }

  // Helfer-Events mit Schichten; die Einträge hängen an der Schicht.
  for (const doc of (await reader.collection(`${base}/helferEvents`)).filter((doc) => isCurrent(doc, now))) {
    const helperPath = `${base}/helferEvents/${encodeURIComponent(doc.id)}`;
    const shifts: LegacyDoc[] = await reader.collection(`${helperPath}/schichten`);
    const mapped = mapEvent(doc, 'helper', shifts);
    if (!mapped) continue;
    events.push(mapped);
    await answers(`${helperPath}/attendees`, mapped.external_id);
    await mapLimit(shifts, 10, (shift) =>
      answers(`${helperPath}/schichten/${encodeURIComponent(shift.id)}/attendees`, mapped.external_id, shift.id));
  }

  // Teams: Trainings und die Antworten auf Spiele.
  let games = 0;
  const teams: LegacyTeam[] = [];
  for (const entry of await reader.collection(`${base}/teams`)) {
    const teamPath = `teams/${encodeURIComponent(entry.id)}`;
    const teamDoc = await reader.document(teamPath);
    if (!teamDoc) continue;
    const team = mapTeam(teamDoc, await reader.collection(`${teamPath}/members`));
    if (!team) continue;
    teams.push(team);

    const trainings = (await reader.collection(`${teamPath}/trainings`)).filter((doc) => isCurrentTraining(doc, now));
    for (const doc of trainings) {
      const mapped = mapTraining(doc, team.legacy_team_id);
      if (!mapped) continue;
      events.push(mapped);
    }
    await mapLimit(trainings, 10, (doc) =>
      answers(`${teamPath}/trainings/${encodeURIComponent(doc.id)}/attendees`, `legacy:training:${doc.id}`));

    const gameDocs = (await reader.collection(`${teamPath}/games`)).filter((doc) => isCurrentGame(doc, now));
    games += gameDocs.length;
    await mapLimit(gameDocs, 10, async (doc) => {
      const external = gameExternalId(doc);
      if (external) await answers(`${teamPath}/games/${encodeURIComponent(doc.id)}/attendees`, external);
    });
  }

  const name = typeof club.name === 'string' && club.name.trim() ? club.name.trim() : null;
  return { name, members, teams, events, games, responses };
}

// ---------------------------------------------------------------------------
// Die Übernahme.
// ---------------------------------------------------------------------------

interface Source {
  club_id: string;
  firebase_club_id: string;
}

interface SyncResult {
  club: string;
  ok: boolean;
  members?: number;
  teams?: number;
  events?: number;
  helpers?: number;
  trainings?: number;
  shifts?: number;
  responses?: number;
  unmatched?: number;
  error?: string;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

/**
 * Ein Verein, ein Lauf – in der Reihenfolge der Abhängigkeiten: erst die
 * Personen, dann die Teams (mit Zugehörigkeit), dann die Termine, zuletzt
 * die Antworten, die alles drei brauchen.
 */
async function syncOne(admin: SupabaseClient, reader: FirestoreReader, source: Source): Promise<SyncResult> {
  const fail = async (error: string): Promise<SyncResult> => {
    await admin.rpc('report_legacy_sync', { p_club_id: source.club_id, p_ok: false, p_error: error });
    return { club: source.club_id, ok: false, error };
  };

  let club: LegacyClub | null;
  try {
    club = await readClub(reader, source.firebase_club_id, new Date());
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : String(cause));
  }
  if (!club) return fail('Die bisherige App kennt diese Vereinskennung nicht');

  // Mitglieder (BR-192), in Listen zu 200.
  let members = 0;
  for (const batch of chunks(club.members, 200)) {
    const { data, error } = await admin.rpc('upsert_legacy_members', { p_club_id: source.club_id, p_rows: batch });
    if (error) return fail(error.message);
    members += Number(data ?? 0);
  }

  // Teams und Zugehörigkeit (BR-194).
  const teamIds = new Map<string, string>();
  for (const team of club.teams) {
    const { data, error } = await admin.rpc('upsert_legacy_team', {
      p_club_id: source.club_id,
      p_legacy_team_id: team.legacy_team_id,
      p_name: team.name,
      p_federation_team_id: team.federation_team_id,
    });
    if (error) return fail(error.message);
    if (typeof data !== 'string') continue;
    teamIds.set(team.legacy_team_id, data);
    if (team.member_ids.length > 0) {
      const { error: membersError } = await admin.rpc('add_legacy_team_members', {
        p_team_id: data,
        p_legacy_user_ids: team.member_ids,
      });
      if (membersError) return fail(membersError.message);
    }
  }

  // Termine.
  let events = 0;
  let helpers = 0;
  let trainings = 0;
  let shifts = 0;
  for (const event of club.events) {
    const teamId = event.team_legacy_id ? teamIds.get(event.team_legacy_id) ?? null : null;
    // Ein Training ohne Team hier wäre ein Vereinstermin für alle – das ist es nicht.
    if (event.type === 'training' && !teamId) continue;
    const { error } = await admin.rpc('upsert_legacy_event', {
      p_club_id: source.club_id,
      p_external_id: event.external_id,
      p_type: event.type,
      p_title: event.title,
      p_why: event.why,
      p_starts_at: event.starts_at,
      p_ends_at: event.ends_at,
      p_location: event.location,
      p_capacity_needed: event.capacity_needed,
      p_cancelled: event.cancelled,
      p_cancelled_reason: event.cancelled_reason,
      p_shifts: event.shifts,
      p_team_id: teamId,
    });
    if (error) return fail(error.message);
    if (event.type === 'helper') helpers += 1;
    else if (event.type === 'training') trainings += 1;
    else events += 1;
    shifts += event.shifts.length;
  }

  // Antworten (BR-193), in Listen zu 500.
  let responses = 0;
  let unmatched = 0;
  for (const batch of chunks(club.responses, 500)) {
    const { data, error } = await admin.rpc('upsert_legacy_attendance', { p_club_id: source.club_id, p_rows: batch });
    if (error) return fail(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as { matched?: number; unmatched?: number } | null;
    responses += Number(row?.matched ?? 0);
    unmatched += Number(row?.unmatched ?? 0);
  }

  await admin.rpc('report_legacy_sync', {
    p_club_id: source.club_id,
    p_ok: true,
    p_count: events + helpers + trainings,
    p_members: members,
    p_responses: responses,
  });
  return {
    club: source.club_id, ok: true,
    members, teams: teamIds.size, events, helpers, trainings, shifts, responses, unmatched,
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
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let body: { mode?: string; clubId?: string; firebaseClubId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Ungültige Anfrage' }, 400);
  }

  /**
   * Erst die Berechtigung, dann das Token: Ein abgewiesener Aufruf soll kein
   * Google-Token kosten. Ohne Service-Konto gibt es nichts zu lesen – das ist
   * ein Betriebsfehler, kein Fehler des Vorstands, und steht als 500 im
   * Protokoll.
   */
  const openReader = async (): Promise<FirestoreReader | Response> => {
    try {
      return await FirestoreReader.open(serviceAccount());
    } catch (cause) {
      return json({ error: cause instanceof Error ? cause.message : String(cause) }, 500);
    }
  };

  // --- Nächtlicher Lauf ---------------------------------------------------
  if (body.mode === 'all') {
    if (tokenRole(authorization) !== 'service_role') {
      return json({ error: 'Nur der Zeitplan darf alle Quellen abgleichen' }, 403);
    }
    const { data, error } = await admin.from('legacy_sources').select('club_id, firebase_club_id');
    if (error) return json({ error: error.message }, 500);
    const reader = await openReader();
    if (reader instanceof Response) return reader;

    const results: SyncResult[] = [];
    for (const source of (data ?? []) as Source[]) {
      results.push(await syncOne(admin, reader, source));
    }
    return json({ synced: results.length, results });
  }

  // --- Die Aufrufe des Vorstands ------------------------------------------
  const clubId = body.clubId?.trim();
  if (!clubId) return json({ error: 'clubId ist nötig' }, 400);
  if (!authorization) return json({ error: 'Nicht angemeldet' }, 401);

  // Die Berechtigung prüft die Datenbank: `is_club_admin` ist dieselbe
  // Funktion, die auch in den Policies steht.
  const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: isAdmin, error: adminError } = await caller.rpc('is_club_admin', { p_club_id: clubId });
  if (adminError) return json({ error: adminError.message }, 400);
  if (isAdmin !== true) {
    return json({ error: 'Nur der Vorstand verbindet die bisherige App' }, 403);
  }
  const reader = await openReader();
  if (reader instanceof Response) return reader;

  // --- Schritte 6 und A3: jetzt übernehmen ---------------------------------
  if (body.mode === 'sync') {
    const { data, error } = await admin
      .from('legacy_sources')
      .select('club_id, firebase_club_id')
      .eq('club_id', clubId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ ok: false, error: 'Die bisherige App ist nicht verbunden' });
    return json(await syncOne(admin, reader, data as Source));
  }

  // --- Schritt 4: der Testaufruf – nichts wird gespeichert -----------------
  const firebaseClubId = body.firebaseClubId?.trim();
  if (!firebaseClubId) return json({ error: 'firebaseClubId ist nötig' }, 400);

  try {
    const club = await readClub(reader, firebaseClubId, new Date());
    if (!club) {
      return json({ ok: false, error: 'Die bisherige App kennt diese Vereinskennung nicht' });
    }
    const helpers = club.events.filter((event) => event.type === 'helper');
    const trainings = club.events.filter((event) => event.type === 'training');
    return json({
      ok: true,
      name: club.name,
      members: club.members.length,
      teams: club.teams.length,
      events: club.events.length - helpers.length - trainings.length,
      helpers: helpers.length,
      shifts: helpers.reduce((sum, event) => sum + event.shifts.length, 0),
      trainings: trainings.length,
      games: club.games,
      responses: club.responses.length,
    });
  } catch (cause) {
    return json({ ok: false, error: cause instanceof Error ? cause.message : String(cause) });
  }
});

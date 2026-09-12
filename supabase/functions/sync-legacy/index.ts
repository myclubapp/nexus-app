/**
 * Termine aus der bisherigen myclub-App übernehmen (UC-040).
 *
 * Gegenstück zur Ionic-Angular-App (github.com/myclubapp/app): Sie hält je
 * Verein `club/<id>/events` (Anlässe) und `club/<id>/helferEvents` mit der
 * Untersammlung `schichten`. Dieser Dienst liest beides und schreibt es als
 * Termine nach Postgres – Anlässe als `social`, Helfer-Events als `helper`
 * mit ihren Schichten.
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
import { isCurrent, mapEvent, type LegacyDoc, type LegacyEvent } from './mapping.ts';

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
  events: LegacyEvent[];
}

/**
 * Der Verein in der alten App: sein Name und seine **aktuellen** Termine.
 *
 * Vergangenes bleibt dort, wo es war – die Punkte dafür sind in der alten
 * App gebucht, und eine Agenda voller alter Einsätze hilft niemandem.
 */
async function readClub(reader: FirestoreReader, firebaseClubId: string, now: Date): Promise<LegacyClub | null> {
  const club = await reader.document(`club/${encodeURIComponent(firebaseClubId)}`);
  if (!club) return null;

  const events: LegacyEvent[] = [];
  const base = `club/${encodeURIComponent(firebaseClubId)}`;

  for (const doc of await reader.collection(`${base}/events`)) {
    if (!isCurrent(doc, now)) continue;
    const mapped = mapEvent(doc, 'event');
    if (mapped) events.push(mapped);
  }

  for (const doc of await reader.collection(`${base}/helferEvents`)) {
    if (!isCurrent(doc, now)) continue;
    const shifts: LegacyDoc[] = await reader.collection(`${base}/helferEvents/${encodeURIComponent(doc.id)}/schichten`);
    const mapped = mapEvent(doc, 'helper', shifts);
    if (mapped) events.push(mapped);
  }

  const name = typeof club.name === 'string' && club.name.trim() ? club.name.trim() : null;
  return { name, events };
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
  events?: number;
  helpers?: number;
  shifts?: number;
  error?: string;
}

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

  let events = 0;
  let helpers = 0;
  let shifts = 0;
  for (const event of club.events) {
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
    });
    if (error) return fail(error.message);
    if (event.type === 'helper') helpers += 1;
    else events += 1;
    shifts += event.shifts.length;
  }

  await admin.rpc('report_legacy_sync', {
    p_club_id: source.club_id,
    p_ok: true,
    p_count: events + helpers,
  });
  return { club: source.club_id, ok: true, events, helpers, shifts };
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
    return json({
      ok: true,
      name: club.name,
      events: club.events.length - helpers.length,
      helpers: helpers.length,
      shifts: helpers.reduce((sum, event) => sum + event.shifts.length, 0),
    });
  } catch (cause) {
    return json({ ok: false, error: cause instanceof Error ? cause.message : String(cause) });
  }
});

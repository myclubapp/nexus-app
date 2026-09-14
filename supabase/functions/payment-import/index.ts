/**
 * Zahlungseingänge aus der Bankdatei verbuchen (UC-047, FR-175).
 *
 * Sandros Vorgabe vom 14.09.2026: **Die Prüfung der camt-Datei geschieht im
 * Backend**, über einen gesicherten Aufruf – und gesichert heisst hier: Nur
 * der Vorstand, und nur für den eigenen Verein.
 *
 * Drei Stufen, jede mit ihrer eigenen Aufgabe:
 *   1. diese Function prüft mit dem **Token der aufrufenden Person**, ob sie
 *      Vorstand dieses Vereins ist (`is_club_admin`, dieselbe Funktion wie in
 *      den Policies);
 *   2. `camt.ts` liest die Datei – rein, ohne Datenbank, geprüft in
 *      `camt_test.ts`;
 *   3. `match_camt_payments()` ordnet zu und bucht, eingegrenzt auf die
 *      Rechnungen **dieses** Vereins. Dort entstehen auch die Punkte der
 *      Säule 6 (BR-157) – über `report_invoice()`, das dedupliziert.
 *
 * In der alten App lief das im Browser: Der Client las die Datei, suchte die
 * Rechnung und schrieb `status = 'bezahlt'`. Wer die Anfrage nachbaute,
 * konnte jede Rechnung als bezahlt melden.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { extractPayments } from './camt.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** 10 MiB: Ein Jahresauszug eines Vereins liegt weit darunter. */
const MAX_XML_BYTES = 10 * 1024 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Nur POST' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Nicht angemeldet' }, 401);

  let body: { clubId?: string; filename?: string; xml?: string; dryRun?: boolean };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Ungültige Anfrage' }, 400);
  }

  const clubId = body.clubId?.trim();
  const xml = body.xml ?? '';
  if (!clubId) return json({ error: 'clubId ist nötig' }, 400);
  if (!xml.trim()) return json({ error: 'Die Datei ist leer' }, 400);
  if (new Blob([xml]).size > MAX_XML_BYTES) {
    return json({ error: 'Die Datei ist zu gross' }, 413);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  // Schritt 1: Wer ruft, und darf diese Person es für **diesen** Verein?
  // Geprüft mit ihrem Token – der Dienstschlüssel käme später und dürfte hier
  // nichts entscheiden (BR-229, NFR-011).
  const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data: user, error: userError } = await caller.auth.getUser();
  if (userError || !user?.user) return json({ error: 'Nicht angemeldet' }, 401);

  const { data: isAdmin, error: adminError } = await caller.rpc('is_club_admin', {
    p_club_id: clubId,
  });
  if (adminError) return json({ error: adminError.message }, 400);
  if (isAdmin !== true) {
    return json({ error: 'Nur der Vorstand verbucht Zahlungen' }, 403);
  }

  // Schritt 2: die Datei lesen. Ein Lesefehler ist eine Antwort, kein Absturz –
  // eine Bank liefert auch einmal etwas, das kein camt ist.
  let payments;
  try {
    payments = extractPayments(xml);
  } catch (cause) {
    console.error('camt nicht lesbar', cause);
    return json({ error: 'unreadable' }, 400);
  }

  if (payments.length === 0) {
    return json({ found: 0, matched: 0, already: 0, points: 0, unmatched: [] });
  }

  // Ein Probelauf zeigt, was die Datei enthält, **ohne** zu buchen. Er ist der
  // Schritt zwischen «Datei gewählt» und «verbuchen» in der Ansicht.
  if (body.dryRun === true) {
    return json({ found: payments.length, preview: payments.slice(0, 50), dryRun: true });
  }

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // Wer den Lauf ausgelöst hat – für den Ausweis in `invoice_payment_imports`.
  const { data: member } = await admin
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', user.user.id)
    .maybeSingle();

  // Schritt 3: zuordnen und buchen – in der Datenbank, eingegrenzt auf diesen
  // Verein.
  const { data, error } = await admin.rpc('match_camt_payments', {
    p_club_id: clubId,
    p_payments: payments,
    p_filename: body.filename ?? null,
    p_actor: member?.id ?? null,
  });
  if (error) return json({ error: error.message }, 500);

  return json(data);
});

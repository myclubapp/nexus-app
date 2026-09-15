/**
 * Meldungen als Push zustellen (UC-052, FR-199 – und damit FR-079).
 *
 * Gegenstück zu `send-mail`, und absichtlich bis in die Betriebsarten
 * dieselbe Form: Die Zeile in `notifications` trägt den Vermerk, der Abholer
 * `pending_push()` reicht sie je Gerät heraus, diese Function stellt zu und
 * quittiert an der Zeile.
 *
 * **Zwei Kanäle, ein Lauf.** Web Push (`_shared/webpush.ts`) bedient die PWA
 * und jeden Browser, APNs (`_shared/apns.ts`) die iOS-App. `android_ntfy`
 * steht in `push_tokens` seit `0004` und wird hier **nicht** bedient – dafür
 * fehlt der betriebene ntfy-Dienst. Das ist kein Versäumnis, sondern der
 * Grund für den Plattform-Filter: Der Abholer gibt nur heraus, was dieser Lauf
 * auch zustellen kann, und eine Meldung an ein Android-Gerät wartet, statt
 * ihre fünf Versuche zu verbrennen.
 *
 * **Zugestellt heisst: auf mindestens einem Gerät angekommen.** Wer das
 * Telefon in der Tasche und ein totes Tablet im Schrank hat, bekommt seine
 * Meldung – und die Zeile des Tablets wird gelöscht, nicht die Meldung
 * wiederholt.
 *
 * Zwei Betriebsarten, beide nur für `service_role`:
 *   { mode: 'run' }            – der Lauf jede Minute (`0104`, Cron `push-send`).
 *   { mode: 'test', userId }   – eine Probemeldung an alle Geräte einer Person,
 *                                ohne `notifications` anzufassen. Für die
 *                                Inbetriebnahme.
 *
 * Was fehlt, wird gesagt: Ohne einen einzigen eingerichteten Kanal antwortet
 * die Function mit 503 und einer Zeile, die nennt, welche Variable fehlt.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  readVapidKeys,
  sendWebPush,
  type VapidKeys,
  type WebPushSubscription,
} from '../_shared/webpush.ts';
import { readApnsConfig, sendApns, type ApnsConfig } from '../_shared/apns.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Die Rolle aus dem JWT – ohne Signaturprüfung; die macht das Gateway. */
function tokenRole(authorization: string | null): string | null {
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.role === 'string' ? decoded.role : null;
  } catch {
    return null;
  }
}

interface PendingRow {
  id: string;
  user_id: string;
  token_id: string;
  token: string;
  platform: string;
  environment: 'sandbox' | 'production' | null;
  category: string | null;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
}

interface Delivery {
  /** Die Meldung, die zugestellt werden sollte. */
  notificationId: string;
  ok: boolean;
  reason?: string;
}

/**
 * Was auf dem Gerät ankommt.
 *
 * Für Web Push ist es der ganze Inhalt des Umschlags – der Service Worker
 * liest ihn und zeigt die Meldung. Für APNs baut `sendApns()` daraus die
 * `aps`-Struktur, die Apple erwartet.
 */
function payloadFor(row: PendingRow): string {
  return JSON.stringify({
    title: row.title,
    body: row.body ?? undefined,
    link: row.link ?? undefined,
    category: row.category ?? undefined,
    id: row.id,
  });
}

/**
 * **Keine eigene Dringlichkeit.** Beim Mailkanal entscheidet sie, ob eine
 * Meldung die Bündelung durchbricht (BR-211) – und sie kommt vom Aufrufer als
 * `p_urgent`, nicht von der Kategorie. Ein Push bündelt nie: Was den Filter
 * der Person passiert hat (BR-118) und dessen stille Zeit vorbei ist (A5),
 * soll jetzt ankommen. Eine zweite, hier hartcodierte Liste «dringlicher»
 * Kategorien wäre dieselbe Regel ein zweites Mal – und liefe der ersten davon.
 */

async function deliver(
  row: PendingRow,
  channels: { vapid: VapidKeys | null; apns: ApnsConfig | null },
  onGoneToken: (tokenId: string) => void,
  onEnvironment: (tokenId: string, environment: 'sandbox' | 'production') => void,
): Promise<Delivery> {
  try {
    if (row.platform === 'webpush') {
      if (!channels.vapid) return { notificationId: row.id, ok: false, reason: 'Web Push nicht eingerichtet' };

      const subscription = JSON.parse(row.token) as WebPushSubscription;
      const result = await sendWebPush(subscription, payloadFor(row), channels.vapid);
      if (result.gone) onGoneToken(row.token_id);
      return { notificationId: row.id, ok: result.ok, reason: result.reason };
    }

    if (row.platform === 'ios_apns') {
      if (!channels.apns) return { notificationId: row.id, ok: false, reason: 'APNs nicht eingerichtet' };

      const result = await sendApns(
        row.token,
        row.environment,
        {
          title: row.title,
          body: row.body,
          link: row.link,
          category: row.category,
        },
        channels.apns,
      );
      if (result.gone) onGoneToken(row.token_id);
      if (result.learnedEnvironment) onEnvironment(row.token_id, result.learnedEnvironment);
      return { notificationId: row.id, ok: result.ok, reason: result.reason };
    }

    return { notificationId: row.id, ok: false, reason: `Kanal ${row.platform} wird nicht bedient` };
  } catch (cause) {
    // Ein unbrauchbares Token (kaputtes JSON, falsche Länge) darf den ganzen
    // Lauf nicht anhalten – es ist eine Zeile von vielen.
    return {
      notificationId: row.id,
      ok: false,
      reason: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

/** Zehn gleichzeitig: schnell genug für einen Lauf, sanft genug für den Dienst. */
async function inBatches<T, R>(
  items: T[],
  size: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  }
  return results;
}

Deno.serve(async (request) => {
  if (tokenRole(request.headers.get('Authorization')) !== 'service_role') {
    return json({ error: 'Nur der Dienst darf den Versand anstossen' }, 401);
  }

  const vapidOrError = readVapidKeys();
  const apnsOrError = readApnsConfig();
  const vapid = typeof vapidOrError === 'string' ? null : vapidOrError;
  const apns = typeof apnsOrError === 'string' ? null : apnsOrError;

  if (!vapid && !apns) {
    return json(
      {
        error: 'Kein Push-Kanal eingerichtet',
        webpush: vapidOrError,
        apns: apnsOrError,
      },
      503,
    );
  }

  const platforms = [
    ...(vapid ? ['webpush'] : []),
    ...(apns ? ['ios_apns'] : []),
  ];

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const body = await request.json().catch(() => ({}));
  const mode = body?.mode === 'test' ? 'test' : 'run';

  const goneTokens = new Set<string>();
  const learned = new Map<string, 'sandbox' | 'production'>();
  const channels = { vapid, apns };

  // -------------------------------------------------------------------------
  // Probemeldung: geht an die Geräte einer Person und fasst `notifications`
  // nicht an. Sie beantwortet die einzige Frage der Inbetriebnahme – kommt
  // überhaupt etwas an? – ohne eine echte Meldung dafür zu verbrauchen.
  // -------------------------------------------------------------------------
  if (mode === 'test') {
    const userId = typeof body?.userId === 'string' ? body.userId : null;
    if (!userId) return json({ error: 'userId fehlt' }, 400);

    const { data: tokens, error } = await admin
      .from('push_tokens')
      .select('id, token, platform, environment')
      .eq('user_id', userId)
      .in('platform', platforms);
    if (error) return json({ error: error.message }, 500);

    const rows: PendingRow[] = (tokens ?? []).map((token) => ({
      id: '00000000-0000-0000-0000-000000000000',
      user_id: userId,
      token_id: token.id,
      token: token.token,
      platform: token.platform,
      environment: token.environment,
      category: 'system',
      title: 'nexus: Probemeldung',
      body: 'Wenn du das liest, kommen Push-Meldungen auf diesem Gerät an.',
      link: '/tabs/inbox',
      created_at: new Date().toISOString(),
    }));

    const results = await inBatches(rows, 10, (row) =>
      deliver(row, channels, (id) => goneTokens.add(id), (id, env) => learned.set(id, env)),
    );

    for (const id of goneTokens) await admin.rpc('drop_push_token', { p_token_id: id });
    for (const [id, environment] of learned) {
      await admin.rpc('set_push_environment', { p_token_id: id, p_environment: environment });
    }

    return json({
      mode,
      devices: rows.length,
      delivered: results.filter((result) => result.ok).length,
      failures: results.filter((result) => !result.ok).map((result) => result.reason),
    });
  }

  // -------------------------------------------------------------------------
  // Der Lauf.
  // -------------------------------------------------------------------------
  const { data, error } = await admin.rpc('pending_push', {
    p_limit: 200,
    p_platforms: platforms,
  });
  if (error) return json({ error: error.message }, 500);

  const rows = (data ?? []) as PendingRow[];
  if (rows.length === 0) return json({ mode, pending: 0, delivered: 0 });

  const results = await inBatches(rows, 10, (row) =>
    deliver(row, channels, (id) => goneTokens.add(id), (id, env) => learned.set(id, env)),
  );

  // Eine Meldung gilt als zugestellt, sobald **ein** Gerät sie hat. Die
  // übrigen Fehlschläge stehen im Protokoll, nicht an der Zeile – sonst trüge
  // eine angekommene Meldung einen Fehler.
  const delivered = new Set<string>();
  const failures = new Map<string, string>();
  for (const result of results) {
    if (result.ok) delivered.add(result.notificationId);
    else if (!failures.has(result.notificationId)) {
      failures.set(result.notificationId, result.reason ?? 'Unbekannter Fehler');
    }
  }

  const failed = [...failures.keys()].filter((id) => !delivered.has(id));

  if (delivered.size > 0) {
    await admin.rpc('mark_push_sent', { p_ids: [...delivered] });
  }
  // Nach Grund gebündelt statt je Zeile: Fällt ein Push-Dienst aus, tragen
  // hundert Meldungen denselben Grund – und das wären hundert Aufrufe.
  const byReason = new Map<string, string[]>();
  for (const id of failed) {
    const reason = failures.get(id) ?? 'Unbekannter Fehler';
    byReason.set(reason, [...(byReason.get(reason) ?? []), id]);
  }
  for (const [reason, ids] of byReason) {
    await admin.rpc('mark_push_failed', { p_ids: ids, p_error: reason });
  }
  for (const id of goneTokens) {
    await admin.rpc('drop_push_token', { p_token_id: id });
  }
  for (const [id, environment] of learned) {
    await admin.rpc('set_push_environment', { p_token_id: id, p_environment: environment });
  }

  return json({
    mode,
    pending: rows.length,
    delivered: delivered.size,
    failed: failed.length,
    forgottenDevices: goneTokens.size,
  });
});

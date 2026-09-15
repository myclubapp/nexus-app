/**
 * Meldungen per E-Mail verschicken (UC-044).
 *
 * Gegenstück zu `utils/email.ts` im alten Backend (github.com/myclubapp/backend),
 * das Mails in eine Firestore-Collection legte und der Firebase-Extension
 * überliess. Hier gibt es keine Zwischenablage: Die Zeile in `notifications`
 * trägt den Vermerk, der Abholer `pending_mail()` reicht sie her, und diese
 * Function verschickt sie über den Vereins-SMTP (Infomaniak, TLS auf 465;
 * STARTTLS auf 587 scheiterte in der Edge-Laufzeit) und quittiert an der Zeile.
 *
 * Seit UC-048 steht das Blatt in `_shared/mail.ts` und gilt für jede Mail des
 * Vereins; eine Zeile mit eigenem Blatt (`mail_template`) bekommt statt der
 * Meldungsliste ihr eigenes Schreiben – heute die Willkommensmail.
 *
 * Zwei Betriebsarten, beide nur für `service_role`:
 *   { mode: 'run' }          – der Lauf alle fünf Minuten (`0084`, Cron `mail-send`).
 *   { mode: 'test', to }     – eine Probemail an eine Adresse, ohne die
 *                              Datenbank anzufassen. Für die Inbetriebnahme.
 *
 * Was fehlt, wird gesagt: Ohne SMTP-Zugang antwortet die Function mit 503
 * und einer Zeile, die nennt, welche Variable fehlt – ein Lauf, der still
 * nichts tut, wäre nach zwei Wochen unbemerkt.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { renderMail, singleClub, type MailGroup, type MailItem } from './template.ts';
import { catchSmtpRejections, fromHeader, openClient, readSmtpConfig } from '../_shared/smtp.ts';
import { LOCALES, type Locale } from '../_shared/mail.ts';

catchSmtpRejections();

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

/**
 * Die Zeilen des Abholers, nach Konto gebündelt.
 *
 * Eine Zeile mit eigenem Blatt (`mail_template`, z.B. die Willkommensmail aus
 * UC-048) bündelt nie mit: Sie ist kein Eintrag in einer Liste, sondern ein
 * eigenes Schreiben. Sie bekommt deshalb ihre eigene Gruppe, auch wenn im
 * selben Lauf weitere Meldungen für dieselbe Person fällig sind.
 */
function groupRows(rows: PendingRow[]): MailGroup[] {
  const groups = new Map<string, MailGroup>();
  for (const row of rows) {
    const locale = LOCALES.includes(row.locale as Locale) ? (row.locale as Locale) : 'de';
    const item: MailItem = {
      id: row.id,
      category: row.category,
      title: row.title,
      body: row.body,
      link: row.link,
      createdAt: row.created_at,
      why: row.why,
      template: row.mail_template,
      clubName: row.club_name,
      clubColor: row.club_color,
      clubLogo: row.club_logo,
      clubWhy: row.club_why,
    };
    const key = row.mail_template ? `${row.user_id}:${row.id}` : row.user_id;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, {
        email: row.email,
        locale,
        displayName: row.display_name,
        mode: (row.email_mode as MailGroup['mode']) ?? 'daily',
        items: [item],
      });
    }
  }
  return [...groups.values()];
}

interface PendingRow {
  id: string;
  user_id: string;
  email: string;
  locale: string | null;
  email_mode: string | null;
  display_name: string | null;
  club_id: string | null;
  club_name: string | null;
  club_color: string | null;
  club_logo: string | null;
  club_why: string | null;
  category: string;
  title: string;
  body: string | null;
  link: string | null;
  why: string | null;
  mail_template: string | null;
  created_at: string;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Nur POST' }, 405);

  if (tokenRole(request.headers.get('Authorization')) !== 'service_role') {
    return json({ error: 'Nur der Versanddienst ruft diese Function' }, 403);
  }

  let payload: { mode?: string; to?: string } = {};
  try {
    payload = await request.json();
  } catch {
    // Ohne Rumpf gilt der Lauf.
  }
  const mode = payload.mode ?? 'run';

  const config = readSmtpConfig();
  if (typeof config === 'string') return json({ error: config }, 503);

  const appUrl = Deno.env.get('APP_URL') ?? null;
  // Die Website, auf der die Einzelheiten stehen (FR-184). Fehlt sie, lässt
  // die Willkommensmail den Verweis weg statt ins Leere zu zeigen.
  const helpUrl = Deno.env.get('MAIL_HELP_URL') ?? null;

  if (mode === 'test') {
    const to = payload.to?.trim();
    if (!to) return json({ error: 'Probemail braucht eine Adresse (to)' }, 400);
    const now = new Date().toISOString();
    const group: MailGroup = {
      email: to,
      locale: 'de',
      displayName: null,
      mode: 'immediate',
      items: [
        {
          id: 'test',
          category: 'system',
          title: 'Probemail aus myclub nexus',
          body: 'Wenn du das liest, ist der Versand eingerichtet.',
          link: '/tabs/profile/notifications',
          createdAt: now,
          why: 'Damit du siehst, wie eine Mail aus myclub aussieht.',
          template: null,
          clubName: null,
          clubColor: null,
          clubLogo: null,
          clubWhy: null,
        },
      ],
    };
    const mail = renderMail(group, { appUrl, helpUrl });
    const client = openClient(config);
    try {
      await client.send({
        from: fromHeader(config, null),
        to,
        subject: mail.subject,
        content: mail.text,
        html: mail.html,
      });
      return json({ sent: 1, to });
    } catch (cause) {
      return json({ error: cause instanceof Error ? cause.message : String(cause) }, 502);
    } finally {
      try { await client.close(); } catch { /* Verbindung schon zu */ }
    }
  }

  if (mode !== 'run') return json({ error: `Unbekannte Betriebsart: ${mode}` }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: rows, error } = await supabase.rpc('pending_mail', { p_user_limit: 50 });
  if (error) return json({ error: error.message }, 500);

  const groups = groupRows((rows ?? []) as PendingRow[]);
  if (groups.length === 0) return json({ sent: 0, failed: 0, groups: 0 });

  const client = openClient(config);
  let sent = 0;
  let failed = 0;
  const failures: string[] = [];

  try {
    for (const group of groups) {
      const ids = group.items.map((item) => item.id);
      const mail = renderMail(group, { appUrl, helpUrl });
      try {
        await client.send({
          // Der Verein steht im Absender – aber nur, wenn alle Zeilen aus
          // demselben stammen. Sonst wäre er für die Hälfte falsch.
          from: fromHeader(config, singleClub(group.items)),
          to: group.email,
          subject: mail.subject,
          content: mail.text,
          html: mail.html,
        });
        await supabase.rpc('mark_mail_sent', { p_ids: ids });
        sent += ids.length;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        await supabase.rpc('mark_mail_failed', { p_ids: ids, p_error: message });
        failed += ids.length;
        failures.push(message);
      }
    }
  } finally {
    try { await client.close(); } catch { /* Verbindung schon zu */ }
  }

  return json({ sent, failed, groups: groups.length, failures: failures.slice(0, 5) });
});

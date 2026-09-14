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
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { renderMail, type Locale, type MailGroup, type MailItem } from './template.ts';

const LOCALES: readonly Locale[] = ['de', 'fr', 'it', 'en'];

/**
 * denomailer liest die Antworten des Servers in einer eigenen Schleife. Weist
 * der Server ein Kommando ab, wirft die Schleife ausserhalb jedes `await` –
 * eine unbehandelte Ablehnung, die den ganzen Isolate beendet, und der
 * Aufrufer sieht nur ein leeres 503. Hier wird sie abgefangen und geloggt;
 * der Fehler erreicht den Aufrufer über das gescheiterte `send()`.
 */
globalThis.addEventListener('unhandledrejection', (event) => {
  console.error('SMTP: unbehandelte Ablehnung', event.reason);
  event.preventDefault();
});

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

interface SmtpConfig {
  hostname: string;
  port: number;
  username: string;
  password: string;
  from: string;
  fromName: string;
}

/** Liest den Zugang aus den Secrets; nennt die erste fehlende Variable. */
function readSmtpConfig(): SmtpConfig | string {
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM'] as const;
  for (const name of required) {
    if (!Deno.env.get(name)) return `Secret ${name} fehlt`;
  }
  const port = Number(Deno.env.get('SMTP_PORT') ?? '587');
  if (!Number.isInteger(port) || port <= 0) return 'Secret SMTP_PORT ist keine Portnummer';
  return {
    hostname: Deno.env.get('SMTP_HOST')!,
    port,
    username: Deno.env.get('SMTP_USER')!,
    password: Deno.env.get('SMTP_PASSWORD')!,
    from: Deno.env.get('MAIL_FROM')!,
    fromName: Deno.env.get('MAIL_FROM_NAME') ?? 'myclub',
  };
}

function openClient(config: SmtpConfig): SMTPClient {
  return new SMTPClient({
    connection: {
      hostname: config.hostname,
      port: config.port,
      // 465 spricht TLS von Anfang an; 587 beginnt im Klartext und wechselt
      // per STARTTLS – denomailer tut das von selbst, wenn `tls` falsch ist.
      tls: config.port === 465,
      auth: { username: config.username, password: config.password },
    },
  });
}

/** Die Zeilen des Abholers, nach Konto gebündelt. */
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
      clubName: row.club_name,
      clubColor: row.club_color,
    };
    const existing = groups.get(row.user_id);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(row.user_id, {
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
  category: string;
  title: string;
  body: string | null;
  link: string | null;
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
          clubName: null,
          clubColor: null,
        },
      ],
    };
    const mail = renderMail(group, { appUrl });
    const client = openClient(config);
    try {
      await client.send({
        from: `${config.fromName} <${config.from}>`,
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
      const mail = renderMail(group, { appUrl });
      try {
        await client.send({
          from: `${config.fromName} <${config.from}>`,
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

/**
 * Der Rechnungslauf (UC-046, Schritte 8 bis 11).
 *
 * Gegenstück zu `changeInvoice.ts` im alten Backend
 * (github.com/myclubapp/backend): dieselbe Bibliothek (`swissqrbill` auf
 * `pdfkit`), dieselbe Anordnung auf dem Blatt – nur läuft der Lauf hier nicht
 * an einem Firestore-Trigger, sondern auf Aufruf, und quittiert in Postgres.
 *
 * Warum serverseitig: Das PDF trägt die Gläubigerangaben und die Adresse der
 * Person, der Versand braucht den SMTP-Zugang des Vereins, und der Stand einer
 * Rechnung ist nichts, was ein Client setzen darf (BR-220).
 *
 * **Die Berechtigung prüft die Datenbank, nicht diese Function:**
 * `is_club_admin()` ist dieselbe Funktion, die auch in den Policies steht –
 * aufgerufen mit dem Token der Person, die den Lauf auslöst (BR-229).
 *
 * Eine Betriebsart:
 *   { periodId, invoiceId? } – alle Entwürfe der Periode versenden, oder
 *                              genau einen.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { invoiceMail, type Locale } from './mail.ts';
import {
  buildPdf,
  loadLogo,
  missingAddressFields,
  type Payload,
} from './pdf.ts';

/** Der QR-Einzahlungsschein kennt nur diese beiden Währungen (SIX). */
const QR_CURRENCIES = ['CHF', 'EUR'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// denomailer wirft die Antwort eines abweisenden Servers ausserhalb jedes
// `await` – ohne diesen Fänger endet der Isolate und der Aufrufer sieht ein
// leeres 503 (dieselbe Stelle wie in `send-mail`).
globalThis.addEventListener('unhandledrejection', (event) => {
  console.error('SMTP: unbehandelte Ablehnung', event.reason);
  event.preventDefault();
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
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

/**
 * Fehlt etwas an der Adresse (BR-223)?
 *
 * Der Versand geht trotzdem hinaus – die Rechnung ist geschuldet, auch wenn
 * die Adresse lückenhaft ist. Sie trägt dann den Hinweis, das Profil zu
 * ergänzen, und die Kassier:in erfährt es nach dem Lauf.
 */
function base64(bytes: Uint8Array): string {
  let binary = '';
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Nur POST' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Nicht angemeldet' }, 401);

  let body: { periodId?: string; invoiceId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Ungültige Anfrage' }, 400);
  }

  const periodId = body.periodId?.trim();
  if (!periodId) return json({ error: 'periodId ist nötig' }, 400);

  // Erst wer, dann was: Ohne angemeldete Person wird gar nichts nachgeschlagen.
  // Sonst verriete schon die Antwort auf eine geratene Kennung, ob es diese
  // Periode gibt – und dafür reichte der öffentliche Schlüssel der App.
  const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: user, error: userError } = await caller.auth.getUser();
  if (userError || !user?.user) return json({ error: 'Nicht angemeldet' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: period, error: periodError } = await admin
    .from('invoice_periods')
    .select('id, club_id, currency')
    .eq('id', periodId)
    .maybeSingle();
  if (periodError) return json({ error: periodError.message }, 500);
  if (!period) return json({ error: 'Unbekannte Abrechnungsperiode' }, 404);

  // BR-229: Vorstand **dieses** Vereins – geprüft mit dem Token der Person,
  // nicht mit dem Dienstschlüssel.
  const { data: isAdmin, error: adminError } = await caller.rpc('is_club_admin', {
    p_club_id: period.club_id,
  });
  if (adminError) return json({ error: adminError.message }, 400);
  if (isAdmin !== true) {
    return json({ error: 'Nur der Vorstand stellt Rechnungen' }, 403);
  }

  if (!QR_CURRENCIES.includes(period.currency)) {
    return json(
      { error: `Der QR-Einzahlungsschein kennt nur ${QR_CURRENCIES.join(' und ')}` },
      400,
    );
  }

  // BR-222: Ohne geprüfte Gläubigerangaben verlässt nichts den Verein.
  const { data: ready, error: readyError } = await admin.rpc('creditor_ready', {
    p_club_id: period.club_id,
  });
  if (readyError) return json({ error: readyError.message }, 500);
  if (ready !== true) {
    return json({ error: 'creditor_incomplete' }, 400);
  }

  const smtp = readSmtpConfig();
  if (typeof smtp === 'string') return json({ error: smtp }, 503);

  const { data, error } = await admin.rpc('invoice_payload', {
    p_period_id: periodId,
    p_invoice_id: body.invoiceId ?? null,
  });
  if (error) return json({ error: error.message }, 500);

  const payload = data as Payload;
  if (!payload?.creditor) return json({ error: 'creditor_incomplete' }, 400);
  if (payload.invoices.length === 0) {
    return json({ sent: 0, failed: [], incomplete: [], withoutEmail: [] });
  }

  const logo = await loadLogo(payload.club.logo_url);

  const client = new SMTPClient({
    connection: {
      hostname: smtp.hostname,
      port: smtp.port,
      tls: smtp.port === 465,
      auth: { username: smtp.username, password: smtp.password },
    },
  });

  let sent = 0;
  const failed: { id: string; error: string }[] = [];
  const incomplete: string[] = [];
  const withoutEmail: string[] = [];

  try {
    // Nacheinander: Fünfzig PDFs gleichzeitig zu bauen spart nichts und
    // riskiert das Zeitlimit bei allen gleichzeitig.
    for (const invoice of payload.invoices) {
      const missing = missingAddressFields(invoice);
      if (missing.length > 0) incomplete.push(invoice.id);

      try {
        const pdf = await buildPdf(invoice, payload, logo, missing.length > 0);
        const path = `${payload.club.id}/${invoice.id}.pdf`;

        const upload = await admin.storage
          .from('club-invoices')
          .upload(path, pdf, { contentType: 'application/pdf', upsert: true });
        if (upload.error) throw new Error(upload.error.message);

        // A3: Ohne Adresse geht keine Mail – die Rechnung entsteht trotzdem,
        // und die Kassier:in bekommt sie zum Ausdrucken.
        if (invoice.email) {
          const mail = invoiceMail((invoice.locale as Locale) ?? 'de', {
            clubName: payload.club.name,
            name: invoice.name,
            purpose: payload.period.name,
            amount: `${invoice.currency} ${Number(invoice.amount).toFixed(2)}`,
            dueDate: invoice.due_date,
            incompleteAddress: missing.length > 0,
          });
          await client.send({
            from: `${smtp.fromName} <${smtp.from}>`,
            to: invoice.email,
            subject: mail.subject,
            content: mail.text,
            html: mail.html,
            attachments: [
              {
                filename: `${payload.period.name}-${invoice.reference}.pdf`
                  .replace(/[^\w.\-]+/g, '-'),
                contentType: 'application/pdf',
                encoding: 'base64',
                content: base64(pdf),
              },
            ],
          });
        } else {
          withoutEmail.push(invoice.id);
        }

        // Erst quittieren, wenn PDF und Zustellung durch sind: Ein Abbruch
        // lässt den Entwurf einen Entwurf, und der nächste Lauf holt ihn.
        const { error: markError } = await admin.rpc('mark_invoice_sent', {
          p_invoice_id: invoice.id,
          p_pdf_path: path,
        });
        if (markError) throw new Error(markError.message);
        sent += 1;
      } catch (cause) {
        console.error('Rechnung nicht versendet', invoice.id, cause);
        failed.push({ id: invoice.id, error: (cause as Error).message });
      }
    }
  } finally {
    try {
      await client.close();
    } catch (cause) {
      console.error('SMTP-Verbindung liess sich nicht schliessen', cause);
    }
  }

  return json({ sent, failed, incomplete, withoutEmail });
});

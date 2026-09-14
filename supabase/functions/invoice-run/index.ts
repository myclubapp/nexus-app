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
import PDFDocument from 'npm:pdfkit@0.15.0';
import { SwissQRBill, Table } from 'npm:swissqrbill@4.2.0/pdf';
import { mm2pt } from 'npm:swissqrbill@4.2.0/utils';
import { invoiceMail, type Locale } from './mail.ts';

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

interface Creditor {
  iban: string;
  name: string;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
}

interface PayloadInvoice {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  due_date: string;
  member_id: string;
  name: string;
  email: string | null;
  locale: string;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  positions: { label: string; amount: number }[];
}

interface Payload {
  period: { id: string; name: string; due_date: string; currency: string };
  club: { id: string; name: string; logo_url: string | null };
  creditor: Creditor | null;
  invoices: PayloadInvoice[];
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
export function missingAddressFields(invoice: {
  street: string | null;
  postal_code: string | null;
  city: string | null;
}): string[] {
  const missing: string[] = [];
  if (!invoice.street?.trim()) missing.push('street');
  if (!invoice.postal_code?.trim()) missing.push('postalCode');
  if (!invoice.city?.trim()) missing.push('city');
  return missing;
}

/** Zwei Zeilen Adresse, ohne leere Teile und ohne doppelte Leerzeichen. */
function addressLines(parts: {
  name: string;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
}): string {
  const street = [parts.street, parts.houseNumber].filter(Boolean).join(' ').trim();
  const town = [parts.postalCode, parts.city].filter(Boolean).join(' ').trim();
  return [parts.name, street, town].filter((line) => line.length > 0).join('\n');
}

/**
 * Das Blatt: Logo, beide Adressen, Titel, Positionstabelle, Einzahlungsschein.
 *
 * Die Anordnung ist die der alten App – ein Verein, der seine Rechnung kennt,
 * soll sie wiedererkennen.
 */
async function buildPdf(
  invoice: PayloadInvoice,
  payload: Payload,
  logo: Uint8Array | null,
  incomplete: boolean,
): Promise<Uint8Array> {
  const creditor = payload.creditor!;

  const pdf = new PDFDocument({ size: 'A4' });
  const chunks: Uint8Array[] = [];
  const done = new Promise<Uint8Array>((resolve, reject) => {
    pdf.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    pdf.on('end', () => {
      const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(out);
    });
    pdf.on('error', reject);
  });

  const qrBill = new SwissQRBill({
    amount: Number(invoice.amount),
    currency: invoice.currency as 'CHF' | 'EUR',
    reference: invoice.reference,
    message: `${payload.period.name} ${invoice.name}`.trim().slice(0, 140),
    creditor: {
      account: creditor.iban.replace(/\s/g, ''),
      name: creditor.name,
      address: creditor.street ?? '',
      buildingNumber: creditor.house_number ?? '',
      zip: creditor.postal_code ?? '',
      city: creditor.city ?? '',
      country: creditor.country,
    },
    debtor: {
      name: invoice.name,
      address: invoice.street ?? '',
      buildingNumber: invoice.house_number ?? '',
      zip: invoice.postal_code ?? '',
      city: invoice.city ?? '',
      country: invoice.country || 'CH',
    },
  });
  qrBill.attachTo(pdf);

  if (logo) {
    pdf.image(logo, mm2pt(20), mm2pt(5), { width: mm2pt(30) });
  }

  pdf.fontSize(11).font('Helvetica').fillColor('black');
  pdf.text(
    addressLines({
      name: creditor.name,
      street: creditor.street,
      houseNumber: creditor.house_number,
      postalCode: creditor.postal_code,
      city: creditor.city,
    }),
    mm2pt(20),
    mm2pt(40),
    { align: 'left', width: mm2pt(100) },
  );

  pdf.text(
    addressLines({
      name: invoice.name,
      street: invoice.street,
      houseNumber: invoice.house_number,
      postalCode: invoice.postal_code,
      city: invoice.city,
    }),
    mm2pt(120),
    mm2pt(60),
    { align: 'left', width: mm2pt(70) },
  );

  pdf.fontSize(14).font('Helvetica-Bold');
  pdf.text(`${payload.period.name}`, mm2pt(20), mm2pt(100), { align: 'left', width: mm2pt(170) });

  pdf.fontSize(10).font('Helvetica');
  pdf.text(
    `${invoice.reference.replace(/(.{5})/g, '$1 ').trim()}\n` +
      `${new Date().toISOString().slice(0, 10)}`,
    { align: 'left', width: mm2pt(170) },
  );

  const rows = [
    {
      backgroundColor: '#4A4D51',
      columns: [
        { text: 'Pos.', width: mm2pt(15) },
        { text: 'Bezeichnung' },
        { text: 'Betrag', width: mm2pt(30), align: 'right' as const },
      ],
      fontName: 'Helvetica-Bold',
      height: 20,
      padding: 5,
      textColor: '#fff',
      verticalAlign: 'center' as const,
    },
    ...invoice.positions.map((position, index) => ({
      columns: [
        { text: String(index + 1), width: mm2pt(15) },
        { text: position.label },
        {
          text: `${invoice.currency} ${Number(position.amount).toFixed(2)}`,
          width: mm2pt(30),
          align: 'right' as const,
        },
      ],
      padding: 5,
    })),
    {
      columns: [
        { text: '', width: mm2pt(15) },
        { fontName: 'Helvetica-Bold', text: 'Total' },
        {
          fontName: 'Helvetica-Bold',
          text: `${invoice.currency} ${Number(invoice.amount).toFixed(2)}`,
          width: mm2pt(30),
          align: 'right' as const,
        },
      ],
      height: 30,
      padding: 5,
    },
  ];

  new Table({ rows, width: mm2pt(170) }).attachTo(pdf);

  if (incomplete) {
    pdf.moveDown(2);
    pdf.fontSize(9).font('Helvetica-Oblique').fillColor('red');
    pdf.text(
      'Hinweis: Die Adressangaben sind unvollständig. Bitte ergänze sie in deinem Profil, ' +
        'damit die nächste Rechnung richtig zugestellt wird.',
      mm2pt(20),
      undefined,
      { width: mm2pt(170) },
    );
    pdf.fillColor('black').font('Helvetica');
  }

  pdf.end();
  return await done;
}

/** Das Logo für den Kopf. Fehlt es oder antwortet es nicht, bleibt es weg. */
async function loadLogo(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const type = response.headers.get('content-type') ?? '';
    // pdfkit kennt nur JPEG und PNG. Ein SVG-Logo bliebe sonst ein Fehler
    // mitten im Lauf, statt einfach zu fehlen.
    if (!/jpeg|jpg|png/i.test(type)) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch (cause) {
    console.error('Logo nicht ladbar', cause);
    return null;
  }
}

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

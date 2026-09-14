/**
 * Das Rechnungsblatt (UC-046, Schritt 9).
 *
 * Getrennt von `index.ts`, weil hier **keine** Datenbank und kein SMTP
 * vorkommt: Aus einer Rechnung wird ein PDF, mehr nicht. So lässt sich das
 * Blatt bauen und ansehen, ohne einen Lauf auszulösen – `index.ts` startet
 * beim Import einen Server und taugt dafür nicht.
 *
 * Die Anordnung ist die der alten App (`changeInvoice.ts`): Logo oben links,
 * beide Adressen, Titel mit Referenz und Datum, Positionstabelle, darunter der
 * Einzahlungsschein.
 */
import PDFDocument from 'npm:pdfkit@0.15.0';
import { SwissQRBill, Table } from 'npm:swissqrbill@4.2.0/pdf';
import { mm2pt } from 'npm:swissqrbill@4.2.0/utils';
import { billLanguage, groupReference, PDF_LABELS, swissDate, type Locale } from './mail.ts';

export interface Creditor {
  iban: string;
  name: string;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
}

export interface PayloadInvoice {
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

export interface Payload {
  period: { id: string; name: string; due_date: string; currency: string };
  club: { id: string; name: string; logo_url: string | null };
  creditor: Creditor | null;
  invoices: PayloadInvoice[];
}

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
export async function buildPdf(
  invoice: PayloadInvoice,
  payload: Payload,
  logo: Uint8Array | null,
  incomplete: boolean,
): Promise<Uint8Array> {
  const creditor = payload.creditor!;
  // Die Rechnung spricht die Sprache der Person, nicht die des Vereins –
  // wie jeder andere Benutzertext (CLAUDE.md, vier Sprachen).
  const locale: Locale = (['de', 'fr', 'it', 'en'] as const).includes(invoice.locale as Locale)
    ? (invoice.locale as Locale)
    : 'de';
  const labels = PDF_LABELS[locale];

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

  // Die Sprache ist eine **Option**, kein Feld der Daten: In den Daten würde
  // sie stillschweigend ignoriert, und der Einzahlungsschein bliebe deutsch.
  // Der Typcheck hat es gefunden, der Augenschein nicht.
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
  }, { language: billLanguage(locale) });
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
    `${labels.reference}: ${groupReference(invoice.reference)}\n` +
      `${labels.date}: ${swissDate(new Date())}`,
    { align: 'left', width: mm2pt(170) },
  );

  const rows = [
    {
      backgroundColor: '#4A4D51',
      columns: [
        { text: labels.position, width: mm2pt(15) },
        { text: labels.description },
        { text: labels.amount, width: mm2pt(30), align: 'right' as const },
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
        { fontName: 'Helvetica-Bold', text: labels.total },
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
    pdf.text(labels.incomplete, mm2pt(20), undefined, { width: mm2pt(170) });
    pdf.fillColor('black').font('Helvetica');
  }

  pdf.end();
  return await done;
}

/** Das Logo für den Kopf. Fehlt es oder antwortet es nicht, bleibt es weg. */
export async function loadLogo(url: string | null): Promise<Uint8Array | null> {
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


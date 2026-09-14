/**
 * Eine camt-Datei der Bank lesen (UC-047, Schritte 3 bis 5).
 *
 * Gegenstück zu `processCamt53()` in der alten App – dort lief es **im
 * Browser**: Der Client entschied, welche Rechnung bezahlt ist, und schrieb
 * den Stand direkt. Hier liest der Server die Datei, und zugeordnet wird in
 * der Datenbank (`match_camt_payments`). Welche Rechnung als bezahlt gilt, ist
 * dieselbe Klasse Entscheidung wie eine Punktebuchung (NFR-012).
 *
 * Gelesen werden camt.053 (Kontoauszug) und camt.054 (Sammelbuchung). Beide
 * tragen unterhalb von `Ntry` dieselbe Struktur; sie unterscheiden sich nur im
 * Kopf, und der interessiert hier nicht.
 *
 * Diese Datei enthält **nur** das Lesen – eine reine Funktion über einem
 * String, damit sie ohne Bank und ohne Datenbank prüfbar ist (`camt_test.ts`).
 */
import { XMLParser } from 'npm:fast-xml-parser@4.5.0';

export interface CamtPayment {
  /** Die QR-Referenz, ohne Leerzeichen: 27 Ziffern. */
  reference: string;
  amount: number;
  currency: string;
  /** Buchungs- oder Valutadatum, ISO. Fehlt beides, bleibt es leer. */
  paid_at: string | null;
  payer: string | null;
}

/** Alle Knoten dieses Namens, beliebig tief. Ein Element kann Objekt oder Liste sein. */
function collect(node: unknown, name: string, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (node === null || typeof node !== 'object') return out;

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === name) {
      for (const entry of Array.isArray(value) ? value : [value]) {
        if (entry && typeof entry === 'object') out.push(entry as Record<string, unknown>);
      }
    }
    if (Array.isArray(value)) {
      for (const entry of value) collect(entry, name, out);
    } else if (value && typeof value === 'object') {
      collect(value, name, out);
    }
  }
  return out;
}

/** Der erste Textwert unter diesem Pfad, oder null. */
function text(node: unknown, ...path: string[]): string | null {
  let current: unknown = node;
  for (const step of path) {
    if (!current || typeof current !== 'object') return null;
    const value = (current as Record<string, unknown>)[step];
    current = Array.isArray(value) ? value[0] : value;
  }
  if (current === null || current === undefined) return null;
  if (typeof current === 'object') {
    // Ein Element mit Attribut (`<Amt Ccy="CHF">50.00</Amt>`) kommt als Objekt
    // mit `#text` herein.
    const inner = (current as Record<string, unknown>)['#text'];
    return inner === undefined ? null : String(inner);
  }
  return String(current);
}

/** Die Referenz einer Zahlung – QRR, oder eine, die wie eine QRR aussieht. */
export function referenceOf(node: unknown): string | null {
  const raw = text(node, 'RmtInf', 'Strd', 'CdtrRefInf', 'Ref');
  if (!raw) return null;

  const reference = raw.replace(/\s/g, '');
  const kind =
    text(node, 'RmtInf', 'Strd', 'CdtrRefInf', 'Tp', 'CdOrPrtry', 'Prtry') ??
    text(node, 'RmtInf', 'Strd', 'CdtrRefInf', 'Tp', 'CdOrPrtry', 'Cd');

  // Die alte App verlangte `QRR`. Nicht jede Bank setzt die Kennzeichnung –
  // deshalb gilt auch eine Referenz, die die Form einer QRR hat. Eine
  // 27-stellige Zahl, die zu keiner Rechnung gehört, wird ohnehin nicht
  // zugeordnet, sondern gemeldet.
  if (kind === 'QRR' || /^[0-9]{27}$/.test(reference)) return reference;
  return null;
}

/**
 * Die Gutschriften einer camt-Datei.
 *
 * **Nur Gutschriften.** `CdtDbtInd = DBIT` ist eine Belastung – eine Zahlung
 * des Vereins, nicht an ihn. Sie als Zahlungseingang zu verbuchen, würde
 * Rechnungen auf «bezahlt» setzen, die niemand bezahlt hat.
 */
export function extractPayments(xml: string): CamtPayment[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });

  const document = parser.parse(xml);
  const payments: CamtPayment[] = [];

  for (const entry of collect(document, 'Ntry')) {
    if (text(entry, 'CdtDbtInd') === 'DBIT') continue;

    const date =
      text(entry, 'BookgDt', 'Dt') ??
      text(entry, 'BookgDt', 'DtTm') ??
      text(entry, 'ValDt', 'Dt') ??
      text(entry, 'ValDt', 'DtTm');

    // Eine Sammelbuchung trägt ihre Einzelzahlungen unter `TxDtls`; eine
    // einzelne Gutschrift steht direkt am `Ntry`.
    const details = collect(entry, 'TxDtls');
    const sources: unknown[] = details.length > 0 ? details : [entry];

    for (const source of sources) {
      const reference = referenceOf(source);
      if (!reference) continue;

      const amount = Number(
        text(source, 'Amt') ?? text(source, 'AmtDtls', 'TxAmt', 'Amt') ?? text(entry, 'Amt') ?? '0',
      );
      const currency =
        (source as Record<string, Record<string, string>>)?.Amt?.['@_Ccy'] ??
        (entry as Record<string, Record<string, string>>)?.Amt?.['@_Ccy'] ??
        'CHF';

      payments.push({
        reference,
        amount: Number.isFinite(amount) ? amount : 0,
        currency,
        paid_at: date,
        payer:
          text(source, 'RltdPties', 'Dbtr', 'Nm') ??
          text(source, 'RltdPties', 'Dbtr', 'Pty', 'Nm') ??
          null,
      });
    }
  }

  return payments;
}

/**
 * Der Rechnungsspiegel (UC-036).
 *
 * **BR-156: «Die App kennt nur den Spiegel.»** Betrag, Fälligkeit, Status und
 * ein Link – Positionen, Zahlungsreferenzen und Bankdaten bleiben im
 * Rechnungsdienst. Die App erzeugt **keine** Rechnung und keinen
 * QR-Einzahlungsschein; das gehört dorthin, wo die Gläubigerangaben liegen.
 */

/** Die Stände – dieselben Werte wie der Constraint in `0054`. */
export const INVOICE_STATUSES = ['open', 'paid', 'overdue'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface InvoiceRef {
  id: string;
  amount: number;
  dueDate: string;
  status: InvoiceStatus;
  paidAt: string | null;
  detailUrl: string | null;
  /**
   * Der Pfad zur abgelegten Rechnung im Vereinsspeicher (UC-046, BR-225).
   *
   * Seit der Rechnungsdienst in nexus läuft, liegt das PDF im eigenen Bucket
   * statt bei einem fremden Dienst. `detailUrl` bleibt daneben bestehen: Ein
   * Verein, der seine Rechnungen doch auswärts stellt, meldet weiterhin einen
   * Link. Der Pfad wird je Abruf signiert – eine gespeicherte Adresse liefe ab.
   */
  pdfPath: string | null;
}

/**
 * War diese Zahlung fristgerecht (BR-157)?
 *
 * Auf den **Tag**: Wer am Fälligkeitstag zahlt, ist pünktlich. Dieselbe Regel
 * steht in `report_invoice()`; hier entscheidet sie nur, ob die Ansicht die
 * Gutschrift erwähnt.
 */
export function wasOnTime(invoice: InvoiceRef): boolean {
  if (invoice.status !== 'paid' || !invoice.paidAt) return false;
  return invoice.paidAt.slice(0, 10) <= invoice.dueDate;
}

/**
 * Die Farbrolle des Standes.
 *
 * **BR-158: keine Sanktion bei Verzug.** Überfällig ist deshalb `warning` und
 * nicht `danger`: Es ist ein Anlass für Kontakt, kein Vergehen.
 */
export function statusTone(status: InvoiceStatus): 'success' | 'warning' | 'medium' {
  if (status === 'paid') return 'success';
  if (status === 'overdue') return 'warning';
  return 'medium';
}

/** Offene und überfällige zuerst – was zu tun ist, steht oben. */
export function sortInvoices(rows: readonly InvoiceRef[]): InvoiceRef[] {
  const rank: Record<InvoiceStatus, number> = { overdue: 0, open: 1, paid: 2 };
  return [...rows].sort(
    (a, b) => rank[a.status] - rank[b.status] || a.dueDate.localeCompare(b.dueDate),
  );
}

/** Die Summe dessen, was noch offen ist. */
export function openTotal(rows: readonly InvoiceRef[]): number {
  return rows
    .filter((row) => row.status !== 'paid')
    .reduce((total, row) => total + row.amount, 0);
}

/**
 * Die Rechnungsstellung des Vereins (UC-046).
 *
 * Hier stehen die Entscheidungen, die weder ein Ereignis-Handler noch die
 * Datenbank allein treffen soll: Welche Positionen ein Mitglied bekäme, was
 * eine Periode kostet, ob eine IBAN taugt, wie eine Referenz lesbar wird.
 *
 * **Jede Regel steht zweimal – hier und in `0087_invoicing.sql` – und das ist
 * Absicht:** Die Datenbank entscheidet, die App erklärt. Läuft eines
 * auseinander, ist das ein Fehler; deshalb prüfen die Tests hier dieselben
 * Beispiele, die auch die Migration trägt (SIX-Prüfziffern).
 */
import type { Invoice, InvoiceFeeItem, InvoiceState } from './database.types';

/** Der QR-Einzahlungsschein kennt nur diese beiden Währungen (SIX). */
export const QR_CURRENCIES = ['CHF', 'EUR'] as const;
export type QrCurrency = (typeof QR_CURRENCIES)[number];

/**
 * Prüfziffer einer IBAN nach ISO 7064 (mod 97-10).
 *
 * Dieselbe Rechnung wie `is_valid_iban()` in `0087`. Sie steht hier, damit das
 * Feld beim Tippen antwortet statt erst beim Speichern – die verbindliche
 * Prüfung bleibt die `check`-Bedingung am Tisch.
 */
export function isValidIban(value: string): boolean {
  const iban = value.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[0-9A-Z]{11,30}$/.test(iban)) return false;

  const moved = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const char of moved) {
    const digits = /[0-9]/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of digits) {
      rest = (rest * 10 + Number(digit)) % 97;
    }
  }
  return rest === 1;
}

/**
 * Ist das eine QR-IBAN?
 *
 * Nur sie trägt eine QRR-Referenz – und nur mit ihr lässt sich ein
 * Zahlungseingang später eindeutig zuordnen (UC-047). Die QR-IID steht an den
 * Stellen 5 bis 9 und liegt zwischen 30000 und 31999.
 */
export function isQrIban(value: string): boolean {
  const iban = value.replace(/\s/g, '').toUpperCase();
  return isValidIban(iban) && /^(CH|LI)[0-9]{2}3[01][0-9]{3}/.test(iban);
}

/** Die Prüfziffer einer QR-Referenz: Modulo 10 rekursiv (SIX). */
export function qrCheckDigit(base: string): number {
  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const char of base) {
    if (!/[0-9]/.test(char)) throw new Error(`Referenzbasis ist keine Ziffernfolge: ${base}`);
    carry = table[(carry + Number(char)) % 10];
  }
  return (10 - carry) % 10;
}

/**
 * Die Referenz, wie sie auf dem Einzahlungsschein steht: von **rechts** in
 * Fünfergruppen, die erste Gruppe deshalb zweistellig (SIX).
 */
export function formatQrReference(reference: string): string {
  const clean = reference.replace(/\s/g, '');
  if (clean.length === 0) return '';

  const head = clean.length % 5;
  const groups: string[] = [];
  if (head > 0) groups.push(clean.slice(0, head));
  for (let index = head; index < clean.length; index += 5) {
    groups.push(clean.slice(index, index + 5));
  }
  return groups.join(' ');
}

/**
 * Welche Positionen bekäme dieses Mitglied (UC-046, Schritt 5)?
 *
 * Der Beitrag eines Teams gilt für dessen Mitglieder, der Zuschlag des Vereins
 * (`team_id` null) für alle. Dieselbe Regel steht in `generate_invoices()`;
 * hier entscheidet sie nur, was die Vorschau zeigt – **bevor** jemand einen
 * Lauf auslöst, der zwanzig Rechnungen erzeugt.
 */
export function positionsFor(
  items: readonly InvoiceFeeItem[],
  memberTeamIds: readonly string[],
): InvoiceFeeItem[] {
  return items.filter(
    (item) =>
      item.is_active && (item.team_id === null || memberTeamIds.includes(item.team_id)),
  );
}

/** Was dieses Mitglied kostet – die Summe seiner Positionen (BR-228). */
export function totalFor(
  items: readonly InvoiceFeeItem[],
  memberTeamIds: readonly string[],
): number {
  return positionsFor(items, memberTeamIds).reduce((sum, item) => sum + Number(item.amount), 0);
}

/**
 * Die Farbrolle eines Stands.
 *
 * **Überfällig ist `warning`, nicht `danger`** – dieselbe Entscheidung wie in
 * `src/lib/invoice.ts` für die Mitgliedersicht (BR-158): Ein offener Betrag
 * ist ein Anlass für Kontakt, kein Vergehen. Storniert ist `medium`: Es ist
 * keine Forderung mehr, aber auch kein Erfolg.
 */
export function stateTone(
  state: InvoiceState,
  dueDate: string,
  today: string,
): 'success' | 'warning' | 'primary' | 'medium' {
  if (state === 'paid') return 'success';
  if (state === 'cancelled') return 'medium';
  if (state === 'draft') return 'medium';
  return dueDate < today ? 'warning' : 'primary';
}

export interface PeriodTotals {
  draft: number;
  sent: number;
  paid: number;
  cancelled: number;
  /** Was noch aussteht: versendet und nicht bezahlt. Entwürfe zählen nicht. */
  open: number;
  /** Was eingegangen ist. */
  received: number;
}

/**
 * Der Stand einer Periode.
 *
 * **Ein Entwurf ist kein offener Betrag.** Er ist eine Überlegung des
 * Vorstands; erst der Versand macht daraus eine Forderung (BR-226). Eine
 * Summe, die Entwürfe mitzählte, zeigte Geld, das niemand schuldet.
 */
export function periodTotals(invoices: readonly Invoice[]): PeriodTotals {
  const totals: PeriodTotals = {
    draft: 0,
    sent: 0,
    paid: 0,
    cancelled: 0,
    open: 0,
    received: 0,
  };

  for (const invoice of invoices) {
    totals[invoice.status] += 1;
    if (invoice.status === 'sent') totals.open += Number(invoice.amount);
    if (invoice.status === 'paid') totals.received += Number(invoice.amount);
  }
  return totals;
}

/**
 * Was der Versand blockiert (BR-222, A1).
 *
 * Die Antwort ist eine Liste von Gründen und keine Ja-Nein-Frage: Wer
 * versenden will und nicht kann, soll erfahren **was** fehlt, nicht nur dass
 * etwas fehlt.
 */
export function creditorProblems(creditor: {
  iban?: string | null;
  name?: string | null;
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
} | null | undefined): string[] {
  if (!creditor) return ['missing'];

  const problems: string[] = [];
  if (!creditor.iban?.trim()) problems.push('iban');
  else if (!isValidIban(creditor.iban)) problems.push('ibanInvalid');
  else if (!isQrIban(creditor.iban)) problems.push('ibanNotQr');

  if (!creditor.name?.trim()) problems.push('name');
  if (!creditor.street?.trim()) problems.push('street');
  if (!creditor.postal_code?.trim()) problems.push('postalCode');
  if (!creditor.city?.trim()) problems.push('city');

  return problems;
}

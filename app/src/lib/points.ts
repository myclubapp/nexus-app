import type { PointRule, PointTransaction } from './database.types';
import { PILLARS, type Pillar } from './pointRule';

/**
 * Wie eine Buchung überschrieben wird (Schritt 3, FR-041).
 *
 * Die Spezifikation verlangt «Datum, Anlass und Wert». Der Anlass ist die
 * Notiz – der Titel der Aufgabe, der Schicht, des Termins. Fehlt sie, tritt
 * die Beschriftung der Regel ein; erst wenn auch die fehlt, bleibt der
 * Regelcode. Ein Code als Überschrift («task_done») ist keine Auskunft.
 */
export function bookingLabel(
  entry: Pick<PointTransaction, 'note' | 'rule_code' | 'source_type'>,
  rules: readonly Pick<PointRule, 'code' | 'label'>[] = [],
): string {
  const note = entry.note?.trim();
  if (note) return note;

  const rule = rules.find((candidate) => candidate.code === entry.rule_code);
  if (rule) return rule.label;

  return entry.rule_code ?? entry.source_type;
}

/** Die Säule einer Buchung – über ihre Regel, denn der Ledger führt sie nicht. */
export function bookingPillar(
  entry: Pick<PointTransaction, 'rule_code'>,
  rules: readonly Pick<PointRule, 'code' | 'pillar'>[],
): Pillar | null {
  const rule = rules.find((candidate) => candidate.code === entry.rule_code);
  if (!rule) return null;
  return PILLARS.includes(rule.pillar as Pillar) ? (rule.pillar as Pillar) : null;
}

/**
 * Die Saisons, in denen gebucht wurde – neueste zuerst (A2).
 *
 * Aus den Buchungen gelesen und nicht gerechnet: Ein Verein, der seinen
 * Saisonstart verschiebt, hat alte Buchungen unter dem alten Label, und die
 * sollen auffindbar bleiben.
 */
export function seasonsOf(
  entries: readonly Pick<PointTransaction, 'season'>[],
): string[] {
  return [...new Set(entries.map((entry) => entry.season))].sort((a, b) =>
    b.localeCompare(a),
  );
}

export interface BookingFilter {
  /** `null` heisst «alle Saisons». */
  season: string | null;
  /** `null` heisst «alle Säulen». */
  pillar: Pillar | null;
}

/** Die Historie nach Saison und Säule einschränken (A2, FR-041). */
export function filterBookings<
  T extends Pick<PointTransaction, 'season' | 'rule_code'>,
>(
  entries: readonly T[],
  filter: BookingFilter,
  rules: readonly Pick<PointRule, 'code' | 'pillar'>[],
): T[] {
  return entries.filter((entry) => {
    if (filter.season !== null && entry.season !== filter.season) return false;
    if (filter.pillar !== null && bookingPillar(entry, rules) !== filter.pillar) {
      return false;
    }
    return true;
  });
}

/** Die Summe einer Auswahl – Korrekturbuchungen zählen negativ mit. */
export function sumPoints(
  entries: readonly Pick<PointTransaction, 'points'>[],
): number {
  return entries.reduce((total, entry) => total + entry.points, 0);
}

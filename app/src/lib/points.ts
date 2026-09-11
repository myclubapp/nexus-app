import type { PointRule, PointTransaction } from './database.types';
import { PILLARS, type Pillar } from './pointRule';
import { seasonLabel } from './season';

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

/**
 * Die Säule einer Buchung.
 *
 * Zwei Wege für zwei Fälle: Eine Buchung von Hand trägt die Säule selbst –
 * sie hat keine Regel, aus der sie sich ableiten liesse (UC-021). Alle
 * übrigen führen sie über ihren Regelcode.
 */
export function bookingPillar(
  entry: Pick<PointTransaction, 'rule_code' | 'pillar'>,
  rules: readonly Pick<PointRule, 'code' | 'pillar'>[],
): Pillar | null {
  if (entry.pillar !== null && PILLARS.includes(entry.pillar as Pillar)) {
    return entry.pillar as Pillar;
  }

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

export type BookingProblem =
  | 'noMembers'
  | 'noteMissing'
  | 'pointsNotPositive'
  | 'tooManyMembers';

/** Höchstzahl je Sammelbuchung – dieselbe Grenze wie in `0038` (A3). */
export const MAX_BOOKING_MEMBERS = 100;

/**
 * Was an einer Buchung von Hand fehlt (UC-021, A2, BR-086, BR-087).
 *
 * Dieselben Regeln stehen als Constraint und in der Buchungsfunktion; diese
 * Prüfung erspart der Person die Fehlermeldung, sie ersetzt sie nicht (C-011).
 */
export function validateManualBooking(input: {
  memberIds: readonly string[];
  points: number;
  note: string;
}): BookingProblem[] {
  const problems: BookingProblem[] = [];

  if (input.memberIds.length === 0) problems.push('noMembers');
  if (input.memberIds.length > MAX_BOOKING_MEMBERS) problems.push('tooManyMembers');
  if (input.note.trim().length === 0) problems.push('noteMissing');
  // BR-087: Ein Abzug entsteht nur als Korrektur einer Buchung, nie als
  // negative Buchung von Hand.
  if (!Number.isFinite(input.points) || input.points <= 0) {
    problems.push('pointsNotPositive');
  }

  return problems;
}

/** Eine Korrektur trägt ihre Begründung, sonst ist sie nicht nachvollziehbar. */
export function canCorrect(note: string): boolean {
  return note.trim().length > 0;
}

export interface BookingFilter {
  /** `null` heisst «alle Saisons». */
  season: string | null;
  /** `null` heisst «alle Säulen». */
  pillar: Pillar | null;
}

/** Die Historie nach Saison und Säule einschränken (A2, FR-041). */
export function filterBookings<
  T extends Pick<PointTransaction, 'season' | 'rule_code' | 'pillar'>,
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

/** Ein Monat der Saison mit seinen Punkten (Konzept §7.1, «Saisonverlauf»). */
export interface MonthPoints {
  /** Der Monatsbeginn als Datum – die Ansicht beschriftet ihn in der Sprache der Person. */
  month: Date;
  points: number;
}

/**
 * Punkte je Monat der laufenden Saison – vom Saisonstart bis heute.
 *
 * Leere Monate stehen mit Null drin: Ein Verlauf, der die stillen Monate
 * auslässt, zeigt keine Entwicklung, sondern eine Auswahl. Gerechnet wird in
 * Ortszeit; ein Termin am Monatsersten um 00:30 gehört in den neuen Monat.
 */
export function pointsPerMonth(
  entries: readonly Pick<PointTransaction, 'created_at' | 'points' | 'season'>[],
  seasonStart: string | null | undefined,
  today: Date = new Date(),
): MonthPoints[] {
  const season = seasonLabel(seasonStart, today);
  const firstYear = Number(season.slice(0, 4));
  const start = seasonStart ? new Date(seasonStart) : null;
  const startMonth = start && !Number.isNaN(start.getTime()) ? start.getMonth() : 0;

  const months: MonthPoints[] = [];
  const cursor = new Date(firstYear, startMonth, 1);
  const last = new Date(today.getFullYear(), today.getMonth(), 1);
  while (cursor <= last && months.length < 12) {
    months.push({ month: new Date(cursor), points: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const entry of entries) {
    if (entry.season !== season) continue;
    const at = new Date(entry.created_at);
    const slot = months.find(
      (candidate) =>
        candidate.month.getFullYear() === at.getFullYear() &&
        candidate.month.getMonth() === at.getMonth(),
    );
    if (slot) slot.points += entry.points;
  }

  return months;
}

/**
 * Die Balken eines Monatsverlaufs auf einer Fläche von 100 × 40.
 *
 * Reine Rechnung wie `trendPath()`: prüfbar, und die Ansicht zeichnet nur.
 * Der höchste Monat füllt die Höhe; ohne Punkte gibt es keine Balken.
 */
export function monthBars(
  months: readonly MonthPoints[],
): { x: number; width: number; height: number }[] {
  const max = Math.max(0, ...months.map((entry) => entry.points));
  if (months.length === 0 || max === 0) return [];
  const slot = 100 / months.length;
  const width = slot * 0.6;
  return months.map((entry, index) => ({
    x: Math.round((index * slot + (slot - width) / 2) * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round((Math.max(0, entry.points) / max) * 40 * 100) / 100,
  }));
}

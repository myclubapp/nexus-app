import type { ClubKind } from './database.types';

/** Reihenfolge im Gründungs-Wizard; entspricht dem check-Constraint auf `clubs.club_kind`. */
export const CLUB_KINDS: readonly ClubKind[] = [
  'sport',
  'music',
  'culture',
  'youth',
  'neighborhood',
  'other',
] as const;

/**
 * Vorgeschlagener Saisonbeginn je Vereinsart, als Monat (1–12).
 *
 * Gegenstück zu `default_season_start()` in `0008_club_founding.sql`. Der
 * Wizard zeigt den Vorschlag an, die Datenbank setzt ihn, wenn der Client
 * keinen mitgibt. Laufen die beiden auseinander, sieht die gründende Person
 * einen anderen Wert als den gespeicherten – deshalb hält ein Test die Tabelle
 * gegen die Migration.
 */
export const SEASON_START_MONTH: Record<ClubKind, number> = {
  sport: 7, // Sommerpause zwischen zwei Saisons
  music: 9, // Vereinsjahr nach den Sommerferien
  culture: 9,
  youth: 8, // Schuljahr
  neighborhood: 1, // rechnet im Kalenderjahr
  other: 1,
};

/**
 * Vorgeschlagener Saisonbeginn als `YYYY-MM-DD`.
 *
 * Bewusst ohne `toISOString()`: das rechnet nach UTC und schiebt den ersten
 * Tag eines Monats in Mitteleuropa auf den letzten des Vormonats.
 */
export function defaultSeasonStart(
  kind: ClubKind,
  today: Date = new Date(),
): string {
  const month = SEASON_START_MONTH[kind] ?? 1;
  return `${today.getFullYear()}-${String(month).padStart(2, '0')}-01`;
}

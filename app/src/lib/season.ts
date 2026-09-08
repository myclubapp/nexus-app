/**
 * Saison-Label wie '2026/27'. Der Saisonstart steht pro Verein in
 * clubs.season_start (z.B. 1. Juni); vorher zählt ein Datum noch zur
 * Vorsaison. Ohne Angabe gilt das Kalenderjahr.
 */
export function seasonLabel(
  seasonStart: string | null | undefined,
  at: Date = new Date(),
): string {
  if (!seasonStart) return String(at.getFullYear());

  const start = new Date(seasonStart);
  if (Number.isNaN(start.getTime())) return String(at.getFullYear());

  const startMonth = start.getMonth();
  const startDay = start.getDate();

  const isBeforeSeasonStart =
    at.getMonth() < startMonth ||
    (at.getMonth() === startMonth && at.getDate() < startDay);

  const firstYear = isBeforeSeasonStart ? at.getFullYear() - 1 : at.getFullYear();
  const secondYear = String((firstYear + 1) % 100).padStart(2, '0');
  return `${firstYear}/${secondYear}`;
}

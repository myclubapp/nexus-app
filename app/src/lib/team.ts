/**
 * Teams (UC-007 A1, S2 der Prüfung vom 2026-09-11).
 *
 * Ein Team ist ein Name und ein Bereich; mehr kennt die Datenbank nicht, und
 * das ist Absicht (K7). Was UC-039 später dazulegt – Verband, Verbandskennung,
 * Liga –, hängt an derselben Zeile.
 */

export type TeamProblem = 'nameMissing';

/**
 * Was an einem Teamnamen fehlt.
 *
 * Zwei Zeichen, weil «A» kein Team ist, «U9» aber schon. Die Datenbank kennt
 * keine Untergrenze; sie steht hier, damit der Knopf gesperrt ist, statt eine
 * leere Zeile anzulegen.
 */
export function validateTeamName(name: string): TeamProblem[] {
  return name.trim().length < 2 ? ['nameMissing'] : [];
}

/**
 * Teams nach Bereich gruppiert, Bereiche alphabetisch, Teams ohne Bereich
 * zuletzt – so liest sich die Liste wie ein Organigramm und nicht wie eine
 * Datenbank.
 */
export function groupTeamsByArea<T extends { name: string; area: string | null }>(
  teams: readonly T[],
): { area: string | null; teams: T[] }[] {
  const groups = new Map<string | null, T[]>();
  for (const team of teams) {
    const key = team.area?.trim() || null;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(team);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a.localeCompare(b);
    })
    .map(([area, list]) => ({
      area,
      teams: [...list].sort((x, y) => x.name.localeCompare(y.name)),
    }));
}

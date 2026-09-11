/**
 * Teams (UC-007 A1, UC-039; S2 der Prüfung vom 2026-09-11).
 *
 * Ein Team ist ein Name und ein Bereich – und seit UC-039 wahlweise eine
 * Verknüpfung zum Verband: Verband, Kennung, Grundname, Liga, Zusatz. Die
 * Entscheidungen dazu stehen hier als reine Funktionen (guidelines §9), die
 * Regeln selbst sitzen in `0060_federation_teams.sql`.
 */

export type TeamProblem = 'nameMissing' | 'additionTooLong';

/** Was ein Team für die Fragen hier mindestens tragen muss. */
export interface TeamLike {
  id: string;
  name: string;
  federation?: string | null;
  federation_team_id?: string | null;
  federation_stale_at?: string | null;
}

/** Ein Team, wie der Verband es nennt (aus `sync-federation`, Betriebsart `teams`). */
export interface RemoteTeam {
  id: string;
  name: string;
  league: string | null;
}

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

/** BR-176: Der Zusatz ist kurz – 40 Zeichen, wie die Spalte. */
export function validateNameAddition(addition: string): TeamProblem[] {
  return addition.trim().length > 40 ? ['additionTooLong'] : [];
}

/** Hängt dieses Team an einem Verbands-Team? */
export function isLinked(team: Pick<TeamLike, 'federation_team_id'>): boolean {
  return Boolean(team.federation_team_id);
}

/** A6: Das Verbands-Team ist beim Abgleich nicht mehr aufgetaucht. */
export function isFederationStale(
  team: Pick<TeamLike, 'federation_team_id' | 'federation_stale_at'>,
): boolean {
  return isLinked(team) && Boolean(team.federation_stale_at);
}

/**
 * BR-176: Wie der Name eines verknüpften Teams entsteht – Grundname des
 * Verbands, dann der Zusatz des Vereins. Dieselbe Regel wie im Trigger
 * `teams_federation_guard()`; hier für die Vorschau im Formular.
 */
export function composeTeamName(baseName: string, addition: string): string {
  return `${baseName.trim()} ${addition.trim()}`.trim();
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

/**
 * A1, Schritt 1: Was das System zu jedem Verbands-Team vorschlägt.
 *
 * `linked` – hängt schon an einem Team (BR-175: nicht erneut wählbar);
 * `match` – ein gleichnamiges, noch nicht verknüpftes Team besteht, der
 * Vorschlag ist die Zuordnung; `new` – anlegen.
 */
export interface LinkProposal {
  federationTeamId: string;
  name: string;
  league: string | null;
  status: 'linked' | 'match' | 'new';
  /** Das Team des Vereins, an dem es hängt oder hängen soll. */
  teamId: string | null;
  teamName: string | null;
}

function normalise(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function proposeLinks(
  remote: readonly RemoteTeam[],
  teams: readonly TeamLike[],
  federation: string,
): LinkProposal[] {
  const claimed = new Set<string>();

  return remote.map((entry) => {
    const linked = teams.find(
      (team) => team.federation === federation && team.federation_team_id === entry.id,
    );
    if (linked) {
      claimed.add(linked.id);
      return {
        federationTeamId: entry.id,
        name: entry.name,
        league: entry.league,
        status: 'linked',
        teamId: linked.id,
        teamName: linked.name,
      };
    }

    // Ein gleichnamiges Team, das noch frei ist – und in dieser Liste noch
    // keinem anderen Verbands-Team vorgeschlagen wurde.
    const match = teams.find(
      (team) =>
        !isLinked(team) && !claimed.has(team.id) && normalise(team.name) === normalise(entry.name),
    );
    if (match) {
      claimed.add(match.id);
      return {
        federationTeamId: entry.id,
        name: entry.name,
        league: entry.league,
        status: 'match',
        teamId: match.id,
        teamName: match.name,
      };
    }

    return {
      federationTeamId: entry.id,
      name: entry.name,
      league: entry.league,
      status: 'new',
      teamId: null,
      teamName: null,
    };
  });
}

/** Was aus den gewählten Vorschlägen an `import_federation_teams()` geht. */
export function toImportItems(
  proposals: readonly LinkProposal[],
  selected: ReadonlySet<string>,
): { federation_team_id: string; name: string; league: string | null; team_id: string | null }[] {
  return proposals
    .filter((entry) => entry.status !== 'linked' && selected.has(entry.federationTeamId))
    .map((entry) => ({
      federation_team_id: entry.federationTeamId,
      name: entry.name,
      league: entry.league,
      team_id: entry.status === 'match' ? entry.teamId : null,
    }));
}

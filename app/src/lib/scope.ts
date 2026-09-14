/**
 * Reichweite der Planung (C-032, Migration `0073`).
 *
 * Serverseitig entscheidet `can_plan_for_team(club, team)`: Der Vorstand
 * plant für den ganzen Verein, eine Trainer:in nur für die Teams, in denen sie
 * selbst steht – und ein Termin, eine Aufgabe oder eine News ohne Team gehört
 * dem Vorstand. Hier steht dieselbe Regel ein zweites Mal, damit die App
 * Knöpfe und Auswahlen nur dort zeigt, wo der Server sie auch annimmt. Das
 * ist Bequemlichkeit, kein Schutz (C-011).
 */
export interface PlanningScope {
  /** Vereins-Scope: sportchef, admin, superadmin (`is_club_board()`). */
  isBoard: boolean;
  /** Darf überhaupt planen: trainer und alle Vorstandsrollen (`is_club_trainer()`). */
  isTrainer: boolean;
  /** Die Teams, in denen das Mitglied selbst steht (`team_members`). */
  myTeamIds: readonly string[];
}

/**
 * Darf für diesen Geltungsbereich geplant werden? `null` heisst «ganzer
 * Verein» – und dafür braucht es den Vorstand.
 */
export function canPlanFor(teamId: string | null | undefined, scope: PlanningScope): boolean {
  if (scope.isBoard) return true;
  if (!scope.isTrainer || !teamId) return false;
  return scope.myTeamIds.includes(teamId);
}

/**
 * Die Teams, die in einem Formular zur Wahl stehen: dem Vorstand alle,
 * Trainer:innen ihre eigenen, allen anderen keines.
 */
export function plannableTeams<T extends { id: string }>(
  teams: readonly T[],
  scope: PlanningScope,
): T[] {
  if (scope.isBoard) return [...teams];
  if (!scope.isTrainer) return [];
  return teams.filter((team) => scope.myTeamIds.includes(team.id));
}

/**
 * Der Vorgabewert einer Team-Auswahl: der Vorstand beginnt beim ganzen
 * Verein, eine Trainer:in bei ihrem ersten Team – sie hat keine andere Wahl.
 */
export function defaultTeamId<T extends { id: string }>(
  teams: readonly T[],
  scope: PlanningScope,
): string | null {
  if (scope.isBoard) return null;
  return plannableTeams(teams, scope)[0]?.id ?? null;
}

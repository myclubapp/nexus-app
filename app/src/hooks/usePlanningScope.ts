import { useCallback, useMemo } from 'react';

import { canPlanFor, plannableTeams, type PlanningScope } from '../lib/scope';
import { useClub } from './useClub';
import { useMyTeams } from './useGamification';
import { useTeams } from './useInvites';

export interface PlanningScopeValue extends PlanningScope {
  /** Solange die eigenen Teams laden, plant eine Trainer:in noch nichts. */
  isLoading: boolean;
  /** Darf für dieses Team geplant werden? `null` heisst «ganzer Verein». */
  canPlanFor: (teamId: string | null | undefined) => boolean;
  /** Die Teams, die in einem Formular zur Wahl stehen. */
  teams: { id: string; name: string }[];
}

/**
 * Die Reichweite der Planung für die angemeldete Person (C-032, `0073`).
 *
 * Bündelt Rolle und Teamzugehörigkeit, damit Seiten und Formulare nicht jede
 * für sich nachrechnen, ob der Vorstand oder eine Trainer:in vor ihnen steht.
 * Die Regel selbst liegt in `lib/scope.ts` und – massgebend – in
 * `can_plan_for_team()` auf dem Server.
 */
export function usePlanningScope(): PlanningScopeValue {
  const { isBoard, isTrainer } = useClub();
  const myTeams = useMyTeams();
  const allTeams = useTeams();

  const myTeamIds = useMemo(
    () => (myTeams.data ?? []).map((team) => team.id),
    [myTeams.data],
  );

  const scope = useMemo<PlanningScope>(
    () => ({ isBoard, isTrainer, myTeamIds }),
    [isBoard, isTrainer, myTeamIds],
  );

  const check = useCallback(
    (teamId: string | null | undefined) => canPlanFor(teamId, scope),
    [scope],
  );

  const teams = useMemo(
    () => plannableTeams(allTeams.data ?? [], scope),
    [allTeams.data, scope],
  );

  return {
    ...scope,
    isLoading: myTeams.isLoading || allTeams.isLoading,
    canPlanFor: check,
    teams,
  };
}

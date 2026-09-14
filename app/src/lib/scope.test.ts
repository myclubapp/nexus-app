import { describe, expect, it } from 'vitest';

import { canPlanFor, defaultTeamId, plannableTeams, type PlanningScope } from './scope';

/**
 * Die Reichweite der Planung (C-032, `0073`): Der Vorstand plant den Verein,
 * eine Trainer:in ihre Teams, ein Mitglied nichts. Geprüft wird die Regel,
 * nicht die Bedienoberfläche – die Policies auf dem Server sagen dasselbe.
 */
const teams = [
  { id: 't-a', name: 'Herren 1' },
  { id: 't-b', name: 'Junioren U16' },
  { id: 't-c', name: 'Damen 2' },
];

const board: PlanningScope = { isBoard: true, isTrainer: true, myTeamIds: ['t-a'] };
const trainer: PlanningScope = { isBoard: false, isTrainer: true, myTeamIds: ['t-a', 't-c'] };
const member: PlanningScope = { isBoard: false, isTrainer: false, myTeamIds: ['t-a'] };
const trainerWithoutTeam: PlanningScope = { isBoard: false, isTrainer: true, myTeamIds: [] };

describe('canPlanFor', () => {
  it('lässt den Vorstand für jedes Team und für den ganzen Verein planen', () => {
    expect(canPlanFor('t-b', board)).toBe(true);
    expect(canPlanFor(null, board)).toBe(true);
  });

  it('lässt eine Trainer:in nur für ihre eigenen Teams planen', () => {
    expect(canPlanFor('t-a', trainer)).toBe(true);
    expect(canPlanFor('t-c', trainer)).toBe(true);
    expect(canPlanFor('t-b', trainer)).toBe(false);
  });

  it('gibt Vereinsweites – kein Team – nur dem Vorstand', () => {
    expect(canPlanFor(null, trainer)).toBe(false);
    expect(canPlanFor(undefined, trainer)).toBe(false);
  });

  it('lässt ein Mitglied auch im eigenen Team nichts planen', () => {
    expect(canPlanFor('t-a', member)).toBe(false);
  });
});

describe('plannableTeams', () => {
  it('bietet dem Vorstand alle Teams an', () => {
    expect(plannableTeams(teams, board).map((t) => t.id)).toEqual(['t-a', 't-b', 't-c']);
  });

  it('bietet einer Trainer:in ihre Teams in der Reihenfolge der Liste an', () => {
    expect(plannableTeams(teams, trainer).map((t) => t.id)).toEqual(['t-a', 't-c']);
  });

  it('bietet einem Mitglied und einer Trainer:in ohne Team nichts an', () => {
    expect(plannableTeams(teams, member)).toEqual([]);
    expect(plannableTeams(teams, trainerWithoutTeam)).toEqual([]);
  });
});

describe('defaultTeamId', () => {
  it('beginnt beim Vorstand mit dem ganzen Verein', () => {
    expect(defaultTeamId(teams, board)).toBeNull();
  });

  it('beginnt bei einer Trainer:in mit ihrem ersten Team', () => {
    expect(defaultTeamId(teams, trainer)).toBe('t-a');
  });

  it('bleibt ohne eigenes Team leer', () => {
    expect(defaultTeamId(teams, trainerWithoutTeam)).toBeNull();
  });
});

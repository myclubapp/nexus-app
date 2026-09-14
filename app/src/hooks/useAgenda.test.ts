import { describe, expect, it } from 'vitest';
import { teamScopeClause } from './useAgenda';

describe('teamScopeClause', () => {
  it('grenzt ohne Liste nicht ein – die Agenda zeigt, was lesbar ist', () => {
    expect(teamScopeClause(null)).toBeNull();
  });

  it('nimmt zu den eigenen Teams immer die Vereinstermine dazu', () => {
    expect(teamScopeClause(['t1', 't2'])).toBe('team_id.is.null,team_id.in.(t1,t2)');
  });

  it('lässt bei einer leeren Liste nur die Vereinstermine übrig', () => {
    // Der springende Punkt: «in keinem Team» heisst nicht «in allen Teams».
    expect(teamScopeClause([])).toBe('team_id.is.null');
  });
});

import { describe, expect, it } from 'vitest';
import {
  composeTeamName,
  groupTeamsByArea,
  isFederationStale,
  isLinked,
  proposeLinks,
  toImportItems,
  validateNameAddition,
  validateTeamName,
} from './team';

const remote = [
  { id: '431869', name: 'Herren NLB', league: null },
  { id: '431870', name: 'Damen NLB', league: null },
  { id: '431872', name: 'Junioren U21 B', league: null },
];

describe('validateTeamName', () => {
  it('verlangt zwei Zeichen', () => {
    expect(validateTeamName('A')).toEqual(['nameMissing']);
    expect(validateTeamName('U9')).toEqual([]);
  });
});

describe('validateNameAddition (BR-176)', () => {
  it('lässt den Zusatz leer oder kurz', () => {
    expect(validateNameAddition('')).toEqual([]);
    expect(validateNameAddition('Sarnen')).toEqual([]);
    expect(validateNameAddition('x'.repeat(41))).toEqual(['additionTooLong']);
  });
});

describe('composeTeamName (BR-176)', () => {
  it('setzt Grundname und Zusatz zusammen – ohne Zusatz nur den Grundnamen', () => {
    expect(composeTeamName('Herren NLB', 'Sarnen')).toBe('Herren NLB Sarnen');
    expect(composeTeamName('Herren NLB', '  ')).toBe('Herren NLB');
  });
});

describe('isLinked / isFederationStale', () => {
  it('unterscheidet frei, verknüpft und veraltet (A6)', () => {
    expect(isLinked({ federation_team_id: null })).toBe(false);
    expect(isLinked({ federation_team_id: '1' })).toBe(true);
    expect(isFederationStale({ federation_team_id: '1', federation_stale_at: null })).toBe(false);
    expect(isFederationStale({ federation_team_id: '1', federation_stale_at: '2026-09-11' })).toBe(
      true,
    );
    // Ohne Verknüpfung ist nichts veraltet – auch wenn der Vermerk stehen blieb.
    expect(isFederationStale({ federation_team_id: null, federation_stale_at: '2026-09-11' })).toBe(
      false,
    );
  });
});

describe('proposeLinks (A1, Schritt 1)', () => {
  const teams = [
    { id: 't1', name: 'Herren NLB Sarnen', federation: 'swissunihockey', federation_team_id: '431869' },
    { id: 't2', name: 'damen  nlb', federation: null, federation_team_id: null },
    { id: 't3', name: 'Senioren', federation: null, federation_team_id: null },
  ];

  it('kennzeichnet verknüpfte, schlägt gleichnamige vor, legt den Rest neu an', () => {
    const proposals = proposeLinks(remote, teams, 'swissunihockey');
    expect(proposals.map((entry) => entry.status)).toEqual(['linked', 'match', 'new']);
    expect(proposals[0].teamName).toBe('Herren NLB Sarnen');
    expect(proposals[1].teamId).toBe('t2');
    expect(proposals[2].teamId).toBeNull();
  });

  it('schlägt ein Team nur einmal vor', () => {
    const twice = [remote[1], { id: '9', name: 'Damen NLB', league: null }];
    const proposals = proposeLinks(twice, teams, 'swissunihockey');
    expect(proposals.map((entry) => entry.status)).toEqual(['match', 'new']);
  });

  it('achtet auf den Verband: dieselbe Kennung bei einem anderen Verband zählt nicht', () => {
    const proposals = proposeLinks(remote, teams, 'swissvolley');
    expect(proposals[0].status).toBe('new');
  });
});

describe('toImportItems', () => {
  it('nimmt nur gewählte, noch nicht verknüpfte Einträge – mit Team bei einer Zuordnung', () => {
    const proposals = proposeLinks(
      remote,
      [{ id: 't2', name: 'Damen NLB', federation: null, federation_team_id: null }],
      'swissunihockey',
    );
    const items = toImportItems(proposals, new Set(['431869', '431870']));
    expect(items).toEqual([
      { federation_team_id: '431869', name: 'Herren NLB', league: null, team_id: null },
      { federation_team_id: '431870', name: 'Damen NLB', league: null, team_id: 't2' },
    ]);
  });
});

describe('groupTeamsByArea', () => {
  it('sortiert Bereiche alphabetisch, ohne Bereich zuletzt', () => {
    const groups = groupTeamsByArea([
      { name: 'B', area: null },
      { name: 'A', area: 'Junioren' },
      { name: 'C', area: 'Aktive' },
    ]);
    expect(groups.map((group) => group.area)).toEqual(['Aktive', 'Junioren', null]);
  });
});

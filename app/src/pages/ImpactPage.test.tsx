import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImpactPage } from './ImpactPage';
import { renderWithProviders } from '../test/utils';

/**
 * «Meine Wirkung» – der dritte Tab (UC-020, UC-024, UC-042).
 *
 * Geprüft wird hier, was der Umbau vom 16.09.2026 zusichert: Die Rangliste
 * verschwindet nicht, sie liegt eine Ebene tiefer; und die Vorschläge stehen
 * genau einmal auf der Seite. Das Zweite ist kein Schönheitsfehler: Die
 * Zielkarte zeigt nur, was das Saisonziel bewegt (BR-265), die allgemeine
 * Liste zeigt alle Säulen. Nebeneinander behaupteten sie voneinander, sie
 * zählten dasselbe.
 */

interface GoalStub {
  season: string;
  goal: number;
  earned: number;
  planned: number;
  remaining: number;
  state: 'reached' | 'onTrack' | 'behind';
}

let goal: GoalStub | null = null;

vi.mock('../hooks/useClub', () => ({
  useClub: () => ({
    activeClub: { id: 'c1', name: 'TV Musterhausen', season_start: '2026-08-01' },
    activeMembership: { id: 'm1', club_id: 'c1', display_name: 'Alex' },
  }),
}));

vi.mock('../hooks/useGamification', () => ({
  useMyPoints: () => ({ transactions: [], refetch: async () => {} }),
  useMyPointsSummary: () => ({
    data: { season: '2026/27', seasonPoints: 120, careerPoints: 480, bookingCount: 6 },
    isLoading: false,
    isSuccess: true,
    error: null,
    refetch: async () => {},
  }),
  useMyStreak: () => ({ data: 0, refetch: async () => {} }),
  useRuleLabels: () => ({ data: [] }),
  useNextContributions: () => ({
    data: [{ kind: 'task', refId: 't1', title: 'Matchbericht schreiben', whenAt: null, points: 25 }],
    isLoading: false,
    error: null,
    refetch: async () => {},
  }),
  // UC-024: Das Netzdiagramm ist der Kern des Tabs – ohne Werte zeichnet es
  // nichts, deshalb steht hier eine erhobene und eine nicht erhobene Dimension.
  useValueDimensions: () => ({
    data: [
      {
        dimension: 'volunteering',
        ownValue: 70,
        teamValue: 60,
        clubValue: 55,
        collected: true,
        groupSize: 12,
      },
      {
        dimension: 'finance',
        ownValue: null,
        teamValue: null,
        clubValue: null,
        collected: false,
        groupSize: 0,
      },
    ],
    isLoading: false,
    error: null,
    refetch: async () => {},
  }),
}));

vi.mock('../hooks/useContributionGoal', () => ({
  useMyContributionGoal: () => ({ data: goal, refetch: async () => {} }),
}));

/** Die Überschriften der Seite in ihrer Reihenfolge. */
const headings = (container: HTMLElement) =>
  [...container.querySelectorAll('ion-list-header')].map((node) => node.textContent?.trim());

describe('ImpactPage', () => {
  beforeEach(() => {
    goal = null;
  });

  it('führt zur Rangliste als Unterseite, nicht in einen anderen Tab', async () => {
    const { container } = renderWithProviders(<ImpactPage />, { route: '/tabs/impact' });

    const row = [...container.querySelectorAll('ion-item')].find(
      (node) => node.getAttribute('router-link') === '/tabs/impact/ranking',
    );
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain('Wie steht der Verein?');
  });

  it('zeigt die Vorschläge, solange keine Zielkarte sie trägt', () => {
    const { container } = renderWithProviders(<ImpactPage />, { route: '/tabs/impact' });

    expect(headings(container)).toContain('Nächste Punkte');
  });

  it('überlässt die Vorschläge der Zielkarte, sobald ein Ziel offen ist', () => {
    goal = {
      season: '2026/27',
      goal: 200,
      earned: 120,
      planned: 30,
      remaining: 80,
      state: 'behind',
    };

    const { container } = renderWithProviders(<ImpactPage />, { route: '/tabs/impact' });

    // BR-265: Unter dem Zielbalken steht die gefilterte Liste der Zielkarte –
    // eine zweite, ungefilterte daneben wäre dieselbe Aufgabe zweimal.
    expect(headings(container)).not.toContain('Nächste Punkte');
  });

  it('nennt eine Stärke und lässt «nicht erhoben» als Wort stehen', async () => {
    const { findByText, container } = renderWithProviders(<ImpactPage />, {
      route: '/tabs/impact',
    });

    // BR-101: Benannt wird eine Stärke, nie eine Lücke.
    await findByText('Deine stärkste Seite: Ehrenamt');
    // BR-103: «Finanzen» ist heute nicht erhoben – und steht als Wort da,
    // nicht als Null, die eine Leistung von null behaupten würde.
    expect(container.textContent).toContain('nicht erhoben');
    expect(container.textContent).not.toMatch(/Finanzen[^]{0,40}\b0\b/);
  });
});

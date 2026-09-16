import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContributionGoalCard } from './ContributionGoalCard';
import type { MyContributionGoal } from '../hooks/useContributionGoal';
import type { NextContribution } from '../hooks/useGamification';

/**
 * Die Fortschrittskarte (UC-042, FR-161).
 *
 * Vier Dinge hält dieser Test fest, und alle sind Haltung, nicht Kosmetik:
 * Ohne Ziel erscheint die Karte **gar nicht** (A2, A3, A7); wer sein Ziel
 * erreicht hat, bekommt keine Liste mehr, was er noch tun könnte (BR-201);
 * Eingeplantes steht neben dem Geleisteten, **ohne** in die Ampel zu gehen
 * (FR-198, BR-265); und die Vorschlagsliste fragt nur nach Beiträgen, die das
 * Ziel auch bewegen.
 */

const goal = vi.hoisted(() => ({ current: null as MyContributionGoal | null }));
const suggestions = vi.hoisted(() => ({ current: [] as NextContribution[] }));
const askedFor = vi.hoisted(() => ({ limit: 0, contributionOnly: false }));

vi.mock('../hooks/useContributionGoal', () => ({
  useMyContributionGoal: () => ({ data: goal.current }),
}));

vi.mock('../hooks/useGamification', () => ({
  useNextContributions: (limit: number, contributionOnly: boolean) => {
    askedFor.limit = limit;
    askedFor.contributionOnly = contributionOnly;
    return { data: suggestions.current };
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

describe('ContributionGoalCard', () => {
  beforeEach(() => {
    goal.current = null;
    suggestions.current = [];
  });

  it('rendert nichts, solange kein Ziel gilt (A2, A3, A7)', () => {
    const { container } = render(<ContributionGoalCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('zeigt Stand und Rest, solange das Ziel offen ist', () => {
    goal.current = {
      season: '2026/27',
      goal: 200,
      earned: 50,
      planned: 0,
      remaining: 150,
      state: 'open',
    };
    suggestions.current = [
      {
        kind: 'shift',
        refId: 'e1',
        title: 'Kiosk',
        detail: 'Heimrunde',
        points: 50,
        whenAt: '2026-11-01T17:00:00.000Z',
      },
    ];

    render(<ContributionGoalCard />);

    // §11 Nr. 18: die Zahl im Badge, der Wortlaut als aria-label.
    const badge = screen.getByLabelText(/seasonGoal\.my\.badgeLabel/);
    expect(badge.textContent).toBe('50/200');
    expect(screen.getByText(/seasonGoal\.my\.remaining/)).toBeTruthy();
    // Der Vorschlag steht unter dem Balken.
    expect(screen.getByText('Kiosk')).toBeTruthy();
  });

  it('nennt das Eingeplante, ohne es ins Abzeichen zu rechnen (FR-198)', () => {
    goal.current = {
      season: '2026/27',
      goal: 200,
      earned: 50,
      planned: 100,
      remaining: 150,
      state: 'open',
    };

    render(<ContributionGoalCard />);

    // Die Zahl steht als eigene Zeile.
    expect(screen.getByText(/seasonGoal\.my\.planned.*100/)).toBeTruthy();
    // Das Abzeichen zeigt weiterhin nur das Geleistete: Eine Zusage ist keine
    // Leistung, und 150/200 wäre eine Behauptung (BR-265).
    expect(screen.getByText('50/200')).toBeTruthy();
    // Und der Rest bleibt der Rest zum Ziel, nicht zum Eingeplanten.
    expect(screen.getByText(/seasonGoal\.my\.remaining.*150/)).toBeTruthy();
  });

  it('schweigt vom Eingeplanten, solange nichts zugesagt ist', () => {
    goal.current = {
      season: '2026/27',
      goal: 200,
      earned: 50,
      planned: 0,
      remaining: 150,
      state: 'open',
    };

    render(<ContributionGoalCard />);

    expect(screen.queryByText(/seasonGoal\.my\.planned/)).toBeNull();
  });

  it('fragt nur nach Vorschlägen, die aufs Ziel zählen (BR-265)', () => {
    goal.current = {
      season: '2026/27',
      goal: 200,
      earned: 50,
      planned: 0,
      remaining: 150,
      state: 'open',
    };

    render(<ContributionGoalCard />);

    // Ohne den Schalter schlüge die Karte Trainings vor und behauptete mit
    // ihrer Fussnote, sie zählten aufs Ziel.
    expect(askedFor.contributionOnly).toBe(true);
    expect(askedFor.limit).toBe(3);
  });

  it('lässt die Vorschläge weg, wenn das Ziel erreicht ist (BR-201)', () => {
    goal.current = {
      season: '2026/27',
      goal: 200,
      earned: 220,
      planned: 0,
      remaining: 0,
      state: 'reached',
    };
    suggestions.current = [
      {
        kind: 'task',
        refId: 't1',
        title: 'Matchbericht',
        detail: 'media',
        points: 20,
        whenAt: null,
      },
    ];

    render(<ContributionGoalCard />);

    expect(screen.getByText('seasonGoal.my.reached')).toBeTruthy();
    // Wer sein Ziel hat, bekommt keine Aufzählung mehr, was noch offen wäre.
    expect(screen.queryByText('Matchbericht')).toBeNull();
  });
});

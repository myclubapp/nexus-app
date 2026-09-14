import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContributionGoalCard } from './ContributionGoalCard';
import type { MyContributionGoal } from '../hooks/useContributionGoal';
import type { NextContribution } from '../hooks/useGamification';

/**
 * Die Fortschrittskarte (UC-042, FR-161).
 *
 * Zwei Dinge hält dieser Test fest, und beide sind Haltung, nicht Kosmetik:
 * Ohne Ziel erscheint die Karte **gar nicht** (A2, A3, A7), und wer sein Ziel
 * erreicht hat, bekommt keine Liste mehr, was er noch tun könnte (BR-201).
 */

const goal = vi.hoisted(() => ({ current: null as MyContributionGoal | null }));
const suggestions = vi.hoisted(() => ({ current: [] as NextContribution[] }));

vi.mock('../hooks/useContributionGoal', () => ({
  useMyContributionGoal: () => ({ data: goal.current }),
}));

vi.mock('../hooks/useGamification', () => ({
  useNextContributions: () => ({ data: suggestions.current }),
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

  it('lässt die Vorschläge weg, wenn das Ziel erreicht ist (BR-201)', () => {
    goal.current = {
      season: '2026/27',
      goal: 200,
      earned: 220,
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

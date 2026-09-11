/**
 * Die Weichen vor der angemeldeten App. Geprüft wird hier vor allem das
 * Zwischenbild: Es entscheidet, was jemand beim Kaltstart sekundenlang sieht,
 * und es fällt in keinem anderen Test auf, weil dort Sitzung und
 * Mitgliedschaft immer schon stehen.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { RequireAuth, RequireClub } from './RouteGuards';
import { SkeletonPage } from './Skeletons';
import { renderWithProviders } from '../test/utils';

const auth = { session: { user: { id: 'u1' } } as unknown, initialising: false };
const club = {
  memberships: [{ id: 'm1', club_id: 'c1' }],
  isLoading: false,
  error: null as Error | null,
  refetch: () => {},
};

vi.mock('../hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../hooks/useClub', () => ({ useClub: () => club }));

beforeEach(() => {
  auth.session = { user: { id: 'u1' } };
  auth.initialising = false;
  club.memberships = [{ id: 'm1', club_id: 'c1' }];
  club.isLoading = false;
  club.error = null;
});

describe('RequireClub', () => {
  it('zeigt das übergebene Skelett statt des Spinners, solange geladen wird', () => {
    club.isLoading = true;

    const { container } = renderWithProviders(
      <RequireClub pending={<SkeletonPage />}>
        <p>Tabs</p>
      </RequireClub>,
    );

    // Das Skelett steht – der Vollbild-Spinner nicht mehr (guidelines §4).
    expect(container.querySelectorAll('ion-skeleton-text').length).toBeGreaterThan(0);
    expect(container.querySelector('ion-spinner')).toBeNull();
    expect(screen.queryByText('Tabs')).not.toBeInTheDocument();
  });

  it('bleibt für Bedienhilfen als Ladezustand angesagt', () => {
    club.isLoading = true;

    renderWithProviders(
      <RequireClub pending={<SkeletonPage />}>
        <p>Tabs</p>
      </RequireClub>,
    );

    // Ein Skelett hat keinen Text; ohne die Rolle wäre das Warten stumm.
    expect(screen.getByRole('status')).toHaveAccessibleName('Wird geladen …');
  });

  it('fällt ohne `pending` auf den Spinner zurück', () => {
    club.isLoading = true;

    const { container } = renderWithProviders(
      <RequireClub>
        <p>Tabs</p>
      </RequireClub>,
    );

    expect(container.querySelector('ion-spinner')).not.toBeNull();
  });

  it('gibt den Inhalt frei, sobald eine Mitgliedschaft feststeht', () => {
    renderWithProviders(
      <RequireClub pending={<SkeletonPage />}>
        <p>Tabs</p>
      </RequireClub>,
    );

    expect(screen.getByText('Tabs')).toBeInTheDocument();
  });

  it('zeigt bei einem Fehler den Fehlerzustand, nicht das Skelett', () => {
    // Eine gescheiterte Abfrage ist keine leere Mitgliederliste: Ohne diese
    // Unterscheidung landet ein Mitglied bei jedem Netzfehler im
    // Gründungs-Wizard.
    club.error = new Error('Netz weg');

    const { container } = renderWithProviders(
      <RequireClub pending={<SkeletonPage />}>
        <p>Tabs</p>
      </RequireClub>,
    );

    expect(screen.getByText('Netz weg')).toBeInTheDocument();
    expect(container.querySelectorAll('ion-skeleton-text')).toHaveLength(0);
  });
});

describe('RequireAuth', () => {
  it('zeigt dasselbe Skelett wie RequireClub, solange die Sitzung gelesen wird', () => {
    // Beide Weichen liegen auf demselben Weg. Zwei verschiedene Zwischenbilder
    // hintereinander wären ein Flackern.
    auth.initialising = true;

    const { container } = renderWithProviders(
      <RequireAuth pending={<SkeletonPage />}>
        <p>Tabs</p>
      </RequireAuth>,
    );

    expect(container.querySelectorAll('ion-skeleton-text').length).toBeGreaterThan(0);
    expect(container.querySelector('ion-spinner')).toBeNull();
  });
});

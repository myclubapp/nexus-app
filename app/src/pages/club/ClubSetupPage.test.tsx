import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubSetupPage } from './ClubSetupPage';
import { ionProp, renderWithProviders } from '../../test/utils';
import type { ClubSettings } from '../../lib/database.types';
import type { FederationConnection } from '../../lib/federation';

/**
 * Der Einrichtungs-Assistent (UC-051).
 *
 * Geprüft wird, **was in welchem Schritt zu sehen ist** (docs/TESTING.md §1.4):
 * dass die Frage nach den Verbandsnews erst mit einer Verbindung auftaucht,
 * dass ein Verband ohne Newsschnittstelle keinen Schalter bekommt, und dass der
 * Assistent einen Ausstieg hat – BR-259: Er ist ein Angebot, keine Aufgabe.
 */

let isAdmin: boolean;
let connections: FederationConnection[];
let settings: ClubSettings | null;

const setNews = vi.fn();
const saveJoinPolicy = vi.fn();

vi.mock('../../hooks/useClub', () => ({
  useClub: () => ({
    isAdmin,
    activeClub: { id: 'c1', name: 'TV Musterhausen', slug: 'tv-muster', settings },
  }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ success: vi.fn(), failure: vi.fn() }),
}));

vi.mock('../../hooks/useFederation', () => ({
  useFederationConnections: () => ({ data: connections, refetch: vi.fn() }),
  useSetFederationNews: () => ({ mutate: setNews, isPending: false, error: null }),
  useCheckFederation: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useConnectFederation: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useFederationTeams: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  syncFederationNow: vi.fn(async () => ({ games: 0, error: null })),
}));

vi.mock('../../hooks/useClubSettings', () => ({
  useSaveJoinPolicy: () => ({ mutate: saveJoinPolicy, isPending: false, error: null }),
}));

vi.mock('../../hooks/useInvites', () => ({
  useTeams: () => ({ data: [], refetch: vi.fn() }),
  useCreateInvite: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  defaultInviteExpiry: () => '2026-10-01',
}));

vi.mock('../../hooks/useMembers', () => ({
  useCreateTeam: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

vi.mock('../../hooks/useTeamAdmin', () => ({
  useImportFederationTeams: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useUnlinkTeam: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

vi.mock('../../hooks/useSample', () => ({
  useSampleContent: () => ({ data: [] }),
  useDropSampleContent: () => ({ mutate: vi.fn(), isPending: false }),
}));

function connection(overrides: Partial<FederationConnection> = {}): FederationConnection {
  return {
    federation: 'swissunihockey',
    federationClubId: '463820',
    status: 'active',
    lastSyncAt: null,
    lastError: null,
    hasKey: false,
    newsEnabled: false,
    ...overrides,
  };
}

/** `ion-button` bekommt in jsdom keine ARIA-Rolle (docs/TESTING.md §1.1). */
function button(container: HTMLElement, label: string): Element | undefined {
  return Array.from(container.querySelectorAll('ion-button')).find(
    (element) => element.textContent?.trim() === label,
  );
}

/** Einen Schritt weiter – über den Knopf, den die Person drückt. */
function next(container: HTMLElement) {
  act(() => {
    (button(container, 'Weiter') as HTMLElement | undefined)?.click();
  });
}

describe('ClubSetupPage', () => {
  beforeEach(() => {
    isAdmin = true;
    connections = [];
    settings = null;
    vi.clearAllMocks();
  });

  it('weist ab, wer nicht im Vorstand ist', () => {
    isAdmin = false;
    const { container } = renderWithProviders(<ClubSetupPage />);
    // Das ist Bequemlichkeit, nicht der Schutz: Die Regeln stehen in `0101`,
    // `0102` und den Policies.
    expect(container.textContent).toContain('Nur der Vorstand');
    expect(container.querySelector('ion-progress-bar')).toBeNull();
  });

  it('führt ohne Verband durch vier Schritte (FR-195)', () => {
    const { container } = renderWithProviders(<ClubSetupPage />);
    expect(container.textContent).toContain('Schritt 1 von 4');
    expect(container.textContent).toContain('Hängt euer Verein an einem Verband?');
  });

  it('fragt nach den Verbandsnews, sobald ein Verband hängt (FR-197)', () => {
    connections = [connection()];
    const { container } = renderWithProviders(<ClubSetupPage />);

    expect(container.textContent).toContain('Schritt 1 von 5');
    next(container);
    // Unmittelbar hinter dem Schritt, der die Frage auslöst (UC-035, Schritt 7).
    expect(container.textContent).toContain('Auch die Verbandsnews?');
    expect(container.querySelector('ion-toggle')).not.toBeNull();
  });

  it('zeigt den Stand des Schalters, statt ihn zu erfinden', () => {
    connections = [connection({ newsEnabled: true })];
    const { container } = renderWithProviders(<ClubSetupPage />);
    next(container);

    expect(ionProp<boolean>(container.querySelector('ion-toggle')!, 'checked')).toBe(true);
  });

  it('gibt einem Verband ohne Newsschnittstelle keinen Schalter (BR-260)', () => {
    connections = [connection({ federation: 'swisshandball' })];
    const { container } = renderWithProviders(<ClubSetupPage />);
    next(container);

    // Ein Schalter, der nichts bewirkt, wäre ein Versprechen ohne Deckung.
    expect(container.querySelector('ion-toggle')).toBeNull();
    expect(container.textContent).toContain('Dieser Verband liefert keine Beiträge.');
  });

  it('hat einen Ausstieg – die Einrichtung ist ein Angebot (BR-259)', () => {
    const { container } = renderWithProviders(<ClubSetupPage />);
    expect(button(container, 'Später einrichten')).toBeDefined();
  });

  it('zeigt im Mitglieder-Schritt den Stand der offenen Anfragen (FR-196)', () => {
    settings = { join: { public: true } };
    const { container } = renderWithProviders(<ClubSetupPage />);
    next(container);
    next(container);
    next(container);

    expect(container.textContent).toContain('Wie kommen die Mitglieder herein?');
    const toggles = container.querySelectorAll('ion-toggle');
    expect(ionProp<boolean>(toggles[toggles.length - 1], 'checked')).toBe(true);
    // Der Kurzname steht dabei, weil er das ist, was jemand kennen muss.
    expect(container.textContent).toContain('tv-muster');
  });
});

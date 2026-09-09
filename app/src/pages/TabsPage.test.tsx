/**
 * Der Tab-Rahmen als Ganzes: Er ist die einzige Stelle, an der zwei
 * Ionic-Outlets ineinander liegen, und genau dort entsteht ein Fehler, den
 * kein Komponententest sieht – die Seite steht vollständig im DOM, trägt aber
 * `ion-page-invisible` und wird nie eingeblendet. Sichtbar bleibt nur der
 * Tab-Balken; jeder Screen ist weiss. Deshalb prüft dieser Test nicht nur,
 * dass die Seite gerendert wird, sondern dass keine Seite unsichtbar bleibt.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import i18n from '../i18n';

// Der Test misst den Router, nicht das Backend: Anmeldung und Mitgliedschaft
// sind gesetzt, alle Datenquellen liefern leer.
vi.mock('../hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    session: { user: { id: 'u1' } },
    user: { id: 'u1' },
    initialising: false,
    authError: null,
    clearAuthError: () => {},
    signInWithMagicLink: async () => {},
    signInWithPassword: async () => {},
    setPassword: async () => {},
    signOut: async () => {},
  }),
}));

vi.mock('../hooks/useClub', () => ({
  ClubProvider: ({ children }: { children: ReactNode }) => children,
  useClub: () => ({
    memberships: [{ id: 'm1', club_id: 'c1', club: { id: 'c1', name: 'Testverein' } }],
    activeMembership: { display_name: 'Alex', role: 'board' },
    activeClub: { id: 'c1', name: 'Testverein' },
    isLoading: false,
    error: null,
    refetch: () => {},
    setActiveClub: () => {},
    isAdmin: true,
    isTrainer: false,
    eventLabel: (type: string) => type,
  }),
}));

const emptyQuery = { data: [], isLoading: false, error: null, refetch: async () => {} };

vi.mock('../hooks/useGamification', () => ({
  useMyPoints: () => ({
    transactions: [],
    isLoading: false,
    error: null,
    refetch: async () => {},
  }),
  useMyPointsSummary: () => ({
    data: { season: '2026/27', seasonPoints: 0, careerPoints: 0, bookingCount: 0 },
    isLoading: false,
    isSuccess: true,
    error: null,
    refetch: async () => {},
  }),
  useNextContributions: () => emptyQuery,
  usePointRules: () => emptyQuery,
  useRuleLabels: () => emptyQuery,
  useLeaderboard: () => emptyQuery,
  useMyTeams: () => emptyQuery,
  useAllPoints: () => emptyQuery,
}));
// Seit UC-017 liegen die Aufgaben-Hooks in einem eigenen Modul.
vi.mock('../hooks/useTasks', () => ({
  useTasks: () => emptyQuery,
  useMyTaskCount: () => ({ data: 0, isLoading: false, error: null }),
  useMyKudos: () => emptyQuery,
  useClaimTask: () => ({ mutate: () => {}, isPending: false, error: null }),
  usePublishTask: () => ({ mutate: () => {}, isPending: false, error: null }),
  useSubmitTask: () => ({ mutate: () => {}, isPending: false, error: null }),
  useReleaseTask: () => ({ mutate: () => {}, isPending: false, error: null }),
  useConfirmTask: () => ({ mutate: () => {}, isPending: false, error: null }),
  useRejectTask: () => ({ mutate: () => {}, isPending: false, error: null }),
  useTaskRoster: () => emptyQuery,
}));
vi.mock('../hooks/useAgenda', () => ({
  useAgenda: () => emptyQuery,
  useRespondToEvent: () => ({ mutate: () => {}, isPending: false }),
  useCheckIn: () => ({ mutate: () => {}, isPending: false }),
}));
vi.mock('../hooks/useNews', () => ({
  useNews: () => emptyQuery,
  useInbox: () => emptyQuery,
  useMarkNotificationRead: () => ({ mutate: () => {}, isPending: false }),
  // Seit UC-026 schreibt und verwaltet das Dashboard News.
  usePublishNews: () => ({ mutate: () => {}, isPending: false, error: null }),
  useUpdateNews: () => ({ mutate: () => {}, isPending: false, error: null }),
  useRetractNews: () => ({ mutate: () => {}, isPending: false, error: null }),
}));
// Die Seitenleiste hängt am ganzen App-Rahmen und fragt die offenen
// Beitrittsgesuche ab, sobald jemand Vorstand ist.
vi.mock('../hooks/useJoinRequests', () => ({
  usePendingJoinRequests: () => emptyQuery,
}));

const { default: App } = await import('../App');

function renderAppAt(path: string) {
  window.history.replaceState({}, '', path);
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <App />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('TabsPage', () => {
  it('blendet die Seite im verschachtelten Outlet tatsächlich ein', async () => {
    const { container } = renderAppAt('/tabs/dashboard');

    // Der Tab-Balken liegt ausserhalb der Seite und erscheint auch dann, wenn
    // die Seite unsichtbar bleibt – er allein beweist also nichts.
    // Grosszügige Frist wie unten: Mit der Seitenleiste im Rahmen hydratisiert
    // Ionic in jsdom spürbar mehr Komponenten, bevor der Balken steht.
    await waitFor(() => expect(container.querySelector('ion-tab-bar')).toBeTruthy(), {
      timeout: 5000,
    });

    expect(await screen.findByText('Hallo Alex')).toBeInTheDocument();

    await waitFor(
      () => expect(container.querySelectorAll('.ion-page-invisible')).toHaveLength(0),
      { timeout: 5000 },
    );
  }, 20000);

  it('reicht dem IonSplitPane sein Hauptfeld als direktes Kind', async () => {
    // `IonSplitPane` sucht das Hauptfeld ausschliesslich unter seinen direkten
    // Kindern und vergleicht deren `id` mit `contentId`. Findet es keines,
    // bleibt es bei einer Warnung auf der Konsole – die Seitenleiste legt sich
    // dann ab lg über den Inhalt, statt neben ihm zu stehen.
    const { container } = renderAppAt('/tabs/dashboard');

    const splitPane = await waitFor(() => {
      const pane = container.querySelector('ion-split-pane');
      expect(pane).toBeTruthy();
      return pane!;
    });

    expect(splitPane.querySelector(':scope > #main')?.tagName.toLowerCase()).toBe(
      'ion-router-outlet',
    );
    expect(splitPane.querySelector(':scope > ion-menu')).toBeTruthy();
  }, 20000);
});

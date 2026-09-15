/**
 * Der Tab-Rahmen als Ganzes: Er ist die einzige Stelle, an der zwei
 * Ionic-Outlets ineinander liegen, und genau dort entsteht ein Fehler, den
 * kein Komponententest sieht – die Seite steht vollständig im DOM, trägt aber
 * `ion-page-invisible` und wird nie eingeblendet. Sichtbar bleibt nur der
 * Tab-Balken; jeder Screen ist weiss. Deshalb prüft dieser Test nicht nur,
 * dass die Seite gerendert wird, sondern dass keine Seite unsichtbar bleibt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { act, useSyncExternalStore, type ReactNode } from 'react';
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

// Die Mitgliedschaft liegt hinter einem winzigen Speicher statt in einem
// festen Objekt: Nur so lässt sich der Übergang «lädt noch» -> «da» mitten im
// Lauf auslösen, den der dritte Test braucht.
interface ClubState {
  memberships: { id: string; club_id: string; club: { id: string; name: string } }[];
  activeMembership: { display_name: string; role: string } | null;
  activeClub: { id: string; name: string } | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  setActiveClub: () => void;
  isAdmin: boolean;
  isTrainer: boolean;
  eventLabel: (type: string) => string;
}

const loadedClub: ClubState = {
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
};
const loadingClub: ClubState = {
  ...loadedClub,
  memberships: [],
  activeMembership: null,
  activeClub: null,
  isLoading: true,
};

let clubSnapshot: ClubState = loadedClub;
const clubListeners = new Set<() => void>();

function setClub(next: ClubState) {
  clubSnapshot = next;
  clubListeners.forEach((listener) => listener());
}

vi.mock('../hooks/useClub', () => ({
  ClubProvider: ({ children }: { children: ReactNode }) => children,
  useClub: () =>
    useSyncExternalStore(
      (listener: () => void) => {
        clubListeners.add(listener);
        return () => clubListeners.delete(listener);
      },
      () => clubSnapshot,
    ),
}));

const emptyQuery = { data: [], isLoading: false, error: null, refetch: async () => {} };

vi.mock('../hooks/useGamification', () => ({
  useMyStreak: () => ({ data: 0, isLoading: false, error: null }),
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
  useUpdateTask: () => ({ mutateAsync: async () => {}, isPending: false, error: null }),
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
  beforeEach(() => setClub(loadedClub));

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

  /**
   * Der Weg, auf dem nach der Anmeldung «manchmal» ein schwarzer Bildschirm
   * stand: Die Weiche tauscht im selben Route-Element ihr Zwischenbild gegen
   * `TabsPage` (siehe `DetachedPage`).
   *
   * **Was dieser Test nicht leistet:** Die Unsichtbarkeit selbst fängt er
   * nicht. Sie entsteht aus Ionics Seitenübergang, und der läuft in jsdom
   * nicht – mit und ohne `detached` ist das DOM identisch. Geprüft ist hier
   * nur, dass der Tausch überhaupt zum Ziel führt. Belegt wurde der Fehler im
   * Browser: `div.ion-page` statt `IonPage` als Zwischenbild, gemessen über
   * Verzögerungen von 30 bis 2000 ms.
   */
  it('kommt über das Zwischenbild hinweg bei den Tabs an', async () => {
    setClub(loadingClub);
    const { container } = renderAppAt('/tabs/dashboard');

    // Erst das Skelett – die Tabs gibt es noch nicht.
    await waitFor(() => expect(container.querySelector('ion-skeleton-text')).toBeTruthy(), {
      timeout: 5000,
    });

    // Und jetzt kommen die Mitgliedschaften an, mitten im Übergang.
    await act(async () => {
      setClub(loadedClub);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(await screen.findByText('Hallo Alex', undefined, { timeout: 5000 })).toBeInTheDocument();
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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';
import { renderWithProviders } from '../test/utils';

/**
 * Die Profilseite ist der zweite Einhängepunkt von `ClubAdminLinks` – der
 * erste ist die Seitenleiste (`AppMenu.test.tsx`).
 *
 * Geprüft wird hier nur, was FR-148 zusichert: Die Verwaltungswege stehen in
 * einer **eigenen** Gruppe mit eigener Überschrift und nicht zwischen den
 * persönlichen Einstellungen. Ohne diese Trennung liest sich «Mitglieder» wie
 * eine Option des eigenen Kontos.
 *
 * Die Rollenabfrage ist Bequemlichkeit, kein Schutz: Wer die Wege trotzdem
 * aufruft, läuft in `is_club_admin()` und die RLS-Policies.
 */

interface ClubStub {
  isAdmin: boolean;
  isTrainer: boolean;
  /** Seit UC-034 hängt jeder Modulweg an einem Schalter (FR-115). */
  settings: { modules?: Record<string, boolean> };
}

let club: ClubStub;

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    setPassword: vi.fn(),
    user: { email: 'alex@example.ch' },
  }),
}));

vi.mock('../hooks/useClub', () => ({
  useClub: () => ({
    ...club,
    activeClub: { id: 'c1', name: 'TV Musterhausen', settings: club.settings },
    activeMembership: {
      club_id: 'c1',
      display_name: 'Alex',
      member_since: '2026-01-01',
      leaderboard_opt_in: true,
    },
    memberships: [{ club_id: 'c1', club: { name: 'TV Musterhausen' } }],
    setActiveClub: () => {},
  }),
}));

vi.mock('../hooks/useGamification', () => ({
  useMyPoints: () => ({ transactions: [] }),
  useRuleLabels: () => ({ data: [] }),
  // UC-042: Die Fortschrittskarte holt sich die Vorschläge von hier.
  useNextContributions: () => ({ data: [] }),
}));

// UC-042: Ohne Ziel rendert die Karte nichts – das ist der Normalfall dieser
// Seite und deshalb die Voreinstellung der Attrappe (A2, A3, A7).
vi.mock('../hooks/useContributionGoal', () => ({
  useMyContributionGoal: () => ({ data: null }),
}));

vi.mock('../hooks/useTasks', () => ({
  useMyKudos: () => ({ data: [] }),
}));

vi.mock('../hooks/useProfile', () => ({
  useLeaderboardOptIn: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../hooks/useJoinRequests', () => ({
  usePendingJoinRequests: () => ({ data: [], isLoading: false, error: null }),
}));

/** Die Überschriften der Seite in ihrer Reihenfolge. */
const headings = (container: HTMLElement) =>
  [...container.querySelectorAll('ion-list-header')].map((node) =>
    node.textContent?.trim(),
  );

/**
 * Die Ziele einer Gruppe. `ion-list-header` steht als Geschwister **vor**
 * seiner `ion-list`, nicht darin – die Zuordnung läuft deshalb über die
 * Reihenfolge der Kinder, nicht über eine Verschachtelung.
 */
function sectionLinks(container: HTMLElement, title: string): string[] {
  const headers = [...container.querySelectorAll('ion-list-header')];
  const header = headers.find((node) => node.textContent?.trim() === title);
  if (!header) return [];
  const list = header.nextElementSibling;
  if (!list || list.tagName.toLowerCase() !== 'ion-list') return [];
  return [...list.querySelectorAll('[router-link]')].map(
    (node) => node.getAttribute('router-link') ?? '',
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    // Alle Module an: Dieser Test prüft die Gliederung nach FR-148, nicht die
    // Modulschalter – die haben ihre eigenen Fälle weiter unten.
    club = {
      isAdmin: false,
      isTrainer: false,
      settings: {
        modules: { voice: true, meeting: true, checkin: true, pulse: true, health: true },
      },
    };
  });

  it('zeigt ohne Rolle keinen Verwaltungs-Abschnitt', () => {
    const { container } = renderWithProviders(<ProfilePage />);

    expect(headings(container)).not.toContain('Verwaltung');

    // Die persönlichen Wege bleiben, die des Vorstands fehlen. Der erste
    // Vergleich ist nicht Beiwerk: Ohne ihn wäre der zweite auch dann grün,
    // wenn `sectionLinks` gar nichts fände.
    const settings = sectionLinks(container, 'Einstellungen');
    expect(settings).toContain('/tabs/profile/voice');
    expect(settings).not.toContain('/tabs/profile/members');
  });

  it('trennt die Verwaltung des Vorstands von den Einstellungen (FR-148)', () => {
    club.isAdmin = true;
    const { container } = renderWithProviders(<ProfilePage />);

    // Eigene Gruppe, gleich benannt wie in der Seitenleiste.
    expect(headings(container)).toContain('Verwaltung');

    const administration = sectionLinks(container, 'Verwaltung');
    expect(administration).toEqual([
      '/tabs/profile/health',
      '/tabs/profile/pulse',
      '/tabs/profile/club',
      '/tabs/profile/members',
      '/tabs/profile/teams',
      // Seit UC-031: die Ämter – der Verteiler hinter jedem Gremium (BR-133).
      '/tabs/profile/offices',
      '/tabs/profile/rules',
      '/tabs/profile/news',
      '/tabs/profile/federation',
      // Seit UC-040: die bisherige myclub-App, bis der Verein ganz hier ist.
      '/tabs/profile/legacy',
      '/tabs/profile/invite',
      '/tabs/profile/requests',
    ]);

    // Und kein einziger davon steht mehr unter den Einstellungen – die
    // eigenen Wege stehen dort weiterhin.
    const settings = sectionLinks(container, 'Einstellungen');
    expect(settings).toContain('/tabs/profile/voice');
    for (const link of administration) {
      expect(settings).not.toContain(link);
    }
  });

  it('gibt Trainer:innen die eigene Gruppe mit nur der Vereins-Gesundheit', () => {
    // BR-096: Die Hinweise ihres Teams gehören ihnen, die Vereinsverwaltung
    // nicht. Der Abschnitt erscheint trotzdem – sonst wäre der Weg dorthin
    // wieder gebaut und unerreichbar.
    club.isTrainer = true;
    const { container } = renderWithProviders(<ProfilePage />);

    expect(headings(container)).toContain('Verwaltung');
    expect(sectionLinks(container, 'Verwaltung')).toEqual(['/tabs/profile/health']);
  });

  it('zeigt keinen Modulweg, solange das Modul aus ist (UC-034, FR-115)', () => {
    // Ein neuer Verein startet ohne Module (K7). Was nicht eingeschaltet ist,
    // hat auch keinen Weg – gesperrt ist es am Server (`module_enabled()`).
    club.isAdmin = true;
    club.settings = { modules: {} };
    const { container } = renderWithProviders(<ProfilePage />);

    const administration = sectionLinks(container, 'Verwaltung');
    expect(administration).not.toContain('/tabs/profile/health');
    expect(administration).not.toContain('/tabs/profile/pulse');
    expect(administration).not.toContain('/tabs/profile/offices');
    // Was kein Modul ist, bleibt: Vereinsdaten, Mitglieder, Regeln.
    expect(administration).toContain('/tabs/profile/members');

    const settings = sectionLinks(container, 'Einstellungen');
    expect(settings).not.toContain('/tabs/profile/voice');
    expect(settings).not.toContain('/tabs/profile/meeting');
    expect(settings).not.toContain('/tabs/profile/mood');
  });

  it('lässt Trainer:innen ohne das Modul «Gesundheit» ganz ohne Abschnitt', () => {
    // Sonst bliebe eine Überschrift «Verwaltung» über einer leeren Liste
    // stehen – `hasAdminLinks()` fängt genau das ab.
    club.isTrainer = true;
    club.settings = { modules: {} };
    const { container } = renderWithProviders(<ProfilePage />);

    expect(headings(container)).not.toContain('Verwaltung');
  });
});

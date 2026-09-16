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
    // Seit FR-178 heisst die Gruppe des Vorstands nicht mehr «Verwaltung» –
    // ohne diese Zeile wäre der Fall grün, sobald die Wege unter einer der
    // neuen Überschriften stünden.
    expect(headings(container)).not.toContain('Menschen');

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

    // Eigene Gruppen, gleich benannt wie in der Seitenleiste – sie kommen aus
    // `ClubAdminLinks` und nicht von der Seite.
    const administration = [
      ...sectionLinks(container, 'Überblick'),
      ...sectionLinks(container, 'Menschen'),
      ...sectionLinks(container, 'Punkte & Geld'),
      ...sectionLinks(container, 'Verein'),
      ...sectionLinks(container, 'Anschlüsse'),
    ];
    expect(administration).not.toHaveLength(0);

    // Kein einziger davon steht unter den Einstellungen – die eigenen Wege
    // stehen dort weiterhin.
    const settings = sectionLinks(container, 'Einstellungen');
    expect(settings).toContain('/tabs/profile/voice');
    for (const link of administration) {
      expect(settings).not.toContain(link);
    }
  });

  it('gliedert die Verwaltung nach Sachgebiet (FR-178)', () => {
    // Vierzehn Wege in einer Gruppe sind keine Gliederung, sondern die
    // Reihenfolge, in der sie gebaut wurden. Wer «Ämter» sucht, sucht
    // Menschen; wer den Verband anschliesst, sucht einen Anschluss.
    club.isAdmin = true;
    const { container } = renderWithProviders(<ProfilePage />);

    expect(headings(container)).not.toContain('Verwaltung');

    expect(sectionLinks(container, 'Überblick')).toEqual([
      '/tabs/profile/health',
      '/tabs/profile/pulse',
    ]);
    expect(sectionLinks(container, 'Menschen')).toEqual([
      '/tabs/profile/members',
      // Seit UC-045 auch für Trainer:innen – beim Vorstand steht der Weg in
      // derselben Gruppe.
      '/tabs/profile/teams',
      // Seit UC-031: die Ämter – der Verteiler hinter jedem Gremium (BR-133).
      '/tabs/profile/offices',
      '/tabs/profile/invite',
      '/tabs/profile/requests',
    ]);
    // Saisonziel und Rechnungen hängen an Modulen, die hier aus sind.
    expect(sectionLinks(container, 'Punkte & Geld')).toEqual(['/tabs/profile/rules']);
    expect(sectionLinks(container, 'Verein')).toEqual([
      '/tabs/profile/club',
      // Seit UC-051: der Einrichtungs-Assistent, kein Modul – er steht immer.
      '/tabs/profile/setup',
    ]);
    expect(sectionLinks(container, 'Anschlüsse')).toEqual([
      '/tabs/profile/news',
      '/tabs/profile/federation',
      // Seit UC-040: die bisherige myclub-App, bis der Verein ganz hier ist.
      '/tabs/profile/legacy',
    ]);
  });

  it('nennt den Weg zu den Vereinsdaten wie die Seite dahinter', () => {
    // «Verein verwalten» stand als Verb über einer Liste von Substantiven und
    // las sich deshalb wie die Gruppe über allem anderen – geöffnet kam aber
    // ein Blatt neben den übrigen, und erst noch unter anderem Namen.
    club.isAdmin = true;
    const { container } = renderWithProviders(<ProfilePage />);

    const club_ = [...container.querySelectorAll('ion-item')].find(
      (item) => item.getAttribute('router-link') === '/tabs/profile/club',
    );
    expect(club_).toHaveTextContent('Vereinseinstellungen');
    expect(club_).not.toHaveTextContent('Verein verwalten');
  });

  it('gibt Trainer:innen die eigene Gruppe mit Gesundheit und Teams', () => {
    // BR-096: Die Hinweise ihres Teams gehören ihnen, die Vereinsverwaltung
    // nicht. Seit UC-043/UC-045 kommt die Teamliste dazu – dort exportieren
    // sie ihr Kader und setzen das Teambild. Der Abschnitt erscheint
    // ohnehin – sonst wäre der Weg dorthin gebaut und unerreichbar.
    club.isTrainer = true;
    const { container } = renderWithProviders(<ProfilePage />);

    expect(headings(container)).toContain('Verwaltung');
    expect(sectionLinks(container, 'Verwaltung')).toEqual([
      '/tabs/profile/health',
      '/tabs/profile/teams',
    ]);
  });

  it('zeigt keinen Modulweg, solange das Modul aus ist (UC-034, FR-115)', () => {
    // Ein neuer Verein startet ohne Module (K7). Was nicht eingeschaltet ist,
    // hat auch keinen Weg – gesperrt ist es am Server (`module_enabled()`).
    club.isAdmin = true;
    club.settings = { modules: {} };
    const { container } = renderWithProviders(<ProfilePage />);

    // FR-178: «Überblick» führt nur Modulwege – sind beide aus, entfällt die
    // Gruppe samt Überschrift, statt als leere Liste stehen zu bleiben.
    expect(headings(container)).not.toContain('Überblick');
    expect(sectionLinks(container, 'Menschen')).not.toContain('/tabs/profile/offices');
    // Was kein Modul ist, bleibt: Vereinsdaten, Mitglieder, Regeln.
    expect(sectionLinks(container, 'Menschen')).toContain('/tabs/profile/members');
    expect(sectionLinks(container, 'Verein')).toEqual([
      '/tabs/profile/club',
      // Seit UC-051: der Einrichtungs-Assistent, kein Modul – er steht immer.
      '/tabs/profile/setup',
    ]);
    expect(sectionLinks(container, 'Punkte & Geld')).toEqual(['/tabs/profile/rules']);

    const settings = sectionLinks(container, 'Einstellungen');
    expect(settings).not.toContain('/tabs/profile/voice');
    expect(settings).not.toContain('/tabs/profile/meeting');
    expect(settings).not.toContain('/tabs/profile/mood');
  });

  it('lässt Trainer:innen ohne das Modul «Gesundheit» die Teams', () => {
    // Bis UC-045 hing ihre Gruppe am Gesundheitsmodul und verschwand ohne es
    // ganz. Jetzt bleibt die Teamliste – eine Überschrift über einer leeren
    // Liste entsteht dabei nicht, weil immer mindestens dieser Weg steht.
    club.isTrainer = true;
    club.settings = { modules: {} };
    const { container } = renderWithProviders(<ProfilePage />);

    expect(headings(container)).toContain('Verwaltung');
    expect(sectionLinks(container, 'Verwaltung')).toEqual(['/tabs/profile/teams']);
  });
});

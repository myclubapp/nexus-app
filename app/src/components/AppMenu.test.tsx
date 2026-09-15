import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppMenu, APP_CONTENT_ID } from './AppMenu';
import { ionProp, renderWithProviders } from '../test/utils';

const signOut = vi.fn();

interface ClubStub {
  activeClub: {
    id: string;
    name: string;
    settings?: { modules?: Record<string, boolean>; logoUrl?: string };
  } | null;
  memberships: { club_id: string; club: { name: string } }[];
  isAdmin: boolean;
  isTrainer: boolean;
}

let club: ClubStub;

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ signOut, user: { email: 'alex@example.ch' } }),
}));

vi.mock('../hooks/useClub', () => ({
  useClub: () => ({
    ...club,
    activeMembership: club.memberships[0]
      ? { ...club.memberships[0], display_name: 'Alex' }
      : null,
    setActiveClub: () => {},
  }),
}));

vi.mock('../hooks/useJoinRequests', () => ({
  usePendingJoinRequests: () => ({ data: [{ id: 'r1' }], isLoading: false, error: null }),
}));

/**
 * Die Seitenleiste ist die einzige Ansicht, die auf dem Telefon und auf dem
 * Laptop unterschiedlich erscheint.
 *
 * Zwei ihrer Zusicherungen prüfen die **Quelle** statt das DOM, und das mit
 * Absicht: `contentId` am `ion-menu` und `autoHide` am `ion-menu-toggle`
 * kommen in jsdom nicht an (docs/TESTING.md §«Was Ionic in jsdom anders
 * macht», Punkt 1). `ionProp()` läse dort Stencils Vorgabe und hielte sie für
 * die eigene Absicht – bei `autoHide` wäre das ausgerechnet `true`, also das
 * Gegenteil dessen, was hier stehen muss.
 */
// Vitest läuft mit `app/` als Wurzel; `import.meta.url` ist unter jsdom keine
// file:-URL und taugt hier nicht als Anker.
const source = (file: string) => readFileSync(`${process.cwd()}/src/${file}`, 'utf8');
const menuSource = source('components/AppMenu.tsx');
const appSource = source('App.tsx');

describe('AppMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    club = {
      activeClub: {
        id: 'c1',
        name: 'TV Musterhausen',
        // Alle Module an: Dieser Test prüft die Navigation, nicht die
        // Modulschalter – die haben ihren eigenen Fall.
        settings: {
          modules: { voice: true, meeting: true, checkin: true, pulse: true, health: true },
        },
      },
      memberships: [{ club_id: 'c1', club: { name: 'TV Musterhausen' } }],
      isAdmin: false,
      isTrainer: false,
    };
  });

  it('bleibt ohne Verein leer', () => {
    // Ohne angemeldetes Menü blendet der IonMenuButton in der Kopfzeile sich
    // selbst aus – so bleibt der Anmeldebildschirm ohne Menüknopf.
    club.activeClub = null;
    const { container } = renderWithProviders(<AppMenu />);
    expect(container.querySelector('ion-menu')).toBeNull();
  });

  it('entsteht mit dem aktiven Verein', () => {
    const { container } = renderWithProviders(<AppMenu />);
    expect(container.querySelector('ion-menu')).not.toBeNull();
  });

  it('teilt sich mit dem IonSplitPane dieselbe Kennung des Hauptbereichs', () => {
    // Menü und Split-Pane müssen auf dasselbe Element zeigen; der Split-Pane
    // sucht es zudem nur unter seinen direkten Kindern (TabsPage.test.tsx).
    expect(APP_CONTENT_ID).toBeTruthy();
    expect(menuSource).toContain('contentId={APP_CONTENT_ID}');
    expect(appSource).toContain('contentId={APP_CONTENT_ID}');
    expect(appSource).toContain('id={APP_CONTENT_ID}');
  });

  it('hält den Inhalt sichtbar, wenn das Menü als Spalte steht', () => {
    // Ohne autoHide={false} blendet Ionic jeden Umschalter aus, sobald das
    // Menü kein Overlay mehr ist – die Spalte auf dem Laptop wäre dann leer.
    const toggles = menuSource.match(/<IonMenuToggle/g) ?? [];
    const guarded = menuSource.match(/<IonMenuToggle autoHide=\{false\}>/g) ?? [];
    expect(toggles.length).toBeGreaterThan(0);
    expect(guarded).toHaveLength(toggles.length);
  });

  it('zeigt die Verwaltungswege nur dem Vorstand', () => {
    const { container, unmount } = renderWithProviders(<AppMenu />);
    expect(routerLinks(container)).toEqual(['/tabs/profile']);
    unmount();

    club.isAdmin = true;
    const asAdmin = renderWithProviders(<AppMenu />);
    // Seit FR-178 nach Sachgebiet gegliedert statt in der Reihenfolge, in der
    // die Wege gebaut wurden. Die Gliederung ist dieselbe wie auf der
    // Profilseite – sie kommt aus `ClubAdminLinks`, nicht von hier.
    expect(routerLinks(asAdmin.container)).toEqual([
      '/tabs/profile',
      // Überblick: angeschaut, nicht bearbeitet (UC-023, UC-027).
      '/tabs/profile/health',
      '/tabs/profile/pulse',
      // Menschen: wer im Verein ist und wer dazukommt.
      '/tabs/profile/members',
      // Seit UC-045 auch für Trainer:innen – hier beim Vorstand in derselben
      // Gruppe.
      '/tabs/profile/teams',
      // Seit UC-031: die Ämter – der Verteiler hinter jedem Gremium (BR-133).
      '/tabs/profile/offices',
      '/tabs/profile/invite',
      '/tabs/profile/requests',
      // Punkte & Geld: Saisonziel und Rechnungen hängen an Modulen, die in
      // dieser Attrappe aus sind – die Regeln stehen immer.
      '/tabs/profile/rules',
      // Der Verein als Objekt.
      '/tabs/profile/club',
      // Seit UC-051: die Einrichtung, die durch Verband, Teams,
      // Beispielinhalte und Mitglieder führt.
      '/tabs/profile/setup',
      // Anschlüsse: was von aussen hereinkommt (UC-035, UC-040).
      '/tabs/profile/news',
      '/tabs/profile/federation',
      '/tabs/profile/legacy',
    ]);
  });

  it('überschreibt jede Verwaltungsgruppe (FR-178)', () => {
    // Die Überschriften sind der ganze Zweck der Gliederung: Ohne sie steht
    // «Mitglieder» neben «Verband verbinden» ohne erkennbaren Grund.
    club.isAdmin = true;
    const { container } = renderWithProviders(<AppMenu />);

    expect(headings(container)).toEqual([
      'Überblick',
      'Menschen',
      'Punkte & Geld',
      'Verein',
      'Anschlüsse',
      // Die persönlichen Einstellungen bleiben, wo sie waren.
      'Einstellungen',
    ]);
  });

  it('zeigt Trainer:innen Gesundheit und Teams, aber nichts vom Vorstand', () => {
    // BR-096: Trainer:innen sehen die Hinweise ihres Teams. Seit UC-043/UC-045
    // führen sie ihre Teams auch selbst – Kader exportieren, Teambild setzen.
    // Die Vereinsverwaltung bleibt trotzdem beim Vorstand.
    club.isAdmin = false;
    club.isTrainer = true;
    const { container } = renderWithProviders(<AppMenu />);

    expect(routerLinks(container)).toEqual([
      '/tabs/profile',
      '/tabs/profile/health',
      '/tabs/profile/teams',
    ]);

    // FR-178: Für sie bleibt die Liste flach unter «Verwaltung». Zwei
    // Überschriften über je einer Zeile gliedern nichts, sie zerreissen nur.
    expect(headings(container)).toContain('Verwaltung');
    expect(headings(container)).not.toContain('Menschen');
  });

  it('zeigt keinen Modulweg, solange das Modul aus ist (UC-034, FR-115)', () => {
    // Ein neuer Verein startet ohne Module (K7). Was nicht eingeschaltet ist,
    // hat auch keinen Weg.
    club.isAdmin = true;
    club.activeClub = { id: 'c1', name: 'TV Musterhausen', settings: { modules: {} } };
    const { container } = renderWithProviders(<AppMenu />);

    const links = routerLinks(container);
    expect(links).not.toContain('/tabs/profile/health');
    expect(links).not.toContain('/tabs/profile/pulse');
    expect(links).not.toContain('/tabs/profile/offices');
    expect(links).toContain('/tabs/profile/members');

    // FR-178: «Überblick» führt nur Modulwege. Sind beide aus, entfällt die
    // Gruppe **samt Überschrift** – eine leere Überschrift sähe aus wie ein
    // Ladefehler. Die übrigen Gruppen stehen weiter.
    expect(headings(container)).not.toContain('Überblick');
    expect(headings(container)).toContain('Menschen');
  });

  it('lässt Trainer:innen ohne das Modul «Gesundheit» die Teams', () => {
    // Seit UC-045 hängt ihre Gruppe nicht mehr am Gesundheitsmodul: Die
    // Teamliste steht ihnen immer offen, was sie dort dürfen, entscheidet
    // `can_plan_for_team()`.
    club.isTrainer = true;
    club.activeClub = { id: 'c1', name: 'TV Musterhausen', settings: { modules: {} } };
    const { container } = renderWithProviders(<AppMenu />);

    expect(routerLinks(container)).toEqual(['/tabs/profile', '/tabs/profile/teams']);
  });

  it('zeigt das Vereinslogo neben dem Namen (FR-111)', () => {
    club.activeClub = {
      id: 'c1',
      name: 'TV Musterhausen',
      settings: { logoUrl: 'https://verein.example/logo.svg' },
    };
    const { container } = renderWithProviders(<AppMenu />);

    const logo = container.querySelector('img.app-club-logo');
    expect(logo).not.toBeNull();
    expect(logo).toHaveAttribute('src', 'https://verein.example/logo.svg');
    // Ohne Alternativtext wäre das Logo für eine Sprachausgabe nichts.
    expect(logo).toHaveAttribute('alt', 'TV Musterhausen');
  });

  it('lässt ohne Logo Platz, statt eine leere Fläche zu zeigen', () => {
    const { container } = renderWithProviders(<AppMenu />);
    expect(container.querySelector('img.app-club-logo')).toBeNull();
  });

  it('bietet den Vereinswechsel erst ab zwei Mitgliedschaften an', () => {
    // Mit einer Mitgliedschaft bleibt nur die Sprachwahl übrig.
    const { container, unmount } = renderWithProviders(<AppMenu />);
    expect(container.querySelectorAll('ion-select')).toHaveLength(1);
    unmount();

    club.memberships = [
      { club_id: 'c1', club: { name: 'TV Musterhausen' } },
      { club_id: 'c2', club: { name: 'MG Beispieldorf' } },
    ];
    const withTwo = renderWithProviders(<AppMenu />);
    expect(withTwo.container.querySelectorAll('ion-select')).toHaveLength(2);
    expect(withTwo.container.textContent).toContain('MG Beispieldorf');
  });

  it('meldet ab', () => {
    const { container } = renderWithProviders(<AppMenu />);
    const button = container.querySelector('ion-button');
    expect(button).toHaveTextContent('Abmelden');
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(signOut).toHaveBeenCalledOnce();
  });
});

function routerLinks(container: HTMLElement): (string | undefined)[] {
  return [...container.querySelectorAll('ion-item')]
    .map((item) => ionProp<string | undefined>(item, 'routerLink'))
    .filter(Boolean);
}

/** Die Überschriften der Seitenleiste in ihrer Reihenfolge. */
function headings(container: HTMLElement): (string | undefined)[] {
  return [...container.querySelectorAll('ion-list-header')].map((node) =>
    node.textContent?.trim(),
  );
}

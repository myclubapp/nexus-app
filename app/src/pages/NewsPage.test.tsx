/**
 * Die «Alle News»-Seite (UC-026, A5).
 *
 * Geprüft ist genau das, was den Filter von einem Filter über dem Ergebnis
 * unterscheidet: Die Wahl der Herkunft muss **in die Abfrage** gehen. Der
 * Fehler, den dieser Test festhält, sähe im Browser aus wie eine leere Liste
 * bei «Website» – und zwar nur bei einem Verein, dessen Verband die erste
 * Seite allein füllt. Genau der Fall, für den die Seite gebaut ist.
 *
 * Die Knöpfe werden über `ion-segment-button` gesucht und nicht über
 * `getByText`: Ein blosser Textknoten in einer Ionic-Komponente ist für
 * Testing Library unsichtbar (docs/TESTING.md, «Was Ionic in jsdom anders
 * macht», Punkt 3). Am Segment ist es sogar der Knopf und nicht das
 * `ion-label`, das den Text trägt – nachgemessen: `ion-label.textContent` ist
 * leer, `ion-segment-button.textContent` ist «Website». Dasselbe Vorgehen wie
 * in `NoteAnswerModal.test.tsx`.
 */
import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsPage } from './NewsPage';
import { renderWithProviders } from '../test/utils';
import type { News } from '../lib/database.types';
import type { NewsOrigin } from '../lib/news';

/** Womit `useAllNews()` zuletzt aufgerufen wurde – der eigentliche Prüfpunkt. */
let askedFor: NewsOrigin | undefined;
let pages: News[][] = [];
let counts: Record<'own' | 'website' | 'federation', number> | undefined;

vi.mock('../hooks/useNews', () => ({
  useAllNews: (origin: NewsOrigin) => {
    askedFor = origin;
    return {
      data: { pages },
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: vi.fn(async () => {}),
      refetch: vi.fn(async () => {}),
    };
  },
  useNewsOrigins: () => ({ data: counts, refetch: vi.fn(async () => {}) }),
  useShareNews: () => async () => {},
  // Blatt und Formular der Seite hängen am selben Modul.
  usePublishNews: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useUpdateNews: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useRetractNews: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

vi.mock('../hooks/useClub', () => ({
  useClub: () => ({
    activeClub: { id: 'c1', name: 'Testverein' },
    activeMembership: { id: 'm1' },
    isTrainer: false,
  }),
}));

vi.mock('../hooks/usePlanningScope', () => ({
  usePlanningScope: () => ({ myTeamIds: [], isLoading: false, canPlanFor: () => false }),
}));

vi.mock('../hooks/useRefreshOnEnter', () => ({ useRefreshOnEnter: () => {} }));
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ success: vi.fn(), failure: vi.fn() }),
}));

function post(overrides: Partial<News> = {}): News {
  return {
    id: 'n1',
    club_id: 'c1',
    team_id: null,
    source: 'website',
    external_id: null,
    external_url: null,
    title: 'Familienturnier',
    body: null,
    body_html: null,
    image_url: null,
    author: null,
    author_image_url: null,
    published_at: '2026-04-04T20:08:41Z',
    synced_at: null,
    created_by: null,
    created_at: '2026-04-04T20:08:41Z',
    ...overrides,
  } as News;
}

/** Die Beschriftungen der Herkunftswahl, in ihrer Reihenfolge. */
function originLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('ion-segment-button')].map(
    (element) => element.textContent?.trim() ?? '',
  );
}

/**
 * Eine Herkunft wählen.
 *
 * `ion-segment` meldet die Wahl über `ionChange`, nicht über einen Klick auf
 * den Knopf: Ionic-Ereignisse kommen in jsdom nur von Hand (docs/TESTING.md,
 * Punkt 4, wie `toggle()` in `ClubSettingsPage.test.tsx`). Die Beschriftung
 * wird trotzdem gesucht – so schlägt der Test fehl, wenn ein Knopf fehlt,
 * statt still danebenzugreifen.
 */
function chooseOrigin(container: HTMLElement, label: string, value: NewsOrigin) {
  if (!originLabels(container).includes(label)) {
    throw new Error(`Kein Herkunfts-Knopf «${label}»: ${originLabels(container)}`);
  }
  const segment = container.querySelector('ion-segment');
  act(() => {
    segment?.dispatchEvent(new CustomEvent('ionChange', { detail: { value } }));
  });
}

describe('NewsPage', () => {
  beforeEach(() => {
    askedFor = undefined;
    pages = [[post()]];
    counts = { own: 0, website: 100, federation: 20 };
  });

  it('fragt zuerst ohne Eingrenzung', () => {
    renderWithProviders(<NewsPage />);
    expect(askedFor).toBe('all');
  });

  it('bietet nur die Herkünfte an, die es im Verein wirklich gibt', () => {
    // Dieser Verein schreibt nichts selbst: Ein Knopf «Verein» führte
    // garantiert in eine leere Liste.
    const { container } = renderWithProviders(<NewsPage />);
    expect(originLabels(container)).toEqual(['Alle', 'Website', 'Verband']);
  });

  it('zeigt gar keine Wahl, wenn alles aus derselben Quelle kommt', () => {
    counts = { own: 0, website: 100, federation: 0 };
    const { container } = renderWithProviders(<NewsPage />);
    expect(originLabels(container)).toEqual([]);
  });

  it('zeigt noch keine Wahl, solange die Zahlen fehlen', () => {
    // Eine Leiste, die eine Zeile später um einen Knopf wächst, verschöbe den
    // Feed unter dem Daumen.
    counts = undefined;
    const { container } = renderWithProviders(<NewsPage />);
    expect(originLabels(container)).toEqual([]);
  });

  it('gibt die gewählte Herkunft an die Abfrage weiter, statt nachträglich zu filtern', async () => {
    const { container } = renderWithProviders(<NewsPage />);

    chooseOrigin(container, 'Verband', 'federation');

    // Der Beweis: Die Abfrage läuft neu und mit der Herkunft im Schlüssel.
    // Bliebe `askedFor` auf «all», filterte die Seite über den bereits
    // geholten zwanzig Zeilen – und zeigte bei diesem Verein nichts.
    await waitFor(() => expect(askedFor).toBe('federation'));
  });

  it('erklärt die leere Liste mit der Quelle, nicht mit dem Verein', async () => {
    pages = [[]];
    const { container } = renderWithProviders(<NewsPage />);

    // Ohne Wahl ist der Feed als Ganzes leer – da stimmt «keine Neuigkeiten».
    expect(screen.getByText('Zurzeit keine Neuigkeiten')).toBeInTheDocument();

    chooseOrigin(container, 'Verband', 'federation');

    await waitFor(() =>
      expect(screen.getByText('Zurzeit keine Beiträge aus dieser Quelle')).toBeInTheDocument(),
    );
  });
});

import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsSourcePage } from './NewsSourcePage';
import { renderWithProviders } from '../../test/utils';
import type { NewsSource } from '../../lib/database.types';
import type { SiteCheck } from '../../hooks/useNewsSources';

/**
 * UC-038 hat mit 0048 einen Schritt dazubekommen: Zwischen «Adresse eintippen»
 * und «Beiträge holen» steht die Prüfung.
 *
 * Geprüft wird hier, **was in einem Zustand zu sehen ist** und **womit die
 * Ansicht speichert** (docs/TESTING.md §1.4 und §1.6): Eine Ionic-Eingabe
 * lässt sich in jsdom nicht bedienen, die Entscheidungen liegen deshalb in
 * `src/lib/wordpress.ts` und werden dort geprüft.
 */

let isAdmin: boolean;
let source: NewsSource | null;
let checked: { data: SiteCheck | null; variables: string | undefined; error: Error | null };

const connectMutate = vi.fn();
const checkMutate = vi.fn();

vi.mock('../../hooks/useClub', () => ({
  useClub: () => ({ isAdmin, activeClub: { id: 'c1', name: 'TV Musterhausen' } }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ success: vi.fn(), failure: vi.fn() }),
}));

vi.mock('../../hooks/useNewsSources', () => ({
  useNewsSource: () => ({ data: source, isLoading: false, error: null, refetch: vi.fn() }),
  useCheckWebsite: () => ({
    mutate: checkMutate,
    reset: vi.fn(),
    isPending: false,
    data: checked.data,
    variables: checked.variables,
    error: checked.error,
  }),
  useConnectWebsite: () => ({ mutate: connectMutate, isPending: false, error: null }),
  useDisconnectWebsite: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

/** `ion-button` bekommt in jsdom keine ARIA-Rolle (docs/TESTING.md §1.1). */
function button(container: HTMLElement, label: string): Element | undefined {
  return Array.from(container.querySelectorAll('ion-button')).find(
    (element) => element.textContent?.trim() === label,
  );
}

/** Die Beschriftungen der Kategorie-Auswahl. */
function categoryOptions(container: HTMLElement): string[] {
  const selects = [...container.querySelectorAll('ion-select')];
  const categories = selects.at(-1);
  return [...(categories?.querySelectorAll('ion-select-option') ?? [])].map(
    (option) => option.textContent?.trim() ?? '',
  );
}

function newsSource(overrides: Partial<NewsSource> = {}): NewsSource {
  return {
    id: 's-1',
    club_id: 'c1',
    kind: 'wordpress',
    url: 'https://verein.ch',
    site_name: 'TV Musterhausen',
    api_style: 'pretty',
    post_limit: 50,
    categories: [{ id: 4, name: 'Herren 1' }],
    active: true,
    last_sync_at: '2026-09-10T14:38:00Z',
    last_status: 'ok',
    last_error: null,
    last_imported: 50,
    created_by: null,
    created_at: '2026-09-01T00:00:00Z',
    ...overrides,
  } as NewsSource;
}

function siteCheck(overrides: Partial<SiteCheck> = {}): SiteCheck {
  return {
    url: 'https://verein.ch',
    apiStyle: 'pretty',
    siteName: 'TV Musterhausen',
    totalPosts: 165,
    categories: [
      { id: 10, name: 'App', count: 122 },
      { id: 4, name: 'Herren 1', count: 93 },
    ],
    ...overrides,
  };
}

describe('NewsSourcePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin = true;
    source = null;
    checked = { data: null, variables: undefined, error: null };
  });

  it('weist ab, wer nicht im Vorstand ist (A5)', () => {
    isAdmin = false;
    const { container } = renderWithProviders(<NewsSourcePage />);

    expect(container.textContent).toContain('Nur der Vorstand kann die Website verbinden.');
    expect(button(container, 'Website prüfen')).toBeUndefined();
  });

  it('nennt WordPress als Voraussetzung, bevor irgendetwas geprüft ist', () => {
    const { container } = renderWithProviders(<NewsSourcePage />);

    // Der Grund für diesen Test: Aus «Adresse eurer Website» ging nicht
    // hervor, dass es ohne WordPress nicht geht.
    expect(container.textContent).toContain('Voraussetzung ist eine Website mit WordPress');
    expect(button(container, 'Website prüfen')).toBeDefined();
  });

  it('bietet ohne Prüfung keine Kategorien an, sondern den Weg dorthin', () => {
    const { container } = renderWithProviders(<NewsSourcePage />);

    expect(categoryOptions(container)).toEqual([]);
    expect(container.textContent).toContain('Prüft die Website');
    // Ohne Auswahl kommt alles – das steht da, damit die leere Liste nicht
    // wie «nichts wird geholt» aussieht (BR-174).
    expect(container.textContent).toContain('Ohne Auswahl kommen die Beiträge aller Kategorien');
  });

  it('meldet nach der Prüfung, was die Website hergibt (Schritt 6)', () => {
    source = newsSource();
    checked = { data: siteCheck(), variables: 'https://verein.ch', error: null };
    const { container } = renderWithProviders(<NewsSourcePage />);

    expect(container.textContent).toContain('WordPress erkannt · 165 Beiträge veröffentlicht');
    expect(container.textContent).toContain('https://verein.ch/wp-json/wp/v2/posts');
    expect(categoryOptions(container)).toEqual(['App (122)', 'Herren 1 (93)']);
  });

  it('lässt das Ergebnis nicht zu einer anderen Adresse stehen', () => {
    // Geprüft wurde eine andere Website als die, die im Feld steht: Das
    // Ergebnis gehört nicht mehr dazu und darf keinen Umfang begründen.
    source = newsSource();
    checked = { data: siteCheck(), variables: 'https://andere.ch', error: null };
    const { container } = renderWithProviders(<NewsSourcePage />);

    expect(container.textContent).not.toContain('WordPress erkannt');
    expect(categoryOptions(container)).toEqual(['Herren 1']);
  });

  it('erklärt einen Fehlschlag der Prüfung (A1)', () => {
    source = newsSource();
    checked = {
      data: null,
      variables: 'https://verein.ch',
      error: new Error('Unter dieser Adresse antwortet keine WordPress-Schnittstelle (404)'),
    };
    const { container } = renderWithProviders(<NewsSourcePage />);

    expect(container.textContent).toContain('keine WordPress-Schnittstelle');
    expect(container.textContent).toContain('oder ihre Schnittstelle ist gesperrt');
  });

  it('zeigt bei verbundener Website den gespeicherten Umfang', () => {
    source = newsSource();
    const { container } = renderWithProviders(<NewsSourcePage />);

    expect(container.textContent).toContain('Gespeichert: 50 Beiträge je Abgleich · Herren 1');
  });

  it('nennt «alle Kategorien», wo nichts ausgewählt ist (BR-174)', () => {
    source = newsSource({ post_limit: 20, categories: [] });
    const { container } = renderWithProviders(<NewsSourcePage />);

    expect(container.textContent).toContain(
      'Gespeichert: 20 Beiträge je Abgleich · Alle Kategorien',
    );
  });

  it('reicht Umfang und Auswahl an den Abgleich weiter (FR-149, A6)', () => {
    source = newsSource();
    const { container } = renderWithProviders(<NewsSourcePage />);

    act(() => (button(container, 'Jetzt aktualisieren') as HTMLElement).click());

    // Ohne diese Übergabe stünden die Einstellungen in der Ansicht und die
    // Function holte weiterhin ihre eingebauten zwanzig.
    expect(connectMutate).toHaveBeenCalledWith(
      {
        url: 'https://verein.ch',
        postLimit: 50,
        categories: [{ id: 4, name: 'Herren 1' }],
      },
      expect.anything(),
    );
  });
});

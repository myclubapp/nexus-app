import { describe, expect, it } from 'vitest';
import { NewsCard } from './NewsCard';
import { renderWithProviders } from '../test/utils';
import type { News } from '../lib/database.types';

/**
 * Die Karte im Detail (UC-038, BR-169): Der Volltext der Website kommt mit
 * Absätzen und Bildern, aber ohne Skripte; fehlt er, führt ein Verweis zur
 * Website.
 */
function entry(overrides: Partial<News> = {}): News {
  return {
    id: 'n1',
    club_id: 'c1',
    team_id: null,
    source: 'website',
    title: 'Historischer Heimsieg',
    body: 'Nach der schwachen Leistung im letzten Spiel […]',
    body_html: null,
    image_url: null,
    author: 'kadetten',
    author_image_url: null,
    external_id: '42',
    external_url: 'https://kadettensh.ch/heimsieg',
    published_at: '2026-01-04T18:22:00Z',
    synced_at: null,
    is_sample: false,
    ...overrides,
  };
}

describe('NewsCard', () => {
  it('zeigt im Detail den Volltext mit Bild und ohne Skript', () => {
    const { container } = renderWithProviders(
      <NewsCard
        entry={entry({
          body_html:
            '<p>Erster Absatz.</p><h2>Zweite Halbzeit</h2><p>Zweiter Absatz.</p>' +
            '<img src="https://kadettensh.ch/jubel.jpg" alt="Jubel"><script>alert(1)</script>',
        })}
        fallbackAuthor="Verein"
        full
      />,
    );

    const article = container.querySelector('.app-news-card__article');
    expect(article).not.toBeNull();
    expect(article!.querySelectorAll('p')).toHaveLength(2);
    expect(article!.querySelector('h2')).toHaveTextContent('Zweite Halbzeit');
    expect(article!.querySelector('img')).toHaveAttribute('src', 'https://kadettensh.ch/jubel.jpg');
    expect(article!.querySelector('script')).toBeNull();
    // Der Anriss steht nicht ein zweites Mal darunter.
    expect(container.textContent).not.toContain('[…]');
    expect(container.querySelector('a[href="https://kadettensh.ch/heimsieg"]')).toBeNull();
  });

  it('zeigt ohne Volltext den Anriss und den Weg zur Website', () => {
    const { container, getByText } = renderWithProviders(
      <NewsCard entry={entry()} fallbackAuthor="Verein" full />,
    );

    expect(container.querySelector('.app-news-card__article')).toBeNull();
    expect(container.querySelector('.app-news-card__body')).toHaveTextContent('[…]');
    const link = getByText('Ganzen Beitrag auf der Website lesen').closest('ion-button');
    expect(link).toHaveAttribute('href', 'https://kadettensh.ch/heimsieg');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('zeigt in der Liste nur den Anriss, auch wenn ein Volltext da ist', () => {
    const { container } = renderWithProviders(
      <NewsCard
        entry={entry({ body_html: '<p>Der ganze Artikel.</p>' })}
        fallbackAuthor="Verein"
        onOpen={() => undefined}
      />,
    );

    expect(container.querySelector('.app-news-card__article')).toBeNull();
    expect(container.querySelector('.app-news-card__lead')).toHaveTextContent('[…]');
    expect(container.textContent).not.toContain('Der ganze Artikel.');
    expect(container.textContent).not.toContain('Ganzen Beitrag auf der Website lesen');
  });
});

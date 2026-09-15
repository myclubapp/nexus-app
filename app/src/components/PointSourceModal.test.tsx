import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { PointSourceFields } from './PointSourceModal';
import { ALL_POINTS, type ClubPillar, type PointSource } from '../lib/leaderboard';
import { renderWithProviders } from '../test/utils';

/**
 * Geprüft wird, was die Auswahl **entscheidet**: dass die Säulen unter den
 * Namen der Wertdimensionen stehen (der eigentliche Zweck von `0092`), dass
 * die Säule einzeln wählbar bleibt (FR-048), und dass nur erscheint, was
 * dieser Verein wirklich führt. Das Öffnen und Schliessen des Blatts deckt
 * der manuelle Testplan ab.
 */
describe('PointSourceFields', () => {
  const pillars: ClubPillar[] = [
    { pillar: 1, dimension: 'engagement' },
    { pillar: 2, dimension: 'engagement' },
    { pillar: 3, dimension: 'volunteering' },
    { pillar: 4, dimension: 'network' },
    { pillar: 7, dimension: 'volunteering' },
  ];

  function render(value: PointSource = ALL_POINTS, rows: ClubPillar[] = pillars) {
    const onChange = vi.fn();
    const result = renderWithProviders(
      <PointSourceFields value={value} pillars={rows} onChange={onChange} />,
    );
    return { ...result, onChange };
  }

  it('stellt die Säulen unter die Namen der Wertdimensionen', () => {
    const { container } = render();

    // Die Überschriften sind die Dimensionen aus «Meine Stärken», in der
    // Reihenfolge des Netzdiagramms. (Der Text steht im `ion-label` der
    // Überschrift; `getByText` findet ihn in jsdom nicht.)
    const headers = [...container.querySelectorAll('ion-list-header')].map((element) =>
      element.textContent?.trim(),
    );
    expect(headers).toEqual(['Engagement', 'Ehrenamt', 'Netzwerk']);

    // … und darunter stehen die Säulen des Konzepts.
    expect(screen.getByText('Trainingsengagement')).toBeTruthy();
    expect(screen.getByText('Freiwilliges Engagement')).toBeTruthy();
    expect(screen.getByText('Marktplatz')).toBeTruthy();
  });

  it('lässt die einzelne Säule wählen – FR-048 meint Säule 3, nicht «Ehrenamt»', () => {
    const { onChange } = render();

    fireEvent.click(screen.getByText('Freiwilliges Engagement'));

    expect(onChange).toHaveBeenCalledWith({ kind: 'pillar', pillar: 3 });
  });

  it('lässt die ganze Dimension wählen, wenn mehrere Säulen darunter liegen', () => {
    const { onChange } = render();

    // Zwei Gruppen haben mehrere Säulen (Engagement, Ehrenamt), «Netzwerk»
    // nicht – also genau zwei «Alles»-Chips.
    const wholeChips = screen.getAllByText('Alles');
    expect(wholeChips).toHaveLength(2);

    fireEvent.click(wholeChips[1]);
    expect(onChange).toHaveBeenCalledWith({ kind: 'dimension', dimension: 'volunteering' });
  });

  it('hebt die geltende Wahl beim zweiten Tippen auf, statt sie zu wiederholen', () => {
    const { onChange } = render({ kind: 'pillar', pillar: 3 });

    fireEvent.click(screen.getByText('Freiwilliges Engagement'));

    expect(onChange).toHaveBeenCalledWith(ALL_POINTS);
  });

  it('zeigt nur, was der Verein führt', () => {
    render();

    // Säule 5 und 6 vergibt dieser Verein nicht: Sie standen bisher trotzdem
    // in der Auswahl und führten zuverlässig auf eine leere Rangliste.
    expect(screen.queryByText('Wachstum & Treue')).toBeNull();
    expect(screen.queryByText('Verlässlichkeit')).toBeNull();
    expect(screen.queryByText('Treue')).toBeNull();
  });

  it('markiert die geltende Wahl für Bedienhilfen', () => {
    render({ kind: 'dimension', dimension: 'engagement' });

    // `aria-checked` kommt als Attribut an; das `role` setzt der Lit-Wrapper
    // von Ionic 9 als Eigenschaft, die jsdom ohne Stencil verliert.
    const chip = (text: string) => screen.getAllByText(text)[0].closest('ion-chip')!;
    expect(chip('Alles').getAttribute('aria-checked')).toBe('true');
    expect(chip('Trainingsengagement').getAttribute('aria-checked')).toBe('false');
  });

  it('kommt ohne Säulen ohne Abschnitt aus', () => {
    render(ALL_POINTS, []);

    expect(screen.queryAllByRole('radiogroup')).toHaveLength(0);
  });
});

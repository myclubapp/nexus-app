import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { FirstStepsCard } from './FirstStepsCard';
import { ionProp, renderWithProviders } from '../test/utils';

/**
 * UC-001 Schritt 10 verlangt **drei** Handlungsangebote. Eine dauerhaft vierte
 * Zeile wäre wieder eine Konfigurationsaufgabe – das Gegenteil des
 * Zero-Config-Starts (BR-002, K7). Deshalb prüft der erste Test die Anzahl.
 *
 * Die einzige Ausnahme ist der Website-Import (UC-038): Er erscheint nur,
 * solange keine Website verbunden ist, und verschwindet danach wieder. Die
 * letzten beiden Tests halten beide Seiten dieser Bedingung fest.
 */
describe('FirstStepsCard', () => {
  it('bietet genau drei Schritte an', () => {
    const { container } = renderWithProviders(<FirstStepsCard clubName="TV Musterhausen" />);
    expect(container.querySelectorAll('ion-item')).toHaveLength(3);
  });

  it('benennt den frisch gegründeten Verein', () => {
    // Über den Textinhalt der Überschrift statt über getByText: Ein blosser
    // Textknoten direkt in einer Ionic-Komponente ist für die Textsuche von
    // Testing Library in jsdom nicht erreichbar (siehe docs/TESTING.md).
    const { container } = renderWithProviders(<FirstStepsCard clubName="TV Musterhausen" />);
    expect(container.querySelector('ion-list-header')).toHaveTextContent(
      'Erste Schritte für TV Musterhausen',
    );
  });

  it('führt zu den drei Zielen aus der Spezifikation', () => {
    const { container } = renderWithProviders(<FirstStepsCard clubName="TV Musterhausen" />);

    const targets = [...container.querySelectorAll('ion-item')].map((item) =>
      ionProp<string>(item, 'routerLink'),
    );
    expect(targets).toEqual([
      '/tabs/agenda',
      '/tabs/profile/invite',
      '/tabs/profile/rules',
    ]);
  });

  it('beschriftet jeden Schritt in der Sprache der Person', () => {
    renderWithProviders(<FirstStepsCard clubName="TV Musterhausen" />);

    expect(screen.getByText('Ersten Termin erfassen')).toBeInTheDocument();
    expect(screen.getByText('Mitglieder einladen')).toBeInTheDocument();
    expect(screen.getByText('Punkteregeln ansehen')).toBeInTheDocument();
  });

  it('bietet den Website-Import an, solange keine Website verbunden ist', () => {
    const { container } = renderWithProviders(
      <FirstStepsCard clubName="TV Musterhausen" offerNewsImport />,
    );

    const targets = [...container.querySelectorAll('ion-item')].map((item) =>
      ionProp<string>(item, 'routerLink'),
    );
    expect(targets).toHaveLength(4);
    expect(targets.at(-1)).toBe('/tabs/profile/news');
    expect(screen.getByText('News von eurer Website holen')).toBeInTheDocument();
  });

  it('lässt den Website-Import weg, sobald eine Website verbunden ist', () => {
    // Das Angebot ist einmalig. Bliebe es stehen, wüchse die Karte zur
    // Konfigurationsliste – genau das, was BR-002 verhindern soll.
    const { container } = renderWithProviders(
      <FirstStepsCard clubName="TV Musterhausen" offerNewsImport={false} />,
    );
    expect(container.querySelectorAll('ion-item')).toHaveLength(3);
  });
});

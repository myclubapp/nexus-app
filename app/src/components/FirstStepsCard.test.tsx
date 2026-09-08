import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { FirstStepsCard } from './FirstStepsCard';
import { ionProp, renderWithProviders } from '../test/utils';

/**
 * UC-001 Schritt 9 verlangt **genau drei** Handlungsangebote. Eine vierte Zeile
 * wäre wieder eine Konfigurationsaufgabe – das Gegenteil des Zero-Config-Starts
 * (BR-002, K7). Deshalb prüft der erste Test die Anzahl.
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
      '/tabs/profile/club',
    ]);
  });

  it('beschriftet jeden Schritt in der Sprache der Person', () => {
    renderWithProviders(<FirstStepsCard clubName="TV Musterhausen" />);

    expect(screen.getByText('Ersten Termin erfassen')).toBeInTheDocument();
    expect(screen.getByText('Mitglieder einladen')).toBeInTheDocument();
    expect(screen.getByText('Punkteregeln ansehen')).toBeInTheDocument();
  });
});

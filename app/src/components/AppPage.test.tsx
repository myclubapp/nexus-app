import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { IonButton, IonButtons } from '@ionic/react';
import { AppPage } from './AppPage';
import { renderWithProviders } from '../test/utils';

/**
 * Das Seitengerüst trägt das iOS-Muster mit dem zusammenfallenden grossen
 * Titel. Diese Tests halten die Teile fest, die dabei leicht verloren gehen:
 * die zweite Kopfzeile im Inhalt, `fullscreen` am Inhalt – und dass ein
 * Aktionsknopf genau einmal existiert und nicht in beiden Kopfzeilen.
 */
describe('AppPage', () => {
  it('zeigt den Titel in beiden Kopfzeilen an', () => {
    renderWithProviders(
      <AppPage title="Agenda">
        <p>Inhalt</p>
      </AppPage>,
    );

    expect(screen.getAllByText('Agenda')).toHaveLength(2);
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });

  it('verwendet einen abweichenden grossen Titel', () => {
    renderWithProviders(
      <AppPage title="Start" largeTitle="Hallo Alex">
        <p>Inhalt</p>
      </AppPage>,
    );

    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Hallo Alex')).toBeInTheDocument();
  });

  it('lässt die zweite Kopfzeile weg, wenn kein grosser Titel gewünscht ist', () => {
    const { container } = renderWithProviders(
      <AppPage title="Formular" largeTitle={false}>
        <p>Inhalt</p>
      </AppPage>,
    );

    expect(screen.getAllByText('Formular')).toHaveLength(1);
    expect(container.querySelectorAll('ion-header')).toHaveLength(1);
  });

  it('legt die zweite Kopfzeile für den grossen Titel in den Inhalt', () => {
    // Der einklappende grosse Titel entsteht nur aus zwei Kopfzeilen: der
    // äusseren und einer zweiten innerhalb von `ion-content`. Steht die
    // zweite ausserhalb, bleibt der Titel beim Scrollen stehen.
    const { container } = renderWithProviders(
      <AppPage title="Agenda">
        <p>Inhalt</p>
      </AppPage>,
    );

    expect(container.querySelectorAll('ion-header')).toHaveLength(2);
    expect(container.querySelectorAll('ion-content > ion-header')).toHaveLength(1);
  });

  it('zeigt einen Aktionsknopf genau einmal', () => {
    renderWithProviders(
      <AppPage
        title="Agenda"
        toolbarEnd={
          <IonButtons slot="end">
            <IonButton>Neu</IonButton>
          </IonButtons>
        }
      >
        <p>Inhalt</p>
      </AppPage>,
    );

    expect(screen.getAllByText('Neu')).toHaveLength(1);
  });

  it('blendet den Zurück-Knopf nur mit Zielroute ein', () => {
    const { container, unmount } = renderWithProviders(
      <AppPage title="Ohne">
        <p>Inhalt</p>
      </AppPage>,
    );
    expect(container.querySelector('ion-back-button')).toBeNull();
    unmount();

    const withBack = renderWithProviders(
      <AppPage title="Mit" backHref="/tabs/profile">
        <p>Inhalt</p>
      </AppPage>,
    );
    expect(
      withBack.container.querySelector('ion-back-button'),
    ).toHaveAttribute('default-href', '/tabs/profile');
  });

  it('zeigt den Aktualisieren-Griff nur mit Rückruf', () => {
    const { container, unmount } = renderWithProviders(
      <AppPage title="Ohne">
        <p>Inhalt</p>
      </AppPage>,
    );
    expect(container.querySelector('ion-refresher')).toBeNull();
    unmount();

    const withRefresh = renderWithProviders(
      <AppPage title="Mit" onRefresh={() => Promise.resolve()}>
        <p>Inhalt</p>
      </AppPage>,
    );
    expect(withRefresh.container.querySelector('ion-refresher')).not.toBeNull();
  });
});

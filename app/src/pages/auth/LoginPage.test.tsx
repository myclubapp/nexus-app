import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { LoginPage } from './LoginPage';
import { renderWithProviders } from '../../test/utils';

let authError: string | null = null;

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    session: null,
    user: null,
    initialising: false,
    authError,
    clearAuthError: vi.fn(),
    signInWithMagicLink: vi.fn(),
    signInWithPassword: vi.fn(),
    setPassword: vi.fn(),
    signOut: vi.fn(),
  }),
}));

/**
 * Geprüft wird, **was die Seite in einem Zustand zeigt**. Die Bedienung der
 * Ionic-Eingaben lässt sich in jsdom nicht nachstellen – dort feuert kein
 * `ionInput` und `ion-input` hat kein inneres Feld (docs/TESTING.md). Die
 * Entscheidung hinter dem Formular hängt deshalb in `resolveSignInAction()`
 * und wird in `authError.test.ts` vollständig geprüft.
 */
describe('LoginPage', () => {
  beforeEach(() => {
    authError = null;
    vi.clearAllMocks();
  });

  it('zeigt den Anmeldelink als Standardweg', () => {
    const { container } = renderWithProviders(<LoginPage />);

    expect(screen.getByText('Anmeldelink senden')).toBeInTheDocument();
    // Nur das E-Mail-Feld, solange der Link-Weg gewählt ist.
    expect(container.querySelectorAll('ion-input')).toHaveLength(1);
  });

  it('bietet beide Wege aus der Spezifikation an', () => {
    const { container } = renderWithProviders(<LoginPage />);

    const segment = container.querySelector('ion-segment');
    expect(segment).not.toBeNull();
    expect(segment).toHaveTextContent('Anmeldelink');
    expect(segment).toHaveTextContent('Passwort');
  });

  it('bietet keinen Drittanbieter-Login an (BR-017, C-003)', () => {
    const { container } = renderWithProviders(<LoginPage />);
    expect(container.textContent).not.toMatch(/google|apple|facebook/i);
  });

  it('meldet einen abgelaufenen Link aus dem Rücksprung (A1)', () => {
    authError = 'Email link is invalid or has expired';
    renderWithProviders(<LoginPage />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Dieser Anmeldelink ist abgelaufen oder wurde bereits verwendet.',
    );
  });

  it('zeigt ohne Fehler keine Meldung', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lässt die Sprache schon vor der Anmeldung wechseln (FR-110)', () => {
    const { container } = renderWithProviders(<LoginPage />);
    expect(container.querySelector('ion-select')).not.toBeNull();
  });

  it('zeigt den Einrichtungshinweis, solange keine Verbindung besteht', async () => {
    vi.resetModules();
    vi.doMock('../../lib/supabase', () => ({ isConfigured: false }));
    const { LoginPage: Unconfigured } = await import('./LoginPage');

    renderWithProviders(<Unconfigured />);
    expect(
      screen.getByText(/noch nicht mit einem Supabase-Projekt verbunden/),
    ).toBeInTheDocument();
    vi.doUnmock('../../lib/supabase');
  });
});

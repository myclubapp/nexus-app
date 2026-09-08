import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { DeleteAccountContent } from './DeleteAccountModal';
import { renderWithProviders } from '../test/utils';

const mutate = vi.fn();
let blockers: { clubId: string; clubName: string }[] = [];

vi.mock('../hooks/useAccount', () => ({
  useAdminBlockers: () => ({ data: blockers, isLoading: false, error: null }),
  useDeleteAccount: () => ({ mutate, isPending: false, error: null }),
}));

/**
 * UC-006 ist eine Auflage beider App-Stores (C-023). Geprüft wird, dass die
 * Erklärung vollständig ist und der einzige Vorstand nicht durchkommt (A1) –
 * die Bedienung der Ionic-Eingabe selbst deckt der manuelle Testplan ab.
 */
describe('DeleteAccountModal', () => {
  beforeEach(() => {
    blockers = [];
    vi.clearAllMocks();
  });

  it('erklärt, was gelöscht wird und was bleibt (Schritt 2)', () => {
    const { container } = renderWithProviders(
      <DeleteAccountContent onDismiss={vi.fn()} />,
    );

    expect(container.textContent).toContain('Das wird gelöscht');
    expect(container.textContent).toContain('Das bleibt bestehen');
    // BR-021: Die Punktebuchungen bleiben anonym erhalten – das muss dastehen.
    expect(container.textContent).toContain('Punktebuchungen');
    expect(container.textContent).toContain('nicht rückgängig');
  });

  it('nennt jede Art von Daten, die verschwindet', () => {
    const { container } = renderWithProviders(
      <DeleteAccountContent onDismiss={vi.fn()} />,
    );

    expect(container.textContent).toContain('Anzeigename');
    expect(container.textContent).toContain('Anmeldekonto');
    expect(container.textContent).toContain('Benachrichtigungen');
    expect(container.textContent).toContain('privaten Notizen');
  });

  it('verlangt ein getipptes Wort statt eines Taps (Schritt 3)', () => {
    const { container } = renderWithProviders(
      <DeleteAccountContent onDismiss={vi.fn()} />,
    );

    // Ein Eingabefeld statt eines Häkchens: Schritt 3 verlangt eine
    // ausdrückliche Bestätigung, und ein Tap daneben ist keine.
    expect(container.querySelector('ion-input')).not.toBeNull();
    // Der Hinweis nennt das Wort, das getippt werden muss.
    expect(container.textContent).toContain('LÖSCHEN');
  });

  it('sperrt die Löschung, solange nicht bestätigt wurde', () => {
    renderWithProviders(<DeleteAccountContent onDismiss={vi.fn()} />);

    const action = screen.getByText('Konto endgültig löschen').closest('ion-button');
    expect((action as unknown as { disabled: boolean }).disabled).toBe(true);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('hält den einzigen Vorstand auf und nennt den Verein (A1, BR-023)', () => {
    blockers = [{ clubId: 'c1', clubName: 'TV Musterhausen' }];
    const { container } = renderWithProviders(
      <DeleteAccountContent onDismiss={vi.fn()} />,
    );

    expect(container.textContent).toContain('Das geht so noch nicht');
    expect(container.textContent).toContain('TV Musterhausen');
    // Ohne Ausweg wäre der Hinweis wertlos.
    expect(container.textContent).toContain('Bestimme zuerst jemand anderen');
    // Der zerstörerische Knopf darf gar nicht erst erscheinen.
    expect(screen.queryByText('Konto endgültig löschen')).not.toBeInTheDocument();
  });

  it('zeigt den Löschweg, sobald ein zweiter Vorstand da ist', () => {
    blockers = [];
    renderWithProviders(<DeleteAccountContent onDismiss={vi.fn()} />);

    expect(screen.getByText('Konto endgültig löschen')).toBeInTheDocument();
    expect(screen.queryByText('Das geht so noch nicht')).not.toBeInTheDocument();
  });
});

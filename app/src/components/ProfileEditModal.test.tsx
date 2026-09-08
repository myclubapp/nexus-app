import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileEditForm } from './ProfileEditModal';
import { renderWithProviders } from '../test/utils';
import type { MyProfile } from '../hooks/useProfile';

const save = vi.fn();
let profile: MyProfile | undefined;

vi.mock('../hooks/useProfile', () => ({
  useMyProfile: () => ({ data: profile, isLoading: false, error: null }),
  useUpdateMyProfile: () => ({ mutate: save, isPending: false, error: null }),
}));

/**
 * `FormModal` steckt in einem `IonModal`, das in jsdom nichts rendert. Die
 * Hülle wird deshalb durch gewöhnliches HTML ersetzt – damit sind der
 * Bestätigen-Knopf und sein gesperrter Zustand prüfbar (docs/TESTING.md).
 */
vi.mock('./FormModal', () => ({
  FormModal: ({
    children,
    canSubmit,
    onSubmit,
  }: {
    children: ReactNode;
    canSubmit?: boolean;
    onSubmit: () => void;
  }) => (
    <div>
      {children}
      <button type="button" disabled={canSubmit === false} onClick={onSubmit}>
        submit
      </button>
    </div>
  ),
}));

describe('ProfileEditForm', () => {
  beforeEach(() => {
    profile = {
      displayName: 'Anna Muster',
      email: 'anna@example.com',
      phone: '079 111 22 33',
      emailPublic: true,
      phonePublic: false,
      leaderboardOptIn: true,
    };
    vi.clearAllMocks();
  });

  it('übernimmt das geladene Profil in den Entwurf', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProfileEditForm onDismiss={vi.fn()} onSaved={vi.fn()} />);

    // Die Werte selbst sind an einer Ionic-Eingabe nicht auslesbar; dass sie
    // ankommen, zeigt sich daran, womit das Formular speichert.
    await user.click(screen.getByRole('button', { name: 'submit' }));

    expect(save).toHaveBeenCalledWith(
      {
        displayName: 'Anna Muster',
        email: 'anna@example.com',
        phone: '079 111 22 33',
        emailPublic: true,
        phonePublic: false,
      },
      expect.anything(),
    );
  });

  it('führt Sichtbarkeit je Kontaktangabe getrennt (FR-019)', () => {
    const { container } = renderWithProviders(
      <ProfileEditForm onDismiss={vi.fn()} onSaved={vi.fn()} />,
    );

    // Ein Schalter je Angabe – ein gemeinsamer wäre kein Entscheid je Feld.
    expect(container.querySelectorAll('ion-toggle')).toHaveLength(2);
    expect(container.querySelectorAll('ion-input')).toHaveLength(3);
  });

  it('erklärt, dass Verborgenes nicht ausgeliefert wird (BR-030, BR-028)', () => {
    const { container } = renderWithProviders(
      <ProfileEditForm onDismiss={vi.fn()} onSaved={vi.fn()} />,
    );

    expect(container.textContent).toContain('gar nicht erst ausgeliefert');
    expect(container.textContent).toContain('je Verein');
  });

  it('lässt einen leeren Anzeigenamen nicht speichern (BR-031)', async () => {
    profile = { ...profile!, displayName: '' };
    const user = userEvent.setup();
    renderWithProviders(<ProfileEditForm onDismiss={vi.fn()} onSaved={vi.fn()} />);

    const submit = screen.getByRole('button', { name: 'submit' });
    expect(submit).toBeDisabled();

    await user.click(submit);
    expect(save).not.toHaveBeenCalled();
  });

  it('lässt einen zu kurzen Anzeigenamen nicht speichern', () => {
    profile = { ...profile!, displayName: 'A' };
    renderWithProviders(<ProfileEditForm onDismiss={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'submit' })).toBeDisabled();
  });

  it('kommt mit einem Profil ohne Kontaktangaben zurecht', async () => {
    profile = {
      displayName: 'Anna Muster',
      email: null,
      phone: null,
      emailPublic: false,
      phonePublic: false,
      leaderboardOptIn: true,
    };
    const user = userEvent.setup();
    renderWithProviders(<ProfileEditForm onDismiss={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'submit' }));

    // Leere Zeichenkette statt null: Sonst wechselt das Feld zwischen
    // gesteuert und ungesteuert und React verliert die Eingabe.
    expect(save).toHaveBeenCalledWith(
      {
        displayName: 'Anna Muster',
        email: '',
        phone: '',
        emailPublic: false,
        phonePublic: false,
      },
      expect.anything(),
    );
  });
});

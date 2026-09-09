import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { HelperEventForm } from './HelperEventModal';
import { renderWithProviders } from '../test/utils';

const createMutateAsync = vi.fn();
const publishMutateAsync = vi.fn();

vi.mock('../hooks/useHelperEvents', () => ({
  useCreateHelperEvent: () => ({
    mutateAsync: createMutateAsync,
    isPending: false,
    error: null,
  }),
  usePublishEvent: () => ({
    mutateAsync: publishMutateAsync,
    isPending: false,
    error: null,
  }),
}));

/**
 * `FormModal` steckt in einem `IonModal`, das in jsdom nichts rendert. Die
 * Hülle wird deshalb durch gewöhnliches HTML ersetzt – damit ist der
 * Ausschreiben-Knopf samt seinem gesperrten Zustand prüfbar
 * (docs/TESTING.md, Vorbild `ProfileEditModal.test.tsx`).
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

/**
 * UC-011: Die Ionic-Eingaben lassen sich in jsdom nicht bedienen, die
 * Rechenregeln liegen in `shift.test.ts`. Hier steht deshalb, was der Ablauf
 * **sagt und sperrt**: A1 verweigert die Publikation und erklärt sie, A2
 * kündigt den Entwurf als folgenlos an.
 */
describe('HelperEventForm', () => {
  beforeEach(() => vi.clearAllMocks());

  function render() {
    return renderWithProviders(
      <HelperEventForm onDone={vi.fn()} onDismiss={vi.fn()} />,
    );
  }

  it('sperrt das Ausschreiben, solange Warum und Schicht fehlen (A1)', () => {
    render();
    expect(screen.getByRole('button', { name: 'submit' })).toBeDisabled();
  });

  it('erklärt die Sperre, statt nur den Knopf auszugrauen (A1)', () => {
    // A1 verlangt, dass das System die Publikation verweigert **und erklärt**.
    const { container } = render();
    expect(container.textContent).toContain('mindestens eine Schicht');
  });

  it('nennt das Warum als eigenen Abschnitt, nicht als Feld unter vielen (BR-043)', () => {
    const { container } = render();
    expect(container.querySelectorAll('ion-list-header')[0]).toHaveTextContent(
      'Wozu dient das?',
    );
  });

  it('sagt, was ein Entwurf bedeutet (A2)', () => {
    const { container } = render();
    expect(container.textContent).toContain('Als Entwurf sichern');
    expect(container.textContent).toContain('nicht sichtbar');
    expect(container.textContent).toContain('benachrichtigt niemanden');
  });

  it('zeigt eine leere Schichtenliste erklärt statt leer (NFR-037)', () => {
    const { container } = render();
    expect(container.textContent).toContain('Noch keine Schicht angelegt');
  });

  it('erklärt den Punktvorschlag als überschreibbar (Schritt 5 und 6)', () => {
    const { container } = render();
    expect(container.textContent).toContain('überschreiben');
  });

  it('schreibt beim Aufbau nichts in die Datenbank (BR-045)', () => {
    render();
    expect(createMutateAsync).not.toHaveBeenCalled();
    expect(publishMutateAsync).not.toHaveBeenCalled();
  });
});

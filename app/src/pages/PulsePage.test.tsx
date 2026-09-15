import { fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PulsePage } from './PulsePage';
import { renderWithProviders } from '../test/utils';

/**
 * Der Leerzustand des Vereins-Pulses (UC-027, A3).
 *
 * Bis `0094` war dieser Bildschirm eine Sackgasse: Der Entwurf entsteht
 * montags, und wer ihn an einem Dienstag brauchte, konnte hier nichts tun.
 * Geprüft wird deshalb genau das – dass der Anstoss da ist und dass beide
 * Ausgänge («Entwurf liegt bereit» und «nichts anzukündigen») verschiedene
 * Antworten geben.
 */

const compose = vi.fn();
const success = vi.fn();
const failure = vi.fn();
let composePending = false;

vi.mock('../hooks/usePulse', () => ({
  usePulseDraft: () => ({ data: null, isLoading: false, error: null, refetch: vi.fn() }),
  useConnectionRatio: () => ({ data: null, refetch: vi.fn() }),
  useReleasePulse: () => ({ mutate: vi.fn(), isPending: false }),
  useDiscardPulse: () => ({ mutate: vi.fn(), isPending: false }),
  useComposePulse: () => ({ mutate: compose, isPending: composePending }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ success, failure }),
}));

describe('PulsePage – ohne Entwurf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    composePending = false;
  });

  it('bietet den Anstoss an, statt auf den Montag zu vertrösten', () => {
    const { getByText } = renderWithProviders(<PulsePage />);

    expect(getByText('Diese Woche liegt kein Entwurf vor.')).toBeInTheDocument();
    expect(getByText('Entwurf zusammenstellen')).toBeInTheDocument();
    // BR-165: Der zweite Weg bleibt bestehen.
    expect(getByText('Selbst etwas erzählen')).toBeInTheDocument();
  });

  it('meldet den fertigen Entwurf', async () => {
    compose.mockImplementation((_input, options) => options.onSuccess('p1'));
    const { getByText } = renderWithProviders(<PulsePage />);

    fireEvent.click(getByText('Entwurf zusammenstellen'));

    await waitFor(() => expect(success).toHaveBeenCalledWith('Der Entwurf liegt bereit.'));
  });

  it('erklärt in der Fläche, wenn es nichts anzukündigen gibt', async () => {
    // A3: Der Lauf fand nichts. Ein Toast wäre weg, bevor die Person ihn
    // gelesen hat – die Erklärung muss stehen bleiben.
    compose.mockImplementation((_input, options) => options.onSuccess(null));
    const { getByText, queryByText } = renderWithProviders(<PulsePage />);

    fireEvent.click(getByText('Entwurf zusammenstellen'));

    await waitFor(() =>
      expect(
        getByText(
          'Es gibt gerade nichts anzukündigen: keine Vereinstermine, keine offenen Aufgaben, keine unterbesetzten Schichten.',
        ),
      ).toBeInTheDocument(),
    );
    expect(success).not.toHaveBeenCalled();
    expect(queryByText('Diese Woche liegt kein Entwurf vor.')).not.toBeInTheDocument();
  });

  it('trägt den Fehler des Servers weiter', async () => {
    compose.mockImplementation((_input, options) =>
      options.onError(new Error('Nur der Vorstand stellt den Vereins-Puls zusammen')),
    );
    const { getByText } = renderWithProviders(<PulsePage />);

    fireEvent.click(getByText('Entwurf zusammenstellen'));

    await waitFor(() =>
      expect(failure).toHaveBeenCalledWith('Nur der Vorstand stellt den Vereins-Puls zusammen'),
    );
  });
});

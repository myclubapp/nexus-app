import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Wizard, type WizardStep } from './Wizard';
import { ionProp, renderWithProviders } from '../test/utils';

function steps(overrides: Partial<WizardStep>[] = []): WizardStep[] {
  return [
    { id: 'a', title: 'Wie heisst der Verein?', isComplete: true, content: <p>A</p> },
    { id: 'b', title: 'Was für ein Verein?', isComplete: true, content: <p>B</p> },
    { id: 'c', title: 'Wann beginnt die Saison?', isComplete: true, content: <p>C</p> },
  ].map((step, index) => ({ ...step, ...overrides[index] }));
}

/** Hält den Schrittzustand so, wie es die Seite tut. */
function Harness(props: {
  steps: WizardStep[];
  onFinish: () => void;
  isSubmitting?: boolean;
  error?: string | null;
}) {
  const [current, setCurrent] = useState(0);
  return (
    <Wizard
      steps={props.steps}
      current={current}
      onCurrentChange={setCurrent}
      finishLabel="Verein erstellen"
      onFinish={props.onFinish}
      isSubmitting={props.isSubmitting}
      error={props.error}
    />
  );
}

describe('Wizard', () => {
  it('zeigt den ersten Schritt und seinen Fortschritt', () => {
    renderWithProviders(<Harness steps={steps()} onFinish={vi.fn()} />);

    expect(screen.getByText('Wie heisst der Verein?')).toBeInTheDocument();
    expect(screen.getByText('Schritt 1 von 3')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('geht vor und zurück', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness steps={steps()} onFinish={vi.fn()} />);

    // Im ersten Schritt gibt es bewusst kein «Zurück».
    expect(screen.queryByText('Zurück')).not.toBeInTheDocument();

    await user.click(screen.getByText('Weiter'));
    expect(screen.getByText('Was für ein Verein?')).toBeInTheDocument();
    expect(screen.getByText('Schritt 2 von 3')).toBeInTheDocument();

    await user.click(screen.getByText('Zurück'));
    expect(screen.getByText('Wie heisst der Verein?')).toBeInTheDocument();
  });

  it('bietet im letzten Schritt den Abschluss statt «Weiter»', async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    renderWithProviders(<Harness steps={steps()} onFinish={onFinish} />);

    await user.click(screen.getByText('Weiter'));
    await user.click(screen.getByText('Weiter'));

    expect(screen.queryByText('Weiter')).not.toBeInTheDocument();
    await user.click(screen.getByText('Verein erstellen'));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('sperrt den Weg vorwärts bei unvollständiger Eingabe', () => {
    // Geprüft wird die Eigenschaft, die der Wizard an Ionic übergibt, nicht die
    // Wirkung von Ionic: Stencil rendert in jsdom nicht, ein Klick erreicht den
    // Handler auch auf einem gesperrten Knopf (siehe docs/TESTING.md).
    const { container } = renderWithProviders(
      <Harness steps={steps([{ isComplete: false }])} onFinish={vi.fn()} />,
    );

    const next = container.querySelector('ion-button')!;
    expect(ionProp<boolean>(next, 'disabled')).toBe(true);
  });

  it('gibt den Weg vorwärts bei vollständiger Eingabe frei', () => {
    const { container } = renderWithProviders(
      <Harness steps={steps()} onFinish={vi.fn()} />,
    );

    const next = container.querySelector('ion-button')!;
    expect(ionProp<boolean>(next, 'disabled')).toBe(false);
  });

  it('zeigt den Fehler des letzten Versuchs, ohne den Schritt zu verlassen', () => {
    renderWithProviders(
      <Harness steps={steps()} onFinish={vi.fn()} error="Der Name ist zu kurz" />,
    );

    // Failure Postcondition UC-001: Die Eingaben bleiben im Formular stehen.
    expect(screen.getByRole('alert')).toHaveTextContent('Der Name ist zu kurz');
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('sperrt den Abschluss, solange gespeichert wird', () => {
    // Ein zweiter Klick würde einen zweiten Verein anlegen.
    const { container } = renderWithProviders(
      <Harness steps={steps()} onFinish={vi.fn()} isSubmitting />,
    );

    const action = container.querySelector('ion-button')!;
    expect(ionProp<boolean>(action, 'disabled')).toBe(true);
    expect(container.querySelector('ion-spinner')).not.toBeNull();
  });

  it('kommt mit einem unmöglichen Index zurecht', () => {
    renderWithProviders(
      <Wizard
        steps={steps()}
        current={99}
        onCurrentChange={vi.fn()}
        finishLabel="Fertig"
        onFinish={vi.fn()}
      />,
    );

    expect(screen.getByText('Wann beginnt die Saison?')).toBeInTheDocument();
  });
});

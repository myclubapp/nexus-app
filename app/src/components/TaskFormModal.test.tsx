import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { TaskForm } from './TaskFormModal';
import { renderWithProviders } from '../test/utils';

const createMutateAsync = vi.fn();
const publishMutateAsync = vi.fn();

vi.mock('../hooks/useTasks', () => ({
  useCreateTask: () => ({
    mutateAsync: createMutateAsync,
    isPending: false,
    error: null,
  }),
  usePublishTask: () => ({
    mutateAsync: publishMutateAsync,
    isPending: false,
    error: null,
  }),
}));

vi.mock('../hooks/useInvites', () => ({
  useTeams: () => ({ data: [{ id: 'team-1', name: 'Herren 1' }] }),
}));

vi.mock('../hooks/useGamification', () => ({
  usePointRules: () => ({ data: [{ code: 'task_done', points: 35 }] }),
}));

/**
 * `FormModal` steckt in einem `IonModal`, das in jsdom nichts rendert – die
 * Hülle wird deshalb durch gewöhnliches HTML ersetzt, damit der
 * Ausschreiben-Knopf samt gesperrtem Zustand prüfbar ist (docs/TESTING.md).
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
 * UC-017: Die Rechenregeln liegen in `task.test.ts`. Hier steht, was das
 * Formular **sagt und sperrt** – A1 verweigert die Publikation und erklärt
 * sie, A3 kündigt den Entwurf als folgenlos an.
 */
describe('TaskForm', () => {
  beforeEach(() => vi.clearAllMocks());

  function render() {
    return renderWithProviders(<TaskForm onDone={vi.fn()} onDismiss={vi.fn()} />);
  }

  it('sperrt das Ausschreiben, solange Titel und Warum fehlen (A1)', () => {
    render();
    expect(screen.getByRole('button', { name: 'submit' })).toBeDisabled();
  });

  it('erklärt die Sperre, statt nur den Knopf auszugrauen (A1)', () => {
    const { container } = render();
    expect(container.textContent).toContain('braucht einen Titel');
    expect(container.textContent).toContain('wozu sie dient');
  });

  it('nennt das Warum als eigenen Abschnitt, nicht als Feld unter vielen (BR-069)', () => {
    const { container } = render();
    const headers = Array.from(container.querySelectorAll('ion-list-header'));
    expect(headers.some((h) => h.textContent?.includes('Wozu dient das?'))).toBe(true);
  });

  it('sagt, was ein Entwurf bedeutet (A3)', () => {
    const { container } = render();
    expect(container.textContent).toContain('Als Entwurf sichern');
    expect(container.textContent).toContain('nicht sichtbar');
    expect(container.textContent).toContain('benachrichtigt niemanden');
  });

  it('erklärt den Punktwert 0 als Dank statt als Nullwert (FR-040)', () => {
    const { container } = render();
    expect(container.textContent).toContain('gedankt, nicht gepunktet');
  });

  it('bietet den ganzen Verein und die Teams als Geltungsbereich an (Schritt 4)', () => {
    const { container } = render();
    expect(container.textContent).toContain('Ganzer Verein');
    expect(container.textContent).toContain('Herren 1');
  });

  it('zeigt den Rhythmus erst, wenn jemand ihn einschaltet (A2)', () => {
    // Eine Aufgabe wiederholt sich nur auf ausdrückliche Ansage – sonst
    // entstünde aus jedem Versehen eine Aufgabe, die für immer wiederkehrt.
    const { container } = render();
    expect(container.textContent).toContain('Wiederkehrend');
    expect(container.textContent).not.toContain('Alle wie viele Tage?');
  });

  it('schlägt den Punktwert der Vereinsregel vor, statt einer festen Zahl', () => {
    // Zusicherung auf die **Quelle**: `value` kommt an einem `ion-input` in
    // jsdom nicht an, `ionProp()` läse dort Stencils Vorgabe und hielte sie
    // für die eigene Absicht (docs/TESTING.md §6, Vorbild `AppMenu.test.tsx`).
    // Was der Vorschlag rechnet, steht in `task.test.ts`.
    const source = readFileSync(
      `${process.cwd()}/src/components/TaskFormModal.tsx`,
      'utf8',
    );
    expect(source).toContain('pointsOverride ?? suggestedTaskPoints(rules.data)');
    expect(source).not.toMatch(/useState\(\s*20\s*\)/);
  });

  it('schreibt beim Aufbau nichts in die Datenbank', () => {
    render();
    expect(createMutateAsync).not.toHaveBeenCalled();
    expect(publishMutateAsync).not.toHaveBeenCalled();
  });
});

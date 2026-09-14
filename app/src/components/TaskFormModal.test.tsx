import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { TaskForm } from './TaskFormModal';
import { renderWithProviders } from '../test/utils';
import type { Task } from '../lib/database.types';

const createMutateAsync = vi.fn();
const updateMutateAsync = vi.fn();
const publishMutateAsync = vi.fn();

vi.mock('../hooks/useTasks', () => ({
  useCreateTask: () => ({
    mutateAsync: createMutateAsync,
    isPending: false,
    error: null,
  }),
  useUpdateTask: () => ({
    mutateAsync: updateMutateAsync,
    isPending: false,
    error: null,
  }),
  usePublishTask: () => ({
    mutateAsync: publishMutateAsync,
    isPending: false,
    error: null,
  }),
}));

const DRAFT: Task = {
  id: 'task-1',
  club_id: 'club-1',
  team_id: null,
  title: 'Festbeiz-Bewilligung',
  description: null,
  why: 'Ohne Bewilligung keine Beiz',
  category: 'catering',
  points: 20,
  task_type: 'task',
  due_at: null,
  max_assignees: 1,
  status: 'draft',
  created_by: 'member-1',
  created_at: '2026-09-01T10:00:00Z',
  is_sample: false,
  recurrence_days: null,
};

/**
 * Die Reichweite der Planung ist im Test steuerbar (C-032, `0073`): Der
 * Vorstand sieht alle Teams und den ganzen Verein, eine Trainer:in nur ihre
 * Teams. Vorgabe ist der Vorstand; einzelne Fälle stellen um.
 */
const scope = {
  isBoard: true,
  isTrainer: true,
  isLoading: false,
  myTeamIds: ['team-1'],
  teams: [{ id: 'team-1', name: 'Herren 1' }],
  canPlanFor: () => true,
};

function withScope(patch: Partial<typeof scope>, run: () => void) {
  const before = { ...scope };
  Object.assign(scope, patch);
  try {
    run();
  } finally {
    Object.assign(scope, before);
  }
}

vi.mock('../hooks/usePlanningScope', () => ({
  usePlanningScope: () => scope,
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

  it('bietet dem Vorstand den ganzen Verein und die Teams als Geltungsbereich an (Schritt 4)', () => {
    const { container } = render();
    expect(container.textContent).toContain('Ganzer Verein');
    expect(container.textContent).toContain('Herren 1');
  });

  it('bietet einer Trainer:in nur ihre Teams an – ohne «Ganzer Verein» (C-032)', () => {
    // Vereinsaufgaben legt der Vorstand an; die Auswahl sagt das, statt die
    // Option anzubieten und den Server abweisen zu lassen.
    withScope({ isBoard: false }, () => {
      const { container } = render();
      expect(container.textContent).not.toContain('Ganzer Verein');
      expect(container.textContent).toContain('Herren 1');
      expect(container.textContent).toContain(
        'Als Trainer:in schreibst du Aufgaben für deine Teams aus.',
      );
    });
  });

  it('sagt einer Trainer:in ohne Team, warum sie nichts ausschreiben kann (C-032)', () => {
    withScope({ isBoard: false, myTeamIds: [], teams: [] }, () => {
      const { container } = render();
      expect(container.textContent).toContain('Du bist noch keinem Team zugeordnet.');
    });
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

  describe('mit einem Entwurf (A5)', () => {
    function renderDraft() {
      return renderWithProviders(
        <TaskForm task={DRAFT} onDone={vi.fn()} onDismiss={vi.fn()} />,
      );
    }

    it('nennt sich Bearbeiten, nicht Ausschreiben', () => {
      // Der Titel des Blattes kommt aus `FormModal`, das hier ersetzt ist –
      // geprüft wird die Quelle, wie beim Punktevorschlag oben.
      const source = readFileSync(
        `${process.cwd()}/src/components/TaskFormModal.tsx`,
        'utf8',
      );
      expect(source).toContain("t(task ? 'taskForm.editTitle' : 'taskForm.title')");
    });

    it('beginnt mit dem gesicherten Stand: Titel und Warum sind schon da', () => {
      // Die Sperre aus A1 fällt weg, ohne dass jemand tippt – der Beleg, dass
      // die Felder aus dem Entwurf kommen.
      renderDraft();
      expect(screen.getByRole('button', { name: 'submit' })).toBeEnabled();
    });

    it('ändert den Entwurf, statt eine zweite Aufgabe anzulegen (BR-182)', async () => {
      updateMutateAsync.mockResolvedValue(undefined);
      publishMutateAsync.mockResolvedValue({ notified: 0, muted: false });
      renderDraft();
      fireEvent.click(screen.getByRole('button', { name: 'submit' }));
      await vi.waitFor(() => expect(publishMutateAsync).toHaveBeenCalledWith('task-1'));
      expect(updateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-1',
          draft: expect.objectContaining({ title: 'Festbeiz-Bewilligung' }),
        }),
      );
      expect(createMutateAsync).not.toHaveBeenCalled();
    });

    it('sichert den Entwurf erneut, ohne ihn auszuschreiben (A3)', async () => {
      updateMutateAsync.mockResolvedValue(undefined);
      const onDone = vi.fn();
      renderWithProviders(<TaskForm task={DRAFT} onDone={onDone} onDismiss={vi.fn()} />);
      fireEvent.click(screen.getByText('Als Entwurf sichern'));
      await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith(false, false));
      expect(updateMutateAsync).toHaveBeenCalledTimes(1);
      expect(publishMutateAsync).not.toHaveBeenCalled();
    });
  });
});

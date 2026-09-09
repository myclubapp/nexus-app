import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { TaskConfirm } from './TaskConfirmModal';
import { ionProp, renderWithProviders } from '../test/utils';
import type { TaskWithAssignments } from '../lib/task';
import type { TaskRosterEntry } from '../hooks/useTasks';

const confirmMutate = vi.fn();
const rejectMutate = vi.fn();
let roster: TaskRosterEntry[] = [];

vi.mock('../hooks/useTasks', () => ({
  useTaskRoster: () => ({ data: roster, isLoading: false, error: null }),
  useConfirmTask: () => ({ mutate: confirmMutate, isPending: false, error: null }),
  useRejectTask: () => ({ mutate: rejectMutate, isPending: false, error: null }),
}));

vi.mock('../hooks/useClub', () => ({
  useClub: () => ({ activeMembership: { id: 'me' } }),
}));

vi.mock('./FormModal', () => ({
  FormModal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

/**
 * `ion-button` bekommt in jsdom keine ARIA-Rolle – `getByRole('button')`
 * findet es nicht (docs/TESTING.md §6). Gesucht wird deshalb über die
 * Beschriftung, geprüft über die übergebene Eigenschaft.
 */
function button(container: HTMLElement, label: string): Element | undefined {
  return Array.from(container.querySelectorAll('ion-button')).find(
    (element) => element.textContent?.trim() === label,
  );
}

function entry(overrides: Partial<TaskRosterEntry> = {}): TaskRosterEntry {
  return {
    assignmentId: 'a-1',
    memberId: 'm-1',
    displayName: 'Anna Beispiel',
    claimedAt: '2026-09-01T10:00:00Z',
    submittedAt: '2026-09-05T10:00:00Z',
    proofUrl: null,
    confirmedAt: null,
    kudos: null,
    ...overrides,
  };
}

const task = {
  id: 'task-1',
  title: 'Festbeiz-Bewilligung',
  points: 50,
} as TaskWithAssignments;

/**
 * UC-019: Der Use Case dreht die übliche Reihenfolge um – Kudos vor Punktzahl
 * (BR-078). Diese Tests halten genau das fest: Was die Ansicht **sagt**, und
 * was sie **nicht** sagt.
 */
describe('TaskConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    roster = [entry()];
  });

  function render() {
    return renderWithProviders(
      <TaskConfirm task={task} onDone={vi.fn()} onDismiss={vi.fn()} />,
    );
  }

  it('zeigt, wer wann gemeldet hat (Schritt 3)', () => {
    const { container } = render();
    expect(container.textContent).toContain('Anna Beispiel');
    expect(container.textContent).toContain('Gemeldet am');
  });

  it('zeigt den Nachweis als Text und nicht als Verweis', () => {
    // Ein Link aus fremder Hand gehört nicht ungeprüft in einen Klick.
    roster = [entry({ proofUrl: 'https://beleg.example/quittung.pdf' })];
    const { container } = render();

    expect(container.textContent).toContain('https://beleg.example/quittung.pdf');
    expect(container.querySelector('a[href*="beleg.example"]')).toBeNull();
  });

  it('nennt die Punktzahl nirgends als Überschrift (BR-078)', () => {
    const { container } = render();
    expect(container.textContent).not.toContain('50');
  });

  it('weist einmalig darauf hin, dass ein Dankeswort mehr wirkt (A2)', () => {
    const { container } = render();
    expect(container.textContent).toContain('wirkt mehr als die Zahl');
  });

  it('lässt trotzdem bestätigen, wenn kein Dankeswort dasteht (A2)', () => {
    const { container } = render();
    const confirm = button(container, 'Bestätigen');

    expect(confirm).toBeDefined();
    expect(ionProp<boolean>(confirm!, 'disabled')).toBe(false);
  });

  it('sperrt die Nachbesserung, solange kein Hinweis dasteht (A1)', () => {
    const { container } = render();

    act(() => (button(container, 'Nachbessern') as HTMLElement).click());

    expect(container.textContent).toContain('gehört ein Hinweis');
    expect(
      ionProp<boolean>(button(container, 'Zurück an die Person')!, 'disabled'),
    ).toBe(true);
  });

  it('bietet zu einer bestätigten Übernahme keinen zweiten Weg an (A4)', () => {
    roster = [
      entry({ confirmedAt: '2026-09-06T10:00:00Z', kudos: 'Sehr gut gemacht' }),
    ];
    const { container } = render();

    expect(container.textContent).toContain('Sehr gut gemacht');
    expect(button(container, 'Bestätigen')).toBeUndefined();
    expect(button(container, 'Nachbessern')).toBeUndefined();
  });

  it('zeigt eine noch nicht gemeldete Übernahme, ohne sie bestätigen zu lassen', () => {
    roster = [entry({ submittedAt: null })];
    const { container } = render();

    expect(container.textContent).toContain('Noch nicht gemeldet');
    expect(button(container, 'Bestätigen')).toBeUndefined();
  });

  it('erklärt eine Aufgabe ohne Übernahme, statt leer zu bleiben', () => {
    roster = [];
    expect(render().container.textContent).toContain('noch niemand übernommen');
  });

  it('bietet die eigene Übernahme nicht zur eigenen Bestätigung an (BR-080)', () => {
    // Ein Knopf, der jedes Mal eine Fehlermeldung ergibt, ist kein Angebot.
    roster = [entry({ memberId: 'me', displayName: 'Ich selbst' })];
    const { container } = render();

    expect(button(container, 'Bestätigen')).toBeUndefined();
    expect(container.textContent).toContain('bestätigt jemand anderes');
  });

  it('schreibt beim Öffnen nichts in die Datenbank', () => {
    render();
    expect(confirmMutate).not.toHaveBeenCalled();
    expect(rejectMutate).not.toHaveBeenCalled();
  });
});

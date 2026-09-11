import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { TaskDetail } from './TaskDetailModal';
import { renderWithProviders } from '../test/utils';
import type { TaskWithAssignments } from '../lib/task';

const claimMutate = vi.fn();
const submitMutate = vi.fn();
const releaseMutate = vi.fn();

vi.mock('../hooks/useTasks', () => ({
  useClaimTask: () => ({ mutate: claimMutate, isPending: false, error: null }),
  useSubmitTask: () => ({ mutate: submitMutate, isPending: false, error: null }),
  useReleaseTask: () => ({ mutate: releaseMutate, isPending: false, error: null }),
}));

vi.mock('../hooks/useClub', () => ({
  useClub: () => ({ activeMembership: { id: 'me' } }),
}));

/**
 * `FormModal` steckt in einem `IonModal`, das in jsdom nichts rendert
 * (docs/TESTING.md). Der Ersatz zeichnet die Kopfzeile nach: Ohne `onSubmit`
 * zeigt das Blatt nur an, und dann steht dort einzig «Schliessen».
 */
vi.mock('./FormModal', () => ({
  FormModal: ({
    children,
    submitLabel,
    canSubmit,
    onSubmit,
    onDismiss,
  }: {
    children: ReactNode;
    submitLabel?: string;
    canSubmit?: boolean;
    onSubmit?: () => void;
    onDismiss: () => void;
  }) => (
    <div>
      {children}
      {onSubmit ? (
        <button type="button" disabled={canSubmit === false} onClick={onSubmit}>
          {submitLabel}
        </button>
      ) : (
        <button type="button" onClick={onDismiss}>
          Schliessen
        </button>
      )}
    </div>
  ),
}));

function task(overrides: Partial<TaskWithAssignments> = {}): TaskWithAssignments {
  return {
    id: 'task-1',
    club_id: 'club-1',
    team_id: null,
    title: 'Platz mähen',
    description: 'Der Mäher steht im Geräteschuppen.',
    why: 'Damit am Samstag gespielt werden kann',
    category: 'facility',
    points: 10,
    task_type: 'oneoff',
    due_at: null,
    max_assignees: 1,
    status: 'open',
    is_sample: false,
    recurrence_days: null,
    created_by: 'member-x',
    created_at: '2026-09-09T10:00:00Z',
    assignments: [],
    ...overrides,
  } as TaskWithAssignments;
}

/**
 * UC-018: Was die Ansicht **zeigt und zulässt**. Die Entscheidung, welcher Weg
 * offensteht, liegt in `taskAction()` und ist dort geprüft.
 */
describe('TaskDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  function render(entry: TaskWithAssignments) {
    return renderWithProviders(
      <TaskDetail task={entry} onDone={vi.fn()} onDismiss={vi.fn()} />,
    );
  }

  it('zeigt Warum und Beschreibung vollständig, bevor jemand zusagt (Schritt 3)', () => {
    const { container } = render(task());
    expect(container.textContent).toContain('Damit am Samstag gespielt werden kann');
    expect(container.textContent).toContain('Der Mäher steht im Geräteschuppen');
  });

  it('stellt das Warum an den Anfang, nicht unter die Eckdaten', () => {
    const { container } = render(task());
    const headers = Array.from(container.querySelectorAll('ion-list-header'));
    expect(headers[0]).toHaveTextContent('Wozu dient das?');
  });

  it('macht die Belegung sichtbar (BR-073)', () => {
    const entry = task({
      max_assignees: 3,
      assignments: [{ member_id: 'someone' }] as TaskWithAssignments['assignments'],
    });
    expect(render(entry).container.textContent).toContain('1 von 3 übernommen');
  });

  it('bietet der freien Aufgabe das Übernehmen an (Schritt 4)', () => {
    render(task());
    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeEnabled();
  });

  it('sagt bei einer vergebenen Aufgabe, woran es liegt (A1)', () => {
    const taken = task({
      assignments: [{ member_id: 'someone' }] as TaskWithAssignments['assignments'],
    });
    const { container } = render(taken);
    expect(container.textContent).toContain('bereits vergeben');
  });

  it('führt von der eigenen Übernahme zum Melden und bietet den Nachweis an (Schritt 7, A5)', () => {
    const mine = task({
      status: 'claimed',
      assignments: [
        { member_id: 'me', submitted_at: null, confirmed_at: null },
      ] as TaskWithAssignments['assignments'],
    });
    const { container } = render(mine);

    expect(screen.getByRole('button', { name: 'Erledigt melden' })).toBeEnabled();
    expect(container.textContent).toContain('Nachweis');
    expect(container.textContent).toContain('Freiwillig');
  });

  it('sagt bei abgelaufener Frist, dass gemeldet werden darf (A4)', () => {
    const late = task({
      status: 'claimed',
      due_at: '2020-01-01T00:00:00Z',
      assignments: [
        { member_id: 'me', submitted_at: null, confirmed_at: null },
      ] as TaskWithAssignments['assignments'],
    });
    expect(render(late).container.textContent).toContain('Melden kannst du trotzdem');
  });

  it('bietet die Rückgabe an und nennt sie folgenlos (A3, BR-075)', () => {
    const mine = task({
      status: 'claimed',
      assignments: [
        { member_id: 'me', submitted_at: null, confirmed_at: null },
      ] as TaskWithAssignments['assignments'],
    });
    const { container } = render(mine);

    expect(container.textContent).toContain('Doch nicht');
    expect(container.textContent).toContain('Ohne Punkteabzug');
  });

  it('bietet einer fremden Aufgabe keine Rückgabe an', () => {
    const { container } = render(task());
    expect(container.textContent).not.toContain('Doch nicht');
  });

  it('bietet an einer bestätigten Aufgabe weder Melden noch Rückgabe an', () => {
    // Der Marktplatz lädt bestätigte Aufgaben gar nicht mehr; erreicht eine
    // trotzdem diese Ansicht, darf sie nichts anbieten – der Server weist
    // beides ohnehin ab.
    const done = task({
      status: 'done',
      assignments: [
        {
          member_id: 'me',
          submitted_at: '2026-09-01T00:00:00Z',
          confirmed_at: '2026-09-02T00:00:00Z',
        },
      ] as TaskWithAssignments['assignments'],
    });
    const { container } = render(done);

    expect(container.textContent).not.toContain('Doch nicht');
    expect(screen.queryByRole('button', { name: 'Erledigt melden' })).toBeNull();
  });

  it('zeigt nur an, wo es nichts zu tun gibt – mit einem Schliessen statt eines Hauptknopfs', () => {
    // Ein gesperrter «Übernehmen»-Knopf über einer vergebenen Aufgabe sagt das
    // Falsche; das Blatt lässt `onSubmit` weg (guidelines.md §2).
    const taken = task({
      assignments: [{ member_id: 'someone' }] as TaskWithAssignments['assignments'],
    });
    render(taken);
    expect(screen.getByRole('button', { name: 'Schliessen' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Übernehmen' })).toBeNull();
  });

  it('schreibt beim Öffnen nichts in die Datenbank (BR-074)', () => {
    render(task());
    expect(claimMutate).not.toHaveBeenCalled();
    expect(submitMutate).not.toHaveBeenCalled();
    expect(releaseMutate).not.toHaveBeenCalled();
  });

  it('bietet an einem Beispiel nichts zum Übernehmen an (UC-037, A2)', () => {
    // Ein Knopf, der in eine Fehlermeldung führt, wäre ein Versprechen, das die
    // App bricht – `claim_task()` weist ein Beispiel seit `0053` ab.
    const { container } = renderWithProviders(
      <TaskDetail task={task({ is_sample: true })} onDone={vi.fn()} onDismiss={vi.fn()} />,
    );

    expect(container.textContent).toContain('Das ist ein Beispiel');
    expect(container.textContent).not.toContain('Übernehmen');
  });
});

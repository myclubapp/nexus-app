import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShiftList } from './ShiftListModal';
import { renderWithProviders, ionProp } from '../test/utils';
import type { Attendance, EventShift } from '../lib/database.types';

const take = vi.fn();
const release = vi.fn();

vi.mock('../hooks/useShifts', () => ({
  OVERLAP_SIGNAL: 'overlap',
  useTakeShift: () => ({ mutate: take, isPending: false, error: null }),
  useReleaseShift: () => ({ mutate: release, isPending: false, error: null }),
}));

function shift(overrides: Partial<EventShift> = {}): EventShift {
  return {
    id: 's1',
    event_id: 'e1',
    title: 'Aufbau',
    starts_at: '2026-09-20T08:00:00Z',
    ends_at: '2026-09-20T12:00:00Z',
    needed: 2,
    points: 50,
    point_rule_code: 'shift_done',
    ...overrides,
  } as EventShift;
}

function entry(overrides: Partial<Attendance> = {}): Attendance {
  return {
    event_id: 'e1',
    member_id: 'other',
    shift_id: 's1',
    status: 'registered',
    ...overrides,
  } as Attendance;
}

/**
 * UC-012: Geprüft wird, was die Liste **entscheidet** – ob eine Schicht als
 * voll gilt, ob sie als «meine» erkannt wird und ob das Warum vor den
 * Schichten steht. Die Bedienung deckt der manuelle Testplan ab, die
 * Besetzungsrechnung `shift.test.ts`.
 */
describe('ShiftList', () => {
  beforeEach(() => vi.clearAllMocks());

  function render(props: Partial<Parameters<typeof ShiftList>[0]> = {}) {
    return renderWithProviders(
      <ShiftList
        why="Damit das Fest den Nachwuchs finanziert"
        shifts={[shift()]}
        attendance={[]}
        memberId="me"
        {...props}
      />,
    );
  }

  it('stellt das Warum vor die Schichten (Schritt 2, FR-051)', () => {
    const { container } = render();
    const headers = container.querySelectorAll('ion-list-header');
    expect(headers[0]).toHaveTextContent('Wozu dient das?');
    expect(container.textContent).toContain('Damit das Fest den Nachwuchs finanziert');
  });

  it('zeigt Zeitfenster, Punktwert und Besetzung (Schritt 2)', () => {
    const { container } = render();
    expect(container.textContent).toContain('+50');
    expect(container.textContent).toContain('0 von 2 besetzt');
  });

  it('zählt eine Absage nicht als besetzten Platz (BR-046)', () => {
    const { container } = render({
      attendance: [entry(), entry({ member_id: 'x', status: 'excused' })],
    });
    expect(container.textContent).toContain('1 von 2 besetzt');
  });

  it('sperrt eine volle Schicht (BR-046)', () => {
    const { container } = render({
      attendance: [entry({ member_id: 'a' }), entry({ member_id: 'b' })],
    });
    expect(container.textContent).toContain('2 von 2 besetzt');
    const button = container.querySelector('ion-button')!;
    expect(button).toHaveTextContent('Voll');
    expect(ionProp(button, 'disabled')).toBe(true);
  });

  it('bietet der eingetragenen Person das Austragen an (A2, BR-047)', () => {
    const { container } = render({ attendance: [entry({ member_id: 'me' })] });
    expect(container.textContent).toContain('Doch nicht');
    expect(container.textContent).not.toContain('Ich übernehme das');
  });

  it('erkennt die eigene Eintragung nur an der eigenen Mitgliedschaft', () => {
    const { container } = render({ attendance: [entry({ member_id: 'someone-else' })] });
    expect(container.textContent).toContain('Ich übernehme das');
  });

  it('nennt, dass die Punkte erst mit der Bestätigung kommen (BR-045)', () => {
    const { container } = render();
    expect(container.textContent).toContain('bestätigt');
  });

  it('trägt beim Aufbau niemanden ein', () => {
    render();
    expect(take).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it('kommt ohne Warum aus, ohne einen leeren Abschnitt zu zeigen', () => {
    const { container } = render({ why: null });
    expect(container.querySelectorAll('ion-list-header')[0]).not.toHaveTextContent(
      'Wozu dient das?',
    );
  });
});

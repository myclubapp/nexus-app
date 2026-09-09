import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShiftRoster } from './ShiftRosterModal';
import { renderWithProviders } from '../test/utils';
import type { RosterEntry } from '../hooks/useShiftRoster';
import type { EventShift } from '../lib/database.types';

const confirm = vi.fn();
const absence = vi.fn();
let roster: RosterEntry[] = [];
let isLoading = false;
let error: Error | null = null;

vi.mock('../hooks/useShiftRoster', () => ({
  useShiftRoster: () => ({ data: roster, isLoading, error, refetch: vi.fn() }),
  useShiftCandidates: () => ({ data: [], isLoading: false, error: null }),
  useConfirmShift: () => ({ mutate: confirm, isPending: false, error: null }),
  useSetShiftAbsence: () => ({ mutate: absence, isPending: false, error: null }),
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

/**
 * UC-013: Geprüft wird, was die Liste **anbietet** – dass ein bestätigter
 * Einsatz keinen Knopf mehr trägt (BR-052) und dass der Punktwert der Schicht
 * dasteht, bevor jemand bestätigt. Die Buchung selbst liegt in der Datenbank
 * und ist dort nachgemessen.
 */
describe('ShiftRoster', () => {
  beforeEach(() => {
    roster = [
      { memberId: 'm1', displayName: 'Anna Muster', status: 'registered', confirmed: false },
      { memberId: 'm2', displayName: 'Beat Beispiel', status: 'present', confirmed: true },
    ];
    isLoading = false;
    error = null;
    vi.clearAllMocks();
  });

  function render(shifts: EventShift[] = [shift()]) {
    return renderWithProviders(<ShiftRoster shifts={shifts} onDismiss={vi.fn()} />);
  }

  it('nennt den Punktwert der Schicht vor der Bestätigung (BR-042)', () => {
    const { container } = render();
    expect(container.textContent).toContain('+50');
    expect(container.textContent).toContain('Aufbau');
  });

  it('zeigt die Eingetragenen mit ihrem Status (Schritt 2)', () => {
    const { container } = render();
    expect(container.textContent).toContain('Anna Muster');
    expect(container.textContent).toContain('Eingetragen');
    expect(container.textContent).toContain('Beat Beispiel');
  });

  it('bietet für einen bestätigten Einsatz keinen Knopf mehr an (BR-052)', () => {
    // Zurückgenommen wird eine Buchung nie – korrigiert wird sie mit einer
    // Gegenbuchung (UC-021).
    const { container } = render();
    const items = container.querySelectorAll('ion-item');
    const beat = Array.from(items).find((item) =>
      item.textContent?.includes('Beat Beispiel'),
    )!;
    expect(beat.querySelector('ion-button')).toBeNull();
    expect(beat).toHaveTextContent('Bestätigt');
  });

  it('bietet für einen offenen Eintrag Bestätigen und «War nicht da» (A1)', () => {
    const { container } = render();
    const items = container.querySelectorAll('ion-item');
    const anna = Array.from(items).find((item) =>
      item.textContent?.includes('Anna Muster'),
    )!;
    expect(anna.querySelectorAll('ion-button')).toHaveLength(2);
  });

  it('erklärt, wofür die Bestätigung steht', () => {
    const { container } = render();
    expect(container.textContent).toContain('tatsächlich im Einsatz');
  });

  it('zeigt eine leere Schicht erklärt statt leer (NFR-037)', () => {
    roster = [];
    const { container } = render();
    expect(container.textContent).toContain('niemand eingetragen');
  });

  it('lässt bei einer einzigen Schicht die Auswahl weg', () => {
    const { container } = render();
    expect(container.querySelector('ion-segment')).toBeNull();
  });

  it('bietet bei mehreren Schichten die Auswahl an', () => {
    const { container } = render([shift(), shift({ id: 's2', title: 'Abbau' })]);
    // `value` an einem Ionic-Formularelement ist in jsdom nicht auslesbar
    // (docs/TESTING.md §6); geprüft wird deshalb, dass beide Schichten zur
    // Wahl stehen.
    expect(container.querySelector('ion-segment')).not.toBeNull();
    const buttons = container.querySelectorAll('ion-segment-button');
    expect(buttons).toHaveLength(2);
    expect(buttons[1]).toHaveTextContent('Abbau');
  });

  it('zeigt beim Laden ein Gerüst statt eines Spinners (guidelines)', () => {
    isLoading = true;
    const { container } = render();
    expect(container.querySelector('ion-skeleton-text')).not.toBeNull();
    expect(container.textContent).not.toContain('Anna Muster');
  });

  it('zeigt einen Fehler erklärt und mit Ausweg (NFR-037)', () => {
    error = new Error('Nur der Vorstand sieht die Einsatzliste');
    const { container } = render();
    expect(container.textContent).toContain('Nur der Vorstand sieht die Einsatzliste');
    // Ein Fehlerzustand ohne Handlungsangebot wäre eine Sackgasse.
    expect(container.querySelector('ion-button')).not.toBeNull();
  });

  it('bucht beim Aufbau nichts (BR-050)', () => {
    render();
    expect(confirm).not.toHaveBeenCalled();
    expect(absence).not.toHaveBeenCalled();
  });
});

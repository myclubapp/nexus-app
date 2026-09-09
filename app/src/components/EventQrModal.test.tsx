import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventQr } from './EventQrModal';
import { renderWithProviders, ionProp } from '../test/utils';
import type { EventRosterEntry } from '../hooks/useCheckIn';

const mark = vi.fn();
let roster: EventRosterEntry[] = [];
let token: string | undefined = 'abc123';
let tokenError: Error | null = null;

vi.mock('../hooks/useCheckIn', () => ({
  useEventQrToken: () => ({
    data: token,
    isLoading: false,
    error: tokenError,
    refetch: vi.fn(),
  }),
  useEventRoster: () => ({ data: roster, isLoading: false, error: null, refetch: vi.fn() }),
  useMarkAttendance: () => ({ mutate: mark, isPending: false, error: null }),
}));

// Der Code selbst entsteht asynchron aus `qrcode`; für die Prüfung genügt,
// dass er den richtigen Wert und eine Beschreibung bekommt.
vi.mock('./QrCode', () => ({
  QrCode: ({ value, label }: { value: string; label: string }) => (
    <img data-testid="qr" alt={label} data-value={value} />
  ),
}));

/**
 * UC-014: Geprüft wird, was das Blatt der Trainer:in **anbietet** – der Code
 * mit dem Token dieses Termins (BR-055) und der Weg für alle, die nicht
 * scannen können (A6).
 */
describe('EventQr', () => {
  beforeEach(() => {
    roster = [
      { memberId: 'm1', displayName: 'Anna Muster', status: 'registered' },
      { memberId: 'm2', displayName: 'Beat Beispiel', status: 'present' },
      { memberId: 'm3', displayName: 'Carla Muster', status: 'open' },
    ];
    token = 'abc123';
    tokenError = null;
    vi.clearAllMocks();
  });

  function render() {
    return renderWithProviders(<EventQr eventId="e1" onDismiss={vi.fn()} />);
  }

  it('zeigt den Code mit dem Token dieses Termins (BR-055)', () => {
    const { getByTestId } = render();
    expect(getByTestId('qr')).toHaveAttribute('data-value', 'abc123');
  });

  it('gibt dem Code eine Beschreibung für Bedienhilfen', () => {
    // Ein QR-Bild ist für Bedienhilfen wertlos, wenn es nicht sagt, was es ist.
    const { getByTestId } = render();
    expect(getByTestId('qr')).toHaveAccessibleName('Check-in-Code dieses Termins');
  });

  it('nennt das Zeitfenster, bevor jemand vergeblich scannt (A1)', () => {
    const { container } = render();
    expect(container.textContent).toContain('30 Minuten vor Beginn');
  });

  it('zeigt die Teilnehmerliste mit ihrem Stand (A6)', () => {
    const { container } = render();
    expect(container.textContent).toContain('Anna Muster');
    expect(container.textContent).toContain('Zugesagt');
    expect(container.textContent).toContain('Noch offen');
  });

  it('bietet für Anwesende das Zurücknehmen an, für andere das Erfassen', () => {
    const { container } = render();
    const items = Array.from(container.querySelectorAll('ion-item'));
    const beat = items.find((item) => item.textContent?.includes('Beat Beispiel'))!;
    const anna = items.find((item) => item.textContent?.includes('Anna Muster'))!;
    // Beat ist anwesend – sein Knopf ist gefüllt und trägt den Zustand.
    expect(ionProp(beat.querySelector('ion-button')!, 'fill')).toBe('solid');
    expect(ionProp(anna.querySelector('ion-button')!, 'fill')).toBe('outline');
  });

  it('erklärt, wofür die Liste da ist', () => {
    const { container } = render();
    expect(container.textContent).toContain('nicht scannen können');
  });

  it('übersetzt den Fehler, statt den Datenbanktext durchzureichen (C-007)', () => {
    // Die Meldungen der Datenbank sind deutsch und für Entwickler geschrieben.
    // Eine französischsprachige Person bekäme sonst rohen deutschen Text.
    tokenError = new Error('Nur Trainer:innen und der Vorstand erfassen die Anwesenheit');
    const { container } = render();
    expect(container.textContent).toContain('Dafür fehlt dir die Berechtigung');
    expect(container.textContent).not.toContain('Nur Trainer:innen');
  });

  it('zeigt eine leere Teilnehmerliste erklärt statt leer (NFR-037)', () => {
    roster = [];
    const { container } = render();
    expect(container.textContent).toContain('niemand vorgesehen');
  });

  it('erfasst beim Aufbau niemanden', () => {
    render();
    expect(mark).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { ShiftList } from './ShiftListModal';
import { renderWithProviders } from '../test/utils';
import type { Attendance, EventShift } from '../lib/database.types';

const take = vi.fn();
const release = vi.fn();
const addToDeviceCalendar = vi.fn((_entry: unknown) => Promise.resolve());

vi.mock('../lib/calendar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/calendar')>()),
  addToDeviceCalendar: (entry: unknown) => addToDeviceCalendar(entry),
}));

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
        eventTitle="Sommerfest"
        location="Festplatz"
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
    // Guidelines §2: im Badge nur die Zahl, der Wortlaut für Bedienhilfen.
    const badge = container.querySelector('ion-badge')!;
    expect(badge).toHaveTextContent('0/2');
    expect(badge).toHaveAttribute('aria-label', '0 von 2 besetzt');
    expect(container.textContent).not.toContain('besetzt');
  });

  it('zählt eine Absage nicht als besetzten Platz (BR-046)', () => {
    const { container } = render({
      attendance: [entry(), entry({ member_id: 'x', status: 'excused' })],
    });
    expect(container.querySelector('ion-badge')).toHaveTextContent('1/2');
  });

  it('sperrt eine volle Schicht (BR-046)', () => {
    const { container } = render({
      attendance: [entry({ member_id: 'a' }), entry({ member_id: 'b' })],
    });
    expect(container.querySelector('ion-badge')).toHaveTextContent('2/2');
    // Nichts mehr zu entscheiden: Anzeige statt Knopf, und keine Wischgeste.
    expect(screen.getByRole('img', { name: 'Voll besetzt' })).toBeTruthy();
    expect(container.querySelector('ion-item-option')).toBeNull();
  });

  it('bietet der eingetragenen Person das Austragen an (A2, BR-047)', () => {
    const { container } = render({ attendance: [entry({ member_id: 'me' })] });
    // Der Stand ist das Symbol – tippen trägt aus, wischen ebenso.
    expect(
      container.querySelector('ion-button[aria-label="Übernommen – tippen zum Austragen"]'),
    ).not.toBeNull();
    expect(container.querySelector('ion-item-option[aria-label="Doch nicht"]')).not.toBeNull();
    expect(container.querySelector('ion-item-option[aria-label="Ich übernehme das"]')).toBeNull();
  });

  it('erkennt die eigene Eintragung nur an der eigenen Mitgliedschaft', () => {
    const { container } = render({ attendance: [entry({ member_id: 'someone-else' })] });
    expect(
      container.querySelector('ion-button[aria-label="Noch frei – tippen zum Übernehmen"]'),
    ).not.toBeNull();
    expect(container.querySelector('ion-item-option[aria-label="Ich übernehme das"]')).not.toBeNull();
  });

  it('zeigt eine abgesagte Schicht als Absage, nicht als offen', () => {
    const { container } = render({
      attendance: [entry({ member_id: 'me', status: 'excused' })],
    });
    expect(
      container.querySelector('ion-button[aria-label="Abgesagt – tippen zum Übernehmen"]'),
    ).not.toBeNull();
    // Die Schicht ist wieder frei – übernehmen geht weiter, ein zweites
    // Absagen wäre dagegen ohne Wirkung.
    expect(container.querySelector('ion-item-option[aria-label="Ich übernehme das"]')).not.toBeNull();
    expect(container.querySelector('ion-item-option[aria-label="Doch nicht"]')).toBeNull();
  });

  it('lässt auch ohne Eintragung absagen (A2)', () => {
    // «Ich kann hier nicht» ist eine Antwort, keine Rücknahme: Die Zeile
    // bietet beides an, solange die Schicht offen ist.
    const { container } = render();
    expect(container.querySelector('ion-item-option[aria-label="Ich übernehme das"]')).not.toBeNull();
    fireEvent.click(container.querySelector('ion-item-option[aria-label="Doch nicht"]')!);
    expect(release).toHaveBeenCalledWith('s1', expect.anything());
  });

  it('nimmt einen bestätigten Einsatz nicht mehr zurück', () => {
    // `release_shift` weist das ab – dann darf die Zeile es gar nicht anbieten.
    const { container } = render({
      attendance: [entry({ member_id: 'me', status: 'present' })],
    });
    expect(screen.getByRole('img', { name: 'Einsatz bestätigt' })).toBeTruthy();
    expect(container.querySelector('ion-item-option')).toBeNull();
  });

  it('trägt über die Wischgeste ein und wieder aus (A2)', () => {
    const { container } = render();
    fireEvent.click(container.querySelector('ion-item-option[aria-label="Ich übernehme das"]')!);
    expect(take).toHaveBeenCalledWith({ shiftId: 's1', acceptOverlap: false }, expect.anything());

    const engaged = render({ attendance: [entry({ member_id: 'me' })] });
    // Wer eingetragen ist, bekommt nur noch die Absage angeboten.
    expect(
      engaged.container.querySelector('ion-item-option[aria-label="Ich übernehme das"]'),
    ).toBeNull();
    fireEvent.click(
      engaged.container.querySelector('ion-item-option[aria-label="Doch nicht"]')!,
    );
    expect(release).toHaveBeenCalledWith('s1', expect.anything());
  });

  it('stellt die Besetzung ans Zeilenende, nicht in den Text (guidelines §2)', () => {
    const { container } = render();
    // Die Besetzung hängt am Item, nicht im Text des Labels – so steht sie
    // am Zeilenende wie die Zahlen der Agenda. (`slot` selbst setzt der
    // Ionic-Wrapper erst im Browser als Eigenschaft.)
    expect(container.querySelector('ion-label ion-badge')).toBeNull();
    expect(container.querySelector('ion-item > ion-badge')).not.toBeNull();
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

  it('bietet die Schicht nach dem Eintrag dem Kalender des Geräts an (FR-156)', () => {
    take.mockImplementationOnce((_input, options) => options.onSuccess({ filled: 1, needed: 2 }));
    const { container } = render({
      shifts: [shift({ starts_at: '2099-09-20T08:00:00Z', ends_at: '2099-09-20T12:00:00Z' })],
    });

    fireEvent.click(
      container.querySelector('ion-button[aria-label="Noch frei – tippen zum Übernehmen"]')!,
    );
    expect(take).toHaveBeenCalledWith({ shiftId: 's1', acceptOverlap: false }, expect.anything());
    // Das Fenster der Schicht, nicht des Anlasses; der Anlass im Titel und in den Notizen.
    expect(addToDeviceCalendar).toHaveBeenCalledWith({
      title: 'Aufbau – Sommerfest',
      location: 'Festplatz',
      notes: 'Sommerfest\n\nDamit das Fest den Nachwuchs finanziert',
      startsAt: Date.parse('2099-09-20T08:00:00Z'),
      endsAt: Date.parse('2099-09-20T12:00:00Z'),
    });
  });

  it('gibt der eingetragenen Person ein Kalender-Symbol an der Zeile (FR-156)', () => {
    const { container } = render({
      shifts: [shift({ starts_at: '2099-09-20T08:00:00Z', ends_at: '2099-09-20T12:00:00Z' })],
      attendance: [entry({ member_id: 'me' })],
    });
    const button = container.querySelector('ion-button[aria-label="In den Kalender eintragen"]');
    expect(button).not.toBeNull();
    fireEvent.click(button!);
    expect(addToDeviceCalendar).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
  });

  it('kommt ohne Warum aus, ohne einen leeren Abschnitt zu zeigen', () => {
    const { container } = render({ why: null });
    expect(container.querySelectorAll('ion-list-header')[0]).not.toHaveTextContent(
      'Wozu dient das?',
    );
  });
});

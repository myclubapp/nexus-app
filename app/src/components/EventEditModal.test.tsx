import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEdit } from './EventEditModal';
import { ionProp, renderWithProviders } from '../test/utils';
import type { AppEvent } from '../lib/database.types';

const updateMutate = vi.fn();
const cancelMutate = vi.fn();

vi.mock('../hooks/useEvents', () => ({
  useUpdateEvent: () => ({ mutate: updateMutate, isPending: false, error: null }),
  useCancelEvent: () => ({ mutate: cancelMutate, isPending: false, error: null }),
}));

vi.mock('../hooks/useGamification', () => ({
  usePointRules: () => ({
    data: [{ code: 'training_attend', label: 'Training besucht' }],
  }),
}));

/** `IonModal` rendert seinen Inhalt in jsdom nicht (docs/TESTING.md §6.5). */
vi.mock('./FormModal', () => ({
  FormModal: ({
    children,
    canSubmit,
  }: {
    children: ReactNode;
    canSubmit?: boolean;
  }) => (
    <div>
      <button type="button" id="modal-submit" disabled={canSubmit === false} />
      {children}
    </div>
  ),
}));

/** `ion-button` bekommt in jsdom keine ARIA-Rolle (docs/TESTING.md §6.1). */
function button(container: HTMLElement, label: string): Element | undefined {
  return Array.from(container.querySelectorAll('ion-button')).find(
    (element) => element.textContent?.trim() === label,
  );
}

function event(overrides: Partial<AppEvent> = {}): AppEvent {
  return {
    id: 'e-1',
    club_id: 'c-1',
    team_id: null,
    series_id: null,
    type: 'training',
    title: 'Training Mittwoch',
    why: null,
    location: 'Halle',
    starts_at: '2099-01-01T18:00:00.000Z',
    ends_at: '2099-01-01T20:00:00.000Z',
    published_at: '2026-09-01T10:00:00.000Z',
    cancelled_at: null,
    cancelled_reason: null,
    point_rule_code: 'training_attend',
    capacity_needed: null,
    is_sample: false,
    created_by: 'm-1',
    ...overrides,
  } as AppEvent;
}

/**
 * UC-009 A2 und FR-023 – beides war gebaut und unerreichbar.
 *
 * Eine Ionic-Eingabe lässt sich in jsdom nicht bedienen (docs/TESTING.md §6.4);
 * die Regeln stehen deshalb in `lib/eventSeries.ts` und werden dort geprüft.
 * Hier steht, **was in welchem Zustand zu sehen ist**.
 */
describe('EventEdit', () => {
  beforeEach(() => vi.clearAllMocks());

  function render(overrides: Partial<AppEvent> = {}) {
    return renderWithProviders(
      <EventEdit event={event(overrides)} onDone={vi.fn()} onDismiss={vi.fn()} />,
    );
  }

  it('stellt die Serienfrage nur bei einem Termin mit Serie (A2)', () => {
    // Eine Auswahl mit einer Möglichkeit ist keine Frage.
    const ohne = render();
    expect(ohne.container.textContent).not.toContain('Die ganze Serie');

    const mit = render({ series_id: 's-1' });
    expect(mit.container.textContent).toContain('Die ganze Serie');
  });

  it('sperrt die Absage, solange kein Grund steht (BR-035)', () => {
    const { container } = render();
    expect(ionProp<boolean>(button(container, 'Termin absagen')!, 'disabled')).toBe(true);
    expect(container.textContent).toContain('Zu einer Absage gehört ihr Grund.');
  });

  it('bietet einem bereits abgesagten Termin keine zweite Absage an', () => {
    // Der Grund steht, und alle Betroffenen haben ihn gelesen.
    const { container } = render({
      cancelled_at: '2026-09-05T08:00:00.000Z',
      cancelled_reason: 'Halle gesperrt',
    });
    expect(button(container, 'Termin absagen')).toBeUndefined();
    expect(container.textContent).not.toContain('Grund der Absage');
  });

  it('bietet einem vergangenen Termin keine Absage an', () => {
    const { container } = render({ starts_at: '2020-01-01T18:00:00.000Z' });
    expect(button(container, 'Termin absagen')).toBeUndefined();
  });

  it('verlangt auch beim Ändern das Warum eines Aufrufs (BR-036)', () => {
    // Ein Helfer-Event ohne Warum bliebe ein Aufruf ohne Sinnzusammenhang –
    // die Regel gilt beim Ändern wie beim Anlegen.
    const { container } = render({ type: 'helper', why: null });
    expect(container.querySelector<HTMLButtonElement>('#modal-submit')!.disabled).toBe(
      true,
    );
    expect(container.textContent).toContain('Ein Aufruf braucht sein Warum.');
  });

  it('lässt einen vollständigen Aufruf speichern', () => {
    const { container } = render({ type: 'helper', why: 'Damit das Fest gelingt' });
    expect(container.querySelector<HTMLButtonElement>('#modal-submit')!.disabled).toBe(
      false,
    );
  });
});

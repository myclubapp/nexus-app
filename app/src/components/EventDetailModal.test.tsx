import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { EventDetail } from './EventDetailModal';
import { renderWithProviders } from '../test/utils';
import type { AgendaEvent } from '../hooks/useAgenda';

const respond = vi.fn();
const addToDeviceCalendar = vi.fn((_entry: unknown) => Promise.resolve());
const openNavigation = vi.fn();

vi.mock('../hooks/useAgenda', () => ({
  useRespondToEvent: () => ({ mutate: respond, isPending: false, error: null }),
}));

// Der Weg zum Gerät ist nativ oder ein Download – hier zählt nur, **womit**
// er gerufen wird; die Zuordnung selbst prüft `calendar.test.ts`.
vi.mock('../lib/calendar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/calendar')>()),
  addToDeviceCalendar: (entry: unknown) => addToDeviceCalendar(entry),
}));

// Die Navigation öffnet das System; hier zählt nur, wohin (`map.test.ts`
// prüft die Adressen je Plattform).
vi.mock('../lib/map', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/map')>()),
  openNavigation: (...args: unknown[]) => openNavigation(...args),
}));

// MapLibre braucht WebGL; das Blatt lädt die Karte ohnehin erst nach
// (`lazy`). Der Stub zeigt, was das Blatt hineinreicht – die Karte selbst
// prüft `VenueMap.test.tsx`.
vi.mock('./VenueMap', () => ({
  VenueMap: ({
    point,
    label,
  }: {
    point: { latitude: number; longitude: number };
    label: string | null;
  }) => <div data-testid="venue-map">{`${point.latitude},${point.longitude} ${label ?? ''}`}</div>,
}));

function event(overrides: Partial<AgendaEvent> = {}): AgendaEvent {
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
    shifts: [],
    attendance: [],
    ...overrides,
  } as AgendaEvent;
}

const members = [
  { id: 'me', display_name: 'Anna Muster' },
  { id: 'other', display_name: 'Beat Beispiel' },
];

/** `ion-item` und `ion-button` haben in jsdom keine ARIA-Rolle (docs/TESTING.md §6.1). */
function byText(container: HTMLElement, tag: string, text: string): Element | undefined {
  return Array.from(container.querySelectorAll(tag)).find(
    (element) => element.textContent?.trim() === text,
  );
}

/**
 * Der Pfeil am Zeilenende (guidelines §2). Stencil spiegelt `detail` in jsdom
 * nicht ins Attribut – die Eigenschaft am Element ist die einzige Auskunft.
 */
function hasDetailArrow(row: Element): boolean {
  return (row as unknown as { detail?: boolean }).detail === true;
}

/**
 * UC-010 Schritt 2, nach dem Umbau der Agenda-Zeile: Die Wege, die dort als
 * Knöpfe im klickbaren Item standen (Erinnern, Check-in, Code, Bearbeiten,
 * Einsätze, Ausschreiben), stehen jetzt hier – und **nur**, wenn die Seite
 * sie hereinreicht. Das Blatt entscheidet nichts selbst; es zeigt, was es
 * bekommt. Und «Mein Status» ist derselbe Ampel-Knopf wie in der alten App.
 */
describe('EventDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  function render(
    overrides: Partial<AgendaEvent> = {},
    props: Partial<Parameters<typeof EventDetail>[0]> = {},
  ) {
    return renderWithProviders(
      <EventDetail
        event={event(overrides)}
        members={members}
        memberId="me"
        isTrainer={false}
        eventLabel={(type) => type}
        onDecline={vi.fn()}
        {...props}
      />,
    );
  }

  it('zeigt ohne hereingereichte Wege keine Aktionen', () => {
    const { container } = render();
    expect(container.textContent).not.toContain('Einchecken');
    expect(container.textContent).not.toContain('QR-Code zeigen');
    expect(container.textContent).not.toContain('Verwalten');
  });

  it('bietet Check-in und Code als Knöpfe an, sobald das Fenster offen ist', () => {
    const onCheckIn = vi.fn();
    const onShowQr = vi.fn();
    const { container } = render({}, { onCheckIn, onShowQr });

    fireEvent.click(byText(container, 'ion-button', 'Einchecken')!);
    fireEvent.click(byText(container, 'ion-button', 'QR-Code zeigen')!);
    expect(onCheckIn).toHaveBeenCalledTimes(1);
    expect(onShowQr).toHaveBeenCalledTimes(1);
  });

  it('führt die Wege der planenden Seite als Zeilen unter «Verwalten»', () => {
    // Befund 4: Bearbeiten und Einsätze bestätigen gab es nur als Wischgeste.
    const onEdit = vi.fn();
    const onOpenRoster = vi.fn();
    const onRemind = vi.fn();
    const { container } = render({}, { isTrainer: true, onEdit, onOpenRoster, onRemind });

    expect(byText(container, 'ion-list-header', 'Verwalten')).toBeDefined();
    fireEvent.click(byText(container, 'ion-item', 'Bearbeiten')!);
    fireEvent.click(byText(container, 'ion-item', 'Einsätze bestätigen')!);
    fireEvent.click(byText(container, 'ion-item', 'Erinnern')!);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onOpenRoster).toHaveBeenCalledTimes(1);
    expect(onRemind).toHaveBeenCalledTimes(1);
  });

  it('stellt «Termin löschen» zuletzt unter «Verwalten» (Entscheid 2026-09-13)', () => {
    const onDelete = vi.fn();
    const onEdit = vi.fn();
    const { container } = render({}, { isTrainer: true, onDelete, onEdit });

    const header = byText(container, 'ion-list-header', 'Verwalten')!;
    const rows = Array.from(header.nextElementSibling?.querySelectorAll('ion-item') ?? []);
    const labels = rows.map((row) => row.textContent?.trim());
    expect(labels.indexOf('Termin löschen')).toBe(labels.length - 1);
    expect(labels.indexOf('Bearbeiten')).toBeLessThan(labels.indexOf('Termin löschen'));

    // Die rote Farbe hängt am `ion-label` als Ionic-Eigenschaft, die jsdom
    // nicht spiegelt (docs/TESTING.md §6.1) – geprüft wird deshalb die
    // Reihenfolge, nicht die Farbe.
    fireEvent.click(byText(container, 'ion-item', 'Termin löschen')!);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('lässt einen Entwurf ausschreiben und nennt, was ein Entwurf ist (A2)', () => {
    const onPublish = vi.fn();
    const { container } = render({ published_at: null }, { onPublish });

    expect(container.textContent).toContain('für Mitglieder nicht sichtbar');
    fireEvent.click(byText(container, 'ion-item', 'Ausschreiben')!);
    expect(onPublish).toHaveBeenCalledTimes(1);
    // In einen Entwurf antwortet niemand – kein Status, keine Listen.
    expect(container.textContent).not.toContain('Mein Status');
    expect(container.textContent).not.toContain('Keine Antwort');
  });

  it('schaltet «Mein Status» über das Ampel-Symbol um, nicht über die Zeile', () => {
    // Befund 12: kein `IonFabButton` im Item; der Knopf ist das Symbol selbst
    // (dieselbe Komponente wie am Zeilenanfang der Agenda).
    const { container } = render();
    const button = container.querySelector(
      'ion-button[aria-label="Noch offen – tippen zum Zusagen"]',
    );
    expect(button).not.toBeNull();
    expect(container.querySelector('ion-fab-button')).toBeNull();

    fireEvent.click(button!);
    expect(respond).toHaveBeenCalledWith(
      { eventId: 'e-1', status: 'registered' },
      expect.anything(),
    );
  });

  it('bietet den Termin nach der Zusage dem Kalender des Geräts an (FR-156)', () => {
    respond.mockImplementationOnce((_input, options) => options.onSuccess());
    const { container } = render();

    fireEvent.click(
      container.querySelector('ion-button[aria-label="Noch offen – tippen zum Zusagen"]')!,
    );
    expect(addToDeviceCalendar).toHaveBeenCalledWith({
      title: 'Training Mittwoch',
      location: 'Halle',
      notes: 'training',
      startsAt: Date.parse('2099-01-01T18:00:00.000Z'),
      endsAt: Date.parse('2099-01-01T20:00:00.000Z'),
    });
  });

  it('führt für Zugesagte eine Zeile zum Kalender, für Unentschlossene keine (FR-156)', () => {
    const undecided = render();
    expect(undecided.container.textContent).not.toContain('In den Kalender eintragen');
    undecided.unmount();

    const { container } = render({
      attendance: [{ event_id: 'e-1', member_id: 'me', shift_id: null, status: 'registered' }] as AgendaEvent['attendance'],
    });
    const row = byText(container, 'ion-item', 'In den Kalender eintragen')!;
    // guidelines §2: Die Zeile führt weiter – also steht der Pfeil rechts.
    // guidelines §2: Die Zeile führt weiter – also steht der Pfeil rechts.
    expect(hasDetailArrow(row)).toBe(true);
    fireEvent.click(row);
    expect(addToDeviceCalendar).toHaveBeenCalledTimes(1);
    // Die Zeile bietet an, sie sagt nicht zu.
    expect(respond).not.toHaveBeenCalled();
  });

  it('leitet die Absage an das Blatt mit dem Grund weiter (A1)', () => {
    const onDecline = vi.fn();
    const { container } = render(
      { attendance: [{ event_id: 'e-1', member_id: 'me', shift_id: null, status: 'registered' }] as AgendaEvent['attendance'] },
      { onDecline },
    );

    fireEvent.click(
      container.querySelector('ion-button[aria-label="Zugesagt – tippen zum Absagen"]')!,
    );
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(respond).not.toHaveBeenCalled();
  });

  it('zeigt Unterdeckung und Schichtbesetzung, die die Zeile nicht mehr trägt (Befund 14)', () => {
    const onOpenShifts = vi.fn();
    const { container } = render(
      {},
      { coverageGap: 2, shiftCoverage: { filled: 1, needed: 4 }, onOpenShifts },
    );

    expect(container.textContent).toContain('Noch 2 Zusagen fehlen');
    expect(container.textContent).toContain('1 von 4 besetzt');
    fireEvent.click(byText(container, 'ion-item', 'Schichten1 von 4 besetzt')!);
    expect(onOpenShifts).toHaveBeenCalledTimes(1);
  });

  it('kennt bei einem Termin mit Schichten keine Zusage zum Anlass (BR-196)', () => {
    // Die Schicht ist die Antwort: kein «Mein Status», keine drei Listen –
    // ein Haken neben «2 von 2 besetzt» wäre eine Anmeldung, die es nicht
    // gibt. Der Weg zu den Schichten bleibt.
    const onOpenShifts = vi.fn();
    const { container } = render(
      {
        type: 'helper',
        shifts: [{ id: 's-1', needed: 2 }] as AgendaEvent['shifts'],
        attendance: [
          { event_id: 'e-1', member_id: 'other', shift_id: null, status: 'registered' },
        ] as AgendaEvent['attendance'],
      },
      { shiftCoverage: { filled: 2, needed: 2 }, onOpenShifts },
    );

    expect(container.textContent).not.toContain('Mein Status');
    expect(container.querySelector('ion-accordion-group')).toBeNull();
    fireEvent.click(byText(container, 'ion-item', 'Schichten2 von 2 besetzt')!);
    expect(onOpenShifts).toHaveBeenCalledTimes(1);
  });

  it('stellt das Warum als Text, nicht als Listenzeile (Befund 13)', () => {
    const { container } = render({ why: 'Damit das Fest den Nachwuchs finanziert' });
    const text = container.querySelector('.app-text');
    expect(text).toHaveTextContent('Damit das Fest den Nachwuchs finanziert');
  });

  it('versteckt die Symbole der Eckdaten vor Bedienhilfen (Befund 3)', () => {
    const { container } = render();
    const icons = Array.from(container.querySelectorAll('ion-item > ion-icon'));
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('nennt den Verband beim Namen – und ein übernommenes Training nur beim Namen (UC-039, UC-040)', () => {
    const legacy = render({ external_id: 'legacy:training:tr1' } as Partial<AgendaEvent>);
    expect(legacy.container.textContent).toContain('training');
    expect(legacy.container.textContent).not.toContain('Swiss Unihockey');
    expect(legacy.container.textContent).not.toContain('Verband');

    const match = render({ type: 'match', external_id: 'swissunihockey:12345' } as Partial<AgendaEvent>);
    expect(match.container.textContent).toContain('match · Swiss Unihockey');
    expect(match.container.textContent).not.toContain('Vom Verband');
  });

  it('zeigt die Karte und «Navigation starten» nur, wo der Verband die Lage nennt (C-006)', async () => {
    const without = render({ type: 'match', external_id: 'swissunihockey:1' } as Partial<AgendaEvent>);
    expect(without.container.querySelector('[data-testid="venue-map"]')).toBeNull();
    expect(without.container.textContent).not.toContain('Navigation starten');

    const located = render({
      type: 'match',
      external_id: 'swissunihockey:2',
      location: 'Turnhalle Hatzenbühl, Nürensdorf',
      latitude: 47.452,
      longitude: 8.647,
    } as Partial<AgendaEvent>);
    // Die Karte kommt nachgeladen – erst der Platzhalter, dann sie.
    await waitFor(() =>
      expect(located.container.querySelector('[data-testid="venue-map"]')).toHaveTextContent(
        '47.452,8.647 Turnhalle Hatzenbühl, Nürensdorf',
      ),
    );
    // Sie steht zuoberst, vor den Eckdaten.
    const map = located.container.querySelector('[data-testid="venue-map"]')!;
    const facts = located.container.querySelector('ion-list')!;
    expect(map.compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const navigateRow = byText(located.container, 'ion-item', 'Navigation starten')!;
    // guidelines §2: auch diese Zeile führt weiter – in die Navigation des Geräts.
    expect(hasDetailArrow(navigateRow)).toBe(true);
    fireEvent.click(navigateRow);
    expect(openNavigation).toHaveBeenCalledWith(
      { latitude: 47.452, longitude: 8.647 },
      'Turnhalle Hatzenbühl, Nürensdorf',
    );
  });

  it('stellt «Verwalten» ans Ende des Blatts, nach dem Teilnehmerstand (guidelines §2)', () => {
    const { container } = render(
      {
        attendance: [
          { event_id: 'e-1', member_id: 'other', shift_id: null, status: 'registered' },
        ] as AgendaEvent['attendance'],
      },
      { isTrainer: true, onEdit: vi.fn(), onDelete: vi.fn() },
    );

    const roster = container.querySelector('ion-accordion-group')!;
    const manage = byText(container, 'ion-list-header', 'Verwalten')!;
    expect(roster).toBeDefined();
    // «Verwalten» folgt dem Teilnehmerstand – und nichts folgt «Verwalten».
    expect(roster.compareDocumentPosition(manage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const headers = Array.from(container.querySelectorAll('ion-list-header'));
    expect(headers[headers.length - 1]).toBe(manage);
  });
});

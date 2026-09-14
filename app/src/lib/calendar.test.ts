import { beforeEach, describe, expect, it, vi } from 'vitest';

const createEventWithPrompt = vi.fn();
const createEvent = vi.fn();
const downloadIcsFile = vi.fn();
let native = false;

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native },
}));

vi.mock('@ebarooni/capacitor-calendar', () => ({
  CapacitorCalendar: {
    createEventWithPrompt: (options: unknown) => createEventWithPrompt(options),
    createEvent: (options: unknown) => createEvent(options),
  },
  downloadIcsFile: (file: unknown) => downloadIcsFile(file),
}));

const {
  DEFAULT_DURATION_MS,
  addToDeviceCalendar,
  eventCalendarEntry,
  icsFileName,
  shiftCalendarEntry,
} = await import('./calendar');

const START = '2026-10-03T16:00:00.000Z';
const END = '2026-10-03T18:00:00.000Z';

/**
 * FR-156: Der Eintrag ist eine Kopie fürs Gerät – Titel, Ort, Fenster,
 * Notizen. Geprüft wird, was hier **entschieden** wird: das Fenster ohne
 * Ende, das Fenster der Schicht statt des Anlasses, die Notizen ohne Leeres,
 * und welcher Weg auf welcher Plattform genommen wird.
 */
describe('eventCalendarEntry', () => {
  it('übernimmt Titel, Ort und Fenster als Unix-Millisekunden', () => {
    const entry = eventCalendarEntry(
      { title: 'Training', location: ' Halle ', why: null, starts_at: START, ends_at: END },
      'Training',
    );
    expect(entry).toEqual({
      title: 'Training',
      location: 'Halle',
      notes: 'Training',
      startsAt: Date.parse(START),
      endsAt: Date.parse(END),
    });
  });

  it('gibt einem Termin ohne Ende eine Stunde (BR-187)', () => {
    const entry = eventCalendarEntry(
      { title: 'GV', location: null, why: null, starts_at: START, ends_at: null },
      'Versammlung',
    );
    expect(entry.endsAt - entry.startsAt).toBe(DEFAULT_DURATION_MS);
  });

  it('nimmt ein Ende vor dem Anfang nicht als Fenster', () => {
    const entry = eventCalendarEntry(
      { title: 'GV', location: null, why: null, starts_at: END, ends_at: START },
      'Versammlung',
    );
    expect(entry.endsAt - entry.startsAt).toBe(DEFAULT_DURATION_MS);
  });

  it('setzt Terminart und Warum als Absätze in die Notizen, nichts Leeres', () => {
    const entry = eventCalendarEntry(
      { title: 'Fest', location: '', why: 'Damit der Nachwuchs fährt', starts_at: START, ends_at: END },
      'Anlass',
    );
    expect(entry.notes).toBe('Anlass\n\nDamit der Nachwuchs fährt');
    expect(entry.location).toBeNull();
  });

  it('weist einen unlesbaren Beginn ab', () => {
    expect(() =>
      eventCalendarEntry(
        { title: 'x', location: null, why: null, starts_at: 'irgendwann', ends_at: null },
        'x',
      ),
    ).toThrow(/invalid start/);
  });
});

describe('shiftCalendarEntry', () => {
  it('trägt das Fenster der Schicht und nennt den Anlass im Titel', () => {
    const entry = shiftCalendarEntry(
      { title: 'Aufbau', starts_at: START, ends_at: END },
      { title: 'Sommerfest', location: 'Festplatz', why: 'Damit das Fest steht' },
    );
    expect(entry).toEqual({
      title: 'Aufbau – Sommerfest',
      location: 'Festplatz',
      notes: 'Sommerfest\n\nDamit das Fest steht',
      startsAt: Date.parse(START),
      endsAt: Date.parse(END),
    });
  });
});

describe('icsFileName', () => {
  it('behält Umlaute und streicht, was ein Dateisystem nicht nimmt', () => {
    expect(icsFileName('Frühjahrsputz: Halle/Aussen?')).toBe('Frühjahrsputz Halle Aussen.ics');
  });

  it('fällt bei leerem Titel auf einen Namen zurück', () => {
    expect(icsFileName('  ')).toBe('myclub.ics');
  });
});

describe('addToDeviceCalendar', () => {
  const entry = {
    title: 'Training',
    location: 'Halle',
    notes: 'Training',
    startsAt: Date.parse(START),
    endsAt: Date.parse(END),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    native = false;
  });

  it('öffnet auf dem Gerät das ausgefüllte Blatt des Systems', async () => {
    native = true;
    createEventWithPrompt.mockResolvedValue({ id: null });

    await addToDeviceCalendar(entry);

    expect(createEventWithPrompt).toHaveBeenCalledWith({
      title: 'Training',
      location: 'Halle',
      description: 'Training',
      startDate: Date.parse(START),
      endDate: Date.parse(END),
    });
    expect(createEvent).not.toHaveBeenCalled();
  });

  it('lädt im Browser eine ICS-Datei herunter', async () => {
    const ics = { name: 'Training.ics' };
    createEvent.mockResolvedValue({ id: null, ics });

    await addToDeviceCalendar({ ...entry, location: null, notes: null });

    expect(createEvent).toHaveBeenCalledWith({
      title: 'Training',
      location: undefined,
      description: undefined,
      startDate: Date.parse(START),
      endDate: Date.parse(END),
      icsFileName: 'Training.ics',
    });
    expect(downloadIcsFile).toHaveBeenCalledWith(ics);
    expect(createEventWithPrompt).not.toHaveBeenCalled();
  });

  it('wirft, wenn der Browser keine Datei liefert', async () => {
    createEvent.mockResolvedValue({ id: null });
    await expect(addToDeviceCalendar(entry)).rejects.toThrow(/no ics/);
    expect(downloadIcsFile).not.toHaveBeenCalled();
  });
});

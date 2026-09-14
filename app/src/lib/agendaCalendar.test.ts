import { describe, expect, it } from 'vitest';
import {
  MARK_ACTIVE,
  MARK_CANCELLED,
  calendarMarks,
  eventsOnDay,
  localDay,
  marksWindow,
  monthOf,
  monthWindow,
  parseLocalDay,
} from './agendaCalendar';

describe('localDay', () => {
  it('nimmt den Tag der Gerätezeitzone, nicht den von UTC', () => {
    // 00:30 lokal – in UTC je nach Zeitzone noch der Vortag.
    const date = new Date(2026, 8, 13, 0, 30);
    expect(localDay(date)).toBe('2026-09-13');
    expect(localDay(date.toISOString())).toBe('2026-09-13');
  });

  it('füllt Monat und Tag auf zwei Stellen auf', () => {
    expect(localDay(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});

describe('monthOf und parseLocalDay', () => {
  it('kürzt auf den Monat', () => {
    expect(monthOf('2026-09-13')).toBe('2026-09');
  });

  it('liest den Tag als lokale Mitternacht', () => {
    expect(parseLocalDay('2026-09-13')).toEqual(new Date(2026, 8, 13));
  });
});

describe('monthWindow', () => {
  it('umfasst den Monat, das Ende ausschliesslich', () => {
    const { from, to } = monthWindow('2026-09');
    expect(new Date(from)).toEqual(new Date(2026, 8, 1));
    expect(new Date(to)).toEqual(new Date(2026, 9, 1));
  });

  it('reicht über den Jahreswechsel', () => {
    const { from, to } = monthWindow('2026-12', 1, 1);
    expect(new Date(from)).toEqual(new Date(2026, 10, 1));
    expect(new Date(to)).toEqual(new Date(2027, 1, 1));
  });

  it('marksWindow: ein Quartal zurück, zwölf Monate voraus – bis Ende September 2027', () => {
    const { from, to } = marksWindow('2026-09');
    expect(new Date(from)).toEqual(new Date(2026, 5, 1));
    expect(new Date(to)).toEqual(new Date(2027, 9, 1));
  });
});

describe('calendarMarks', () => {
  const at = (day: number, hour = 19) => new Date(2026, 8, day, hour).toISOString();

  it('liefert je Tag einen Eintrag, sortiert nach Datum', () => {
    const marks = calendarMarks([
      { starts_at: at(20), cancelled_at: null },
      { starts_at: at(13), cancelled_at: null },
      { starts_at: at(13, 21), cancelled_at: null },
    ]);
    expect(marks.map((mark) => mark.date)).toEqual(['2026-09-13', '2026-09-20']);
  });

  it('färbt den Tag mit der Vereinsfarbe, sobald ein Termin nicht abgesagt ist', () => {
    const marks = calendarMarks([
      { starts_at: at(13), cancelled_at: '2026-09-01T10:00:00Z' },
      { starts_at: at(13, 21), cancelled_at: null },
    ]);
    expect(marks).toEqual([{ date: '2026-09-13', ...MARK_ACTIVE }]);
  });

  it('dämpft einen Tag, an dem nur Abgesagtes steht', () => {
    const marks = calendarMarks([{ starts_at: at(13), cancelled_at: '2026-09-01T10:00:00Z' }]);
    expect(marks).toEqual([{ date: '2026-09-13', ...MARK_CANCELLED }]);
  });

  it('ist ohne Termine leer', () => {
    expect(calendarMarks([])).toEqual([]);
  });

  it('nennt die Farben als CSS-Variablen – die Vereinsfarbe kommt zur Laufzeit', () => {
    expect(MARK_ACTIVE.textColor).toContain('var(--ion-color-primary');
    expect(MARK_ACTIVE.backgroundColor).toContain('--ion-color-primary-rgb');
  });
});

describe('eventsOnDay', () => {
  it('nimmt die Termine, die an diesem Tag beginnen', () => {
    const events = [
      { id: 'a', starts_at: new Date(2026, 8, 13, 0, 15).toISOString() },
      { id: 'b', starts_at: new Date(2026, 8, 13, 23, 45).toISOString() },
      { id: 'c', starts_at: new Date(2026, 8, 14, 0, 0).toISOString() },
    ];
    expect(eventsOnDay(events, '2026-09-13').map((event) => event.id)).toEqual(['a', 'b']);
    expect(eventsOnDay(events, '2026-09-15')).toEqual([]);
  });
});

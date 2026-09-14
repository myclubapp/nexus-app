import type { DatetimeHighlight, DatetimeHighlightStyle } from '@ionic/core';

/**
 * Die Kalenderübersicht der Agenda – die Rechnung hinter `AgendaCalendar`.
 *
 * Alles hier arbeitet mit Tagen in der Zeitzone des Geräts: Ein Termin am
 * 13.9. um 00:30 Uhr liegt in UTC noch am 12.9., gehört im Kalender aber zum
 * 13. Deshalb nie `toISOString().slice(0, 10)` für den Tag und nie
 * `new Date('YYYY-MM-DD')` für die Mitternacht – das wäre UTC.
 */

const pad = (value: number) => String(value).padStart(2, '0');

/** `YYYY-MM-DD` eines Zeitpunkts, lokal. */
export function localDay(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM` eines Tages. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** Ein `YYYY-MM-DD` als lokale Mitternacht. */
export function parseLocalDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

/**
 * Ein Fenster aus ganzen Monaten als ISO-Zeitpunkte für die Abfrage: `from`
 * einschliesslich, `to` ausschliesslich. `before` und `after` zählen Monate
 * um `month` herum; ohne beides ist es der Monat selbst.
 */
export function monthWindow(
  month: string,
  before = 0,
  after = 0,
): { from: string; to: string } {
  const [year, m] = month.split('-').map(Number);
  return {
    from: new Date(year, m - 1 - before, 1).toISOString(),
    to: new Date(year, m + after, 1).toISOString(),
  };
}

/** Wie weit die Markierungen um den gewählten Monat reichen. */
export const MARKS_MONTHS_BEFORE = 3;
export const MARKS_MONTHS_AFTER = 12;

/** Das Fenster der Markierungen: eine Saison voraus, ein Quartal zurück. */
export function marksWindow(month: string): { from: string; to: string } {
  return monthWindow(month, MARKS_MONTHS_BEFORE, MARKS_MONTHS_AFTER);
}

/** Was eine Markierung über einen Termin wissen muss. */
export interface MarkSource {
  starts_at: string;
  cancelled_at: string | null;
}

/**
 * Die Farben der Markierung. Die Vereinsfarbe kommt zur Laufzeit als
 * CSS-Variable (`lib/theme.ts`); Ionic setzt die Werte als Inline-Stil, und
 * dort löst der Browser `var()` auf.
 */
export const MARK_ACTIVE: DatetimeHighlightStyle = {
  textColor: 'var(--ion-color-primary)',
  backgroundColor: 'rgba(var(--ion-color-primary-rgb), 0.16)',
};

/** Ein Tag, an dem nur Abgesagtes steht, ist gedämpft – nicht leer. */
export const MARK_CANCELLED: DatetimeHighlightStyle = {
  textColor: 'var(--ion-color-medium)',
  backgroundColor: 'rgba(var(--ion-color-medium-rgb), 0.16)',
};

/**
 * Die Einträge für `highlightedDates` (Ionic-Doku «Using Array»): ein Eintrag
 * je Tag mit Termin, sortiert. Steht an einem Tag auch nur ein Termin, der
 * nicht abgesagt ist, trägt der Tag die Vereinsfarbe.
 */
export function calendarMarks(events: readonly MarkSource[]): DatetimeHighlight[] {
  const days = new Map<string, boolean>();
  for (const event of events) {
    const day = localDay(event.starts_at);
    const active = event.cancelled_at === null;
    days.set(day, (days.get(day) ?? false) || active);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, active]): DatetimeHighlight => ({ date, ...(active ? MARK_ACTIVE : MARK_CANCELLED) }));
}

/** Die Termine, die an diesem Tag beginnen. */
export function eventsOnDay<T extends { starts_at: string }>(
  events: readonly T[],
  day: string,
): T[] {
  return events.filter((event) => localDay(event.starts_at) === day);
}

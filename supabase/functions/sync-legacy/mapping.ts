/**
 * Was aus einem Dokument der bisherigen myclub-App ein Termin wird (UC-040).
 *
 * Reine Funktionen ohne Netz und ohne Datenbank – damit sie sich mit
 * `deno test` prüfen lassen. Die Firestore-Felder sind die aus
 * `app/src/app/models/event.ts` des alten Repos (`Veranstaltung`, `Schicht`).
 *
 * Zwei Dinge, die man wissen muss:
 *   - `timeFrom`/`timeTo` am **Termin** sind ISO-Zeitpunkte (UTC). An der
 *     **Schicht** sind sie Uhrzeiten «HH:mm» in Zürcher Ortszeit, ohne Datum:
 *     Das Datum ist das des Termins.
 *   - «Aktuell» heisst in der alten App `date >= jetzt − 2 h`
 *     (`event.service.ts`, `getClubEventsRef`). Dieselbe Grenze gilt hier.
 */

/** Ein Firestore-Dokument, auf einfache Werte reduziert. */
export type LegacyDoc = Record<string, unknown> & { id: string };

export type LegacyKind = 'event' | 'helper';

export interface LegacyShift {
  external_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  needed: number;
  points: number;
}

export interface LegacyEvent {
  external_id: string;
  type: 'social' | 'helper';
  title: string;
  why: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  capacity_needed: number | null;
  cancelled: boolean;
  cancelled_reason: string | null;
  shifts: LegacyShift[];
}

/** Die Grenze der alten App: zwei Stunden nach Beginn gilt ein Termin noch als aktuell. */
export const CURRENT_GRACE_MS = 2 * 3600 * 1000;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function integer(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** Der Beginn eines Termins: `timeFrom`, sonst `date`, sonst `startDate`. */
export function readStartsAt(doc: LegacyDoc): string | null {
  return isoOrNull(doc.timeFrom) ?? isoOrNull(doc.date) ?? isoOrNull(doc.startDate);
}

/** Gilt der Termin in der alten App noch als aktuell? */
export function isCurrent(doc: LegacyDoc, now: Date = new Date()): boolean {
  const startsAt = readStartsAt(doc);
  if (!startsAt) return false;
  return Date.parse(startsAt) >= now.getTime() - CURRENT_GRACE_MS;
}

/**
 * Ortsangabe in einer Zeile: «BBC Arena, Hohbergstrasse 1, 8200 Schaffhausen».
 * Leere Teile fallen weg; ein Teil, der schon im Namen steckt, steht nicht zweimal.
 */
export function readLocation(doc: LegacyDoc): string | null {
  const name = text(doc.location);
  const street = text(doc.streetAndNumber);
  const city = [text(doc.postalCode), text(doc.city)].filter((part) => part).join(' ');
  const parts: string[] = [];
  for (const part of [name, street, city]) {
    if (part && !parts.some((known) => known.toLowerCase() === part.toLowerCase())) {
      parts.push(part);
    }
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

// ---------------------------------------------------------------------------
// Zürcher Ortszeit – dieselbe Rechnung wie in `sync-federation`.
// ---------------------------------------------------------------------------

function zurichParts(at: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  };
}

function zurichOffsetMinutes(at: Date): number {
  const p = zurichParts(at);
  const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((local - at.getTime()) / 60_000);
}

/** Eine Zürcher Wanduhrzeit als Zeitpunkt. */
export function zurichToIso(year: number, month: number, day: number, hour: number, minute: number): string {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = zurichOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60_000).toISOString();
}

/**
 * «17:15» am Tag des Termins (Zürcher Datum) als Zeitpunkt. Ohne lesbare
 * Uhrzeit gibt es `null` – der Aufrufer nimmt dann den Beginn des Termins.
 */
export function shiftTimeToIso(hhmm: unknown, eventStartsAt: string): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(text(hhmm));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const day = zurichParts(new Date(eventStartsAt));
  return zurichToIso(day.year, day.month, day.day, hour, minute);
}

/**
 * Eine Schicht der alten App.
 *
 * Endet sie vor ihrem Beginn («21:30–20:30»), ist das in der Praxis ein
 * Tippfehler mit vertauschten Feldern – die Zeiten werden getauscht. Fehlt
 * das Ende oder ist es gleich dem Beginn, dauert die Schicht zwei Stunden:
 * Eine Schicht ohne Dauer nimmt das Schema nicht an (`event_shifts_time_check`).
 */
export function mapShift(shift: LegacyDoc, eventStartsAt: string): LegacyShift {
  let startsAt = shiftTimeToIso(shift.timeFrom, eventStartsAt) ?? new Date(eventStartsAt).toISOString();
  let endsAt = shiftTimeToIso(shift.timeTo, eventStartsAt);

  if (endsAt && Date.parse(endsAt) < Date.parse(startsAt)) {
    [startsAt, endsAt] = [endsAt, startsAt];
  }
  if (!endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) {
    endsAt = new Date(Date.parse(startsAt) + 2 * 3600 * 1000).toISOString();
  }

  return {
    external_id: shift.id,
    title: text(shift.name) || 'Schicht',
    starts_at: startsAt,
    ends_at: endsAt,
    needed: Math.max(1, integer(shift.countNeeded) ?? 1),
    points: Math.max(0, integer(shift.points) ?? 0),
  };
}

/**
 * Ein Termin der alten App als Termin hier.
 *
 * `null`, wenn ihm Titel oder Beginn fehlen – ein Termin ohne Zeit ist in der
 * Agenda ein Fehler, kein Eintrag (wie beim Verband).
 */
export function mapEvent(doc: LegacyDoc, kind: LegacyKind, shifts: LegacyDoc[] = []): LegacyEvent | null {
  const title = text(doc.name);
  const startsAt = readStartsAt(doc);
  if (!title || !startsAt) return null;

  const endsAt = isoOrNull(doc.timeTo);
  const capacity = integer(doc.countNeeded);

  return {
    external_id: `legacy:${kind}:${doc.id}`,
    type: kind === 'helper' ? 'helper' : 'social',
    title,
    why: text(doc.description) || null,
    starts_at: startsAt,
    ends_at: endsAt && Date.parse(endsAt) > Date.parse(startsAt) ? endsAt : null,
    location: readLocation(doc),
    capacity_needed: capacity !== null && capacity >= 1 ? capacity : null,
    cancelled: doc.cancelled === true,
    cancelled_reason: text(doc.cancelledReason) || null,
    shifts: kind === 'helper' ? shifts.map((shift) => mapShift(shift, startsAt)) : [],
  };
}

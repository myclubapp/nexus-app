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
  type: 'social' | 'helper' | 'training';
  /** Team der alten App (`su-432367`), bei Trainings. */
  team_legacy_id: string | null;
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
    team_legacy_id: null,
  };
}

// ---------------------------------------------------------------------------
// Trainings, Mitglieder, Teams, Antworten (0071).
// ---------------------------------------------------------------------------

/**
 * Der Beginn eines Trainings: `date` ist der Tag **und** die Zeit des
 * einzelnen Termins, `timeFrom`/`timeTo` sind Zeitvorlagen der Serie von
 * einem anderen Tag. Die alte App zeigt `date` als Datum und die Uhrzeit von
 * `timeFrom`/`timeTo` (training-detail.page.html) – genau das entsteht hier:
 * der Zürcher Tag von `date` mit der Zürcher Uhrzeit der Vorlage.
 */
export function readTrainingStartsAt(doc: LegacyDoc): string | null {
  const day = isoOrNull(doc.date) ?? isoOrNull(doc.startDate);
  if (!day) return null;
  const from = isoOrNull(doc.timeFrom);
  if (!from) return day;
  const d = zurichParts(new Date(day));
  const t = zurichParts(new Date(from));
  return zurichToIso(d.year, d.month, d.day, t.hour, t.minute);
}

export function isCurrentTraining(doc: LegacyDoc, now: Date = new Date()): boolean {
  const startsAt = readTrainingStartsAt(doc);
  if (!startsAt) return false;
  return Date.parse(startsAt) >= now.getTime() - CURRENT_GRACE_MS;
}

/** Ein Training der alten App als Termin des Teams. */
export function mapTraining(doc: LegacyDoc, teamLegacyId: string): LegacyEvent | null {
  const title = text(doc.name);
  const startsAt = readTrainingStartsAt(doc);
  if (!title || !startsAt) return null;

  let endsAt: string | null = null;
  const to = isoOrNull(doc.timeTo) ?? isoOrNull(doc.endDate);
  if (to) {
    const d = zurichParts(new Date(startsAt));
    const t = zurichParts(new Date(to));
    endsAt = zurichToIso(d.year, d.month, d.day, t.hour, t.minute);
    if (Date.parse(endsAt) <= Date.parse(startsAt)) endsAt = null;
  }

  return {
    external_id: `legacy:training:${doc.id}`,
    type: 'training',
    team_legacy_id: teamLegacyId,
    title,
    why: text(doc.description) || null,
    starts_at: startsAt,
    ends_at: endsAt,
    location: readLocation(doc),
    capacity_needed: null,
    cancelled: doc.cancelled === true,
    cancelled_reason: text(doc.cancelledReason) || null,
    shifts: [],
  };
}

export interface LegacyMember {
  legacy_user_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  roles: string[];
}

/** Ein Mitglied: `club/<id>/members/<uid>` plus `userProfile/<uid>` (E-Mail). */
export function mapMember(member: LegacyDoc, profile: LegacyDoc | null): LegacyMember {
  const roles = Array.isArray(member.roles) ? member.roles.map((role) => text(role)).filter(Boolean) : [];
  return {
    legacy_user_id: member.id,
    first_name: text(member.firstName) || text(profile?.firstName),
    last_name: text(member.lastName) || text(profile?.lastName),
    email: text(profile?.email).toLowerCase() || null,
    roles,
  };
}

export interface LegacyTeam {
  legacy_team_id: string;
  name: string;
  /** Die Verbandskennung («432367» aus `su-432367` oder `externalId`). */
  federation_team_id: string | null;
  member_ids: string[];
}

/** Ein Team: das Dokument `teams/<id>` und seine Mitglieder. Ohne Namen kein Team. */
export function mapTeam(team: LegacyDoc, members: LegacyDoc[]): LegacyTeam | null {
  const name = text(team.name);
  if (!name) return null;
  const external = text(team.externalId) || (/^su-(\d+)$/.exec(team.id)?.[1] ?? '');
  return {
    legacy_team_id: team.id,
    name,
    federation_team_id: text(team.type) === 'swissunihockey' || /^su-\d+$/.test(team.id)
      ? external || null
      : null,
    member_ids: members.map((member) => member.id),
  };
}

export interface LegacyResponse {
  event_external_id: string;
  shift_external_id: string | null;
  legacy_user_id: string;
  status: boolean;
  changed_at: string | null;
}

/**
 * Die Antwort einer Person: `{ status: true/false, changedAt }` unter
 * `…/attendees/<uid>`. Ohne lesbaren Status keine Antwort.
 */
export function mapResponse(
  attendee: LegacyDoc,
  eventExternalId: string,
  shiftExternalId: string | null = null,
): LegacyResponse | null {
  if (typeof attendee.status !== 'boolean') return null;
  return {
    event_external_id: eventExternalId,
    shift_external_id: shiftExternalId,
    legacy_user_id: attendee.id,
    status: attendee.status,
    changed_at: isoOrNull(attendee.changedAt),
  };
}

/** Ein Spiel der alten App gehört zum Verbandsspiel mit derselben Kennung (BR-194). */
export function gameExternalId(game: LegacyDoc): string | null {
  const id = text(game.externalId) || (/^su-(\d+)$/.exec(game.id)?.[1] ?? '');
  return id ? `swissunihockey:${id}` : null;
}

export function isCurrentGame(game: LegacyDoc, now: Date = new Date()): boolean {
  const at = isoOrNull(game.dateTime);
  return at !== null && Date.parse(at) >= now.getTime() - CURRENT_GRACE_MS;
}

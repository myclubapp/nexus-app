import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DECLINE_REASONS,
  EARLY_DECLINE_HOURS,
  coverageGap,
  parseCapacity,
  canRespond,
  groupAttendance,
  holdsShift,
  isEarlyDecline,
  respondsViaShifts,
  tallyAttendance,
} from './attendance';

const now = new Date('2026-09-09T12:00:00');

/**
 * Gegenstück zu `decline_is_early()` in `0017_attendance_response.sql`.
 * Laufen die beiden auseinander, verspricht die App Punkte, die der Server
 * nicht bucht (BR-040).
 */
describe('isEarlyDecline', () => {
  it('erkennt eine Absage deutlich vor der Frist', () => {
    expect(isEarlyDecline('2026-09-11T12:00:00', now)).toBe(true);
  });

  it('erkennt eine Absage kurz vor dem Termin', () => {
    expect(isEarlyDecline('2026-09-09T15:00:00', now)).toBe(false);
  });

  it('liegt genau auf der Frist noch nicht rechtzeitig', () => {
    // Die Regel sagt «mehr als 24 Stunden» – genau 24 reicht nicht.
    expect(isEarlyDecline('2026-09-10T12:00:00', now)).toBe(false);
  });

  it('ist eine Minute darüber rechtzeitig', () => {
    expect(isEarlyDecline('2026-09-10T12:01:00', now)).toBe(true);
  });

  it('behandelt einen vergangenen Termin als nicht rechtzeitig', () => {
    expect(isEarlyDecline('2026-09-08T12:00:00', now)).toBe(false);
  });

  it('behandelt ein unlesbares Datum als nicht rechtzeitig', () => {
    expect(isEarlyDecline('kein-datum', now)).toBe(false);
  });

  it('nimmt ein Date genauso entgegen wie eine Zeichenkette', () => {
    expect(isEarlyDecline(new Date('2026-09-11T12:00:00'), now)).toBe(true);
  });
});

describe('canRespond', () => {
  it('lässt eine Antwort auf einen künftigen, gültigen Termin zu', () => {
    expect(canRespond({ isCancelled: false, hasStarted: false })).toBe(true);
  });

  it('sperrt einen abgesagten Termin (A3)', () => {
    expect(canRespond({ isCancelled: true, hasStarted: false })).toBe(false);
  });

  it('sperrt einen begonnenen Termin (BR-038)', () => {
    expect(canRespond({ isCancelled: false, hasStarted: true })).toBe(false);
  });

  it('sperrt einen Termin mit Schichten (BR-196)', () => {
    // Die Schicht ist die Antwort – ein Haken daneben wäre eine Anmeldung,
    // die es nicht gibt.
    expect(canRespond({ isCancelled: false, hasStarted: false, viaShifts: true })).toBe(false);
  });
});

describe('respondsViaShifts (BR-196)', () => {
  it('erkennt einen Termin mit Schichten', () => {
    expect(respondsViaShifts({ shifts: [{ id: 's-1' }] })).toBe(true);
  });

  it('lässt einen Termin ohne Schichten beim Antwortstand', () => {
    expect(respondsViaShifts({ shifts: [] })).toBe(false);
    expect(respondsViaShifts({ shifts: null })).toBe(false);
    expect(respondsViaShifts({})).toBe(false);
  });
});

describe('holdsShift', () => {
  const entry = (member_id: string, shift_id: string | null, status = 'registered') => ({
    member_id,
    shift_id,
    status,
  });

  it('erkennt eine übernommene oder bestätigte Schicht', () => {
    expect(holdsShift([entry('me', 's-1')], 'me')).toBe(true);
    expect(holdsShift([entry('me', 's-1', 'present')], 'me')).toBe(true);
  });

  it('zählt wie die Besetzung: eine Absage hält keinen Platz', () => {
    expect(holdsShift([entry('me', 's-1', 'excused')], 'me')).toBe(false);
  });

  it('zählt weder die Antwort auf den Anlass noch fremde Schichten', () => {
    expect(holdsShift([entry('me', null)], 'me')).toBe(false);
    expect(holdsShift([entry('other', 's-1')], 'me')).toBe(false);
    expect(holdsShift([entry('me', 's-1')], null)).toBe(false);
  });
});

describe('tallyAttendance', () => {
  const entries = [
    { status: 'registered' },
    { status: 'registered' },
    { status: 'excused' },
    { status: 'present' },
  ];

  it('zählt die Antworten je Art (Schritt 2)', () => {
    const tally = tallyAttendance(entries, 10);
    expect(tally).toMatchObject({ registered: 2, excused: 1, present: 1 });
  });

  it('rechnet die Unentschlossenen aus der Differenz', () => {
    expect(tallyAttendance(entries, 10).undecided).toBe(6);
  });

  it('zählt Anwesende als entschieden', () => {
    // Wer da ist, hat sich damit auch entschieden – sonst wäre die Person
    // gleichzeitig anwesend und unentschlossen.
    expect(tallyAttendance([{ status: 'present' }], 1).undecided).toBe(0);
  });

  it('zählt als abwesend Vermerkte als entschieden (BR-059)', () => {
    // Die Antwort steht, sie lautet nur nicht «ja». Zählte man sie weiter als
    // offen, bekäme die Person eine Erinnerung, obwohl der Server sie als
    // beantwortet führt – und die Zahl in der Rückfrage stimmte nicht.
    expect(tallyAttendance([{ status: 'absent' }], 1).undecided).toBe(0);
  });

  it('wird nicht negativ, wenn mehr geantwortet haben als erwartet', () => {
    // Ein Mitglied kann den Verein verlassen haben, nachdem es zugesagt hat.
    expect(tallyAttendance(entries, 2).undecided).toBe(0);
  });

  it('kommt ohne Antworten zurecht', () => {
    expect(tallyAttendance([], 5)).toEqual({
      registered: 0,
      excused: 0,
      present: 0,
      undecided: 5,
    });
  });
});

describe('Absagegründe', () => {
  it('bietet einen Freitext-Ausweg an (A1 Schritt 1)', () => {
    // Ohne «anderer Grund» müsste jede Absage in eine Schublade passen.
    expect(DECLINE_REASONS).toContain('other');
  });

  it('bietet vorformulierte Gründe an', () => {
    expect(DECLINE_REASONS.length).toBeGreaterThan(3);
  });
});

/** Architekturprüfung: Die Frist muss in App und SQL dieselbe sein. */
describe('Gleichlauf mit decline_is_early() in SQL', () => {
  const migration = readFileSync(
    '../supabase/migrations/0017_attendance_response.sql',
    'utf8',
  );

  it('verwendet dieselbe Frist wie die Datenbank', () => {
    expect(migration).toContain(`interval '${EARLY_DECLINE_HOURS} hours'`);
  });

  it('vergleicht in SQL ebenfalls strikt grösser', () => {
    // `>` und nicht `>=`: genau 24 Stunden reichen nicht.
    expect(migration).toMatch(/p_starts_at - now\(\) > interval/);
  });
});

describe('groupAttendance', () => {
  const members = [
    { id: 'a', display_name: 'Anna' },
    { id: 'b', display_name: 'Beat' },
    { id: 'c', display_name: 'Cla' },
    { id: 'd', display_name: 'Dana' },
  ];
  const entry = (member_id: string, status: string, shift_id: string | null = null) => ({
    member_id,
    shift_id,
    status,
    responded_at: null,
    decline_reason: null,
  });

  it('teilt die Betroffenen in zugesagt, abgesagt und ohne Antwort', () => {
    const groups = groupAttendance(
      [entry('a', 'registered'), entry('b', 'present'), entry('c', 'excused')],
      members,
    );

    expect(groups.registered.map((row) => row.member.id)).toEqual(['a', 'b']);
    expect(groups.excused.map((row) => row.member.id)).toEqual(['c']);
    expect(groups.undecided.map((member) => member.id)).toEqual(['d']);
  });

  it('zählt eine übernommene Schicht nicht als Zusage zum Termin', () => {
    const groups = groupAttendance([entry('a', 'registered', 'shift-1')], members);

    expect(groups.registered).toHaveLength(0);
    expect(groups.undecided.map((member) => member.id)).toContain('a');
  });

  it('führt niemanden auf, der nicht betroffen ist', () => {
    // Die Antwort einer Person aus einem anderen Team gehört in keine Liste.
    const groups = groupAttendance([entry('x', 'registered')], members);

    expect(groups.registered).toHaveLength(0);
    expect(groups.undecided).toHaveLength(4);
  });
});

describe('Teilnehmerbedarf (FR-029)', () => {
  it('nimmt eine positive ganze Zahl', () => {
    expect(parseCapacity('12')).toBe(12);
    expect(parseCapacity(' 8 ')).toBe(8);
  });

  it('liest alles andere als «kein Bedarf»', () => {
    // Leer heisst kein Bedarf, nicht null – die meisten Termine brauchen
    // keine Mindestzahl, und «0» läse sich wie «null Leute genügen».
    expect(parseCapacity('')).toBeNull();
    expect(parseCapacity('0')).toBeNull();
    expect(parseCapacity('-3')).toBeNull();
    expect(parseCapacity('7,5')).toBeNull();
    expect(parseCapacity('viele')).toBeNull();
  });

  it('zählt Zusagen und Anwesende gegen den Bedarf', () => {
    // Wer eingecheckt ist, ist da – auch ohne vorherige Zusage.
    expect(coverageGap(10, { registered: 6, present: 2 })).toBe(2);
    expect(coverageGap(10, { registered: 10, present: 0 })).toBe(0);
    expect(coverageGap(10, { registered: 12, present: 1 })).toBe(0);
  });

  it('kennt ohne hinterlegten Bedarf keine Unterdeckung', () => {
    expect(coverageGap(null, { registered: 0, present: 0 })).toBe(0);
    expect(coverageGap(undefined, { registered: 0, present: 0 })).toBe(0);
  });
});

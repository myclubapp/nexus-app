import { describe, expect, it } from 'vitest';
import { isCheckInOpen } from './checkInWindow';

const START = '2026-09-20T19:00:00.000Z';
const END = '2026-09-20T20:30:00.000Z';

function at(iso: string) {
  return new Date(iso);
}

describe('isCheckInOpen', () => {
  const event = { startsAt: START, endsAt: END, isCancelled: false, isDraft: false };

  it('öffnet 30 Minuten vor Beginn (BR-054)', () => {
    expect(isCheckInOpen(event, at('2026-09-20T18:29:00.000Z'))).toBe(false);
    expect(isCheckInOpen(event, at('2026-09-20T18:30:00.000Z'))).toBe(true);
  });

  it('bleibt nach Terminbeginn offen', () => {
    // Der eigentliche Fall: Wer um 19:05 die Halle betritt, checkt dann ein.
    // Die Agenda führt den Termin da schon unter «Vergangen».
    expect(isCheckInOpen(event, at('2026-09-20T19:05:00.000Z'))).toBe(true);
    expect(isCheckInOpen(event, at('2026-09-20T20:29:00.000Z'))).toBe(true);
  });

  it('schliesst mit dem Terminende', () => {
    expect(isCheckInOpen(event, at('2026-09-20T20:30:00.000Z'))).toBe(true);
    expect(isCheckInOpen(event, at('2026-09-20T20:31:00.000Z'))).toBe(false);
  });

  it('nimmt ohne Endzeit drei Stunden an (BR-054)', () => {
    const open = { ...event, endsAt: null };
    expect(isCheckInOpen(open, at('2026-09-20T21:59:00.000Z'))).toBe(true);
    expect(isCheckInOpen(open, at('2026-09-20T22:01:00.000Z'))).toBe(false);
  });

  it('bleibt bei einem abgesagten Termin zu', () => {
    expect(isCheckInOpen({ ...event, isCancelled: true }, at('2026-09-20T19:05:00.000Z'))).toBe(
      false,
    );
  });

  it('bleibt bei einem Entwurf zu', () => {
    expect(isCheckInOpen({ ...event, isDraft: true }, at('2026-09-20T19:05:00.000Z'))).toBe(
      false,
    );
  });

  it('behandelt eine unlesbare Zeit als geschlossen', () => {
    expect(isCheckInOpen({ ...event, startsAt: 'kaputt' }, at(START))).toBe(false);
  });

  it('nimmt bei unlesbarer Endzeit die Standarddauer', () => {
    const broken = { ...event, endsAt: 'kaputt' };
    expect(isCheckInOpen(broken, at('2026-09-20T21:00:00.000Z'))).toBe(true);
    expect(isCheckInOpen(broken, at('2026-09-20T22:30:00.000Z'))).toBe(false);
  });
});

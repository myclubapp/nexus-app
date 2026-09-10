import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readStoredTickets, readTickets, storeTicket } from './tickets';

/**
 * Das Ticket ist der Rückweg zu etwas, das anonym eingereicht wurde – für das
 * Anliegen (UC-029/030) und für den Sitzungs-Input (UC-031) derselbe.
 *
 * Was hier geprüft wird, ist deshalb keine Kleinigkeit: Wo der Speicher
 * klemmt, muss die Seite es **melden** statt zu scheitern, und zwei Vorgänge
 * dürfen sich ihre Tickets nicht gegenseitig überschreiben.
 */
const VOICE = 'probe.voice';
const MEETING = 'probe.meeting';

describe('readTickets', () => {
  it('liest die Tickets aus dem gespeicherten Text', () => {
    expect(readTickets('["a","b"]')).toEqual(['a', 'b']);
  });

  it('überlebt einen kaputten Speicher', () => {
    expect(readTickets(null)).toEqual([]);
    expect(readTickets('kein json')).toEqual([]);
    expect(readTickets('{"a":1}')).toEqual([]);
    expect(readTickets('[1,"b",null]')).toEqual(['b']);
  });
});

describe('storeTicket', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('legt die Tickets nebeneinander ab, nicht übereinander', () => {
    expect(storeTicket(VOICE, 'erstes')).toBe(true);
    expect(storeTicket(VOICE, 'zweites')).toBe(true);
    expect(readStoredTickets(VOICE)).toEqual(['erstes', 'zweites']);
  });

  it('hält die Vorgänge auseinander', () => {
    // Anliegen und Sitzungs-Input teilen sich das Verfahren, nicht den
    // Speicher: Ein gemeinsamer Schlüssel liesse jeden Faden jeden anderen
    // abholen.
    storeTicket(VOICE, 'stimme');
    storeTicket(MEETING, 'sitzung');

    expect(readStoredTickets(VOICE)).toEqual(['stimme']);
    expect(readStoredTickets(MEETING)).toEqual(['sitzung']);
  });

  it('meldet den gesperrten Speicher, statt zu scheitern', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(storeTicket(VOICE, 'verloren')).toBe(false);
  });

  it('gibt bei gesperrtem Lesen eine leere Liste zurück', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readStoredTickets(VOICE)).toEqual([]);
  });
});

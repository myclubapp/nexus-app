import { describe, expect, it } from 'vitest';
import {
  CHECK_IN_TTL_MS,
  enqueueCheckIn,
  parseQueue,
  pruneCheckIns,
  removeCheckIn,
  type PendingCheckIn,
} from './checkInQueue';

function entry(overrides: Partial<PendingCheckIn> = {}): PendingCheckIn {
  return { eventId: 'e1', qrToken: 'abc', scannedAt: 1_000, ...overrides };
}

describe('enqueueCheckIn', () => {
  it('nimmt einen Scan auf', () => {
    expect(enqueueCheckIn([], entry())).toEqual([entry()]);
  });

  it('hält je Termin nur einen Eintrag', () => {
    // Wer dreimal scannt, weil nichts passiert, soll nicht dreimal nachsenden.
    const queue = enqueueCheckIn([entry()], entry({ scannedAt: 2_000 }));
    expect(queue).toHaveLength(1);
    expect(queue[0].scannedAt).toBe(2_000);
  });

  it('lässt andere Termine unberührt', () => {
    const queue = enqueueCheckIn([entry()], entry({ eventId: 'e2' }));
    expect(queue.map((item) => item.eventId)).toEqual(['e1', 'e2']);
  });
});

describe('pruneCheckIns', () => {
  it('behält, was jünger als 24 Stunden ist (NFR-010)', () => {
    const queue = [entry({ scannedAt: 0 })];
    expect(pruneCheckIns(queue, CHECK_IN_TTL_MS - 1)).toHaveLength(1);
  });

  it('verwirft, was 24 Stunden alt ist', () => {
    const queue = [entry({ scannedAt: 0 })];
    expect(pruneCheckIns(queue, CHECK_IN_TTL_MS)).toHaveLength(0);
  });

  it('trennt Altes von Neuem', () => {
    const queue = [entry({ scannedAt: 0 }), entry({ eventId: 'e2', scannedAt: 90_000_000 })];
    const kept = pruneCheckIns(queue, 90_000_000);
    expect(kept.map((item) => item.eventId)).toEqual(['e2']);
  });
});

describe('removeCheckIn', () => {
  it('entfernt einen erledigten Eintrag', () => {
    // Auch der abgewiesene Eintrag verschwindet: Ein Fehler wiederholt sich
    // beim nächsten Versuch genauso.
    expect(removeCheckIn([entry(), entry({ eventId: 'e2' })], 'e1')).toEqual([
      entry({ eventId: 'e2' }),
    ]);
  });
});

describe('parseQueue', () => {
  it('liest eine gespeicherte Liste', () => {
    expect(parseQueue(JSON.stringify([entry()]))).toEqual([entry()]);
  });

  it('verträgt einen leeren Speicher', () => {
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue('')).toEqual([]);
  });

  it('verträgt Unlesbares', () => {
    expect(parseQueue('kein json')).toEqual([]);
    expect(parseQueue('{"kein":"array"}')).toEqual([]);
  });

  it('wirft einzelne unbrauchbare Einträge weg, nicht die ganze Liste', () => {
    // Der Puffer liegt im Gerät und kann von einer älteren Fassung stammen.
    const raw = JSON.stringify([entry(), { eventId: 'e2' }, null, 'x']);
    expect(parseQueue(raw)).toEqual([entry()]);
  });

  it('weist leere Zeichenketten und unbrauchbare Zeitpunkte ab', () => {
    const raw = JSON.stringify([
      { eventId: '', qrToken: 'a', scannedAt: 1 },
      { eventId: 'e', qrToken: '', scannedAt: 1 },
      { eventId: 'e', qrToken: 'a', scannedAt: Number.NaN },
    ]);
    expect(parseQueue(raw)).toEqual([]);
  });
});

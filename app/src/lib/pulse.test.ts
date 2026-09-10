import { describe, expect, it } from 'vitest';
import {
  PULSE_SECTIONS,
  allItems,
  isEmpty,
  itemsOf,
  ratioTilted,
  type ClubPulse,
  type PulseItem,
} from './pulse';

function item(id: string, title = 'Etwas'): PulseItem {
  return { kind: 'event', id, title, at: null, detail: null };
}

function pulse(overrides: Partial<ClubPulse> = {}): ClubPulse {
  return {
    id: 'p-1',
    happening: [item('a', 'Training')],
    workingOn: [item('b', 'Trikots')],
    joinIn: [item('c', 'Bewilligung')],
    intro: null,
    status: 'draft',
    composedAt: '2026-09-07T06:00:00Z',
    sentAt: null,
    ...overrides,
  };
}

describe('BR-113: drei Fragen in fester Reihenfolge', () => {
  it('nennt sie immer in derselben Reihenfolge', () => {
    expect([...PULSE_SECTIONS]).toEqual(['happening', 'workingOn', 'joinIn']);
  });

  it('liest jeden Abschnitt einzeln aus', () => {
    const entry = pulse();
    expect(itemsOf(entry, 'happening')[0].title).toBe('Training');
    expect(itemsOf(entry, 'workingOn')[0].title).toBe('Trikots');
    expect(itemsOf(entry, 'joinIn')[0].title).toBe('Bewilligung');
  });

  it('sammelt alle Einträge in derselben Reihenfolge ein', () => {
    expect(allItems(pulse()).map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('isEmpty', () => {
  it('erkennt, wenn alles gestrichen wurde', () => {
    // Ein Puls ohne Inhalt entsteht gar nicht erst (A3) – aber wer alles
    // streicht, soll auch keine leere Nachricht versenden können.
    expect(isEmpty(pulse(), new Set())).toBe(true);
  });

  it('lässt einen einzigen behaltenen Eintrag genügen', () => {
    expect(isEmpty(pulse(), new Set(['b']))).toBe(false);
  });
});

describe('ratioTilted', () => {
  it('erkennt das gekippte Verhältnis wie das Signal in 0040', () => {
    expect(ratioTilted({ connections: 1, calls: 4, lastConnection: null })).toBe(true);
  });

  it('nennt drei Aufrufe noch kein Muster', () => {
    // Unter drei Aufrufen ist es ein Zufall, kein Muster.
    expect(ratioTilted({ connections: 0, calls: 2, lastConnection: null })).toBe(false);
  });

  it('sieht ein ausgeglichenes Verhältnis nicht als gekippt', () => {
    expect(ratioTilted({ connections: 3, calls: 4, lastConnection: null })).toBe(false);
  });
});

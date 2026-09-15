import { describe, expect, it } from 'vitest';
import {
  PULSE_SECTIONS,
  allItems,
  externalUrl,
  isEmpty,
  itemsOf,
  ratioTilted,
  safeImageUrl,
  signatureOf,
  toPulsePayload,
  type ClubPulse,
  type PulseGreeting,
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

// ---------------------------------------------------------------------------
// UC-050: die vierte Quelle und der Gruss am Amt.
// ---------------------------------------------------------------------------

function greeting(overrides: Partial<PulseGreeting> = {}): PulseGreeting {
  return {
    text: 'Herzlich, dein Vorstand',
    office: 'Präsidium',
    names: ['Anna Beispiel'],
    imageUrl: 'https://example.test/portrait.jpg',
    ...overrides,
  };
}

describe('FR-190: Beiträge sind eine Art, kein vierter Abschnitt', () => {
  it('trägt einen Beitrag im ersten Abschnitt und lässt BR-113 in Ruhe', () => {
    const entry = pulse({
      happening: [
        item('a', 'Spiel'),
        { kind: 'news', id: 'n1', title: 'Neues Trikot', at: null, detail: 'Vorstand' },
      ],
    });
    expect([...PULSE_SECTIONS]).toEqual(['happening', 'workingOn', 'joinIn']);
    expect(itemsOf(entry, 'happening').map((i) => i.kind)).toEqual(['event', 'news']);
    expect(allItems(entry)).toHaveLength(4);
  });

  it('führt nur einen Beitrag von der Website nach draussen (A7)', () => {
    const website: PulseItem = {
      kind: 'news',
      id: 'n2',
      title: 'Bericht',
      at: null,
      detail: null,
      url: 'https://verein.test/bericht',
    };
    expect(externalUrl(website)).toBe('https://verein.test/bericht');
    expect(externalUrl(item('a'))).toBeNull();
  });

  it('lässt nichts durch, was keine Netzadresse ist', () => {
    expect(externalUrl({ ...item('a'), url: 'javascript:alert(1)' })).toBeNull();
    expect(externalUrl({ ...item('a'), url: '/tabs/news' })).toBeNull();
    expect(externalUrl({ ...item('a'), url: '  ' })).toBeNull();
  });
});

describe('FR-191/BR-252: der Gruss am Amt', () => {
  it('nennt Text, Amt und Namen', () => {
    const signature = signatureOf(greeting());
    expect(signature?.text).toBe('Herzlich, dein Vorstand');
    expect(signature?.office).toBe('Präsidium');
    expect(signature?.names).toEqual(['Anna Beispiel']);
    expect(signature?.vacant).toBe(false);
    expect(signature?.imageUrl).toBe('https://example.test/portrait.jpg');
  });

  it('A1: ohne Hinterlegung gibt es keinen Gruss', () => {
    expect(signatureOf(null)).toBeNull();
    expect(signatureOf(undefined)).toBeNull();
    expect(signatureOf(greeting({ text: '  ', office: null, names: [] }))).toBeNull();
  });

  it('A2: ein vakantes Amt behält den Text und verliert das Porträt', () => {
    const signature = signatureOf(greeting({ names: [] }));
    expect(signature?.vacant).toBe(true);
    expect(signature?.text).toBe('Herzlich, dein Vorstand');
    expect(signature?.office).toBe('Präsidium');
    // Das Bild zeigt eine Person, die das Amt nicht mehr hält.
    expect(signature?.imageUrl).toBeNull();
  });

  it('A3: mehrere Inhaber:innen stehen in der Reihenfolge der Belegung', () => {
    const signature = signatureOf(greeting({ names: ['Anna Beispiel', 'Bea Muster'] }));
    expect(signature?.names).toEqual(['Anna Beispiel', 'Bea Muster']);
    expect(signature?.vacant).toBe(false);
  });

  it('übergeht leere Namen, statt eine Lücke zu unterschreiben', () => {
    const signature = signatureOf(greeting({ names: ['  ', 'Bea Muster'] }));
    expect(signature?.names).toEqual(['Bea Muster']);
  });
});

describe('BR-253: nur eine sichere Bildadresse kommt ins Blatt', () => {
  it('nimmt https', () => {
    expect(safeImageUrl('https://example.test/x.jpg')).toBe('https://example.test/x.jpg');
  });

  it('weist alles andere ab', () => {
    expect(safeImageUrl('http://example.test/x.jpg')).toBeNull();
    expect(safeImageUrl('data:image/png;base64,AAA')).toBeNull();
    expect(safeImageUrl(null)).toBeNull();
    expect(safeImageUrl('')).toBeNull();
  });
});

describe('Die Nutzlast von `pulse_payload()`', () => {
  it('liest die drei Abschnitte und den Gruss', () => {
    const payload = toPulsePayload({
      pulseId: 'p-9',
      status: 'draft',
      intro: 'Kurz und gut',
      sections: {
        happening: [{ kind: 'news', id: 'n1', title: 'Beitrag', at: null, detail: null }],
        workingOn: [],
        joinIn: [],
      },
      greeting: { text: 'Herzlich', office: 'Präsidium', names: ['Anna'], imageUrl: null },
    });
    expect(payload?.pulseId).toBe('p-9');
    expect(payload?.intro).toBe('Kurz und gut');
    expect(payload?.sections.happening).toHaveLength(1);
    expect(payload?.sections.joinIn).toEqual([]);
    expect(payload?.greeting?.names).toEqual(['Anna']);
  });

  it('erträgt einen fehlenden Gruss und fehlende Abschnitte', () => {
    const payload = toPulsePayload({ pulseId: 'p-1', status: 'sent', greeting: null });
    expect(payload?.greeting).toBeNull();
    expect(payload?.sections.happening).toEqual([]);
    expect(payload?.sections.workingOn).toEqual([]);
  });

  it('gibt nichts zurück, wo die Reichweite nichts hergibt', () => {
    // `pulse_payload()` antwortet mit `null`, wenn die Policy nichts zeigt.
    expect(toPulsePayload(null)).toBeNull();
    expect(toPulsePayload({ sections: {} })).toBeNull();
  });
});

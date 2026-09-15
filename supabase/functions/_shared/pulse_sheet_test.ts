/**
 * Das Pulsblatt (UC-050, FR-188) – `deno test` in diesem Ordner.
 *
 * Geprüft wird, was das Blatt zusagt: die drei Fragen in fester Reihenfolge
 * (BR-248), der Gruss am Fuss mit seinem Rückfall auf den Vorstand (A2) und
 * dass nichts Unsicheres hineinkommt (BR-253, BR-242).
 */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  pulseSignature,
  pulseSubject,
  renderPulseSheet,
  type PulseSheetItem,
  type PulseSheetPayload,
} from './pulse_sheet.ts';

const brand = { clubName: 'Kadetten', color: '#1a73e8', logoUrl: null };

function item(overrides: Partial<PulseSheetItem> = {}): PulseSheetItem {
  return {
    kind: 'event',
    id: crypto.randomUUID(),
    title: 'Heimspiel',
    at: '2026-09-20T18:00:00Z',
    detail: null,
    ...overrides,
  };
}

function payload(overrides: Partial<PulseSheetPayload> = {}): PulseSheetPayload {
  return {
    pulseId: 'ac8f5d5a-6b1e-4f5a-9f6d-2c4ad1f2b3c4',
    intro: null,
    sections: {
      happening: [item()],
      workingOn: [item({ kind: 'decision', title: 'Antwort zum Hallenplan' })],
      joinIn: [item({ kind: 'shift', title: 'Kuchenbuffet' })],
    },
    greeting: null,
    ...overrides,
  };
}

function sheet(input: Partial<Parameters<typeof renderPulseSheet>[0]> = {}) {
  return renderPulseSheet({
    brand,
    locale: 'de',
    displayName: 'Max',
    payload: payload(),
    appUrl: 'https://app.myclub.test',
    footnote: 'Du erhältst diese Mail, weil du den E-Mail-Kanal eingeschaltet hast.',
    now: new Date('2026-09-15T08:00:00Z'),
    ...input,
  });
}

Deno.test('BR-248: die drei Fragen stehen in fester Reihenfolge', () => {
  const mail = sheet();
  const happening = mail.html.indexOf('Was passiert');
  const working = mail.html.indexOf('Woran wir arbeiten');
  const join = mail.html.indexOf('Wo du dabei sein kannst');
  assert(happening > 0 && working > happening && join > working);
});

Deno.test('Betreff nennt den Verein, das Blatt trägt seine Farbe und den Namen', () => {
  const mail = sheet();
  assertEquals(mail.subject, 'Kadetten: Vereins-Puls');
  assertStringIncludes(mail.html, 'bgcolor="#1a73e8"');
  assertStringIncludes(mail.html, 'Hallo Max');
  assertStringIncludes(mail.html, 'In der App öffnen');
  assertStringIncludes(mail.html, '/tabs/pulse/ac8f5d5a-6b1e-4f5a-9f6d-2c4ad1f2b3c4');
});

Deno.test('Ohne Verein steht der Betreff allein', () => {
  assertEquals(pulseSubject('de', null), 'Vereins-Puls');
  assertEquals(pulseSubject('fr', 'Kadetten'), 'Kadetten : pouls du club');
  assertEquals(pulseSubject('it', null), 'Polso della società');
  assertEquals(pulseSubject('en', null), 'Club pulse');
});

Deno.test('Ein leerer Abschnitt bekommt keine Überschrift', () => {
  const mail = sheet({
    payload: payload({ sections: { happening: [item()], workingOn: [], joinIn: [] } }),
  });
  assertStringIncludes(mail.html, 'Was passiert');
  assertEquals(mail.html.includes('Woran wir arbeiten'), false);
  assertEquals(mail.html.includes('Wo du dabei sein kannst'), false);
});

Deno.test('Der Einleitungssatz steht vor den Abschnitten und in der Vorschauzeile', () => {
  const mail = sheet({ payload: payload({ intro: 'Zwei Wochen, viel zu tun.' }) });
  assert(mail.html.indexOf('Zwei Wochen, viel zu tun.') < mail.html.indexOf('Was passiert'));
  assertStringIncludes(mail.text, 'Zwei Wochen, viel zu tun.');
});

Deno.test('A7: nur ein Beitrag von der Website führt nach draussen', () => {
  const mail = sheet({
    payload: payload({
      sections: {
        happening: [
          item({ kind: 'news', title: 'Bericht', url: 'https://verein.test/bericht' }),
          item({ kind: 'event', title: 'Heimspiel', url: 'https://verein.test/spiel' }),
        ],
        workingOn: [],
        joinIn: [],
      },
    }),
  });
  assertStringIncludes(mail.html, 'https://verein.test/bericht');
  assertStringIncludes(mail.html, 'Auf der Website lesen');
  // Ein Termin trägt keine fremde Adresse ins Blatt, auch wenn eine dransteht.
  assertEquals(mail.html.includes('https://verein.test/spiel'), false);
});

Deno.test('FR-191: der Gruss steht am Fuss, mit Amt und Porträt', () => {
  const mail = sheet({
    payload: payload({
      greeting: {
        text: 'Herzlich, dein Vorstand',
        office: 'Präsidium',
        names: ['Anna Beispiel'],
        imageUrl: 'https://cdn.test/anna.jpg',
      },
    }),
  });
  assertStringIncludes(mail.html, 'Herzlich, dein Vorstand');
  assertStringIncludes(mail.html, 'Anna Beispiel');
  assertStringIncludes(mail.html, 'Präsidium');
  assertStringIncludes(mail.html, 'https://cdn.test/anna.jpg');
  assertStringIncludes(mail.text, 'Anna Beispiel');
});

Deno.test('A2: ein vakantes Amt grüsst als Vorstand und ohne Porträt', () => {
  const section = pulseSignature(
    { text: 'Herzlich', office: 'Präsidium', names: [], imageUrl: 'https://cdn.test/alt.jpg' },
    'de',
    '#1a73e8',
  );
  assert(section);
  assertStringIncludes(section.html, 'Der Vorstand');
  assertEquals(section.html.includes('https://cdn.test/alt.jpg'), false);
});

Deno.test('A3: mehrere Inhaber:innen stehen beide da', () => {
  const section = pulseSignature(
    { text: null, office: 'Co-Präsidium', names: ['Anna Beispiel', 'Bea Muster'], imageUrl: null },
    'de',
    '#1a73e8',
  );
  assertStringIncludes(section!.html, 'Anna Beispiel, Bea Muster');
});

Deno.test('A1: ohne Hinterlegung endet das Blatt nach den Abschnitten', () => {
  assertEquals(
    pulseSignature({ text: '  ', office: null, names: [], imageUrl: null }, 'de', '#1a73e8'),
    null,
  );
  const mail = sheet();
  assertEquals(mail.html.includes('Der Vorstand'), false);
});

Deno.test('BR-253/BR-242: nur https kommt ins Blatt, und Eingaben werden maskiert', () => {
  const section = pulseSignature(
    {
      text: '<script>alert(1)</script>',
      office: 'Präsidium',
      names: ['Anna & Bea'],
      imageUrl: 'http://cdn.test/unsicher.jpg',
    },
    'de',
    '#1a73e8',
  );
  assertEquals(section!.html.includes('http://cdn.test/unsicher.jpg'), false);
  assertEquals(section!.html.includes('<script>'), false);
  assertStringIncludes(section!.html, 'Anna &amp; Bea');
});

Deno.test('Die vier Sprachen tragen ihre eigenen Überschriften', () => {
  assertStringIncludes(sheet({ locale: 'fr' }).html, 'Ce qui se passe');
  assertStringIncludes(sheet({ locale: 'it' }).html, 'Che cosa succede');
  assertStringIncludes(sheet({ locale: 'en' }).html, 'What is happening');
});

Deno.test('Ohne Adresse der App gibt es keinen Knopf, aber ein Blatt', () => {
  const mail = sheet({ appUrl: null });
  assertEquals(mail.html.includes('In der App öffnen'), false);
  assertStringIncludes(mail.html, 'Was passiert');
});

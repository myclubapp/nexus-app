import { describe, expect, it } from 'vitest';
import {
  officeMarkdownDocument,
  officeMarkdownFileName,
  officeMarkdownLang,
  officeTemplateMarkdown,
  officeToMarkdown,
  officesToMarkdown,
  parseHolderLine,
  parseOfficeMarkdown,
  planOfficeImport,
} from './officeMarkdown';
import { officeToDraft, type Office, type OfficeHolder } from './office';

function holder(overrides: Partial<OfficeHolder> = {}): OfficeHolder {
  return {
    id: 'h-1',
    memberId: null,
    displayName: 'Anna Beispiel',
    interim: false,
    since: null,
    ...overrides,
  };
}

function office(overrides: Partial<Office> = {}): Office {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    title: 'Kassier:in',
    holderMemberId: null,
    holderName: null,
    heldSince: null,
    why: 'Ohne diese Person weiss niemand, ob der Verein die Saison trägt.',
    duties: [
      { title: 'Buchhaltung führen', detail: 'Abschluss per 31. Mai.' },
      { title: 'Zahlungen freigeben', detail: null },
    ],
    hoursPerSeason: 'ca. 40 Stunden',
    pointsLabel: '4 + Lohn + Spesen',
    seasonPoints: 200,
    maxHolders: 2,
    isBoard: true,
    contactMemberId: null,
    contactName: 'Sandro Ehrbar',
    factsheetPath: null,
    holders: [
      holder({ id: 'h-1', displayName: 'Anna Beispiel', since: '2024-06-01' }),
      holder({ id: 'h-2', displayName: 'Beat Muster', interim: true }),
    ],
    ...overrides,
  };
}

describe('officeToMarkdown()', () => {
  it('schreibt das Blatt in der Reihenfolge des Factsheets', () => {
    const text = officeToMarkdown(office(), 'de');
    expect(text).toContain('# Kassier:in');
    expect(text).toContain('## Warum es dieses Amt gibt');
    expect(text).toContain('### Buchhaltung führen');
    expect(text).toContain('- Sitze: 2');
    expect(text).toContain('- Vorstand: ja');
    expect(text).toContain('- Punkte pro Saison: 200');
    // BR-206: Von der alten Vereinsskala bleibt nur der Zusatz.
    expect(text).toContain('- Entschädigung: Lohn + Spesen');
    expect(text).toContain('- Anna Beispiel (seit 2024-06-01)');
    expect(text).toContain('- Beat Muster (ad interim)');
  });

  it('trägt die Kennung unsichtbar mit', () => {
    const text = officeToMarkdown(office(), 'de');
    expect(text).toContain('<!-- myclub nexus · office id: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee -->');
  });

  it('lässt weg, was nicht gepflegt ist', () => {
    const text = officeToMarkdown(
      office({ why: null, duties: [], hoursPerSeason: null, seasonPoints: null, pointsLabel: null, contactName: null, holders: [] }),
      'de',
    );
    expect(text).not.toContain('## Warum');
    expect(text).not.toContain('## Pflichten');
    expect(text).not.toContain('## Besetzung');
    expect(text).not.toContain('Punkte pro Saison');
    // Die Sitze stehen immer: Ohne sie liesse sich die Vakanz nicht rechnen.
    expect(text).toContain('- Sitze: 2');
  });
});

describe('Rundlauf', () => {
  it('liest zurück, was geschrieben wurde', () => {
    const saved = office();
    const parsed = parseOfficeMarkdown(officeToMarkdown(saved, 'de'));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe(saved.id);

    const [entry] = planOfficeImport(parsed, [saved]);
    expect(entry.office?.id).toBe(saved.id);
    // Nichts hat sich geändert – die Datei ist der gespeicherte Stand.
    expect(entry.changes).toEqual([]);
    expect(entry.draft).toEqual(officeToDraft(saved));
    expect(entry.importable).toBe(true);
  });

  it('liest eine französische Datei genauso (die Sprache ist nicht die Abmachung)', () => {
    const saved = office();
    const parsed = parseOfficeMarkdown(officeToMarkdown(saved, 'fr'));
    const [entry] = planOfficeImport(parsed, [saved]);
    expect(entry.changes).toEqual([]);
    expect(entry.draft.maxHolders).toBe(2);
    expect(entry.draft.isBoard).toBe(true);
  });

  it('trennt mehrere Ämter an ihren Überschriften', () => {
    const a = office();
    const b = office({ id: 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee', title: 'Pressechef:in' });
    const parsed = parseOfficeMarkdown(officesToMarkdown([a, b], 'de', 'Kadetten'));
    expect(parsed.map((entry) => entry.title)).toEqual(['Kassier:in', 'Pressechef:in']);
    expect(parsed.map((entry) => entry.id)).toEqual([a.id, b.id]);
  });
});

describe('parseOfficeMarkdown()', () => {
  it('nimmt eine von Hand geschriebene Datei ohne Kennung', () => {
    const [entry] = parseOfficeMarkdown(`
# Materialwart

## Pflichten

- Bälle zählen
- Trikots waschen

## Eckdaten

- Sitze: 3
- Vorstand: nein
- Aufwand pro Saison: ca. 10 Stunden
`);
    expect(entry.id).toBeNull();
    expect(entry.title).toBe('Materialwart');
    expect(entry.fields.dutiesText).toBe('Bälle zählen\n\nTrikots waschen');
    expect(entry.fields.maxHolders).toBe(3);
    expect(entry.fields.isBoard).toBe(false);
    expect(entry.fields.hoursPerSeason).toBe('ca. 10 Stunden');
  });

  it('nimmt das Pflichtenheft auch als Absätze – wie das Formular', () => {
    const [entry] = parseOfficeMarkdown(`
# Revisor:in

## Pflichten

Rechnung prüfen
Einmal im Jahr, vor der Versammlung.

Bericht schreiben
`);
    expect(entry.fields.dutiesText).toBe(
      'Rechnung prüfen\nEinmal im Jahr, vor der Versammlung.\n\nBericht schreiben',
    );
  });

  it('übergeht Kommentare und meldet fremde Abschnitte', () => {
    const [entry] = parseOfficeMarkdown(`
# Webmaster

## Warum es dieses Amt gibt

<!-- Hinweis, der nicht mitgeht -->
Damit die Website lebt.

## Protokoll der Übergabe

Steht im Ordner des Präsidiums.
`);
    expect(entry.fields.why).toBe('Damit die Website lebt.');
    expect(entry.unknownSections).toEqual(['Protokoll der Übergabe']);
  });

  it('nimmt leere Felder der Vorlage nicht als Aussage (BR-256)', () => {
    const parsed = parseOfficeMarkdown(officeTemplateMarkdown('de'));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].fields.hoursPerSeason).toBeUndefined();
    expect(parsed[0].fields.seasonPoints).toBeUndefined();
    expect(parsed[0].fields.contactName).toBeUndefined();
    // Die Beispielnamen der Besetzung stehen als Kommentar: Sonst belegte
    // «Vorname Name» beim ersten Einlesen einen Sitz.
    expect(parsed[0].fields.holders).toBeUndefined();
    expect(parsed[0].fields.maxHolders).toBe(1);
  });

  it('liest kein Amt aus einer Datei ohne Überschrift', () => {
    expect(parseOfficeMarkdown('Nur ein Satz, keine Überschrift.')).toEqual([]);
  });
});

describe('parseHolderLine()', () => {
  it('trennt Name, «ad interim» und «seit»', () => {
    expect(parseHolderLine('Anna Beispiel (seit 2024-06-01, ad interim)')).toEqual({
      displayName: 'Anna Beispiel',
      interim: true,
      since: '2024-06-01',
    });
  });

  it('versteht die Schweizer Schreibweise und andere Sprachen', () => {
    expect(parseHolderLine('Beat Muster (depuis 01.08.2025)')?.since).toBe('2025-08-01');
    expect(parseHolderLine('Carla Rossi (dal 2023-01-01)')?.since).toBe('2023-01-01');
  });

  it('lässt einen Namen mit Bindestrich ganz', () => {
    expect(parseHolderLine('Anna-Lena Müller-Meier')).toEqual({
      displayName: 'Anna-Lena Müller-Meier',
      interim: false,
      since: null,
    });
  });

  it('nimmt den Zusatz auch hinter einem Gedankenstrich', () => {
    expect(parseHolderLine('Dora Keller – ad interim')).toEqual({
      displayName: 'Dora Keller',
      interim: true,
      since: null,
    });
  });

  it('gibt nichts zurück, wo kein Name steht', () => {
    expect(parseHolderLine('   ')).toBeNull();
    expect(parseHolderLine('(ad interim)')).toBeNull();
  });
});

describe('planOfficeImport()', () => {
  const members = [
    { id: 'm-1', display_name: 'Anna Beispiel' },
    { id: 'm-2', display_name: 'Sandro Ehrbar' },
  ];

  it('ergänzt und ändert, aber leert nie (BR-256)', () => {
    const saved = office();
    const [entry] = planOfficeImport(
      parseOfficeMarkdown('# Kassier:in\n\n## Pflichten\n\n### Neue Pflicht\n'),
      [saved],
      members,
    );
    expect(entry.office?.id).toBe(saved.id);
    expect(entry.changes).toEqual(['duties']);
    // Alles, was die Datei nicht nennt, steht unverändert im Entwurf.
    expect(entry.draft.why).toBe(saved.why);
    expect(entry.draft.holders).toHaveLength(2);
    expect(entry.draft.maxHolders).toBe(2);
    expect(entry.draft.dutiesText).toBe('Neue Pflicht');
  });

  it('erkennt das Amt an der Kennung, auch wenn es umbenannt wird', () => {
    const saved = office();
    const text = officeToMarkdown(saved, 'de').replace('# Kassier:in', '# Finanzen');
    const [entry] = planOfficeImport(parseOfficeMarkdown(text), [saved], members);
    expect(entry.office?.id).toBe(saved.id);
    expect(entry.changes).toContain('title');
    expect(entry.draft.title).toBe('Finanzen');
  });

  it('legt ein neues Amt an, wenn nichts passt', () => {
    const [entry] = planOfficeImport(
      parseOfficeMarkdown('# Neues Amt\n\n## Eckdaten\n\n- Sitze: 2\n'),
      [office()],
      members,
    );
    expect(entry.office).toBeNull();
    expect(entry.importable).toBe(true);
    expect(entry.draft.maxHolders).toBe(2);
  });

  it('lässt zwei gleichnamige Ämter liegen, statt eines zu raten', () => {
    const a = office({ id: 'aaaaaaaa-0000-0000-0000-000000000001', title: 'Co-Präsidium' });
    const b = office({ id: 'aaaaaaaa-0000-0000-0000-000000000002', title: 'Co-Präsidium' });
    const [entry] = planOfficeImport(
      parseOfficeMarkdown('# Co-Präsidium\n\n## Eckdaten\n\n- Sitze: 1\n'),
      [a, b],
      members,
    );
    expect(entry.note).toBe('ambiguousTitle');
    expect(entry.importable).toBe(false);
  });

  it('meldet eine fremde Kennung, statt sie zu übergehen', () => {
    const [entry] = planOfficeImport(
      parseOfficeMarkdown(
        '# Fremdes Amt\n\n<!-- myclub nexus · office id: 99999999-9999-9999-9999-999999999999 -->\n\n## Eckdaten\n\n- Sitze: 1\n',
      ),
      [office()],
      members,
    );
    expect(entry.note).toBe('unknownId');
    expect(entry.office).toBeNull();
    expect(entry.importable).toBe(true);
  });

  it('hält den Sitz derselben Person fest und verknüpft neue Namen mit Konten', () => {
    const saved = office({
      holders: [holder({ id: 'h-1', memberId: 'm-1', displayName: 'Anna Beispiel', since: '2024-06-01' })],
    });
    const [entry] = planOfficeImport(
      parseOfficeMarkdown(
        '# Kassier:in\n\n## Besetzung\n\n- Anna Beispiel\n- Sandro Ehrbar (seit 2026-01-01)\n',
      ),
      [saved],
      members,
    );
    expect(entry.draft.holders).toEqual([
      // Derselbe Sitz: Kennung, Konto und «seit» bleiben.
      { id: 'h-1', memberId: 'm-1', displayName: 'Anna Beispiel', interim: false, since: '2024-06-01' },
      // Neu – und weil der Name genau ein Mitglied trifft, gleich verknüpft.
      { id: null, memberId: 'm-2', displayName: 'Sandro Ehrbar', interim: false, since: '2026-01-01' },
    ]);
    expect(entry.changes).toContain('holders');
  });

  it('meldet, was save_office() zurückweisen würde, bevor es dorthin geht', () => {
    const [entry] = planOfficeImport(
      parseOfficeMarkdown('# A\n\n## Eckdaten\n\n- Sitze: 99\n'),
      [],
      members,
    );
    expect(entry.problems).toContain('titleMissing');
    expect(entry.problems).toContain('seatsInvalid');
    expect(entry.importable).toBe(false);
  });

  it('verknüpft die Ansprechperson über den Namen – und löst die Verknüpfung, wenn ein anderer dort steht', () => {
    const saved = office({ contactMemberId: 'm-2', contactName: 'Sandro Ehrbar' });
    const [linked] = planOfficeImport(
      parseOfficeMarkdown('# Kassier:in\n\n## Eckdaten\n\n- Ansprechperson: Anna Beispiel\n'),
      [saved],
      members,
    );
    expect(linked.draft.contactMemberId).toBe('m-1');

    const [unlinked] = planOfficeImport(
      parseOfficeMarkdown('# Kassier:in\n\n## Eckdaten\n\n- Ansprechperson: Peter Ohnekonto\n'),
      [saved],
      members,
    );
    expect(unlinked.draft.contactMemberId).toBeNull();
    expect(unlinked.draft.contactName).toBe('Peter Ohnekonto');
  });
});

describe('Dateinamen und Sprache', () => {
  it('benennt ein Amt und den ganzen Verein verschieden', () => {
    const day = new Date(2026, 8, 15);
    expect(officeMarkdownFileName('kadetten-unihockey', 'Halle / BBC', day)).toBe(
      'kadetten-unihockey-amt-halle-bbc-2026-09-15.md',
    );
    expect(officeMarkdownFileName('kadetten-unihockey', null, day)).toBe(
      'kadetten-unihockey-aemter-2026-09-15.md',
    );
  });

  it('schreibt ein einzelnes Amt ohne Vereinsvorspann', () => {
    const doc = officeMarkdownDocument({
      offices: [office()],
      clubSlug: 'kadetten',
      clubName: 'Kadetten',
      lang: 'de',
      today: new Date(2026, 8, 15),
    });
    expect(doc.fileName).toBe('kadetten-amt-kassier-in-2026-09-15.md');
    expect(doc.text.startsWith('# Kassier:in')).toBe(true);
  });

  it('nimmt die Sprache der App und fällt sonst auf Deutsch zurück', () => {
    expect(officeMarkdownLang('de-CH')).toBe('de');
    expect(officeMarkdownLang('fr')).toBe('fr');
    expect(officeMarkdownLang('rm')).toBe('de');
    expect(officeMarkdownLang(undefined)).toBe('de');
  });
});

describe('Vorlage', () => {
  it('trägt keine Kennung – eine Kopie überschreibt kein bestehendes Amt', () => {
    expect(officeTemplateMarkdown('de')).not.toContain('office id:');
    expect(parseOfficeMarkdown(officeTemplateMarkdown('it'))[0].id).toBeNull();
  });

  it('nennt den Verein in jeder Sprache dieselben Abschnitte', () => {
    for (const lang of ['de', 'fr', 'it', 'en'] as const) {
      const parsed = parseOfficeMarkdown(officeTemplateMarkdown(lang));
      expect(parsed).toHaveLength(1);
      expect(parsed[0].unknownSections).toEqual([]);
      expect(parsed[0].fields.dutiesText).toBeTruthy();
    }
  });
});

describe('Vereinsdatei', () => {
  it('trägt Verein und Datum im Vorspann, ohne dass er als Amt zählt', () => {
    const text = officesToMarkdown([office()], 'de', 'Kadetten', new Date(2026, 8, 15));
    expect(text.startsWith('<!-- myclub nexus · Kadetten · 2026-09-15 -->')).toBe(true);
    expect(parseOfficeMarkdown(text)).toHaveLength(1);
  });
});

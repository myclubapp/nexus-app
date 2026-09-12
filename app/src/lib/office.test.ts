import { describe, expect, it } from 'vitest';
import {
  checkFactsheetFile,
  dutiesToText,
  factsheetPath,
  isVacant,
  officeToDraft,
  openSeats,
  parseDuties,
  readDuties,
  sortOffices,
  validateOffice,
  type Office,
  type OfficeDraft,
  type OfficeHolder,
} from './office';

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
    id: 'o-1',
    title: 'Kassier:in',
    holderMemberId: null,
    holderName: null,
    heldSince: null,
    why: null,
    duties: [],
    hoursPerSeason: '10h+',
    pointsLabel: '7',
    maxHolders: 1,
    contactMemberId: null,
    contactName: 'Kevin Gysel',
    factsheetPath: null,
    holders: [],
    ...overrides,
  };
}

function draft(overrides: Partial<OfficeDraft> = {}): OfficeDraft {
  return {
    title: 'Kassier:in',
    why: '',
    dutiesText: '',
    hoursPerSeason: '',
    pointsLabel: '',
    maxHolders: 1,
    contactMemberId: null,
    contactName: '',
    holders: [],
    ...overrides,
  };
}

describe('Sitzrechnung (BR-183)', () => {
  it('zählt offene Sitze als Sitze minus ordentliche Inhaber:innen', () => {
    expect(openSeats(office({ maxHolders: 6, holders: [holder(), holder({ id: 'h-2' }), holder({ id: 'h-3' })] }))).toBe(3);
  });

  it('lässt «ad interim» den Sitz offen', () => {
    // Damentrainer:in: «Vakant / Jonathan Kissling (ad interim)».
    const interim = office({ maxHolders: 1, holders: [holder({ interim: true })] });
    expect(openSeats(interim)).toBe(1);
    expect(isVacant(interim)).toBe(true);
  });

  it('wird nie negativ', () => {
    expect(openSeats(office({ maxHolders: 1, holders: [holder(), holder({ id: 'h-2' })] }))).toBe(0);
  });

  it('ist besetzt, sobald alle Sitze getragen werden', () => {
    expect(isVacant(office({ maxHolders: 1, holders: [holder()] }))).toBe(false);
  });
});

describe('Pflichten als Textfeld', () => {
  it('trennt Absätze und liest die erste Zeile als Überschrift', () => {
    const text = 'Trainingsbetrieb sicherstellen\nPlanung, Organisation und Durchführung.\n\nVereinswerte vertreten';
    expect(parseDuties(text)).toEqual([
      { title: 'Trainingsbetrieb sicherstellen', detail: 'Planung, Organisation und Durchführung.' },
      { title: 'Vereinswerte vertreten', detail: null },
    ]);
  });

  it('übersteht leere Zeilen und Leerraum', () => {
    expect(parseDuties('\n\n  Eins  \n\n\n Zwei \n  mehr dazu \n\n')).toEqual([
      { title: 'Eins', detail: null },
      { title: 'Zwei', detail: 'mehr dazu' },
    ]);
  });

  it('ist die Umkehrung von dutiesToText()', () => {
    const duties = [
      { title: 'Eins', detail: 'Genauer.' },
      { title: 'Zwei', detail: null },
    ];
    expect(parseDuties(dutiesToText(duties))).toEqual(duties);
  });

  it('nimmt aus einem fremden jsonb nur, was die Form hat', () => {
    expect(readDuties([{ title: 'Eins', detail: '' }, { detail: 'ohne Titel' }, 'text', null, { title: ' Zwei ', detail: ' x ' }]))
      .toEqual([{ title: 'Eins', detail: null }, { title: 'Zwei', detail: 'x' }]);
    expect(readDuties('nichts')).toEqual([]);
  });
});

describe('validateOffice()', () => {
  it('lässt ein vollständiges Amt durch', () => {
    expect(validateOffice(draft())).toEqual([]);
  });

  it('verlangt die Bezeichnung – dieselben Grenzen wie save_office()', () => {
    expect(validateOffice(draft({ title: ' K ' }))).toContain('titleMissing');
    expect(validateOffice(draft({ title: 'x'.repeat(81) }))).toContain('titleTooLong');
  });

  it('hält die Sitze zwischen 1 und 50', () => {
    expect(validateOffice(draft({ maxHolders: 0 }))).toContain('seatsInvalid');
    expect(validateOffice(draft({ maxHolders: 51 }))).toContain('seatsInvalid');
    expect(validateOffice(draft({ maxHolders: 2.5 }))).toContain('seatsInvalid');
  });

  it('verlangt einen Namen nur für Sitze ohne Konto (BR-184)', () => {
    const unnamed = { id: null, memberId: null, displayName: '  ', interim: false };
    expect(validateOffice(draft({ holders: [unnamed] }))).toContain('holderNameMissing');
    const linked = { id: null, memberId: 'm-1', displayName: '', interim: false };
    expect(validateOffice(draft({ holders: [linked] }))).toEqual([]);
  });

  it('lässt nicht mehr ordentliche Inhaber:innen zu als Sitze', () => {
    const two = [
      { id: null, memberId: null, displayName: 'A', interim: false },
      { id: null, memberId: null, displayName: 'B', interim: false },
    ];
    expect(validateOffice(draft({ maxHolders: 1, holders: two }))).toContain('tooManyHolders');
    // «ad interim» belegt keinen Sitz.
    const withInterim = [two[0], { ...two[1], interim: true }];
    expect(validateOffice(draft({ maxHolders: 1, holders: withInterim }))).toEqual([]);
  });
});

describe('officeToDraft()', () => {
  it('bringt ein gespeichertes Amt ins Formular und zurück', () => {
    const saved = office({
      why: 'Damit die Kasse stimmt',
      duties: [{ title: 'Buchhaltung', detail: 'Abschluss per 31. Mai' }],
      holders: [holder({ id: 'h-9', memberId: 'm-1', since: '2024-06-01' })],
    });
    const result = officeToDraft(saved);
    expect(result.dutiesText).toBe('Buchhaltung\nAbschluss per 31. Mai');
    expect(result.holders).toEqual([
      { id: 'h-9', memberId: 'm-1', displayName: 'Anna Beispiel', interim: false },
    ]);
    expect(parseDuties(result.dutiesText)).toEqual(saved.duties);
  });
});

describe('Factsheet', () => {
  it('liegt im Vereinsordner unter der Kennung des Amtes (BR-186)', () => {
    expect(factsheetPath('club-1', 'office-1')).toBe('club-1/office-1.pdf');
  });

  it('nimmt nur PDFs bis zur Bucket-Grenze', () => {
    expect(checkFactsheetFile({ type: 'application/pdf', size: 1000, name: 'x.pdf' })).toBeNull();
    expect(checkFactsheetFile({ type: '', size: 1000, name: 'x.PDF' })).toBeNull();
    expect(checkFactsheetFile({ type: 'image/png', size: 1000, name: 'x.png' })).toBe('notPdf');
    expect(checkFactsheetFile({ type: 'application/pdf', size: 11 * 1024 * 1024, name: 'x.pdf' })).toBe('tooLarge');
  });
});

describe('sortOffices()', () => {
  it('stellt vakante Ämter zuerst, die grösste Lücke zuoberst, sonst alphabetisch', () => {
    const list = [
      office({ id: 'a', title: 'Webmaster', maxHolders: 1, holders: [holder()] }),
      office({ id: 'b', title: 'Schiedsrichter:in', maxHolders: 6, holders: [holder(), holder({ id: 'h-2' }), holder({ id: 'h-3' })] }),
      office({ id: 'c', title: 'Apothekenverantwortliche:r', maxHolders: 1 }),
      office({ id: 'd', title: 'Kassier:in', maxHolders: 1, holders: [holder()] }),
    ];
    expect(sortOffices(list).map((entry) => entry.id)).toEqual(['b', 'c', 'd', 'a']);
  });
});

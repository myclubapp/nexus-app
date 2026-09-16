import { describe, expect, it } from 'vitest';
import {
  boardRoleIds,
  checkFactsheetFile,
  creditableSeats,
  groupOffices,
  dutiesToText,
  factsheetPath,
  isVacant,
  officePointsExtra,
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
    seasonPoints: 350,
    maxHolders: 1,
    isBoard: false,
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
    seasonPoints: null,
    maxHolders: 1,
    isBoard: false,
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

describe('creditableSeats() (BR-264)', () => {
  it('zählt nur Sitze mit Punktwert **und** verknüpftem Konto', () => {
    const rows = [
      // Zählt: Wert und Konto.
      office({ id: 'a', seasonPoints: 350, holders: [holder({ memberId: 'm-1' })] }),
      // Zählt nicht: Ein Name ohne Konto ist kein Buchungsziel (BR-184).
      office({ id: 'b', seasonPoints: 200, holders: [holder({ memberId: null })] }),
      // Zählt nicht: `null` heisst «noch nicht entschieden», nicht «null Punkte».
      office({ id: 'c', seasonPoints: null, holders: [holder({ memberId: 'm-2' })] }),
      // Zählt nicht: Ein Amt, für das der Vorstand ausdrücklich 0 gesetzt hat.
      office({ id: 'd', seasonPoints: 0, holders: [holder({ memberId: 'm-3' })] }),
    ];

    expect(creditableSeats(rows)).toBe(1);
  });

  it('zählt jeden verknüpften Sitz eines Amtes, «ad interim» eingeschlossen', () => {
    // Drei Schiedsrichter:innen an einem Amt sind drei Buchungen – und wer ad
    // interim führt, leistet dieselbe Arbeit.
    const rows = [
      office({
        seasonPoints: 150,
        holders: [
          holder({ id: 'h-1', memberId: 'm-1' }),
          holder({ id: 'h-2', memberId: 'm-2' }),
          holder({ id: 'h-3', memberId: 'm-3', interim: true }),
          holder({ id: 'h-4', memberId: null }),
        ],
      }),
    ];

    expect(creditableSeats(rows)).toBe(3);
  });

  it('gibt ohne Ämter null', () => {
    expect(creditableSeats([])).toBe(0);
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

  it('hält den Punktwert zwischen 0 und 10000 – wie set_office_points() (BR-206)', () => {
    // Der Punktwert geht in einer zweiten Buchung an den Server: Ohne diese
    // Prüfung wäre das Amt schon gespeichert, wenn er zurückgewiesen wird.
    expect(validateOffice(draft({ seasonPoints: -1 }))).toContain('pointsInvalid');
    expect(validateOffice(draft({ seasonPoints: 10001 }))).toContain('pointsInvalid');
    expect(validateOffice(draft({ seasonPoints: 12.5 }))).toContain('pointsInvalid');
    // `null` heisst «noch nicht festgelegt» und ist gültig (BR-200).
    expect(validateOffice(draft({ seasonPoints: null }))).toEqual([]);
    expect(validateOffice(draft({ seasonPoints: 0 }))).toEqual([]);
    expect(validateOffice(draft({ seasonPoints: 10000 }))).toEqual([]);
  });

  it('verlangt einen Namen nur für Sitze ohne Konto (BR-184)', () => {
    const unnamed = { id: null, memberId: null, displayName: '  ', interim: false, since: null };
    expect(validateOffice(draft({ holders: [unnamed] }))).toContain('holderNameMissing');
    const linked = { id: null, memberId: 'm-1', displayName: '', interim: false, since: null };
    expect(validateOffice(draft({ holders: [linked] }))).toEqual([]);
  });

  it('lässt nicht mehr ordentliche Inhaber:innen zu als Sitze', () => {
    const two = [
      { id: null, memberId: null, displayName: 'A', interim: false, since: null },
      { id: null, memberId: null, displayName: 'B', interim: false, since: null },
    ];
    expect(validateOffice(draft({ maxHolders: 1, holders: two }))).toContain('tooManyHolders');
    // «ad interim» belegt keinen Sitz.
    const withInterim = [two[0], { ...two[1], interim: true }];
    expect(validateOffice(draft({ maxHolders: 1, holders: withInterim }))).toEqual([]);
  });
});

describe('officePointsExtra() (BR-206)', () => {
  it('schneidet die alte Helferpunktzahl ab und lässt den Zusatz stehen', () => {
    expect(officePointsExtra('4 + Lohn')).toBe('Lohn');
    expect(officePointsExtra('3 + Lohn + Spesen')).toBe('Lohn + Spesen');
  });

  it('gibt nichts zurück, wo nur eine Zahl stand', () => {
    // Die Zahl steht jetzt in `seasonPoints`; sie ein zweites Mal zu zeigen
    // behauptete eine zweite Skala.
    expect(officePointsExtra('4')).toBeNull();
    expect(officePointsExtra('7')).toBeNull();
    expect(officePointsExtra('1-4')).toBeNull();
    expect(officePointsExtra('1 – 4')).toBeNull();
    expect(officePointsExtra(null)).toBeNull();
    expect(officePointsExtra('   ')).toBeNull();
  });

  it('lässt einen Text ohne führende Zahl unangetastet', () => {
    expect(officePointsExtra('nach Aufwand')).toBe('nach Aufwand');
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
      // «seit» trägt das Formular mit, ohne es zu zeigen: Ein Speichern darf
      // das Datum nicht verlieren (UC-041 A8).
      { id: 'h-9', memberId: 'm-1', displayName: 'Anna Beispiel', interim: false, since: '2024-06-01' },
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

describe('boardRoleIds()', () => {
  it('gibt die Ämter des Vorstands – den Empfängerkreis einer Sitzung (BR-237)', () => {
    const list = [
      office({ id: 'a', title: 'Präsident/in', isBoard: true }),
      office({ id: 'b', title: 'Webmaster' }),
      office({ id: 'c', title: 'Kassier:in', isBoard: true }),
    ];
    expect(boardRoleIds(list)).toEqual(['a', 'c']);
  });

  it('gibt eine leere Liste, solange kein Amt zum Vorstand gehört', () => {
    // Dann bleibt die Voreinstellung leer, und das Formular verlangt die Wahl
    // – lieber das als eine Sitzung, die stillschweigend an niemanden geht.
    expect(boardRoleIds([office({ id: 'a' })])).toEqual([]);
  });
});

describe('groupOffices()', () => {
  it('trennt den Vorstand von den übrigen Ämtern (BR-237)', () => {
    const list = [
      office({ id: 'a', title: 'Webmaster', maxHolders: 1, holders: [holder()] }),
      office({ id: 'b', title: 'Präsident/in', isBoard: true, maxHolders: 1, holders: [holder()] }),
      office({ id: 'c', title: 'Kassier:in', isBoard: true, maxHolders: 1 }),
    ];
    const { board, others } = groupOffices(list);
    // Innerhalb der Gruppe gilt dieselbe Reihenfolge wie sonst: vakant zuerst.
    expect(board.map((entry) => entry.id)).toEqual(['c', 'b']);
    expect(others.map((entry) => entry.id)).toEqual(['a']);
  });

  it('lässt die Vorstandsgruppe leer, solange kein Amt sie trägt', () => {
    // Dann zeigt die Seite die eine Liste – eine Überschrift ohne Inhalt wäre
    // schlechter als keine Gruppe.
    const { board, others } = groupOffices([office({ id: 'a' })]);
    expect(board).toEqual([]);
    expect(others).toHaveLength(1);
  });
});

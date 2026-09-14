import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MEMBER_EXPORT_OPTIONS,
  effectiveExportOptions,
  memberExportCsv,
  memberExportFileName,
  memberExportHeader,
  memberExportRow,
  type MemberExportLabels,
  type MemberExportOptions,
  type MemberExportRow,
} from './memberExport';

const labels: MemberExportLabels = {
  firstName: 'Vorname',
  lastName: 'Nachname',
  displayName: 'Anzeigename',
  email: 'E-Mail',
  phone: 'Telefonnummer',
  birthDate: 'Geburtsdatum',
  street: 'Strasse',
  houseNumber: 'Nummer',
  postalCode: 'Postleitzahl',
  city: 'Ort',
  country: 'Land',
  role: 'Rolle',
  status: 'Status',
  memberSince: 'Mitglied seit',
  teams: 'Teams',
  offices: 'Ämter',
};

const translate = {
  role: (value: string) => (value === 'admin' ? 'Vorstand' : 'Mitglied'),
  status: (value: string) => (value === 'passive' ? 'Passiv' : 'Aktiv'),
};

const none: MemberExportOptions = {
  email: false,
  phone: false,
  birthDate: false,
  address: false,
  teams: false,
  offices: false,
};

function row(overrides: Partial<MemberExportRow> = {}): MemberExportRow {
  return {
    member_id: 'm1',
    first_name: 'Anna',
    last_name: 'Muster',
    display_name: 'Anna Muster',
    email: 'anna@example.com',
    phone: '079 111 22 33',
    birth_date: '1990-04-05',
    street: 'Musterstrasse',
    house_number: '12a',
    postal_code: '8000',
    city: 'Zürich',
    country: 'CH',
    role: 'admin',
    status: 'active',
    member_since: '2020-01-15',
    teams: 'Herren 1, Senioren',
    offices: 'Kassier:in',
    ...overrides,
  };
}

describe('memberExportHeader', () => {
  it('führt Name, Rolle, Status und Eintritt immer mit', () => {
    expect(memberExportHeader(none, labels)).toEqual([
      'Vorname',
      'Nachname',
      'Anzeigename',
      'Rolle',
      'Status',
      'Mitglied seit',
    ]);
  });

  it('zerlegt die Adresse in fünf Spalten (BR-207)', () => {
    const header = memberExportHeader({ ...none, address: true }, labels);
    expect(header).toContain('Strasse');
    expect(header).toContain('Nummer');
    expect(header).toContain('Postleitzahl');
    expect(header).toContain('Ort');
    expect(header).toContain('Land');
  });

  it('hält Kopf und Zeile gleich lang – in jeder Kombination', () => {
    const flags: (keyof MemberExportOptions)[] = [
      'email',
      'phone',
      'birthDate',
      'address',
      'teams',
      'offices',
    ];
    // Alle 64 Kombinationen: Eine Spalte, die im Kopf fehlt, aber in der
    // Zeile steht, verschiebt die ganze Datei.
    for (let mask = 0; mask < 1 << flags.length; mask += 1) {
      const options = { ...none };
      flags.forEach((flag, index) => {
        options[flag] = Boolean(mask & (1 << index));
      });
      expect(memberExportRow(row(), options, translate)).toHaveLength(
        memberExportHeader(options, labels).length,
      );
    }
  });
});

describe('memberExportRow', () => {
  it('übersetzt Rolle und Status, statt die Datenbankwerte zu schreiben', () => {
    const cells = memberExportRow(row(), none, translate);
    expect(cells).toContain('Vorstand');
    expect(cells).toContain('Aktiv');
    expect(cells).not.toContain('admin');
  });

  it('lässt leere Felder leer, statt «null» zu schreiben', () => {
    const cells = memberExportRow(
      row({ first_name: null, last_name: null, email: null, teams: null }),
      { ...none, email: true, teams: true },
      translate,
    );
    expect(cells).not.toContain(null);
    expect(cells.filter((cell) => cell === '').length).toBeGreaterThan(0);
  });

  it('behält die führende Null einer ausländischen Postleitzahl', () => {
    const cells = memberExportRow(
      row({ postal_code: '01067', city: 'Dresden', country: 'DE' }),
      { ...none, address: true },
      translate,
    );
    expect(cells).toContain('01067');
  });
});

describe('memberExportCsv', () => {
  it('trennt mit Semikolon und beendet Zeilen mit CRLF', () => {
    const csv = memberExportCsv([row()], none, labels, translate);
    const [header, first] = csv.split('\r\n');
    expect(header).toBe('"Vorname";"Nachname";"Anzeigename";"Rolle";"Status";"Mitglied seit"');
    expect(first).toContain('"Anna";"Muster"');
  });

  it('verschiebt die Spalten nicht, wenn ein Name ein Semikolon trägt', () => {
    const csv = memberExportCsv(
      [row({ last_name: 'Muster; Zweit', first_name: 'Anna "Ann"' })],
      none,
      labels,
      translate,
    );
    const line = csv.split('\r\n')[1];
    expect(line).toContain('"Anna ""Ann"""');
    expect(line).toContain('"Muster; Zweit"');
    // Sechs gequotete Felder, also fünf trennende Semikolons ausserhalb der
    // Anführungszeichen – das eine im Namen zählt nicht mit.
    expect(line.split('";"')).toHaveLength(6);
  });

  it('schreibt nur die Kopfzeile, wenn keine Zeile herausgeht', () => {
    expect(memberExportCsv([], none, labels, translate)).not.toContain('\r\n');
  });
});

describe('memberExportFileName', () => {
  const day = new Date(2026, 8, 14);

  it('nennt Verein und Datum', () => {
    expect(memberExportFileName('sc-muster', null, day)).toBe(
      'sc-muster-mitglieder-2026-09-14.csv',
    );
  });

  it('nimmt das Team dazu, wenn nur eines herausgeht', () => {
    expect(memberExportFileName('sc-muster', 'Herren 1', day)).toBe(
      'sc-muster-mitglieder-herren-1-2026-09-14.csv',
    );
  });

  it('löst Umlaute auf und lässt keinen Pfad entstehen', () => {
    expect(memberExportFileName('sc-muster', 'Damen/Jun. Ü30', day)).toBe(
      'sc-muster-mitglieder-damen-jun-u30-2026-09-14.csv',
    );
  });

  it('kommt ohne Vereinskürzel aus', () => {
    expect(memberExportFileName(null, null, day)).toBe('club-mitglieder-2026-09-14.csv');
  });
});

describe('DEFAULT_MEMBER_EXPORT_OPTIONS', () => {
  it('entspricht der Voreinstellung der bestehenden myclub-App: alles ausser Teams', () => {
    expect(DEFAULT_MEMBER_EXPORT_OPTIONS).toEqual({
      email: true,
      phone: true,
      birthDate: true,
      address: true,
      teams: false,
      offices: true,
    });
  });
});

describe('effectiveExportOptions', () => {
  const all: MemberExportOptions = {
    email: true,
    phone: true,
    birthDate: true,
    address: true,
    teams: true,
    offices: true,
  };

  it('lässt dem Vorstand jede Wahl', () => {
    expect(effectiveExportOptions(all, true)).toEqual(all);
  });

  it('nimmt der Trainer:in Adresse und Geburtsdatum (BR-206)', () => {
    const effective = effectiveExportOptions(all, false);
    expect(effective.address).toBe(false);
    expect(effective.birthDate).toBe(false);
    // Alles andere bleibt ihre Entscheidung.
    expect(effective.email).toBe(true);
    expect(effective.teams).toBe(true);
    expect(effective.offices).toBe(true);
  });

  it('erzeugt für die Trainer:in gar keine Adressspalten', () => {
    const header = memberExportHeader(effectiveExportOptions(all, false), labels);
    // Fünf leere Spalten sind kein Datenschutz, sondern eine Datei, die etwas
    // verspricht und nichts hält.
    expect(header).not.toContain('Strasse');
    expect(header).not.toContain('Postleitzahl');
    expect(header).not.toContain('Geburtsdatum');
  });
});

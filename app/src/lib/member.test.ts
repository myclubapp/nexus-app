import { describe, expect, it } from 'vitest';
import {
  ASSIGNABLE_ROLES,
  EMPTY_MEMBER_FILTER,
  firstName,
  initials,
  MEMBER_STATUSES,
  filterMembers,
  isLastAdmin,
  type FilterableMember,
} from './member';

function member(overrides: Partial<FilterableMember> = {}): FilterableMember {
  return {
    id: 'm1',
    display_name: 'Anna Muster',
    role: 'member',
    status: 'active',
    teamIds: [],
    ...overrides,
  };
}

const people: FilterableMember[] = [
  member({ id: 'm1', display_name: 'Zora Zünd', role: 'admin', teamIds: ['t1'] }),
  member({ id: 'm2', display_name: 'anna muster', role: 'member', teamIds: ['t1', 't2'] }),
  member({ id: 'm3', display_name: 'Örs Übelhart', role: 'trainer', teamIds: [] }),
  member({ id: 'm4', display_name: 'Beat Bühler', status: 'left', teamIds: ['t2'] }),
];

describe('filterMembers', () => {
  it('sortiert nach Name, unabhängig von der Schreibweise', () => {
    // Schritt 2 verlangt die Sortierung nach Name; «Örs» gehört im Deutschen
    // zwischen O und P, nicht ans Ende.
    expect(filterMembers(people, EMPTY_MEMBER_FILTER).map((m) => m.id)).toEqual([
      'm2',
      'm4',
      'm3',
      'm1',
    ]);
  });

  it('findet über einen Teil des Namens', () => {
    const found = filterMembers(people, { ...EMPTY_MEMBER_FILTER, search: 'muster' });
    expect(found.map((m) => m.id)).toEqual(['m2']);
  });

  it('ignoriert Gross- und Kleinschreibung sowie Rand-Leerzeichen', () => {
    const found = filterMembers(people, { ...EMPTY_MEMBER_FILTER, search: '  ZÜND ' });
    expect(found.map((m) => m.id)).toEqual(['m1']);
  });

  it('filtert nach Team (A4)', () => {
    expect(
      filterMembers(people, { ...EMPTY_MEMBER_FILTER, teamId: 't2' }).map((m) => m.id),
    ).toEqual(['m2', 'm4']);
  });

  it('filtert nach Rolle', () => {
    expect(
      filterMembers(people, { ...EMPTY_MEMBER_FILTER, role: 'trainer' }).map((m) => m.id),
    ).toEqual(['m3']);
  });

  it('filtert nach Status', () => {
    expect(
      filterMembers(people, { ...EMPTY_MEMBER_FILTER, status: 'left' }).map((m) => m.id),
    ).toEqual(['m4']);
  });

  it('verbindet mehrere Filter mit UND', () => {
    expect(
      filterMembers(people, {
        ...EMPTY_MEMBER_FILTER,
        teamId: 't1',
        role: 'member',
      }).map((m) => m.id),
    ).toEqual(['m2']);
  });

  it('liefert eine leere Liste, wenn nichts passt', () => {
    expect(
      filterMembers(people, { ...EMPTY_MEMBER_FILTER, search: 'gibtesnicht' }),
    ).toEqual([]);
  });

  it('lässt die übergebene Liste unverändert', () => {
    // `sort` verändert das Original – hier darf es das nicht.
    const original = [...people];
    filterMembers(people, EMPTY_MEMBER_FILTER);
    expect(people).toEqual(original);
  });
});

describe('isLastAdmin', () => {
  it('erkennt den einzigen Vorstand (BR-026)', () => {
    expect(isLastAdmin(people, 'm1')).toBe(true);
  });

  it('verneint bei einem zweiten Vorstand', () => {
    const two = [...people, member({ id: 'm5', display_name: 'Cem', role: 'admin' })];
    expect(isLastAdmin(two, 'm1')).toBe(false);
  });

  it('zählt superadmin mit', () => {
    const withSuper = [
      ...people,
      member({ id: 'm5', display_name: 'Cem', role: 'superadmin' }),
    ];
    expect(isLastAdmin(withSuper, 'm1')).toBe(false);
  });

  it('zählt ausgetretene Vorstände nicht mit', () => {
    // Sonst hielte eine ausgetretene Person den Verein für versorgt.
    const withLeft = [
      ...people,
      member({ id: 'm5', display_name: 'Cem', role: 'admin', status: 'left' }),
    ];
    expect(isLastAdmin(withLeft, 'm1')).toBe(true);
  });

  it('verneint für eine Person, die gar nicht Vorstand ist', () => {
    expect(isLastAdmin(people, 'm2')).toBe(false);
  });
});

describe('Auswahllisten', () => {
  it('bietet superadmin nicht zur Vergabe an – die Bereichsrolle aber schon', () => {
    // `sportchef` seit 0059 (Vision §4); `superadmin` bleibt eine Rolle, die
    // niemand vergibt.
    expect(ASSIGNABLE_ROLES).toEqual(['member', 'trainer', 'sportchef', 'admin']);
  });

  it('kennt alle vier Zustände aus dem Constraint', () => {
    expect(MEMBER_STATUSES).toEqual(['active', 'passive', 'honorary', 'left']);
  });
});

describe('initials', () => {
  it('nimmt den ersten und den letzten Namensteil', () => {
    expect(initials('Anna Meier')).toBe('AM');
    expect(initials('Jean-Luc von Arx')).toBe('JA');
  });

  it('kommt mit einem Wort aus', () => {
    expect(initials('Cla')).toBe('C');
  });

  it('zeigt ein Fragezeichen statt eines leeren Kreises', () => {
    // Ein leerer Avatar sähe aus wie ein Fehler; ein Fragezeichen sagt, dass
    // der Name fehlt.
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
    expect(initials(null)).toBe('?');
  });

  it('schreibt gross, auch wenn der Name klein geschrieben ist', () => {
    expect(initials('mira keller')).toBe('MK');
  });
});

describe('firstName', () => {
  it('nimmt den ersten Namensteil', () => {
    // Die App duzt; die Anrede heisst «Hallo Sandro», nicht «Hallo Sandro Scalco».
    expect(firstName('Sandro Scalco')).toBe('Sandro');
    expect(firstName('Anna Maria Rossi')).toBe('Anna');
  });

  it('lässt Bindestriche stehen', () => {
    expect(firstName('Jean-Luc von Arx')).toBe('Jean-Luc');
  });

  it('kommt mit einem Wort und mit Leerraum aus', () => {
    expect(firstName('Cla')).toBe('Cla');
    expect(firstName('  Mira   Keller ')).toBe('Mira');
  });

  it('bleibt leer, wenn der Name fehlt', () => {
    expect(firstName('')).toBe('');
    expect(firstName('   ')).toBe('');
    expect(firstName(null)).toBe('');
    expect(firstName(undefined)).toBe('');
  });
});

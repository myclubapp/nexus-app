import { describe, expect, it } from 'vitest';
import {
  AGENDA_KINDS,
  INPUT_STATUSES,
  MAX_INPUT_BODY,
  canDecide,
  groupAgenda,
  isAgendaEmpty,
  isInbox,
  isInputClosed,
  validateInput,
  type AgendaRow,
  type InputDraft,
  type MeetingInput,
} from './meeting';

function draft(overrides: Partial<InputDraft> = {}): InputDraft {
  return {
    body: 'Wir sollten die Garderobe streichen.',
    committeeRoleIds: ['office-1'],
    anonymous: false,
    sourceNoteId: null,
    ...overrides,
  };
}

function input(overrides: Partial<MeetingInput> = {}): MeetingInput {
  return {
    id: 'i-1',
    body: 'Wir sollten die Garderobe streichen.',
    status: 'open',
    committeeRoleIds: ['office-1'],
    meetingEventId: null,
    response: null,
    respondedAt: null,
    isMine: false,
    isAnonymous: false,
    createdAt: '2026-09-10T10:00:00Z',
    ...overrides,
  };
}

function row(kind: string, refId = 'r-1'): AgendaRow {
  return { kind: kind as AgendaRow['kind'], refId, title: 'Etwas', detail: null };
}

describe('INPUT_STATUSES', () => {
  it('führt genau die Stände des Entitätsmodells', () => {
    expect([...INPUT_STATUSES]).toEqual([
      'open',
      'scheduled',
      'in_progress',
      'answered',
      'declined',
    ]);
  });
});

describe('isInputClosed', () => {
  it('kennt genau die beiden Endstände', () => {
    expect(isInputClosed('answered')).toBe(true);
    expect(isInputClosed('declined')).toBe(true);
    expect(isInputClosed('open')).toBe(false);
    // «Eingeplant» ist **kein** Abschluss – es ist erst eine Auskunft (BR-134).
    expect(isInputClosed('scheduled')).toBe(false);
    expect(isInputClosed('in_progress')).toBe(false);
  });
});

describe('isInbox', () => {
  it('legt fremde Vorschläge in den Eingangskorb', () => {
    // Die Policy gibt nur heraus, was mir gehört oder an ein Amt geht, das ich
    // halte. Was nicht meines ist, ist folglich an mich gerichtet.
    expect(isInbox(input())).toBe(true);
    expect(isInbox(input({ isAnonymous: true }))).toBe(true);
  });

  it('lässt niemanden den eigenen Vorschlag triagieren', () => {
    expect(isInbox(input({ isMine: true }))).toBe(false);
  });
});

describe('validateInput', () => {
  it('lässt einen vollständigen Vorschlag durch', () => {
    expect(validateInput(draft())).toEqual([]);
  });

  it('verlangt einen Text', () => {
    expect(validateInput(draft({ body: '   ' }))).toContain('bodyMissing');
  });

  it('begrenzt die Länge wie der Constraint', () => {
    expect(validateInput(draft({ body: 'x'.repeat(MAX_INPUT_BODY + 1) }))).toContain(
      'bodyTooLong',
    );
  });

  it('verlangt ein Zielgremium (BR-133)', () => {
    // Ein Eingangskorb ohne Eigentümer wäre genau das Versanden, das §13.3
    // ausschliesst.
    expect(validateInput(draft({ committeeRoleIds: [] }))).toContain(
      'committeeMissing',
    );
  });

  it('verlangt das Zielgremium auch beim anonymen Weg', () => {
    expect(
      validateInput(draft({ anonymous: true, committeeRoleIds: [] })),
    ).toContain('committeeMissing');
  });
});

describe('canDecide', () => {
  it('verlangt zu jedem Entscheid seine Begründung (§13.3)', () => {
    expect(canDecide('Wir nehmen das im März auf.')).toBe(true);
    expect(canDecide('   ')).toBe(false);
    expect(canDecide('')).toBe(false);
  });
});

describe('groupAgenda', () => {
  it('teilt die Sammelansicht in genau drei Körbe (BR-135)', () => {
    const grouped = groupAgenda([
      row('input', 'i-1'),
      row('shift', 's-1'),
      row('vacancy', 'v-1'),
      row('input', 'i-2'),
    ]);

    expect(grouped.inputs.map((r) => r.refId)).toEqual(['i-1', 'i-2']);
    expect(grouped.vacancies.map((r) => r.refId)).toEqual(['v-1']);
    expect(grouped.shifts.map((r) => r.refId)).toEqual(['s-1']);
  });

  it('lässt alles fallen, was keiner der drei Arten ist (BR-132)', () => {
    // Selbst wenn die Datenbank eines Tages eine vierte Art lieferte, entstünde
    // hier kein Traktandum – es gibt keinen Korb dafür.
    const grouped = groupAgenda([row('agenda_item', 'x-1'), row('minutes', 'x-2')]);

    expect(isAgendaEmpty(grouped)).toBe(true);
  });

  it('führt genau die drei erlaubten Arten', () => {
    expect([...AGENDA_KINDS]).toEqual(['input', 'vacancy', 'shift']);
  });
});

describe('isAgendaEmpty', () => {
  it('meldet die leere Sitzung als leer', () => {
    expect(isAgendaEmpty(groupAgenda([]))).toBe(true);
  });

  it('genügt ein Dauerthema, damit die Ansicht nicht leer ist', () => {
    // Auch eine Sitzung ohne einen einzigen Vorschlag hat ihre zwei
    // Dauerthemen – wenn es sie gibt.
    expect(isAgendaEmpty(groupAgenda([row('vacancy')]))).toBe(false);
  });
});

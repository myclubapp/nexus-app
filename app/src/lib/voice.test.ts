import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_TRANSCRIPT,
  NOTE_STATUSES,
  TICKET_KEY,
  VOICE_KINDS,
  canAnswer,
  canHandle,
  isClosed,
  isPrivate,
  needsTarget,
  readStoredTickets,
  readTickets,
  storeTicket,
  taskTitleFrom,
  validateAnswer,
  validateVoiceNote,
  type VoiceDraft,
  type VoiceNote,
} from './voice';

function note(overrides: Partial<VoiceNote> = {}): VoiceNote {
  return {
    id: 'n-1',
    kind: 'feedback',
    transcript: 'Die Garderobe ist seit Wochen offen.',
    status: 'open',
    response: null,
    createdWeek: '2026-W37',
    createdAt: '2026-09-10T18:00:00Z',
    isMine: false,
    flagged: false,
    taskId: null,
    ...overrides,
  };
}

function draft(overrides: Partial<VoiceDraft> = {}): VoiceDraft {
  return {
    kind: 'self_reflection',
    text: 'Etwas, das mir wichtig ist.',
    target: null,
    targetMemberId: null,
    targetTeamId: null,
    ...overrides,
  };
}

describe('isPrivate', () => {
  it('erkennt die beiden Arten, die niemanden erreichen (BR-123)', () => {
    expect(isPrivate('self_reflection')).toBe(true);
    expect(isPrivate('coach_log')).toBe(true);
    expect(isPrivate('feedback')).toBe(false);
    expect(isPrivate('anonymous')).toBe(false);
  });
});

describe('needsTarget', () => {
  it('verlangt eine Adressierung nur beim gerichteten Anliegen', () => {
    // Anonym geht immer an den Vorstand – die Wahl gäbe es gar nicht.
    expect(needsTarget('feedback')).toBe(true);
    expect(needsTarget('anonymous')).toBe(false);
    expect(needsTarget('self_reflection')).toBe(false);
  });
});

describe('validateVoiceNote', () => {
  it('lässt ein vollständiges privates Anliegen durch', () => {
    expect(validateVoiceNote(draft(), 5)).toEqual([]);
  });

  it('verlangt einen Text (BR-121)', () => {
    expect(validateVoiceNote(draft({ text: '   ' }), 5)).toContain('textMissing');
  });

  it('begrenzt die Länge wie der Constraint', () => {
    const long = draft({ text: 'x'.repeat(MAX_TRANSCRIPT + 1) });
    expect(validateVoiceNote(long, 5)).toContain('textTooLong');
  });

  it('verlangt beim gerichteten Anliegen eine Adressierung', () => {
    expect(validateVoiceNote(draft({ kind: 'feedback' }), 5)).toContain(
      'targetMissing',
    );
  });

  it('verlangt bei «an eine Person» auch die Person', () => {
    const partial = draft({ kind: 'feedback', target: 'person' });
    expect(validateVoiceNote(partial, 5)).toContain('targetMissing');

    const complete = draft({
      kind: 'feedback',
      target: 'person',
      targetMemberId: 'm-1',
    });
    expect(validateVoiceNote(complete, 5)).toEqual([]);
  });

  it('verlangt beim anonymen Anliegen **keine** Adressierung', () => {
    expect(validateVoiceNote(draft({ kind: 'anonymous' }), 5)).toEqual([]);
  });

  it('sperrt bei ausgeschöpftem Kontingent (A5)', () => {
    expect(validateVoiceNote(draft(), 0)).toContain('quotaSpent');
  });
});

describe('VOICE_KINDS', () => {
  it('führt genau die vier Arten des Entitätsmodells', () => {
    expect([...VOICE_KINDS]).toEqual([
      'self_reflection', 'coach_log', 'feedback', 'anonymous',
    ]);
  });
});

describe('canHandle', () => {
  it('gibt der adressierten Person den Weg zur Antwort frei (UC-030)', () => {
    expect(canHandle(note())).toBe(true);
    expect(canHandle(note({ kind: 'anonymous' }))).toBe(true);
  });

  it('lässt niemanden das eigene Anliegen beantworten', () => {
    // Was mir gehört, steht in «Deine» – nicht im Eingang.
    expect(canHandle(note({ isMine: true }))).toBe(false);
  });

  it('rührt Privates nicht an (BR-123)', () => {
    // Die Policy gibt es ohnehin nur der Autorin heraus; erschiene hier ein
    // Antwortknopf, wäre das ein Versprechen, das der Server bricht.
    expect(canHandle(note({ kind: 'self_reflection', isMine: true }))).toBe(false);
    expect(canHandle(note({ kind: 'coach_log', isMine: true }))).toBe(false);
  });

  it('nimmt ein gemeldetes Anliegen aus dem Eingang (A6)', () => {
    expect(canHandle(note({ flagged: true }))).toBe(false);
  });
});

describe('isClosed', () => {
  it('kennt genau die beiden Endstände (BR-128)', () => {
    expect(isClosed(note({ status: 'answered' }))).toBe(true);
    expect(isClosed(note({ status: 'declined' }))).toBe(true);
    expect(isClosed(note({ status: 'open' }))).toBe(false);
    expect(isClosed(note({ status: 'in_progress' }))).toBe(false);
  });
});

describe('NOTE_STATUSES', () => {
  it('führt nur die Zwischenstände, die von Hand gesetzt werden', () => {
    // `set_note_status()` in 0047 lehnt jeden Endstatus ab: Er entsteht nur
    // zusammen mit einer Antwort. Stünde er hier, böte das Segment einen Weg
    // an, den der Server verweigert.
    expect([...NOTE_STATUSES]).toEqual(['open', 'in_progress']);
  });
});

describe('canAnswer', () => {
  it('verlangt zu jedem Entscheid seine Begründung (BR-128)', () => {
    expect(canAnswer('Wir haben das Schloss ersetzt.')).toBe(true);
    expect(canAnswer('   ')).toBe(false);
    expect(canAnswer('')).toBe(false);
  });
});

describe('readTickets', () => {
  it('liest die Tickets dieses Geräts', () => {
    expect(readTickets('["a","b"]')).toEqual(['a', 'b']);
  });

  it('überlebt einen kaputten Speicher', () => {
    // Der Rückkanal ist dann weg – die Seite darf es trotzdem nicht sein.
    expect(readTickets(null)).toEqual([]);
    expect(readTickets('kein json')).toEqual([]);
    expect(readTickets('{"a":1}')).toEqual([]);
    expect(readTickets('[1,"b",null]')).toEqual(['b']);
  });
});

describe('storeTicket', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('legt die Tickets nebeneinander ab, nicht übereinander', () => {
    // Wer zwei anonyme Anliegen schreibt, hat zwei Rückwege.
    expect(storeTicket('erstes')).toBe(true);
    expect(storeTicket('zweites')).toBe(true);
    expect(readStoredTickets()).toEqual(['erstes', 'zweites']);
    expect(window.localStorage.getItem(TICKET_KEY)).toBe('["erstes","zweites"]');
  });

  it('meldet den gesperrten Speicher, statt zu scheitern', () => {
    // Privates Fenster: Das Anliegen geht raus, die Antwort erreicht niemanden
    // mehr. Genau das muss die Seite sagen können.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(storeTicket('verloren')).toBe(false);
  });

  it('gibt bei gesperrtem Lesen eine leere Liste zurück', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readStoredTickets()).toEqual([]);
  });
});

describe('validateAnswer', () => {
  it('lässt eine Antwort ohne Folge-Artefakt durch', () => {
    expect(
      validateAnswer({
        text: 'Das Schloss ist ersetzt.',
        asTask: false,
        taskTitle: '',
        taskWhy: '',
      }),
    ).toEqual([]);
  });

  it('verlangt die Antwort auch dann, wenn abgelehnt wird (BR-128)', () => {
    // Derselbe Weg, derselbe Zwang: Ein Anliegen darf abgelehnt werden, aber
    // nicht versanden.
    expect(
      validateAnswer({ text: '   ', asTask: false, taskTitle: '', taskWhy: '' }),
    ).toEqual(['answerMissing']);
  });

  it('verlangt für die Aufgabe Titel und Warum (A3, BR-069)', () => {
    const problems = validateAnswer({
      text: 'Wir machen daraus eine Aufgabe.',
      asTask: true,
      taskTitle: 'A',
      taskWhy: '  ',
    });
    expect(problems).toEqual(['taskTitleMissing', 'taskWhyMissing']);
  });

  it('lässt die vollständige Aufgabe durch', () => {
    expect(
      validateAnswer({
        text: 'Wir machen daraus eine Aufgabe.',
        asTask: true,
        taskTitle: 'Schloss ersetzen',
        taskWhy: 'Damit nichts wegkommt.',
      }),
    ).toEqual([]);
  });
});

describe('taskTitleFrom', () => {
  it('nimmt die erste Zeile des Transkripts (A3, Schritt 1)', () => {
    expect(taskTitleFrom('Schloss ersetzen\nund zwar bald')).toBe('Schloss ersetzen');
  });

  it('kürzt einen langen Vorschlag, statt ihn zu übernehmen', () => {
    const long = 'x'.repeat(80);
    const title = taskTitleFrom(long);
    expect(title).toHaveLength(58);
    expect(title.endsWith('…')).toBe(true);
  });

  it('bleibt bei leerem Transkript leer', () => {
    expect(taskTitleFrom('')).toBe('');
  });
});

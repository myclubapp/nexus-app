import { describe, expect, it } from 'vitest';
import {
  CHECKIN_CONTEXTS,
  CHECKIN_SCALES,
  MAX_CHECKIN_TEXT,
  MIN_GROUP_SIZE,
  VISIBILITIES,
  isGroupBigEnough,
  scaleSteps,
  toPayload,
  trendAverage,
  trendPath,
  validateCheckin,
  visibilitiesFor,
  type CheckinAnswer,
  type TrendPoint,
} from './contextCheckin';

function answer(overrides: Partial<CheckinAnswer> = {}): CheckinAnswer {
  return { promptId: 'p-1', value: null, text: '', ...overrides };
}

function point(value: number, at = '2026-09-01T10:00:00Z'): TrendPoint {
  return { at, context: 'training_attended', value };
}

describe('CHECKIN_CONTEXTS', () => {
  it('kennt keinen Kontext für Abwesenheit (BR-137)', () => {
    // Die Regel ist als Schema umgesetzt, nicht als Prüfung: Wo kein Wert
    // existiert, lässt sich auch keine Frage anlegen. Dieser Test hält fest,
    // dass niemand später einen hinzufügt.
    expect([...CHECKIN_CONTEXTS]).toEqual([
      'training_attended',
      'match_lineup',
      'match_bench',
      'helper_shift',
      'office_load',
    ]);
    expect(CHECKIN_CONTEXTS).not.toContain('absent');
    expect(CHECKIN_CONTEXTS).not.toContain('excused');
  });
});

describe('CHECKIN_SCALES', () => {
  it('führt genau die Formate des Entitätsmodells', () => {
    expect([...CHECKIN_SCALES]).toEqual(['emoji5', 'stars5', 'freetext']);
  });
});

describe('VISIBILITIES', () => {
  it('stellt privat an den Anfang (BR-139)', () => {
    // Die Reihenfolge ist die der Offenheit – und `private` ist die Vorgabe,
    // nicht eine Option unter dreien.
    expect(VISIBILITIES[0]).toBe('private');
  });
});

describe('visibilitiesFor', () => {
  it('bietet nach einem Termin das Teilen mit der Trainer:in an (A5)', () => {
    expect(visibilitiesFor('training_attended')).toEqual(['private', 'shared_trainer']);
    expect(visibilitiesFor('match_lineup')).toEqual(['private', 'shared_trainer']);
    expect(visibilitiesFor('match_bench')).toEqual(['private', 'shared_trainer']);
  });

  it('bietet nach einem Einsatz die organisierende Person an (A4)', () => {
    // Und **nicht** die Trainer:in: Ein Helfereinsatz hat keine.
    expect(visibilitiesFor('helper_shift')).toEqual(['private', 'event_organizer']);
  });

  it('lässt den Entlastungs-Index nur privat', () => {
    // Die Frage, bei der eine Weitergabe an die eigene Vorgesetzte am
    // wenigsten harmlos wäre (FR-109).
    expect(visibilitiesFor('office_load')).toEqual(['private']);
  });
});

describe('scaleSteps', () => {
  it('gibt fünf Stufen – mit Mitte', () => {
    // Eine gerade Zahl nähme die Mitte weg und erzwänge eine Entscheidung,
    // die niemand treffen wollte.
    expect(scaleSteps('emoji5')).toEqual([1, 2, 3, 4, 5]);
    expect(scaleSteps('stars5')).toEqual([1, 2, 3, 4, 5]);
  });

  it('gibt für Freitext keine Stufen', () => {
    expect(scaleSteps('freetext')).toEqual([]);
  });
});

describe('validateCheckin', () => {
  it('lässt eine einzige beantwortete Frage genügen', () => {
    // Ein Check-in soll in unter zehn Sekunden erledigt sein (FR-102); wer die
    // zweite Frage überspringt, hat trotzdem etwas gesagt.
    expect(
      validateCheckin([answer({ value: 4 }), answer({ promptId: 'p-2' })]),
    ).toEqual([]);
  });

  it('nimmt auch einen reinen Text als Antwort (A4)', () => {
    expect(validateCheckin([answer({ text: 'Zu wenig Personal am Grill.' })])).toEqual(
      [],
    );
  });

  it('verlangt mindestens eine Antwort', () => {
    expect(validateCheckin([answer(), answer({ promptId: 'p-2' })])).toEqual([
      'answerMissing',
    ]);
    expect(validateCheckin([answer({ text: '   ' })])).toEqual(['answerMissing']);
    expect(validateCheckin([])).toEqual(['answerMissing']);
  });

  it('begrenzt den Text wie der Constraint', () => {
    expect(validateCheckin([answer({ text: 'x'.repeat(MAX_CHECKIN_TEXT + 1) })])).toContain(
      'textTooLong',
    );
  });
});

describe('toPayload', () => {
  it('lässt unbeantwortete Fragen weg', () => {
    // Eine leere Frage mitzuschicken hiesse, sie als beantwortet zu zählen.
    expect(
      toPayload([answer({ value: 3 }), answer({ promptId: 'p-2' })]),
    ).toEqual([{ promptId: 'p-1', value: '3', text: '' }]);
  });

  it('schickt einen reinen Text ohne Wert', () => {
    expect(toPayload([answer({ text: '  lief gut  ' })])).toEqual([
      { promptId: 'p-1', value: '', text: 'lief gut' },
    ]);
  });
});

describe('isGroupBigEnough', () => {
  it('lässt einen Teamwert erst ab fünf Antworten zu (BR-140)', () => {
    expect(MIN_GROUP_SIZE).toBe(5);
    expect(isGroupBigEnough(4)).toBe(false);
    expect(isGroupBigEnough(5)).toBe(true);
    expect(isGroupBigEnough(0)).toBe(false);
  });
});

describe('trendPath', () => {
  it('legt einen einzelnen Punkt in die Mitte', () => {
    // Eine Kurve aus einem Wert am Rand behauptete eine Entwicklung, die es
    // nicht gibt.
    expect(trendPath([point(3)])).toBe('M 50 20');
  });

  it('bleibt bei keiner Antwort leer', () => {
    expect(trendPath([])).toBe('');
  });

  it('zeichnet fünf nach oben und eins nach unten', () => {
    // Im SVG wächst y nach unten; gut gehört aber nach oben.
    expect(trendPath([point(5), point(1)])).toBe('M 0 0 L 100 40');
  });

  it('verteilt die Punkte gleichmässig über die Breite', () => {
    expect(trendPath([point(1), point(3), point(5)])).toBe('M 0 40 L 50 20 L 100 0');
  });

  it('kappt Werte ausserhalb der Skala, statt aus dem Bild zu laufen', () => {
    expect(trendPath([point(9)])).toBe('M 50 0');
    expect(trendPath([point(-2)])).toBe('M 50 40');
  });
});

describe('trendAverage', () => {
  it('rechnet den eigenen Schnitt', () => {
    expect(trendAverage([point(4), point(3), point(5)])).toBe(4);
  });

  it('rundet auf zwei Stellen', () => {
    expect(trendAverage([point(4), point(3)])).toBe(3.5);
    expect(trendAverage([point(1), point(2), point(4)])).toBe(2.33);
  });

  it('hat für den eigenen Verlauf **keine** Mindestgruppengrösse', () => {
    // BR-140 schützt einzelne Personen in einer Gruppe, nicht die Person vor
    // sich selbst.
    expect(trendAverage([point(2)])).toBe(2);
  });

  it('gibt ohne Antworten nichts zurück', () => {
    expect(trendAverage([])).toBeNull();
  });
});

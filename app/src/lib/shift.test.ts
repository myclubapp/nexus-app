import { describe, expect, it } from 'vitest';
import {
  openShiftOffers,
  shiftCoverage,
  suggestedShiftPoints,
  validateShift,
  type ShiftDraft,
} from './shift';

describe('suggestedShiftPoints', () => {
  it('staffelt nach Dauer (BR-042)', () => {
    // Ein halber Tag und ein ganzer Tag zählen unterschiedlich.
    expect(suggestedShiftPoints(60)).toBe(25);
    expect(suggestedShiftPoints(240)).toBe(50);
    expect(suggestedShiftPoints(480)).toBe(100);
  });

  it('liegt an den Grenzen auf der tieferen Stufe', () => {
    expect(suggestedShiftPoints(120)).toBe(25);
    expect(suggestedShiftPoints(121)).toBe(50);
    expect(suggestedShiftPoints(300)).toBe(50);
    expect(suggestedShiftPoints(301)).toBe(100);
  });

  it('gibt für eine leere Dauer nichts', () => {
    expect(suggestedShiftPoints(0)).toBe(0);
    expect(suggestedShiftPoints(-30)).toBe(0);
  });
});

describe('validateShift', () => {
  function draft(overrides: Partial<ShiftDraft> = {}): ShiftDraft {
    return {
      title: 'Festwirtschaft Vormittag',
      startsAt: '2026-09-12T08:00',
      endsAt: '2026-09-12T12:00',
      needed: 4,
      points: 50,
      ...overrides,
    };
  }

  it('lässt eine vollständige Schicht durch', () => {
    expect(validateShift(draft())).toEqual([]);
  });

  it('verlangt eine Bezeichnung', () => {
    expect(validateShift(draft({ title: ' ' }))).toContain('titleMissing');
  });

  it('verlangt beide Zeiten – anders als beim Termin', () => {
    // `event_shifts.ends_at` ist seit 0018 `not null`; eine Schicht ohne Ende
    // liesse sich gar nicht speichern.
    expect(validateShift(draft({ endsAt: '' }))).toContain('timesMissing');
    expect(validateShift(draft({ startsAt: '' }))).toContain('timesMissing');
  });

  it('weist ein Ende vor oder auf dem Beginn ab', () => {
    expect(validateShift(draft({ endsAt: '2026-09-12T07:00' }))).toContain(
      'endBeforeStart',
    );
    expect(validateShift(draft({ endsAt: '2026-09-12T08:00' }))).toContain(
      'endBeforeStart',
    );
  });

  it('verlangt mindestens eine Person (BR-041)', () => {
    expect(validateShift(draft({ needed: 0 }))).toContain('neededTooLow');
    expect(validateShift(draft({ needed: Number.NaN }))).toContain('neededTooLow');
  });
});

describe('shiftCoverage', () => {
  const shift = { id: 's1', needed: 3 };

  it('zählt Eingetragene und Anwesende', () => {
    const coverage = shiftCoverage(shift, [
      { shift_id: 's1', status: 'registered' },
      { shift_id: 's1', status: 'present' },
    ]);
    expect(coverage).toMatchObject({ filled: 2, needed: 3, open: 1, isFull: false });
  });

  it('zählt Absagen nicht mit', () => {
    // Eine Absage belegt keinen Platz – sonst bliebe die Schicht scheinbar voll.
    const coverage = shiftCoverage(shift, [
      { shift_id: 's1', status: 'registered' },
      { shift_id: 's1', status: 'excused' },
      { shift_id: 's1', status: 'absent' },
    ]);
    expect(coverage.filled).toBe(1);
    expect(coverage.open).toBe(2);
  });

  it('ignoriert Eintragungen anderer Schichten', () => {
    const coverage = shiftCoverage(shift, [
      { shift_id: 's2', status: 'registered' },
      { shift_id: null, status: 'registered' },
    ]);
    expect(coverage.filled).toBe(0);
  });

  it('erkennt eine volle Schicht (BR-046)', () => {
    const coverage = shiftCoverage(shift, [
      { shift_id: 's1', status: 'registered' },
      { shift_id: 's1', status: 'registered' },
      { shift_id: 's1', status: 'registered' },
    ]);
    expect(coverage.isFull).toBe(true);
    expect(coverage.open).toBe(0);
  });

  it('wird nicht negativ, wenn mehr eingetragen sind als nötig', () => {
    const coverage = shiftCoverage({ id: 's1', needed: 1 }, [
      { shift_id: 's1', status: 'registered' },
      { shift_id: 's1', status: 'present' },
    ]);
    expect(coverage.open).toBe(0);
    expect(coverage.isFull).toBe(true);
  });

  it('meldet eine leere Schicht vollständig offen', () => {
    expect(shiftCoverage(shift, [])).toMatchObject({ filled: 0, open: 3, isFull: false });
  });
});

describe('openShiftOffers (UC-011, Postcondition)', () => {
  const now = new Date('2026-09-11T12:00:00.000Z');
  const future = '2026-09-20T12:00:00.000Z';
  const past = '2026-09-01T12:00:00.000Z';

  function event(shifts: { id: string; needed: number; ends_at: string }[], taken: string[] = []) {
    return {
      id: 'e-1',
      shifts,
      attendance: taken.map((id) => ({ shift_id: id, status: 'registered' })),
    };
  }

  it('nennt einen Termin mit freien Plätzen samt Zahl', () => {
    const offers = openShiftOffers(
      [event([{ id: 's-1', needed: 3, ends_at: future }], ['s-1'])],
      now,
    );
    expect(offers).toHaveLength(1);
    expect(offers[0].open).toBe(2);
    expect(offers[0].needed).toBe(3);
  });

  it('lässt einen besetzten Termin weg', () => {
    // Der Marktplatz fragt: Wo kann ich beitragen? Eine volle Schicht ist
    // dort kein Angebot.
    const offers = openShiftOffers(
      [event([{ id: 's-1', needed: 2, ends_at: future }], ['s-1', 's-1'])],
      now,
    );
    expect(offers).toHaveLength(0);
  });

  it('zählt vergangene Schichten nicht mit', () => {
    // Eine Schicht von gestern ist kein Angebot, sondern eine Lücke in der
    // Geschichte.
    const offers = openShiftOffers([event([{ id: 's-1', needed: 2, ends_at: past }])], now);
    expect(offers).toHaveLength(0);
  });

  it('summiert über mehrere Schichten desselben Termins', () => {
    const offers = openShiftOffers(
      [
        event(
          [
            { id: 's-1', needed: 2, ends_at: future },
            { id: 's-2', needed: 4, ends_at: future },
          ],
          ['s-1', 's-2'],
        ),
      ],
      now,
    );
    expect(offers[0].open).toBe(4);
    expect(offers[0].needed).toBe(6);
  });

  it('kommt mit einem Termin ohne Schichten zurecht', () => {
    expect(openShiftOffers([{ shifts: [] }], now)).toHaveLength(0);
    expect(openShiftOffers([{}], now)).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  MAX_SERIES_EVENTS,
  canCancelEvent,
  durationInMinutes,
  expandSeries,
  hasSeriesChoice,
  requiresWhy,
  suggestedRuleCode,
  validateCancel,
  validateEventDraft,
  type EventDraft,
  type SeriesRule,
} from './eventSeries';

function rule(overrides: Partial<SeriesRule> = {}): SeriesRule {
  return {
    rhythm: 'weekly',
    startsAt: '2026-09-07T19:00',
    until: '2026-10-05',
    durationMinutes: 90,
    ...overrides,
  };
}

/**
 * Dieselbe Liste zeigt die Vorschau (A1 Schritt 2) und legt die Termine an –
 * sonst entstünden andere Termine, als angekündigt waren.
 */
describe('expandSeries', () => {
  it('erzeugt wöchentliche Termine bis zum Enddatum', () => {
    const occurrences = expandSeries(rule());
    expect(occurrences.map((o) => o.startsAt)).toEqual([
      '2026-09-07T19:00',
      '2026-09-14T19:00',
      '2026-09-21T19:00',
      '2026-09-28T19:00',
      '2026-10-05T19:00',
    ]);
  });

  it('rechnet die Endzeit aus der Dauer', () => {
    expect(expandSeries(rule()).at(0)).toEqual({
      startsAt: '2026-09-07T19:00',
      endsAt: '2026-09-07T20:30',
    });
  });

  it('lässt die Endzeit weg, wenn keine Dauer gesetzt ist', () => {
    expect(expandSeries(rule({ durationMinutes: null })).at(0)?.endsAt).toBeNull();
  });

  it('erzeugt zweiwöchentliche Termine', () => {
    expect(
      expandSeries(rule({ rhythm: 'biweekly' })).map((o) => o.startsAt),
    ).toEqual(['2026-09-07T19:00', '2026-09-21T19:00', '2026-10-05T19:00']);
  });

  it('erzeugt monatliche Termine', () => {
    expect(
      expandSeries(
        rule({ rhythm: 'monthly', startsAt: '2026-09-07T19:00', until: '2026-12-31' }),
      ).map((o) => o.startsAt),
    ).toEqual([
      '2026-09-07T19:00',
      '2026-10-07T19:00',
      '2026-11-07T19:00',
      '2026-12-07T19:00',
    ]);
  });

  it('schiebt den 31. nicht in den übernächsten Monat', () => {
    // Ohne Korrektur würde aus dem 31. Januar der 3. März.
    expect(
      expandSeries(
        rule({ rhythm: 'monthly', startsAt: '2026-01-31T19:00', until: '2026-04-30' }),
      ).map((o) => o.startsAt),
    ).toEqual([
      '2026-01-31T19:00',
      '2026-02-28T19:00',
      '2026-03-28T19:00',
      '2026-04-28T19:00',
    ]);
  });

  it('nimmt einen Termin genau am Enddatum noch mit', () => {
    expect(expandSeries(rule({ until: '2026-09-07' }))).toHaveLength(1);
  });

  it('deckelt die Zahl der Termine', () => {
    // Ein Tippfehler im Jahr erzeugte sonst Hunderte von Terminen.
    const many = expandSeries(rule({ until: '2036-10-05' }));
    expect(many).toHaveLength(MAX_SERIES_EVENTS);
  });

  it('liefert nichts bei unbrauchbaren Angaben', () => {
    expect(expandSeries(rule({ startsAt: '' }))).toEqual([]);
    expect(expandSeries(rule({ until: '' }))).toEqual([]);
    // Enddatum vor dem Beginn.
    expect(expandSeries(rule({ until: '2026-09-01' }))).toEqual([]);
  });

  it('rechnet in lokaler Zeit, nicht in UTC', () => {
    // Über toISOString() würde aus 00:30 Uhr der Vortag.
    expect(expandSeries(rule({ startsAt: '2026-09-07T00:30', until: '2026-09-07' }))).toEqual(
      [{ startsAt: '2026-09-07T00:30', endsAt: '2026-09-07T02:00' }],
    );
  });
});

describe('durationInMinutes', () => {
  it('rechnet die Dauer aus zwei Zeitpunkten', () => {
    expect(durationInMinutes('2026-09-07T19:00', '2026-09-07T20:30')).toBe(90);
  });

  it('meldet ohne Endzeit null', () => {
    expect(durationInMinutes('2026-09-07T19:00', null)).toBeNull();
    expect(durationInMinutes('2026-09-07T19:00', '')).toBeNull();
  });

  it('meldet bei einem Ende vor dem Beginn null', () => {
    expect(durationInMinutes('2026-09-07T19:00', '2026-09-07T18:00')).toBeNull();
  });
});

describe('requiresWhy', () => {
  it.each(['helper', 'gv', 'social'] as const)('verlangt für %s ein Warum (BR-036)', (type) => {
    expect(requiresWhy(type)).toBe(true);
  });

  it.each(['training', 'match', 'cup', 'tournament'] as const)(
    'verlangt für %s keines',
    (type) => {
      expect(requiresWhy(type)).toBe(false);
    },
  );
});

describe('suggestedRuleCode', () => {
  const codes = ['training_attend', 'match_attend', 'shift_done', 'assembly_attend'];

  it('schlägt die passende Regel vor (Schritt 6)', () => {
    expect(suggestedRuleCode('training', codes)).toBe('training_attend');
    expect(suggestedRuleCode('helper', codes)).toBe('shift_done');
    expect(suggestedRuleCode('gv', codes)).toBe('assembly_attend');
  });

  it('schlägt für alle Wettkampfarten dieselbe Regel vor', () => {
    expect(suggestedRuleCode('cup', codes)).toBe('match_attend');
    expect(suggestedRuleCode('tournament', codes)).toBe('match_attend');
  });

  it('schlägt nichts vor, wenn die Regel im Verein fehlt', () => {
    // Ein Verein, der die Regel gelöscht oder umbenannt hat, wählt selbst.
    expect(suggestedRuleCode('training', ['task_done'])).toBeNull();
    expect(suggestedRuleCode('training', [])).toBeNull();
  });
});

describe('validateEventDraft', () => {
  function draft(overrides: Partial<EventDraft> = {}): EventDraft {
    return {
      type: 'training',
      title: 'Wochentraining',
      startsAt: '2026-09-07T19:00',
      endsAt: '2026-09-07T20:30',
      location: 'Halle',
      why: '',
      teamId: null,
      pointRuleCode: 'training_attend',
      ...overrides,
    };
  }

  it('lässt einen vollständigen Entwurf durch', () => {
    expect(validateEventDraft(draft())).toEqual([]);
  });

  it('verlangt einen Titel', () => {
    expect(validateEventDraft(draft({ title: ' ' }))).toContain('titleMissing');
    expect(validateEventDraft(draft({ title: 'A' }))).toContain('titleMissing');
  });

  it('verlangt einen Beginn', () => {
    expect(validateEventDraft(draft({ startsAt: '' }))).toContain('startMissing');
  });

  it('weist ein Ende vor dem Beginn ab (A5)', () => {
    expect(
      validateEventDraft(draft({ endsAt: '2026-09-07T18:00' })),
    ).toContain('endBeforeStart');
  });

  it('weist ein Ende gleich dem Beginn ab', () => {
    expect(
      validateEventDraft(draft({ endsAt: '2026-09-07T19:00' })),
    ).toContain('endBeforeStart');
  });

  it('lässt einen Termin ohne Endzeit zu', () => {
    expect(validateEventDraft(draft({ endsAt: '' }))).toEqual([]);
  });

  it('verlangt das Warum bei einem Helfer-Event (BR-036)', () => {
    expect(validateEventDraft(draft({ type: 'helper' }))).toContain('whyMissing');
    expect(
      validateEventDraft(draft({ type: 'helper', why: 'Damit das Turnier läuft.' })),
    ).toEqual([]);
  });

  it('verlangt es bei einem Training nicht', () => {
    expect(validateEventDraft(draft({ type: 'training', why: '' }))).toEqual([]);
  });

  it('meldet mehrere Mängel gleichzeitig', () => {
    const problems = validateEventDraft(
      draft({ type: 'gv', title: '', why: '', endsAt: '2026-09-07T18:00' }),
    );
    expect(problems).toEqual(
      expect.arrayContaining(['titleMissing', 'endBeforeStart', 'whyMissing']),
    );
  });
});

describe('Ändern und Absagen (UC-009, A2)', () => {
  const future = '2026-12-01T18:00:00.000Z';
  const past = '2026-01-01T18:00:00.000Z';
  const now = new Date('2026-09-11T12:00:00.000Z');

  it('lässt einen künftigen, nicht abgesagten Termin absagen', () => {
    expect(
      canCancelEvent({ cancelledAt: null, startsAt: future, seriesId: null }, now),
    ).toBe(true);
  });

  it('sagt einen bereits abgesagten Termin nicht zweimal ab', () => {
    // Der Grund steht, und alle Betroffenen haben ihn gelesen. Ein zweiter
    // überschriebe den ersten.
    expect(
      canCancelEvent(
        { cancelledAt: '2026-09-01T10:00:00.000Z', startsAt: future, seriesId: null },
        now,
      ),
    ).toBe(false);
  });

  it('sagt keinen vergangenen Termin ab', () => {
    // Was stattgefunden hat, sagt man nicht mehr ab – das wäre eine
    // Geschichtsfälschung gegenüber den Anwesenden.
    expect(
      canCancelEvent({ cancelledAt: null, startsAt: past, seriesId: null }, now),
    ).toBe(false);
  });

  it('stellt die Serienfrage nur bei einem Termin mit Serie', () => {
    expect(hasSeriesChoice({ cancelledAt: null, startsAt: future, seriesId: 's-1' })).toBe(
      true,
    );
    expect(hasSeriesChoice({ cancelledAt: null, startsAt: future, seriesId: null })).toBe(
      false,
    );
  });

  it('verlangt für die Absage einen Grund (BR-035)', () => {
    expect(validateCancel('')).toContain('reasonMissing');
    expect(validateCancel('  ')).toContain('reasonMissing');
    expect(validateCancel('Halle gesperrt')).toEqual([]);
  });
});

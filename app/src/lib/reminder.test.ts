import { describe, expect, it } from 'vitest';
import { canRemind, reminderMessage, type RemindableEvent } from './reminder';

describe('reminderMessage', () => {
  it('meldet die Zahl der Erinnerten', () => {
    expect(reminderMessage({ notified: 3, lastReminder: null })).toEqual({
      kind: 'sent',
      count: 3,
    });
  });

  it('meldet die laufende Frist mit ihrem Zeitpunkt (A1)', () => {
    expect(
      reminderMessage({ notified: 0, lastReminder: '2026-09-20T10:00:00Z' }),
    ).toEqual({ kind: 'tooSoon', lastReminder: '2026-09-20T10:00:00Z' });
  });

  it('unterscheidet «niemand offen» von «schon erinnert» (A2)', () => {
    // Ohne diese Unterscheidung behauptete die App eine Erinnerung, die es nie
    // gab – mit einem leeren Datum im Text.
    expect(reminderMessage({ notified: 0, lastReminder: null })).toEqual({
      kind: 'noneLeft',
    });
  });
});

describe('canRemind', () => {
  function event(overrides: Partial<RemindableEvent> = {}): RemindableEvent {
    return {
      isDraft: false,
      isCancelled: false,
      hasStarted: false,
      undecided: 2,
      isTrainer: true,
      ...overrides,
    };
  }

  it('lässt Trainer:innen einen offenen Termin erinnern', () => {
    expect(canRemind(event())).toBe(true);
  });

  it('verbirgt den Weg für Mitglieder', () => {
    expect(canRemind(event({ isTrainer: false }))).toBe(false);
  });

  it('verbirgt ihn, wenn alle geantwortet haben (A2)', () => {
    expect(canRemind(event({ undecided: 0 }))).toBe(false);
  });

  it('lässt ihn bei unbekannter Zahl stehen', () => {
    // Die Mitgliederabfrage kann fehlschlagen. Den Weg dann zu verbergen sähe
    // aus wie «alle haben geantwortet» – ein stiller Fehler, der wie ein
    // Erfolg aussieht.
    expect(canRemind(event({ undecided: null }))).toBe(true);
  });

  it('verbirgt ihn bei einem Termin mit Schichten (BR-196)', () => {
    // Auf den Anlass antwortet niemand – die Erinnerung ginge an alle.
    expect(canRemind(event({ viaShifts: true }))).toBe(false);
  });

  it('verbirgt ihn beim Entwurf, bei Absage und nach Beginn', () => {
    expect(canRemind(event({ isDraft: true }))).toBe(false);
    expect(canRemind(event({ isCancelled: true }))).toBe(false);
    expect(canRemind(event({ hasStarted: true }))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  MAX_TRANSCRIPT,
  VOICE_KINDS,
  isPrivate,
  needsTarget,
  validateVoiceNote,
  type VoiceDraft,
} from './voice';

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

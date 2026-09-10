import { describe, expect, it } from 'vitest';
import {
  MAX_STRENGTHS,
  TASK_CATEGORIES,
  TIME_BUDGETS,
  budgetCap,
  isBudgetSpent,
  isProfileFilled,
  readInterests,
  validateProfile,
  type ContributionDraft,
  type ContributionProfile,
} from './contribution';

function draft(overrides: Partial<ContributionDraft> = {}): ContributionDraft {
  return { interests: [], strengths: '', timeBudget: null, ...overrides };
}

function profile(overrides: Partial<ContributionProfile> = {}): ContributionProfile {
  return {
    interests: [],
    strengths: '',
    timeBudget: null,
    updatedAt: '2026-09-01T08:00:00Z',
    ...overrides,
  };
}

describe('TIME_BUDGETS', () => {
  it('führt die Werte der Datenbank, nicht die Anzeige', () => {
    // Das Entitätsmodell nennt «einmalig, monatlich, saisonal» – das ist die
    // Beschriftung. Der Wert ist englisch wie jeder Datenbankwert.
    expect([...TIME_BUDGETS]).toEqual(['once', 'monthly', 'seasonal']);
  });
});

describe('TASK_CATEGORIES', () => {
  it('ist dieselbe Liste wie am Marktplatz', () => {
    // Zwei Listen, die auseinanderlaufen, ergeben kein Matching – deshalb
    // wird die Liste aus `lib/task.ts` durchgereicht, nicht kopiert.
    expect([...TASK_CATEGORIES]).toEqual([
      'organisation',
      'facility',
      'catering',
      'transport',
      'communication',
      'finance',
      'coaching',
      'other',
    ]);
  });
});

describe('isProfileFilled', () => {
  it('erkennt ein Profil, das etwas sagt', () => {
    expect(isProfileFilled(profile({ interests: ['catering'] }))).toBe(true);
    expect(isProfileFilled(profile({ strengths: 'Ich koche gern.' }))).toBe(true);
  });

  it('zählt eine leere Zeile nicht als Profil (A1)', () => {
    // «Später ausfüllen» legt eine Zeile an, die nur festhält, dass gefragt
    // wurde. Sie darf keine persönlichen Vorschläge auslösen.
    expect(isProfileFilled(profile())).toBe(false);
    expect(isProfileFilled(profile({ strengths: '   ' }))).toBe(false);
  });

  it('kommt ohne Profil zurecht (BR-143)', () => {
    expect(isProfileFilled(null)).toBe(false);
  });
});

describe('validateProfile', () => {
  it('lässt ein leeres Profil zu (A1, BR-143)', () => {
    // Das ist der Kern von BR-143: «Später» muss ein Weg sein, kein Abbruch.
    expect(validateProfile(draft())).toEqual([]);
  });

  it('verlangt zu einem ausgefüllten Profil sein Zeitbudget (BR-144)', () => {
    expect(validateProfile(draft({ interests: ['catering'] }))).toEqual([
      'budgetMissing',
    ]);
    expect(validateProfile(draft({ strengths: 'Ich fahre gern Auto.' }))).toEqual([
      'budgetMissing',
    ]);
  });

  it('lässt das vollständige Profil durch', () => {
    expect(
      validateProfile(draft({ interests: ['catering'], timeBudget: 'monthly' })),
    ).toEqual([]);
  });

  it('meldet ein Zeitbudget ohne Inhalt', () => {
    // Ein Budget allein ergibt kein Matching – die Grundlage fehlt.
    expect(validateProfile(draft({ timeBudget: 'monthly' }))).toEqual(['nothingChosen']);
  });

  it('begrenzt den Satz wie der Constraint', () => {
    const long = draft({
      strengths: 'x'.repeat(MAX_STRENGTHS + 1),
      timeBudget: 'once',
    });
    expect(validateProfile(long)).toContain('strengthsTooLong');
  });
});

describe('budgetCap', () => {
  it('gibt der Saison mehr Raum als dem Monat', () => {
    expect(budgetCap('once')).toBe(1);
    expect(budgetCap('monthly')).toBe(1);
    expect(budgetCap('seasonal')).toBe(3);
  });
});

describe('isBudgetSpent', () => {
  it('erkennt das ausgeschöpfte Budget (A4)', () => {
    expect(isBudgetSpent(0)).toBe(true);
    expect(isBudgetSpent(-1)).toBe(true);
    expect(isBudgetSpent(1)).toBe(false);
  });

  it('hält «kein Budget» von «kein Rest» auseinander (BR-143)', () => {
    // Der ganze Unterschied zwischen «du hast nichts angegeben» und «du hast
    // genug getan». Ohne diese Unterscheidung bekäme jedes Mitglied ohne
    // Profil die Meldung, es habe genug getan.
    expect(isBudgetSpent(null)).toBe(false);
    expect(isBudgetSpent(undefined)).toBe(false);
  });
});

describe('readInterests', () => {
  it('liest die geprüften Kategorien', () => {
    expect(readInterests(['catering', 'finance'])).toEqual(['catering', 'finance']);
  });

  it('wirft unbekannte Werte weg', () => {
    // Sonst stünde ein Schlüssel `taskCategory.kochen` in der Ansicht.
    expect(readInterests(['catering', 'kochen', 42, null])).toEqual(['catering']);
  });

  it('kommt mit allem zurecht, was aus jsonb kommen kann', () => {
    expect(readInterests(null)).toEqual([]);
    expect(readInterests({})).toEqual([]);
    expect(readInterests('catering')).toEqual([]);
  });
});

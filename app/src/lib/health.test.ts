import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LIVE_SIGNAL_TYPES,
  canTakeOver,
  isClubSignal,
  severityColor,
  signalKey,
  sortSignals,
  type HealthSignal,
} from './health';

function signal(overrides: Partial<HealthSignal> = {}): HealthSignal {
  return {
    id: 's-1',
    memberId: 'm-1',
    memberName: 'Anna',
    teamId: 't-1',
    signalType: 'no_response',
    severity: 'attention',
    detail: '3/3',
    status: 'open',
    ownedBy: null,
    ownerName: null,
    detectedAt: '2026-09-01T10:00:00Z',
    ...overrides,
  };
}

describe('severityColor', () => {
  it('bildet die Ampel auf Ionic-Farben ab', () => {
    expect(severityColor('urgent')).toBe('danger');
    expect(severityColor('attention')).toBe('warning');
    expect(severityColor('info')).toBe('success');
  });
});

describe('sortSignals', () => {
  it('stellt Dringendes nach vorn, dann das Ältere', () => {
    const rows = [
      signal({ id: 'a', severity: 'info', detectedAt: '2026-09-01T00:00:00Z' }),
      signal({ id: 'b', severity: 'urgent', detectedAt: '2026-09-05T00:00:00Z' }),
      signal({ id: 'c', severity: 'attention', detectedAt: '2026-08-01T00:00:00Z' }),
      signal({ id: 'd', severity: 'attention', detectedAt: '2026-09-02T00:00:00Z' }),
    ];

    expect(sortSignals(rows).map((row) => row.id)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('lässt die übergebene Liste unverändert', () => {
    const rows = [signal({ id: 'a', severity: 'info' }), signal({ id: 'b', severity: 'urgent' })];
    sortSignals(rows);
    expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
  });
});

describe('isClubSignal', () => {
  it('erkennt das Vereinssignal an der fehlenden Person (A3)', () => {
    expect(isClubSignal(signal({ memberId: null }))).toBe(true);
    expect(isClubSignal(signal())).toBe(false);
  });
});

describe('canTakeOver', () => {
  it('lässt einen offenen Hinweis übernehmen', () => {
    expect(canTakeOver(signal({ status: 'open' }), 'me')).toBe(true);
  });

  it('sperrt die Übernahme, wenn sich jemand anderes kümmert (A1)', () => {
    expect(
      canTakeOver(signal({ status: 'in_contact', ownedBy: 'someone' }), 'me'),
    ).toBe(false);
  });

  it('lässt die eigene Übernahme bestehen', () => {
    expect(canTakeOver(signal({ status: 'in_contact', ownedBy: 'me' }), 'me')).toBe(
      true,
    );
  });
});

describe('signalKey', () => {
  it('führt zu den Texten der lebenden Signaltypen', () => {
    expect(signalKey('no_response', 'title')).toBe('health.signal.no_response.title');
  });

  it('fällt bei einem Typ ohne Texte auf eine neutrale Beschreibung zurück', () => {
    // Vier Typen stehen im Constraint, haben aber noch keine Datenquelle.
    // Erzeugt ein späteres Modul einen davon, steht auf dem Bildschirm ein
    // Satz und nicht ein roher Schlüssel.
    expect(signalKey('succession_gap', 'title')).toBe('health.signal.unknown.title');
  });
});

/**
 * BR-095: «Hinweise formulieren einen Anlass für Kontakt, nie einen Vorwurf.
 * Begriffe wie *inaktiv* oder *säumig* kommen nicht vor.»
 *
 * Das ist eine Sprachregel, und Sprachregeln zerfallen beim Übersetzen. Der
 * Test liest deshalb alle vier Sprachdateien.
 */
describe('BR-095: kein Wort urteilt', () => {
  const FORBIDDEN = [
    'inaktiv', 'inactif', 'inattiv', 'inactive',
    'säumig', 'saeumig', 'négligent', 'moroso', 'delinquent',
    'faul', 'paresseux', 'pigro', 'lazy',
    'versäum', 'schuld', 'coupable', 'colpa', 'blame',
  ];

  for (const lang of ['de', 'fr', 'it', 'en']) {
    it(`hält die Texte in ${lang} frei von Urteilen`, () => {
      const file = readFileSync(
        `${process.cwd()}/src/i18n/locales/${lang}.json`,
        'utf8',
      );
      const health = JSON.stringify(JSON.parse(file).health).toLowerCase();

      for (const word of FORBIDDEN) {
        expect(health, `«${word}» steht in ${lang}.json`).not.toContain(word);
      }
    });
  }

  it('beschreibt jeden lebenden Signaltyp in allen vier Sprachen', () => {
    for (const lang of ['de', 'fr', 'it', 'en']) {
      const data = JSON.parse(
        readFileSync(`${process.cwd()}/src/i18n/locales/${lang}.json`, 'utf8'),
      );
      for (const type of LIVE_SIGNAL_TYPES) {
        expect(data.health.signal[type]?.title, `${type} in ${lang}`).toBeTruthy();
        expect(data.health.signal[type]?.body, `${type} in ${lang}`).toBeTruthy();
      }
    }
  });

  it('gibt jedem personenbezogenen Signal zwei bis drei Gesprächsimpulse (FR-065)', () => {
    const data = JSON.parse(
      readFileSync(`${process.cwd()}/src/i18n/locales/de.json`, 'utf8'),
    );
    for (const type of LIVE_SIGNAL_TYPES) {
      const prompts = [1, 2, 3].filter((n) => data.health.signal[type][`prompt${n}`]);
      expect(prompts.length, type).toBeGreaterThanOrEqual(2);
      expect(prompts.length, type).toBeLessThanOrEqual(3);
    }
  });
});

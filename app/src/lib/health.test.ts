import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COLLECTED_DATA,
  LIVE_SIGNAL_TYPES,
  NOT_COLLECTED,
  attendanceRate,
  canTakeOver,
  isClubSignal,
  isConcentrated,
  percent,
  responseRate,
  seasonTrend,
  severityColor,
  signalAudienceKey,
  signalKey,
  sortSignals,
  sortSuccession,
  type HealthSignal,
  type Responsibility,
  type TeamHealth,
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

  it('führt auch zum Signal aus den Ämtern (seit `0056`)', () => {
    expect(signalKey('succession_gap', 'title')).toBe(
      'health.signal.succession_gap.title',
    );
  });

  it('fällt bei einem Typ ohne Texte auf eine neutrale Beschreibung zurück', () => {
    // Drei Typen stehen im Constraint, haben aber noch keine Datenquelle.
    // Erzeugt ein späteres Modul einen davon, steht auf dem Bildschirm ein
    // Satz und nicht ein roher Schlüssel.
    expect(signalKey('invoice_overdue', 'title')).toBe('health.signal.unknown.title');
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

describe('signalAudienceKey', () => {
  it('nennt bei einem persönlichen Hinweis Trainer:innen und Vorstand (Schritt 4)', () => {
    expect(signalAudienceKey({ signalType: 'no_response' })).toBe(
      'transparency.audience.trainers',
    );
  });

  it('nennt bei einem Vereinssignal nur den Vorstand (A3, BR-096)', () => {
    expect(signalAudienceKey({ signalType: 'comms_pause' })).toBe(
      'transparency.audience.board',
    );
    expect(signalAudienceKey({ signalType: 'connection_ratio' })).toBe(
      'transparency.audience.board',
    );
  });
});

/**
 * BR-108: «Die Seite sagt ausdrücklich, dass keine App-Nutzung, keine
 * Lesebestätigungen und keine Standortdaten erhoben werden.»
 *
 * Eine Zusage, die man streichen kann, ohne dass etwas bricht, ist keine
 * Zusage. Der Test hält sie in allen vier Sprachen fest.
 */
describe('BR-108: die Nicht-Erhebung steht ausdrücklich da', () => {
  const REQUIRED = ['usage', 'readReceipts', 'location'] as const;

  it('nennt mindestens die drei ausdrücklich verlangten Punkte', () => {
    for (const kind of REQUIRED) {
      expect(NOT_COLLECTED).toContain(kind);
    }
  });

  for (const lang of ['de', 'fr', 'it', 'en']) {
    it(`beschreibt jeden davon in ${lang}`, () => {
      const data = JSON.parse(
        readFileSync(`${process.cwd()}/src/i18n/locales/${lang}.json`, 'utf8'),
      );
      for (const kind of NOT_COLLECTED) {
        expect(data.transparency.notData[kind], `${kind} in ${lang}`).toBeTruthy();
      }
      for (const kind of COLLECTED_DATA) {
        expect(data.transparency.data[kind]?.title, `${kind} in ${lang}`).toBeTruthy();
        expect(data.transparency.data[kind]?.body, `${kind} in ${lang}`).toBeTruthy();
      }
    });
  }

  it('erklärt jeden lebenden Signaltyp samt Schwelle (A3, FR-075)', () => {
    const data = JSON.parse(
      readFileSync(`${process.cwd()}/src/i18n/locales/de.json`, 'utf8'),
    );
    for (const type of LIVE_SIGNAL_TYPES) {
      expect(data.health.signal[type]?.definition, type).toBeTruthy();
    }
  });
});

describe('Kennzahlen (UC-023)', () => {
  function team(overrides: Partial<TeamHealth> = {}): TeamHealth {
    return {
      teamId: 't-1',
      teamName: 'Erste',
      members: 8,
      invitations: 40,
      answered: 30,
      attended: 20,
      ...overrides,
    };
  }

  function load(overrides: Partial<Responsibility> = {}): Responsibility {
    return { contributors: 6, carriers: 2, members: 20, efforts: 40, ...overrides };
  }

  it('rechnet Anteile auf ganze Prozent', () => {
    expect(responseRate(team())).toBe(75);
    expect(attendanceRate(team())).toBe(50);
  });

  it('gibt ohne Grundgesamtheit keinen Anteil zurück, sondern `null`', () => {
    // Ein Team ohne Einladungen hat keine Antwortquote von 0 % – es hat
    // keine. Der Unterschied entscheidet, ob auf dem Bildschirm «0 %» oder
    // gar nichts steht (BR-095).
    expect(responseRate(team({ invitations: 0, answered: 0 }))).toBeNull();
    expect(percent(3, 0)).toBeNull();
  });

  it('vergleicht den Trend in Anzahlen und schweigt ohne Vorsaison', () => {
    expect(seasonTrend({ activated: 30, prevActivated: 24 })).toBe(6);
    expect(seasonTrend({ activated: 18, prevActivated: 24 })).toBe(-6);
    // Ein Verein im ersten Jahr bekommt keinen Pfeil: «plus 30» wäre eine
    // Erfolgsmeldung über eine Zahl, mit der es nichts zu vergleichen gibt.
    expect(seasonTrend({ activated: 30, prevActivated: 0 })).toBeNull();
  });

  it('nennt eine Konzentration erst unter einem Fünftel der Mitglieder', () => {
    // Zwei von zwanzig tragen vier Fünftel: ein Anlass.
    expect(isConcentrated(load())).toBe(true);
    // Fünf von zwanzig sind ein Viertel: normal für einen Verein.
    expect(isConcentrated(load({ carriers: 5 }))).toBe(false);
  });

  it('nennt ohne Einsätze keine Konzentration', () => {
    // Am Saisonanfang hat noch niemand etwas geleistet. «Null tragen alles»
    // wäre die erste Zahl, die ein Vorstand sieht – und sie wäre falsch.
    expect(isConcentrated(load({ efforts: 0, carriers: 0, contributors: 0 }))).toBe(
      false,
    );
  });

  it('stellt vakante Ämter vor die lange gehaltenen', () => {
    const sorted = sortSuccession([
      { roleId: 'a', title: 'Präsidium', isVacant: false, years: 6 },
      { roleId: 'b', title: 'Material', isVacant: true, years: null },
      { roleId: 'c', title: 'Kasse', isVacant: false, years: 4 },
    ]);
    expect(sorted.map((entry) => entry.title)).toEqual([
      'Material',
      'Präsidium',
      'Kasse',
    ]);
  });

  it('hält `succession_gap` beim Vorstand (A3)', () => {
    // Ein Amt ohne Nachfolge betrifft den Verein, nicht ein Team – und geht
    // deshalb an den Vorstand, wie die Kommunikationspause.
    expect(signalAudienceKey({ signalType: 'succession_gap' })).toBe(
      'transparency.audience.board',
    );
    expect(signalAudienceKey({ signalType: 'silent_churn' })).toBe(
      'transparency.audience.trainers',
    );
  });
});

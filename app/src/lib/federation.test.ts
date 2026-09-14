import { describe, expect, it } from 'vitest';
import {
  FEDERATIONS,
  federationOf,
  isFederationEvent,
  isStale,
  requiresKey,
  statusTone,
  validateConnection,
  type Federation,
  readGamesSync,
} from './federation';

function draft(overrides: Partial<{ federation: Federation; federationClubId: string; apiKey: string }> = {}) {
  return {
    federation: 'swissunihockey' as Federation,
    federationClubId: '4231',
    apiKey: '',
    ...overrides,
  };
}

describe('validateConnection (UC-035)', () => {
  it('nimmt eine Verbindung mit Vereinskennung an', () => {
    expect(validateConnection(draft())).toEqual([]);
  });

  it('verlangt die Vereinskennung – ohne sie gibt es nichts abzugleichen', () => {
    expect(validateConnection(draft({ federationClubId: '' }))).toContain('clubIdMissing');
    expect(validateConnection(draft({ federationClubId: '   ' }))).toContain(
      'clubIdMissing',
    );
  });

  it('verlangt keinen Schlüssel, wo der Verband keinen kennt (A2)', () => {
    // Alle vier Schnittstellen sind heute offen. Ein Pflichtfeld ohne Inhalt
    // wäre eine Frage, auf die es keine Antwort gibt.
    for (const federation of FEDERATIONS) {
      expect(requiresKey(federation), federation).toBe(false);
      expect(validateConnection(draft({ federation }))).toEqual([]);
    }
  });
});

describe('statusTone', () => {
  it('färbt eine ungeprüfte Verbindung neutral, nicht warnend', () => {
    // Wer eine gelbe Ampel sieht, sucht einen Fehler. «Noch nicht geprüft»
    // ist keiner, sondern ein Anfang.
    expect(statusTone('pending')).toBe('medium');
    expect(statusTone('active')).toBe('success');
    expect(statusTone('error')).toBe('danger');
  });
});

describe('isStale (A3, BR-155)', () => {
  const now = new Date('2026-09-11T12:00:00.000Z');

  it('nennt eine aktive Verbindung mit frischem Abgleich nicht veraltet', () => {
    expect(
      isStale({ status: 'active', lastSyncAt: '2026-09-11T04:00:00.000Z' }, now),
    ).toBe(false);
  });

  it('nennt eine aktive Verbindung nach drei Tagen ohne Abgleich veraltet', () => {
    expect(
      isStale({ status: 'active', lastSyncAt: '2026-09-06T04:00:00.000Z' }, now),
    ).toBe(true);
  });

  it('nennt eine Verbindung im Fehlerzustand veraltet', () => {
    expect(isStale({ status: 'error', lastSyncAt: null }, now)).toBe(true);
  });

  it('nennt eine frisch angelegte Verbindung **nicht** veraltet', () => {
    // Sie wurde noch nie abgeglichen – das ist kein Ausfall, sondern der
    // Zustand zwischen Verbinden und dem ersten nächtlichen Lauf.
    expect(isStale({ status: 'pending', lastSyncAt: null }, now)).toBe(false);
    expect(isStale({ status: 'active', lastSyncAt: null }, now)).toBe(false);
  });
});

describe('readGamesSync (UC-039, Schritt 9 und A7)', () => {
  it('nennt die Zahl der Spiele, wenn der Abgleich gelang', () => {
    expect(readGamesSync({ ok: true, teams: 7, games: 18, stale: 0 })).toEqual({
      games: 18,
      error: null,
    });
  });

  it('zählt null Spiele als gelungen – ein leerer Spielplan ist kein Fehler', () => {
    expect(readGamesSync({ ok: true })).toEqual({ games: 0, error: null });
  });

  it('gibt die Meldung des Verbands weiter, wenn er nicht antwortet (A7)', () => {
    expect(readGamesSync({ ok: false, error: ' Der Verband antwortet nicht ' })).toEqual({
      games: null,
      error: 'Der Verband antwortet nicht',
    });
  });

  it('hat auch ohne Antwort und ohne Text eine Begründung', () => {
    expect(readGamesSync(null)).toEqual({ games: null, error: 'Keine Antwort' });
    expect(readGamesSync({ ok: false, error: '' })).toEqual({ games: null, error: 'Keine Antwort' });
  });
});

describe('isFederationEvent (UC-039, UC-040)', () => {
  it('erkennt ein Verbandsspiel an seiner Kennung', () => {
    expect(isFederationEvent({ external_id: 'swissunihockey:12345' })).toBe(true);
  });

  it('zählt einen aus der alten App übernommenen Termin nicht zum Verband', () => {
    expect(isFederationEvent({ external_id: 'legacy:training:tr1' })).toBe(false);
    expect(isFederationEvent({ external_id: 'legacy:helper:h1' })).toBe(false);
  });

  it('zählt einen hier angelegten Termin nicht zum Verband', () => {
    expect(isFederationEvent({ external_id: null })).toBe(false);
    expect(isFederationEvent({})).toBe(false);
  });
});

describe('federationOf (UC-039)', () => {
  it('liest den Verband aus dem Präfix der Kennung – das Detail nennt ihn beim Namen', () => {
    expect(federationOf({ external_id: 'swissunihockey:12345' })).toBe('swissunihockey');
    expect(federationOf({ external_id: 'swissvolley:9' })).toBe('swissvolley');
  });

  it('kennt weder die bisherige App noch Termine ohne Kennung als Verband', () => {
    expect(federationOf({ external_id: 'legacy:training:tr1' })).toBeNull();
    expect(federationOf({ external_id: null })).toBeNull();
    expect(federationOf({})).toBeNull();
    expect(federationOf({ external_id: 'swissunihockey' })).toBeNull();
    expect(federationOf({ external_id: 'unknown:1' })).toBeNull();
  });
});

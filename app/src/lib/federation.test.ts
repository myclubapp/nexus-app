import { describe, expect, it } from 'vitest';
import {
  FEDERATIONS,
  isStale,
  requiresKey,
  statusTone,
  validateConnection,
  type Federation,
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

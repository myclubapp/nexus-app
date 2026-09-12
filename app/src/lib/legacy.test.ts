import { describe, expect, it } from 'vitest';
import {
  isStale,
  normalizeFirebaseClubId,
  readLegacySync,
  statusTone,
  validateFirebaseClubId,
} from './legacy';

describe('normalizeFirebaseClubId (UC-040, Schritt 3)', () => {
  it('nimmt die Kennung, wie sie in der Adresse der alten App steht', () => {
    expect(normalizeFirebaseClubId('  su-452800 ')).toBe('su-452800');
    expect(normalizeFirebaseClubId('https://app.my-club.app/club/su-452800')).toBe('su-452800');
    expect(normalizeFirebaseClubId('https://app.my-club.app/club/su-452800/helfer')).toBe('su-452800');
    expect(normalizeFirebaseClubId('/su-452800/')).toBe('su-452800');
  });
});

describe('validateFirebaseClubId', () => {
  it('meldet eine fehlende oder unbrauchbare Kennung', () => {
    expect(validateFirebaseClubId('')).toEqual(['clubIdMissing']);
    expect(validateFirebaseClubId('   ')).toEqual(['clubIdMissing']);
    expect(validateFirebaseClubId('su 452800')).toEqual(['clubIdInvalid']);
    expect(validateFirebaseClubId('a')).toEqual(['clubIdInvalid']);
  });

  it('nimmt eine gültige Kennung an – auch als Adresse', () => {
    expect(validateFirebaseClubId('su-452800')).toEqual([]);
    expect(validateFirebaseClubId('https://x.ch/club/su-452800')).toEqual([]);
  });
});

describe('statusTone und isStale (A2)', () => {
  it('färbt wie beim Verband', () => {
    expect(statusTone('active')).toBe('success');
    expect(statusTone('error')).toBe('danger');
    expect(statusTone('pending')).toBe('medium');
  });

  it('gilt nach drei Tagen ohne Lauf als stehengeblieben', () => {
    const now = new Date('2026-09-12T10:00:00Z');
    expect(isStale({ status: 'active', lastSyncAt: '2026-09-11T04:50:00Z' }, now)).toBe(false);
    expect(isStale({ status: 'active', lastSyncAt: '2026-09-08T04:50:00Z' }, now)).toBe(true);
    expect(isStale({ status: 'active', lastSyncAt: null }, now)).toBe(false);
    expect(isStale({ status: 'pending', lastSyncAt: null }, now)).toBe(false);
    expect(isStale({ status: 'error', lastSyncAt: null }, now)).toBe(true);
  });
});

describe('readLegacySync (Schritt 6, A3)', () => {
  it('zählt Anlässe und Helfer-Events zusammen', () => {
    expect(readLegacySync({ ok: true, events: 2, helpers: 17, shifts: 60 })).toEqual({ count: 19, error: null });
    expect(readLegacySync({ ok: true })).toEqual({ count: 0, error: null });
  });

  it('gibt die Meldung des Dienstes weiter, sonst den Ersatz', () => {
    expect(readLegacySync({ ok: false, error: ' kaputt ' })).toEqual({ count: null, error: 'kaputt' });
    expect(readLegacySync(null)).toEqual({ count: null, error: 'Keine Antwort' });
    expect(readLegacySync({ ok: false, error: '' }, 'Ersatz')).toEqual({ count: null, error: 'Ersatz' });
  });
});

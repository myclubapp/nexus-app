import { describe, expect, it } from 'vitest';
import { defaultInviteExpiry, isInviteActive } from './useInvites';
import type { Invite } from '../lib/database.types';

function invite(overrides: Partial<Invite> = {}): Invite {
  return {
    id: 'i1',
    club_id: 'c1',
    team_id: null,
    code: 'abc',
    role: 'member',
    expires_at: '2026-12-31T23:59:59.000Z',
    max_uses: 50,
    uses: 0,
    revoked_at: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const now = new Date('2026-06-01T12:00:00Z');

describe('isInviteActive', () => {
  it('erkennt eine gültige Einladung', () => {
    expect(isInviteActive(invite(), now)).toBe(true);
  });

  it('erkennt eine abgelaufene Einladung (A1)', () => {
    expect(
      isInviteActive(invite({ expires_at: '2026-05-31T23:59:59.000Z' }), now),
    ).toBe(false);
  });

  it('erkennt eine ausgeschöpfte Einladung (A2)', () => {
    expect(isInviteActive(invite({ max_uses: 3, uses: 3 }), now)).toBe(false);
  });

  it('erkennt eine zurückgezogene Einladung (BR-012)', () => {
    expect(
      isInviteActive(invite({ revoked_at: '2026-05-01T00:00:00.000Z' }), now),
    ).toBe(false);
  });

  it('gilt bis zum letzten Moment des Ablaufzeitpunkts', () => {
    // Die Grenze ist inklusiv; sonst wäre eine Einladung eine Sekunde vor
    // ihrem Ablauf bereits ungültig.
    const expiring = invite({ expires_at: now.toISOString() });
    expect(isInviteActive(expiring, now)).toBe(true);
  });
});

describe('defaultInviteExpiry', () => {
  it('schlägt in 14 Tagen vor (UC-003, Schritt 2)', () => {
    expect(defaultInviteExpiry(new Date('2026-06-01T12:00:00'))).toBe('2026-06-15');
  });

  it('rechnet über den Monatswechsel', () => {
    expect(defaultInviteExpiry(new Date('2026-06-25T12:00:00'))).toBe('2026-07-09');
  });

  it('rechnet über den Jahreswechsel', () => {
    expect(defaultInviteExpiry(new Date('2026-12-25T12:00:00'))).toBe('2027-01-08');
  });

  it('liefert ein Datum, das ein Datumsfeld annimmt', () => {
    expect(defaultInviteExpiry(new Date('2026-01-01T12:00:00'))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });
});

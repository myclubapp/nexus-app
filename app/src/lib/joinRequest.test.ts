import { describe, expect, it } from 'vitest';
import {
  DECIDABLE_ROLES,
  normaliseClubSlug,
  resolveJoinDecision,
} from './joinRequest';

/**
 * `find_club_by_slug()` vergleicht exakt. Was eine Person tippt, ist es selten:
 * Grossbuchstaben, ein Leerzeichen, der ganze Link aus der Nachricht. Ohne
 * diese Aufbereitung findet die Suche den Verein nur bei perfekter Eingabe.
 */
describe('normaliseClubSlug', () => {
  it('lässt einen sauberen Kurznamen unverändert', () => {
    expect(normaliseClubSlug('tv-musterhausen')).toBe('tv-musterhausen');
  });

  it('schreibt klein und schneidet Rand-Leerzeichen weg', () => {
    expect(normaliseClubSlug('  TV-Musterhausen  ')).toBe('tv-musterhausen');
  });

  it('macht aus Leerzeichen Bindestriche', () => {
    expect(normaliseClubSlug('TV Musterhausen')).toBe('tv-musterhausen');
  });

  it('nimmt das letzte Segment einer eingefügten Adresse', () => {
    expect(normaliseClubSlug('https://app.myclub.ch/tv-musterhausen')).toBe(
      'tv-musterhausen',
    );
    expect(normaliseClubSlug('https://app.myclub.ch/clubs/tv-musterhausen/')).toBe(
      'tv-musterhausen',
    );
  });

  it('entfernt Zeichen, die in keinem Kurznamen vorkommen', () => {
    // `slugify()` in SQL erzeugt nur a–z, 0–9 und Bindestriche.
    expect(normaliseClubSlug('TV Müsterhausen!')).toBe('tv-msterhausen');
  });

  it('liefert für eine unbrauchbare Eingabe eine leere Zeichenkette', () => {
    expect(normaliseClubSlug('')).toBe('');
    expect(normaliseClubSlug('   ')).toBe('');
    expect(normaliseClubSlug('???')).toBe('');
  });
});

describe('resolveJoinDecision', () => {
  it('nimmt mit der gewählten Rolle und dem gewählten Team auf', () => {
    expect(
      resolveJoinDecision({ approve: true, role: 'trainer', teamId: 'team-1' }),
    ).toEqual({ approve: true, role: 'trainer', teamId: 'team-1' });
  });

  it('nimmt ohne Team auf, wenn keines gewählt ist', () => {
    expect(resolveJoinDecision({ approve: true, role: 'member', teamId: null })).toEqual(
      { approve: true, role: 'member', teamId: null },
    );
  });

  it('gibt bei einer Ablehnung weder Rolle noch Team mit (BR-016)', () => {
    // Sonst stünde im Aufruf eine Rolle, die niemand bekommt.
    expect(
      resolveJoinDecision({ approve: false, role: 'admin', teamId: 'team-1' }),
    ).toEqual({ approve: false, role: null, teamId: null });
  });

  it('fällt bei einer unbekannten Rolle auf member zurück (BR-015)', () => {
    expect(
      resolveJoinDecision({
        approve: true,
        role: 'superadmin' as unknown as (typeof DECIDABLE_ROLES)[number],
        teamId: null,
      }),
    ).toMatchObject({ role: 'member' });
  });

  it('bietet superadmin gar nicht erst an (BR-011)', () => {
    expect(DECIDABLE_ROLES).toEqual(['member', 'trainer', 'admin']);
    expect(DECIDABLE_ROLES).not.toContain('superadmin');
  });
});

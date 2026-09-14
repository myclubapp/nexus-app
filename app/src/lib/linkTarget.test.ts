import { describe, expect, it } from 'vitest';
import { linkTarget } from './linkTarget';

/**
 * FR-078: Die Inbox führt zu dem, was die Nachricht meint. Ob das ein Blatt
 * über der Liste ist oder ein Tab-Wechsel, entscheidet sich hier.
 */
describe('linkTarget', () => {
  it('erkennt den Termin hinter einer Erinnerung (BR-062)', () => {
    expect(linkTarget('/tabs/agenda?event=e1')).toEqual({ kind: 'event', id: 'e1' });
  });

  it('erkennt die Aufgabe hinter einem Vorschlag (BR-070)', () => {
    expect(linkTarget('/tabs/marketplace?task=t1')).toEqual({ kind: 'task', id: 't1' });
  });

  it('hält die Liste selbst für eine Seite, nicht für einen Gegenstand', () => {
    expect(linkTarget('/tabs/agenda')).toEqual({ kind: 'page', href: '/tabs/agenda' });
    expect(linkTarget('/tabs/marketplace')).toEqual({
      kind: 'page',
      href: '/tabs/marketplace',
    });
  });

  it('führt jeden anderen Verweis als Seite weiter', () => {
    expect(linkTarget('/tabs/profile/meeting')).toEqual({
      kind: 'page',
      href: '/tabs/profile/meeting',
    });
    expect(linkTarget('/tabs/pulse/p1')).toEqual({ kind: 'page', href: '/tabs/pulse/p1' });
  });

  it('gibt ohne Verweis nichts zu öffnen', () => {
    expect(linkTarget(null)).toBeNull();
    expect(linkTarget('')).toBeNull();
    expect(linkTarget(undefined)).toBeNull();
  });

  it('übergeht eine leere Kennung – sonst öffnete sich ein Blatt ohne Inhalt', () => {
    expect(linkTarget('/tabs/agenda?event=')).toEqual({
      kind: 'page',
      href: '/tabs/agenda?event=',
    });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import {
  inviteCodeFromUrl,
  inviteLink,
  peekPendingInvite,
  setPendingInvite,
  takePendingInvite,
} from './invite';

describe('inviteCodeFromUrl', () => {
  it('liest den Code aus einer Web-Adresse', () => {
    expect(inviteCodeFromUrl('https://app.myclub.ch/invite/abc123')).toBe('abc123');
  });

  it('liest den Code aus dem Deep Link', () => {
    // Beim Schema-Link landet «invite» im Host statt im Pfad – genau der Fall,
    // an dem eine reine Pfadprüfung scheitert.
    expect(inviteCodeFromUrl('ch.myclub.nexus://invite/abc123')).toBe('abc123');
  });

  it('ignoriert angehängte Parameter und Fragmente', () => {
    expect(inviteCodeFromUrl('https://app.myclub.ch/invite/abc123?ref=mail')).toBe(
      'abc123',
    );
    expect(inviteCodeFromUrl('https://app.myclub.ch/invite/abc123#top')).toBe('abc123');
  });

  it('vereinheitlicht die Schreibweise', () => {
    // Die Datenbank vergleicht den Code klein geschrieben.
    expect(inviteCodeFromUrl('https://app.myclub.ch/invite/ABC123')).toBe('abc123');
  });

  it('gibt null zurück, wenn die Adresse keine Einladung ist', () => {
    expect(inviteCodeFromUrl('https://app.myclub.ch/auth/callback?code=x')).toBeNull();
    expect(inviteCodeFromUrl('ch.myclub.nexus://auth/callback?code=x')).toBeNull();
    expect(inviteCodeFromUrl('kein-link')).toBeNull();
    expect(inviteCodeFromUrl('https://app.myclub.ch/invite/')).toBeNull();
  });
});

describe('inviteLink', () => {
  it('erzeugt eine Web-Adresse', () => {
    // Auch auf dem Gerät bewusst kein Schema-Link: Empfänger:innen ohne App
    // landen sonst im Nichts (UC-002 A3).
    const link = inviteLink('abc123');
    expect(link).toMatch(/^https?:\/\//);
    expect(link).toContain('/invite/abc123');
  });

  it('lässt sich wieder auslesen', () => {
    expect(inviteCodeFromUrl(inviteLink('abc123'))).toBe('abc123');
  });
});

describe('gemerkte Einladung', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('überlebt den Umweg über die Anmeldung', () => {
    setPendingInvite('abc123');
    expect(peekPendingInvite()).toBe('abc123');
  });

  it('gilt genau einmal', () => {
    setPendingInvite('abc123');
    expect(takePendingInvite()).toBe('abc123');
    expect(peekPendingInvite()).toBeNull();
  });

  it('meldet ohne gemerkte Einladung null', () => {
    expect(peekPendingInvite()).toBeNull();
    expect(takePendingInvite()).toBeNull();
  });
});

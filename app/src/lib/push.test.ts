import { describe, expect, it } from 'vitest';
import { pushReadiness, subscriptionToken, vapidKeyToBytes } from './push';

function input(overrides: Partial<Parameters<typeof pushReadiness>[0]> = {}) {
  return {
    hasServiceWorker: true,
    hasPushManager: true,
    permission: 'default' as NotificationPermission | null,
    vapidKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
    ...overrides,
  };
}

describe('pushReadiness (UC-028, A1/A2)', () => {
  it('nennt ein taugliches Gerät bereit', () => {
    expect(pushReadiness(input())).toBe('ready');
  });

  it('nennt ein Gerät ohne Push-Schnittstelle nicht bereit', () => {
    // iOS-Safari ausserhalb der PWA etwa. Kein Fehler – eine Auskunft.
    expect(pushReadiness(input({ hasPushManager: false }))).toBe('unsupported');
    expect(pushReadiness(input({ hasServiceWorker: false }))).toBe('unsupported');
  });

  it('sagt, wenn kein VAPID-Schlüssel hinterlegt ist', () => {
    // Ohne Schlüssel gibt es nichts zu abonnieren. Das ist eine Frage der
    // Installation, nicht des Geräts – und die Ansicht sagt beides anders.
    expect(pushReadiness(input({ vapidKey: '' }))).toBe('notConfigured');
    expect(pushReadiness(input({ vapidKey: '   ' }))).toBe('notConfigured');
  });

  it('nennt eine verweigerte Erlaubnis beim Namen (A2)', () => {
    expect(pushReadiness(input({ permission: 'denied' }))).toBe('denied');
  });

  it('prüft die Schnittstelle vor dem Schlüssel', () => {
    // Ein Gerät ohne Push-Schnittstelle bleibt auch mit Schlüssel eines –
    // «noch nicht eingerichtet» wäre dort die falsche Auskunft.
    expect(pushReadiness(input({ hasPushManager: false, vapidKey: '' }))).toBe(
      'unsupported',
    );
  });
});

describe('vapidKeyToBytes', () => {
  it('macht aus base64url eine Bytefolge', () => {
    const bytes = vapidKeyToBytes('BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U');
    // Ein unkomprimierter P-256-Punkt: 65 Bytes, beginnend mit 0x04.
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });

  it('verträgt fehlende Füllzeichen', () => {
    expect(() => vapidKeyToBytes('BEl62iUYgUivxIkv')).not.toThrow();
  });
});

describe('subscriptionToken', () => {
  it('nimmt Endpunkt und Schlüssel auf – der Versand braucht beides', () => {
    const token = subscriptionToken({
      endpoint: 'https://push.example/abc',
      expirationTime: null,
      keys: { p256dh: 'p', auth: 'a' },
    });
    expect(JSON.parse(token)).toEqual({
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'p', auth: 'a' },
    });
  });
});

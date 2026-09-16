import { describe, expect, it } from 'vitest';
import {
  pushChannel,
  pushReadiness,
  subscriptionToken,
  vapidKeyToBytes,
  type PushChannel,
} from './push';

const VAPID =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

function input(overrides: Partial<Parameters<typeof pushReadiness>[0]> = {}) {
  return {
    channel: 'webpush' as PushChannel,
    permission: 'default' as NotificationPermission | null,
    vapidKey: VAPID,
    ...overrides,
  };
}

describe('pushChannel (UC-052)', () => {
  it('nimmt im Browser den Web-Push-Weg', () => {
    expect(
      pushChannel({
        isNative: false,
        platform: 'web',
        hasServiceWorker: true,
        hasPushManager: true,
      }),
    ).toBe('webpush');
  });

  it('nimmt in der iOS-App den Apple-Weg', () => {
    // Entscheidend ist die Plattform, nicht der WebView: Ein `PushManager` im
    // WKWebView wäre wirkungslos, und umgekehrt braucht APNs keinen.
    expect(
      pushChannel({
        isNative: true,
        platform: 'ios',
        hasServiceWorker: false,
        hasPushManager: false,
      }),
    ).toBe('ios_apns');
  });

  it('kennt für die Android-App keinen Weg', () => {
    // `android_ntfy` steht in der Datenbank, aber es gibt keinen betriebenen
    // ntfy-Dienst – und ein Kanal ohne Dienst ist ein Knopf, der nichts tut.
    expect(
      pushChannel({
        isNative: true,
        platform: 'android',
        hasServiceWorker: true,
        hasPushManager: true,
      }),
    ).toBe('unsupported');
  });

  it('kennt ohne Push-Schnittstelle keinen Weg', () => {
    // iOS-Safari ausserhalb der PWA etwa.
    expect(
      pushChannel({
        isNative: false,
        platform: 'web',
        hasServiceWorker: true,
        hasPushManager: false,
      }),
    ).toBe('unsupported');
    expect(
      pushChannel({
        isNative: false,
        platform: 'web',
        hasServiceWorker: false,
        hasPushManager: true,
      }),
    ).toBe('unsupported');
  });
});

describe('pushReadiness (UC-028, A1/A2)', () => {
  it('nennt ein taugliches Gerät bereit', () => {
    expect(pushReadiness(input())).toBe('ready');
  });

  it('nennt ein Gerät ohne Weg nicht bereit', () => {
    expect(pushReadiness(input({ channel: 'unsupported' }))).toBe('unsupported');
  });

  it('sagt, wenn kein VAPID-Schlüssel hinterlegt ist', () => {
    // Ohne Schlüssel gibt es nichts zu abonnieren. Das ist eine Frage der
    // Installation, nicht des Geräts – und die Ansicht sagt beides anders.
    expect(pushReadiness(input({ vapidKey: '' }))).toBe('notConfigured');
    expect(pushReadiness(input({ vapidKey: '   ' }))).toBe('notConfigured');
  });

  it('verlangt auf dem Apple-Weg keinen VAPID-Schlüssel', () => {
    // Der Schlüssel gehört dem Browser-Weg. Auf iOS hängt nichts an einer
    // Variablen der App – dort wäre «noch nicht eingerichtet» falsch.
    expect(pushReadiness(input({ channel: 'ios_apns', vapidKey: '' }))).toBe('ready');
  });

  it('nennt eine verweigerte Erlaubnis beim Namen (A2)', () => {
    expect(pushReadiness(input({ permission: 'denied' }))).toBe('denied');
  });

  it('prüft den Weg vor dem Schlüssel', () => {
    // Ein Gerät ohne Weg bleibt auch mit Schlüssel eines – «noch nicht
    // eingerichtet» wäre dort die falsche Auskunft.
    expect(pushReadiness(input({ channel: 'unsupported', vapidKey: '' }))).toBe(
      'unsupported',
    );
  });
});

describe('vapidKeyToBytes', () => {
  it('macht aus base64url eine Bytefolge', () => {
    const bytes = vapidKeyToBytes(VAPID);
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

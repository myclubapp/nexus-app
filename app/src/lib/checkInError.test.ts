import { describe, expect, it } from 'vitest';
import { checkInErrorKey, isKnownOffline, isRetryable } from './checkInError';

describe('checkInErrorKey', () => {
  it('erkennt das geschlossene Zeitfenster (A1)', () => {
    expect(
      checkInErrorKey('Der Code ist ausserhalb des Zeitfensters nicht gültig'),
    ).toBe('window');
  });

  it('erkennt den falschen Code (A2)', () => {
    expect(checkInErrorKey('Dieser Code gehört nicht zu diesem Termin')).toBe(
      'wrongCode',
    );
  });

  it('erkennt die fehlende Mitgliedschaft (A3)', () => {
    expect(checkInErrorKey('Kein Mitglied dieses Vereins')).toBe('notMember');
  });

  it('erkennt den abgesagten Termin', () => {
    expect(checkInErrorKey('Dieser Termin wurde abgesagt')).toBe('cancelled');
  });

  it('erkennt den fehlenden Termin', () => {
    expect(checkInErrorKey('Termin nicht gefunden')).toBe('notFound');
  });

  it('erkennt den Netzfehler in jeder Laufzeitumgebung (A5)', () => {
    // WebKit und damit die iOS-App meldet nicht «Failed to fetch», sondern
    // «Load failed». Nur den Chromium-Wortlaut zu kennen hiesse, den Puffer
    // ausgerechnet auf der Hauptplattform abzuschalten.
    expect(checkInErrorKey('TypeError: Failed to fetch')).toBe('offline');
    expect(checkInErrorKey('TypeError: Load failed')).toBe('offline');
    expect(checkInErrorKey('NetworkError when attempting to fetch resource')).toBe(
      'offline',
    );
    expect(checkInErrorKey('Network request failed')).toBe('offline');
    expect(checkInErrorKey('AbortError: signal is aborted')).toBe('offline');
  });

  it('erkennt die fehlende Berechtigung', () => {
    expect(
      checkInErrorKey('Nur Trainer:innen und der Vorstand erfassen die Anwesenheit'),
    ).toBe('forbidden');
    expect(checkInErrorKey('Nur der Vorstand kann Schichten bestätigen')).toBe(
      'forbidden',
    );
  });

  it('lässt Unbekanntes allgemein', () => {
    expect(checkInErrorKey('irgendwas anderes')).toBe('generic');
    expect(checkInErrorKey(null)).toBe('generic');
    expect(checkInErrorKey(undefined)).toBe('generic');
    expect(checkInErrorKey('')).toBe('generic');
  });
});

describe('isKnownOffline', () => {
  it('glaubt dem Browser nur sein Nein', () => {
    // `navigator.onLine === true` beweist nichts; ein `false` dagegen schon.
    const original = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    expect(isKnownOffline()).toBe(true);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    expect(isKnownOffline()).toBe(false);
    if (original) Object.defineProperty(navigator, 'onLine', original);
  });
});

describe('isRetryable', () => {
  it('sendet nur den Netzfehler nach', () => {
    // Ein geschlossenes Zeitfenster bleibt auch morgen geschlossen; es
    // nachzusenden hiesse, einen Fehler von gestern erneut zu zeigen.
    expect(isRetryable('offline')).toBe(true);
    expect(isRetryable('window')).toBe(false);
    expect(isRetryable('wrongCode')).toBe(false);
    expect(isRetryable('notMember')).toBe(false);
    expect(isRetryable('generic')).toBe(false);
  });
});

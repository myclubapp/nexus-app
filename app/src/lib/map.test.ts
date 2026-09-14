import { afterEach, describe, expect, it, vi } from 'vitest';
import { coordinatesOf, markerColor, navigationUrl, SWISSTOPO_STYLE } from './map';

/**
 * Karte des Spielorts (C-006): die reine Logik neben `VenueMap` – ob ein
 * Termin eine Lage hat, welche Adresse die Navigation des Geräts öffnet und
 * welche Farbe der Marker trägt. Die Karte selbst zeichnet MapLibre; das
 * prüft `VenueMap.test.tsx` gegen einen Stub.
 */
describe('coordinatesOf (0076)', () => {
  it('liefert den Punkt nur, wenn beide Werte Zahlen sind', () => {
    expect(coordinatesOf({ latitude: 47.45, longitude: 8.65 })).toEqual({
      latitude: 47.45,
      longitude: 8.65,
    });
    expect(coordinatesOf({ latitude: 47.45, longitude: null })).toBeNull();
    expect(coordinatesOf({ latitude: null, longitude: 8.65 })).toBeNull();
    expect(coordinatesOf({})).toBeNull();
    expect(coordinatesOf({ latitude: Number.NaN, longitude: 8.65 })).toBeNull();
  });

  it('kennt den Nullpunkt als gültige Lage – 0 ist keine Lücke', () => {
    expect(coordinatesOf({ latitude: 0, longitude: 0 })).toEqual({ latitude: 0, longitude: 0 });
  });
});

describe('navigationUrl', () => {
  const point = { latitude: 47.45216833333333, longitude: 8.647400000000001 };

  it('öffnet auf iOS Apple Karten mit dem Ziel', () => {
    expect(navigationUrl(point, 'Turnhalle', 'ios')).toBe(
      'maps:?daddr=47.45216833333333,8.647400000000001',
    );
  });

  it('öffnet auf Android die geo-Absicht mit dem Ort als Beschriftung – keine Google-Adresse (C-003)', () => {
    const url = navigationUrl(point, 'Turnhalle Hatzenbühl, Nürensdorf', 'android');
    expect(url).toBe(
      'geo:47.45216833333333,8.647400000000001?q=47.45216833333333,8.647400000000001(Turnhalle%20Hatzenb%C3%BChl%2C%20N%C3%BCrensdorf)',
    );
    expect(navigationUrl(point, null, 'android')).toBe(
      'geo:47.45216833333333,8.647400000000001?q=47.45216833333333,8.647400000000001',
    );
    expect(url).not.toContain('google');
  });

  it('öffnet im Browser die Route auf OpenStreetMap', () => {
    expect(navigationUrl(point, 'Turnhalle', 'web')).toBe(
      'https://www.openstreetmap.org/directions?to=47.45216833333333%2C8.647400000000001',
    );
  });

  it('nimmt ohne Angabe die Plattform von Capacitor – im Test der Browser', () => {
    expect(navigationUrl(point, null)).toContain('openstreetmap.org');
  });
});

describe('markerColor', () => {
  afterEach(() => vi.restoreAllMocks());

  it('liest die Vereinsfarbe aus --ion-color-primary', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => ' #ff5500 ',
    } as unknown as CSSStyleDeclaration);
    expect(markerColor()).toBe('#ff5500');
  });

  it('fällt auf die Grundfarbe zurück, wenn die Variable fehlt', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration);
    expect(markerColor()).toBe('#339bde');
  });
});

describe('SWISSTOPO_STYLE', () => {
  it('zeigt auf die freien Vektorkacheln des Bundes, nicht auf Google (C-003, C-006)', () => {
    expect(SWISSTOPO_STYLE).toMatch(/^https:\/\/vectortiles\.geo\.admin\.ch\//);
  });
});

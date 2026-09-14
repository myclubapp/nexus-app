import { Capacitor } from '@capacitor/core';

/**
 * Karte des Spielorts (C-006).
 *
 * MapLibre GL mit den Vektorkacheln von swisstopo – frei, ohne Schlüssel und
 * ohne Google (C-003). Dieselbe Quelle wie in der bestehenden myclub-App
 * (`map.service.ts`). Die Bibliothek selbst lädt nur `VenueMap`, und die nur
 * über `lazy()`: MapLibre wiegt rund 800 kB und gehört nicht in den
 * Startchunk.
 */
export const SWISSTOPO_STYLE =
  'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.basemap.vt/style.json';

/** Die Grundfarbe aus `theme/variables.css`, falls die Variable nicht lesbar ist. */
const FALLBACK_MARKER_COLOR = '#339bde';

/** Ein Punkt in WGS84, wie ihn der Verband nennt (`0076`). */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Hat der Termin eine Lage? Beide Werte oder keiner – die Datenbank
 * erzwingt das (`events_coordinates_pair_check`), die Prüfung hier hält
 * Testdaten und alte Zeilen auf demselben Stand.
 */
export function coordinatesOf(event: {
  latitude?: number | null;
  longitude?: number | null;
}): Coordinates | null {
  const { latitude, longitude } = event;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/**
 * Die Vereinsfarbe zur Laufzeit: Der Marker trägt dieselbe Farbe wie die
 * App, im Dunkelmodus also die getauschte (`theme.ts`).
 */
export function markerColor(): string {
  if (typeof getComputedStyle === 'undefined' || typeof document === 'undefined') {
    return FALLBACK_MARKER_COLOR;
  }
  const value = getComputedStyle(document.body).getPropertyValue('--ion-color-primary').trim();
  return value || FALLBACK_MARKER_COLOR;
}

export type NavigationPlatform = 'ios' | 'android' | 'web';

export function currentPlatform(): NavigationPlatform {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android' ? platform : 'web';
}

/**
 * Die Adresse, die die Navigation des Geräts öffnet – eine Route zum Ziel,
 * kein Suchtreffer. iOS: Apple Karten (`maps:`), Android: die `geo:`-Absicht,
 * die jede installierte Karten-App annimmt – keine Google-Adresse (C-003).
 * Im Browser die Route auf OpenStreetMap.
 *
 * Reine Funktion mit der Plattform als Argument, damit der Test alle drei
 * Wege sieht, ohne Capacitor zu stubben.
 */
export function navigationUrl(
  point: Coordinates,
  label: string | null,
  platform: NavigationPlatform = currentPlatform(),
): string {
  const at = `${point.latitude},${point.longitude}`;
  if (platform === 'ios') return `maps:?daddr=${at}`;
  if (platform === 'android') {
    const name = label ? `(${encodeURIComponent(label)})` : '';
    return `geo:${at}?q=${at}${name}`;
  }
  return `https://www.openstreetmap.org/directions?to=${encodeURIComponent(at)}`;
}

/**
 * Öffnet die Navigation. `_system` wie in der bestehenden App: Capacitor
 * reicht `maps:` und `geo:` an das System weiter, `https:` an den Browser.
 */
export function openNavigation(point: Coordinates, label: string | null): void {
  window.open(navigationUrl(point, label), '_system');
}

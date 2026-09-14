import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { VenueMap } from './VenueMap';
import { SWISSTOPO_STYLE } from '../lib/map';

/**
 * MapLibre braucht WebGL, das jsdom nicht hat. Der Stub zeichnet nichts, er
 * merkt sich nur, womit die Karte, der Marker und das Popup gebaut wurden –
 * das ist alles, was die Komponente entscheidet.
 */
const created = vi.hoisted(() => ({
  workerUrl: null as string | null,
  maps: [] as Array<{ options: Record<string, unknown>; remove: () => void }>,
  markers: [] as Array<{
    options: Record<string, unknown>;
    lngLat: unknown;
    popup: { text: string | null } | null;
    map: unknown;
  }>,
}));

vi.mock('maplibre-gl', () => {
  class Map {
    options: Record<string, unknown>;
    remove = vi.fn();
    constructor(options: Record<string, unknown>) {
      this.options = options;
      created.maps.push(this);
    }
  }
  class Popup {
    options: Record<string, unknown>;
    text: string | null = null;
    constructor(options: Record<string, unknown>) {
      this.options = options;
    }
    setText(text: string) {
      this.text = text;
      return this;
    }
  }
  class Marker {
    options: Record<string, unknown>;
    lngLat: unknown = null;
    popup: Popup | null = null;
    map: unknown = null;
    constructor(options: Record<string, unknown>) {
      this.options = options;
      created.markers.push(this);
    }
    setLngLat(lngLat: unknown) {
      this.lngLat = lngLat;
      return this;
    }
    setPopup(popup: Popup) {
      this.popup = popup;
      return this;
    }
    addTo(map: unknown) {
      this.map = map;
      return this;
    }
  }
  return {
    Map,
    Marker,
    Popup,
    setWorkerUrl: (url: string) => {
      created.workerUrl = url;
    },
  };
});

const point = { latitude: 47.45216833333333, longitude: 8.647400000000001 };

describe('VenueMap (C-006)', () => {
  beforeEach(() => {
    created.maps.length = 0;
    created.markers.length = 0;
  });

  it('zeichnet die swisstopo-Karte um den Spielort und setzt den Marker dorthin', () => {
    const { container } = render(
      <VenueMap point={point} label="Turnhalle Hatzenbühl, Nürensdorf" title="Karte des Spielorts" />,
    );

    expect(created.maps).toHaveLength(1);
    const map = created.maps[0]!;
    expect(map.options.style).toBe(SWISSTOPO_STYLE);
    // MapLibre spricht [Länge, Breite] – nicht die Reihenfolge der Datenbank.
    expect(map.options.center).toEqual([point.longitude, point.latitude]);
    expect(map.options.zoom).toBe(14);
    expect(map.options.container).toBe(container.firstElementChild);

    expect(created.markers).toHaveLength(1);
    const marker = created.markers[0]!;
    expect(marker.lngLat).toEqual([point.longitude, point.latitude]);
    expect(marker.map).toBe(map);
    expect(marker.popup?.text).toBe('Turnhalle Hatzenbühl, Nürensdorf');
    expect(marker.options.color).toBe('#339bde');
  });

  it('trägt den Namen für Bedienhilfen und die Klasse mit der festen Höhe', () => {
    const { container } = render(<VenueMap point={point} label={null} title="Karte des Spielorts" />);
    const region = container.firstElementChild!;
    expect(region).toHaveAttribute('aria-label', 'Karte des Spielorts');
    expect(region).toHaveClass('app-venue-map');
  });

  it('setzt ohne Ort keinen Popup – ein leerer Ballon wäre eine Frage ohne Antwort', () => {
    render(<VenueMap point={point} label={null} title="Karte" />);
    expect(created.markers[0]?.popup).toBeNull();
  });

  it('sagt MapLibre, wo Vite den Worker abgelegt hat – sonst bleibt die Karte leer', () => {
    // Beim Import gesetzt, nicht erst beim Rendern: vor der ersten Karte.
    expect(created.workerUrl).toEqual(expect.stringContaining('maplibre-gl-worker'));
  });

  it('räumt die Karte beim Schliessen des Blatts weg', () => {
    const { unmount } = render(<VenueMap point={point} label={null} title="Karte" />);
    unmount();
    expect(created.maps[0]?.remove).toHaveBeenCalledTimes(1);
  });

  it('hält den Touch auf der Karte fest, damit das Blatt darüber nicht zufällt (guidelines §2)', () => {
    const { container } = render(<VenueMap point={point} label={null} title="Karte" />);
    const region = container.firstElementChild!;
    const seenByParent = vi.fn();
    container.addEventListener('touchstart', seenByParent);

    region.dispatchEvent(new Event('touchstart', { bubbles: true }));

    expect(seenByParent).not.toHaveBeenCalled();
  });
});

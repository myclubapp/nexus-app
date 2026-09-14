import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker, Popup, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { SWISSTOPO_STYLE, markerColor, type Coordinates } from '../lib/map';

/**
 * MapLibre setzt die Adresse seines Workers zur Laufzeit aus `import.meta.url`
 * zusammen – ein Bundler sieht das nicht: Der Dev-Server sucht die Datei im
 * Vorrat der vorgebündelten Abhängigkeiten, der Build legt sie gar nicht ab,
 * und die Karte bleibt leer. Vite bündelt den Worker deshalb selbst (samt
 * `maplibre-gl-shared.mjs`, das er importiert) und liefert seine Adresse;
 * MapLibre bekommt sie, bevor die erste Karte entsteht.
 */
setWorkerUrl(workerUrl);

interface VenueMapProps {
  point: Coordinates;
  /** Der Ort, wie er in der Zeile steht – als Beschriftung des Markers. */
  label: string | null;
  /** Der Name der Karte für Bedienhilfen. */
  title: string;
}

/** Ein Touch, der auf der Karte beginnt, gehört der Karte (siehe unten). */
function keepTouch(event: TouchEvent) {
  event.stopPropagation();
}

/**
 * Der Spielort auf der swisstopo-Karte (C-006), wie im Spiel-Detail der
 * bestehenden myclub-App: Zoom 14, ein Marker in der Vereinsfarbe, ein
 * Tippen darauf nennt den Ort. MapLibre GL direkt, ohne React-Hülle – die
 * Bibliothek ist gross genug.
 *
 * **Nur über `lazy()` einbinden** (`EventDetailModal`): MapLibre wiegt rund
 * 800 kB und kommt erst mit dem ersten Termin, der eine Lage hat.
 *
 * Das Blatt darüber ist eine Karte im Sinn von iOS (guidelines §2) und
 * schliesst auf Wischen nach unten, sobald der Inhalt oben steht – genau da
 * liegt die Karte. Ohne den Riegel würde jedes Verschieben nach Süden das
 * Blatt zuziehen: Der `touchstart` bleibt deshalb hier stehen; Ionics Geste
 * horcht am `ion-modal` und sieht ihn nicht. Nativ registriert, weil Reacts
 * Handler erst an der Wurzel läuft – nach dem Blatt.
 */
export function VenueMap({ point, label, title }: VenueMapProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    const map = new MapLibreMap({
      container: element,
      style: SWISSTOPO_STYLE,
      center: [point.longitude, point.latitude],
      zoom: 14,
      attributionControl: { compact: true, customAttribution: '© swisstopo' },
    });
    const marker = new Marker({ color: markerColor() }).setLngLat([
      point.longitude,
      point.latitude,
    ]);
    if (label) {
      marker.setPopup(new Popup({ closeButton: false, offset: 24 }).setText(label));
    }
    marker.addTo(map);
    element.addEventListener('touchstart', keepTouch);

    return () => {
      element.removeEventListener('touchstart', keepTouch);
      map.remove();
    };
  }, [point.latitude, point.longitude, label]);

  return <div ref={container} className="app-venue-map" role="region" aria-label={title} />;
}

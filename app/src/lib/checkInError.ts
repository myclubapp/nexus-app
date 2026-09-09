/**
 * Serverfehler des Check-ins in Übersetzungsschlüssel übersetzen (UC-014).
 *
 * Die Meldungen der Datenbankfunktionen sind deutsch und für Entwickler
 * geschrieben – sie gehören nicht ungefiltert auf den Bildschirm einer
 * französischsprachigen Person (C-007, C-008). Die Zuordnung steht hier und
 * nicht in der Komponente, damit sie prüfbar ist.
 */
export type CheckInErrorKey =
  | 'window'
  | 'wrongCode'
  | 'notMember'
  | 'cancelled'
  | 'notFound'
  | 'forbidden'
  | 'camera'
  | 'offline'
  | 'generic';

/** Ordnet die Meldung einer Ursache zu; alles Unbekannte bleibt `generic`. */
export function checkInErrorKey(message: string | null | undefined): CheckInErrorKey {
  const text = (message ?? '').toLowerCase();

  if (text.includes('zeitfenster')) return 'window';
  if (text.includes('gehört nicht zu diesem termin')) return 'wrongCode';
  if (text.includes('kein mitglied')) return 'notMember';
  if (text.includes('abgesagt')) return 'cancelled';
  if (text.includes('nicht gefunden')) return 'notFound';
  if (text.includes('nur trainer') || text.includes('nur der vorstand')) {
    return 'forbidden';
  }

  // Ein Netzfehler heisst je nach Laufzeitumgebung anders. WebKit – und damit
  // die iOS-App – meldet «TypeError: Load failed», Chromium «Failed to fetch»,
  // Firefox «NetworkError». Nur den Chromium-Wortlaut zu prüfen hiesse, den
  // Puffer ausgerechnet auf der Hauptplattform abzuschalten.
  if (
    text.includes('failed to fetch') ||
    text.includes('load failed') ||
    text.includes('networkerror') ||
    text.includes('network request failed') ||
    text.includes('aborterror') ||
    text.includes('timeout')
  ) {
    return 'offline';
  }

  return 'generic';
}

/**
 * Zählt der Browser sich selbst als offline?
 *
 * `navigator.onLine` ist notorisch optimistisch – ein `true` beweist nichts.
 * Ein `false` dagegen ist verlässlich, und dann braucht es die Fehlermeldung
 * gar nicht erst.
 */
export function isKnownOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Lässt sich der Scan später nachsenden (A5), oder ist er endgültig? */
export function isRetryable(key: CheckInErrorKey): boolean {
  return key === 'offline';
}

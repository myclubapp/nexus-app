import { useLocaleSync } from '../hooks/useLocaleSync';

/**
 * Meldet die Sprache der App an den Server (UC-044). Rendert nichts; steht
 * innerhalb von `AuthProvider`, weil der Abgleich das Konto braucht.
 */
export function LocaleSync() {
  useLocaleSync();
  return null;
}

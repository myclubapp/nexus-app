import {
  barbellOutline,
  calendarOutline,
  heartOutline,
  helpBuoyOutline,
  peopleOutline,
  trophyOutline,
} from 'ionicons/icons';
import type { EventType } from './database.types';

/**
 * Ein Symbol je Terminart – die einzige Stelle, an der die Zuordnung steht.
 *
 * Wo kein Antwortstand zu zeigen ist (ein Termin eines fremden Teams, ein
 * Anlass, auf den über Schichten geantwortet wird), steht statt der Ampel
 * dieses Symbol. Es sagt dann, **worum** es geht, statt nur zu sagen, dass
 * es einen nicht betrifft.
 *
 * Die Symbole sind eine Merkhilfe, keine Beschriftung: Wie die Art heisst,
 * bestimmt weiterhin der Verein über `useClub().eventLabel()`.
 */
const EVENT_TYPE_ICONS: Record<EventType, string> = {
  training: barbellOutline,
  match: trophyOutline,
  gv: peopleOutline,
  social: heartOutline,
  helper: helpBuoyOutline,
  meeting: calendarOutline,
};

/**
 * Das Symbol zur Terminart. `events.type` ist eine `text`-Spalte: Kommt aus
 * der Datenbank ein Wert, den die App noch nicht kennt, bleibt es beim
 * neutralen Kalenderblatt statt bei einem leeren Platz.
 */
export function eventTypeIcon(type: EventType | null | undefined): string {
  return (type && EVENT_TYPE_ICONS[type]) || calendarOutline;
}

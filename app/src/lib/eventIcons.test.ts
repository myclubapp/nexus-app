import { describe, expect, it } from 'vitest';
import {
  barbellOutline,
  calendarOutline,
  heartOutline,
  helpBuoyOutline,
  peopleOutline,
  trophyOutline,
} from 'ionicons/icons';
import type { EventType } from './database.types';
import { eventTypeIcon } from './eventIcons';

describe('eventTypeIcon', () => {
  it('gibt jeder Terminart ihr Symbol', () => {
    expect(eventTypeIcon('training')).toBe(barbellOutline);
    expect(eventTypeIcon('match')).toBe(trophyOutline);
    expect(eventTypeIcon('gv')).toBe(peopleOutline);
    expect(eventTypeIcon('social')).toBe(heartOutline);
    expect(eventTypeIcon('helper')).toBe(helpBuoyOutline);
    expect(eventTypeIcon('meeting')).toBe(calendarOutline);
  });

  it('unterscheidet die Arten voneinander', () => {
    const types: EventType[] = ['training', 'match', 'gv', 'social', 'helper', 'meeting'];
    expect(new Set(types.map(eventTypeIcon)).size).toBe(types.length);
  });

  it('fällt bei einer unbekannten Art auf das Kalenderblatt zurück', () => {
    // `events.type` ist eine `text`-Spalte: Eine neue Art aus der Datenbank
    // darf keinen leeren Platz hinterlassen.
    expect(eventTypeIcon('workshop' as EventType)).toBe(calendarOutline);
    expect(eventTypeIcon(null)).toBe(calendarOutline);
  });
});

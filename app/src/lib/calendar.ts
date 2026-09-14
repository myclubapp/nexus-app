import { Capacitor } from '@capacitor/core';
import { CapacitorCalendar, downloadIcsFile } from '@ebarooni/capacitor-calendar';
import type { AppEvent, EventShift } from './database.types';

/**
 * Was ein Eintrag im Kalender des Geräts trägt (FR-156).
 *
 * Bewusst kein Abbild des Termins, sondern das, was ein Kalender kennt: Titel,
 * Ort, Zeitfenster und Notizen. Die Zeiten sind Unix-Millisekunden – das
 * Plugin will sie so, und eine Zahl kennt keine Zeitzone, die man verwechseln
 * könnte. Der Kalender rechnet sie beim Anzeigen in die Ortszeit um.
 */
export interface CalendarEntry {
  title: string;
  location: string | null;
  /** Das Warum, die Terminart, bei einer Schicht der Anlass. */
  notes: string | null;
  startsAt: number;
  endsAt: number;
}

/**
 * BR-187: Ohne Ende dauert der Eintrag eine Stunde – dieselbe Voreinstellung,
 * die ein neuer Termin im Gerätekalender bekommt. Kein Termin ohne Ende: Ein
 * Eintrag ohne `DTEND` wäre nach RFC 5545 null Minuten lang, und die nativen
 * Blätter verlangen ohnehin eines.
 */
export const DEFAULT_DURATION_MS = 60 * 60 * 1000;

type EventFacts = Pick<AppEvent, 'title' | 'location' | 'why' | 'starts_at' | 'ends_at'>;

/** Der Termin selbst (UC-010 Schritt 6). `label` ist die Terminart des Vereins. */
export function eventCalendarEntry(event: EventFacts, label: string): CalendarEntry {
  return {
    title: event.title,
    location: blankToNull(event.location),
    notes: joinNotes(label, event.why),
    ...timeWindow(event.starts_at, event.ends_at),
  };
}

/**
 * Eine übernommene Schicht (UC-012 Schritt 7). Der Eintrag trägt das Fenster
 * der **Schicht**, nicht des Anlasses – wer um acht aufbaut, will nicht um
 * zwölf erinnert werden. Der Anlass steht im Titel dahinter und in den Notizen.
 */
export function shiftCalendarEntry(
  shift: Pick<EventShift, 'title' | 'starts_at' | 'ends_at'>,
  event: Pick<AppEvent, 'title' | 'location' | 'why'>,
): CalendarEntry {
  return {
    title: `${shift.title} – ${event.title}`,
    location: blankToNull(event.location),
    notes: joinNotes(event.title, event.why),
    ...timeWindow(shift.starts_at, shift.ends_at),
  };
}

/**
 * Dateiname der ICS-Datei im Browser. Das Plugin würde ihn selbst ableiten,
 * streicht dabei aber alles ausserhalb von ASCII – aus «Frühjahrsputz» wird
 * «Frhjahrsputz». Hier bleiben Umlaute stehen; weg muss nur, was ein
 * Dateisystem nicht nimmt.
 */
export function icsFileName(title: string): string {
  const base = title
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
  return `${base.length > 0 ? base : 'myclub'}.ics`;
}

/**
 * Den Eintrag dem Kalender des Geräts anbieten.
 *
 * Auf iOS und Android öffnet sich das Blatt «Neuer Termin» des Systems, schon
 * ausgefüllt – die Person wählt den Kalender und sichert oder verwirft. Dafür
 * braucht es keine Kalender-Berechtigung: Das Blatt gehört dem System, nicht
 * der App (EKEventEditViewController, `ACTION_INSERT`). Im Browser wird eine
 * ICS-Datei heruntergeladen; auf dem Handy öffnet sie der Kalender, am
 * Rechner die Kalender-App.
 *
 * Wirft, wenn das Gerät keinen Weg hat – das Blatt darf das melden, aber
 * nicht die Zusage davon abhängig machen (BR-187).
 */
export async function addToDeviceCalendar(entry: CalendarEntry): Promise<void> {
  const shared = {
    title: entry.title,
    location: entry.location ?? undefined,
    description: entry.notes ?? undefined,
    startDate: entry.startsAt,
    endDate: entry.endsAt,
  };

  if (Capacitor.isNativePlatform()) {
    await CapacitorCalendar.createEventWithPrompt(shared);
    return;
  }

  const { ics } = await CapacitorCalendar.createEvent({
    ...shared,
    icsFileName: icsFileName(entry.title),
  });
  if (!ics) throw new Error('calendar: no ics file');
  await downloadIcsFile(ics);
}

// --- Helfer -----------------------------------------------------------------

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/** Notizen aus dem, was da ist – Absatz für Absatz, nichts Leeres. */
function joinNotes(...parts: (string | null | undefined)[]): string | null {
  const present = parts.map(blankToNull).filter((part): part is string => part !== null);
  return present.length > 0 ? present.join('\n\n') : null;
}

function timeWindow(
  startsAt: string,
  endsAt: string | null | undefined,
): Pick<CalendarEntry, 'startsAt' | 'endsAt'> {
  const start = new Date(startsAt).getTime();
  if (Number.isNaN(start)) throw new Error(`calendar: invalid start ${startsAt}`);
  const end = endsAt ? new Date(endsAt).getTime() : Number.NaN;
  // Ein Ende vor dem Anfang ist ein Datenfehler, kein Fenster – dann gilt die
  // Voreinstellung, nicht ein negativer Termin.
  return { startsAt: start, endsAt: end > start ? end : start + DEFAULT_DURATION_MS };
}

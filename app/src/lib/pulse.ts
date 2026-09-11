/**
 * Die drei Fragen des Vereins-Pulses – in fester Reihenfolge (BR-113).
 *
 * Sie steht hier und im Datenmodell, nicht in der Ansicht: Eine Ansicht kann
 * man umsortieren, und die Reihenfolge ist der Inhalt der Regel.
 */
export const PULSE_SECTIONS = ['happening', 'workingOn', 'joinIn'] as const;
export type PulseSection = (typeof PULSE_SECTIONS)[number];

export interface PulseItem {
  /**
   * `decision` seit dem Nachtrag zu UC-027: eine vom Vorstand publizierte
   * Antwort (FR-100). Nur sie – ein eingereichtes Anliegen gehört der Person,
   * die es geschrieben hat, und steht nie in einer Nachricht an alle.
   */
  kind: 'event' | 'task' | 'shift' | 'decision';
  id: string;
  title: string;
  at: string | null;
  detail: string | null;
}

export interface ClubPulse {
  id: string;
  happening: PulseItem[];
  workingOn: PulseItem[];
  joinIn: PulseItem[];
  intro: string | null;
  status: 'draft' | 'sent' | 'discarded';
  composedAt: string;
  sentAt: string | null;
}

/** Alle Einträge eines Pulses, in der Reihenfolge der drei Fragen. */
export function allItems(pulse: ClubPulse): PulseItem[] {
  return [...pulse.happening, ...pulse.workingOn, ...pulse.joinIn];
}

/** Die Einträge eines Abschnitts. */
export function itemsOf(pulse: ClubPulse, section: PulseSection): PulseItem[] {
  if (section === 'happening') return pulse.happening;
  if (section === 'workingOn') return pulse.workingOn;
  return pulse.joinIn;
}

/**
 * Hat der Puls überhaupt Inhalt?
 *
 * Ein Entwurf ohne Einträge entsteht gar nicht erst (A3) – aber wer alles
 * streicht, soll nicht eine leere Nachricht versenden können.
 */
export function isEmpty(pulse: ClubPulse, kept: ReadonlySet<string>): boolean {
  return allItems(pulse).every((item) => !kept.has(item.id));
}

export interface ConnectionRatio {
  connections: number;
  calls: number;
  lastConnection: string | null;
}

/**
 * Kippt die Verbindungs-Quote (K1, BR-116)?
 *
 * Dieselbe Schwelle wie das Signal `connection_ratio` in `0040`: mehr als
 * doppelt so viele Aufrufe wie Verbindungen, und mindestens drei Aufrufe –
 * unter drei ist es kein Muster, sondern ein Zufall.
 */
export function ratioTilted(ratio: ConnectionRatio): boolean {
  return ratio.calls >= 3 && ratio.calls > ratio.connections * 2;
}

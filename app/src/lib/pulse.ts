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
   *
   * `news` seit UC-050 (FR-190): ein vereinsweiter Beitrag aus der App oder
   * von der Website. Eine neue **Art** im ersten Abschnitt, kein vierter
   * Abschnitt – BR-113 bleibt damit unangetastet.
   */
  kind: 'event' | 'task' | 'shift' | 'decision' | 'news';
  id: string;
  title: string;
  at: string | null;
  detail: string | null;
  /**
   * Die Adresse ausserhalb der App – gesetzt nur bei Beiträgen, die von der
   * Vereinswebsite stammen (UC-038, UC-050 A7).
   */
  url?: string | null;
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

// ---------------------------------------------------------------------------
// Der Gruss am Fuss des Pulses (UC-050, FR-191).
//
// Er hängt am **Amt** und nicht an der Person (BR-252): Wechselt die
// Besetzung, wechselt die Unterschrift mit, ohne dass jemand eine Einstellung
// nachzieht. Was hier ankommt, hat `pulse_payload()` zusammengestellt – die
// Entscheidung, was daraus im Blatt steht, fällt hier und nicht in der
// Ansicht, damit sie prüfbar ist und für App und Mail dieselbe ist.
// ---------------------------------------------------------------------------

/** Was `pulse_payload()` zum Gruss liefert. */
export interface PulseGreeting {
  /** Der Grusstext des Vereins, in der Sprache der Leserin. */
  text: string | null;
  /** Die Bezeichnung des Amts, z.B. «Präsidium». */
  office: string | null;
  /** Die Namen der Inhaber:innen, in der Reihenfolge der Belegung. */
  names: string[];
  /** Das Porträt – eine öffentliche Adresse (BR-253). */
  imageUrl: string | null;
}

/** Die Nutzlast eines Pulses für Blatt und Vorschau. */
export interface PulsePayload {
  pulseId: string;
  intro: string | null;
  sections: Record<PulseSection, PulseItem[]>;
  greeting: PulseGreeting | null;
}

/**
 * Die Unterschrift, wie sie im Blatt steht.
 *
 * `null` heisst: Dieser Verein grüsst nicht – das Blatt endet nach den
 * Abschnitten, ohne Platzhalter (A1). Ist das Amt **vakant**, bleibt der Text
 * und an der Stelle des Namens steht der Vorstand (A2); das Porträt fällt dann
 * weg, weil es das Gesicht einer Person zeigt, die das Amt nicht mehr hält.
 */
export interface PulseSignature {
  text: string | null;
  office: string | null;
  names: string[];
  /** Das Amt ist unbesetzt – die Ansicht setzt «Der Vorstand» ein (A2). */
  vacant: boolean;
  imageUrl: string | null;
}

export function signatureOf(greeting: PulseGreeting | null | undefined): PulseSignature | null {
  if (!greeting) return null;

  const text = greeting.text?.trim() || null;
  const office = greeting.office?.trim() || null;
  const names = greeting.names.map((name) => name.trim()).filter((name) => name.length > 0);
  if (!text && !office && names.length === 0) return null;

  const vacant = names.length === 0;
  return {
    text,
    office,
    names,
    vacant,
    imageUrl: vacant ? null : (safeImageUrl(greeting.imageUrl) ?? null),
  };
}

/**
 * Eine Bildadresse, die in ein Blatt darf.
 *
 * Nur `https:` – dieselbe Linie wie `safeUrl()` im Mailblatt (BR-242). Eine
 * `http:`-Adresse würde in vielen Postfächern ohnehin nicht laden, und alles
 * andere (`data:`, `javascript:`) hat in einem Blatt nichts zu suchen.
 */
export function safeImageUrl(url: string | null | undefined): string | null {
  const value = (url ?? '').trim();
  if (!value.startsWith('https://')) return null;
  return value;
}

/**
 * Die Adresse, die ein Eintrag nach draussen führt (A7).
 *
 * Nur ein Beitrag von der Website trägt eine; alles andere steht in der App,
 * und ein Verweis dorthin ist Sache der Ansicht.
 */
export function externalUrl(item: PulseItem): string | null {
  const value = (item.url ?? '').trim();
  if (!value.startsWith('https://') && !value.startsWith('http://')) return null;
  return value;
}

/** Die Nutzlast aus der Datenbank – tolerant gelesen, weil sie `jsonb` ist. */
export function toPulsePayload(value: unknown): PulsePayload | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.pulseId !== 'string') return null;

  const sections = (row.sections ?? {}) as Record<string, unknown>;
  const read = (key: PulseSection): PulseItem[] =>
    Array.isArray(sections[key]) ? (sections[key] as PulseItem[]) : [];

  const raw = row.greeting as Record<string, unknown> | null | undefined;
  const greeting: PulseGreeting | null = raw
    ? {
        text: (raw.text ?? null) as string | null,
        office: (raw.office ?? null) as string | null,
        names: Array.isArray(raw.names) ? (raw.names as string[]) : [],
        imageUrl: (raw.imageUrl ?? null) as string | null,
      }
    : null;

  return {
    pulseId: row.pulseId,
    intro: (row.intro ?? null) as string | null,
    sections: {
      happening: read('happening'),
      workingOn: read('workingOn'),
      joinIn: read('joinIn'),
    },
    greeting,
  };
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

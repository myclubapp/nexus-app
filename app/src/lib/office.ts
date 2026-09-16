/**
 * Funktionärsämter mit Factsheet (UC-041).
 *
 * Reine Logik ohne Ionic und ohne Supabase: die Sitzrechnung (BR-183), die
 * Form eines Amtes, die Umsetzung der Pflichten zwischen Liste und Textfeld,
 * und die Prüfung des Formulars. Was hier steht, prüft `office.test.ts`; die
 * Blätter stellen nur dar.
 */
import type { LabelSet } from './clubSettings';

/** Eine Pflicht: Überschrift, optional ein Satz dazu. Form wie `duties` in `0070`. */
export interface OfficeDuty {
  title: string;
  detail: string | null;
}

/** Wer einen Sitz hält – mit oder ohne Konto (BR-184). */
export interface OfficeHolder {
  id: string;
  memberId: string | null;
  displayName: string;
  /** «ad interim»: hält den Sitz, ohne dass er als besetzt zählt (BR-183). */
  interim: boolean;
  since: string | null;
}

export interface Office {
  id: string;
  title: string;
  /**
   * Der Spiegel für den Verteiler (BR-185): die erste verknüpfte Inhaber:in.
   * Die Sitzungs-Blätter lesen ihn weiterhin; die Belegung steht in `holders`.
   */
  holderMemberId: string | null;
  holderName: string | null;
  heldSince: string | null;
  why: string | null;
  duties: OfficeDuty[];
  hoursPerSeason: string | null;
  /**
   * Der Text am Factsheet – die Vereinsskala, wie sie gewachsen ist
   * («4 + Lohn», «3 + Lohn + Spesen»). **Keine Punktzahl dieser App.**
   */
  pointsLabel: string | null;
  /**
   * Der Punktwert für eine ganze Saison (BR-206), in derselben Einheit wie
   * jede andere Punktzahl. `null` heisst «noch nicht festgelegt», nicht «null
   * Punkte» – derselbe Unterschied wie beim Saisonziel (BR-200).
   */
  seasonPoints: number | null;
  maxHolders: number;
  /**
   * Gehört das Amt zum Vorstand (BR-237)? Die Menge dieser Ämter ist der
   * Verteiler «Vorstand» und die Voreinstellung des Empfängerkreises einer
   * Sitzung.
   */
  isBoard: boolean;
  contactMemberId: string | null;
  contactName: string | null;
  factsheetPath: string | null;
  /**
   * Der Grusstext dieses Amtes je Sprache (UC-050, FR-191). Leer heisst: Dieses
   * Amt grüsst nicht. Er hängt am Amt und nicht an der Person – wechselt die
   * Besetzung, wechselt die Unterschrift mit (BR-252).
   */
  greeting?: LabelSet;
  /** Das Porträt zum Gruss – eine **öffentliche** Adresse (FR-192, BR-253). */
  greetingImageUrl?: string | null;
  holders: OfficeHolder[];
}

/**
 * Was am Text des Factsheets neben der alten Helferpunktzahl noch steht.
 *
 * `points_label` trug bis `0091` beides: die Zahl der Vereinsskala **und**
 * Zusätze wie «+ Lohn + Spesen». Die Zahl steht jetzt in `seasonPoints` und
 * wäre doppelt; der Zusatz sagt weiterhin etwas, das keine Punktzahl
 * ausdrückt. Deshalb wird die führende Zahl – auch eine Spanne wie «1-4» –
 * abgeschnitten und nur der Rest angezeigt.
 */
export function officePointsExtra(pointsLabel: string | null): string | null {
  if (!pointsLabel) return null;
  const rest = pointsLabel
    .replace(/^\s*\d+\s*(?:[-–]\s*\d+\s*)?/, '')
    .replace(/^[+·,;\s]+/, '')
    .trim();
  return rest.length > 0 ? rest : null;
}

/**
 * Sitze, für die eine Amtsgutschrift überhaupt entstehen kann (BR-264).
 *
 * Zwei Bedingungen, beide notwendig, beide leicht zu übersehen: Der Sitz
 * braucht eine **verknüpfte Mitgliedschaft** (ein Name allein ist kein
 * Buchungsziel, BR-184) und das Amt einen **Punktwert** (`null` heisst «noch
 * nicht entschieden», und eine erfundene Zahl wäre schlechter als keine).
 *
 * Die Zahl steht am Knopf des Vorstands: Ohne sie sieht «0 gutgeschrieben»
 * nach einem Fehler aus, obwohl es heisst, dass niemand buchbar ist.
 * `interim` zählt mit – wer ad interim führt, leistet die Arbeit.
 *
 * Gegenstück zur Schleife in `office_terms_due()`; laufen die beiden
 * auseinander, verspricht der Knopf etwas anderes, als der Server tut.
 *
 * **Eine Abweichung ist bekannt und in Kauf genommen:** Der Server überspringt
 * zusätzlich Sitze, deren «seit»-Datum nach dem Saisonende liegt – ein Amt, das
 * erst nächste Saison beginnt. Diese Zahl hier zählt sie mit, weil der Client
 * das Saisonende nicht kennt und eine zweite Datumsrechnung im Frontend genau
 * die Art von Doppelspurigkeit wäre, die dieser Kommentar verhindern soll. Die
 * Folge ist harmlos: Der Knopf nennt im Grenzfall einen Sitz zu viel und bucht
 * ihn nicht – nie umgekehrt.
 */
export function creditableSeats(
  offices: readonly Pick<Office, 'seasonPoints' | 'holders'>[],
): number {
  return offices.reduce(
    (sum, office) =>
      sum +
      ((office.seasonPoints ?? 0) > 0
        ? office.holders.filter((holder) => holder.memberId !== null).length
        : 0),
    0,
  );
}

/** Offene Sitze: Sitze minus Inhaber:innen ohne «ad interim» – wie `office_open_seats()`. */
export function openSeats(office: Pick<Office, 'maxHolders' | 'holders'>): number {
  const taken = office.holders.filter((holder) => !holder.interim).length;
  return Math.max(office.maxHolders - taken, 0);
}

/** Vakant heisst: mindestens ein Sitz ist frei (BR-183). */
export function isVacant(office: Pick<Office, 'maxHolders' | 'holders'>): boolean {
  return openSeats(office) > 0;
}

/**
 * Die Belegung als Anzeige: Namen in der Reihenfolge der Eintragung, «ad
 * interim» dahinter. Leer, wenn niemand das Amt hält.
 */
export function holderNames(holders: readonly OfficeHolder[]): string[] {
  return holders.map((holder) => holder.displayName);
}

/**
 * Pflichten als Textfeld: ein Absatz je Pflicht, die erste Zeile ist die
 * Überschrift, alles darunter der Satz dazu. Absätze trennt eine Leerzeile –
 * so lässt sich ein Pflichtenheft aus Word einfügen, ohne es umzubauen.
 */
export function parseDuties(text: string): OfficeDuty[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      const [first, ...rest] = block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const detail = rest.join(' ').trim();
      return { title: first, detail: detail.length > 0 ? detail : null };
    });
}

/** Die Umkehrung von `parseDuties()` – für den Anfangswert des Textfelds. */
export function dutiesToText(duties: readonly OfficeDuty[]): string {
  return duties
    .map((duty) => (duty.detail ? `${duty.title}\n${duty.detail}` : duty.title))
    .join('\n\n');
}

/** Was `duties` aus der Datenbank sein darf – ein fremdes jsonb ist kein Vertrag. */
export function readDuties(value: unknown): OfficeDuty[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const title = (entry as { title?: unknown }).title;
    if (typeof title !== 'string' || title.trim().length === 0) return [];
    const detail = (entry as { detail?: unknown }).detail;
    return [{ title: title.trim(), detail: typeof detail === 'string' && detail.trim() ? detail.trim() : null }];
  });
}

export interface OfficeHolderDraft {
  /** Kennung eines bestehenden Sitzes – hält seine Geschichte fest. */
  id: string | null;
  memberId: string | null;
  displayName: string;
  interim: boolean;
  /**
   * Seit wann die Person den Sitz hält (ISO). Das Formular zeigt das Feld
   * nicht – es **trägt** es nur weiter, damit ein Speichern aus dem Formular
   * heraus kein Datum verliert. Geschrieben wird es beim Einlesen einer
   * Ämterbeschreibung (UC-041 A8), wo es in der Datei steht.
   */
  since: string | null;
}

export interface OfficeDraft {
  title: string;
  why: string;
  /** Der Inhalt des Textfelds; `parseDuties()` macht die Liste daraus. */
  dutiesText: string;
  hoursPerSeason: string;
  /** Nur noch der Zusatz («Lohn + Spesen») – die Zahl steht in `seasonPoints`. */
  pointsLabel: string;
  /** Punkte für eine ganze Saison; `null` heisst «noch nicht festgelegt». */
  seasonPoints: number | null;
  maxHolders: number;
  /** Gehört das Amt zum Vorstand (BR-237)? */
  isBoard: boolean;
  contactMemberId: string | null;
  contactName: string;
  holders: OfficeHolderDraft[];
}

export type OfficeProblem =
  | 'titleMissing'
  | 'titleTooLong'
  | 'seatsInvalid'
  | 'pointsInvalid'
  | 'holderNameMissing'
  | 'tooManyHolders'
  | 'whyTooLong';

/** Was an einem Amt fehlt – dieselben Grenzen wie `save_office()` in `0070`. */
export function validateOffice(draft: OfficeDraft): OfficeProblem[] {
  const problems: OfficeProblem[] = [];
  const title = draft.title.trim();

  if (title.length < 2) problems.push('titleMissing');
  if (title.length > 80) problems.push('titleTooLong');
  if (!Number.isInteger(draft.maxHolders) || draft.maxHolders < 1 || draft.maxHolders > 50) {
    problems.push('seatsInvalid');
  }
  // BR-206: dieselbe Grenze wie `set_office_points()` (0091). Sie steht hier,
  // weil der Punktwert in einer **zweiten** Buchung an den Server geht: Ohne
  // die Prüfung wäre das Amt schon gespeichert, wenn der Server den Wert
  // zurückweist – aus einer eingelesenen Datei genauso wie aus dem Formular.
  if (
    draft.seasonPoints !== null &&
    (!Number.isInteger(draft.seasonPoints) || draft.seasonPoints < 0 || draft.seasonPoints > 10000)
  ) {
    problems.push('pointsInvalid');
  }
  if (draft.why.trim().length > 1000) problems.push('whyTooLong');
  // Ein verknüpfter Sitz bekommt seinen Namen vom Mitglied; nur ein Sitz ohne
  // Konto braucht den Namen von Hand.
  if (draft.holders.some((holder) => holder.memberId === null && holder.displayName.trim().length === 0)) {
    problems.push('holderNameMissing');
  }
  // Mehr ordentliche Inhaber:innen als Sitze wäre eine Belegung, die die
  // Rechnung nicht abbilden kann.
  const regular = draft.holders.filter((holder) => !holder.interim).length;
  if (Number.isInteger(draft.maxHolders) && regular > draft.maxHolders) {
    problems.push('tooManyHolders');
  }

  return problems;
}

/** Ein gespeichertes Amt als Formularinhalt. */
export function officeToDraft(office: Office): OfficeDraft {
  return {
    title: office.title,
    why: office.why ?? '',
    dutiesText: dutiesToText(office.duties),
    hoursPerSeason: office.hoursPerSeason ?? '',
    // Der Text zeigt nur noch den Zusatz; die führende Zahl der alten
    // Vereinsskala steht seit `0091` in `seasonPoints` und wäre doppelt.
    pointsLabel: officePointsExtra(office.pointsLabel) ?? '',
    seasonPoints: office.seasonPoints,
    maxHolders: office.maxHolders,
    isBoard: office.isBoard,
    contactMemberId: office.contactMemberId,
    contactName: office.contactName ?? '',
    holders: office.holders.map((holder) => ({
      id: holder.id,
      memberId: holder.memberId,
      displayName: holder.displayName,
      interim: holder.interim,
      since: holder.since,
    })),
  };
}

export const EMPTY_OFFICE_DRAFT: OfficeDraft = {
  title: '',
  why: '',
  dutiesText: '',
  hoursPerSeason: '',
  pointsLabel: '',
  seasonPoints: null,
  maxHolders: 1,
  isBoard: false,
  contactMemberId: null,
  contactName: '',
  holders: [],
};

/** Der Bucket des Vereinsspeichers für Factsheets (BR-186). */
export const FACTSHEET_BUCKET = 'factsheets';

/** Grösste erlaubte Datei – dieselbe Grenze wie am Bucket. */
export const FACTSHEET_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Der Pfad eines Factsheets: der Vereinsordner zuerst, weil die
 * Storage-Policy ihn liest (BR-186); dann die Kennung des Amtes, damit ein
 * Ersatz das alte PDF überschreibt statt daneben zu liegen.
 */
export function factsheetPath(clubId: string, officeId: string): string {
  return `${clubId}/${officeId}.pdf`;
}

export type FactsheetProblem = 'notPdf' | 'tooLarge';

/** Ob eine gewählte Datei als Factsheet taugt – vor dem Hochladen, nicht danach. */
export function checkFactsheetFile(file: Pick<File, 'type' | 'size' | 'name'>): FactsheetProblem | null {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return 'notPdf';
  if (file.size > FACTSHEET_MAX_BYTES) return 'tooLarge';
  return null;
}

/**
 * Die Reihenfolge im Marktplatz: vakante Ämter zuerst, darin die mit den
 * meisten offenen Sitzen; danach alphabetisch.
 */
export function sortOffices(offices: readonly Office[]): Office[] {
  return [...offices].sort((a, b) => {
    const gap = openSeats(b) - openSeats(a);
    if (gap !== 0) return gap;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Die Ämter des Vorstands – der Empfängerkreis einer Vorstandssitzung
 * (BR-237).
 *
 * Dieselbe Menge wie `board_role_ids()` in `0095`, nur aus der Liste, die das
 * Formular ohnehin geladen hat. Der Server bleibt die Instanz, die sie beim
 * Zustellen auflöst; hier geht es allein um die Voreinstellung.
 */
export function boardRoleIds(offices: readonly Office[]): string[] {
  return offices.filter((office) => office.isBoard).map((office) => office.id);
}

/**
 * Die Amts-Kennungen aus einem jsonb-Feld – etwa `events.audience_role_ids`.
 *
 * Wie `readDuties()`: Was nicht die erwartete Form hat, ergibt eine leere
 * Liste statt eines Fehlers. Ein Termin mit unlesbarem Empfängerkreis wäre
 * sonst gar nicht mehr zu bearbeiten.
 */
export function readRoleIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Die Ämter in zwei Gruppen: der Vorstand und die übrigen.
 *
 * Der Vorstand steht als eigene Gruppe, weil er etwas anderes ist als ein Amt
 * unter vielen – er ist das Gremium, an das Sitzungen und Vorschläge gehen
 * (BR-237). Innerhalb der Gruppen gilt dieselbe Reihenfolge wie sonst:
 * vakante zuerst.
 */
export function groupOffices(offices: readonly Office[]): {
  board: Office[];
  others: Office[];
} {
  const sorted = sortOffices(offices);
  return {
    board: sorted.filter((office) => office.isBoard),
    others: sorted.filter((office) => !office.isBoard),
  };
}

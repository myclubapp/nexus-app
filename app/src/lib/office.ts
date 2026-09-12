/**
 * Funktionärsämter mit Factsheet (UC-041).
 *
 * Reine Logik ohne Ionic und ohne Supabase: die Sitzrechnung (BR-183), die
 * Form eines Amtes, die Umsetzung der Pflichten zwischen Liste und Textfeld,
 * und die Prüfung des Formulars. Was hier steht, prüft `office.test.ts`; die
 * Blätter stellen nur dar.
 */

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
  pointsLabel: string | null;
  maxHolders: number;
  contactMemberId: string | null;
  contactName: string | null;
  factsheetPath: string | null;
  holders: OfficeHolder[];
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
  /** Kennung eines bestehenden Sitzes – hält sein «seit» fest. */
  id: string | null;
  memberId: string | null;
  displayName: string;
  interim: boolean;
}

export interface OfficeDraft {
  title: string;
  why: string;
  /** Der Inhalt des Textfelds; `parseDuties()` macht die Liste daraus. */
  dutiesText: string;
  hoursPerSeason: string;
  pointsLabel: string;
  maxHolders: number;
  contactMemberId: string | null;
  contactName: string;
  holders: OfficeHolderDraft[];
}

export type OfficeProblem =
  | 'titleMissing'
  | 'titleTooLong'
  | 'seatsInvalid'
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
    pointsLabel: office.pointsLabel ?? '',
    maxHolders: office.maxHolders,
    contactMemberId: office.contactMemberId,
    contactName: office.contactName ?? '',
    holders: office.holders.map((holder) => ({
      id: holder.id,
      memberId: holder.memberId,
      displayName: holder.displayName,
      interim: holder.interim,
    })),
  };
}

export const EMPTY_OFFICE_DRAFT: OfficeDraft = {
  title: '',
  why: '',
  dutiesText: '',
  hoursPerSeason: '',
  pointsLabel: '',
  maxHolders: 1,
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

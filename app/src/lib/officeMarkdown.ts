/**
 * Die Ämterbeschreibung als Markdown-Datei (UC-041 A7/A8, FR-193/FR-194).
 *
 * Ein Amt ist nicht nur ein Datensatz dieser App: Es ist ein Blatt, das in
 * der Vereinsablage liegt – auf Google Drive, in SharePoint, im Ordner des
 * Präsidiums. Diese Datei ist die Brücke dorthin und zurück: Was die App
 * weiss, geht als lesbares Markdown hinaus; was jemand dort geschrieben hat,
 * kommt über dieselbe Form wieder herein.
 *
 * **Warum Markdown und keine CSV.** Eine Ämterbeschreibung ist ein Text mit
 * Abschnitten – Warum, Pflichten, Eckdaten, Besetzung –, keine Tabelle. In
 * einer CSV stünde das Pflichtenheft in einer Zelle mit Zeilenumbrüchen.
 * Markdown liest sich auf Drive gerendert, in jedem Editor roh und ist
 * zeilenweise versionierbar.
 *
 * **Warum kein Front Matter.** Ein YAML-Kopf wäre bequemer zu lesen, steht in
 * der Vorschau von Drive aber als Rohtext über dem Dokument. Die Eckdaten
 * sind deshalb eine gewöhnliche Aufzählung, und die einzige Maschinenangabe –
 * die Kennung des Amtes – steckt in einem HTML-Kommentar, den keine Ansicht
 * zeigt.
 *
 * **Warum die Beschriftungen hier stehen und nicht in `i18n`.** Der Leser
 * muss dieselben Wörter erkennen, die der Schreiber gesetzt hat – sonst liest
 * ein Verein, dessen App auf Französisch steht, eine deutsche Datei nicht
 * mehr. Beschriftung und Erkennung kommen deshalb aus **einer** Tabelle, die
 * alle vier Sprachen kennt; stünden die Wörter zusätzlich in den
 * Sprachdateien, gäbe es zwei Wahrheiten über dasselbe Wort.
 *
 * **Die Datei ergänzt und ändert, sie leert nie** (BR-256). Ein Abschnitt,
 * der fehlt oder leer ist, ist keine Aussage: Wer nur die Pflichten
 * überarbeitet, verliert die Besetzung nicht. Löschen bleibt der App
 * vorbehalten.
 */

import { fileDateStamp, slugify } from './fileExport';
import {
  EMPTY_OFFICE_DRAFT,
  dutiesToText,
  officePointsExtra,
  officeToDraft,
  parseDuties,
  validateOffice,
  type Office,
  type OfficeDraft,
  type OfficeHolderDraft,
  type OfficeProblem,
} from './office';

/** Der Medientyp der Datei – `text/markdown` ist seit RFC 7763 registriert. */
export const OFFICE_MARKDOWN_MIME = 'text/markdown;charset=utf-8';

/** Was ein Dateiwähler annehmen soll. Manche Systeme melden `.md` als `text/plain`. */
export const OFFICE_MARKDOWN_ACCEPT = '.md,.markdown,text/markdown,text/plain';

/** Die vier Sprachen der App – hier als Sprachen der **Datei**. */
export type MarkdownLang = 'de' | 'fr' | 'it' | 'en';

const LANGS: MarkdownLang[] = ['de', 'fr', 'it', 'en'];

/** `de-CH` ist Deutsch. Unbekanntes schreibt Deutsch – die Vereinssprache. */
export function officeMarkdownLang(value: string | null | undefined): MarkdownLang {
  const short = (value ?? '').slice(0, 2).toLowerCase();
  return LANGS.find((lang) => lang === short) ?? 'de';
}

type Labels = Record<MarkdownLang, string>;

/** Die vier Abschnitte eines Blattes, in der Reihenfolge des Papier-Factsheets. */
const SECTIONS: Record<'why' | 'duties' | 'facts' | 'holders', Labels> = {
  why: {
    de: 'Warum es dieses Amt gibt',
    fr: 'Pourquoi cette fonction existe',
    it: 'Perché esiste questa carica',
    en: 'Why this office exists',
  },
  duties: { de: 'Pflichten', fr: 'Tâches', it: 'Compiti', en: 'Duties' },
  facts: { de: 'Eckdaten', fr: 'Données clés', it: 'Dati principali', en: 'Key facts' },
  holders: { de: 'Besetzung', fr: 'Titulaires', it: 'Titolari', en: 'Held by' },
};

/** Die Eckdaten als Aufzählung: «- Sitze: 2». */
const FIELDS: Record<
  'seats' | 'board' | 'hours' | 'points' | 'compensation' | 'contact',
  Labels
> = {
  seats: { de: 'Sitze', fr: 'Sièges', it: 'Posti', en: 'Seats' },
  board: { de: 'Vorstand', fr: 'Comité', it: 'Comitato', en: 'Board' },
  hours: {
    de: 'Aufwand pro Saison',
    fr: 'Charge par saison',
    it: 'Impegno per stagione',
    en: 'Hours per season',
  },
  points: {
    de: 'Punkte pro Saison',
    fr: 'Points par saison',
    it: 'Punti per stagione',
    en: 'Points per season',
  },
  compensation: {
    de: 'Entschädigung',
    fr: 'Indemnité',
    it: 'Indennità',
    en: 'Compensation',
  },
  contact: {
    de: 'Ansprechperson',
    fr: 'Personne de contact',
    it: 'Persona di contatto',
    en: 'Contact',
  },
};

const YES: Labels = { de: 'ja', fr: 'oui', it: 'sì', en: 'yes' };
const NO: Labels = { de: 'nein', fr: 'non', it: 'no', en: 'no' };
const SINCE: Labels = { de: 'seit', fr: 'depuis', it: 'dal', en: 'since' };
const INTERIM: Labels = {
  de: 'ad interim',
  fr: 'ad interim',
  it: 'ad interim',
  en: 'ad interim',
};

/** Alles, was «ja» heisst – gelesen wird jede Sprache, geschrieben eine. */
const TRUE_WORDS = ['ja', 'yes', 'oui', 'si', 'sì', 'true', 'wahr', 'vrai', 'vero', 'x', '1'];
const FALSE_WORDS = ['nein', 'no', 'non', 'false', 'falsch', 'faux', 'falso', '0', '-'];

/** Wörter vor einem Datum in der Besetzung. */
const SINCE_WORDS = ['seit', 'since', 'depuis', 'dal', "dall'", 'da'];

/**
 * Vergleichsform eines Wortes: klein, ohne Akzente, ohne Auszeichnung, ohne
 * Doppelpunkt am Ende. Damit findet «**Sièges:**» dasselbe Feld wie «sieges».
 */
function norm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[*_`]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/:$/, '')
    .trim();
}

/** Welcher Schlüssel gemeint ist – der eigene Name oder eine der vier Sprachen. */
function matchKey<K extends string>(table: Record<K, Labels>, text: string): K | null {
  const wanted = norm(text);
  for (const key of Object.keys(table) as K[]) {
    if (norm(key) === wanted) return key;
    for (const lang of LANGS) {
      if (norm(table[key][lang]) === wanted) return key;
    }
  }
  return null;
}

// --- Schreiben --------------------------------------------------------------

/**
 * Die Kennung des Amtes, unsichtbar im gerenderten Dokument.
 *
 * Sie sagt beim Einlesen, welches Amt gemeint ist – auch dann noch, wenn das
 * Amt inzwischen anders heisst. Wer ein neues Amt aus einer Kopie anlegt,
 * löscht die Zeile (oder nimmt die Vorlage, die keine trägt).
 */
function marker(id: string): string {
  return `<!-- myclub nexus · office id: ${id} -->`;
}

function readId(comment: string): string | null {
  const match = comment.match(
    /id:\s*([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/,
  );
  return match ? match[1] : null;
}

/** Ein Amt als Markdown – die Reihenfolge des Blattes in der App. */
export function officeToMarkdown(office: Office, lang: MarkdownLang = 'de'): string {
  const out: string[] = [`# ${office.title}`, '', marker(office.id), ''];

  if (office.why) {
    out.push(`## ${SECTIONS.why[lang]}`, '', office.why.trim(), '');
  }

  if (office.duties.length > 0) {
    out.push(`## ${SECTIONS.duties[lang]}`, '');
    for (const duty of office.duties) {
      out.push(`### ${duty.title}`, '');
      if (duty.detail) out.push(duty.detail, '');
    }
  }

  out.push(`## ${SECTIONS.facts[lang]}`, '');
  out.push(`- ${FIELDS.seats[lang]}: ${office.maxHolders}`);
  out.push(`- ${FIELDS.board[lang]}: ${office.isBoard ? YES[lang] : NO[lang]}`);
  if (office.hoursPerSeason) out.push(`- ${FIELDS.hours[lang]}: ${office.hoursPerSeason}`);
  if (office.seasonPoints !== null) out.push(`- ${FIELDS.points[lang]}: ${office.seasonPoints}`);
  const extra = officePointsExtra(office.pointsLabel);
  if (extra) out.push(`- ${FIELDS.compensation[lang]}: ${extra}`);
  if (office.contactName) out.push(`- ${FIELDS.contact[lang]}: ${office.contactName}`);
  out.push('');

  if (office.holders.length > 0) {
    out.push(`## ${SECTIONS.holders[lang]}`, '');
    for (const holder of office.holders) {
      const notes = [
        holder.since ? `${SINCE[lang]} ${holder.since}` : null,
        holder.interim ? INTERIM[lang] : null,
      ].filter((note): note is string => Boolean(note));
      out.push(`- ${holder.displayName}${notes.length > 0 ? ` (${notes.join(', ')})` : ''}`);
    }
    out.push('');
  }

  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

/**
 * Mehrere Ämter in einer Datei – die Ablage des ganzen Vereins.
 *
 * Jedes Amt beginnt mit seiner `#`-Überschrift; daran erkennt der Leser die
 * Grenzen wieder. Der Vorspann davor ist ein Kommentar und damit für den
 * Leser nicht vorhanden.
 */
export function officesToMarkdown(
  offices: readonly Office[],
  lang: MarkdownLang = 'de',
  clubName?: string | null,
  today: Date = new Date(),
): string {
  const head = `<!-- myclub nexus · ${clubName?.trim() || 'Verein'} · ${fileDateStamp(today)} -->`;
  return [head, '', ...offices.map((office) => officeToMarkdown(office, lang))].join('\n');
}

const TEMPLATE_HINTS: Record<
  'file' | 'title' | 'why' | 'duty' | 'dutyDetail' | 'holders',
  Labels
> = {
  file: {
    de: 'Vorlage für eine Ämterbeschreibung. Text ersetzen, Datei speichern, in myclub nexus wieder einlesen. Ein Abschnitt, der leer bleibt, ändert nichts.',
    fr: "Modèle de description de fonction. Remplacez le texte, enregistrez, réimportez dans myclub nexus. Une section laissée vide ne change rien.",
    it: 'Modello di descrizione della carica. Sostituisci il testo, salva e reimporta in myclub nexus. Una sezione lasciata vuota non cambia nulla.',
    en: 'Template for an office description. Replace the text, save the file, import it back into myclub nexus. A section left empty changes nothing.',
  },
  title: {
    de: 'Bezeichnung des Amtes',
    fr: 'Nom de la fonction',
    it: 'Nome della carica',
    en: 'Name of the office',
  },
  why: {
    de: 'Ein Satz, der sagt, was ohne dieses Amt fehlen würde.',
    fr: "Une phrase qui dit ce qui manquerait sans cette fonction.",
    it: 'Una frase che dice cosa mancherebbe senza questa carica.',
    en: 'One sentence saying what would be missing without this office.',
  },
  duty: {
    de: 'Erste Pflicht',
    fr: 'Première tâche',
    it: 'Primo compito',
    en: 'First duty',
  },
  dutyDetail: {
    de: 'Ein Satz dazu – was genau zu tun ist.',
    fr: 'Une phrase à ce sujet – ce qu’il y a à faire exactement.',
    it: 'Una frase al riguardo – che cosa c’è da fare esattamente.',
    en: 'One sentence about it – what exactly needs doing.',
  },
  holders: {
    de: 'Wer das Amt hält, eine Person je Zeile. Die Kommentarzeichen entfernen, damit die Zeile zählt:',
    fr: 'Qui occupe la fonction, une personne par ligne. Retirez les marques de commentaire pour que la ligne compte :',
    it: 'Chi ricopre la carica, una persona per riga. Togli i segni di commento perché la riga valga:',
    en: 'Who holds the office, one person per line. Remove the comment marks so the line counts:',
  },
};

/**
 * Die leere Vorlage (UC-041 A8, Schritt 1).
 *
 * Was ausgefüllt werden soll, steht als sichtbarer Platzhalter; die Namen der
 * Besetzung stehen als Kommentar, weil ein stehengebliebenes «Vorname Name»
 * sonst einen Sitz belegen würde.
 */
export function officeTemplateMarkdown(lang: MarkdownLang = 'de'): string {
  return [
    `<!-- ${TEMPLATE_HINTS.file[lang]} -->`,
    '',
    `# ${TEMPLATE_HINTS.title[lang]}`,
    '',
    `## ${SECTIONS.why[lang]}`,
    '',
    TEMPLATE_HINTS.why[lang],
    '',
    `## ${SECTIONS.duties[lang]}`,
    '',
    `### ${TEMPLATE_HINTS.duty[lang]}`,
    '',
    TEMPLATE_HINTS.dutyDetail[lang],
    '',
    `## ${SECTIONS.facts[lang]}`,
    '',
    `- ${FIELDS.seats[lang]}: 1`,
    `- ${FIELDS.board[lang]}: ${NO[lang]}`,
    `- ${FIELDS.hours[lang]}: `,
    `- ${FIELDS.points[lang]}: `,
    `- ${FIELDS.compensation[lang]}: `,
    `- ${FIELDS.contact[lang]}: `,
    '',
    `## ${SECTIONS.holders[lang]}`,
    '',
    `<!-- ${TEMPLATE_HINTS.holders[lang]}`,
    `- Vorname Name (${SINCE[lang]} ${fileDateStamp()})`,
    `- Vorname Name (${INTERIM[lang]}) -->`,
    '',
  ].join('\n');
}

/** `<verein>-amt-<bezeichnung>-<datum>.md`, ohne Bezeichnung: alle Ämter. */
export function officeMarkdownFileName(
  clubSlug: string | null | undefined,
  title: string | null,
  today: Date = new Date(),
): string {
  const parts = [
    slugify(clubSlug) || 'club',
    title === null ? 'aemter' : 'amt',
    slugify(title),
    fileDateStamp(today),
  ].filter(Boolean);
  return `${parts.join('-')}.md`;
}

/** Text und Dateiname einer Ausgabe – ein Amt oder der ganze Verein. */
export function officeMarkdownDocument(input: {
  offices: readonly Office[];
  clubName?: string | null;
  clubSlug?: string | null;
  lang?: MarkdownLang;
  today?: Date;
}): { text: string; fileName: string } {
  const { offices, clubName = null, clubSlug = null, lang = 'de', today = new Date() } = input;
  const single = offices.length === 1 ? offices[0] : null;
  return {
    text: single
      ? officeToMarkdown(single, lang)
      : officesToMarkdown(offices, lang, clubName, today),
    fileName: officeMarkdownFileName(clubSlug, single ? single.title : null, today),
  };
}

// --- Lesen ------------------------------------------------------------------

/** Eine Person aus der Besetzung, wie sie in der Datei steht. */
export interface ParsedHolder {
  displayName: string;
  interim: boolean;
  since: string | null;
}

/**
 * Was die Datei **nennt** – und nur das. Ein fehlendes Feld ist keine
 * Aussage, kein leerer Wert (BR-256).
 */
export interface ParsedFields {
  why?: string;
  dutiesText?: string;
  hoursPerSeason?: string;
  pointsLabel?: string;
  seasonPoints?: number;
  maxHolders?: number;
  isBoard?: boolean;
  contactName?: string;
  holders?: ParsedHolder[];
}

export interface ParsedOffice {
  /** Die Kennung aus dem Kommentar – `null` bei einer Datei aus der Vorlage. */
  id: string | null;
  title: string;
  fields: ParsedFields;
  /** Überschriften, die zu keinem Abschnitt gehören: Sie gehen nicht mit. */
  unknownSections: string[];
}

interface RawSection {
  heading: string;
  lines: string[];
}

interface RawOffice {
  id: string | null;
  title: string;
  sections: RawSection[];
}

/**
 * Das Dokument in Ämter und Abschnitte zerlegen.
 *
 * Kommentare werden vorher durch Platzhalter ersetzt und dann entfernt – so
 * darf in der Vorlage überall ein Hinweis stehen, ohne dass er als Inhalt
 * gelesen wird. Aus dem Kommentar bleibt nur die Kennung des Amtes.
 */
function splitDocument(text: string): RawOffice[] {
  const comments: string[] = [];
  const cleaned = text
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, (match) => {
      comments.push(match);
      return ` ${comments.length - 1} `;
    });

  const offices: RawOffice[] = [];
  let current: RawOffice | null = null;
  let section: RawSection | null = null;

  for (const raw of cleaned.split('\n')) {
    const line = raw.replace(/ (\d+) /g, (_match, index: string) => {
      const id = readId(comments[Number(index)] ?? '');
      if (id && current && !current.id) current.id = id;
      return '';
    });

    const title = line.match(/^#[ \t]+(.*)$/);
    if (title) {
      current = { id: null, title: title[1].trim(), sections: [] };
      section = null;
      offices.push(current);
      continue;
    }
    // Was vor dem ersten Amt steht, ist Vorspann.
    if (!current) continue;

    const heading = line.match(/^##[ \t]+(.*)$/);
    if (heading) {
      section = { heading: heading[1].trim(), lines: [] };
      current.sections.push(section);
      continue;
    }
    if (section) section.lines.push(line);
  }

  return offices.filter((office) => office.title.length > 0);
}

/** Der Text eines Abschnitts: ohne Leerzeilen am Rand, mit Absätzen dazwischen. */
function sectionText(lines: readonly string[]): string {
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Eine Aufzählungszeile – «- », «* », «1. » – oder nichts. */
function bullet(line: string): string | null {
  const match = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
  return match ? match[1].trim() : null;
}

function parseBoolean(value: string): boolean | null {
  const word = norm(value);
  if (TRUE_WORDS.includes(word)) return true;
  if (FALSE_WORDS.includes(word)) return false;
  return null;
}

/** Die erste ganze Zahl im Text – «ca. 2 Personen» ergibt 2. */
function parseInteger(value: string): number | null {
  const match = value.match(/-?\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isInteger(parsed) ? parsed : null;
}

/** ISO oder Schweizer Schreibweise – alles andere ist kein Datum. */
function parseDate(value: string): string | null {
  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return inRange(iso[1], iso[2], iso[3]);
  const swiss = value.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (swiss) {
    return inRange(swiss[3], swiss[2].padStart(2, '0'), swiss[1].padStart(2, '0'));
  }
  return null;
}

function inRange(year: string, month: string, day: string): string | null {
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}-${month}-${day}`;
}

/**
 * Eine Zeile der Besetzung: «Anna Beispiel (seit 2024-06-01, ad interim)».
 *
 * Die Zusätze stehen in Klammern oder hinter einem Gedankenstrich. Abgetrennt
 * wird nur, was als Zusatz erkannt wird – «Anna-Lena Müller» bleibt ganz.
 */
export function parseHolderLine(entry: string): ParsedHolder | null {
  let rest = entry.trim();
  let interim = false;
  let since: string | null = null;

  const notes: string[] = [];
  const parens = rest.match(/\(([^)]*)\)\s*$/);
  if (parens) {
    rest = rest.slice(0, parens.index).trim();
    notes.push(...parens[1].split(/[,;·]/));
  } else {
    const tail = rest.match(/[–—-]\s*([^–—]+)$/);
    if (tail && isNote(tail[1])) {
      rest = rest.slice(0, tail.index).trim();
      notes.push(tail[1]);
    }
  }

  for (const note of notes) {
    if (isInterim(note)) {
      interim = true;
      continue;
    }
    const date = parseDate(note);
    if (date) since = date;
  }

  const displayName = rest.replace(/\s+/g, ' ').trim();
  return displayName.length > 0 ? { displayName, interim, since } : null;
}

function isInterim(note: string): boolean {
  // «a.i.» ohne Punkte ist «ai» – ein Wort, das sonst nirgends in einer
  // Klammer hinter einem Namen steht.
  const word = norm(note).replace(/\./g, '');
  return /(^|\s)(ad\s+)?interim(\s|$)/.test(word) || word === 'ai';
}

function isNote(note: string): boolean {
  const word = norm(note);
  return (
    isInterim(note) ||
    parseDate(note) !== null ||
    SINCE_WORDS.some((since) => word.startsWith(since))
  );
}

/** Die Pflichten eines Abschnitts als Text für das Formularfeld. */
function parseDutiesSection(lines: readonly string[]): string | undefined {
  const text = sectionText(lines);
  if (text.length === 0) return undefined;

  // «### Überschrift» und der Absatz darunter – die Form, die der Export
  // schreibt.
  if (/^###[ \t]+/m.test(text)) {
    const blocks: string[] = [];
    let title: string | null = null;
    let detail: string[] = [];
    const flush = () => {
      if (title === null) return;
      const body = detail.join(' ').replace(/\s+/g, ' ').trim();
      blocks.push(body ? `${title}\n${body}` : title);
      title = null;
      detail = [];
    };
    for (const line of text.split('\n')) {
      const heading = line.match(/^###[ \t]+(.*)$/);
      if (heading) {
        flush();
        title = heading[1].trim();
        continue;
      }
      if (title !== null && line.trim().length > 0) detail.push(line.trim());
    }
    flush();
    return blocks.length > 0 ? blocks.join('\n\n') : undefined;
  }

  // Eine Aufzählung: je Punkt eine Pflicht ohne Erläuterung.
  const bullets = text
    .split('\n')
    .map(bullet)
    .filter((entry): entry is string => Boolean(entry));
  if (bullets.length > 0 && bullets.length === text.split('\n').filter((l) => l.trim()).length) {
    return bullets.join('\n\n');
  }

  // Sonst die Absatzform des Formulars – so lässt sich ein Pflichtenheft aus
  // Word einfügen, ohne es umzubauen (`parseDuties()`).
  return dutiesToText(parseDuties(text));
}

function parseFactsSection(lines: readonly string[], fields: ParsedFields): void {
  for (const line of lines) {
    const entry = bullet(line) ?? line.trim();
    const pair = entry.match(/^(.+?)\s*[:：]\s*(.*)$/);
    if (!pair) continue;
    const key = matchKey(FIELDS, pair[1]);
    const value = pair[2].trim();
    // Ein leerer Wert ist keine Aussage – die Vorlage lässt Felder offen.
    if (!key || value.length === 0) continue;

    switch (key) {
      case 'seats': {
        const seats = parseInteger(value);
        if (seats !== null) fields.maxHolders = seats;
        break;
      }
      case 'board': {
        const board = parseBoolean(value);
        if (board !== null) fields.isBoard = board;
        break;
      }
      case 'hours':
        fields.hoursPerSeason = value;
        break;
      case 'points': {
        const points = parseInteger(value);
        if (points !== null) fields.seasonPoints = points;
        break;
      }
      case 'compensation':
        fields.pointsLabel = value;
        break;
      case 'contact':
        fields.contactName = value;
        break;
    }
  }
}

/**
 * Eine Datei lesen: null, ein oder viele Ämter.
 *
 * Wirft nie. Was nicht zu deuten ist, fehlt im Ergebnis oder steht in
 * `unknownSections` – ein Einlesen darf nicht daran scheitern, dass jemand
 * einen eigenen Abschnitt angefügt hat.
 */
export function parseOfficeMarkdown(text: string): ParsedOffice[] {
  return splitDocument(text).map((raw) => {
    const fields: ParsedFields = {};
    const unknownSections: string[] = [];

    for (const section of raw.sections) {
      const key = matchKey(SECTIONS, section.heading);
      if (!key) {
        if (sectionText(section.lines).length > 0) unknownSections.push(section.heading);
        continue;
      }
      switch (key) {
        case 'why': {
          const why = sectionText(section.lines);
          if (why.length > 0) fields.why = why;
          break;
        }
        case 'duties': {
          const duties = parseDutiesSection(section.lines);
          if (duties) fields.dutiesText = duties;
          break;
        }
        case 'facts':
          parseFactsSection(section.lines, fields);
          break;
        case 'holders': {
          const holders = section.lines
            .map((line) => bullet(line))
            .filter((entry): entry is string => Boolean(entry))
            .map(parseHolderLine)
            .filter((holder): holder is ParsedHolder => holder !== null);
          if (holders.length > 0) fields.holders = holders;
          break;
        }
      }
    }

    return { id: raw.id, title: raw.title, fields, unknownSections };
  });
}

// --- Zuordnen ---------------------------------------------------------------

/** Welche Angaben eine Datei ändert – für die Rückfrage vor dem Speichern. */
export type OfficeImportField =
  | 'title'
  | 'why'
  | 'duties'
  | 'hours'
  | 'points'
  | 'compensation'
  | 'seats'
  | 'board'
  | 'contact'
  | 'holders';

/** Ein Hinweis zur Zuordnung – kein Fehler, aber etwas, das man sehen muss. */
export type OfficeImportNote = 'ambiguousTitle' | 'unknownId';

export interface OfficeImportEntry {
  /** Das Amt, das die Datei meint – `null` heisst: ein neues. */
  office: Office | null;
  title: string;
  draft: OfficeDraft;
  changes: OfficeImportField[];
  unknownSections: string[];
  /** Was `save_office()` zurückweisen würde – geprüft, bevor es dorthin geht. */
  problems: OfficeProblem[];
  note: OfficeImportNote | null;
  /** Ob der Eintrag gespeichert werden darf. */
  importable: boolean;
}

interface MemberLike {
  id: string;
  display_name: string;
}

/** Ein Mitglied zu einem Namen – nur, wenn genau eines so heisst. */
function findMember(members: readonly MemberLike[], name: string): MemberLike | null {
  const wanted = norm(name);
  const hits = members.filter((member) => norm(member.display_name) === wanted);
  return hits.length === 1 ? hits[0] : null;
}

function toHolderDrafts(
  parsed: readonly ParsedHolder[],
  target: Office | null,
  members: readonly MemberLike[],
): OfficeHolderDraft[] {
  const used = new Set<string>();
  return parsed.map((holder) => {
    // Derselbe Name am selben Amt ist derselbe Sitz: Die Kennung bleibt, und
    // damit bleibt, was an ihr hängt (`since`, die Verknüpfung zum Konto).
    const existing =
      target?.holders.find(
        (candidate) =>
          !used.has(candidate.id) && norm(candidate.displayName) === norm(holder.displayName),
      ) ?? null;
    if (existing) used.add(existing.id);

    const member = existing?.memberId
      ? null
      : findMember(members, holder.displayName);

    return {
      id: existing?.id ?? null,
      memberId: existing?.memberId ?? member?.id ?? null,
      displayName: holder.displayName,
      interim: holder.interim,
      // Was die Datei sagt, gilt; sonst bleibt, was am Sitz steht.
      since: holder.since ?? existing?.since ?? null,
    };
  });
}

function sameHolders(a: readonly OfficeHolderDraft[], b: readonly OfficeHolderDraft[]): boolean {
  const key = (holders: readonly OfficeHolderDraft[]) =>
    holders
      .map((holder) => `${norm(holder.displayName)}|${holder.interim}|${holder.since ?? ''}`)
      .join('¶');
  return key(a) === key(b);
}

/**
 * Was die Datei mit den Ämtern des Vereins macht (UC-041 A8, Schritt 3).
 *
 * Zugeordnet wird über die Kennung; fehlt sie, über die Bezeichnung. Tragen
 * **zwei** Ämter dieselbe Bezeichnung – ein Co-Präsidium ist genau das –,
 * bleibt der Eintrag liegen: Ein Blindschuss auf eines der beiden wäre
 * schlimmer als eine Rückfrage.
 *
 * Gelöscht wird nie. Ein Amt, das die Datei nicht nennt, bleibt unberührt.
 */
export function planOfficeImport(
  parsed: readonly ParsedOffice[],
  offices: readonly Office[],
  members: readonly MemberLike[] = [],
): OfficeImportEntry[] {
  return parsed.map((entry) => {
    const byId = entry.id ? (offices.find((office) => office.id === entry.id) ?? null) : null;
    const byTitle = offices.filter((office) => norm(office.title) === norm(entry.title));
    const unknownId = entry.id !== null && byId === null;
    const ambiguous = byId === null && byTitle.length > 1;
    const target = byId ?? (byTitle.length === 1 ? byTitle[0] : null);

    const base: OfficeDraft = target
      ? officeToDraft(target)
      : { ...EMPTY_OFFICE_DRAFT, holders: [] };
    const fields = entry.fields;

    const holders = fields.holders
      ? toHolderDrafts(fields.holders, target, members)
      : base.holders;

    // Die Ansprechperson: Der Name in der Datei entscheidet über die
    // Verknüpfung. Ein Mitglied dieses Namens wird verknüpft; steht dort
    // jemand ohne Konto, bleibt der Name allein stehen – und wer nichts
    // schreibt, ändert nichts.
    const contactName = fields.contactName ?? base.contactName;
    const contactMemberId = !fields.contactName
      ? base.contactMemberId
      : (findMember(members, fields.contactName)?.id ??
        (norm(base.contactName) === norm(contactName) ? base.contactMemberId : null));

    const draft: OfficeDraft = {
      title: entry.title,
      why: fields.why ?? base.why,
      dutiesText: fields.dutiesText ?? base.dutiesText,
      hoursPerSeason: fields.hoursPerSeason ?? base.hoursPerSeason,
      pointsLabel: fields.pointsLabel ?? base.pointsLabel,
      seasonPoints: fields.seasonPoints ?? base.seasonPoints,
      maxHolders: fields.maxHolders ?? base.maxHolders,
      isBoard: fields.isBoard ?? base.isBoard,
      contactMemberId,
      contactName,
      holders,
    };

    const changes: OfficeImportField[] = [];
    if (target && norm(base.title) !== norm(draft.title)) changes.push('title');
    if (base.why.trim() !== draft.why.trim()) changes.push('why');
    if (base.dutiesText.trim() !== draft.dutiesText.trim()) changes.push('duties');
    if (base.hoursPerSeason.trim() !== draft.hoursPerSeason.trim()) changes.push('hours');
    if (base.seasonPoints !== draft.seasonPoints) changes.push('points');
    if (base.pointsLabel.trim() !== draft.pointsLabel.trim()) changes.push('compensation');
    if (base.maxHolders !== draft.maxHolders) changes.push('seats');
    if (base.isBoard !== draft.isBoard) changes.push('board');
    if (base.contactName.trim() !== draft.contactName.trim()) changes.push('contact');
    if (!sameHolders(base.holders, draft.holders)) changes.push('holders');

    const problems = validateOffice(draft);

    return {
      office: target,
      title: entry.title,
      draft,
      changes,
      unknownSections: entry.unknownSections,
      problems,
      note: ambiguous ? 'ambiguousTitle' : unknownId ? 'unknownId' : null,
      importable: !ambiguous && problems.length === 0,
    };
  });
}

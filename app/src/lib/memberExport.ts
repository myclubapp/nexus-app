import { toCsv } from './csv';
import { formatDate } from './format';

/**
 * Die Mitgliederliste als Datei (UC-043, FR-130).
 *
 * Der Aufbau folgt dem `ExportService` der bestehenden myclub-App: dieselben
 * wählbaren Felder (E-Mail, Telefon, Geburtsdatum, Adresse, Teams,
 * Funktionen), dieselbe Reihenfolge, dieselbe Voreinstellung. Zwei Dinge sind
 * anders, und beide mit Absicht:
 *
 * 1. **CSV statt XLSX.** Die alte App schreibt `.xlsx` über `xlsx` (SheetJS).
 *    Die Bibliothek wiegt rund 430 kB – der Hauptchunk dieser App liegt schon
 *    ohne sie über der PWA-Precache-Grenze. UC-042 exportiert die
 *    Beitragsliste seit dem 14.09.2026 als CSV; ein zweites Dateiformat für
 *    dieselbe Sorte Liste wäre eine zweite Art, dasselbe zu tun.
 * 2. **Die Postleitzahl ist Text.** In der alten App war `postalcode` eine
 *    Zahl; daran sterben führende Nullen (D-01067 Dresden).
 *
 * Reine Funktionen: Der Verein hat höchstens ein paar hundert Mitglieder
 * (NFR-002), und so ist der Aufbau der Datei prüfbar, ohne eine Datei zu
 * schreiben.
 */

/** Eine Zeile, wie `export_members()` sie liefert. */
export interface MemberExportRow {
  member_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  role: string;
  status: string;
  member_since: string | null;
  teams: string | null;
  offices: string | null;
}

/** Was mitgeht. Name, Rolle und Status stehen immer – ohne sie ist es keine Liste. */
export interface MemberExportOptions {
  email: boolean;
  phone: boolean;
  birthDate: boolean;
  address: boolean;
  teams: boolean;
  offices: boolean;
}

/**
 * Die Voreinstellung der alten App: alles ausser den Teams.
 *
 * Dort war «Teams» aus, weil die Zuordnung je Mitglied einzeln nachgeladen
 * werden musste. Hier kostet sie nichts – die Voreinstellung bleibt trotzdem,
 * weil eine Spalte mit fünf Teamnamen die Datei breit macht und die meisten
 * Exporte dem Kassier dienen, nicht der Kaderplanung.
 */
export const DEFAULT_MEMBER_EXPORT_OPTIONS: MemberExportOptions = {
  email: true,
  phone: true,
  birthDate: true,
  address: true,
  teams: false,
  offices: true,
};

/** Die Felder, die das Blatt zur Auswahl stellt – in der Reihenfolge der Spalten. */
export const MEMBER_EXPORT_FIELDS: readonly (keyof MemberExportOptions)[] = [
  'email',
  'phone',
  'birthDate',
  'address',
  'teams',
  'offices',
];

/**
 * Die Felder, die wirklich in die Datei gehen.
 *
 * Was `export_members()` einer Trainer:in ohnehin leer liefert (Adresse,
 * Geburtsdatum – BR-206), soll auch keine Spalte bekommen: Fünf leere Spalten
 * sind kein Datenschutz, sondern eine Datei, die etwas verspricht und nichts
 * hält. Die Auswahl im Blatt blendet dieselben Felder aus; diese Funktion ist
 * der Riegel dahinter, damit Anzeige und Datei nicht auseinanderlaufen.
 */
export function effectiveExportOptions(
  options: MemberExportOptions,
  isFullScope: boolean,
): MemberExportOptions {
  if (isFullScope) return options;
  return { ...options, address: false, birthDate: false };
}

/**
 * Die Spaltenköpfe, übersetzt.
 *
 * `labels` kommt aus i18n – die Datenbank kennt keine Benutzertexte (C-009),
 * und wer auf Französisch exportiert, bekommt französische Köpfe.
 */
export interface MemberExportLabels {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  birthDate: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  role: string;
  status: string;
  memberSince: string;
  teams: string;
  offices: string;
}

export function memberExportHeader(
  options: MemberExportOptions,
  labels: MemberExportLabels,
): string[] {
  const header = [labels.firstName, labels.lastName, labels.displayName];
  if (options.email) header.push(labels.email);
  if (options.phone) header.push(labels.phone);
  if (options.birthDate) header.push(labels.birthDate);
  if (options.address) {
    header.push(labels.street, labels.houseNumber, labels.postalCode, labels.city, labels.country);
  }
  header.push(labels.role, labels.status, labels.memberSince);
  if (options.teams) header.push(labels.teams);
  if (options.offices) header.push(labels.offices);
  return header;
}

/**
 * Eine Zeile in Zellen.
 *
 * `roleLabel` und `statusLabel` übersetzen die beiden Aufzählungen; die
 * Datenbank liefert `admin` und `passive`, die Datei soll «Vorstand» und
 * «Passiv» tragen.
 */
export function memberExportRow(
  row: MemberExportRow,
  options: MemberExportOptions,
  translate: { role: (value: string) => string; status: (value: string) => string },
): string[] {
  const cells = [row.first_name ?? '', row.last_name ?? '', row.display_name];
  if (options.email) cells.push(row.email ?? '');
  if (options.phone) cells.push(row.phone ?? '');
  if (options.birthDate) cells.push(row.birth_date ? formatDate(row.birth_date) : '');
  if (options.address) {
    cells.push(
      row.street ?? '',
      row.house_number ?? '',
      row.postal_code ?? '',
      row.city ?? '',
      row.country ?? '',
    );
  }
  cells.push(
    translate.role(row.role),
    translate.status(row.status),
    row.member_since ? formatDate(row.member_since) : '',
  );
  if (options.teams) cells.push(row.teams ?? '');
  if (options.offices) cells.push(row.offices ?? '');
  return cells;
}

/** Kopfzeile und Zeilen zur fertigen CSV. */
export function memberExportCsv(
  rows: readonly MemberExportRow[],
  options: MemberExportOptions,
  labels: MemberExportLabels,
  translate: { role: (value: string) => string; status: (value: string) => string },
): string {
  return toCsv(
    memberExportHeader(options, labels),
    rows.map((row) => memberExportRow(row, options, translate)),
  );
}

/**
 * Der Dateiname: `<verein>-mitglieder-<datum>.csv`, mit dem Team dazwischen,
 * wenn nur ein Team exportiert wird.
 *
 * Alles ausser Buchstaben, Ziffern und Bindestrich fällt weg – ein Teamname
 * wie «Herren 1 / A» darf keinen Pfad aufmachen. Die alte App hat dafür
 * `replace(/[^a-zA-Z0-9]/g, "_")` benutzt; Umlaute wurden dort zu
 * Unterstrichen, hier werden sie aufgelöst.
 */
export function memberExportFileName(
  clubSlug: string | null | undefined,
  teamName: string | null | undefined,
  today: Date = new Date(),
): string {
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const parts = [slug(clubSlug) || 'club', 'mitglieder', slug(teamName), date].filter(Boolean);
  return `${parts.join('-')}.csv`;
}

function slug(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    // Kombinierende Zeichen: aus «ü» wird «u», nicht «_».
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

import type { MemberRole } from './database.types';

/** `club_members.status` – Constraint aus `0001_core.sql`. */
export type MemberStatus = 'active' | 'passive' | 'honorary' | 'left';

/** Rollen, die der Vorstand vergeben kann. `superadmin` ist keine davon. */
export const ASSIGNABLE_ROLES: readonly Extract<
  MemberRole,
  'member' | 'trainer' | 'sportchef' | 'admin'
>[] = ['member', 'trainer', 'sportchef', 'admin'];

/**
 * Trägt diese Rolle einen Bereich (Vision §4)?
 *
 * Nur die Sportchef:in. Ein Bereich ist ein Wort an Team und Person – kein
 * Objekt, das jemand verwalten müsste (0059).
 */
export function hasArea(role: MemberRole | null | undefined): boolean {
  return role === 'sportchef';
}

export const MEMBER_STATUSES: readonly MemberStatus[] = [
  'active',
  'passive',
  'honorary',
  'left',
];

export interface MemberFilter {
  search: string;
  teamId: string | null;
  role: MemberRole | null;
  status: MemberStatus | null;
}

export const EMPTY_MEMBER_FILTER: MemberFilter = {
  search: '',
  teamId: null,
  role: null,
  status: null,
};

export interface FilterableMember {
  id: string;
  display_name: string;
  role: string;
  status: string;
  teamIds: string[];
}

/**
 * Mitgliederliste filtern und sortieren (Schritt 2, A4).
 *
 * Reine Funktion: Der Verein hat höchstens ein paar hundert Mitglieder
 * (NFR-002), das Filtern lohnt keine zweite Abfrage – und so ist es prüfbar,
 * obwohl sich Ionic-Eingaben im Test nicht bedienen lassen.
 */
export function filterMembers<T extends FilterableMember>(
  members: readonly T[],
  filter: MemberFilter,
): T[] {
  const needle = filter.search.trim().toLocaleLowerCase();

  return members
    .filter((member) => {
      if (needle && !member.display_name.toLocaleLowerCase().includes(needle)) {
        return false;
      }
      if (filter.role && member.role !== filter.role) return false;
      if (filter.status && member.status !== filter.status) return false;
      if (filter.teamId && !member.teamIds.includes(filter.teamId)) return false;
      return true;
    })
    // Schritt 2 verlangt die Sortierung nach Name. `localeCompare` bringt
    // Umlaute an die Stelle, an der sie im Deutschen erwartet werden.
    .sort((a, b) => a.display_name.localeCompare(b.display_name, 'de'));
}

/**
 * Der Filter im Mitglieder-Wähler (`MemberPicker`): Suche und **beliebig
 * viele** Teams. Die Mitgliederliste kennt nur ein Team, weil ihr Export an
 * genau einem hängt (BR-205); beim Auswählen gibt es diese Grenze nicht.
 */
export interface MemberPickFilter {
  search: string;
  /** Leer heisst: alle Teams – und auch, wer in keinem ist. */
  teamIds: readonly string[];
}

export const EMPTY_MEMBER_PICK_FILTER: MemberPickFilter = { search: '', teamIds: [] };

/**
 * Die Mitglieder, die der Wähler anbietet – sortiert wie die Mitgliederliste.
 *
 * Mehrere Teams verbinden sich mit «oder»: Wer in einem der gewählten Teams
 * ist, steht in der Liste. «Und» ergäbe bei zwei Teams fast immer eine leere
 * Liste, und niemand sucht «die, die in beiden spielen».
 */
export function pickableMembers<T extends FilterableMember>(
  members: readonly T[],
  filter: MemberPickFilter,
): T[] {
  const inTeams =
    filter.teamIds.length === 0
      ? members
      : members.filter((member) =>
          member.teamIds.some((teamId) => filter.teamIds.includes(teamId)),
        );
  return filterMembers(inTeams, { ...EMPTY_MEMBER_FILTER, search: filter.search });
}

/** Ist die Person die einzige mit Vorstandsrechten (BR-026)? */
export function isLastAdmin(
  members: readonly FilterableMember[],
  memberId: string,
): boolean {
  const admins = members.filter(
    (member) =>
      (member.role === 'admin' || member.role === 'superadmin') &&
      member.status !== 'left',
  );
  return admins.length === 1 && admins[0]?.id === memberId;
}

/**
 * Initialen für den Avatar ohne Bild (S1 der Prüfung vom 2026-09-11).
 *
 * Die bestehende myclub-App zeigt in jeder Personenzeile einen Avatar; ohne
 * Bild stand dort eine graue Silhouette. Initialen sagen mehr: Zwei Buchstaben
 * unterscheiden zwei Personen, eine Silhouette nicht. Erster und letzter
 * Namensteil, höchstens zwei Zeichen, Grossbuchstaben – und bei einem leeren
 * Namen ein Fragezeichen statt eines leeren Kreises.
 */
export function initials(displayName: string | null | undefined): string {
  const parts = (displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * Vorname für die Anrede auf dem Startscreen.
 *
 * Die App duzt – und wer duzt, grüsst mit dem Vornamen: «Hallo Sandro», nicht
 * «Hallo Sandro Scalco». Ein eigenes Feld gibt es nicht: `display_name` ist
 * ein String, der Altbestand fügt Vor- und Nachname mit Leerzeichen zusammen
 * (0071). Also der erste Namensteil; Bindestriche bleiben («Jean-Luc»), ein
 * zweiter Vorname fällt weg. Ohne Namen bleibt die Anrede leer.
 */
export function firstName(displayName: string | null | undefined): string {
  return (displayName ?? '').trim().split(/\s+/)[0] ?? '';
}

/** Die Adressfelder aus `member_contacts` (0081). */
export interface PostalAddress {
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
}

/**
 * Die Adresse als Zeilen, wie sie auf einem Briefumschlag stehen (BR-207).
 *
 * Zeile 1 Strasse und Hausnummer, Zeile 2 Postleitzahl und Ort, Zeile 3 das
 * Land – und zwar nur, wenn eines eingetragen ist. Kein «CH-» vor die
 * Postleitzahl: Ob das Land fremd ist, weiss diese Funktion nicht, und ein
 * Länderkürzel vor der eigenen Postleitzahl ist in der Schweiz falsch.
 *
 * Leere Zeilen fallen weg. Ohne jede Angabe kommt eine leere Liste zurück –
 * die Ansicht zeigt dann gar nichts, nicht eine leere Zeile.
 */
export function addressLines(address: PostalAddress): string[] {
  const lines = [
    [address.street, address.houseNumber].map(clean).filter(Boolean).join(' '),
    [address.postalCode, address.city].map(clean).filter(Boolean).join(' '),
    clean(address.country),
  ];
  return lines.filter((line) => line.length > 0);
}

function clean(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/**
 * Was an den Stammdaten nicht stimmt (UC-043, FR-163).
 *
 * Die Datenbank hat für alle drei Felder einen `check` (0081). Ohne diese
 * Prüfung erführe die Person davon erst als roher Postgres-Fehler im Toast –
 * «new row violates check constraint» ist keine Antwort auf «warum geht das
 * nicht?». Reine Funktion, damit die Entscheidung nicht im Ereignis-Handler
 * steckt (guidelines §9).
 */
export type ProfileProblem = 'countryCode' | 'firstNameLong' | 'lastNameLong';

export const NAME_MAX = 80;

export function validateProfileFields(input: {
  firstName: string;
  lastName: string;
  country: string;
}): ProfileProblem[] {
  const problems: ProfileProblem[] = [];
  // Zwei Buchstaben oder gar nichts – ein einzelnes «C» ist kein Land.
  const country = input.country.trim();
  if (country && !/^[A-Za-z]{2}$/.test(country)) problems.push('countryCode');
  if (input.firstName.trim().length > NAME_MAX) problems.push('firstNameLong');
  if (input.lastName.trim().length > NAME_MAX) problems.push('lastNameLong');
  return problems;
}

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

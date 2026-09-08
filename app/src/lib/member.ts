import type { MemberRole } from './database.types';

/** `club_members.status` – Constraint aus `0001_core.sql`. */
export type MemberStatus = 'active' | 'passive' | 'honorary' | 'left';

/** Rollen, die der Vorstand vergeben kann. `superadmin` ist keine davon. */
export const ASSIGNABLE_ROLES: readonly Extract<
  MemberRole,
  'member' | 'trainer' | 'admin'
>[] = ['member', 'trainer', 'admin'];

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

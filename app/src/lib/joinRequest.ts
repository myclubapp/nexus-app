import type { MemberRole } from './database.types';

/** Zustand einer Beitritts-Anfrage – Constraint aus `0010_join_requests.sql`. */
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

/** Rollen, die der Vorstand bei einer Aufnahme vergeben kann (BR-011, BR-015). */
export const DECIDABLE_ROLES: readonly Extract<
  MemberRole,
  'member' | 'trainer' | 'admin'
>[] = ['member', 'trainer', 'admin'];

/**
 * Kurznamen für die Suche vereinheitlichen.
 *
 * Der Verein nennt seinen Kurznamen mündlich oder auf Papier; getippt kommt er
 * mit Grossbuchstaben, Leerzeichen oder einer vollständigen Adresse zurück.
 * `find_club_by_slug()` vergleicht exakt – ohne diese Aufbereitung findet die
 * Suche den Verein nur bei perfekter Eingabe.
 */
export function normaliseClubSlug(input: string): string {
  const trimmed = input.trim().toLowerCase();
  // Wer den ganzen Link kopiert, meint das letzte Pfadsegment.
  const withoutUrl = trimmed.replace(/^https?:\/\/[^/]+\//, '').replace(/\/+$/, '');
  const lastSegment = withoutUrl.split('/').pop() ?? '';
  return lastSegment.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export interface JoinDecision {
  approve: boolean;
  role: (typeof DECIDABLE_ROLES)[number];
  teamId: string | null;
}

/**
 * Was der Entscheid an die Datenbank übergibt.
 *
 * Eine Ablehnung trägt weder Rolle noch Team – sonst stünde im Aufruf eine
 * Rolle, die niemand bekommt, und BR-016 (keine gespeicherte Begründung) wäre
 * schwerer zu halten. Reine Funktion, weil Ionic-Eingaben im Test nicht
 * bedienbar sind (docs/TESTING.md).
 */
export function resolveJoinDecision(decision: JoinDecision): {
  approve: boolean;
  role: string | null;
  teamId: string | null;
} {
  if (!decision.approve) {
    return { approve: false, role: null, teamId: null };
  }
  return {
    // BR-015: Ohne abweichende Wahl wird die Person Mitglied.
    role: DECIDABLE_ROLES.includes(decision.role) ? decision.role : 'member',
    approve: true,
    teamId: decision.teamId,
  };
}

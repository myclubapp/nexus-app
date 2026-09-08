import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import type { Invite, InviteRole, Team } from '../lib/database.types';
import { useClub } from './useClub';

/** Vorbelegung des Einladungsformulars (UC-003, Schritt 2). */
const INVITE_DEFAULT_DAYS = 14;

/**
 * «Unbegrenzt» als Zahl. `invites.max_uses` ist `not null`, ein leeres Feld
 * gibt es dort nicht – diese Schranke steht deshalb für «ohne Grenze» und
 * wird beim Anzeigen wieder als solche gelesen.
 */
export const INVITE_UNLIMITED_USES = 1_000_000;
export const INVITE_ROLES: readonly InviteRole[] = ['member', 'trainer', 'admin'];

/**
 * Kennung statt fertigem Text: Der Hook kennt die Sprache der Person nicht,
 * die Seite übersetzt sie beim Anzeigen.
 */
export const INVALID_EXPIRY = 'invite.expiresRequired';

export interface CreateInviteInput {
  teamId: string | null;
  role: InviteRole;
  /** Ablaufdatum als `YYYY-MM-DD`. */
  expiresOn: string;
  /** Höchstzahl Einlösungen; `null` heisst unbegrenzt. */
  maxUses: number | null;
}

/** Ablaufdatum der Vorbelegung: in 14 Tagen. */
export function defaultInviteExpiry(today: Date = new Date()): string {
  const date = new Date(today);
  date.setDate(date.getDate() + INVITE_DEFAULT_DAYS);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** Ist die Einladung heute noch einlösbar? Gegenstück zu `preview_invite()`. */
export function isInviteActive(invite: Invite, now: Date = new Date()): boolean {
  return (
    invite.revoked_at === null &&
    new Date(invite.expires_at).getTime() >= now.getTime() &&
    invite.uses < invite.max_uses
  );
}

/**
 * Einladungen des Vereins.
 *
 * Nur der Vorstand darf lesen – das erzwingt die Policy `invites_admin`, nicht
 * dieser Hook. Das `enabled` hier spart die Abfrage, die ohnehin leer käme.
 */
export function useInvites() {
  const { activeClub, isAdmin } = useClub();

  return useQuery({
    queryKey: ['invites', activeClub?.id],
    enabled: Boolean(activeClub) && isAdmin && isConfigured,
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('club_id', activeClub!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/** Teams des Vereins, für den Geltungsbereich einer Einladung. */
export function useTeams() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['teams', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<Team[]> => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('club_id', activeClub!.id)
        .order('name');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

/**
 * Einladung erstellen (UC-003).
 *
 * Der Code entsteht in der Datenbank (`gen_random_bytes`), nicht hier: Ein im
 * Client erzeugtes Geheimnis wäre nur so gut wie der Zufallsgenerator des
 * WebViews (BR-010).
 */
export function useCreateInvite() {
  const queryClient = useQueryClient();
  const { activeClub, activeMembership } = useClub();

  return useMutation({
    mutationFn: async (input: CreateInviteInput): Promise<Invite> => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      // Ohne diese Prüfung ergäbe `new Date('T23:59:59')` ein ungültiges Datum
      // und `toISOString()` würfe einen RangeError, dessen Meldung niemandem
      // sagt, welches Feld gemeint ist.
      const expiresAt = new Date(`${input.expiresOn}T23:59:59`);
      if (Number.isNaN(expiresAt.getTime())) {
        throw new Error(INVALID_EXPIRY);
      }

      const { data, error } = await supabase
        .from('invites')
        .insert({
          club_id: activeClub.id,
          team_id: input.teamId,
          role: input.role,
          // Bis zum Ende des gewählten Tages, nicht bis Mitternacht davor.
          expires_at: expiresAt.toISOString(),
          max_uses: input.maxUses ?? INVITE_UNLIMITED_USES,
          created_by: activeMembership?.id ?? null,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invites', activeClub?.id] });
    },
  });
}

/**
 * Einladung widerrufen (UC-003 A1).
 *
 * BR-012: Der Widerruf verhindert weitere Einlösungen und entzieht keine
 * bereits erteilte Mitgliedschaft. Deshalb ein Vermerk statt einer Löschung.
 */
export function useRevokeInvite() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', inviteId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invites', activeClub?.id] });
    },
  });
}

export interface InvitePreview {
  clubId: string | null;
  clubName: string | null;
  teamName: string | null;
  role: string | null;
  isValid: boolean;
  /** `unknown`, `revoked`, `expired` oder `exhausted`; `null`, wenn gültig. */
  reason: string | null;
}

/**
 * Einladung ansehen, bevor sie eingelöst wird (UC-002, Schritt 2).
 *
 * Läuft über eine `security definer`-Funktion, weil die Policy auf `invites`
 * nur den Vorstand lesen lässt – der Gast ist zu diesem Zeitpunkt noch nicht
 * einmal Mitglied.
 */
export function useInvitePreview(code: string | undefined) {
  return useQuery({
    queryKey: ['invite-preview', code],
    enabled: Boolean(code) && isConfigured,
    queryFn: async (): Promise<InvitePreview> => {
      const { data, error } = await supabase.rpc('preview_invite', {
        p_code: code!,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      if (!row) {
        return {
          clubId: null,
          clubName: null,
          teamName: null,
          role: null,
          isValid: false,
          reason: 'unknown',
        };
      }

      return {
        clubId: row.club_id,
        clubName: row.club_name,
        teamName: row.team_name,
        role: row.role,
        isValid: row.is_valid,
        reason: row.reason,
      };
    },
  });
}

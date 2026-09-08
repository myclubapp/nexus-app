import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import type { ClubKind } from '../lib/database.types';
import { useClub } from './useClub';

export interface CreateClubInput {
  name: string;
  kind: ClubKind;
  /** Saisonbeginn als `YYYY-MM-DD`. */
  seasonStart: string;
  /** Eigene Bezeichnung, wenn die Vereinsart «Anderes» ist. */
  kindLabel?: string;
}

/**
 * Verein gründen (UC-001).
 *
 * Die Datenbankfunktion erledigt alles in einer Transaktion: Verein,
 * eindeutiger Kurzname, Mitgliedschaft als Vorstand, Punkteregeln und
 * Terminlabels. Bräche der Client das in mehrere Aufrufe auf, entstünde bei
 * einem Abbruch ein Verein ohne Vorstand.
 */
export function useCreateClub() {
  const queryClient = useQueryClient();
  const { setActiveClub } = useClub();

  return useMutation({
    mutationFn: async (input: CreateClubInput): Promise<string> => {
      const { data, error } = await supabase.rpc('create_club', {
        p_name: input.name.trim(),
        p_club_kind: input.kind,
        p_season_start: input.seasonStart || null,
        p_kind_label: input.kindLabel?.trim() || null,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Der Verein wurde nicht angelegt.');
      return data as string;
    },
    onSuccess: async (clubId) => {
      // Der frisch gegründete Verein wird der aktive – sonst entscheidet die
      // Reihenfolge der Mitgliedschaften, welchen die App anzeigt (A3).
      setActiveClub(clubId);
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });
}

/**
 * Einladung einlösen (UC-002).
 *
 * Der Code ist die Berechtigung; eine zusätzliche Freigabe findet nicht statt
 * (BR-006).
 */
export function useRedeemInvite() {
  const queryClient = useQueryClient();
  const { setActiveClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      code: string;
      displayName?: string;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('redeem_invite', {
        p_code: input.code.trim(),
        p_display_name: input.displayName?.trim() || null,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Die Einladung konnte nicht eingelöst werden.');
      return data as string;
    },
    onSuccess: async (clubId) => {
      // Wer gerade beigetreten ist, will diesen Verein sehen – nicht den, der
      // alphabetisch zuerst kommt.
      setActiveClub(clubId);
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });
}

/**
 * Ist der Verein frisch gegründet?
 *
 * Die Spezifikation nennt den Startbildschirm nach der Gründung, nennt aber
 * keine Bedingung, wie lange er steht. Angenommen: solange der Verein noch
 * keinen Termin hat und niemand ausser der Gründerin Mitglied ist. Beides
 * verschwindet, sobald der Verein loslegt – ein Datum wäre willkürlich.
 */
export function useIsNewClub() {
  const { activeClub, isAdmin } = useClub();

  return useQuery({
    queryKey: ['club-is-new', activeClub?.id],
    enabled: Boolean(activeClub) && isAdmin && isConfigured,
    queryFn: async (): Promise<boolean> => {
      const [events, members] = await Promise.all([
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', activeClub!.id),
        supabase
          .from('club_members')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', activeClub!.id)
          .neq('status', 'left'),
      ]);

      if (events.error) throw new Error(events.error.message);
      if (members.error) throw new Error(members.error.message);

      return (events.count ?? 0) === 0 && (members.count ?? 0) <= 1;
    },
  });
}

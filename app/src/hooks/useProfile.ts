import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import { useClub } from './useClub';

export interface MyProfile {
  displayName: string;
  email: string | null;
  phone: string | null;
  emailPublic: boolean;
  phonePublic: boolean;
  leaderboardOptIn: boolean;
}

/**
 * Das eigene Profil im aktiven Verein.
 *
 * Gelesen wird über `club_directory`: Dieselbe Sicht, die anderen Mitgliedern
 * die verborgenen Felder vorenthält, gibt der Person ihre eigenen heraus – so
 * gibt es nur einen Weg zu den Kontaktangaben.
 */
export function useMyProfile() {
  const { activeMembership } = useClub();

  return useQuery({
    queryKey: ['my-profile', activeMembership?.id],
    enabled: Boolean(activeMembership) && isConfigured,
    queryFn: async (): Promise<MyProfile> => {
      const { data, error } = await supabase
        .from('club_directory')
        .select('display_name, email, phone')
        .eq('member_id', activeMembership!.id)
        .single();
      if (error) throw new Error(error.message);

      const privacy = (activeMembership!.privacy ?? {}) as Record<string, boolean>;
      return {
        displayName: data.display_name ?? '',
        email: data.email,
        phone: data.phone,
        emailPublic: privacy.email === true,
        phonePublic: privacy.phone === true,
        leaderboardOptIn: activeMembership!.leaderboard_opt_in,
      };
    },
  });
}

export interface ProfilePatch {
  displayName?: string;
  email?: string;
  phone?: string;
  emailPublic?: boolean;
  phonePublic?: boolean;
}

/**
 * Profil und Sichtbarkeit speichern (Schritt 3–7).
 *
 * Angabe und Sichtbarkeit gehen in einem Aufruf: Wer eine Nummer einträgt und
 * gleichzeitig verbirgt, soll sie nicht für einen Moment freigeben.
 */
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  const { activeMembership, activeClub } = useClub();

  return useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      if (!activeMembership) throw new Error('Kein aktives Mitglied');

      const { error } = await supabase.rpc('update_my_profile', {
        p_member_id: activeMembership.id,
        p_display_name: patch.displayName,
        p_email: patch.email,
        p_phone: patch.phone,
        p_email_public: patch.emailPublic,
        p_phone_public: patch.phonePublic,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      // Der Anzeigename steckt in der Mitgliedschaft und in jeder Liste.
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
      await queryClient.invalidateQueries({ queryKey: ['members', activeClub?.id] });
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

/**
 * Teilnahme an Ranglisten (A1, FR-020, BR-029).
 *
 * Der Ausstieg entfernt die Person aus jeder Rangliste; Punkte werden weiter
 * gebucht und im eigenen Dashboard gezeigt.
 */
export function useLeaderboardOptIn() {
  const queryClient = useQueryClient();
  const { activeMembership } = useClub();

  return useMutation({
    mutationFn: async (optIn: boolean) => {
      if (!activeMembership) return;
      const { error } = await supabase
        .from('club_members')
        .update({ leaderboard_opt_in: optIn })
        .eq('id', activeMembership.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

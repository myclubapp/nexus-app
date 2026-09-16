import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import { useClub } from './useClub';

export interface MyProfile {
  displayName: string;
  /** Der Name getrennt (FR-163). Beide optional – der Bestand hat sie nicht. */
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  emailPublic: boolean;
  phonePublic: boolean;
  leaderboardOptIn: boolean;
  /** Konzept §3.1: Adresse und Notfallkontakt – nur für die Person und den Vorstand (0063). */
  birthDate: string | null;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
}

/**
 * Das eigene Profil im aktiven Verein.
 *
 * Gelesen wird über `club_directory`: Dieselbe Sicht, die anderen Mitgliedern
 * die verborgenen Felder vorenthält, gibt der Person ihre eigenen heraus – so
 * gibt es nur einen Weg zu den Kontaktangaben. Adresse und Notfallkontakt
 * stehen nicht im Verzeichnis; sie kommen aus `member_contacts`, deren Policy
 * die eigene Zeile herausgibt (0013, 0063).
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

      const { data: card, error: cardError } = await supabase
        .from('member_contacts')
        .select(
          'birth_date, street, house_number, postal_code, city, country, emergency_name, emergency_phone',
        )
        .eq('member_id', activeMembership!.id)
        .maybeSingle();
      if (cardError) throw new Error(cardError.message);

      const privacy = (activeMembership!.privacy ?? {}) as Record<string, boolean>;
      return {
        displayName: data.display_name ?? '',
        firstName: activeMembership!.first_name,
        lastName: activeMembership!.last_name,
        email: data.email,
        phone: data.phone,
        emailPublic: privacy.email === true,
        phonePublic: privacy.phone === true,
        leaderboardOptIn: activeMembership!.leaderboard_opt_in,
        birthDate: card?.birth_date ?? null,
        street: card?.street ?? null,
        houseNumber: card?.house_number ?? null,
        postalCode: card?.postal_code ?? null,
        city: card?.city ?? null,
        country: card?.country ?? null,
        emergencyName: card?.emergency_name ?? null,
        emergencyPhone: card?.emergency_phone ?? null,
      };
    },
  });
}

export interface ProfilePatch {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  emailPublic?: boolean;
  phonePublic?: boolean;
  /** Leer heisst löschen, `undefined` heisst unverändert (0063). */
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  /**
   * Ein `date` kennt kein «leer»: Zum Setzen `birthDate`, zum Austragen
   * `clearBirthDate` (0081).
   */
  birthDate?: string;
  clearBirthDate?: boolean;
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
        p_emergency_name: patch.emergencyName,
        p_emergency_phone: patch.emergencyPhone,
        p_first_name: patch.firstName,
        p_last_name: patch.lastName,
        p_birth_date: patch.birthDate,
        p_clear_birth_date: patch.clearBirthDate,
        p_street: patch.street,
        p_house_number: patch.houseNumber,
        p_postal_code: patch.postalCode,
        p_city: patch.city,
        p_country: patch.country,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['member-contacts'] });
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

/**
 * Die Einrichtung abschliessen (UC-053, FR-200).
 *
 * Wird beim Beenden **und** beim Überspringen aufgerufen: Beides ist eine
 * Antwort auf die Frage, ob jemand den Assistenten gesehen hat (BR-270).
 * Danach geht er nicht mehr von selbst auf – die Wege über das Dashboard und
 * die Profilseite bleiben.
 */
export function useFinishProfileSetup() {
  const queryClient = useQueryClient();
  const { activeMembership } = useClub();

  return useMutation({
    mutationFn: async () => {
      if (!activeMembership) throw new Error('Kein aktives Mitglied');

      const { error } = await supabase.rpc('finish_profile_setup', {
        p_member_id: activeMembership.id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      // Der Zeitpunkt steckt in der Mitgliedschaft; ohne diesen Schritt stünde
      // der Assistent beim nächsten Wechsel des Tabs erneut da.
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });
}

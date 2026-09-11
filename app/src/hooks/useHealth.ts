import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useClub } from './useClub';
import type {
  ClubHealth,
  HealthSignal,
  HealthStatus,
  MyHealthSignal,
  Responsibility,
  SuccessionCase,
  TeamHealth,
} from '../lib/health';

/**
 * Die offenen Fürsorge-Hinweise im eigenen Bereich (UC-023, Schritt 2).
 *
 * Was «eigener Bereich» heisst, entscheidet die Policy aus `0040` – nicht
 * diese Abfrage. Eine Trainer:in bekommt die Hinweise ihres Teams, der
 * Vorstand die des Vereins, ein Mitglied gar keine. Der Client filtert
 * **nichts**: Eine zweite Reichweite wäre eine zweite Regel.
 */
export function useHealthSignals() {
  const { activeClub, isTrainer } = useClub();

  return useQuery({
    queryKey: ['health-signals', activeClub?.id],
    enabled: Boolean(activeClub) && isTrainer && isConfigured,
    queryFn: async (): Promise<HealthSignal[]> => {
      const { data, error } = await supabase
        .from('health_signals')
        .select(
          'id, member_id, team_id, signal_type, severity, detail, status, owned_by, detected_at, member:club_members!health_signals_member_id_fkey(display_name), owner:club_members!health_signals_owned_by_fkey(display_name)',
        )
        .eq('club_id', activeClub!.id)
        .order('detected_at', { ascending: false });
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => {
        const entry = row as unknown as {
          id: string;
          member_id: string | null;
          team_id: string | null;
          signal_type: string;
          severity: HealthSignal['severity'];
          detail: string;
          status: HealthStatus;
          owned_by: string | null;
          detected_at: string;
          member: { display_name: string } | null;
          owner: { display_name: string } | null;
        };
        return {
          id: entry.id,
          memberId: entry.member_id,
          memberName: entry.member?.display_name ?? null,
          teamId: entry.team_id,
          signalType: entry.signal_type,
          severity: entry.severity,
          detail: entry.detail,
          status: entry.status,
          ownedBy: entry.owned_by,
          ownerName: entry.owner?.display_name ?? null,
          detectedAt: entry.detected_at,
        };
      });
    },
  });
}

/**
 * Den Status setzen (Schritte 6–9, FR-064).
 *
 * «Gelöst» heisst gelöscht: Der Server entfernt den Hinweis, statt ihn
 * abzuhaken (BR-097). Die Antwort sagt, was geschah – `taken`, wenn sich
 * jemand anderes bereits kümmert (A1).
 */
export function useSetSignalStatus() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      signalId: string;
      status: HealthStatus;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('set_signal_status', {
        p_signal_id: input.signalId,
        p_status: input.status,
      });
      if (error) throw new Error(error.message);
      return data ?? '';
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['health-signals', activeClub?.id],
      });
    },
  });
}

/**
 * Die Signale zur eigenen Person (UC-025, Schritt 3, BR-105).
 *
 * Über eine eigene Funktion und nicht über die Tabelle: Die Policy aus `0040`
 * kennt das betroffene Mitglied nicht als Empfänger, und das soll so bleiben.
 * Diese Auskunft gibt **nur** die eigenen Zeilen heraus.
 */
export function useMyHealthSignals() {
  const { activeClub, activeMembership } = useClub();

  return useQuery({
    queryKey: ['my-health-signals', activeClub?.id, activeMembership?.id],
    enabled: Boolean(activeClub) && Boolean(activeMembership) && isConfigured,
    queryFn: async (): Promise<MyHealthSignal[]> => {
      const { data, error } = await supabase.rpc('my_health_signals', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        signalType: row.signal_type,
        severity: row.severity as MyHealthSignal['severity'],
        status: row.status as MyHealthSignal['status'],
        detectedAt: row.detected_at,
        expiresAt: row.expires_at,
      }));
    },
  });
}

/**
 * Den Opt-out setzen oder zurücknehmen (Schritte 6–8, FR-074).
 *
 * Er wirkt sofort: Der Server löscht die bestehenden personenbezogenen
 * Signale in derselben Anweisung (BR-106) und gibt zurück, wie viele es waren.
 */
export function useSetHealthOptOut() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (optOut: boolean): Promise<number> => {
      const { data, error } = await supabase.rpc('set_health_opt_out', {
        p_club_id: activeClub!.id,
        p_opt_out: optOut,
      });
      if (error) throw new Error(error.message);
      return data ?? 0;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-health-signals'] });
      void queryClient.invalidateQueries({ queryKey: ['health-signals'] });
      // `health_opt_out` hängt an der Mitgliedschaft, und die steht unter
      // `['memberships', …]` – nicht unter `['club']`. Ohne diesen Schlüssel
      // bliebe der Schalter nach dem Umlegen auf dem alten Stand stehen und
      // die Seite behauptete das Gegenteil dessen, was gilt.
      void queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });
}

// --- Die Kennzahlen (FR-060, FR-061, FR-068, FR-069, FR-075) ---------------
//
// Jede dieser Funktionen prüft ihre Reichweite am Server (BR-096) und weist
// ab, statt Nullen zu liefern. Die Hooks spiegeln das mit `enabled`: Wer die
// Zahl nicht sehen darf, fragt gar nicht erst – das ist Bequemlichkeit, kein
// Schutz.

/** Die Vereins-Übersicht (FR-060) – nur für den Vorstand. */
export function useClubHealth() {
  const { activeClub, isAdmin } = useClub();

  return useQuery({
    queryKey: ['club-health', activeClub?.id],
    enabled: Boolean(activeClub) && isAdmin && isConfigured,
    queryFn: async (): Promise<ClubHealth | null> => {
      const { data, error } = await supabase.rpc('club_health', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      if (!row) return null;
      return {
        members: row.members ?? 0,
        activated: row.activated ?? 0,
        prevActivated: row.prev_activated ?? 0,
        active: row.active ?? 0,
        activeDays: row.active_days ?? 0,
      };
    },
  });
}

/**
 * Die Teamzahlen (FR-061).
 *
 * Der Server gibt **keine Zeile** für Teams unter der Mindestgrösse zurück –
 * in einer kleinen Gruppe wäre eine Quote die Aussage über eine Person. Der
 * Client zählt deshalb nicht nach, welche Teams fehlen.
 */
export function useTeamHealth() {
  const { activeClub, isTrainer } = useClub();

  return useQuery({
    queryKey: ['team-health', activeClub?.id],
    enabled: Boolean(activeClub) && isTrainer && isConfigured,
    queryFn: async (): Promise<TeamHealth[]> => {
      const { data, error } = await supabase.rpc('team_health', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        teamId: row.team_id as string,
        teamName: row.team_name as string,
        members: row.members ?? 0,
        invitations: row.invitations ?? 0,
        answered: row.answered ?? 0,
        attended: row.attended ?? 0,
      }));
    },
  });
}

/** Die Verantwortungsverteilung (FR-068) – eine Zahl, nie eine Liste. */
export function useResponsibility() {
  const { activeClub, isAdmin } = useClub();

  return useQuery({
    queryKey: ['responsibility', activeClub?.id],
    enabled: Boolean(activeClub) && isAdmin && isConfigured,
    queryFn: async (): Promise<Responsibility | null> => {
      const { data, error } = await supabase.rpc('responsibility_concentration', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      if (!row) return null;
      return {
        contributors: row.contributors ?? 0,
        carriers: row.carriers ?? 0,
        members: row.members ?? 0,
        efforts: row.efforts ?? 0,
      };
    },
  });
}

/** Ämter, die Vorlauf brauchen (FR-069). */
export function useSuccessionLead() {
  const { activeClub, isAdmin } = useClub();

  return useQuery({
    queryKey: ['succession-lead', activeClub?.id],
    enabled: Boolean(activeClub) && isAdmin && isConfigured,
    queryFn: async (): Promise<SuccessionCase[]> => {
      const { data, error } = await supabase.rpc('succession_lead', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        roleId: row.role_id as string,
        title: row.title as string,
        isVacant: Boolean(row.is_vacant),
        years: (row.years ?? null) as number | null,
      }));
    },
  });
}

/**
 * Der Definitionskatalog (FR-075).
 *
 * Er steht seit `0040` in den Vereinseinstellungen und war von der App aus
 * nicht zu sehen. Eine Kennzahl, deren Definition niemand kennt, ist eine
 * Behauptung.
 */
export function useHealthDefinitions() {
  const { activeClub, isTrainer } = useClub();

  return useQuery({
    queryKey: ['health-definitions', activeClub?.id],
    enabled: Boolean(activeClub) && isTrainer && isConfigured,
    queryFn: async (): Promise<{ key: string; value: number }[]> => {
      const { data, error } = await supabase.rpc('health_definitions', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        key: row.key as string,
        value: Number(row.value ?? 0),
      }));
    },
  });
}

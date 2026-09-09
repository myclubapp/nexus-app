import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import type {
  AppEvent,
  Attendance,
  AttendanceStatus,
  EventShift,
} from '../lib/database.types';
import { useClub } from './useClub';

export interface AgendaEvent extends AppEvent {
  shifts: EventShift[];
  attendance: Attendance[];
}

type Range = 'upcoming' | 'past';

export function useAgenda(range: Range = 'upcoming') {
  const { activeClub } = useClub();
  const now = new Date().toISOString();

  return useQuery({
    queryKey: ['agenda', activeClub?.id, range],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<AgendaEvent[]> => {
      let request = supabase
        .from('events')
        .select('*, shifts:event_shifts(*), attendance(*)')
        .eq('club_id', activeClub!.id);

      request =
        range === 'upcoming'
          ? request.gte('starts_at', now).order('starts_at', { ascending: true })
          : request.lt('starts_at', now).order('starts_at', { ascending: false });

      const { data, error } = await request.limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as AgendaEvent[];
    },
  });
}

export interface EventResponseResult {
  pointsAwarded: number;
  isEarly: boolean;
}

/**
 * Zu- oder absagen (UC-010).
 *
 * Läuft über `respond_to_event()` und nicht mehr als direkter Upsert: Die
 * Frist der Abmeldeprämie (BR-040), die Sperre für abgesagte und begonnene
 * Termine (A3, BR-038) und die Buchung gehören auf den Server. Ein Client, der
 * die Frist selbst rechnet, kann sie auch umgehen.
 */
export function useRespondToEvent() {
  const queryClient = useQueryClient();
  const { activeClub, activeMembership } = useClub();

  return useMutation({
    mutationFn: async (input: {
      eventId: string;
      status: Extract<AttendanceStatus, 'registered' | 'excused'>;
      reason?: string | null;
    }): Promise<EventResponseResult> => {
      const { data, error } = await supabase.rpc('respond_to_event', {
        p_event_id: input.eventId,
        p_status: input.status,
        p_reason: input.reason ?? undefined,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      return {
        pointsAwarded: row?.points_awarded ?? 0,
        isEarly: row?.is_early ?? false,
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda', activeClub?.id] });
      // Eine rechtzeitige Absage kann Punkte gebucht haben.
      void queryClient.invalidateQueries({ queryKey: ['points', activeMembership?.id] });
    },
  });
}

/* Der Check-in ist nach `useCheckIn.ts` gezogen: Er puffert seit UC-014 bei
   fehlendem Netz (A5) und braucht dafür mehr als eine Mutation. */

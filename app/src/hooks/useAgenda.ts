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

/** Zu- und Absagen. Der Grund ist freiwillig und bleibt bei der Person. */
export function useRespondToEvent() {
  const queryClient = useQueryClient();
  const { activeClub, activeMembership } = useClub();

  return useMutation({
    mutationFn: async (input: { eventId: string; status: AttendanceStatus }) => {
      if (!activeMembership) throw new Error('Kein aktives Mitglied');
      const { error } = await supabase.from('attendance').upsert(
        {
          event_id: input.eventId,
          member_id: activeMembership.id,
          status: input.status,
        },
        { onConflict: 'event_id,member_id' },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda', activeClub?.id] });
    },
  });
}

/**
 * QR-Check-in. Der Token wird serverseitig geprüft und bucht die Punkte in
 * derselben Transaktion – der Client kann keine Punkte erzeugen.
 */
export function useCheckIn() {
  const queryClient = useQueryClient();
  const { activeClub, activeMembership } = useClub();

  return useMutation({
    mutationFn: async (input: { eventId: string; qrToken: string }) => {
      const { data, error } = await supabase.rpc('check_in', {
        p_event_id: input.eventId,
        p_qr_token: input.qrToken,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['points', activeMembership?.id] });
    },
  });
}

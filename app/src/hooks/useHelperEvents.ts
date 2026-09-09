import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Json } from '../lib/database.types';
import type { ShiftDraft } from '../lib/shift';
import { useClub } from './useClub';

export interface HelperEventInput {
  title: string;
  /** Lokale Eingabe `YYYY-MM-DDTHH:mm`. */
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  /** BR-043: ohne Sinnzusammenhang keine Publikation. */
  why: string;
  shifts: ShiftDraft[];
}

function toTimestamp(local: string): string {
  return new Date(local).toISOString();
}

/**
 * Helfer-Event mit Schichten anlegen (UC-011, Schritte 1–7).
 *
 * Eine Serverfunktion und nicht zwei Inserts: Bricht die Verbindung zwischen
 * Event und Schichten ab, bliebe sonst ein Entwurf ohne Schichten zurück, den
 * niemand mehr erreicht, und der zweite Versuch legte einen weiteren an.
 *
 * Das Event entsteht immer zuerst als **Entwurf** (`published_at` bleibt
 * leer). Erst `publish_event()` macht es sichtbar und stellt zu – so ist A2
 * («Entwurf sichern») kein Sonderweg, sondern der Normalfall, bei dem der
 * zweite Schritt einfach ausbleibt.
 */
export function useCreateHelperEvent() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: HelperEventInput): Promise<string> => {
      const { data, error } = await supabase.rpc('create_helper_event', {
        p_title: input.title,
        p_why: input.why,
        p_starts_at: toTimestamp(input.startsAt),
        // `undefined` und nicht `null`: Die Funktion hat seit 0024 Vorgabewerte,
        // und ein weggelassenes Argument ist genau das, was «kein Ende» heisst.
        p_ends_at: input.endsAt ? toTimestamp(input.endsAt) : undefined,
        p_location: input.location ?? undefined,
        p_shifts: input.shifts.map((shift) => ({
          title: shift.title,
          starts_at: toTimestamp(shift.startsAt),
          ends_at: toTimestamp(shift.endsAt),
          needed: shift.needed,
          // BR-042: Der Punktwert steht an der Schicht selbst, damit ein
          // halber Tag anders zählt als ein ganzer. Der Regelcode liefert
          // nur die Säule fürs Reporting.
          points: shift.points,
          point_rule_code: 'shift_done',
        })) as unknown as Json,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda', activeClub?.id] });
    },
  });
}

export interface PublishResult {
  notified: number;
  /** A3: Die sanfte Sperre hat den Push unterdrückt. */
  muted: boolean;
}

/**
 * Ein Event ausschreiben (Schritte 8–10, A3).
 *
 * Die sanfte Sperre entscheidet der Server: Sie hängt an einer
 * Vereinseinstellung und am Zeitpunkt der letzten Verbindungs-Nachricht, und
 * beides gehört nicht in den Client.
 */
export function usePublishEvent() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (eventId: string): Promise<PublishResult> => {
      const { data, error } = await supabase.rpc('publish_event', {
        p_event_id: eventId,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      return { notified: row?.notified ?? 0, muted: row?.muted ?? false };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda', activeClub?.id] });
    },
  });
}

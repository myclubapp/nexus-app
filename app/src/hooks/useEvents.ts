import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { AppEvent, EventType, Json, TablesUpdate } from '../lib/database.types';
import { expandSeries, type SeriesRule } from '../lib/eventSeries';
import { useClub } from './useClub';

export interface CreateEventInput {
  type: EventType;
  title: string;
  /** Lokale Eingabe `YYYY-MM-DDTHH:mm`. */
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  why: string | null;
  teamId: string | null;
  pointRuleCode: string | null;
  /** FR-029: benötigte Teilnehmerzahl; `null` heisst «kein Bedarf». */
  capacityNeeded: number | null;
  /** Gesetzt, wenn eine Serie angelegt wird (A1). */
  series?: SeriesRule;
}

/** Lokale Eingabe in einen Zeitstempel, den Postgres versteht. */
function toTimestamp(local: string): string {
  return new Date(local).toISOString();
}

function invalidateAgenda(
  queryClient: ReturnType<typeof useQueryClient>,
  clubId: string | undefined,
) {
  void queryClient.invalidateQueries({ queryKey: ['agenda', clubId] });
  void queryClient.invalidateQueries({ queryKey: ['club-is-new', clubId] });
}

/**
 * Termin oder Terminserie anlegen (UC-009).
 *
 * Der Termin entsteht über die Tabelle – die Policy `events_trainer_write`
 * prüft die Rolle (BR-033). Die Benachrichtigung läuft danach über
 * `announce_event()`, weil sie in fremde Inboxen schreibt.
 *
 * Bei einer Serie werden alle Termine in **einem** Insert angelegt: Ein
 * Abbruch mittendrin hinterliesse sonst eine halbe Serie.
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { activeClub, activeMembership } = useClub();

  return useMutation({
    mutationFn: async (input: CreateEventInput): Promise<AppEvent[]> => {
      if (!activeClub) throw new Error('Kein aktiver Verein');

      let seriesId: string | null = null;
      if (input.series) {
        const { data, error } = await supabase
          .from('event_series')
          .insert({
            club_id: activeClub.id,
            team_id: input.teamId,
            rule: input.series as unknown as Json,
          })
          .select('id')
          .single();
        if (error) throw new Error(error.message);
        seriesId = data.id;
      }

      const occurrences = input.series
        ? expandSeries(input.series)
        : [{ startsAt: input.startsAt, endsAt: input.endsAt }];

      if (occurrences.length === 0) {
        throw new Error('Die Serie ergibt keinen einzigen Termin.');
      }

      const rows = occurrences.map((occurrence) => ({
        club_id: activeClub.id,
        team_id: input.teamId,
        series_id: seriesId,
        type: input.type,
        title: input.title.trim(),
        why: input.why?.trim() || null,
        starts_at: toTimestamp(occurrence.startsAt),
        ends_at: occurrence.endsAt ? toTimestamp(occurrence.endsAt) : null,
        location: input.location?.trim() || null,
        capacity_needed: input.capacityNeeded,
        point_rule_code: input.pointRuleCode,
        created_by: activeMembership?.id ?? null,
      }));

      const { data, error } = await supabase.from('events').insert(rows).select();
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as AppEvent[];
    },
    onSuccess: () => invalidateAgenda(queryClient, activeClub?.id),
  });
}

/**
 * Betroffene über einen Termin benachrichtigen (Schritt 10).
 *
 * Getrennt vom Anlegen: Scheitert die Zustellung, steht der Termin trotzdem
 * in der Agenda – das ist besser als ein Termin, der niemandem gehört.
 */
export function useAnnounceEvent() {
  return useMutation({
    mutationFn: async (eventId: string): Promise<number> => {
      const { data, error } = await supabase.rpc('announce_event', {
        p_event_id: eventId,
      });
      if (error) throw new Error(error.message);
      return (data as number) ?? 0;
    },
  });
}

/** Termin absagen (A4). Der Grund ist Pflicht und erreicht alle Betroffenen. */
export function useCancelEvent() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: { eventId: string; reason: string }) => {
      const { error } = await supabase.rpc('cancel_event', {
        p_event_id: input.eventId,
        p_reason: input.reason,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateAgenda(queryClient, activeClub?.id),
  });
}

/**
 * Termin löschen (Entscheid vom 2026-09-13: Bearbeiten heisst auch Löschen).
 *
 * Anders als die Absage ohne Grund und ohne Zustellung – der Termin ist
 * danach weg. Der Riegel gegen einen Termin mit gebuchten Punkten sitzt in
 * `delete_event()` (0074); die Meldung sagt dann, dass nur noch Absagen geht.
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc('delete_event', { p_event_id: eventId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateAgenda(queryClient, activeClub?.id),
  });
}

/**
 * Einen einzelnen Termin ändern (A2).
 *
 * Die Spezifikation fragt, ob nur dieser Termin oder die ganze Serie geändert
 * werden soll. `scope: 'series'` wendet die Änderung auf alle **künftigen**
 * Termine derselben Serie an – vergangene bleiben, wie sie waren.
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      eventId: string;
      seriesId: string | null;
      scope: 'single' | 'series';
      title?: string;
      location?: string | null;
      why?: string | null;
      pointRuleCode?: string | null;
      capacityNeeded?: number | null;
    }) => {
      // Typisiert statt Record: Sonst nimmt supabase-js jeden Spaltennamen an,
      // auch einen falsch geschriebenen, und die Änderung liefe ins Leere.
      const patch: TablesUpdate<'events'> = {};
      if (input.title !== undefined) patch.title = input.title.trim();
      if (input.location !== undefined) patch.location = input.location?.trim() || null;
      if (input.why !== undefined) patch.why = input.why?.trim() || null;
      if (input.pointRuleCode !== undefined) patch.point_rule_code = input.pointRuleCode;
      if (input.capacityNeeded !== undefined) patch.capacity_needed = input.capacityNeeded;
      if (Object.keys(patch).length === 0) return;

      // Zeiten bleiben aussen vor: Sie unterscheiden die Termine einer Serie
      // gerade voneinander und lassen sich nicht sinnvoll gemeinsam setzen.
      const request = supabase.from('events').update(patch);
      const { error } =
        input.scope === 'series' && input.seriesId
          ? await request
              .eq('series_id', input.seriesId)
              .gte('starts_at', new Date().toISOString())
          : await request.eq('id', input.eventId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateAgenda(queryClient, activeClub?.id),
  });
}

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import type {
  AppEvent,
  Attendance,
  AttendanceStatus,
  EventShift,
  EventType,
} from '../lib/database.types';
import { marksWindow, monthWindow } from '../lib/agendaCalendar';
import { useClub } from './useClub';

export interface AgendaEvent extends AppEvent {
  shifts: EventShift[];
  attendance: Attendance[];
}

type Range = 'upcoming' | 'past';

/**
 * Was die Agenda eingrenzt. Beides gehört in die Abfrage, nicht in einen
 * Client-Filter über das Ergebnis: Die Liste ist auf 100 Zeilen begrenzt,
 * und eine Trainingsserie plus die Spiele vom Verband füllen die längst –
 * ein Anlass in drei Monaten stünde dann in keiner Ansicht mehr.
 */
export interface AgendaFilter {
  /**
   * Nur diese Teams – Vereinstermine (ohne Team) bleiben immer dabei.
   * `undefined` heisst «alles, was lesbar ist»; eine **leere Liste** heisst
   * «nur Vereinstermine». Der Unterschied ist keine Spitzfindigkeit: Wer in
   * keinem Team steht, soll die Termine des Vereins sehen und nicht die
   * aller Teams.
   */
  teamIds?: readonly string[];
  /** Nur diese Terminarten; leer heisst alle. */
  types?: readonly EventType[];
}

function minuteFloor(date: Date): Date {
  const floored = new Date(date);
  floored.setSeconds(0, 0);
  return floored;
}

/**
 * Der Filter, sortiert und als Zeichenkette im Schlüssel: Dieselbe Auswahl in
 * anderer Reihenfolge ist dieselbe Abfrage.
 */
function normalizeFilter(filter: AgendaFilter) {
  const teamIds = filter.teamIds ? [...filter.teamIds].sort() : null;
  const types = [...(filter.types ?? [])].sort();
  return {
    teamIds,
    types,
    // «alle Teams» und «gar kein Team» sind zwei Abfragen, nicht dieselbe –
    // deshalb ein eigenes Wort für den offenen Fall statt der leeren Zeichenkette.
    teamKey: teamIds ? teamIds.join(',') : 'all',
    typeKey: types.join(','),
  };
}

/**
 * Die Team-Klausel für PostgREST – `null` heisst «keine Einschränkung».
 *
 * Eine leere Liste ist nicht dasselbe wie keine Liste: Sie lässt nur die
 * Vereinstermine übrig. Wer in keinem Team steht, sähe sonst plötzlich alle.
 */
export function teamScopeClause(teamIds: readonly string[] | null): string | null {
  if (!teamIds) return null;
  if (teamIds.length === 0) return 'team_id.is.null';
  return `team_id.is.null,team_id.in.(${teamIds.join(',')})`;
}

/**
 * Der Filter als Klauseln – einmal für die Liste, den Kalendermonat und die
 * Markierungen, damit die drei Sichten dieselben Termine meinen.
 */
function applyFilter<
  T extends { or(filters: string): T; in(column: 'type', values: EventType[]): T },
>(request: T, teamIds: readonly string[] | null, types: EventType[]): T {
  let filtered = request;
  const teamClause = teamScopeClause(teamIds);
  if (teamClause) filtered = filtered.or(teamClause);
  if (types.length > 0) filtered = filtered.in('type', types);
  return filtered;
}

interface QueryOptions {
  /** `false` hält die Abfrage an – etwa die Liste, solange der Kalender offen ist. */
  enabled?: boolean;
}

/** Die Zeilen der Agenda: der Termin mit seinen Schichten und Antworten. */
const AGENDA_COLUMNS = '*, shifts:event_shifts(*), attendance(*)';

export function useAgenda(
  range: Range = 'upcoming',
  filter: AgendaFilter = {},
  options: QueryOptions = {},
) {
  const { activeClub } = useClub();
  const { teamIds, types, teamKey, typeKey } = normalizeFilter(filter);
  // Auf die Minute gerundet und Teil des Schlüssels: Ein Termin, der während
  // der Sitzung vergeht, wechselt so beim nächsten Rendern von «kommend» zu
  // «vergangen», statt bis zur nächsten Mutation stehenzubleiben. Die Rundung
  // hält den Schlüssel stabil, solange dieselbe Minute läuft.
  const now = minuteFloor(new Date()).toISOString();

  return useQuery({
    queryKey: ['agenda', activeClub?.id, range, now, teamKey, typeKey],
    // Beim Minutenwechsel bleibt die alte Liste stehen, bis die neue da ist –
    // kein Skelett mitten in der Bedienung.
    placeholderData: keepPreviousData,
    enabled: Boolean(activeClub) && isConfigured && (options.enabled ?? true),
    queryFn: async (): Promise<AgendaEvent[]> => {
      const filtered = applyFilter(
        supabase.from('events').select(AGENDA_COLUMNS).eq('club_id', activeClub!.id),
        teamIds,
        types,
      );

      const request =
        range === 'upcoming'
          ? filtered.gte('starts_at', now).order('starts_at', { ascending: true })
          : filtered.lt('starts_at', now).order('starts_at', { ascending: false });

      const { data, error } = await request.limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as AgendaEvent[];
    },
  });
}

/**
 * Kommende Termine, die überhaupt eine Schicht haben – die Quelle der
 * Helfereinsätze im Marktplatz (UC-011, Schritt 9).
 *
 * Die allgemeine Liste taugt dafür nicht: Sie endet nach 100 Zeilen, und eine
 * Trainingsserie plus die Verbandsspiele füllen die längst. Der Marktplatz
 * zeigte dann einen einzigen Einsatz, während ein Dutzend weitere Termine
 * hinter der Grenze standen – es sah aus wie «nichts zu tun».
 *
 * Dieselben Spalten und dieselbe Bedingung wie dort, nur der `!inner`-Verbund
 * auf die Schichten kommt dazu: Er lässt allein Termine übrig, die eine haben.
 * Was davon noch offen ist, rechnet weiterhin `openShiftOffers()` – eine
 * zweite Wahrheit entsteht so nicht.
 *
 * Der Schlüssel beginnt mit `['agenda', clubId]`; jede Entwertung der Liste
 * trifft ihn mit.
 */
export function useShiftEvents(options: QueryOptions = {}) {
  const { activeClub } = useClub();
  const now = minuteFloor(new Date()).toISOString();

  return useQuery({
    queryKey: ['agenda', activeClub?.id, 'shift-offers', now],
    placeholderData: keepPreviousData,
    enabled: Boolean(activeClub) && isConfigured && (options.enabled ?? true),
    queryFn: async (): Promise<AgendaEvent[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*, shifts:event_shifts!inner(*), attendance(*)')
        .eq('club_id', activeClub!.id)
        .gte('starts_at', now)
        .order('starts_at', { ascending: true })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as AgendaEvent[];
    },
  });
}

/**
 * Ein einzelner Termin als Abfrage – für alles, was einen Termin über seine
 * Kennung erreicht, ohne die Liste zu kennen: der Verweis aus der Inbox, ein
 * Deep Link, eine Benachrichtigung.
 *
 * Die Liste taugt dafür nicht: Sie endet nach 100 Zeilen, kennt nur den
 * gewählten Zeitraum und filtert nach Teams. Ein Termin von gestern oder aus
 * einem fremden Team stünde nicht darin – die Nachricht dazu aber schon.
 *
 * Kein `club_id`-Filter: Wer zwei Vereine hat, bekommt Nachrichten aus
 * beiden. Was sichtbar ist, entscheidet `event_in_scope()` in der Policy
 * (`0073`), nicht der gerade gewählte Verein.
 *
 * Der Schlüssel beginnt mit `['agenda', clubId]` – so trifft ihn jede
 * Entwertung der Liste mit, ohne dass eine Mutation davon wissen muss.
 */
export function eventQuery(clubId: string | undefined, eventId: string) {
  return {
    queryKey: ['agenda', clubId, 'one', eventId],
    queryFn: async (): Promise<AgendaEvent | null> => {
      const { data, error } = await supabase
        .from('events')
        .select(AGENDA_COLUMNS)
        .eq('id', eventId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      // `null` heisst «gibt es nicht mehr oder nicht für dich» – ein Zustand,
      // den die aufrufende Ansicht zeigen muss, kein Fehler.
      return (data ?? null) as unknown as AgendaEvent | null;
    },
  };
}

/**
 * Derselbe Termin als Abfrage im Baum – für das Blatt, das ihn zeigt.
 *
 * Sie liest denselben Eintrag im Zwischenspeicher wie `fetchQuery()` und
 * bleibt deshalb am Stand: Wer im Blatt antwortet, entwertet `['agenda',
 * clubId]`, und das Blatt zeigt danach die neue Antwort statt der alten.
 */
export function useEvent(eventId: string | null) {
  const { activeClub } = useClub();

  return useQuery({
    ...eventQuery(activeClub?.id, eventId ?? ''),
    enabled: Boolean(activeClub) && isConfigured && eventId !== null,
  });
}

/**
 * Ein Monat der Agenda für die Kalenderübersicht: alle Termine mit Beginn in
 * diesem Monat (Zeitzone des Geräts), vollständig wie die Liste – Zeile und
 * Detail brauchen Schichten und Antworten. Kein Zeilenlimit: Ein Monat hat
 * einige Dutzend Termine, keine hundert.
 */
export function useAgendaMonth(
  month: string,
  filter: AgendaFilter = {},
  options: QueryOptions = {},
) {
  const { activeClub } = useClub();
  const { teamIds, types, teamKey, typeKey } = normalizeFilter(filter);

  return useQuery({
    queryKey: ['agenda', activeClub?.id, 'month', month, teamKey, typeKey],
    enabled: Boolean(activeClub) && isConfigured && (options.enabled ?? true),
    queryFn: async (): Promise<AgendaEvent[]> => {
      const { from, to } = monthWindow(month);
      const request = applyFilter(
        supabase.from('events').select(AGENDA_COLUMNS).eq('club_id', activeClub!.id),
        teamIds,
        types,
      )
        .gte('starts_at', from)
        .lt('starts_at', to)
        .order('starts_at', { ascending: true });

      const { data, error } = await request;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as AgendaEvent[];
    },
  });
}

/** Was der Kalender zum Markieren braucht – Beginn und Absage, nicht mehr. */
export type AgendaMark = Pick<AppEvent, 'id' | 'starts_at' | 'cancelled_at'>;

/**
 * Die Tage mit Terminen rund um den gewählten Monat (`marksWindow`). Nur drei
 * Spalten: Ein Jahr Vereinskalender sind einige hundert Zeilen, mit Schichten
 * und Antworten wären es Tausende. Das Fenster hängt am gewählten Monat und
 * wandert mit, sobald die Wahl einen anderen Monat trifft; beim Blättern ohne
 * Wahl bleiben die Markierungen des letzten Fensters stehen.
 */
export function useAgendaMarks(
  month: string,
  filter: AgendaFilter = {},
  options: QueryOptions = {},
) {
  const { activeClub } = useClub();
  const { teamIds, types, teamKey, typeKey } = normalizeFilter(filter);

  return useQuery({
    queryKey: ['agenda', activeClub?.id, 'marks', month, teamKey, typeKey],
    // Beim Wandern des Fensters bleiben die alten Markierungen stehen – die
    // meisten Tage sind in beiden Fenstern dieselben.
    placeholderData: keepPreviousData,
    enabled: Boolean(activeClub) && isConfigured && (options.enabled ?? true),
    queryFn: async (): Promise<AgendaMark[]> => {
      const { from, to } = marksWindow(month);
      const request = applyFilter(
        supabase
          .from('events')
          .select('id, starts_at, cancelled_at')
          .eq('club_id', activeClub!.id),
        teamIds,
        types,
      )
        .gte('starts_at', from)
        .lt('starts_at', to)
        .order('starts_at', { ascending: true });

      const { data, error } = await request.limit(1000);
      if (error) throw new Error(error.message);
      return (data ?? []) as AgendaMark[];
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

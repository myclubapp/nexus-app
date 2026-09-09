import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import type { TaskDraft, TaskWithAssignments } from '../lib/task';
import { useClub } from './useClub';

/**
 * Der Marktplatz (UC-018, Schritt 2).
 *
 * Entwürfe stehen mit in der Abfrage: Die Policy aus `0034` blendet sie für
 * Mitglieder aus, für Trainer:innen nicht – so braucht der Client keine zweite
 * Abfrage und keine Rollenlogik, um A3 zu zeigen.
 *
 * Abgelaufene ebenso: Die Policy zeigt sie nur der ausschreibenden Seite, und
 * ohne sie führte die Ablauf-Meldung aus A4 in einen Marktplatz, in dem die
 * gemeldete Aufgabe fehlt.
 */
export function useTasks() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['tasks', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<TaskWithAssignments[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, assignments:task_assignments(*)')
        .eq('club_id', activeClub!.id)
        .in('status', ['draft', 'open', 'claimed', 'submitted', 'expired'])
        .order('due_at', { ascending: true, nullsFirst: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as TaskWithAssignments[];
    },
  });
}

function toTimestamp(local: string): string | undefined {
  if (!local) return undefined;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Aufgabe anlegen (UC-017, Schritte 1–5).
 *
 * Sie entsteht immer als **Entwurf**; erst `publish_task()` macht sie sichtbar
 * und stellt zu. A3 («Entwurf sichern») ist damit kein Sonderweg, sondern der
 * Normalfall, bei dem der zweite Schritt ausbleibt.
 */
export function useCreateTask() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (draft: TaskDraft): Promise<string> => {
      const { data, error } = await supabase.rpc('create_task', {
        p_club_id: activeClub!.id,
        p_title: draft.title,
        p_why: draft.why,
        p_category: draft.category,
        p_points: draft.points,
        // `undefined` und nicht `null`: Die Funktion hat Vorgabewerte, und ein
        // weggelassenes Argument ist genau das, was «keine Frist» heisst.
        p_due_at: toTimestamp(draft.dueAt),
        p_max_assignees: draft.maxAssignees,
        p_description: draft.description || undefined,
        p_team_id: draft.teamId ?? undefined,
        p_recurrence_days: draft.recurrenceDays ?? undefined,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', activeClub?.id] });
    },
  });
}

export interface PublishTaskResult {
  notified: number;
  /** Die sanfte Sperre hat den Vorschlag unterdrückt (K1, BR-044). */
  muted: boolean;
}

/**
 * Aufgabe ausschreiben (Schritte 5–7).
 *
 * Ob der Vorschlag zugestellt wird, entscheidet der Server: Es hängt an einer
 * Vereinseinstellung und am Zeitpunkt der letzten Verbindungs-Nachricht, und
 * beides gehört nicht in den Client.
 */
export function usePublishTask() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (taskId: string): Promise<PublishTaskResult> => {
      const { data, error } = await supabase.rpc('publish_task', {
        p_task_id: taskId,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      return { notified: row?.notified ?? 0, muted: row?.muted ?? false };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', activeClub?.id] });
    },
  });
}

/**
 * Aufgabe übernehmen (UC-018, Schritt 4).
 *
 * Die Kapazitätsprüfung gehört auf den Server, sonst übernehmen zwei Personen
 * gleichzeitig dieselbe Aufgabe (A1).
 */
export function useClaimTask() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.rpc('claim_task', { p_task_id: taskId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['task-count', activeClub?.id] });
    },
  });
}

/**
 * Erledigt melden (UC-018, Schritte 7–8).
 *
 * Die Frist hält niemanden auf (A4) und der Nachweis ist freiwillig (A5) –
 * beides entscheidet der Server, damit das Formular nicht strenger ist als die
 * Regel.
 */
export function useSubmitTask() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: { taskId: string; proofUrl: string }): Promise<boolean> => {
      const { data, error } = await supabase.rpc('submit_task', {
        p_task_id: input.taskId,
        p_proof_url: input.proofUrl || undefined,
      });
      if (error) throw new Error(error.message);
      return data ?? false;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', activeClub?.id] });
    },
  });
}

/**
 * Übernahme zurückgeben (A3).
 *
 * Gibt zurück, ob die ausschreibende Person gewarnt wurde – das passiert nur,
 * wenn die Frist innerhalb von 48 Stunden abläuft. Die Person soll wissen,
 * dass ihre Rückgabe jemanden erreicht hat, und dass sie folgenlos bleibt
 * (BR-075).
 */
export function useReleaseTask() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (taskId: string): Promise<boolean> => {
      const { data, error } = await supabase.rpc('release_task', {
        p_task_id: taskId,
      });
      if (error) throw new Error(error.message);
      return data ?? false;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['task-count', activeClub?.id] });
    },
  });
}

/**
 * Wie viele Aufgaben habe ich diese Saison übernommen (BR-076, FR-057)?
 *
 * Die eigene Zahl. Der Server rechnet sie mit `season_label()` – derselben
 * Funktion, die den Ledger einordnet; eine zweite Saisonrechnung im Client
 * wäre eine zweite Saison.
 */
export function useMyTaskCount() {
  const { activeClub, activeMembership } = useClub();

  return useQuery({
    queryKey: ['task-count', activeClub?.id, activeMembership?.id],
    enabled: Boolean(activeClub) && Boolean(activeMembership) && isConfigured,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('my_season_task_count', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);
      return data ?? 0;
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import type { TablesUpdate } from '../lib/database.types';
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

/**
 * Eine einzelne Aufgabe als Abfrage – für alles, was sie über ihre Kennung
 * erreicht, ohne den Marktplatz zu kennen: der Verweis aus der Inbox, ein
 * Deep Link.
 *
 * Die Liste taugt dafür nicht: Sie zeigt fünf Zustände, und eine erledigte
 * oder abgesagte Aufgabe fehlt darin – die Nachricht dazu steht aber weiter
 * in der Inbox. Was sichtbar ist, entscheidet die Policy aus `0034`.
 *
 * Der Schlüssel beginnt mit `['tasks', clubId]` – so trifft ihn jede
 * Entwertung der Liste mit, ohne dass eine Mutation davon wissen muss.
 */
export function taskQuery(clubId: string | undefined, taskId: string) {
  return {
    queryKey: ['tasks', clubId, 'one', taskId],
    queryFn: async (): Promise<TaskWithAssignments | null> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, assignments:task_assignments(*)')
        .eq('id', taskId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      // `null` heisst «gibt es nicht mehr oder nicht für dich».
      return (data ?? null) as unknown as TaskWithAssignments | null;
    },
  };
}

/**
 * Dieselbe Aufgabe als Abfrage im Baum – für das Blatt, das sie zeigt. Sie
 * liest denselben Eintrag im Zwischenspeicher wie `fetchQuery()` und bleibt
 * deshalb am Stand: Wer im Blatt übernimmt, entwertet `['tasks', clubId]`.
 */
export function useTask(taskId: string | null) {
  const { activeClub } = useClub();

  return useQuery({
    ...taskQuery(activeClub?.id, taskId ?? ''),
    enabled: Boolean(activeClub) && isConfigured && taskId !== null,
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

/**
 * Entwurf ändern (UC-017, A5).
 *
 * Nur ein Entwurf ist formbar (BR-182): Was publiziert ist, haben Mitglieder
 * gesehen und vielleicht übernommen – das ändert sich nicht still. Die
 * Bedingung steht in der Abfrage, und ob eine Zeile getroffen wurde, wird
 * geprüft: Ein Entwurf, den jemand inzwischen ausgeschrieben hat, meldet sich
 * sonst als «gesichert», obwohl nichts geschrieben wurde.
 *
 * Kein `security definer`: Die Policy `tasks_trainer_update` lässt genau die
 * Personen schreiben, die auch ausschreiben dürfen – und Punkte hängen an der
 * Bestätigung, nicht am Text der Aufgabe.
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: { taskId: string; draft: TaskDraft }): Promise<void> => {
      const { draft } = input;
      const patch: TablesUpdate<'tasks'> = {
        title: draft.title.trim(),
        why: draft.why.trim() || null,
        description: draft.description.trim() || null,
        category: draft.category,
        points: draft.points,
        due_at: toTimestamp(draft.dueAt) ?? null,
        max_assignees: draft.maxAssignees,
        team_id: draft.teamId,
        recurrence_days: draft.recurrenceDays,
      };
      const { data, error } = await supabase
        .from('tasks')
        .update(patch)
        .eq('id', input.taskId)
        .eq('status', 'draft')
        .select('id');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('task_not_draft');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', activeClub?.id] });
    },
  });
}

/**
 * Entwurf löschen (UC-017, A6).
 *
 * Nur ein Entwurf ist löschbar: Was ausgeschrieben ist, haben Mitglieder
 * gesehen – das verschwindet nicht still, sondern läuft ab oder wird
 * erledigt. Die Bedingung steht in der Abfrage, und ob eine Zeile getroffen
 * wurde, wird geprüft (BR-182): Ein Entwurf, den jemand inzwischen
 * ausgeschrieben hat, meldet sich sonst als «gelöscht», obwohl er steht.
 *
 * Kein `security definer`: `tasks_trainer_delete` (0033) lässt genau die
 * Personen löschen, die auch ausschreiben dürfen.
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (taskId: string): Promise<void> => {
      const { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('status', 'draft')
        .select('id');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('task_not_draft');
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

export interface TaskRosterEntry {
  assignmentId: string;
  memberId: string;
  displayName: string;
  claimedAt: string;
  submittedAt: string | null;
  proofUrl: string | null;
  confirmedAt: string | null;
  kudos: string | null;
}

/** Wer hat übernommen, wann gemeldet, mit welchem Nachweis (UC-019, Schritt 3)? */
export function useTaskRoster(taskId: string | null) {
  const { isTrainer } = useClub();

  return useQuery({
    queryKey: ['task-roster', taskId],
    enabled: Boolean(taskId) && isTrainer && isConfigured,
    queryFn: async (): Promise<TaskRosterEntry[]> => {
      const { data, error } = await supabase.rpc('task_roster', {
        p_task_id: taskId!,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        assignmentId: row.assignment_id,
        memberId: row.member_id,
        displayName: row.display_name,
        claimedAt: row.claimed_at,
        submittedAt: row.submitted_at,
        proofUrl: row.proof_url,
        confirmedAt: row.confirmed_at,
        kudos: row.kudos,
      }));
    },
  });
}

export interface ConfirmTaskResult {
  points: number;
  /** `false` heisst: bestätigt, aber ohne Gutschrift (A3, BR-065). */
  booked: boolean;
}

/**
 * Aufgabe bestätigen (Schritte 5–7).
 *
 * Ob überhaupt gebucht wird, entscheidet der Server: Er liest die Punkteregel,
 * prüft die Häufigkeitsgrenze (BR-065) und weist die Bestätigung der eigenen
 * Übernahme ab (BR-080). Der Client kennt keine dieser Regeln.
 */
export function useConfirmTask() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      assignmentId: string;
      kudos: string;
    }): Promise<ConfirmTaskResult> => {
      const { data, error } = await supabase.rpc('confirm_task', {
        p_assignment_id: input.assignmentId,
        p_kudos: input.kudos || undefined,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      return { points: row?.points ?? 0, booked: row?.booked ?? false };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['task-roster'] });
    },
  });
}

/** A1: «Zurück an die Person» – mit Hinweis, was fehlt. */
export function useRejectTask() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: { assignmentId: string; note: string }) => {
      const { error } = await supabase.rpc('reject_task', {
        p_assignment_id: input.assignmentId,
        p_note: input.note,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['task-roster'] });
    },
  });
}

export interface KudosEntry {
  id: string;
  kudos: string;
  confirmedAt: string;
  taskTitle: string;
}

/**
 * Die erhaltenen Dankesworte (Schritt 8, FR-055).
 *
 * Auf dem **eigenen** Profil: Eine für andere sichtbare Dankesliste wäre eine
 * Auswertung über Personen und damit genau das, was NFR-022 ausschliesst.
 */
export function useMyKudos() {
  const { activeMembership } = useClub();

  return useQuery({
    queryKey: ['kudos', activeMembership?.id],
    enabled: Boolean(activeMembership) && isConfigured,
    queryFn: async (): Promise<KudosEntry[]> => {
      const { data, error } = await supabase
        .from('task_assignments')
        .select('id, kudos, confirmed_at, task:tasks(title)')
        .eq('member_id', activeMembership!.id)
        .not('kudos', 'is', null)
        .not('confirmed_at', 'is', null)
        .order('confirmed_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => {
        const entry = row as unknown as {
          id: string;
          kudos: string;
          confirmed_at: string;
          task: { title: string } | null;
        };
        return {
          id: entry.id,
          kudos: entry.kudos,
          confirmedAt: entry.confirmed_at,
          taskTitle: entry.task?.title ?? '',
        };
      });
    },
  });
}

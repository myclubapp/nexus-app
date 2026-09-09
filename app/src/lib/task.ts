import type { PointRule, Task, TaskAssignment } from './database.types';

/**
 * Die Kategorien des Marktplatzes (UC-017, Schritt 2).
 *
 * Eine feste Liste und kein Freitext: UC-033 Schritt 2 lässt das Mitglied
 * seine Interessen aus **derselben** Liste wählen. Zwei Listen, die
 * auseinanderlaufen, ergeben kein Matching (FR-059). Sie steht deshalb hier
 * und nicht im Formular – die Datenbank prüft dieselben Werte (`0033`).
 */
export const TASK_CATEGORIES = [
  'organisation',
  'facility',
  'catering',
  'transport',
  'communication',
  'finance',
  'coaching',
  'other',
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

/** Punktwert, wenn der Verein keine Regel `task_done` konfiguriert hat. */
export const DEFAULT_TASK_POINTS = 20;

/**
 * Vorgeschlagener Punktwert einer Aufgabe (Schritt 2).
 *
 * Die Aufgabe trägt ihren Wert selbst (BR-068) – aber der Vorschlag darf sich
 * an dem orientieren, was der Verein für Aufgaben festgelegt hat. Sonst
 * schriebe jede Aufgabe eine Zahl fest, die zur Konfiguration nicht passt,
 * und die Punkteregel wäre eine Angabe ohne Wirkung.
 */
export function suggestedTaskPoints(
  rules: readonly Pick<PointRule, 'code' | 'points'>[] | undefined,
): number {
  const rule = rules?.find((entry) => entry.code === 'task_done');
  return rule ? rule.points : DEFAULT_TASK_POINTS;
}

export interface TaskDraft {
  title: string;
  why: string;
  description: string;
  category: TaskCategory;
  points: number;
  /** Lokale Eingabe `YYYY-MM-DDTHH:mm`; leer heisst «ohne Frist». */
  dueAt: string;
  maxAssignees: number;
  teamId: string | null;
  /** A2: Rhythmus in Tagen; `null` heisst einmalig. */
  recurrenceDays: number | null;
}

export type TaskProblem =
  | 'titleMissing'
  | 'whyMissing'
  | 'pointsNegative'
  | 'assigneesTooLow'
  | 'dueInPast'
  | 'recurrenceOutOfRange';

/**
 * Was an einer Aufgabe fehlt, bevor sie ausgeschrieben werden kann.
 *
 * `forPublication` trennt die beiden Wege aus Schritt 5: Ein Entwurf (A3)
 * braucht nur einen Titel, eine Publikation zusätzlich das Warum (BR-069).
 * Beide Regeln stehen zusätzlich als Constraint in der Datenbank – diese
 * Prüfung erspart der Person die Fehlermeldung, sie ersetzt sie nicht (C-011).
 */
export function validateTask(
  draft: TaskDraft,
  forPublication: boolean,
  now: Date = new Date(),
): TaskProblem[] {
  const problems: TaskProblem[] = [];

  if (draft.title.trim().length < 2) problems.push('titleMissing');
  if (forPublication && draft.why.trim().length === 0) problems.push('whyMissing');
  if (!Number.isFinite(draft.points) || draft.points < 0) problems.push('pointsNegative');
  if (!Number.isFinite(draft.maxAssignees) || draft.maxAssignees < 1) {
    problems.push('assigneesTooLow');
  }

  if (draft.dueAt) {
    const due = new Date(draft.dueAt);
    if (!Number.isNaN(due.getTime()) && due.getTime() <= now.getTime()) {
      problems.push('dueInPast');
    }
  }

  if (draft.recurrenceDays !== null) {
    if (
      !Number.isFinite(draft.recurrenceDays) ||
      draft.recurrenceDays < 1 ||
      draft.recurrenceDays > 730
    ) {
      problems.push('recurrenceOutOfRange');
    }
  }

  return problems;
}

export type TaskUrgency = 'expired' | 'urgent' | 'later' | 'none';

/** Ab wann eine Frist «bald» ist (BR-072). Zwei Tage, wie bei A3 aus UC-015. */
export const TASK_URGENT_HOURS = 48;

/**
 * Wie dringend ist eine Aufgabe (BR-072)?
 *
 * `none` heisst «ohne Frist» und nicht «unwichtig» – eine Aufgabe ohne Frist
 * kann nie dringend werden und wird deshalb nie hervorgehoben.
 */
export function taskUrgency(
  dueAt: string | null,
  now: Date = new Date(),
): TaskUrgency {
  if (!dueAt) return 'none';

  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return 'none';

  const hours = (due.getTime() - now.getTime()) / 3_600_000;
  if (hours < 0) return 'expired';
  if (hours <= TASK_URGENT_HOURS) return 'urgent';
  return 'later';
}

export interface TaskWithAssignments extends Task {
  assignments: TaskAssignment[];
}

export interface TaskCapacity {
  taken: number;
  open: number;
  isFull: boolean;
}

/**
 * Wie viele Plätze eine Aufgabe noch hat (A1, A2 aus UC-018).
 *
 * Gezählt werden alle Übernahmen, auch die bereits eingereichten: Wer
 * eingereicht hat, gibt den Platz nicht wieder frei.
 */
export function taskCapacity(task: TaskWithAssignments): TaskCapacity {
  const taken = task.assignments.length;
  const max = Math.max(1, task.max_assignees);

  return { taken, open: Math.max(0, max - taken), isFull: taken >= max };
}

export type TaskAction =
  /** Frei und im Angebot (Schritt 4). */
  | 'claim'
  /** Von der eigenen Person übernommen, noch nicht gemeldet (Schritt 7). */
  | 'submit'
  /** Gemeldet, wartet auf die Bestätigung (UC-019). */
  | 'awaiting'
  /** Bestätigt – die Punkte sind gebucht. */
  | 'confirmed'
  /** Vergeben, ohne dass die eigene Person dabei wäre (A1). */
  | 'full'
  /** Entwurf oder abgelaufen: kein Weg hinein. */
  | 'closed';

/**
 * Welcher Weg einer Person bei dieser Aufgabe offensteht.
 *
 * Eine Funktion und keine Kette von Bedingungen im JSX: Sie entscheidet in
 * der Detailansicht, in der Liste und im Test dasselbe – und sie ist die
 * einzige Stelle, an der «vergeben» und «von mir übernommen» auseinandergehen
 * (A1 gegen Schritt 5).
 */
export function taskAction(
  task: TaskWithAssignments,
  memberId: string | null,
): TaskAction {
  const mine = memberId
    ? task.assignments.find((entry) => entry.member_id === memberId)
    : undefined;

  if (mine?.confirmed_at) return 'confirmed';
  if (mine?.submitted_at) return 'awaiting';
  if (mine) return 'submit';

  if (task.status === 'draft' || task.status === 'expired') return 'closed';
  if (taskCapacity(task).isFull) return 'full';
  return 'claim';
}

/**
 * Der Nachweis ist ein Verweis, kein Anhang (A5, Entitätsmodell `proof_url`).
 *
 * Leer ist gültig – die Aufgabe verlangt ihn nicht. Was dasteht, soll aber
 * anklickbar sein: Ein Fragment ohne Schema führt niemanden irgendwohin.
 */
export function isProofUsable(proof: string): boolean {
  const value = proof.trim();
  if (value === '') return true;
  return /^https?:\/\/\S+$/i.test(value);
}

/**
 * A2 aus UC-019: der einmalige Hinweis, dass ein Dankeswort mehr wirkt als die
 * Zahl (BR-078).
 *
 * «Einmalig» heisst hier: solange das Feld leer ist. Ein gespeicherter Zustand
 * pro Person wäre eine Einstellung, die niemand je wieder findet – und der
 * Hinweis verschwindet ohnehin in dem Moment, in dem jemand zu schreiben
 * beginnt.
 */
export function needsKudosReminder(kudos: string): boolean {
  return kudos.trim().length === 0;
}

export interface TaskGroups {
  /** Vom angemeldeten Mitglied übernommen – zuoberst, weil offen. */
  mine: TaskWithAssignments[];
  /** Frist läuft ab oder ist abgelaufen (BR-072). */
  urgent: TaskWithAssignments[];
  open: TaskWithAssignments[];
  /** A3: nur für Trainer:innen und den Vorstand sichtbar. */
  drafts: TaskWithAssignments[];
  /**
   * A4: abgelaufen ohne Übernahme.
   *
   * Sie stehen hier, damit die Ablauf-Meldung nicht ins Leere führt – sie
   * verlinkt die Aufgabe, und eine Aufgabe, die in keiner Ansicht steht,
   * macht aus der Meldung eine Sackgasse. Die Policy aus `0034` zeigt sie
   * ohnehin nur der ausschreibenden Seite.
   */
  expired: TaskWithAssignments[];
}

/**
 * Die Abschnitte des Marktplatzes (UC-018, Schritt 2).
 *
 * Eine Aufgabe steht in genau einem Abschnitt: Eine übernommene Aufgabe ist
 * für ihr Mitglied keine Ausschreibung mehr, sondern eine Zusage – sie
 * nochmals unter «offen» zu zeigen, lüde zum zweiten Übernehmen ein.
 */
export function groupTasks(
  tasks: readonly TaskWithAssignments[],
  memberId: string | null,
  now: Date = new Date(),
): TaskGroups {
  const groups: TaskGroups = {
    mine: [],
    urgent: [],
    open: [],
    drafts: [],
    expired: [],
  };

  for (const task of tasks) {
    if (task.status === 'draft') {
      groups.drafts.push(task);
      continue;
    }

    if (task.status === 'expired') {
      groups.expired.push(task);
      continue;
    }

    const isMine =
      memberId !== null && task.assignments.some((a) => a.member_id === memberId);
    if (isMine) {
      groups.mine.push(task);
      continue;
    }

    // Abgelaufene und vergebene Aufgaben stehen nicht im Angebot: Sie sind
    // kein Beitrag, den noch jemand leisten könnte.
    if (task.status !== 'open' || taskCapacity(task).isFull) continue;

    const urgency = taskUrgency(task.due_at, now);
    if (urgency === 'urgent' || urgency === 'expired') {
      groups.urgent.push(task);
    } else {
      groups.open.push(task);
    }
  }

  return groups;
}

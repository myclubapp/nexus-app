import { useEffect, useState } from 'react';
import {
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonToggle,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { usePointRules } from '../hooks/useGamification';
import { usePlanningScope } from '../hooks/usePlanningScope';
import { useCreateTask, usePublishTask, useUpdateTask } from '../hooks/useTasks';
import { FormModal } from './FormModal';
import { DateField } from './DateField';
import { useSheetProps } from '../hooks/useSheetProps';
import { ListSection } from './ListSection';
import { ManageSection } from './ManageSection';
import { InlineError } from './StateViews';
import {
  TASK_CATEGORIES,
  suggestedTaskPoints,
  taskToDraft,
  validateTask,
  type TaskCategory,
  type TaskDraft,
} from '../lib/task';
import type { Task } from '../lib/database.types';

interface TaskFormProps {
  /** A5: ein bestehender Entwurf; ohne ihn entsteht eine neue Aufgabe. */
  task?: Task | null;
  onDone: (published: boolean, muted: boolean) => void;
  onDismiss: () => void;
  /** A6: der zweite Weg zum Löschen neben der Wischgeste (nur beim Bearbeiten). */
  onDelete?: (task: Task) => void;
  /** Das Blatt fährt mit `false` zu; der Inhalt bleibt, bis es unten ist. */
  isOpen?: boolean;
}

const DEFAULT_RECURRENCE_DAYS = 14;

/**
 * Aufgabe ausschreiben (UC-017).
 *
 * Der Ablauf der Spezifikation ist ein Formular mit zwei Ausgängen: Angaben
 * und Warum (Schritte 2–3), Geltungsbereich (Schritt 4), dann publizieren
 * (Schritt 5) **oder** als Entwurf sichern (A3).
 *
 * Dasselbe Blatt öffnet einen gesicherten Entwurf wieder (A5): Die Felder
 * beginnen mit dem gespeicherten Stand, und die beiden Ausgänge bleiben –
 * erneut sichern oder ausschreiben. Ein zweites Formular fürs Ändern hätte
 * dieselben Felder ein zweites Mal, mit der Gefahr, dass sie auseinanderlaufen.
 *
 * Eigene Komponente, weil `IonModal` seinen Inhalt im Test nicht rendert
 * (docs/TESTING.md).
 */
export function TaskForm({
  task = null,
  onDone,
  onDismiss,
  onDelete,
  isOpen = true,
}: TaskFormProps) {
  const { t } = useTranslation();
  const scope = usePlanningScope();
  const rules = usePointRules();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const publish = usePublishTask();

  // A5: Der gespeicherte Stand ist der Anfangswert. Nur beim Aufbau gelesen –
  // das Blatt entsteht beim Öffnen und fällt beim Schliessen (`useSheetProps`),
  // ein späterer Stand aus der Liste soll die Eingabe nicht überschreiben.
  const initial = task ? taskToDraft(task) : null;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [why, setWhy] = useState(initial?.why ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<TaskCategory>(initial?.category ?? 'organisation');
  // Schritt 2: Der Vorschlag folgt der Punkteregel des Vereins, solange
  // niemand selbst wählt. `0` als Sentinel zu verwenden hiesse, den
  // Nur-Dank-Modus zu verschlucken (FR-040). Ein Entwurf trägt seinen Wert
  // schon selbst (BR-068) – der bleibt, was gesichert wurde.
  const [pointsOverride, setPointsOverride] = useState<number | null>(
    initial ? initial.points : null,
  );
  const [dueAt, setDueAt] = useState(initial?.dueAt ?? '');
  const [maxAssignees, setMaxAssignees] = useState(initial?.maxAssignees ?? 1);
  const [teamId, setTeamId] = useState<string | null>(initial?.teamId ?? null);
  // C-032: Eine Trainer:in schreibt für ihr Team aus, nicht für den Verein.
  // Ihr erstes Team ist die Vorgabe; «ganzer Verein» steht ihr nicht zur Wahl.
  useEffect(() => {
    if (!scope.isBoard && teamId === null && scope.teams.length > 0) {
      setTeamId(scope.teams[0].id);
    }
  }, [scope.isBoard, scope.teams, teamId]);
  // A2: `null` heisst einmalig. Der Rhythmus bekommt erst einen Wert, wenn
  // jemand ihn ausdrücklich einschaltet – sonst entstünde aus jedem Versehen
  // eine Aufgabe, die für immer wiederkehrt.
  const [recurrenceDays, setRecurrenceDays] = useState<number | null>(
    initial?.recurrenceDays ?? null,
  );

  const points = pointsOverride ?? suggestedTaskPoints(rules.data);

  const draft: TaskDraft = {
    title,
    why,
    description,
    category,
    points,
    dueAt,
    maxAssignees,
    teamId,
    recurrenceDays,
  };

  const publishProblems = validateTask(draft, true);
  const draftProblems = validateTask(draft, false);

  const isBusy = createTask.isPending || updateTask.isPending || publish.isPending;
  const rawError =
    (createTask.error as Error | null)?.message ??
    (updateTask.error as Error | null)?.message ??
    (publish.error as Error | null)?.message ??
    null;
  // BR-182: Wer einen Entwurf ändert, den jemand inzwischen ausgeschrieben
  // hat, bekommt gesagt, warum nichts geschrieben wurde.
  const error = rawError === 'task_not_draft' ? t('taskForm.notDraftAnymore') : rawError;

  async function submit(shouldPublish: boolean) {
    let taskId: string;
    if (task) {
      await updateTask.mutateAsync({ taskId: task.id, draft });
      taskId = task.id;
    } else {
      taskId = await createTask.mutateAsync(draft);
    }

    if (!shouldPublish) {
      onDone(false, false);
      return;
    }

    const result = await publish.mutateAsync(taskId);
    onDone(true, result.muted);
  }

  return (
    <FormModal
      isOpen={isOpen}
      title={t(task ? 'taskForm.editTitle' : 'taskForm.title')}
      submitLabel={t('taskForm.publish')}
      canSubmit={publishProblems.length === 0 && !isBusy}
      isSubmitting={isBusy}
      error={error}
      onDismiss={onDismiss}
      onSubmit={() => void submit(true).catch(() => undefined)}
    >
      <ListSection>
        <IonItem>
          <IonInput
            label={t('taskForm.taskTitle')}
            labelPlacement="stacked"
            enterkeyhint="next"
            value={title}
            onIonInput={(e) => setTitle(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonTextarea
            label={t('taskForm.description')}
            labelPlacement="stacked"
            autoGrow
            value={description}
            onIonInput={(e) => setDescription(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonSelect
            label={t('taskForm.category')}
            labelPlacement="stacked"
            value={category}
            onIonChange={(e) => setCategory(e.detail.value as TaskCategory)}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
          >
            {TASK_CATEGORIES.map((code) => (
              <IonSelectOption key={code} value={code}>
                {t(`taskCategory.${code}`)}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      </ListSection>

      {/* BR-069: Das Warum ist Publikationsvoraussetzung, nicht Beiwerk –
          deshalb ein eigener Abschnitt und nicht ein Feld unter vielen. */}
      <ListSection title={t('taskForm.whyTitle')} footnote={t('taskForm.whyHint')}>
        <IonItem>
          <IonTextarea
            label={t('taskForm.why')}
            labelPlacement="stacked"
            autoGrow
            value={why}
            onIonInput={(e) => setWhy(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>

      <ListSection title={t('taskForm.conditions')} footnote={t('taskForm.pointsHint')}>
        <IonItem>
          <IonInput
            type="number"
            inputmode="numeric"
            min={0}
            enterkeyhint="next"
            label={t('taskForm.points')}
            labelPlacement="stacked"
            value={String(points)}
            onIonInput={(e) => {
              const raw = e.detail.value ?? '';
              // Ein geleertes Feld heisst «wieder der Vorschlag», eine 0 heisst 0.
              setPointsOverride(raw === '' ? null : Number(raw));
            }}
          />
        </IonItem>
        <DateField
          label={t('taskForm.dueAt')}
          presentation="date-time"
          value={dueAt}
          onChange={setDueAt}
          clearable
        />
        <IonItem>
          <IonInput
            type="number"
            inputmode="numeric"
            min={1}
            // Das letzte Textfeld schliesst die Tastatur – ausser der Rhythmus
            // hängt noch ein Feld an.
            enterkeyhint={recurrenceDays !== null ? 'next' : 'done'}
            label={t('taskForm.maxAssignees')}
            labelPlacement="stacked"
            value={String(maxAssignees)}
            onIonInput={(e) => setMaxAssignees(Number(e.detail.value ?? '1'))}
          />
        </IonItem>
      </ListSection>

      {/* Schritt 4: ganzer Verein oder ein Team – Ersteres nur für den Vorstand (C-032). */}
      <ListSection
        title={t('taskForm.scope')}
        footnote={
          !scope.isBoard && !scope.isLoading && scope.teams.length === 0
            ? t('common.noPlannableTeam')
            : t(scope.isBoard ? 'taskForm.scopeHint' : 'taskForm.scopeHintTeam')
        }
      >
        <IonItem>
          <IonSelect
            label={t('taskForm.team')}
            labelPlacement="stacked"
            value={teamId}
            onIonChange={(e) => setTeamId((e.detail.value as string | null) ?? null)}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
          >
            {scope.isBoard && (
              <IonSelectOption value={null}>{t('taskForm.wholeClub')}</IonSelectOption>
            )}
            {scope.teams.map((team) => (
              <IonSelectOption key={team.id} value={team.id}>
                {team.name}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      </ListSection>

      {/* A2: wiederkehrend. */}
      <ListSection title={t('taskForm.recurring')} footnote={t('taskForm.recurringHint')}>
        <IonItem>
          <IonToggle
            checked={recurrenceDays !== null}
            onIonChange={(e) =>
              setRecurrenceDays(e.detail.checked ? DEFAULT_RECURRENCE_DAYS : null)
            }
          >
            <IonLabel>{t('taskForm.repeats')}</IonLabel>
          </IonToggle>
        </IonItem>
        {recurrenceDays !== null && (
          <IonItem>
            <IonInput
              type="number"
              inputmode="numeric"
              min={1}
              max={730}
              enterkeyhint="done"
              label={t('taskForm.everyDays')}
              labelPlacement="stacked"
              value={String(recurrenceDays)}
              onIonInput={(e) => setRecurrenceDays(Number(e.detail.value ?? '1'))}
            />
          </IonItem>
        )}
      </ListSection>

      {/* A1: nicht nur sperren, sondern sagen, woran es liegt. */}
      {publishProblems.map((problem) => (
        <InlineError key={problem} message={t(`taskForm.problem.${problem}`)} />
      ))}

      {/* A3: Entwurf sichern – ohne Sichtbarkeit, ohne Zustellung. */}
      <div className="app-actions">
        <IonButton
          expand="block"
          fill="clear"
          disabled={draftProblems.length > 0 || isBusy}
          onClick={() => void submit(false).catch(() => undefined)}
        >
          {t('taskForm.saveDraft')}
        </IonButton>
        <IonNote>{t('taskForm.draftHint')}</IonNote>
      </div>

      {/* A6: Ein Entwurf, der nicht mehr gebraucht wird. Das Blatt schliesst
          zuerst, dann fragt die Seite nach – derselbe Alert wie beim Wischen. */}
      {task && onDelete && (
        <ManageSection
          actions={[
            {
              label: t('taskForm.deleteDraft'),
              onClick: () => onDelete(task),
              disabled: isBusy,
              destructive: true,
            },
          ]}
        />
      )}
    </FormModal>
  );
}


/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function TaskFormModal({
  isOpen,
  ...props
}: TaskFormProps & { isOpen: boolean }) {
  const sheet = useSheetProps(isOpen ? props : null);
  return sheet && <TaskForm {...sheet} />;
}

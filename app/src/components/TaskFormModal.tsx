import { useState } from 'react';
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
import { useTeams } from '../hooks/useInvites';
import { useCreateTask, usePublishTask } from '../hooks/useTasks';
import { FormModal } from './FormModal';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import {
  TASK_CATEGORIES,
  suggestedTaskPoints,
  validateTask,
  type TaskCategory,
  type TaskDraft,
} from '../lib/task';

interface TaskFormProps {
  onDone: (published: boolean, muted: boolean) => void;
  onDismiss: () => void;
}

const DEFAULT_RECURRENCE_DAYS = 14;

/**
 * Aufgabe ausschreiben (UC-017).
 *
 * Der Ablauf der Spezifikation ist ein Formular mit zwei Ausgängen: Angaben
 * und Warum (Schritte 2–3), Geltungsbereich (Schritt 4), dann publizieren
 * (Schritt 5) **oder** als Entwurf sichern (A3).
 *
 * Eigene Komponente, weil `IonModal` seinen Inhalt im Test nicht rendert
 * (docs/TESTING.md).
 */
export function TaskForm({ onDone, onDismiss }: TaskFormProps) {
  const { t } = useTranslation();
  const teams = useTeams();
  const rules = usePointRules();
  const createTask = useCreateTask();
  const publish = usePublishTask();

  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('organisation');
  // Schritt 2: Der Vorschlag folgt der Punkteregel des Vereins, solange
  // niemand selbst wählt. `0` als Sentinel zu verwenden hiesse, den
  // Nur-Dank-Modus zu verschlucken (FR-040).
  const [pointsOverride, setPointsOverride] = useState<number | null>(null);
  const [dueAt, setDueAt] = useState('');
  const [maxAssignees, setMaxAssignees] = useState(1);
  const [teamId, setTeamId] = useState<string | null>(null);
  // A2: `null` heisst einmalig. Der Rhythmus bekommt erst einen Wert, wenn
  // jemand ihn ausdrücklich einschaltet – sonst entstünde aus jedem Versehen
  // eine Aufgabe, die für immer wiederkehrt.
  const [recurrenceDays, setRecurrenceDays] = useState<number | null>(null);

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

  const isBusy = createTask.isPending || publish.isPending;
  const error =
    (createTask.error as Error | null)?.message ??
    (publish.error as Error | null)?.message ??
    null;

  async function submit(shouldPublish: boolean) {
    const taskId = await createTask.mutateAsync(draft);

    if (!shouldPublish) {
      onDone(false, false);
      return;
    }

    const result = await publish.mutateAsync(taskId);
    onDone(true, result.muted);
  }

  return (
    <FormModal
      isOpen
      title={t('taskForm.title')}
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
        <IonItem>
          <IonInput
            type="datetime-local"
            label={t('taskForm.dueAt')}
            labelPlacement="stacked"
            value={dueAt}
            onIonInput={(e) => setDueAt(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput
            type="number"
            inputmode="numeric"
            min={1}
            label={t('taskForm.maxAssignees')}
            labelPlacement="stacked"
            value={String(maxAssignees)}
            onIonInput={(e) => setMaxAssignees(Number(e.detail.value ?? '1'))}
          />
        </IonItem>
      </ListSection>

      {/* Schritt 4: ganzer Verein oder ein Team. */}
      <ListSection title={t('taskForm.scope')} footnote={t('taskForm.scopeHint')}>
        <IonItem>
          <IonSelect
            label={t('taskForm.team')}
            labelPlacement="stacked"
            value={teamId}
            onIonChange={(e) => setTeamId((e.detail.value as string | null) ?? null)}
          >
            <IonSelectOption value={null}>{t('taskForm.wholeClub')}</IonSelectOption>
            {(teams.data ?? []).map((team) => (
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
    </FormModal>
  );
}

/** Blatt-Hülle; der Inhalt entsteht erst beim Öffnen. */
export function TaskFormModal({
  isOpen,
  ...props
}: TaskFormProps & { isOpen: boolean }) {
  if (!isOpen) return null;
  return <TaskForm {...props} />;
}

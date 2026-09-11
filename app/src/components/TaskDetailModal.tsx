import { useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useClub } from '../hooks/useClub';
import { useClaimTask, useReleaseTask, useSubmitTask } from '../hooks/useTasks';
import { FormModal } from './FormModal';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import { formatDate } from '../lib/format';
import { isSample } from '../lib/sample';
import {
  isProofUsable,
  taskAction,
  taskCapacity,
  taskUrgency,
  type TaskWithAssignments,
} from '../lib/task';

interface TaskDetailProps {
  task: TaskWithAssignments;
  /** `warned` sagt, ob die Rückgabe die ausschreibende Person erreicht hat. */
  onDone: (outcome: 'claimed' | 'submitted' | 'released', warned: boolean) => void;
  onDismiss: () => void;
}

/**
 * Eine Aufgabe ansehen und übernehmen (UC-018, Schritte 3–7).
 *
 * Schritt 3 verlangt ausdrücklich, dass Beschreibung **und** Warum lesbar
 * sind, bevor jemand zusagt – in der Liste stehen beide gekürzt. Deshalb ein
 * eigenes Blatt und nicht ein Knopf mehr in der Zeile.
 *
 * Welcher Weg offensteht, entscheidet `taskAction()` und nicht diese Ansicht:
 * Sonst hinge die Regel an der Reihenfolge von JSX-Bedingungen.
 */
export function TaskDetail({ task, onDone, onDismiss }: TaskDetailProps) {
  const { t } = useTranslation();
  const { activeMembership } = useClub();
  const claim = useClaimTask();
  const submit = useSubmitTask();
  const release = useReleaseTask();

  const [proof, setProof] = useState('');

  // A2: An einem Beispiel gibt es nichts zu übernehmen. Der Server weist es
  // ohnehin ab (`claim_task()` seit `0053`); ein Knopf, der in eine
  // Fehlermeldung führt, wäre ein Versprechen, das die App bricht.
  const sample = isSample(task);
  const action = sample ? 'none' : taskAction(task, activeMembership?.id ?? null);
  const capacity = taskCapacity(task);
  const urgency = taskUrgency(task.due_at);
  const proofUsable = isProofUsable(proof);

  const isBusy = claim.isPending || submit.isPending || release.isPending;
  const error =
    (claim.error as Error | null)?.message ??
    (submit.error as Error | null)?.message ??
    (release.error as Error | null)?.message ??
    null;

  // Der Hauptknopf des Blattes richtet sich nach dem Zustand: übernehmen,
  // solange die Aufgabe frei ist – melden, sobald sie übernommen ist.
  const isActionable = action === 'claim' || action === 'submit';
  const canSubmitForm = isActionable ? proofUsable : true;

  // Ein gesperrter «Übernehmen»-Knopf über einer Aufgabe, an der nichts zu tun
  // ist, sagt das Falsche. Wo es keinen Weg gibt, schliesst der Hauptknopf –
  // das ist auf iOS ohnehin die Rolle des rechten Knopfs im Blatt.
  const submitLabel = isActionable
    ? action === 'submit'
      ? t('taskDetail.report')
      : t('marketplace.claim')
    : t('common.close');

  function run() {
    if (action === 'claim') {
      claim.mutate(task.id, { onSuccess: () => onDone('claimed', false) });
      return;
    }
    if (action === 'submit') {
      submit.mutate(
        { taskId: task.id, proofUrl: proof },
        { onSuccess: () => onDone('submitted', false) },
      );
      return;
    }
    onDismiss();
  }

  return (
    <FormModal
      isOpen
      title={task.title}
      submitLabel={submitLabel}
      canSubmit={canSubmitForm && !isBusy}
      isSubmitting={isBusy}
      error={error}
      onDismiss={onDismiss}
      onSubmit={run}
    >
      {/* Schritt 3: Warum zuerst. Es ist der Grund, aus dem jemand zusagt. */}
      {sample && (
        <ListSection title={t('sample.badge')}>
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <p>{t('sample.blocked')}</p>
            </IonLabel>
          </IonItem>
        </ListSection>
      )}

      {task.why && (
        <ListSection title={t('taskForm.whyTitle')}>
          <IonItem>
            <IonLabel className="ion-text-wrap">
              <p>{task.why}</p>
            </IonLabel>
          </IonItem>
        </ListSection>
      )}

      {task.description && (
        <ListSection title={t('taskForm.description')}>
          <IonItem>
            <IonLabel className="ion-text-wrap">
              <p>{task.description}</p>
            </IonLabel>
          </IonItem>
        </ListSection>
      )}

      <ListSection title={t('taskDetail.facts')}>
        <IonItem>
          <IonLabel>{t('taskForm.category')}</IonLabel>
          <IonNote slot="end">{t(`taskCategory.${task.category}`)}</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>{t('taskForm.dueAt')}</IonLabel>
          <IonNote slot="end">
            {task.due_at ? formatDate(task.due_at) : t('taskDetail.noDeadline')}
          </IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>{t('taskForm.points')}</IonLabel>
          {task.points > 0 ? (
            <IonBadge slot="end" color="primary">
              +{task.points}
            </IonBadge>
          ) : (
            <IonNote slot="end">{t('marketplace.thanksOnly')}</IonNote>
          )}
        </IonItem>
        {/* BR-073: Die Reservation ist sichtbar, damit niemand doppelt arbeitet. */}
        <IonItem>
          <IonLabel>{t('taskDetail.taken')}</IonLabel>
          <IonNote slot="end">
            {t('marketplace.capacity', {
              taken: capacity.taken,
              total: task.max_assignees,
            })}
          </IonNote>
        </IonItem>
      </ListSection>

      {/* A4: Die Frist hält niemanden auf – sie wird gesagt, nicht erzwungen. */}
      {urgency === 'expired' && action === 'submit' && (
        <IonNote className="app-footnote">{t('taskDetail.lateHint')}</IonNote>
      )}

      {/* Schritt 7 und A5: der Nachweis, freiwillig. */}
      {action === 'submit' && (
        <ListSection title={t('taskDetail.proof')} footnote={t('taskDetail.proofHint')}>
          <IonItem>
            <IonInput
              type="url"
              inputmode="url"
              label={t('taskDetail.proofLabel')}
              labelPlacement="stacked"
              value={proof}
              onIonInput={(e) => setProof(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      )}

      {!proofUsable && <InlineError message={t('taskDetail.proofInvalid')} />}

      {action === 'full' && <InlineError message={t('taskDetail.full')} />}
      {action === 'awaiting' && (
        <IonNote className="app-footnote">{t('taskDetail.awaiting')}</IonNote>
      )}
      {/* A3: «Doch nicht» – ohne Punkteabzug und ohne Vermerk (BR-075). */}
      {/* A3: Zurückgeben kann nur, wer noch nicht bestätigt ist – `taskAction()`
          hält 'confirmed' davon fern, und der Server weist es zusätzlich ab. */}
      {(action === 'submit' || action === 'awaiting') && (
        <div className="app-actions">
          <IonButton
            expand="block"
            fill="clear"
            color="medium"
            disabled={isBusy}
            onClick={() =>
              release.mutate(task.id, {
                onSuccess: (warned) => onDone('released', warned),
              })
            }
          >
            {t('taskDetail.release')}
          </IonButton>
          <IonNote>{t('taskDetail.releaseHint')}</IonNote>
        </div>
      )}
    </FormModal>
  );
}

/** Blatt-Hülle; der Inhalt entsteht erst beim Öffnen. */
export function TaskDetailModal({
  task,
  ...props
}: Omit<TaskDetailProps, 'task'> & { task: TaskWithAssignments | null }) {
  if (!task) return null;
  return <TaskDetail task={task} {...props} />;
}

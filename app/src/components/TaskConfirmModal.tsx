import { useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonItem,
  IonLabel,
  IonNote,
  IonSpinner,
  IonTextarea,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useClub } from '../hooks/useClub';
import {
  useConfirmTask,
  useRejectTask,
  useTaskRoster,
  type TaskRosterEntry,
} from '../hooks/useTasks';
import { FormModal } from './FormModal';
import { useSheetProps } from '../hooks/useSheetProps';
import { ListSection } from './ListSection';
import { EmptyState, InlineError } from './StateViews';
import { SkeletonList } from './Skeletons';
import { formatDateTime } from '../lib/format';
import { needsKudosReminder, type TaskWithAssignments } from '../lib/task';

interface TaskConfirmProps {
  task: TaskWithAssignments;
  onDone: (outcome: 'confirmed' | 'rejected', points: number, booked: boolean) => void;
  onDismiss: () => void;
  /** Das Blatt fährt mit `false` zu; der Inhalt bleibt, bis es unten ist. */
  isOpen?: boolean;
}

/**
 * Eine Einreichung entgegennehmen (UC-019, Schritte 2–5, A1, A2).
 *
 * Die Reihenfolge im Blatt folgt BR-078: zuerst, wer was geleistet hat, dann
 * das Dankeswort – und die Punktzahl steht nirgends als Überschrift. Sie
 * erscheint erst in der Rückmeldung, nachgeordnet.
 */
export function TaskConfirm({ task, onDone, onDismiss, isOpen = true }: TaskConfirmProps) {
  const { t } = useTranslation();
  const { activeMembership } = useClub();
  const roster = useTaskRoster(task.id);
  const confirm = useConfirmTask();
  const reject = useRejectTask();

  // Je Übernahme ein eigenes Dankeswort: Ein gemeinsames Feld schriebe allen
  // denselben Satz, und das ist kein persönlicher Dank mehr.
  const [kudos, setKudos] = useState<Record<string, string>>({});
  // A1 hat sein eigenes Feld: Ein gemeinsamer Zustand hiesse, dass der Dank
  // zum Mängelhinweis wird, sobald jemand zwischen den beiden Wegen wechselt.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const entries = roster.data ?? [];
  // BR-080: Die eigene Übernahme bestätigt jemand anderes. Sie hier
  // anzubieten hiesse, einen Knopf zu zeigen, der jedes Mal eine Fehlermeldung
  // ergibt – die Regel steht auf dem Server, die Ansicht muss sie kennen.
  const pending = entries.filter(
    (entry) =>
      entry.submittedAt !== null &&
      entry.confirmedAt === null &&
      entry.memberId !== activeMembership?.id,
  );
  const ownPending = entries.some(
    (entry) =>
      entry.submittedAt !== null &&
      entry.confirmedAt === null &&
      entry.memberId === activeMembership?.id,
  );
  const isBusy = confirm.isPending || reject.isPending;
  const error =
    (confirm.error as Error | null)?.message ??
    (reject.error as Error | null)?.message ??
    (roster.error as Error | null)?.message ??
    null;

  function kudosFor(entry: TaskRosterEntry): string {
    return kudos[entry.assignmentId] ?? '';
  }

  function noteFor(entry: TaskRosterEntry): string {
    return notes[entry.assignmentId] ?? '';
  }

  return (
    // Ein Blatt, das anzeigt: «Schliessen» steht einmal in der Kopfzeile. Was
    // hier etwas tut, tut es je Einreichung im Inhalt (guidelines.md §2).
    <FormModal isOpen={isOpen} title={task.title} error={error} onDismiss={onDismiss}>
      {roster.isLoading ? (
        <SkeletonList />
      ) : entries.length === 0 ? (
        <EmptyState message={t('taskConfirm.nobody')} />
      ) : (
        <ListSection
          title={t('taskConfirm.submissions', { count: pending.length })}
          footnote={t('taskConfirm.hint')}
        >
          {entries.map((entry) => (
            <IonItem key={entry.assignmentId} lines="full">
              <IonLabel className="ion-text-wrap">
                <h2>{entry.displayName}</h2>
                <IonNote>
                  {entry.confirmedAt
                    ? t('taskConfirm.confirmedOn', {
                        date: formatDateTime(entry.confirmedAt),
                      })
                    : entry.submittedAt
                      ? t('taskConfirm.submittedOn', {
                          date: formatDateTime(entry.submittedAt),
                        })
                      : t('taskConfirm.notYet')}
                </IonNote>

                {/* Schritt 3: der Nachweis, sofern einer da ist. Als Text und
                    nicht als Verweis: Ein Link aus fremder Hand gehört nicht
                    ungeprüft in einen Klick. */}
                {entry.proofUrl && <p>{entry.proofUrl}</p>}

                {entry.confirmedAt && entry.kudos && <p>«{entry.kudos}»</p>}
              </IonLabel>

              {entry.confirmedAt && (
                <IonBadge slot="end" color="success">
                  {t('taskConfirm.done')}
                </IonBadge>
              )}
            </IonItem>
          ))}
        </ListSection>
      )}

      {/* BR-080 sichtbar gemacht, statt den Knopf nur wegzulassen. */}
      {ownPending && <IonNote className="app-footnote">{t('taskConfirm.notYourOwn')}</IonNote>}

      {/* Schritte 4 und 5, je offene Einreichung. */}
      {pending.map((entry) => (
        <ListSection
          key={entry.assignmentId}
          title={t('taskConfirm.thanksFor', { name: entry.displayName })}
          footnote={t('taskConfirm.thanksHint')}
        >
          <IonItem>
            <IonTextarea
              label={t('taskConfirm.kudos')}
              labelPlacement="stacked"
              autoGrow
              value={kudosFor(entry)}
              onIonInput={(e) =>
                setKudos((current) => ({
                  ...current,
                  [entry.assignmentId]: e.detail.value ?? '',
                }))
              }
            />
          </IonItem>

          {/* A2: einmalig darauf hinweisen – und nur, solange nichts dasteht. */}
          {needsKudosReminder(kudosFor(entry)) && (
            <IonItem lines="none">
              <IonNote>{t('taskConfirm.kudosReminder')}</IonNote>
            </IonItem>
          )}

          <IonItem lines="none">
            <IonButton
              slot="start"
              size="small"
              disabled={isBusy}
              onClick={() =>
                confirm.mutate(
                  { assignmentId: entry.assignmentId, kudos: kudosFor(entry) },
                  {
                    onSuccess: (result) =>
                      onDone('confirmed', result.points, result.booked),
                  },
                )
              }
            >
              {/* Die Aktion läuft im auslösenden Knopf (guidelines.md §4). */}
              {confirm.isPending && confirm.variables?.assignmentId === entry.assignmentId ? (
                <IonSpinner name="crescent" />
              ) : (
                t('taskConfirm.confirm')
              )}
            </IonButton>

            {/* A1: zurück an die Person – der Hinweis ist Pflicht, weil eine
                Rückgabe ohne Grund eine Sackgasse wäre. */}
            <IonButton
              slot="end"
              size="small"
              fill="clear"
              color="medium"
              disabled={isBusy}
              onClick={() =>
                setOpenId(openId === entry.assignmentId ? null : entry.assignmentId)
              }
            >
              {t('taskConfirm.reject')}
            </IonButton>
          </IonItem>

          {openId === entry.assignmentId && (
            <>
              <IonItem>
                <IonTextarea
                  label={t('taskConfirm.note')}
                  labelPlacement="stacked"
                  autoGrow
                  value={noteFor(entry)}
                  onIonInput={(e) =>
                    setNotes((current) => ({
                      ...current,
                      [entry.assignmentId]: e.detail.value ?? '',
                    }))
                  }
                />
              </IonItem>
              <IonItem lines="none">
                <IonButton
                  expand="block"
                  fill="outline"
                  color="medium"
                  disabled={isBusy || noteFor(entry).trim().length === 0}
                  onClick={() =>
                    reject.mutate(
                      { assignmentId: entry.assignmentId, note: noteFor(entry) },
                      { onSuccess: () => onDone('rejected', 0, false) },
                    )
                  }
                >
                  {t('taskConfirm.sendBack')}
                </IonButton>
              </IonItem>
              {noteFor(entry).trim().length === 0 && (
                <InlineError message={t('taskConfirm.noteRequired')} />
              )}
            </>
          )}
        </ListSection>
      ))}
    </FormModal>
  );
}


/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function TaskConfirmModal({
  task,
  ...props
}: Omit<TaskConfirmProps, 'task'> & { task: TaskWithAssignments | null }) {
  const sheet = useSheetProps(task ? { task, ...props } : null);
  return sheet && <TaskConfirm {...sheet} />;
}

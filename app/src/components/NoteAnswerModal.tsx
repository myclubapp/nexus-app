import { useState } from 'react';
import {
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonToggle,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useClub } from '../hooks/useClub';
import { usePointRules } from '../hooks/useGamification';
import { usePublishNews } from '../hooks/useNews';
import {
  useAnswerNote,
  useConvertNoteToTask,
  useFlagNote,
  useNoteThread,
  useSetNoteStatus,
} from '../hooks/useVoice';
import { FormModal } from './FormModal';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import { formatDateTime } from '../lib/format';
import { TASK_CATEGORIES, suggestedTaskPoints, type TaskCategory } from '../lib/task';
import {
  NOTE_STATUSES,
  canAnswer,
  isClosed,
  taskTitleFrom,
  validateAnswer,
  type NoteStatus,
  type VoiceNote,
} from '../lib/voice';

interface NoteAnswerProps {
  note: VoiceNote;
  onDone: (outcome: 'answered' | 'declined' | 'flagged') => void;
  onDismiss: () => void;
}

/**
 * Ein Anliegen beantworten (UC-030, Schritte 4–7).
 *
 * Alles, was die Spezifikation an einem Anliegen vorsieht, steht in **einem**
 * Blatt: der Status mit einem Tipp (Schritt 4), die Antwort (Schritte 5–6),
 * und die beiden Nebenwege, die laut A2 und A3 in Schritt 6 zurückführen –
 * «als News publizieren» und «in Aufgabe umwandeln». Drei getrennte Dialoge
 * würden aus einem Entscheid drei Bedienschritte machen.
 *
 * Die Ablehnung (A4) ist derselbe Weg mit einem anderen Knopf: BR-128 lässt
 * keinen Endstatus ohne Begründung zu, und deshalb verlangen beide Ausgänge
 * denselben Text.
 */
export function NoteAnswer({ note, onDone, onDismiss }: NoteAnswerProps) {
  const { t } = useTranslation();
  const { isAdmin } = useClub();
  const rules = usePointRules();
  const thread = useNoteThread(note.id);
  const setStatus = useSetNoteStatus();
  const answer = useAnswerNote();
  const convert = useConvertNoteToTask();
  const publishNews = usePublishNews();
  const flag = useFlagNote();

  const [text, setText] = useState('');
  const [asNews, setAsNews] = useState(false);
  const [asTask, setAsTask] = useState(false);
  const [title, setTitle] = useState(taskTitleFrom(note.transcript));
  const [why, setWhy] = useState('');
  const [category, setCategory] = useState<TaskCategory>('organisation');
  const [points, setPoints] = useState<number | null>(null);
  // Scheitert die Antwort nach dem Folge-Artefakt, wird nur die Antwort
  // wiederholt. Ohne diese beiden Merker entstünde beim zweiten Versuch eine
  // zweite News – und die Umwandlung liefe gegen BR-130 ins Leere.
  const [taskDone, setTaskDone] = useState(false);
  const [newsDone, setNewsDone] = useState(false);

  const closed = isClosed(note);
  const suggested = suggestedTaskPoints(rules.data);
  const taskPoints = points ?? suggested;

  // BR-130: Aus einem Anliegen entsteht höchstens **eine** Aufgabe. Ist sie da,
  // fällt der Weg weg statt am Server zu scheitern.
  const canConvert = note.taskId === null;

  const isBusy =
    answer.isPending || convert.isPending || publishNews.isPending || flag.isPending;
  const error =
    (answer.error as Error | null)?.message ??
    (convert.error as Error | null)?.message ??
    (publishNews.error as Error | null)?.message ??
    (flag.error as Error | null)?.message ??
    null;

  const problems = validateAnswer({ text, asTask, taskTitle: title, taskWhy: why });
  const ready = problems.length === 0;

  /**
   * Schritte 6–7 in der Reihenfolge, in der sie voneinander abhängen.
   *
   * Die Antwort steht zuletzt: Sie setzt den Endstatus, und ein Anliegen soll
   * nicht als beantwortet gelten, wenn die Aufgabe daraus nie entstanden ist.
   */
  async function send(decline: boolean) {
    if (asTask && !decline && !taskDone) {
      await convert.mutateAsync({
        noteId: note.id,
        title,
        why,
        category,
        points: taskPoints,
        dueAt: null,
      });
      setTaskDone(true);
    }

    if (asNews && !decline && !newsDone) {
      await publishNews.mutateAsync({
        title: t('noteAnswer.newsTitle'),
        body: text,
        teamId: null,
        imageUrl: '',
      });
      setNewsDone(true);
    }

    await answer.mutateAsync({ noteId: note.id, answer: text, decline });
    onDone(decline ? 'declined' : 'answered');
  }

  return (
    <FormModal
      isOpen
      title={t('noteAnswer.title')}
      submitLabel={closed ? t('common.close') : t('noteAnswer.send')}
      canSubmit={closed ? true : ready && !isBusy}
      isSubmitting={isBusy}
      error={error}
      onDismiss={onDismiss}
      onSubmit={() => {
        if (closed) {
          onDismiss();
          return;
        }
        void send(false).catch(() => undefined);
      }}
    >
      {/* Schritt 3: das Anliegen selbst – Wort für Wort, ungekürzt. */}
      <ListSection title={t(`voice.kind.${note.kind}`)} footnote={note.createdWeek}>
        <IonItem lines="none">
          <IonLabel className="ion-text-wrap">
            <p>{note.transcript}</p>
          </IonLabel>
        </IonItem>
      </ListSection>

      {/* A1, Schritt 2: Wer anonym nachfasst, muss gelesen werden können. */}
      {(thread.data ?? []).length > 0 && (
        <ListSection title={t('noteAnswer.thread')}>
          {(thread.data ?? []).map((message, index) => (
            <IonItem key={`${message.at}-${index}`}>
              <IonLabel className="ion-text-wrap">
                <h2>{t(`noteAnswer.side.${message.side}`)}</h2>
                <p>{message.body}</p>
                <IonNote>{formatDateTime(message.at)}</IonNote>
              </IonLabel>
            </IonItem>
          ))}
        </ListSection>
      )}

      {closed ? (
        <ListSection title={t('noteAnswer.answerTitle')} footnote={t('noteAnswer.closedHint')}>
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <p>{note.response}</p>
            </IonLabel>
          </IonItem>
        </ListSection>
      ) : (
        <>
          {/* Schritt 4: ein Tipp, kein Formular. */}
          <ListSection title={t('noteAnswer.statusTitle')} footnote={t('noteAnswer.statusHint')}>
            <IonItem lines="none">
              <IonSegment
                value={NOTE_STATUSES.includes(note.status as NoteStatus) ? note.status : 'open'}
                onIonChange={(e) =>
                  setStatus.mutate({
                    noteId: note.id,
                    status: e.detail.value as NoteStatus,
                  })
                }
              >
                {NOTE_STATUSES.map((status) => (
                  <IonSegmentButton key={status} value={status}>
                    <IonLabel>{t(`voice.status.${status}`)}</IonLabel>
                  </IonSegmentButton>
                ))}
              </IonSegment>
            </IonItem>
          </ListSection>

          {/* Schritt 5: die Antwort. Sie ist Pflicht – auch für die Ablehnung. */}
          <ListSection title={t('noteAnswer.answerTitle')} footnote={t('noteAnswer.answerHint')}>
            <IonItem>
              <IonTextarea
                label={t('noteAnswer.answerLabel')}
                labelPlacement="stacked"
                autoGrow
                rows={5}
                value={text}
                onIonInput={(e) => setText(e.detail.value ?? '')}
              />
            </IonItem>
          </ListSection>

          {/* A2 und A3: die beiden Folge-Artefakte aus BR-130. */}
          <ListSection title={t('noteAnswer.followTitle')} footnote={isAdmin ? t('noteAnswer.followHintAdmin') : t('noteAnswer.followHint')}>
            {/* A2 nennt ausdrücklich den Vorstand: Eine Antwort an alle ist
                eine Vereinsmitteilung, keine Sache der adressierten Person. */}
            {isAdmin && (
              <IonItem>
                <IonToggle
                  checked={asNews}
                  onIonChange={(e) => setAsNews(e.detail.checked)}
                >
                  {t('noteAnswer.asNews')}
                </IonToggle>
              </IonItem>
            )}
            {canConvert ? (
              <IonItem>
                <IonToggle checked={asTask} onIonChange={(e) => setAsTask(e.detail.checked)}>
                  {t('noteAnswer.asTask')}
                </IonToggle>
              </IonItem>
            ) : (
              // BR-130: Ein gesperrter Schalter ohne Grund sagt das Falsche –
              // hier steht, warum der Weg zu ist.
              <IonItem lines="none">
                <IonLabel className="ion-text-wrap">
                  <p>{t('noteAnswer.taskExists')}</p>
                </IonLabel>
              </IonItem>
            )}
          </ListSection>

          {asTask && (
            <ListSection title={t('noteAnswer.taskTitle')} footnote={t('noteAnswer.taskHint')}>
              <IonItem>
                <IonInput
                  label={t('taskForm.title')}
                  labelPlacement="stacked"
                  value={title}
                  onIonInput={(e) => setTitle(e.detail.value ?? '')}
                />
              </IonItem>
              <IonItem>
                <IonTextarea
                  label={t('taskForm.why')}
                  labelPlacement="stacked"
                  autoGrow
                  value={why}
                  onIonInput={(e) => setWhy(e.detail.value ?? '')}
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
                  {TASK_CATEGORIES.map((entry) => (
                    <IonSelectOption key={entry} value={entry}>
                      {t(`taskCategory.${entry}`)}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonInput
                  type="number"
                  label={t('taskForm.points')}
                  labelPlacement="stacked"
                  value={taskPoints}
                  onIonInput={(e) => setPoints(Number(e.detail.value ?? 0))}
                />
              </IonItem>
            </ListSection>
          )}

          {problems.map((problem) => (
            <InlineError key={problem} message={t(`noteAnswer.problem.${problem}`)} />
          ))}

          <div className="app-actions">
            {/* A4: die Ablehnung ist derselbe Weg, nicht das Ausbleiben einer
                Antwort. */}
            <IonButton
              expand="block"
              fill="outline"
              color="warning"
              disabled={!canAnswer(text) || isBusy}
              onClick={() => void send(true).catch(() => undefined)}
            >
              {t('noteAnswer.decline')}
            </IonButton>
            {/* A6: melden – entzieht das Anliegen der Inbox, löscht es nicht. */}
            <IonButton
              expand="block"
              fill="clear"
              color="danger"
              disabled={isBusy}
              onClick={() =>
                flag.mutate(note.id, { onSuccess: () => onDone('flagged') })
              }
            >
              {t('noteAnswer.flag')}
            </IonButton>
          </div>
        </>
      )}
    </FormModal>
  );
}

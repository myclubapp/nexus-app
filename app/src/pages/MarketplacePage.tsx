import { useEffect, useRef, useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonIcon,
  IonItem,
  IonLabel,
  IonNote,
} from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { TaskFormModal } from '../components/TaskFormModal';
import { StatCard } from '../components/StatCard';
import { useClub } from '../hooks/useClub';
import { useToast } from '../hooks/useToast';
import { useMyTaskCount, usePublishTask, useTasks } from '../hooks/useTasks';
import { formatDate } from '../lib/format';
import {
  groupTasks,
  taskCapacity,
  taskUrgency,
  type TaskWithAssignments,
} from '../lib/task';

/**
 * Der Marktplatz (UC-017 Schritt 6, UC-018 Schritte 1–3).
 *
 * Vier Abschnitte statt einer Liste: Was ich übernommen habe, was drängt
 * (BR-072), was offen ist, und – nur für Trainer:innen und den Vorstand – was
 * noch Entwurf ist (A3). Eine Aufgabe steht in genau einem davon.
 */
export function MarketplacePage() {
  const { t } = useTranslation();
  const { activeMembership, isTrainer } = useClub();
  const toast = useToast();
  const tasks = useTasks();
  const publish = usePublishTask();
  const taskCount = useMyTaskCount();

  const [formOpen, setFormOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  // Der Vorschlag verlinkt `/tabs/marketplace?task=<id>` und soll die Aufgabe
  // zeigen, nicht bloss den Marktplatz (BR-070).
  const location = useLocation();
  const highlightId = new URLSearchParams(location.search).get('task');
  const highlightRef = useRef<HTMLIonItemElement | null>(null);

  const items = tasks.data ?? [];
  const groups = groupTasks(items, activeMembership?.id ?? null);
  const isEmpty =
    groups.mine.length === 0 &&
    groups.urgent.length === 0 &&
    groups.open.length === 0 &&
    groups.drafts.length === 0 &&
    groups.expired.length === 0;

  useEffect(() => {
    if (!highlightId) return;
    // Erst nach dem Zeichnen: Vorher hat die Liste den Eintrag noch nicht.
    const timer = window.setTimeout(
      () => highlightRef.current?.scrollIntoView({ block: 'center' }),
      120,
    );
    return () => window.clearTimeout(timer);
  }, [highlightId, items.length]);

  // Die geöffnete Aufgabe wird aus der Liste gelesen und nicht kopiert:
  // Nach dem Übernehmen soll das Blatt den neuen Stand zeigen, nicht den von
  // vorhin.
  const openTask = items.find((entry) => entry.id === openTaskId) ?? null;

  function renderTask(task: TaskWithAssignments, action: 'open' | 'publish' | 'none') {
    const capacity = taskCapacity(task);
    const urgency = taskUrgency(task.due_at);
    const isHighlighted = task.id === highlightId;

    return (
      <IonItem
        key={task.id}
        ref={isHighlighted ? highlightRef : undefined}
        color={isHighlighted ? 'light' : undefined}
        button={action !== 'publish'}
        detail={action !== 'publish'}
        onClick={action === 'publish' ? undefined : () => setOpenTaskId(task.id)}
      >
        <IonLabel className="ion-text-wrap">
          <h2>{task.title}</h2>
          {/* BR-069/FR-051: Das Warum steht bei der Aufgabe, nicht hinter
              einem zweiten Antippen. */}
          {task.why && <p>{task.why}</p>}
          <IonNote>
            {t(`taskCategory.${task.category}`)}
            {task.due_at ? ` · ${t('marketplace.dueOn', { date: formatDate(task.due_at) })}` : ''}
            {task.max_assignees > 1
              ? ` · ${t('marketplace.capacity', {
                  taken: capacity.taken,
                  total: task.max_assignees,
                })}`
              : ''}
          </IonNote>

          {/* BR-072: Dringlichkeit ist sichtbar. */}
          {urgency === 'urgent' && (
            <p>
              <IonBadge color="warning">{t('marketplace.urgent')}</IonBadge>
            </p>
          )}
          {urgency === 'expired' && (
            <p>
              <IonBadge color="danger">{t('marketplace.overdue')}</IonBadge>
            </p>
          )}
        </IonLabel>

        {/* Nur-Dank-Modus: eine 0 als Punktzahl wäre eine Aussage über den
            Wert des Beitrags, die niemand gemeint hat (FR-040). */}
        {task.points > 0 ? (
          <IonBadge slot="end" color="primary">
            +{task.points}
          </IonBadge>
        ) : (
          <IonNote slot="end">{t('marketplace.thanksOnly')}</IonNote>
        )}

        {action === 'publish' && (
          <IonButton
            slot="end"
            size="small"
            disabled={publish.isPending}
            onClick={() =>
              publish.mutate(task.id, {
                onSuccess: (result) =>
                  toast.success(
                    t(result.muted ? 'taskForm.publishedMuted' : 'taskForm.published'),
                  ),
                onError: (cause) => toast.failure(cause.message),
              })
            }
          >
            {t('taskForm.publish')}
          </IonButton>
        )}

        {action === 'none' && (
          <IonNote slot="end">
            {task.status === 'expired'
              ? t('marketplace.overdue')
              : task.status === 'submitted'
                ? t('marketplace.awaitingConfirmation')
                : t('marketplace.claimed')}
          </IonNote>
        )}
      </IonItem>
    );
  }

  return (
    <AppPage
      title={t('marketplace.title')}
      onRefresh={() => tasks.refetch()}
      toolbarEnd={
        isTrainer ? (
          <IonButtons slot="end">
            <IonButton onClick={() => setFormOpen(true)}>
              <IonIcon
                slot="icon-only"
                icon={addOutline}
                aria-label={t('taskForm.title')}
              />
            </IonButton>
          </IonButtons>
        ) : undefined
      }
    >
      {tasks.isLoading ? (
        <SkeletonList />
      ) : tasks.error ? (
        <ErrorState error={tasks.error as Error} onRetry={() => void tasks.refetch()} />
      ) : isEmpty ? (
        <EmptyState message={t('marketplace.empty')} />
      ) : (
        <>
          {/* FR-057/BR-076: Die eigene Zahl macht die Verteilung sichtbar,
              ohne eine Rangliste über Personen zu ziehen (NFR-022). */}
          <div className="app-stat-row">
            <StatCard
              value={taskCount.data ?? 0}
              label={t('marketplace.takenThisSeason')}
            />
            <StatCard
              value={groups.urgent.length + groups.open.length}
              label={t('marketplace.openNow')}
              accent="tertiary"
            />
          </div>

          {groups.mine.length > 0 && (
            <ListSection title={t('marketplace.mine')}>
              {groups.mine.map((task) => renderTask(task, 'open'))}
            </ListSection>
          )}

          {groups.urgent.length > 0 && (
            <ListSection
              title={t('marketplace.urgentSection')}
              footnote={t('marketplace.urgentHint')}
            >
              {groups.urgent.map((task) => renderTask(task, 'open'))}
            </ListSection>
          )}

          {groups.open.length > 0 && (
            <ListSection title={t('marketplace.openSection')} footnote={t('marketplace.subtitle')}>
              {groups.open.map((task) => renderTask(task, 'open'))}
            </ListSection>
          )}

          {/* A3: Entwürfe sieht nur, wer sie ausschreiben kann. Die Policy
              blendet sie für Mitglieder ohnehin aus – der Abschnitt bleibt
              damit auch ohne Rollenprüfung im Client leer. */}
          {groups.drafts.length > 0 && (
            <ListSection
              title={t('marketplace.drafts')}
              footnote={t('marketplace.draftsHint')}
            >
              {groups.drafts.map((task) => renderTask(task, 'publish'))}
            </ListSection>
          )}

          {/* A4: Die Ablauf-Meldung verlinkt die Aufgabe – hier steht sie.
              Ohne diesen Abschnitt führte die Meldung in einen Marktplatz,
              in dem die gemeldete Aufgabe fehlt. */}
          {groups.expired.length > 0 && (
            <ListSection
              title={t('marketplace.expired')}
              footnote={t('marketplace.expiredHint')}
            >
              {groups.expired.map((task) => renderTask(task, 'none'))}
            </ListSection>
          )}
        </>
      )}

      <TaskDetailModal
        task={openTask}
        onDismiss={() => setOpenTaskId(null)}
        onDone={(outcome, warned) => {
          // Nach jedem der drei Wege ist an dieser Aufgabe im Blatt nichts mehr
          // zu tun. Schritt 5 sagt, wohin der Blick gehört: in die persönliche
          // Liste – und die steht dahinter.
          setOpenTaskId(null);
          if (outcome === 'claimed') {
            toast.success(t('marketplace.claimed'));
          } else if (outcome === 'submitted') {
            toast.success(t('taskDetail.reported'));
          } else {
            toast.success(
              t(warned ? 'taskDetail.releasedWarned' : 'taskDetail.released'),
            );
          }
        }}
      />

      <TaskFormModal
        isOpen={formOpen}
        onDismiss={() => setFormOpen(false)}
        onDone={(published, muted) => {
          setFormOpen(false);
          if (!published) {
            toast.success(t('taskForm.draftSaved'));
          } else {
            toast.success(t(muted ? 'taskForm.publishedMuted' : 'taskForm.published'));
          }
        }}
      />
    </AppPage>
  );
}

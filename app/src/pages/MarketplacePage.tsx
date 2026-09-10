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
import { TaskConfirmModal } from '../components/TaskConfirmModal';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { TaskFormModal } from '../components/TaskFormModal';
import { StatCard } from '../components/StatCard';
import { useClub } from '../hooks/useClub';
import { useToast } from '../hooks/useToast';
import { useMyTaskCount, usePublishTask, useTasks } from '../hooks/useTasks';
import {
  useContributionBudget,
  useContributionProfile,
  useMatchingTasks,
  useMatchingVacancies,
} from '../hooks/useContribution';
import { ContributionProfileForm } from '../components/ContributionProfileModal';
import { isBudgetSpent, isProfileFilled } from '../lib/contribution';
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
  const profile = useContributionProfile();
  const matching = useMatchingTasks();
  const vacancies = useMatchingVacancies();
  const budget = useContributionBudget();
  const publish = usePublishTask();
  const taskCount = useMyTaskCount();

  const [formOpen, setFormOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [confirmTaskId, setConfirmTaskId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // Der Vorschlag verlinkt `/tabs/marketplace?task=<id>` und soll die Aufgabe
  // zeigen, nicht bloss den Marktplatz (BR-070).
  const location = useLocation();
  const highlightId = new URLSearchParams(location.search).get('task');
  const highlightRef = useRef<HTMLIonItemElement | null>(null);

  const items = tasks.data ?? [];
  const groups = groupTasks(items, activeMembership?.id ?? null);

  // Die geöffnete Aufgabe wird aus der Liste gelesen und nicht kopiert:
  // Nach dem Übernehmen soll das Blatt den neuen Stand zeigen, nicht den von
  // vorhin.
  const openTask = items.find((entry) => entry.id === openTaskId) ?? null;
  const confirmTask = items.find((entry) => entry.id === confirmTaskId) ?? null;

  // UC-019 Schritt 2: Was liegt zur Bestätigung bereit? Eine Aufgabe zählt
  // dazu, sobald **eine** Übernahme gemeldet und noch nicht bestätigt ist –
  // auf die übrigen zu warten hiesse, den Dank zu verzögern.
  // BR-080: Die eigene Übernahme bestätigt jemand anderes – eine Aufgabe, an
  // der nur die eigene Meldung offen ist, gehört nicht in diese Liste.
  const filled = isProfileFilled(profile.data ?? null);
  const budgetSpent = isBudgetSpent(budget.data);
  const suggestions = matching.data ?? [];
  const openVacancies = vacancies.data ?? [];

  const toConfirm = isTrainer
    ? items.filter((entry) =>
        entry.assignments.some(
          (a) =>
            a.submitted_at !== null &&
            a.confirmed_at === null &&
            a.member_id !== activeMembership?.id,
        ),
      )
    : [];

  const isEmpty =
    groups.mine.length === 0 &&
    groups.urgent.length === 0 &&
    groups.open.length === 0 &&
    groups.drafts.length === 0 &&
    groups.expired.length === 0 &&
    toConfirm.length === 0;

  useEffect(() => {
    if (!highlightId) return;
    // Erst nach dem Zeichnen: Vorher hat die Liste den Eintrag noch nicht.
    const timer = window.setTimeout(
      () => highlightRef.current?.scrollIntoView({ block: 'center' }),
      120,
    );
    return () => window.clearTimeout(timer);
  }, [highlightId, items.length]);

  function renderTask(
    task: TaskWithAssignments,
    action: 'open' | 'publish' | 'confirm' | 'none',
  ) {
    const capacity = taskCapacity(task);
    const urgency = taskUrgency(task.due_at);
    const isHighlighted = task.id === highlightId;

    return (
      <IonItem
        key={task.id}
        ref={isHighlighted ? highlightRef : undefined}
        color={isHighlighted ? 'light' : undefined}
        button={action === 'open' || action === 'confirm'}
        detail={action === 'open' || action === 'confirm'}
        onClick={
          action === 'confirm'
            ? () => setConfirmTaskId(task.id)
            : action === 'open'
              ? () => setOpenTaskId(task.id)
              : undefined
        }
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

          {/* UC-019 Schritt 2: Der Dank ist das Dringendste im Marktplatz –
              er steht zuoberst und nicht hinter dem Angebot. */}
          {toConfirm.length > 0 && (
            <ListSection
              title={t('taskConfirm.waiting')}
              footnote={t('taskConfirm.waitingHint')}
            >
              {toConfirm.map((task) => renderTask(task, 'confirm'))}
            </ListSection>
          )}

          {/* UC-033: «Für dich» – der Unterschied zwischen ausschreiben und
              anbieten (BR-142). Der Abschnitt steht vor der offenen Liste,
              weil ein Angebot mehr ist als ein Aushang. */}
          {filled && suggestions.length > 0 && (
            <ListSection
              title={t('contribution.forYou')}
              footnote={t('contribution.forYouHint')}
              action={
                <IonButton fill="clear" size="small" onClick={() => setProfileOpen(true)}>
                  {t('contribution.edit')}
                </IonButton>
              }
            >
              {suggestions.map((suggestion) => {
                const task = (tasks.data ?? []).find((entry) => entry.id === suggestion.id);
                // Die Liste des Marktplatzes ist der Normalfall; der Rückfall
                // greift, wenn ein Vorschlag ausserhalb ihres Ausschnitts liegt.
                return task ? (
                  renderTask(task, 'open')
                ) : (
                  <IonItem key={suggestion.id}>
                    <IonLabel className="ion-text-wrap">
                      <h2>{suggestion.title}</h2>
                      {suggestion.why && <p>{suggestion.why}</p>}
                      <IonNote>
                        {t(`taskCategory.${suggestion.category}`)} ·{' '}
                        {t('common.points', { count: suggestion.points })}
                      </IonNote>
                    </IonLabel>
                  </IonItem>
                );
              })}
            </ListSection>
          )}

          {/* Ein Fehler der Vorschlagsabfrage blendete den Abschnitt bisher
              still aus – er sähe aus wie «nichts passt» (guidelines §9). */}
          {filled && matching.error && (
            <ListSection title={t('contribution.forYou')}>
              <ErrorState
                error={matching.error as Error}
                onRetry={() => void matching.refetch()}
              />
            </ListSection>
          )}

          {/* A4: Das Budget ist ausgeschöpft. Die Ansicht sagt es, statt eine
              leere Liste zu zeigen – sonst sähe es aus, als gäbe es nichts. */}
          {filled && budgetSpent && (
            <ListSection title={t('contribution.forYou')} footnote={t('contribution.budgetSpentHint')}>
              <IonItem lines="none">
                <IonLabel className="ion-text-wrap">
                  <p>{t('contribution.budgetSpent')}</p>
                </IonLabel>
              </IonItem>
            </ListSection>
          )}

          {/* A3: Kein Treffer heisst nicht «nichts zu tun» – es heisst, dass
              sich der Verein meldet, sobald etwas passt. */}
          {filled && !budgetSpent && suggestions.length === 0 && openVacancies.length === 0 && (
            <ListSection title={t('contribution.forYou')} footnote={t('contribution.noMatchHint')}>
              <IonItem lines="none">
                <IonLabel className="ion-text-wrap">
                  <p>{t('contribution.noMatch')}</p>
                </IonLabel>
              </IonItem>
            </ListSection>
          )}

          {/* Der zweite Teil des Ziels: Ämter werden angeboten, nicht
              ausgeschrieben. */}
          {filled && openVacancies.length > 0 && (
            <ListSection
              title={t('contribution.vacancies')}
              footnote={t('contribution.vacanciesHint')}
            >
              {openVacancies.map((vacancy) => (
                <IonItem key={vacancy.id}>
                  <IonLabel className="ion-text-wrap">
                    <h2>{vacancy.title}</h2>
                  </IonLabel>
                </IonItem>
              ))}
            </ListSection>
          )}

          {/* BR-143: Ohne Profil bleibt alles nutzbar – die Einladung dazu ist
              eine Zeile, kein Hindernis. */}
          {!filled && (
            <ListSection title={t('contribution.inviteTitle')} footnote={t('contribution.voluntary')}>
              <IonItem button detail onClick={() => setProfileOpen(true)}>
                <IonLabel className="ion-text-wrap">
                  <h2>{t('contribution.invite')}</h2>
                  <IonNote>{t('contribution.inviteHint')}</IonNote>
                </IonLabel>
              </IonItem>
            </ListSection>
          )}

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

      {profileOpen && (
        <ContributionProfileForm
          profile={profile.data ?? null}
          onDismiss={() => setProfileOpen(false)}
          onDone={() => {
            setProfileOpen(false);
            toast.success(t('contribution.saved'));
          }}
        />
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

      <TaskConfirmModal
        task={confirmTask}
        onDismiss={() => setConfirmTaskId(null)}
        onDone={(outcome, points, booked) => {
          if (outcome === 'rejected') {
            toast.success(t('taskConfirm.sentBack'));
            return;
          }
          // BR-078: Die Rückmeldung nennt den Dank, nicht die Zahl – und wenn
          // nichts gebucht wurde, erst recht keine Null.
          toast.success(
            booked && points > 0
              ? t('taskConfirm.confirmedWithPoints', { count: points })
              : t('taskConfirm.confirmed'),
          );
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

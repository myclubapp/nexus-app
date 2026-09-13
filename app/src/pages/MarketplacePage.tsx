import { useEffect, useRef, useState } from 'react';
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
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
import { ShiftListModal } from '../components/ShiftListModal';
import { StatCard } from '../components/StatCard';
import { useClub } from '../hooks/useClub';
import { useToast } from '../hooks/useToast';
import { useDeleteTask, useMyTaskCount, usePublishTask, useTasks } from '../hooks/useTasks';
import { useAgenda } from '../hooks/useAgenda';
import {
  useContributionBudget,
  useContributionProfile,
  useMatchingTasks,
  useMatchingVacancies,
} from '../hooks/useContribution';
import { ContributionProfileModal } from '../components/ContributionProfileModal';
import { OfficeDetailModal } from '../components/OfficeDetailModal';
import { useOffices } from '../hooks/useOffices';
import { isVacant, openSeats, sortOffices } from '../lib/office';
import { isBudgetSpent, isProfileFilled } from '../lib/contribution';
import { canActOn, isSample } from '../lib/sample';
import { formatDate, formatDateTime } from '../lib/format';
import { openShiftOffers } from '../lib/shift';
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
  // UC-011, Schritt 9: «in Agenda **und** Marktplatz». Dieselbe Abfrage wie die
  // Agenda – ein zweiter Weg zu denselben Terminen wäre eine zweite Wahrheit.
  const agenda = useAgenda('upcoming');
  const [shiftEventId, setShiftEventId] = useState<string | null>(null);
  const profile = useContributionProfile();
  const matching = useMatchingTasks();
  const vacancies = useMatchingVacancies();
  // UC-041/FR-127: die Ämter mit freien Sitzen – für alle, nicht nur für
  // Profile mit Organisation oder Finanzen (BR-183).
  const offices = useOffices();
  const budget = useContributionBudget();
  const publish = usePublishTask();
  const deleteTask = useDeleteTask();
  const taskCount = useMyTaskCount();

  const [formOpen, setFormOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  // A6: der Entwurf, dessen Löschung gerade zur Rückfrage steht.
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [confirmTaskId, setConfirmTaskId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [openOfficeId, setOpenOfficeId] = useState<string | null>(null);

  // Der Vorschlag verlinkt `/tabs/marketplace?task=<id>` und soll die Aufgabe
  // zeigen, nicht bloss den Marktplatz (BR-070).
  const location = useLocation();
  const highlightId = new URLSearchParams(location.search).get('task');
  const highlightRef = useRef<HTMLIonItemElement | null>(null);

  // Nur ausgeschriebene, nicht abgesagte und keine Beispiele – dieselbe
  // Bedingung wie in der Agenda, und `canActOn()` sagt den Rest (BR-161).
  const offers = openShiftOffers(
    (agenda.data ?? []).filter(
      (event) =>
        event.published_at !== null && event.cancelled_at === null && canActOn(event),
    ),
  );
  const shiftEvent = (agenda.data ?? []).find((entry) => entry.id === shiftEventId);

  const items = tasks.data ?? [];
  const groups = groupTasks(items, activeMembership?.id ?? null);

  // Die geöffnete Aufgabe wird aus der Liste gelesen und nicht kopiert:
  // Nach dem Übernehmen soll das Blatt den neuen Stand zeigen, nicht den von
  // vorhin.
  const openTask = items.find((entry) => entry.id === openTaskId) ?? null;
  const confirmTask = items.find((entry) => entry.id === confirmTaskId) ?? null;
  const deleteCandidate =
    items.find((entry) => entry.id === deleteTaskId && entry.status === 'draft') ?? null;

  // UC-019 Schritt 2: Was liegt zur Bestätigung bereit? Eine Aufgabe zählt
  // dazu, sobald **eine** Übernahme gemeldet und noch nicht bestätigt ist –
  // auf die übrigen zu warten hiesse, den Dank zu verzögern.
  // BR-080: Die eigene Übernahme bestätigt jemand anderes – eine Aufgabe, an
  // der nur die eigene Meldung offen ist, gehört nicht in diese Liste.
  const filled = isProfileFilled(profile.data ?? null);
  const budgetSpent = isBudgetSpent(budget.data);
  const suggestions = matching.data ?? [];
  const openVacancies = vacancies.data ?? [];
  // Vakante Ämter, die grösste Lücke zuoberst; «Passt zu dir» kommt aus dem
  // Beitrags-Profil dazu, ersetzt aber die Liste nicht.
  const vacantOffices = sortOffices(offices.data ?? []).filter(isVacant);
  const matchedOfficeIds = new Set(openVacancies.map((vacancy) => vacancy.id));
  const openOffice = (offices.data ?? []).find((office) => office.id === openOfficeId) ?? null;

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
    toConfirm.length === 0 &&
    vacantOffices.length === 0;

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

    const item = (
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

          {/* BR-160: Ein Beispiel, das aussieht wie ein echter Vereinsinhalt,
              ist schlimmer als eine leere Fläche – es erzeugt eine Erwartung,
              die niemand einlöst. */}
          {isSample(task) && (
            <p>
              <IonBadge color="medium">{t('sample.badge')}</IonBadge>
            </p>
          )}

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

    if (action !== 'publish') return item;

    // A6: Der Entwurf lässt sich wegwischen – das Löschen fragt zuerst nach.
    return (
      <IonItemSliding key={task.id}>
        {item}
        <IonItemOptions side="end">
          <IonItemOption
            color="danger"
            disabled={deleteTask.isPending}
            onClick={() => setDeleteTaskId(task.id)}
          >
            {t('taskForm.deleteDraft')}
          </IonItemOption>
        </IonItemOptions>
      </IonItemSliding>
    );
  }

  return (
    <AppPage
      title={t('marketplace.title')}
      onRefresh={() => tasks.refetch()}
      createActions={
        isTrainer
          ? [
              {
                icon: addOutline,
                label: t('taskForm.title'),
                onClick: () => setFormOpen(true),
              },
            ]
          : undefined
      }
    >
      {tasks.isLoading ? (
        <SkeletonList />
      ) : tasks.error ? (
        <ErrorState error={tasks.error as Error} onRetry={() => void tasks.refetch()} />
      ) : isEmpty ? (
        <EmptyState
          message={t('marketplace.empty')}
          action={
            isTrainer
              ? { label: t('taskForm.title'), onClick: () => setFormOpen(true) }
              : { label: t('agenda.title'), routerLink: '/tabs/agenda' }
          }
        />
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
          {/* UC-041, FR-127: «Amt zu vergeben» – für alle Mitglieder. Die
              Sitzrechnung kommt aus `office_open_seats()` (BR-183); das
              Beitrags-Profil ergänzt nur «Passt zu dir» (UC-033). Antippen
              öffnet das Factsheet, die letzte Zeile führt zum Organigramm. */}
          {vacantOffices.length > 0 && (
            <ListSection
              title={t('offices.marketplaceSection')}
              footnote={t('offices.marketplaceHint')}
            >
              {vacantOffices.map((office) => (
                <IonItem key={office.id} button detail onClick={() => setOpenOfficeId(office.id)}>
                  <IonLabel className="ion-text-wrap">
                    <h2>{office.title}</h2>
                    <IonNote>
                      {[
                        matchedOfficeIds.has(office.id) ? t('offices.matches') : null,
                        office.hoursPerSeason,
                        office.pointsLabel,
                      ]
                        .filter((part): part is string => Boolean(part))
                        .join(' · ')}
                    </IonNote>
                  </IonLabel>
                  <IonBadge slot="end" color="warning">
                    {t('offices.openSeats', { count: openSeats(office) })}
                  </IonBadge>
                </IonItem>
              ))}
              <IonItem button detail routerLink="/tabs/marketplace/offices">
                <IonLabel className="ion-text-wrap">
                  <h2>{t('offices.allOffices')}</h2>
                  <IonNote>{t('offices.allOfficesHint')}</IonNote>
                </IonLabel>
              </IonItem>
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

          {/* UC-011, Postcondition: Das Helfer-Event stand bisher nur in der
              Agenda. Der Marktplatz beantwortet dieselbe Frage wie die
              Aufgaben darüber – wo kann ich beitragen? –, und ein Aufruf, den
              man dort nicht findet, ist ein halber Aufruf. */}
          {offers.length > 0 && (
            <ListSection
              title={t('shifts.marketplaceSection')}
              footnote={t('shifts.marketplaceHint')}
            >
              {offers.map(({ event, open, needed }) => (
                <IonItem
                  key={event.id}
                  button
                  detail
                  onClick={() => setShiftEventId(event.id)}
                >
                  <IonLabel className="ion-text-wrap">
                    <h2>{event.title}</h2>
                    <p>{formatDateTime(event.starts_at)}</p>
                    {event.why && <IonNote>{event.why}</IonNote>}
                  </IonLabel>
                  {/* BR-041: im Badge nur die Zahl, der Wortlaut für
                      Bedienhilfen – wie in der Agenda (guidelines §2). */}
                  <IonBadge
                    slot="end"
                    color="tertiary"
                    aria-label={t('agenda.shiftNeeded', { filled: needed - open, needed })}
                  >
                    {needed - open}/{needed}
                  </IonBadge>
                </IonItem>
              ))}
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

      {/* Dasselbe Blatt wie in der Ämterliste: Wer ein Amt ansieht, soll es
          überall gleich sehen. Bearbeiten gehört in die Ämterliste. */}
      <OfficeDetailModal office={openOffice} onDismiss={() => setOpenOfficeId(null)} />

      <ContributionProfileModal
        isOpen={profileOpen}
        profile={profile.data ?? null}
        onDismiss={() => setProfileOpen(false)}
        onDone={() => {
          setProfileOpen(false);
          toast.success(t('contribution.saved'));
        }}
      />

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

      {/* Dasselbe Blatt wie in der Agenda (UC-012): Wer eine Schicht
          übernimmt, soll sie überall gleich übernehmen. */}
      <ShiftListModal
        isOpen={shiftEventId !== null}
        why={shiftEvent?.why ?? null}
        shifts={shiftEvent?.shifts ?? []}
        attendance={shiftEvent?.attendance ?? []}
        memberId={activeMembership?.id ?? null}
        onDismiss={() => setShiftEventId(null)}
      />

      {/* A6: Die Rückfrage steht **vor** dem Löschen; der Knopf ist rot über
          seine Rolle. Ein Entwurf war nie sichtbar – weg ist er ohne Spur. */}
      <IonAlert
        isOpen={deleteCandidate !== null}
        header={t('taskForm.deleteDraft')}
        message={t('taskForm.deleteDraftConfirm', { title: deleteCandidate?.title ?? '' })}
        onDidDismiss={() => setDeleteTaskId(null)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('taskForm.deleteDraft'),
            role: 'destructive',
            handler: () => {
              const id = deleteCandidate?.id;
              if (!id) return;
              deleteTask.mutate(id, {
                onSuccess: () => toast.success(t('taskForm.draftDeleted')),
                onError: (cause) =>
                  toast.failure(
                    cause.message === 'task_not_draft'
                      ? t('taskForm.notDraftAnymore')
                      : cause.message,
                  ),
              });
            },
          },
        ]}
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

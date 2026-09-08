import { IonBadge, IonButton, IonItem, IonLabel, IonList, IonNote } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useClaimTask, useTasks } from '../hooks/useGamification';
import { useClub } from '../hooks/useClub';
import { AppPage } from '../components/AppPage';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { formatDate } from '../lib/format';

export function MarketplacePage() {
  const { t } = useTranslation();
  const { activeMembership } = useClub();
  const tasks = useTasks();
  const claim = useClaimTask();

  const items = tasks.data ?? [];

  return (
    <AppPage title={t('marketplace.title')} onRefresh={() => tasks.refetch()}>
      {tasks.isLoading ? (
        <LoadingState />
      ) : tasks.error ? (
        <ErrorState error={tasks.error as Error} onRetry={() => void tasks.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState message={t('marketplace.empty')} />
      ) : (
        <IonList inset>
          {items.map((task) => {
            const mine = task.assignments?.some(
              (a) => a.member_id === activeMembership?.id,
            );
            const full = (task.assignments?.length ?? 0) >= (task.max_assignees ?? 1);

            return (
              <IonItem key={task.id}>
                <IonLabel className="ion-text-wrap">
                  <h2>{task.title}</h2>
                  {task.description && <p>{task.description}</p>}
                  <IonNote>
                    {task.due_at
                      ? t('marketplace.dueOn', { date: formatDate(task.due_at) })
                      : ''}
                    {task.category ? ` · ${task.category}` : ''}
                  </IonNote>
                </IonLabel>

                <IonBadge slot="end" color="primary">
                  +{task.points}
                </IonBadge>
                {mine ? (
                  <IonNote slot="end">{t('marketplace.claimed')}</IonNote>
                ) : (
                  <IonButton
                    slot="end"
                    size="small"
                    disabled={full || claim.isPending}
                    onClick={() => claim.mutate(task.id)}
                  >
                    {t('marketplace.claim')}
                  </IonButton>
                )}
              </IonItem>
            );
          })}
        </IonList>
      )}
    </AppPage>
  );
}

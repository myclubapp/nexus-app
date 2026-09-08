import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonNote,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useClub } from '../hooks/useClub';
import { useMyPoints, usePointRules } from '../hooks/useGamification';
import { useAgenda } from '../hooks/useAgenda';
import { useNews } from '../hooks/useNews';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { StatCard } from '../components/StatCard';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { formatDateTime } from '../lib/format';

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeMembership, eventLabel } = useClub();
  const points = useMyPoints();
  const rules = usePointRules();
  const agenda = useAgenda('upcoming');
  const news = useNews(5);

  const nextRules = (rules.data ?? []).slice(0, 3);
  const nextEvents = (agenda.data ?? []).slice(0, 3);

  return (
    <AppPage
      title={t('dashboard.title')}
      largeTitle={t('dashboard.greeting', {
        name: activeMembership?.display_name ?? '',
      })}
      onRefresh={() =>
        Promise.all([points.refetch(), agenda.refetch(), news.refetch()])
      }
    >
      {points.isLoading ? (
        <LoadingState />
      ) : points.error ? (
        <ErrorState error={points.error as Error} onRetry={() => void points.refetch()} />
      ) : (
        <div className="app-stat-row">
          <StatCard value={points.total} label={t('dashboard.seasonPoints')} />
        </div>
      )}

      <ListSection title={t('dashboard.nextPoints')}>
        {nextRules.length === 0 ? (
          <EmptyState message={t('common.empty')} />
        ) : (
          nextRules.map((rule) => (
            <IonItem key={rule.id}>
              <IonLabel className="ion-text-wrap">
                <h2>{rule.label}</h2>
                <IonNote>{t('dashboard.nextPointsHint')}</IonNote>
              </IonLabel>
              <IonNote slot="end" color="primary">
                +{rule.points}
              </IonNote>
            </IonItem>
          ))
        )}
      </ListSection>

      <ListSection title={t('dashboard.upcoming')}>
        {nextEvents.length === 0 ? (
          <EmptyState message={t('agenda.empty')} />
        ) : (
          nextEvents.map((event) => (
            <IonItem key={event.id} button detail onClick={() => navigate('/tabs/agenda')}>
              <IonLabel className="ion-text-wrap">
                <h2>{event.title}</h2>
                <IonNote>
                  {eventLabel(event.type)} · {formatDateTime(event.starts_at)}
                </IonNote>
              </IonLabel>
            </IonItem>
          ))
        )}
      </ListSection>

      <ListSection title={t('dashboard.latestNews')} inset={false}>
        {(news.data ?? []).length === 0 ? (
          <EmptyState message={t('dashboard.noNews')} />
        ) : (
          (news.data ?? []).map((entry) => (
            <IonCard key={entry.id}>
              <IonCardHeader>
                <IonCardSubtitle>{formatDateTime(entry.published_at)}</IonCardSubtitle>
                <IonCardTitle>{entry.title}</IonCardTitle>
              </IonCardHeader>
              {entry.body && <IonCardContent>{entry.body}</IonCardContent>}
            </IonCard>
          ))
        )}
      </ListSection>
    </AppPage>
  );
}

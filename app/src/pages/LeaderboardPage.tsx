import { useState } from 'react';
import {
  IonAvatar,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useLeaderboard } from '../hooks/useGamification';
import { useClub } from '../hooks/useClub';
import { AppPage } from '../components/AppPage';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';

type Scope = 'club' | 'team';

export function LeaderboardPage() {
  const { t } = useTranslation();
  const { activeMembership } = useClub();
  const [scope, setScope] = useState<Scope>('club');
  const leaderboard = useLeaderboard(scope);

  const rows = leaderboard.data ?? [];

  return (
    <AppPage
      title={t('leaderboard.title')}
      subToolbar={
        <IonSegment value={scope} onIonChange={(e) => setScope(e.detail.value as Scope)}>
          <IonSegmentButton value="club">
            <IonLabel>{t('leaderboard.club')}</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="team">
            <IonLabel>{t('leaderboard.team')}</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      }
      onRefresh={() => leaderboard.refetch()}
    >
      {activeMembership && !activeMembership.leaderboard_opt_in && (
        <IonNote color="medium" className="app-hint">
          {t('leaderboard.optOutNotice')}
        </IonNote>
      )}

      {leaderboard.isLoading ? (
        <SkeletonList rows={6} />
      ) : leaderboard.error ? (
        <ErrorState
          error={leaderboard.error as Error}
          onRetry={() => void leaderboard.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState message={t('leaderboard.empty')} />
      ) : (
        <IonList inset>
          {rows.map((row) => (
            <IonItem
              key={row.member_id}
              color={row.member_id === activeMembership?.id ? 'light' : undefined}
            >
              <IonNote slot="start">{row.rank}</IonNote>
              {row.avatar_url && (
                <IonAvatar slot="start">
                  <img src={row.avatar_url} alt="" />
                </IonAvatar>
              )}
              <IonLabel>{row.display_name}</IonLabel>
              <IonNote slot="end" color="primary">
                {row.total_points}
              </IonNote>
            </IonItem>
          ))}
        </IonList>
      )}
    </AppPage>
  );
}

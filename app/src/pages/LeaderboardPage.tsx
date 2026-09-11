import { Fragment, useState } from 'react';
import {
  IonAvatar,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useLeaderboard, useMyTeams } from '../hooks/useGamification';
import { useClub } from '../hooks/useClub';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import {
  LEADERBOARD_PERIODS,
  hasRankGap,
  leaderboardLimit,
  ownRank,
  type LeaderboardPeriod,
} from '../lib/leaderboard';
import { PILLARS, type Pillar } from '../lib/pointRule';

type Scope = 'club' | 'team';

export function LeaderboardPage() {
  const { t } = useTranslation();
  const { activeClub, activeMembership } = useClub();
  const myTeams = useMyTeams();

  const [scope, setScope] = useState<Scope>('club');
  const [period, setPeriod] = useState<LeaderboardPeriod>('season');
  const [pillar, setPillar] = useState<Pillar | null>(null);

  const teams = myTeams.data ?? [];
  // A4: Wer keinem Team angehört, bekommt die Team-Ansicht gar nicht erst zur
  // Wahl – eine Umschaltung, die immer ins Leere führt, ist keine Wahl.
  const hasTeam = teams.length > 0;
  const [teamId, setTeamId] = useState<string | null>(null);
  const activeTeamId = teamId ?? teams[0]?.id ?? null;

  const leaderboard = useLeaderboard({
    teamId: scope === 'team' ? activeTeamId : null,
    period,
    pillar,
    limit: leaderboardLimit(activeClub?.settings),
  });

  const rows = leaderboard.data ?? [];
  const showGap = hasRankGap(rows);
  const myRank = ownRank(rows);

  return (
    <AppPage
      title={t('leaderboard.title')}
      subToolbar={
        hasTeam ? (
          <IonSegment
            value={scope}
            onIonChange={(e) => setScope(e.detail.value as Scope)}
          >
            <IonSegmentButton value="club">
              <IonLabel>{t('leaderboard.club')}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="team">
              <IonLabel>
                {teams.length === 1 ? teams[0].name : t('leaderboard.team')}
              </IonLabel>
            </IonSegmentButton>
          </IonSegment>
        ) : undefined
      }
      onRefresh={() => leaderboard.refetch()}
    >
      {activeMembership && !activeMembership.leaderboard_opt_in && (
        <IonNote color="medium" className="app-hint">
          {t('leaderboard.optOutNotice')}
        </IonNote>
      )}

      {/* FR-049 und FR-048: Zeitraum und Säule. Ohne den Zeitraum sieht ein
          Neumitglied nie etwas anderes als die Jahresbesten. */}
      <ListSection
        footnote={
          myRank !== null
            ? t('leaderboard.yourRank', { rank: myRank })
            : t('leaderboard.filterHint')
        }
      >
        {/* Wer in mehreren Teams ist, wählt aus – sonst sähe er immer nur das
            erste. */}
        {scope === 'team' && teams.length > 1 && (
          <IonItem>
            <IonSelect
              label={t('leaderboard.team')}
              value={activeTeamId}
              onIonChange={(e) => setTeamId(e.detail.value as string)}
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
            >
              {teams.map((team) => (
                <IonSelectOption key={team.id} value={team.id}>
                  {team.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        )}
        <IonItem>
          <IonSelect
            label={t('leaderboard.period')}
            value={period}
            onIonChange={(e) => setPeriod(e.detail.value as LeaderboardPeriod)}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
          >
            {LEADERBOARD_PERIODS.map((entry) => (
              <IonSelectOption key={entry} value={entry}>
                {t(`leaderboard.periodValue.${entry}`)}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        <IonItem>
          <IonSelect
            label={t('leaderboard.pillar')}
            value={pillar}
            onIonChange={(e) => setPillar((e.detail.value as Pillar | null) ?? null)}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
          >
            <IonSelectOption value={null}>{t('leaderboard.allPillars')}</IonSelectOption>
            {PILLARS.map((entry) => (
              <IonSelectOption key={entry} value={entry}>
                {t(`pointRules.pillar.${entry}`)}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      </ListSection>

      {leaderboard.isLoading ? (
        <SkeletonList rows={6} />
      ) : leaderboard.error ? (
        <ErrorState
          error={leaderboard.error as Error}
          onRetry={() => void leaderboard.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          message={t('leaderboard.empty')}
          action={{ label: t('agenda.title'), routerLink: '/tabs/agenda' }}
        />
      ) : (
        <IonList inset>
          {rows.map((row, index) => (
            <Fragment key={row.memberId}>
              {/* A3/BR-090: Die eigene Zeile kommt auch von weiter hinten mit.
                  Die Lücke wird gezeigt, sonst läse sich Rang 3 direkt vor
                  Rang 27 wie eine durchgehende Liste. */}
              {showGap && index === rows.length - 1 && (
                <IonItem lines="none">
                  <IonNote>…</IonNote>
                </IonItem>
              )}
              <IonItem color={row.isSelf ? 'light' : undefined}>
                <IonNote slot="start">{row.rank}</IonNote>
                {row.avatarUrl && (
                  <IonAvatar slot="start">
                    <img src={row.avatarUrl} alt="" />
                  </IonAvatar>
                )}
                <IonLabel>{row.displayName}</IonLabel>
                <IonNote slot="end" color="primary">
                  {row.totalPoints}
                </IonNote>
              </IonItem>
            </Fragment>
          ))}
        </IonList>
      )}
    </AppPage>
  );
}

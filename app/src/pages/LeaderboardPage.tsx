import { Fragment, useState } from 'react';
import {
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  useIonRouter,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  useClubPillars,
  useClubSeasons,
  useLeaderboard,
  useMyTeams,
  useTeamRanking,
} from '../hooks/useGamification';
import { useClub } from '../hooks/useClub';
import { useRefreshOnEnter } from '../hooks/useRefreshOnEnter';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { MemberAvatar } from '../components/MemberAvatar';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { PointSourceModal } from '../components/PointSourceModal';
import {
  ALL_POINTS,
  LEADERBOARD_PERIODS,
  hasRankGap,
  hidesPoints,
  leaderboardLimit,
  ownRank,
  sourceQuery,
  type LeaderboardPeriod,
  type PointSource,
} from '../lib/leaderboard';

type Scope = 'club' | 'team' | 'teams';

export function LeaderboardPage() {
  const { t } = useTranslation();
  const router = useIonRouter();
  const { activeClub, activeMembership } = useClub();
  const myTeams = useMyTeams();
  // Die Tab-Seite bleibt gemountet; erst das erneute Betreten lädt nach, was
  // nach `staleTime` veraltet ist (Lifecycle-Kapitel).
  useRefreshOnEnter([
    ['leaderboard'],
    ['team-ranking'],
    ['my-teams'],
    ['club-seasons'],
    ['club-pillars'],
  ]);

  const [scope, setScope] = useState<Scope>('club');
  const [period, setPeriod] = useState<LeaderboardPeriod>('season');
  // FR-048: Punkte einer Säule – oder einer ganzen Wertdimension, damit die
  // Rangliste dieselben Namen trägt wie «Meine Stärken» (`0092`).
  const [source, setSource] = useState<PointSource>(ALL_POINTS);
  const [sourceOpen, setSourceOpen] = useState(false);
  // Konzept §7.3, Saisonarchiv: `null` ist die laufende Saison.
  const [season, setSeason] = useState<string | null>(null);
  const seasons = useClubSeasons();
  const clubPillars = useClubPillars();
  const pillars = clubPillars.data ?? [];
  const { pillar, dimension } = sourceQuery(source);
  const hidePoints = hidesPoints(activeClub?.settings);

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
    dimension,
    limit: leaderboardLimit(activeClub?.settings),
    season: period === 'season' ? season : null,
  });
  // Konzept §7.3: Team gegen Team, im Durchschnitt je Mitglied.
  const teamRanking = useTeamRanking({
    period,
    pillar,
    dimension,
    season: period === 'season' ? season : null,
  });
  const teamRows = teamRanking.data ?? [];

  const rows = leaderboard.data ?? [];
  const showGap = hasRankGap(rows);
  const myRank = ownRank(rows);

  return (
    <AppPage
      title={t('leaderboard.title')}
      subToolbar={
        <IonSegment value={scope} onIonChange={(e) => setScope(e.detail.value as Scope)}>
          <IonSegmentButton value="club">
            <IonLabel>{t('leaderboard.club')}</IonLabel>
          </IonSegmentButton>
          {hasTeam && (
            <IonSegmentButton value="team">
              <IonLabel>
                {teams.length === 1 ? teams[0].name : t('leaderboard.team')}
              </IonLabel>
            </IonSegmentButton>
          )}
          <IonSegmentButton value="teams">
            <IonLabel>{t('leaderboard.teams')}</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      }
      onRefresh={() => Promise.all([leaderboard.refetch(), teamRanking.refetch()])}
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
          scope === 'teams'
            ? t('leaderboard.teamsHint')
            : myRank !== null
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
        {/* Saisonarchiv: nur, wenn es mehr als eine Saison gibt – und nur im
            Zeitraum «Saison», sonst hätte die Wahl keine Wirkung. */}
        {period === 'season' && (seasons.data ?? []).length > 1 && (
          <IonItem>
            <IonSelect
              label={t('leaderboard.season')}
              value={season}
              onIonChange={(e) => setSeason((e.detail.value as string | null) ?? null)}
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
            >
              <IonSelectOption value={null}>{t('leaderboard.currentSeason')}</IonSelectOption>
              {(seasons.data ?? []).map((entry) => (
                <IonSelectOption key={entry} value={entry}>
                  {entry}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        )}
        {/* Die Auswahl ist ein Blatt und kein `IonSelect`: Sie gruppiert die
            Säulen unter ihren Wertdimensionen, und Überschriften kennt ein
            `IonSelect` nicht. Führt der Verein nur eine einzige Säule, gibt es
            nichts zu wählen – dann steht die Zeile gar nicht erst da. */}
        {pillars.length > 1 && (
          <IonItem button detail onClick={() => setSourceOpen(true)}>
            <IonLabel>{t('leaderboard.source')}</IonLabel>
            <IonNote slot="end">{sourceLabel(t, source)}</IonNote>
          </IonItem>
        )}
      </ListSection>

      {scope === 'teams' ? (
        teamRanking.isLoading ? (
          <SkeletonList rows={4} />
        ) : teamRanking.error ? (
          <ErrorState
            error={teamRanking.error as Error}
            onRetry={() => void teamRanking.refetch()}
          />
        ) : teamRows.length === 0 ? (
          <EmptyState
            message={
              source.kind === 'all'
                ? t('leaderboard.teamsEmpty')
                : t('leaderboard.emptyFiltered', { name: sourceLabel(t, source) })
            }
            /* Ein anderer Tab: `root` startet ihn dort, ohne Fremd-History. */
            action={
              source.kind === 'all'
                ? {
                    label: t('agenda.title'),
                    onClick: () => router.push('/tabs/agenda', 'root'),
                  }
                : { label: t('common.reset'), onClick: () => setSource(ALL_POINTS) }
            }
          />
        ) : (
          <IonList inset>
            {teamRows.map((row) => (
              <IonItem key={row.teamId} color={row.isMine ? 'light' : undefined}>
                <IonNote slot="start">{row.rank}</IonNote>
                <IonLabel className="ion-text-wrap">
                  <h2>{row.teamName}</h2>
                  <p>
                    {hidePoints
                      ? t('leaderboard.teamMembers', { count: row.memberCount })
                      : t('leaderboard.teamTotal', {
                          points: row.totalPoints,
                          count: row.memberCount,
                        })}
                  </p>
                </IonLabel>
                {!hidePoints && (
                  <IonNote slot="end" color="primary">
                    {t('leaderboard.teamAverage', { points: row.avgPoints })}
                  </IonNote>
                )}
              </IonItem>
            ))}
          </IonList>
        )
      ) : leaderboard.isLoading ? (
        <SkeletonList rows={6} />
      ) : leaderboard.error ? (
        <ErrorState
          error={leaderboard.error as Error}
          onRetry={() => void leaderboard.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          message={
            source.kind === 'all'
              ? t('leaderboard.empty')
              : t('leaderboard.emptyFiltered', { name: sourceLabel(t, source) })
          }
          /* Wer eine Säule ohne Buchungen wählt, sitzt sonst in einer leeren
             Liste ohne Ausweg – der Weg zurück gehört hierher. */
          action={
            source.kind === 'all'
              ? {
                  label: t('agenda.title'),
                  onClick: () => router.push('/tabs/agenda', 'root'),
                }
              : { label: t('common.reset'), onClick: () => setSource(ALL_POINTS) }
          }
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
                  <IonLabel color="medium">{t('leaderboard.rankGap')}</IonLabel>
                </IonItem>
              )}
              <IonItem color={row.isSelf ? 'light' : undefined}>
                <IonNote slot="start">{row.rank}</IonNote>
                {/* Jede Zeile trägt einen Avatar – ohne Bild die Initialen –,
                    damit die Namen in einer Flucht stehen. */}
                <MemberAvatar displayName={row.displayName} avatarUrl={row.avatarUrl} />
                <IonLabel>{row.displayName}</IonLabel>
                {/* Konzept §7.2: Ränge ohne Punktzahl, wenn der Verein es so will. */}
                {!hidePoints && (
                  <IonNote slot="end" color="primary">
                    {row.totalPoints}
                  </IonNote>
                )}
              </IonItem>
            </Fragment>
          ))}
        </IonList>
      )}

      <PointSourceModal
        isOpen={sourceOpen}
        value={source}
        pillars={pillars}
        onChange={setSource}
        onDismiss={() => setSourceOpen(false)}
      />
    </AppPage>
  );
}

/**
 * Wie die geltende Wahl in der Zeile steht: der Name der Dimension, der Name
 * der Säule – oder «Alle Säulen», wenn nichts eingegrenzt ist.
 */
function sourceLabel(t: TFunction, source: PointSource): string {
  switch (source.kind) {
    case 'dimension':
      return t(`dimensions.${source.dimension}.title`);
    case 'pillar':
      return t(`pointRules.pillar.${source.pillar}`);
    default:
      return t('leaderboard.sourceAll');
  }
}

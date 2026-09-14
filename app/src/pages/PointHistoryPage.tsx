import { useEffect, useState } from 'react';
import {
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonListHeader,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  useIonRouter,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import {
  POINTS_PAGE_SIZE,
  useAllPoints,
  useClubSeasons,
  useRuleLabels,
} from '../hooks/useGamification';
import { formatDateTime } from '../lib/format';
import { bookingLabel, filterBookings, sumPoints } from '../lib/points';
import { PILLARS, type Pillar } from '../lib/pointRule';

/**
 * Die vollständige Punktehistorie (A2 aus UC-020, FR-041).
 *
 * Eigene Seite und kein Blatt: Sie ist zum Blättern da, nicht zum Erfassen –
 * und der Filter soll beim Scrollen stehen bleiben. Er steht deshalb in der
 * zweiten Kopfzeile, dort, wo `AppPage` ihn hält.
 *
 * Geladen wird seitenweise (`useAllPoints`), nachgeladen vom
 * `IonInfiniteScroll` am Ende der Liste. Die Saison filtert der Server; die
 * Säule der Client, denn sie hängt an der Regel und nicht an der Zeile.
 */
export function PointHistoryPage() {
  const { t } = useTranslation();
  const router = useIonRouter();
  const [season, setSeason] = useState<string | null>(null);
  const [pillar, setPillar] = useState<Pillar | null>(null);

  const history = useAllPoints(season);
  const rules = useRuleLabels();
  // Die Saisons des Vereins, nicht die der geladenen Seiten: Mit der
  // serverseitigen Saisonwahl enthielte die Liste sonst nur die gewählte.
  const seasons = useClubSeasons();

  const entries = history.data?.pages.flat() ?? [];
  const shown = filterBookings(entries, { season, pillar }, rules.data ?? []);
  const total = sumPoints(shown);
  const hasMore = history.hasNextPage ?? false;
  const { fetchNextPage, isFetching } = history;

  // Der Säulen-Filter greift erst nach dem Laden: Bleibt von einer Seite
  // nichts übrig, gäbe es nichts zu scrollen und damit keinen Auslöser für
  // die nächste – deshalb wird nachgeladen, bis eine Bildschirmlänge steht.
  useEffect(() => {
    if (pillar === null || !hasMore || isFetching) return;
    if (shown.length < POINTS_PAGE_SIZE) void fetchNextPage();
  }, [pillar, hasMore, isFetching, fetchNextPage, shown.length]);

  return (
    <AppPage
      title={t('pointHistory.title')}
      backHref="/tabs/profile"
      onRefresh={() => history.refetch()}
      subToolbar={
        (seasons.data ?? []).length > 1 ? (
          /* `scrollable`: Ab der vierten Saison passt das Segment sonst nicht
             mehr in die Breite. */
          <IonSegment
            scrollable
            value={season ?? 'all'}
            onIonChange={(e) => {
              const value = e.detail.value as string;
              setSeason(value === 'all' ? null : value);
            }}
          >
            <IonSegmentButton value="all">
              <IonLabel>{t('pointHistory.allSeasons')}</IonLabel>
            </IonSegmentButton>
            {(seasons.data ?? []).map((entry) => (
              <IonSegmentButton key={entry} value={entry}>
                <IonLabel>{entry}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
        ) : undefined
      }
    >
      {history.isLoading ? (
        <SkeletonList />
      ) : history.error ? (
        <ErrorState
          error={history.error as Error}
          onRetry={() => void history.refetch()}
        />
      ) : (
        <>
          <ListSection title={t('pointHistory.filter')}>
            <IonItem>
              <IonSelect
                label={t('pointHistory.pillar')}
                labelPlacement="stacked"
                value={pillar}
                onIonChange={(e) =>
                  setPillar((e.detail.value as Pillar | null) ?? null)
                }
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
              >
                <IonSelectOption value={null}>
                  {t('pointHistory.allPillars')}
                </IonSelectOption>
                {PILLARS.map((entry) => (
                  <IonSelectOption key={entry} value={entry}>
                    {t(`pointRules.pillar.${entry}`)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </ListSection>

          {/* Der leere Zustand steht neben der Liste, nicht in ihr. Die Zahl
              im Titel und die Summe gelten erst, wenn alles geladen ist. */}
          {shown.length === 0 && !hasMore ? (
            <>
              <IonListHeader>
                <IonLabel>{t('pointHistory.bookingsTitle')}</IonLabel>
              </IonListHeader>
              <EmptyState
                message={t('pointHistory.empty')}
                action={{
                  label: t('agenda.title'),
                  onClick: () => router.push('/tabs/agenda', 'root'),
                }}
              />
            </>
          ) : (
            <ListSection
              title={
                hasMore
                  ? t('pointHistory.bookingsTitle')
                  : t('pointHistory.bookings', { count: shown.length })
              }
              footnote={
                hasMore ? t('pointHistory.moreBelow') : t('pointHistory.sum', { points: total })
              }
            >
              {shown.map((entry) => (
                <IonItem key={entry.id}>
                  <IonLabel className="ion-text-wrap">
                    <h2>{bookingLabel(entry, rules.data ?? [])}</h2>
                    <IonNote>
                      {formatDateTime(entry.created_at)} · {entry.season}
                    </IonNote>
                  </IonLabel>
                  <IonNote slot="end" color={entry.points >= 0 ? 'primary' : 'danger'}>
                    {entry.points >= 0 ? `+${entry.points}` : entry.points}
                  </IonNote>
                </IonItem>
              ))}
            </ListSection>
          )}

          <IonInfiniteScroll
            disabled={!hasMore}
            onIonInfinite={(e) => {
              void fetchNextPage().finally(() => void e.target.complete());
            }}
          >
            <IonInfiniteScrollContent loadingText={t('common.loading')} />
          </IonInfiniteScroll>
        </>
      )}
    </AppPage>
  );
}

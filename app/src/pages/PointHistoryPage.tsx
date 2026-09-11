import { useState } from 'react';
import {
  IonItem,
  IonLabel,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { useAllPoints, useRuleLabels } from '../hooks/useGamification';
import { formatDateTime } from '../lib/format';
import { bookingLabel, filterBookings, seasonsOf, sumPoints } from '../lib/points';
import { PILLARS, type Pillar } from '../lib/pointRule';

/**
 * Die vollständige Punktehistorie (A2 aus UC-020, FR-041).
 *
 * Eigene Seite und kein Blatt: Sie ist zum Blättern da, nicht zum Erfassen –
 * und der Filter soll beim Scrollen stehen bleiben. Er steht deshalb in der
 * zweiten Kopfzeile, dort, wo `AppPage` ihn hält.
 */
export function PointHistoryPage() {
  const { t } = useTranslation();
  const history = useAllPoints();
  const rules = useRuleLabels();

  const entries = history.data ?? [];
  const seasons = seasonsOf(entries);

  const [season, setSeason] = useState<string | null>(null);
  const [pillar, setPillar] = useState<Pillar | null>(null);

  const shown = filterBookings(entries, { season, pillar }, rules.data ?? []);
  const total = sumPoints(shown);

  return (
    <AppPage
      title={t('pointHistory.title')}
      backHref="/tabs/profile"
      onRefresh={() => history.refetch()}
      subToolbar={
        seasons.length > 1 ? (
          <IonSegment
            value={season ?? 'all'}
            onIonChange={(e) => {
              const value = e.detail.value as string;
              setSeason(value === 'all' ? null : value);
            }}
          >
            <IonSegmentButton value="all">
              <IonLabel>{t('pointHistory.allSeasons')}</IonLabel>
            </IonSegmentButton>
            {seasons.map((entry) => (
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

          <ListSection
            title={t('pointHistory.bookings', { count: shown.length })}
            footnote={t('pointHistory.sum', { points: total })}
          >
            {shown.length === 0 ? (
              <EmptyState
                message={t('pointHistory.empty')}
                action={{ label: t('agenda.title'), routerLink: '/tabs/agenda' }}
              />
            ) : (
              shown.map((entry) => (
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
              ))
            )}
          </ListSection>
        </>
      )}
    </AppPage>
  );
}

import { IonItem, IonLabel, IonNote } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { StatCard } from '../components/StatCard';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { usePulse } from '../hooks/usePulse';
import { useMyPointsSummary } from '../hooks/useGamification';
import { formatDate } from '../lib/format';
import { PULSE_SECTIONS, itemsOf } from '../lib/pulse';

/**
 * Den Vereins-Puls lesen (UC-027, A4).
 *
 * BR-114: **Die Punkte stehen nachgeordnet.** Sie kommen nach den drei
 * Abschnitten und nie als Aufmacher – der Puls handelt vom Verein, nicht vom
 * eigenen Punktestand. Die Reihenfolge dieser Seite ist die Regel.
 */
export function PulseReadPage() {
  const { t } = useTranslation();
  const { pulseId } = useParams<{ pulseId: string }>();
  const pulse = usePulse(pulseId ?? null);
  const points = useMyPointsSummary();

  const entry = pulse.data ?? null;

  return (
    <AppPage title={t('pulse.readTitle')} backHref="/tabs/dashboard">
      {pulse.isLoading ? (
        <SkeletonList />
      ) : pulse.error ? (
        <ErrorState error={pulse.error as Error} onRetry={() => void pulse.refetch()} />
      ) : !entry ? (
        <EmptyState message={t('pulse.gone')} />
      ) : (
        <>
          {entry.intro && (
            <ListSection>
              <IonItem lines="none">
                <IonLabel className="ion-text-wrap">
                  <p>{entry.intro}</p>
                </IonLabel>
              </IonItem>
            </ListSection>
          )}

          {PULSE_SECTIONS.map((section) => {
            const items = itemsOf(entry, section);
            if (items.length === 0) return null;
            return (
              <ListSection key={section} title={t(`pulse.section.${section}`)}>
                {items.map((item) => (
                  <IonItem key={item.id}>
                    <IonLabel className="ion-text-wrap">
                      <h2>{item.title}</h2>
                      <IonNote>
                        {item.at ? formatDate(item.at) : t('pulse.noDate')}
                      </IonNote>
                    </IonLabel>
                  </IonItem>
                ))}
              </ListSection>
            );
          })}

          {/* BR-114: nachgeordnet – nach den drei Fragen, nie davor. */}
          <ListSection title={t('pulse.yourPoints')} footnote={t('pulse.pointsHint')}>
            <div className="app-stat-row">
              <StatCard
                value={points.data?.seasonPoints ?? 0}
                label={t('dashboard.seasonPoints')}
              />
            </div>
          </ListSection>
        </>
      )}
    </AppPage>
  );
}

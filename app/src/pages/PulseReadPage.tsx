import { IonLabel, IonListHeader, IonNote } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { PulseSections } from '../components/PulseSections';
import { StatCard } from '../components/StatCard';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { usePulsePayload } from '../hooks/usePulse';
import { useMyPointsSummary } from '../hooks/useGamification';

/**
 * Den Vereins-Puls lesen (UC-027, A4).
 *
 * BR-114: **Die Punkte stehen nachgeordnet.** Sie kommen nach den drei
 * Abschnitten und nie als Aufmacher – der Puls handelt vom Verein, nicht vom
 * eigenen Punktestand. Die Reihenfolge dieser Seite ist die Regel.
 *
 * Gelesen wird über `pulse_payload()` und nicht über die Tabelle: Der Gruss
 * hängt am Amt (UC-050, BR-252) und steht deshalb nicht in `club_pulses`. Die
 * Funktion ist `security invoker` – die Policy aus `0044` entscheidet, wer
 * einen Puls sieht, und der Client filtert nichts.
 */
export function PulseReadPage() {
  const { t } = useTranslation();
  const { pulseId } = useParams<{ pulseId: string }>();
  const pulse = usePulsePayload(pulseId ?? null);
  const points = useMyPointsSummary();

  const entry = pulse.data ?? null;

  return (
    <AppPage title={t('pulse.readTitle')} backHref="/tabs/dashboard">
      {pulse.isLoading ? (
        <SkeletonList />
      ) : pulse.error ? (
        <ErrorState error={pulse.error as Error} onRetry={() => void pulse.refetch()} />
      ) : !entry ? (
        <EmptyState
          message={t('pulse.gone')}
          action={{ label: t('dashboard.title'), routerLink: '/tabs/dashboard' }}
        />
      ) : (
        <>
          <PulseSections
            intro={entry.intro}
            sections={entry.sections}
            greeting={entry.greeting}
          />

          {/* BR-114: nachgeordnet – nach den drei Fragen, nie davor. Die
              Kachel ist keine Listenzeile und steht deshalb neben der Liste. */}
          <IonListHeader>
            <IonLabel>{t('pulse.yourPoints')}</IonLabel>
          </IonListHeader>
          <div className="app-stat-row">
            <StatCard
              value={points.data?.seasonPoints ?? 0}
              label={t('impact.seasonPoints')}
            />
          </div>
          <IonNote className="app-footnote">{t('pulse.pointsHint')}</IonNote>
        </>
      )}
    </AppPage>
  );
}

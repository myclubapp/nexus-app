import { useState } from 'react';
import { IonBadge, IonItem, IonLabel, IonNote } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { HealthSignalModal } from '../components/HealthSignalModal';
import { useHealthSignals } from '../hooks/useHealth';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../lib/format';
import {
  isClubSignal,
  severityColor,
  signalKey,
  sortSignals,
} from '../lib/health';

/**
 * Die offenen Fürsorge-Hinweise (UC-023, Schritte 2–3).
 *
 * Dringend zuerst, dann nach Alter – ausdrücklich **nicht** nach Person
 * gruppiert: Eine nach Namen sortierte Liste von Hinweisen wäre der Anfang
 * einer Akte, und die schliesst BR-097 aus.
 */
export function HealthPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const signals = useHealthSignals();
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = sortSignals(signals.data ?? []);
  const open = rows.find((row) => row.id === openId) ?? null;

  return (
    <AppPage
      title={t('health.title')}
      backHref="/tabs/profile"
      onRefresh={() => signals.refetch()}
    >
      {signals.isLoading ? (
        <SkeletonList />
      ) : signals.error ? (
        <ErrorState
          error={signals.error as Error}
          onRetry={() => void signals.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState message={t('health.empty')} />
      ) : (
        <ListSection
          title={t('health.openSignals', { count: rows.length })}
          footnote={t('health.listHint')}
        >
          {rows.map((signal) => (
            <IonItem
              key={signal.id}
              button
              detail
              onClick={() => setOpenId(signal.id)}
            >
              <IonLabel className="ion-text-wrap">
                <h2>
                  {isClubSignal(signal)
                    ? t('health.club')
                    : (signal.memberName ?? t('health.member'))}
                </h2>
                <p>{t(signalKey(signal.signalType, 'title'))}</p>
                <IonNote>
                  {formatDate(signal.detectedAt)}
                  {signal.status === 'in_contact' && signal.ownerName
                    ? ` · ${t('health.ownedBy', { name: signal.ownerName })}`
                    : ''}
                </IonNote>
              </IonLabel>
              <IonBadge slot="end" color={severityColor(signal.severity)}>
                {t(`health.severity.${signal.severity}`)}
              </IonBadge>
            </IonItem>
          ))}
        </ListSection>
      )}

      <HealthSignalModal
        signal={open}
        onDismiss={() => setOpenId(null)}
        onDone={(outcome) => {
          setOpenId(null);
          if (outcome === 'taken') {
            toast.failure(t('health.alreadyTaken'));
          } else if (outcome === 'deleted') {
            toast.success(t('health.resolved'));
          } else {
            toast.success(t('health.tookOver'));
          }
        }}
      />
    </AppPage>
  );
}

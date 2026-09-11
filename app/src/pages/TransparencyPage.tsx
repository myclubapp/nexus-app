import { useState } from 'react';
import {
  IonBadge,
  IonItem,
  IonLabel,
  IonNote,
  IonToggle,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { FormModal } from '../components/FormModal';
import { ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { useClub } from '../hooks/useClub';
import { useMyHealthSignals, useSetHealthOptOut } from '../hooks/useHealth';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../lib/format';
import {
  COLLECTED_DATA,
  NOT_COLLECTED,
  severityColor,
  signalAudienceKey,
  signalKey,
  type MyHealthSignal,
} from '../lib/health';

/**
 * «Was sieht mein Verein?» (UC-025).
 *
 * Die Seite ist die Einlösung eines Versprechens, das das ganze Produkt gibt.
 * Sie zeigt vollständig, was zur Person besteht (BR-105), sagt, wer es sieht,
 * und – der ungewöhnlichere Teil – nennt ausdrücklich, was **nicht** erhoben
 * wird (BR-108).
 *
 * Der Opt-out steht unten und nicht oben: Wer die Seite öffnet, soll erst
 * lesen, worum es geht.
 */
export function TransparencyPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { activeMembership } = useClub();
  const signals = useMyHealthSignals();
  const setOptOut = useSetHealthOptOut();

  const [explain, setExplain] = useState<MyHealthSignal | null>(null);

  const optedOut = activeMembership?.health_opt_out ?? false;
  const rows = signals.data ?? [];

  return (
    <AppPage
      title={t('transparency.title')}
      backHref="/tabs/profile"
      onRefresh={() => signals.refetch()}
    >
      {/* Schritt 2: woraus überhaupt etwas entstehen kann. */}
      <ListSection
        title={t('transparency.collected')}
        footnote={t('transparency.collectedHint')}
      >
        {COLLECTED_DATA.map((kind) => (
          <IonItem key={kind}>
            <IonLabel className="ion-text-wrap">
              <h2>{t(`transparency.data.${kind}.title`)}</h2>
              <p>{t(`transparency.data.${kind}.body`)}</p>
            </IonLabel>
          </IonItem>
        ))}
      </ListSection>

      {/* BR-108: und was ausdrücklich nicht. */}
      <ListSection
        title={t('transparency.notCollected')}
        footnote={t('transparency.notCollectedHint')}
      >
        {NOT_COLLECTED.map((kind) => (
          <IonItem key={kind}>
            <IonLabel className="ion-text-wrap">
              <p>{t(`transparency.notData.${kind}`)}</p>
            </IonLabel>
          </IonItem>
        ))}
      </ListSection>

      {/* Schritte 3 und 4: was gerade besteht, und wer es sieht. */}
      <ListSection
        title={t('transparency.mySignals')}
        footnote={t('transparency.signalsHint')}
      >
        {signals.isLoading ? (
          <SkeletonList rows={2} />
        ) : signals.error ? (
          <ErrorState
            error={signals.error as Error}
            onRetry={() => void signals.refetch()}
          />
        ) : rows.length === 0 ? (
          /* A1: sagen, dass gerade nichts besteht. */
          <IonItem>
            <IonNote>{t('transparency.noSignals')}</IonNote>
          </IonItem>
        ) : (
          rows.map((signal) => (
            <IonItem key={signal.id} button detail onClick={() => setExplain(signal)}>
              <IonLabel className="ion-text-wrap">
                <h2>{t(signalKey(signal.signalType, 'title'))}</h2>
                <IonNote>
                  {t(signalAudienceKey(signal))} · {formatDate(signal.detectedAt)}
                </IonNote>
              </IonLabel>
              <IonBadge slot="end" color={severityColor(signal.severity)}>
                {t(`health.severity.${signal.severity}`)}
              </IonBadge>
            </IonItem>
          ))
        )}
      </ListSection>

      {/* Schritte 6–8: der Schalter, den die Spalte seit `0013` vermisst. */}
      <ListSection title={t('transparency.optOut')} footnote={t('transparency.optOutHint')}>
        <IonItem>
          <IonToggle
            checked={optedOut}
            disabled={setOptOut.isPending}
            onIonChange={(e) =>
              setOptOut.mutate(e.detail.checked, {
                onSuccess: (deleted) =>
                  toast.success(
                    e.detail.checked
                      ? t('transparency.optedOut', { count: deleted })
                      : t('transparency.optedIn'),
                  ),
                onError: (cause) => toast.failure(cause.message),
              })
            }
          >
            <IonLabel className="ion-text-wrap">{t('transparency.optOutLabel')}</IonLabel>
          </IonToggle>
        </IonItem>
      </ListSection>

      {/* A3: Was heisst dieser Signaltyp, und ab wann greift er? */}
      <FormModal
        isOpen={explain !== null}
        title={explain ? t(signalKey(explain.signalType, 'title')) : ''}
        onDismiss={() => setExplain(null)}
      >
        {explain && (
          <>
            <ListSection>
              <IonItem>
                <IonLabel className="ion-text-wrap">
                  <p>{t(signalKey(explain.signalType, 'definition'))}</p>
                </IonLabel>
              </IonItem>
            </ListSection>
            <ListSection title={t('transparency.whoSees')}>
              <IonItem>
                <IonLabel className="ion-text-wrap">
                  <p>{t(signalAudienceKey(explain))}</p>
                </IonLabel>
              </IonItem>
            </ListSection>
            <ListSection footnote={t('transparency.expiresHint')}>
              <IonItem>
                <IonLabel>{t('transparency.expires')}</IonLabel>
                <IonNote slot="end">{formatDate(explain.expiresAt)}</IonNote>
              </IonItem>
            </ListSection>
          </>
        )}
      </FormModal>
    </AppPage>
  );
}

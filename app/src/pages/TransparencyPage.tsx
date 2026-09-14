import { useState } from 'react';
import {
  IonBadge,
  IonItem,
  IonLabel,
  IonListHeader,
  IonNote,
  IonToggle,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { TextSection } from '../components/TextSection';
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
      {/* Schritt 2: woraus überhaupt etwas entstehen kann. Das sind Absätze,
          keine Listenzeilen – Fliesstext gehört nicht in ein Item. */}
      <TextSection title={t('transparency.collected')}>
        {COLLECTED_DATA.map((kind) => (
          <p key={kind}>
            <strong>{t(`transparency.data.${kind}.title`)}</strong>{' '}
            {t(`transparency.data.${kind}.body`)}
          </p>
        ))}
        <p>
          <IonNote>{t('transparency.collectedHint')}</IonNote>
        </p>
      </TextSection>

      {/* BR-108: und was ausdrücklich nicht. */}
      <TextSection title={t('transparency.notCollected')}>
        {NOT_COLLECTED.map((kind) => (
          <p key={kind}>{t(`transparency.notData.${kind}`)}</p>
        ))}
        <p>
          <IonNote>{t('transparency.notCollectedHint')}</IonNote>
        </p>
      </TextSection>

      {/* Schritte 3 und 4: was gerade besteht, und wer es sieht. Skelett und
          Fehlerzustand stehen neben der Liste, nicht darin – `SkeletonList`
          ist selbst eine Liste, `ErrorState` keine Zeile. */}
      {signals.isLoading || signals.error ? (
        <>
          <IonListHeader>
            <IonLabel>{t('transparency.mySignals')}</IonLabel>
          </IonListHeader>
          {signals.isLoading ? (
            <SkeletonList rows={2} />
          ) : (
            <ErrorState
              error={signals.error as Error}
              onRetry={() => void signals.refetch()}
            />
          )}
        </>
      ) : (
        <ListSection
          title={t('transparency.mySignals')}
          footnote={t('transparency.signalsHint')}
        >
          {rows.length === 0 ? (
            /* A1: sagen, dass gerade nichts besteht. */
            <IonItem lines="none">
              <IonLabel color="medium" className="ion-text-wrap">
                {t('transparency.noSignals')}
              </IonLabel>
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
      )}

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
            <TextSection>
              <p>{t(signalKey(explain.signalType, 'definition'))}</p>
            </TextSection>
            <TextSection title={t('transparency.whoSees')}>
              <p>{t(signalAudienceKey(explain))}</p>
            </TextSection>
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

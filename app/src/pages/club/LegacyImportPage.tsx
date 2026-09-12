import { useRef, useState } from 'react';
import { IonAlert, IonBadge, IonButton, IonInput, IonItem, IonLabel, IonNote } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { TextSection } from '../../components/TextSection';
import { EmptyState, ErrorState, InlineError } from '../../components/StateViews';
import { SkeletonList } from '../../components/Skeletons';
import {
  useCheckLegacy,
  useConnectLegacy,
  useDisconnectLegacy,
  useLegacySource,
  useSyncLegacy,
} from '../../hooks/useLegacySource';
import { useToast } from '../../hooks/useToast';
import { formatDateTime } from '../../lib/format';
import {
  isStale,
  normalizeFirebaseClubId,
  statusTone,
  validateFirebaseClubId,
  type LegacyCheck,
} from '../../lib/legacy';

/**
 * Die bisherige myclub-App verbinden (UC-040).
 *
 * Derselbe Aufbau wie beim Verband (UC-035): erst der Testaufruf, dann das
 * Speichern. Schlägt er fehl, entsteht nichts (A1), und die Meldung des
 * Dienstes steht wörtlich im Blatt. Gelingt er, zeigt das Blatt, **was**
 * unter der Kennung liegt – Name, Anlässe, Helfer-Events, Schichten –, bevor
 * jemand verbindet. So sieht die Person, ob es der richtige Verein ist.
 *
 * Nach dem Verbinden läuft die Übernahme sofort (Schritt 6); die Zahl der
 * Termine steht im Toast. Was danach in der alten App neu ist, kommt jede
 * Nacht von selbst – oder per «Jetzt übernehmen» (A3).
 */
export function LegacyImportPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const source = useLegacySource();
  const check = useCheckLegacy();
  const connect = useConnectLegacy();
  const sync = useSyncLegacy();
  const disconnect = useDisconnectLegacy();

  const [input, setInput] = useState('');
  const [found, setFound] = useState<LegacyCheck | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const clubIdInput = useRef<HTMLIonInputElement>(null);

  const problems = validateFirebaseClubId(input);
  const isBusy = check.isPending || connect.isPending;

  /** Schritte 4 bis 6: prüfen, speichern, übernehmen – in dieser Reihenfolge. */
  async function connectNow() {
    setFailure(null);
    setFound(null);
    const firebaseClubId = normalizeFirebaseClubId(input);

    const result = await check.mutateAsync(firebaseClubId).catch((cause: Error) => ({
      ok: false as const,
      error: cause.message,
    }));
    if (!result.ok) {
      setFailure(result.error ?? t('legacy.serviceMissing'));
      return;
    }
    setFound(result);

    const synced = await connect.mutateAsync(firebaseClubId);
    setInput('');
    if (synced.error === null) {
      toast.success(t('legacy.synced', { count: synced.count }));
    } else {
      // Die Quelle steht; nur die Übernahme kam nicht durch. Der Satz sagt,
      // dass der nächtliche Lauf sie nachholt (A2).
      toast.success(t('legacy.connectedLater'));
      setFailure(synced.error);
    }
  }

  function syncNow() {
    setFailure(null);
    sync.mutate(undefined, {
      onSuccess: (synced) => {
        if (synced.error === null) toast.success(t('legacy.synced', { count: synced.count }));
        else setFailure(synced.error);
      },
      onError: (cause) => setFailure(cause.message),
    });
  }

  return (
    <AppPage
      title={t('legacy.title')}
      backHref="/tabs/profile/club"
      onRefresh={() => source.refetch()}
    >
      <TextSection>
        <p>{t('legacy.intro')}</p>
        <p>{t('legacy.nightly')}</p>
      </TextSection>

      {source.isLoading ? (
        <SkeletonList />
      ) : source.error ? (
        <ErrorState error={source.error as Error} onRetry={() => void source.refetch()} />
      ) : !source.data ? (
        <EmptyState
          message={t('legacy.empty')}
          action={{
            label: t('legacy.startConnect'),
            onClick: () => void clubIdInput.current?.setFocus(),
          }}
        />
      ) : (
        <>
          <ListSection title={t('legacy.status')}>
            <IonItem lines="full">
              <IonLabel className="ion-text-wrap">
                <h2>{t('legacy.connectedTo', { id: source.data.firebaseClubId })}</h2>
                <p>
                  {source.data.lastSyncAt
                    ? t('legacy.lastSync', { when: formatDateTime(source.data.lastSyncAt) })
                    : t('legacy.neverSynced')}
                </p>
                {source.data.lastSyncAt && (
                  <p>{t('legacy.importedCount', { count: source.data.importedEvents })}</p>
                )}
                {source.data.lastError && (
                  <IonNote>{t('legacy.lastError', { message: source.data.lastError })}</IonNote>
                )}
                {isStale(source.data) && <IonNote>{t('legacy.errorHint')}</IonNote>}
              </IonLabel>
              <IonBadge slot="end" color={statusTone(source.data.status)}>
                {t(`legacy.statusLabel.${source.data.status}`)}
              </IonBadge>
            </IonItem>
          </ListSection>

          <div className="app-actions">
            <IonButton expand="block" fill="outline" disabled={sync.isPending} onClick={syncNow}>
              {sync.isPending ? t('legacy.syncing') : t('legacy.syncNow')}
            </IonButton>
            <IonButton
              expand="block"
              fill="clear"
              color="medium"
              disabled={disconnect.isPending}
              onClick={() => setDropping(true)}
            >
              {t('legacy.disconnect')}
            </IonButton>
          </div>
        </>
      )}

      {/* Schritte 2 und 3. */}
      <ListSection
        title={source.data ? t('legacy.replace') : t('legacy.connectTitle')}
        footnote={t('legacy.clubIdHint')}
      >
        <IonItem>
          <IonInput
            ref={clubIdInput}
            label={t('legacy.clubId')}
            labelPlacement="stacked"
            placeholder="su-452800"
            autocapitalize="off"
            enterkeyhint="done"
            value={input}
            onIonInput={(e) => {
              setInput(e.detail.value ?? '');
              setFound(null);
              setFailure(null);
            }}
          />
        </IonItem>
      </ListSection>

      {input.length > 0 && problems.includes('clubIdInvalid') && (
        <InlineError message={t('legacy.problem.clubIdInvalid')} />
      )}

      {/* A1 und A2: die Meldung des Dienstes, wörtlich. */}
      {failure && <InlineError message={failure} />}

      {/* Schritt 4: Was unter der Kennung liegt. */}
      {found?.ok && (
        <ListSection title={t('legacy.found')}>
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <h2>{found.name ?? t('legacy.unnamed')}</h2>
              <p>
                {t('legacy.foundCounts', {
                  events: found.events ?? 0,
                  helpers: found.helpers ?? 0,
                  shifts: found.shifts ?? 0,
                })}
              </p>
            </IonLabel>
          </IonItem>
        </ListSection>
      )}

      <div className="app-actions">
        <IonButton
          expand="block"
          disabled={problems.length > 0 || isBusy}
          onClick={() => void connectNow().catch((cause: Error) => setFailure(cause.message))}
        >
          {isBusy ? t('legacy.checking') : t('legacy.connect')}
        </IonButton>
      </div>

      {/* A4: Trennen beendet die Zufuhr, nicht die Vergangenheit (BR-184). */}
      <IonAlert
        isOpen={dropping}
        header={t('legacy.disconnect')}
        message={t('legacy.disconnectConfirm')}
        onDidDismiss={() => setDropping(false)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('legacy.disconnect'),
            role: 'destructive',
            handler: () => {
              disconnect.mutate(undefined, {
                onSuccess: () => toast.success(t('legacy.disconnected')),
                onError: (cause) => toast.failure(cause.message),
              });
            },
          },
        ]}
      />
    </AppPage>
  );
}

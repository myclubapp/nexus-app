import { useState } from 'react';
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonItem,
  IonLabel,
  IonNote,
  IonToggle,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../../components/AppPage';
import { FederationConnectForm } from '../../components/FederationConnectForm';
import { ListSection } from '../../components/ListSection';
import { TextSection } from '../../components/TextSection';
import { ErrorState } from '../../components/StateViews';
import { SkeletonList } from '../../components/Skeletons';
import {
  useDisconnectFederation,
  useFederationConnections,
  useSetFederationNews,
} from '../../hooks/useFederation';
import { useToast } from '../../hooks/useToast';
import { formatDateTime } from '../../lib/format';
import { newsToggleMessageKey } from '../../lib/clubSetup';
import { deliversNews, isStale, statusTone, type Federation } from '../../lib/federation';

/**
 * Den Verband verbinden (UC-035).
 *
 * Das Formular selbst steht in `FederationConnectForm` – der Einrichtungs-
 * Assistent (UC-051) führt durch dieselben Schritte, und die Reihenfolge
 * «erst prüfen, dann speichern» darf nicht zweimal im Repository stehen.
 *
 * Diese Seite ist der Zustand der Leitung: was hängt, wann es zuletzt lief,
 * ob die Beiträge des Verbands im Feed stehen (FR-197) – und der Weg hinaus
 * (A4).
 */
export function FederationPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const connections = useFederationConnections();
  const disconnect = useDisconnectFederation();
  const setNews = useSetFederationNews();

  const [dropping, setDropping] = useState<Federation | null>(null);

  const entries = connections.data ?? [];

  /**
   * Schritt 7. Was dabei geschieht – einschalten **und** sofort abgleichen –
   * steht in `useSetFederationNews()`; hier steht nur, was die Person liest.
   */
  function toggleNews(federation: Federation, enabled: boolean) {
    setNews.mutate(
      { federation, enabled },
      {
        onSuccess: (result) =>
          toast.success(
            t(newsToggleMessageKey(result), { reason: result.syncError ?? '' }),
          ),
        onError: (cause) => toast.failure((cause as Error).message),
      },
    );
  }

  return (
    <AppPage
      title={t('federation.title')}
      backHref="/tabs/profile/club"
      onRefresh={() => connections.refetch()}
    >
      <TextSection>
        <p>{t('federation.intro')}</p>
      </TextSection>

      {connections.isLoading ? (
        <SkeletonList />
      ) : connections.error ? (
        <ErrorState
          error={connections.error as Error}
          onRetry={() => void connections.refetch()}
        />
      ) : (
        entries.length > 0 && (
          <>
            <ListSection title={t('federation.status')}>
              {entries.map((entry) => (
                <IonItem key={entry.federation} lines="full">
                  <IonLabel className="ion-text-wrap">
                    <h2>{t(`federation.name.${entry.federation}`)}</h2>
                    <p>
                      {entry.lastSyncAt
                        ? t('federation.lastSync', {
                            when: formatDateTime(entry.lastSyncAt),
                          })
                        : t('federation.neverSynced')}
                    </p>
                    {entry.lastError && (
                      <IonNote>
                        {t('federation.lastError', { message: entry.lastError })}
                      </IonNote>
                    )}
                    {/* BR-155: Der Verband fällt aus, die App nicht. Der Satz
                        steht nur dort, wo er gebraucht wird. */}
                    {isStale(entry) && <IonNote>{t('federation.errorHint')}</IonNote>}
                  </IonLabel>
                  <IonBadge slot="end" color={statusTone(entry.status)}>
                    {t(`federation.statusLabel.${entry.status}`)}
                  </IonBadge>
                </IonItem>
              ))}
            </ListSection>

            {/* FR-197: die zweite Frage nach dem Verbinden – je Verbindung,
                weil ein Verein an zwei Verbänden hängen kann. Wo der Verband
                keine Beiträge liefert, steht kein Schalter, sondern der Satz,
                warum (BR-260). */}
            <ListSection title={t('federation.news')} footnote={t('federation.newsHint')}>
              {entries.map((entry) =>
                deliversNews(entry.federation) ? (
                  <IonItem key={entry.federation}>
                    <IonToggle
                      checked={entry.newsEnabled}
                      disabled={setNews.isPending}
                      onIonChange={(e) => toggleNews(entry.federation, e.detail.checked)}
                    >
                      <IonLabel className="ion-text-wrap">
                        {t(`federation.name.${entry.federation}`)}
                      </IonLabel>
                    </IonToggle>
                  </IonItem>
                ) : (
                  <IonItem key={entry.federation} lines="none">
                    <IonLabel className="ion-text-wrap">
                      <h2>{t(`federation.name.${entry.federation}`)}</h2>
                      <IonNote>{t('federation.newsUnavailable')}</IonNote>
                    </IonLabel>
                  </IonItem>
                ),
              )}
            </ListSection>

            {/* Die Knopfleiste steht unter der Liste, nicht darin – eine
                `IonList` kennt nur Zeilen. */}
            <div className="app-actions">
              {entries.map((entry) => (
                <IonButton
                  key={entry.federation}
                  expand="block"
                  fill="clear"
                  color="medium"
                  disabled={disconnect.isPending}
                  onClick={() => setDropping(entry.federation)}
                >
                  {t('federation.disconnect')}
                </IonButton>
              ))}
            </div>
          </>
        )
      )}

      <FederationConnectForm
        onConnected={() => {
          toast.success(t('federation.connected'));
          void connections.refetch();
        }}
      />

      {/* Schritt 7: Spiele entstehen erst mit einem verknüpften Team. */}
      <div className="app-actions">
        <IonButton expand="block" fill="outline" routerLink="/tabs/profile/teams">
          {t('federation.toTeams')}
        </IonButton>
      </div>
      <IonNote className="app-footnote">{t('federation.nextStep')}</IonNote>

      {/* A4: Trennen löscht den Schlüssel, nicht die Vergangenheit. Und ein
          Knopf, der etwas entfernt, trägt `destructive` – auch wenn die
          Aktion harmlos klingt (guidelines §2). */}
      <IonAlert
        isOpen={dropping !== null}
        header={t('federation.disconnect')}
        message={t('federation.disconnectConfirm')}
        onDidDismiss={() => setDropping(null)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('federation.disconnect'),
            role: 'destructive',
            handler: () => {
              if (!dropping) return;
              disconnect.mutate(dropping, {
                onSuccess: () => toast.success(t('federation.disconnected')),
                onError: (cause) => toast.failure(cause.message),
              });
            },
          },
        ]}
      />
    </AppPage>
  );
}

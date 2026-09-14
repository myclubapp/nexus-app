import { useRef, useState } from 'react';
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { TextSection } from '../../components/TextSection';
import { EmptyState, ErrorState, InlineError } from '../../components/StateViews';
import { SkeletonList } from '../../components/Skeletons';
import {
  useCheckFederation,
  useConnectFederation,
  useDisconnectFederation,
  useFederationConnections,
  type FederationTeam,
} from '../../hooks/useFederation';
import { useToast } from '../../hooks/useToast';
import { formatDateTime } from '../../lib/format';
import {
  FEDERATIONS,
  isStale,
  requiresKey,
  statusTone,
  validateConnection,
  type Federation,
} from '../../lib/federation';

/**
 * Den Verband verbinden (UC-035).
 *
 * **Schritt 5 steht vor Schritt 6, und das ist der ganze Punkt.** Erst der
 * Testaufruf, dann das Speichern: Schlägt er fehl, entsteht nichts (A1). Die
 * Meldung des Verbands steht dabei wörtlich im Blatt – sie sagt, was zu
 * korrigieren ist, und eine eigene Formulierung wüsste das nicht.
 *
 * **BR-153:** Der Schlüssel geht einmal hinaus und kommt nie zurück. Zu einer
 * bestehenden Verbindung steht deshalb nur, **dass** einer hinterlegt ist.
 */
export function FederationPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const connections = useFederationConnections();
  const check = useCheckFederation();
  const connect = useConnectFederation();
  const disconnect = useDisconnectFederation();

  const [federation, setFederation] = useState<Federation>('swissunihockey');
  const [clubId, setClubId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [found, setFound] = useState<FederationTeam[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [dropping, setDropping] = useState<Federation | null>(null);
  const clubIdInput = useRef<HTMLIonInputElement>(null);

  const draft = { federation, federationClubId: clubId, apiKey };
  const problems = validateConnection(draft);
  const isBusy = check.isPending || connect.isPending;

  /**
   * Schritte 5 und 6 in der Reihenfolge, in der sie voneinander abhängen:
   * Der Testaufruf entscheidet, ob überhaupt etwas gespeichert wird.
   */
  async function connectNow() {
    setFailure(null);
    setFound(null);

    const result = await check.mutateAsync(draft).catch((cause: Error) => ({
      ok: false as const,
      error: cause.message,
    }));

    if (!result.ok) {
      setFailure(result.error ?? t('federation.serviceMissing'));
      return;
    }

    setFound(result.teams ?? []);
    await connect.mutateAsync(draft);
    setApiKey('');
    toast.success(t('federation.connected'));
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
      ) : (connections.data ?? []).length === 0 ? (
        <EmptyState
          message={t('federation.empty')}
          action={{
            label: t('federation.startConnect'),
            onClick: () => void clubIdInput.current?.setFocus(),
          }}
        />
      ) : (
        <>
          <ListSection title={t('federation.status')}>
            {(connections.data ?? []).map((entry) => (
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

          {/* Die Knopfleiste steht unter der Liste, nicht darin – eine
              `IonList` kennt nur Zeilen. */}
          <div className="app-actions">
            {(connections.data ?? []).map((entry) => (
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
      )}

      {/* Schritte 2 bis 4. */}
      <ListSection title={t('federation.choose')} footnote={t('federation.chooseHint')}>
        <IonItem>
          <IonSelect
            label={t('federation.choose')}
            labelPlacement="stacked"
            value={federation}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
            onIonChange={(e) => {
              setFederation(e.detail.value as Federation);
              setFound(null);
              setFailure(null);
            }}
          >
            {FEDERATIONS.map((entry) => (
              <IonSelectOption key={entry} value={entry}>
                {t(`federation.name.${entry}`)}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>

        <IonItem>
          <IonInput
            ref={clubIdInput}
            label={t('federation.clubId')}
            labelPlacement="stacked"
            inputmode="numeric"
            enterkeyhint={requiresKey(federation) ? 'next' : 'done'}
            value={clubId}
            onIonInput={(e) => setClubId(e.detail.value ?? '')}
          />
        </IonItem>
        <IonNote className="app-footnote">{t('federation.clubIdHint')}</IonNote>
      </ListSection>

      {/* A2: Wo der Verband keinen Schlüssel verlangt, steht kein Feld – und
          der Satz sagt, warum. Ein leeres Pflichtfeld wäre eine Frage ohne
          Antwort. */}
      <ListSection
        footnote={
          requiresKey(federation) ? t('federation.apiKeyHint') : t('federation.noKeyNeeded')
        }
      >
        {requiresKey(federation) && (
          <IonItem>
            <IonInput
              type="password"
              label={t('federation.apiKey')}
              labelPlacement="stacked"
              // BR-153: Der Schlüssel soll nirgends hängen bleiben – auch
              // nicht im Ausfüllspeicher des Browsers.
              autocomplete="off"
              enterkeyhint="done"
              value={apiKey}
              onIonInput={(e) => setApiKey(e.detail.value ?? '')}
            />
          </IonItem>
        )}
      </ListSection>

      {problems.includes('clubIdMissing') && (
        <InlineError message={t('federation.problem.clubIdMissing')} />
      )}
      {problems.includes('keyMissing') && (
        <InlineError message={t('federation.problem.keyMissing')} />
      )}

      {/* A1: die Meldung des Verbands, wörtlich. */}
      {failure && <InlineError message={failure} />}

      {/* Schritt 7: Was der Testaufruf gefunden hat, und der Weg weiter. */}
      {found && found.length > 0 && (
        <ListSection
          title={t('federation.teamsFound', { count: found.length })}
          footnote={t('federation.nextStep')}
        >
          {found.map((team) => (
            <IonItem key={team.id} lines="none">
              <IonLabel className="ion-text-wrap">
                <h2>{team.name}</h2>
                {team.league && <IonNote>{team.league}</IonNote>}
              </IonLabel>
            </IonItem>
          ))}
        </ListSection>
      )}
      {found && found.length > 0 && (
        <div className="app-actions">
          <IonButton expand="block" fill="outline" routerLink="/tabs/profile/teams">
            {t('federation.toTeams')}
          </IonButton>
        </div>
      )}

      <div className="app-actions">
        <IonButton
          expand="block"
          disabled={problems.length > 0 || isBusy}
          onClick={() => void connectNow().catch((cause: Error) => setFailure(cause.message))}
        >
          {isBusy ? t('federation.checking') : t('federation.connect')}
        </IonButton>
      </div>

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

import { useRef, useState } from 'react';
import {
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import {
  useCheckFederation,
  useConnectFederation,
  type FederationTeam,
} from '../hooks/useFederation';
import { FEDERATIONS, requiresKey, validateConnection, type Federation } from '../lib/federation';

interface FederationConnectFormProps {
  /**
   * Der Verband hängt – mit den Teams, die der Testaufruf gefunden hat. Was
   * danach angeboten wird, entscheidet die Seite: Die Vereinsverwaltung führt
   * zu den Teams, der Einrichtungs-Assistent geht einen Schritt weiter.
   */
  onConnected?: (federation: Federation, teams: FederationTeam[]) => void;
}

/**
 * Den Verband verbinden – Schritte 2 bis 6 aus UC-035.
 *
 * **Schritt 5 steht vor Schritt 6, und das ist der ganze Punkt.** Erst der
 * Testaufruf, dann das Speichern: Schlägt er fehl, entsteht nichts (A1). Die
 * Meldung des Verbands steht dabei wörtlich da – sie sagt, was zu korrigieren
 * ist, und eine eigene Formulierung wüsste das nicht.
 *
 * **BR-153:** Der Schlüssel geht einmal hinaus und kommt nie zurück. Das Feld
 * leert sich nach dem Verbinden; gespeichert ist er im Tresor.
 *
 * Eigene Komponente, weil zwei Seiten dasselbe tun: `FederationPage` (UC-035)
 * und der Einrichtungs-Assistent (UC-051, Schritt 1). Stünde die Reihenfolge
 * «prüfen, dann speichern» zweimal im Repository, liefe sie irgendwann
 * auseinander.
 */
export function FederationConnectForm({ onConnected }: FederationConnectFormProps) {
  const { t } = useTranslation();
  const check = useCheckFederation();
  const connect = useConnectFederation();

  const [federation, setFederation] = useState<Federation>('swissunihockey');
  const [clubId, setClubId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [found, setFound] = useState<FederationTeam[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
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

    const teams = result.teams ?? [];
    setFound(teams);
    await connect.mutateAsync(draft);
    setApiKey('');
    onConnected?.(federation, teams);
  }

  return (
    <>
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

      {/* Schritt 7: Was der Testaufruf gefunden hat. */}
      {found && found.length > 0 && (
        <ListSection title={t('federation.teamsFound', { count: found.length })}>
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

      <div className="app-actions">
        <IonButton
          expand="block"
          disabled={problems.length > 0 || isBusy}
          onClick={() => void connectNow().catch((cause: Error) => setFailure(cause.message))}
        >
          {isBusy ? t('federation.checking') : t('federation.connect')}
        </IonButton>
      </div>
    </>
  );
}

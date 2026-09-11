import { useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useFederationConnections, useFederationTeams } from '../hooks/useFederation';
import { useUnlinkTeam } from '../hooks/useTeamAdmin';
import { useToast } from '../hooks/useToast';
import type { Team } from '../lib/database.types';
import type { Federation } from '../lib/federation';
import { formatDateTime } from '../lib/format';
import {
  composeTeamName,
  isFederationStale,
  isLinked,
  validateNameAddition,
  type RemoteTeam,
} from '../lib/team';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';

/** Was der Vorstand gewählt hat (Schritt 5): Verband und Verbands-Team. */
export interface FederationPick {
  federation: Federation;
  remote: RemoteTeam;
}

interface Props {
  /** Das Team – `null` beim Anlegen. */
  team: Team | null;
  /** Alle Teams des Vereins: Was schon verknüpft ist, ist nicht wählbar (Schritt 4). */
  teams: readonly Team[];
  pick: FederationPick | null;
  onPick: (pick: FederationPick | null) => void;
  addition: string;
  onAddition: (value: string) => void;
  /** A2: Der Weg zu «Verband verbinden» führt aus dem Blatt hinaus. */
  onLeave: () => void;
  /** A5: nach dem Lösen – das Blatt schliesst, die Liste zeigt den Stand. */
  onUnlinked?: () => void;
}

/**
 * Der Abschnitt «Verbands-Team» im Teamformular (UC-039, Schritte 2–7).
 *
 * Drei Zustände, in dieser Reihenfolge geprüft:
 *   verknüpft – Verband, Grundname, Liga, Abgleich, das Feld für den Zusatz
 *               und «Verknüpfung lösen» (A5);
 *   kein Verband – der Hinweis mit dem Weg zu UC-035 (A2);
 *   frei – «Teams des Verbands laden», die Auswahl, der Zusatz.
 *
 * **BR-178:** Der Client sagt nur, welchen Verband er meint. Die Liste holt
 * die Edge Function mit dem Schlüssel aus dem Tresor.
 *
 * **A4:** Antwortet der Verband nicht, steht seine Meldung hier – und das
 * Formular bleibt bedienbar. Das Team lässt sich ohne Verknüpfung speichern.
 */
export function FederationTeamSection({
  team,
  teams,
  pick,
  onPick,
  addition,
  onAddition,
  onLeave,
  onUnlinked,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const connections = useFederationConnections();
  const load = useFederationTeams();
  const unlink = useUnlinkTeam();

  const [federation, setFederation] = useState<Federation | null>(null);
  const [remote, setRemote] = useState<RemoteTeam[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [askUnlink, setAskUnlink] = useState(false);

  const available = connections.data ?? [];
  const chosen = federation ?? available[0]?.federation ?? null;
  const problems = validateNameAddition(addition);

  async function loadNow() {
    if (!chosen) return;
    const result = await load.mutateAsync(chosen).catch((cause: Error) => ({
      ok: false as const,
      error: cause.message,
    }));
    if (!result.ok) {
      setFailure(result.error ?? t('federation.serviceMissing'));
      return;
    }
    setFailure(null);
    setRemote(result.teams ?? []);
  }

  const additionField = (baseName: string) => (
    <>
      <IonItem>
        <IonInput
          label={t('teams.nameAddition')}
          labelPlacement="stacked"
          value={addition}
          onIonInput={(e) => onAddition(e.detail.value ?? '')}
        />
      </IonItem>
      <IonNote className="app-footnote">
        {t('teams.nameAdditionHint', {
          name: baseName,
          full: composeTeamName(baseName, addition),
        })}
      </IonNote>
      {problems.includes('additionTooLong') && (
        <InlineError message={t('teams.problem.additionTooLong')} />
      )}
    </>
  );

  // --- verknüpft ------------------------------------------------------------
  if (team && isLinked(team)) {
    return (
      <ListSection title={t('teams.federationSection')}>
        <IonItem lines="full">
          <IonLabel className="ion-text-wrap">
            <h2>
              {t('teams.linkedWith', {
                federation: t(`federation.name.${team.federation}`),
                name: team.federation_name,
              })}
            </h2>
            {team.league && <p>{t('teams.league', { league: team.league })}</p>}
            <p>
              {team.federation_synced_at
                ? t('teams.syncedAt', { when: formatDateTime(team.federation_synced_at) })
                : t('teams.neverSynced')}
            </p>
            {/* A6: Der Verband führt das Team nicht mehr – die Verknüpfung
                bleibt, der Vorstand entscheidet. */}
            {isFederationStale(team) && <IonNote color="warning">{t('teams.stale')}</IonNote>}
          </IonLabel>
        </IonItem>

        {additionField(team.federation_name ?? '')}

        <div className="app-actions">
          <IonButton
            expand="block"
            fill="clear"
            color="medium"
            disabled={unlink.isPending}
            onClick={() => setAskUnlink(true)}
          >
            {t('teams.unlink')}
          </IonButton>
        </div>

        <IonAlert
          isOpen={askUnlink}
          header={t('teams.unlink')}
          message={t('teams.unlinkConfirm')}
          onDidDismiss={() => setAskUnlink(false)}
          buttons={[
            { text: t('common.cancel'), role: 'cancel' },
            {
              text: t('teams.unlink'),
              role: 'destructive',
              handler: () =>
                unlink.mutate(team.id, {
                  onSuccess: () => {
                    toast.success(t('teams.unlinked'));
                    onUnlinked?.();
                  },
                  onError: (cause) => toast.failure(cause.message),
                }),
            },
          ]}
        />
      </ListSection>
    );
  }

  if (connections.isLoading) return null;

  // --- A2: kein Verband verbunden --------------------------------------------
  if (available.length === 0) {
    return (
      <ListSection title={t('teams.federationSection')}>
        <IonItem lines="none">
          <IonLabel className="ion-text-wrap">
            <p>{t('teams.federationNone')}</p>
          </IonLabel>
        </IonItem>
        <div className="app-actions">
          <IonButton
            expand="block"
            fill="outline"
            routerLink="/tabs/profile/federation"
            onClick={onLeave}
          >
            {t('federation.startConnect')}
          </IonButton>
        </div>
      </ListSection>
    );
  }

  // --- frei: laden, wählen, ergänzen -----------------------------------------
  return (
    <ListSection
      title={t('teams.federationSection')}
      footnote={pick ? undefined : t('federation.nextStep')}
    >
      {available.length > 1 && (
        <IonItem>
          <IonSelect
            label={t('federation.choose')}
            labelPlacement="stacked"
            value={chosen}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
            onIonChange={(e) => {
              setFederation(e.detail.value as Federation);
              setRemote(null);
              setFailure(null);
              onPick(null);
            }}
          >
            {available.map((entry) => (
              <IonSelectOption key={entry.federation} value={entry.federation}>
                {t(`federation.name.${entry.federation}`)}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      )}

      {remote === null ? (
        <div className="app-actions">
          <IonButton
            expand="block"
            fill="outline"
            disabled={load.isPending || !chosen}
            onClick={() => void loadNow()}
          >
            {load.isPending ? t('teams.loadingRemote') : t('teams.loadRemote')}
          </IonButton>
        </div>
      ) : remote.length === 0 ? (
        <IonItem lines="none">
          <IonNote>{t('teams.remoteEmpty')}</IonNote>
        </IonItem>
      ) : (
        <IonItem>
          <IonSelect
            label={t('teams.remoteChoose')}
            labelPlacement="stacked"
            value={pick?.remote.id ?? null}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
            onIonChange={(e) => {
              const id = (e.detail.value as string | null) ?? null;
              const found = remote.find((entry) => entry.id === id);
              onPick(found && chosen ? { federation: chosen, remote: found } : null);
            }}
          >
            <IonSelectOption value={null}>{t('teams.remoteNone')}</IonSelectOption>
            {remote.map((entry) => {
              // BR-175: Ein Verbands-Team, das schon an einem anderen Team
              // hängt, ist gekennzeichnet und nicht wählbar (Schritt 4).
              const taken = teams.find(
                (candidate) =>
                  candidate.id !== team?.id &&
                  candidate.federation === chosen &&
                  candidate.federation_team_id === entry.id,
              );
              return (
                <IonSelectOption key={entry.id} value={entry.id} disabled={Boolean(taken)}>
                  {taken ? `${entry.name} (${t('teams.alreadyLinked')})` : entry.name}
                </IonSelectOption>
              );
            })}
          </IonSelect>
        </IonItem>
      )}

      {/* A4: die Meldung des Verbands, wörtlich – und der Satz, dass es ohne
          Verknüpfung weitergeht. */}
      {failure && (
        <>
          <InlineError message={t('teams.remoteFailed', { message: failure })} />
          <IonNote className="app-footnote">{t('teams.remoteFailedHint')}</IonNote>
        </>
      )}

      {pick && additionField(pick.remote.name)}
    </ListSection>
  );
}

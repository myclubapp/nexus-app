import { useEffect, useState } from 'react';
import {
  IonButton,
  IonCheckbox,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useFederationConnections, useFederationTeams } from '../hooks/useFederation';
import { useImportFederationTeams, type ImportOutcome } from '../hooks/useTeamAdmin';
import { useSheetProps } from '../hooks/useSheetProps';
import type { Team } from '../lib/database.types';
import type { Federation } from '../lib/federation';
import { proposeLinks, toImportItems, type RemoteTeam } from '../lib/team';
import { FormModal } from './FormModal';
import { ListSection } from './ListSection';
import { SkeletonList } from './Skeletons';
import { EmptyState, InlineError } from './StateViews';

interface ImportProps {
  teams: readonly Team[];
  onDone: (result: ImportOutcome) => void;
  onDismiss: () => void;
  isOpen?: boolean;
}

/**
 * A1: mehrere Teams auf einmal übernehmen.
 *
 * Das Blatt holt die Teams des Verbands, sobald es offen ist (A1, Schritt 1),
 * und sagt zu jedem, was es vorschlägt: schon verknüpft, zuordnen zu einem
 * gleichnamigen Team, neu anlegen. Der Vorstand wählt ab und bestätigt;
 * `import_federation_teams()` legt an und verknüpft in **einer** Transaktion.
 */
export function FederationImport({ teams, onDone, onDismiss, isOpen = true }: ImportProps) {
  const { t } = useTranslation();
  const connections = useFederationConnections();
  const load = useFederationTeams();
  const importTeams = useImportFederationTeams();

  const available = connections.data ?? [];
  const [federation, setFederation] = useState<Federation | null>(null);
  const chosen = federation ?? available[0]?.federation ?? null;

  const [remote, setRemote] = useState<RemoteTeam[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  /** `null`, solange niemand abgewählt hat: Dann sind alle freien gewählt. */
  const [selected, setSelected] = useState<Set<string> | null>(null);

  const proposals = remote && chosen ? proposeLinks(remote, teams, chosen) : [];
  const picked =
    selected ??
    new Set(
      proposals.filter((entry) => entry.status !== 'linked').map((entry) => entry.federationTeamId),
    );
  const items = toImportItems(proposals, picked);

  async function loadNow(target: Federation) {
    const result = await load.mutateAsync(target).catch((cause: Error) => ({
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

  // A1, Schritt 1: Das System holt die Liste – niemand muss darum bitten.
  useEffect(() => {
    if (chosen && remote === null && !load.isPending && failure === null) {
      void loadNow(chosen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  return (
    <FormModal
      isOpen={isOpen}
      title={t('teams.import')}
      submitLabel={t('teams.importSubmit')}
      canSubmit={items.length > 0 && chosen !== null && !importTeams.isPending}
      isSubmitting={importTeams.isPending}
      error={importTeams.error ? (importTeams.error as Error).message : null}
      onDismiss={onDismiss}
      onSubmit={() =>
        chosen &&
        importTeams.mutate({ federation: chosen, items }, { onSuccess: (result) => onDone(result) })
      }
    >
      <ListSection footnote={t('teams.importHint')}>
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
                setSelected(null);
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
        {failure && (
          <div className="app-actions">
            <IonButton
              expand="block"
              fill="outline"
              disabled={load.isPending || !chosen}
              onClick={() => chosen && void loadNow(chosen)}
            >
              {load.isPending ? t('teams.loadingRemote') : t('teams.loadRemote')}
            </IonButton>
          </div>
        )}
      </ListSection>

      {/* A4: die Meldung des Verbands, wörtlich. */}
      {failure && <InlineError message={t('teams.remoteFailed', { message: failure })} />}

      {load.isPending ? (
        <SkeletonList rows={4} />
      ) : remote && remote.length === 0 ? (
        <EmptyState
          message={t('teams.remoteEmpty')}
          action={{
            label: t('federation.title'),
            routerLink: '/tabs/profile/federation',
            onClick: onDismiss,
          }}
        />
      ) : (
        proposals.length > 0 && (
          <ListSection title={t('federation.teamsFound', { count: proposals.length })}>
            {proposals.map((entry) => (
              <IonItem key={entry.federationTeamId}>
                <IonCheckbox
                  labelPlacement="end"
                  justify="start"
                  disabled={entry.status === 'linked'}
                  checked={entry.status === 'linked' || picked.has(entry.federationTeamId)}
                  onIonChange={(e) => {
                    const next = new Set(picked);
                    if (e.detail.checked) next.add(entry.federationTeamId);
                    else next.delete(entry.federationTeamId);
                    setSelected(next);
                  }}
                >
                  <IonLabel className="ion-text-wrap">
                    <h2>{entry.name}</h2>
                    <p>{t(`teams.importStatus.${entry.status}`, { name: entry.teamName ?? '' })}</p>
                  </IonLabel>
                </IonCheckbox>
              </IonItem>
            ))}
          </ListSection>
        )
      )}
    </FormModal>
  );
}

/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function FederationImportModal({ isOpen, ...props }: ImportProps & { isOpen: boolean }) {
  const sheet = useSheetProps(isOpen ? props : null);
  return sheet && <FederationImport {...sheet} />;
}

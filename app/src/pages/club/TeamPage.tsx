import { useState } from 'react';
import { IonBadge, IonInput, IonItem, IonLabel, IonNote } from '@ionic/react';
import { cloudDownloadOutline, peopleOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../../components/AppPage';
import { FederationImportModal } from '../../components/FederationImportModal';
import {
  FederationTeamSection,
  type FederationPick,
} from '../../components/FederationTeamSection';
import { FormModal } from '../../components/FormModal';
import { ListSection } from '../../components/ListSection';
import { SkeletonList } from '../../components/Skeletons';
import { EmptyState, ErrorState, InlineError } from '../../components/StateViews';
import { TeamDetailModal } from '../../components/TeamDetailModal';
import { useFederationConnections } from '../../hooks/useFederation';
import { useTeams } from '../../hooks/useInvites';
import { useCreateTeam, useMembers } from '../../hooks/useMembers';
import { useAreas, useImportFederationTeams } from '../../hooks/useTeamAdmin';
import { useSheetProps } from '../../hooks/useSheetProps';
import { useToast } from '../../hooks/useToast';
import type { Team } from '../../lib/database.types';
import {
  composeTeamName,
  groupTeamsByArea,
  validateNameAddition,
  validateTeamName,
} from '../../lib/team';

/**
 * Die Teams des Vereins (UC-007 A1; S2 der Prüfung vom 2026-09-11).
 *
 * Die bestehende myclub-App hat dafür `team-list`, `team-detail` und
 * `team-member-list`; hier gab es Teams nur als Kästchen im Mitglied-Detail.
 * Und UC-039 setzt in Schritt 1 ein Teamformular voraus – das ist es.
 *
 * Gruppiert nach Bereich: Der Bereich ist das, was die Sportchef:in führt
 * (Vision §4), und die Liste soll sich wie ein Organigramm lesen.
 *
 * **UC-039 A1:** Besteht eine Verbandsverbindung, bietet der FAB zusätzlich
 * «Teams aus dem Verband übernehmen» – die Liste mit Vorschlägen, aus der in
 * einem Zug angelegt und verknüpft wird.
 */
export function TeamPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const teams = useTeams();
  const members = useMembers();
  const areas = useAreas();
  const connections = useFederationConnections();
  const createTeam = useCreateTeam();
  const importTeams = useImportFederationTeams();

  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [openTeam, setOpenTeam] = useState<Team | null>(null);

  const hasFederation = (connections.data ?? []).length > 0;

  const groups = groupTeamsByArea(teams.data ?? []);
  const memberCount = (teamId: string) =>
    (members.data ?? []).filter((member) => member.teamIds.includes(teamId)).length;

  return (
    <AppPage
      title={t('teams.title')}
      backHref="/tabs/profile"
      onRefresh={() => Promise.all([teams.refetch(), members.refetch()])}
      createActions={[
        { icon: peopleOutline, label: t('members.addTeam'), onClick: () => setCreating(true) },
        ...(hasFederation
          ? [{ icon: cloudDownloadOutline, label: t('teams.import'), onClick: () => setImporting(true) }]
          : []),
      ]}
    >
      {teams.isLoading ? (
        <SkeletonList />
      ) : teams.error ? (
        <ErrorState error={teams.error as Error} onRetry={() => void teams.refetch()} />
      ) : (teams.data ?? []).length === 0 ? (
        <EmptyState
          message={t('teams.empty')}
          action={{ label: t('members.addTeam'), onClick: () => setCreating(true) }}
        />
      ) : (
        groups.map((group) => (
          <ListSection
            key={group.area ?? '–'}
            title={group.area ?? t('teams.noArea')}
            footnote={group.area === null ? t('teams.noAreaHint') : undefined}
          >
            {group.teams.map((team) => (
              <IonItem key={team.id} button detail onClick={() => setOpenTeam(team)}>
                <IonLabel className="ion-text-wrap">
                  <h2>{team.name}</h2>
                </IonLabel>
                <IonBadge slot="end" color="medium">
                  {memberCount(team.id)}
                </IonBadge>
              </IonItem>
            ))}
          </ListSection>
        ))
      )}

      <TeamDetailModal
        team={openTeam}
        members={members.data ?? []}
        areas={areas.data ?? []}
        teams={teams.data ?? []}
        onDismiss={() => setOpenTeam(null)}
        onDone={(outcome) => {
          setOpenTeam(null);
          if (outcome !== 'silent') {
            toast.success(t(outcome === 'deleted' ? 'teams.deleted' : 'common.saved'));
          }
        }}
      />

      <TeamCreateModal
        isOpen={creating}
        teams={teams.data ?? []}
        isSubmitting={createTeam.isPending || importTeams.isPending}
        error={
          (createTeam.error as Error | null)?.message ??
          (importTeams.error as Error | null)?.message ??
          null
        }
        onDismiss={() => setCreating(false)}
        onSubmit={({ name, pick, addition }) => {
          const done = (message: string) => {
            setCreating(false);
            toast.success(message);
          };
          if (pick) {
            // Schritt 8 aus «Team anlegen»: anlegen und verknüpfen in einem Zug.
            importTeams.mutate(
              {
                federation: pick.federation,
                items: [
                  {
                    federation_team_id: pick.remote.id,
                    name: pick.remote.name,
                    league: pick.remote.league,
                    team_id: null,
                    name_addition: addition || null,
                  },
                ],
              },
              {
                // Schritt 9: Die Spiele sind da – oder die Meldung sagt, warum noch nicht (A7).
                onSuccess: ({ sync }) => {
                  const name = composeTeamName(pick.remote.name, addition);
                  done(
                    sync.games === null
                      ? t('teams.linkedPending', { name, reason: sync.error })
                      : t('teams.linkedGames', { name, count: sync.games }),
                  );
                },
              },
            );
            return;
          }
          createTeam.mutate(name, { onSuccess: () => done(t('members.teamCreated')) });
        }}
      />

      {/* A1: mehrere Teams auf einmal. */}
      <FederationImportModal
        isOpen={importing}
        teams={teams.data ?? []}
        onDismiss={() => setImporting(false)}
        onDone={({ created, linked, sync }) => {
          setImporting(false);
          toast.success(
            sync.games === null
              ? t('teams.importedPending', { created, linked, reason: sync.error })
              : t('teams.importedGames', { created, linked, count: sync.games }),
          );
        }}
      />
    </AppPage>
  );
}

/** Was «Team anlegen» abgibt: ein Name – oder ein Verbands-Team samt Zusatz (UC-039). */
export interface TeamCreateInput {
  name: string;
  pick: FederationPick | null;
  addition: string;
}

interface TeamCreateProps {
  teams: readonly Team[];
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (input: TeamCreateInput) => void;
  onDismiss: () => void;
  isOpen?: boolean;
}

/**
 * UC-007 A1: ein neues Team – ein Name genügt, der Bereich kommt im Detail.
 *
 * UC-039, Schritte 2–7: Mit gewähltem Verbands-Team kommt der Name vom
 * Verband; das Namensfeld weicht dem Zusatz (BR-176).
 */
export function TeamCreate({
  teams,
  isSubmitting,
  error,
  onSubmit,
  onDismiss,
  isOpen = true,
}: TeamCreateProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [pick, setPick] = useState<FederationPick | null>(null);
  const [addition, setAddition] = useState('');
  const problems = pick ? validateNameAddition(addition) : validateTeamName(name);

  return (
    <FormModal
      isOpen={isOpen}
      title={t('members.addTeam')}
      submitLabel={t('common.create')}
      canSubmit={problems.length === 0 && !isSubmitting}
      isSubmitting={isSubmitting}
      error={error}
      onDismiss={onDismiss}
      onSubmit={() => onSubmit({ name, pick, addition })}
    >
      {!pick && (
        <ListSection footnote={t('members.addTeamHint')}>
          <IonItem>
            <IonInput
              label={t('members.teamName')}
              labelPlacement="stacked"
              enterkeyhint="done"
              value={name}
              onIonInput={(e) => setName(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      )}
      {!pick && name.length > 0 && problems.includes('nameMissing') && (
        <InlineError message={t('teams.problem.nameMissing')} />
      )}

      <FederationTeamSection
        team={null}
        teams={teams}
        pick={pick}
        onPick={setPick}
        addition={addition}
        onAddition={setAddition}
        onLeave={onDismiss}
      />

      <IonNote className="app-footnote">{t('teams.createHint')}</IonNote>
    </FormModal>
  );
}

function TeamCreateModal({ isOpen, ...props }: TeamCreateProps & { isOpen: boolean }) {
  const sheet = useSheetProps(isOpen ? props : null);
  return sheet && <TeamCreate {...sheet} />;
}

import { useState } from 'react';
import { IonBadge, IonInput, IonItem, IonLabel, IonNote } from '@ionic/react';
import { peopleOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../../components/AppPage';
import { FormModal } from '../../components/FormModal';
import { ListSection } from '../../components/ListSection';
import { SkeletonList } from '../../components/Skeletons';
import { EmptyState, ErrorState, InlineError } from '../../components/StateViews';
import { TeamDetailModal } from '../../components/TeamDetailModal';
import { useTeams } from '../../hooks/useInvites';
import { useCreateTeam, useMembers } from '../../hooks/useMembers';
import { useAreas } from '../../hooks/useTeamAdmin';
import { useSheetProps } from '../../hooks/useSheetProps';
import { useToast } from '../../hooks/useToast';
import type { Team } from '../../lib/database.types';
import { groupTeamsByArea, validateTeamName } from '../../lib/team';

/**
 * Die Teams des Vereins (UC-007 A1; S2 der Prüfung vom 2026-09-11).
 *
 * Die bestehende myclub-App hat dafür `team-list`, `team-detail` und
 * `team-member-list`; hier gab es Teams nur als Kästchen im Mitglied-Detail.
 * Und UC-039 setzt in Schritt 1 ein Teamformular voraus – das ist es.
 *
 * Gruppiert nach Bereich: Der Bereich ist das, was die Sportchef:in führt
 * (Vision §4), und die Liste soll sich wie ein Organigramm lesen.
 */
export function TeamPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const teams = useTeams();
  const members = useMembers();
  const areas = useAreas();
  const createTeam = useCreateTeam();

  const [creating, setCreating] = useState(false);
  const [openTeam, setOpenTeam] = useState<Team | null>(null);

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
        onDismiss={() => setOpenTeam(null)}
        onDone={(outcome) => {
          setOpenTeam(null);
          toast.success(t(outcome === 'deleted' ? 'teams.deleted' : 'common.saved'));
        }}
      />

      <TeamCreateModal
        isOpen={creating}
        isSubmitting={createTeam.isPending}
        error={createTeam.error ? (createTeam.error as Error).message : null}
        onDismiss={() => setCreating(false)}
        onSubmit={(name) =>
          createTeam.mutate(name, {
            onSuccess: () => {
              setCreating(false);
              toast.success(t('members.teamCreated'));
            },
          })
        }
      />
    </AppPage>
  );
}

interface TeamCreateProps {
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (name: string) => void;
  onDismiss: () => void;
  isOpen?: boolean;
}

/** UC-007 A1: ein neues Team – ein Name genügt, der Bereich kommt im Detail. */
export function TeamCreate({ isSubmitting, error, onSubmit, onDismiss, isOpen = true }: TeamCreateProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const problems = validateTeamName(name);

  return (
    <FormModal
      isOpen={isOpen}
      title={t('members.addTeam')}
      submitLabel={t('common.create')}
      canSubmit={problems.length === 0 && !isSubmitting}
      isSubmitting={isSubmitting}
      error={error}
      onDismiss={onDismiss}
      onSubmit={() => onSubmit(name)}
    >
      <ListSection footnote={t('members.addTeamHint')}>
        <IonItem>
          <IonInput
            label={t('members.teamName')}
            labelPlacement="stacked"
            value={name}
            onIonInput={(e) => setName(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>
      {name.length > 0 && problems.includes('nameMissing') && (
        <InlineError message={t('teams.problem.nameMissing')} />
      )}
      <IonNote className="app-footnote">{t('teams.createHint')}</IonNote>
    </FormModal>
  );
}

function TeamCreateModal({ isOpen, ...props }: TeamCreateProps & { isOpen: boolean }) {
  const sheet = useSheetProps(isOpen ? props : null);
  return sheet && <TeamCreate {...sheet} />;
}

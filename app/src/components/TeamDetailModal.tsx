import { useState } from 'react';
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonNote,
} from '@ionic/react';
import { personRemoveOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useSetMemberTeams, type ClubMemberWithTeams } from '../hooks/useMembers';
import { useDeleteTeam, useUpdateTeam } from '../hooks/useTeamAdmin';
import { useSheetProps } from '../hooks/useSheetProps';
import { useToast } from '../hooks/useToast';
import { FormModal } from './FormModal';
import { ListSection } from './ListSection';
import { MemberAvatar } from './MemberAvatar';
import { InlineError } from './StateViews';
import type { Team } from '../lib/database.types';
import { validateTeamName } from '../lib/team';

interface TeamDetailProps {
  team: Team;
  /** Alle Mitglieder des Vereins – die des Teams werden hier herausgefiltert. */
  members: readonly ClubMemberWithTeams[];
  /** Bereiche, die der Verein schon verwendet – als Hinweis unter dem Feld. */
  areas: readonly string[];
  onDone: (outcome: 'saved' | 'deleted') => void;
  onDismiss: () => void;
  isOpen?: boolean;
}

/**
 * Ein Team: Name, Bereich, Mitglieder (S2 der Prüfung vom 2026-09-11).
 *
 * Nachbau der Seiten `team-detail` und `team-member-list` der bestehenden
 * myclub-App – in einem Blatt, weil ein Team so klein ist: ein Name, ein
 * Bereich, eine Handvoll Zeilen. Wer hier ein Mitglied nach links wischt,
 * nimmt es aus dem Team, nicht aus dem Verein.
 *
 * Löschen geht nur über die Rückfrage, und der Riegel dagegen sitzt in
 * `delete_team()`: Ein Team mit Terminen bleibt, und die Meldung sagt, was
 * noch dranhängt.
 */
export function TeamDetail({
  team,
  members,
  areas,
  onDone,
  onDismiss,
  isOpen = true,
}: TeamDetailProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const update = useUpdateTeam();
  const remove = useDeleteTeam();
  const setMemberTeams = useSetMemberTeams();

  const [name, setName] = useState(team.name);
  const [area, setArea] = useState(team.area ?? '');
  const [askDelete, setAskDelete] = useState(false);

  const problems = validateTeamName(name);
  const inTeam = members.filter((member) => member.teamIds.includes(team.id));
  const isBusy = update.isPending || remove.isPending || setMemberTeams.isPending;
  const error =
    (update.error as Error | null)?.message ??
    (remove.error as Error | null)?.message ??
    (setMemberTeams.error as Error | null)?.message ??
    null;

  return (
    <FormModal
      isOpen={isOpen}
      title={team.name}
      submitLabel={t('common.save')}
      canSubmit={problems.length === 0 && !isBusy}
      isSubmitting={isBusy}
      error={error}
      onDismiss={onDismiss}
      onSubmit={() =>
        update.mutate(
          { teamId: team.id, name, area },
          { onSuccess: () => onDone('saved') },
        )
      }
    >
      <ListSection footnote={t('teams.areaHint')}>
        <IonItem>
          <IonInput
            label={t('members.teamName')}
            labelPlacement="stacked"
            value={name}
            onIonInput={(e) => setName(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label={t('teams.area')}
            labelPlacement="stacked"
            placeholder={areas.length > 0 ? areas.join(' · ') : t('members.areaPlaceholder')}
            value={area}
            onIonInput={(e) => setArea(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>

      {problems.includes('nameMissing') && <InlineError message={t('teams.problem.nameMissing')} />}

      {/* Die Mitglieder des Teams – dieselbe Zeile wie in der Mitgliederliste.
          Wischen nach links nimmt aus dem Team; in den Verein greift das nicht. */}
      <ListSection
        title={t('teams.memberCount', { count: inTeam.length })}
        footnote={t('teams.membersHint')}
      >
        {inTeam.length === 0 ? (
          <IonItem lines="none">
            <IonNote>{t('teams.noMembers')}</IonNote>
          </IonItem>
        ) : (
          inTeam.map((member) => (
            <IonItemSliding key={member.id}>
              <IonItem>
                <MemberAvatar displayName={member.display_name} avatarUrl={member.avatar_url} />
                <IonLabel className="ion-text-wrap">
                  <h2>{member.display_name}</h2>
                </IonLabel>
                {member.role !== 'member' && (
                  <IonBadge slot="end" color="primary">
                    {t(`invite.role.${member.role === 'superadmin' ? 'admin' : member.role}`)}
                  </IonBadge>
                )}
              </IonItem>
              <IonItemOptions side="end">
                <IonItemOption
                  color="danger"
                  disabled={setMemberTeams.isPending}
                  onClick={() =>
                    setMemberTeams.mutate(
                      {
                        memberId: member.id,
                        teamIds: member.teamIds.filter((id) => id !== team.id),
                      },
                      {
                        onSuccess: () => toast.success(t('teams.memberRemoved')),
                        onError: (cause) => toast.failure(cause.message),
                      },
                    )
                  }
                >
                  <IonIcon slot="icon-only" icon={personRemoveOutline} />
                </IonItemOption>
              </IonItemOptions>
            </IonItemSliding>
          ))
        )}
      </ListSection>

      <div className="app-actions">
        <IonButton
          expand="block"
          fill="clear"
          color="danger"
          disabled={isBusy}
          onClick={() => setAskDelete(true)}
        >
          {t('teams.delete')}
        </IonButton>
      </div>

      {/* Das Löschen braucht eine Rückfrage; der Riegel gegen ein Team mit
          Vergangenheit sitzt am Server und meldet, was noch dranhängt. */}
      <IonAlert
        isOpen={askDelete}
        header={t('teams.delete')}
        message={t('teams.deleteConfirm', { name: team.name })}
        onDidDismiss={() => setAskDelete(false)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('teams.delete'),
            role: 'destructive',
            handler: () =>
              remove.mutate(team.id, {
                onSuccess: () => onDone('deleted'),
                onError: (cause) => toast.failure(cause.message),
              }),
          },
        ]}
      />
    </FormModal>
  );
}

/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function TeamDetailModal({
  team,
  ...props
}: Omit<TeamDetailProps, 'team'> & { team: Team | null }) {
  const sheet = useSheetProps(team ? { team, ...props } : null);
  return sheet && <TeamDetail {...sheet} />;
}

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
import { useDeleteTeam, useLinkTeam, useUpdateTeam } from '../hooks/useTeamAdmin';
import { useSheetProps } from '../hooks/useSheetProps';
import { useToast } from '../hooks/useToast';
import { FederationTeamSection, type FederationPick } from './FederationTeamSection';
import { FormModal } from './FormModal';
import { ListSection } from './ListSection';
import { MemberAvatar } from './MemberAvatar';
import { InlineError } from './StateViews';
import type { Team } from '../lib/database.types';
import { composeTeamName, isLinked, validateNameAddition, validateTeamName } from '../lib/team';

interface TeamDetailProps {
  team: Team;
  /** Alle Mitglieder des Vereins – die des Teams werden hier herausgefiltert. */
  members: readonly ClubMemberWithTeams[];
  /** Bereiche, die der Verein schon verwendet – als Hinweis unter dem Feld. */
  areas: readonly string[];
  /** Alle Teams des Vereins – für die Frage, welches Verbands-Team schon vergeben ist. */
  teams: readonly Team[];
  /** `silent`: Das Blatt hat selbst gesagt, was geschehen ist. */
  onDone: (outcome: 'saved' | 'deleted' | 'silent') => void;
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
 *
 * **UC-039:** Der Abschnitt «Verbands-Team» ist `FederationTeamSection`. Bei
 * einem verknüpften Team weicht das Namensfeld dem Zusatz – der Grundname
 * gehört dem Verband (BR-176), und der Trigger in `0060` setzt beides zusammen.
 */
export function TeamDetail({
  team,
  members,
  areas,
  teams,
  onDone,
  onDismiss,
  isOpen = true,
}: TeamDetailProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const update = useUpdateTeam();
  const remove = useDeleteTeam();
  const link = useLinkTeam();
  const setMemberTeams = useSetMemberTeams();

  const [name, setName] = useState(team.name);
  const [area, setArea] = useState(team.area ?? '');
  const [askDelete, setAskDelete] = useState(false);
  const [pick, setPick] = useState<FederationPick | null>(null);
  const [addition, setAddition] = useState(team.name_addition ?? '');

  const linked = isLinked(team);
  const problems = [
    ...(linked ? [] : validateTeamName(name)),
    ...(linked || pick ? validateNameAddition(addition) : []),
  ];
  const inTeam = members.filter((member) => member.teamIds.includes(team.id));
  const isBusy =
    update.isPending || remove.isPending || link.isPending || setMemberTeams.isPending;
  const error =
    (update.error as Error | null)?.message ??
    (remove.error as Error | null)?.message ??
    (link.error as Error | null)?.message ??
    (setMemberTeams.error as Error | null)?.message ??
    null;

  /**
   * Erst Bereich und Name (oder Zusatz), dann die Verknüpfung: `link_team()`
   * setzt den Namen aus Grundname und Zusatz neu zusammen (BR-176). Schlägt
   * ein Schritt fehl, steht seine Meldung über `error` im Blatt.
   */
  async function save() {
    await update.mutateAsync({
      teamId: team.id,
      area,
      ...(linked ? { nameAddition: addition } : { name }),
    });
    if (pick) {
      const sync = await link.mutateAsync({
        teamId: team.id,
        federation: pick.federation,
        federationTeamId: pick.remote.id,
        name: pick.remote.name,
        league: pick.remote.league,
        nameAddition: addition,
      });
      // Schritt 9: Die Spiele sind schon da – oder die Meldung sagt, warum
      // noch nicht (A7). Die Verknüpfung steht in beiden Fällen.
      const name = composeTeamName(pick.remote.name, addition);
      toast.success(
        sync.games === null
          ? t('teams.linkedPending', { name, reason: sync.error })
          : t('teams.linkedGames', { name, count: sync.games }),
      );
      onDone('silent');
      return;
    }
    onDone('saved');
  }

  return (
    <FormModal
      isOpen={isOpen}
      title={team.name}
      submitLabel={t('common.save')}
      canSubmit={problems.length === 0 && !isBusy}
      isSubmitting={isBusy}
      error={error}
      onDismiss={onDismiss}
      // Die Meldung eines Fehlschlags kommt über `error` aus dem Mutationszustand.
      onSubmit={() => void save().catch(() => undefined)}
    >
      <ListSection footnote={t('teams.areaHint')}>
        {!linked && (
          <IonItem>
            <IonInput
              label={t('members.teamName')}
              labelPlacement="stacked"
              value={name}
              onIonInput={(e) => setName(e.detail.value ?? '')}
            />
          </IonItem>
        )}
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

      {/* UC-039, Schritte 2–7 und A2/A4/A5. */}
      <FederationTeamSection
        team={team}
        teams={teams}
        pick={pick}
        onPick={setPick}
        addition={addition}
        onAddition={setAddition}
        onLeave={onDismiss}
        onUnlinked={() => onDone('silent')}
      />

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

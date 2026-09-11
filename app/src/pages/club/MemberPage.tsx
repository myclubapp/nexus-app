import { useMemo, useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonCheckbox,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { peopleOutline, sparklesOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useClub } from '../../hooks/useClub';
import { useTeams } from '../../hooks/useInvites';
import {
  useCreateTeam,
  useMembers,
  useSetMemberTeams,
  useUpdateMember,
  type ClubMemberWithTeams,
} from '../../hooks/useMembers';
import { useToast } from '../../hooks/useToast';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { FormModal } from '../../components/FormModal';
import { SkeletonList } from '../../components/Skeletons';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { MemberAvatar } from '../../components/MemberAvatar';
import {
  ASSIGNABLE_ROLES,
  hasArea,
  EMPTY_MEMBER_FILTER,
  MEMBER_STATUSES,
  filterMembers,
  isLastAdmin,
  type MemberFilter,
  type MemberStatus,
} from '../../lib/member';
import type { MemberRole, PointTransaction } from '../../lib/database.types';
import { formatDate, formatDateTime } from '../../lib/format';
import { bookingLabel } from '../../lib/points';
import { BookPointsModal } from '../../components/BookPointsModal';
import {
  useMemberPoints,
  useRuleLabels,
} from '../../hooks/useGamification';

/**
 * Mitglieder, Rollen und Teams (UC-007).
 *
 * Das Ausblenden für Nicht-Vorstände ist Bequemlichkeit; durchgesetzt wird die
 * Berechtigung von der Policy `members_admin_write` und dem Trigger, der den
 * letzten Vorstand schützt (BR-026, BR-027).
 */
export function MemberPage() {
  const { t } = useTranslation();
  const { isAdmin } = useClub();
  const toast = useToast();

  const members = useMembers();
  const teams = useTeams();
  const updateMember = useUpdateMember();
  const setMemberTeams = useSetMemberTeams();
  const createTeam = useCreateTeam();
  const ruleLabels = useRuleLabels();

  const [filter, setFilter] = useState<MemberFilter>(EMPTY_MEMBER_FILTER);
  const [open, setOpen] = useState<ClubMemberWithTeams | null>(null);
  const [role, setRole] = useState<MemberRole>('member');
  const [status, setStatus] = useState<MemberStatus>('active');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [area, setArea] = useState('');

  const [isTeamFormOpen, setTeamFormOpen] = useState(false);
  const [teamName, setTeamName] = useState('');

  // UC-021: Buchen und Korrigieren laufen über **dasselbe** Blatt; welcher
  // Weg gemeint ist, entscheidet, ob eine Buchung mitgegeben wird.
  const [bookFor, setBookFor] = useState<string[] | null>(null);
  const [correcting, setCorrecting] = useState<PointTransaction | null>(null);
  const ledger = useMemberPoints(open?.id ?? null);

  const all = useMemo(() => members.data ?? [], [members.data]);
  const visible = useMemo(() => filterMembers(all, filter), [all, filter]);

  function openMember(member: ClubMemberWithTeams) {
    setOpen(member);
    setRole(member.role);
    setStatus(member.status);
    setTeamIds(member.teamIds);
    setArea(member.area ?? '');
  }

  async function save() {
    if (!open) return;
    try {
      await updateMember.mutateAsync({
        memberId: open.id,
        role,
        status,
        area: hasArea(role) ? area : null,
      });
      await setMemberTeams.mutateAsync({ memberId: open.id, teamIds });
      setOpen(null);
      toast.success(t('common.saved'));
    } catch (cause) {
      // A2: Die Abweisung des Triggers ist die Erklärung, warum es nicht geht.
      toast.failure(cause instanceof Error ? cause.message : t('common.error'));
    }
  }

  if (!isAdmin) {
    return (
      <AppPage title={t('members.title')} backHref="/tabs/profile">
        <EmptyState
          message={t('clubSettings.adminOnly')}
          action={{ label: t('profile.title'), routerLink: '/tabs/profile' }}
        />
      </AppPage>
    );
  }

  return (
    <AppPage
      title={t('members.title')}
      backHref="/tabs/profile"
      createActions={[
        {
          icon: peopleOutline,
          label: t('members.addTeam'),
          onClick: () => {
            setTeamName('');
            setTeamFormOpen(true);
          },
        },
        /* A3: für mehrere Mitglieder auf einmal. */
        {
          icon: sparklesOutline,
          label: t('bookPoints.title'),
          onClick: () => setBookFor([]),
        },
      ]}
      subToolbar={
        <IonSearchbar
          value={filter.search}
          placeholder={t('members.search')}
          onIonInput={(e) =>
            setFilter((current) => ({ ...current, search: e.detail.value ?? '' }))
          }
        />
      }
      onRefresh={() => members.refetch()}
    >
      {members.isLoading ? (
        <SkeletonList rows={6} />
      ) : members.error ? (
        <ErrorState
          error={members.error as Error}
          onRetry={() => void members.refetch()}
        />
      ) : (
        <>
          {/* A4: Filtern, sobald die Liste lang wird. */}
          <ListSection title={t('members.filter')}>
            <IonItem>
              <IonSelect
                label={t('leaderboard.team')}
                value={filter.teamId}
                onIonChange={(e) =>
                  setFilter((current) => ({
                    ...current,
                    teamId: (e.detail.value as string | null) ?? null,
                  }))
                }
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
              >
                <IonSelectOption value={null}>{t('members.filterAll')}</IonSelectOption>
                {(teams.data ?? []).map((team) => (
                  <IonSelectOption key={team.id} value={team.id}>
                    {team.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonItem>
              <IonSelect
                label={t('invite.roleLabel')}
                value={filter.role}
                onIonChange={(e) =>
                  setFilter((current) => ({
                    ...current,
                    role: (e.detail.value as MemberRole | null) ?? null,
                  }))
                }
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
              >
                <IonSelectOption value={null}>{t('members.filterAll')}</IonSelectOption>
                {ASSIGNABLE_ROLES.map((entry) => (
                  <IonSelectOption key={entry} value={entry}>
                    {t(`invite.role.${entry}`)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonItem>
              <IonSelect
                label={t('members.status')}
                value={filter.status}
                onIonChange={(e) =>
                  setFilter((current) => ({
                    ...current,
                    status: (e.detail.value as MemberStatus | null) ?? null,
                  }))
                }
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
              >
                <IonSelectOption value={null}>{t('members.filterAll')}</IonSelectOption>
                {MEMBER_STATUSES.map((entry) => (
                  <IonSelectOption key={entry} value={entry}>
                    {t(`members.statusValue.${entry}`)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </ListSection>

          {visible.length === 0 ? (
            <EmptyState
              message={t('members.empty')}
              action={{ label: t('members.resetFilter'), onClick: () => setFilter(EMPTY_MEMBER_FILTER) }}
            />
          ) : (
            <ListSection
              title={t('members.count', { count: visible.length })}
              footnote={t('members.listFootnote')}
            >
              {visible.map((member) => (
                <IonItem key={member.id} button detail onClick={() => openMember(member)}>
                  {/* Wie in der bestehenden myclub-App: links der Avatar,
                      die Rolle als Abzeichen, nicht als Nebensatz. */}
                  <MemberAvatar displayName={member.display_name} avatarUrl={member.avatar_url} />
                  <IonLabel className="ion-text-wrap">
                    <h2>{member.display_name}</h2>
                    {member.teamNames.length > 0 && (
                      <IonNote>{member.teamNames.join(', ')}</IonNote>
                    )}
                    {member.role !== 'member' && (
                      <p>
                        <IonBadge color="primary">
                          {t(`invite.role.${member.role === 'superadmin' ? 'admin' : member.role}`)}
                          {hasArea(member.role) && member.area ? ` · ${member.area}` : ''}
                        </IonBadge>
                      </p>
                    )}
                  </IonLabel>
                  {member.status !== 'active' && (
                    <IonBadge slot="end" color="medium">
                      {t(`members.statusValue.${member.status}`)}
                    </IonBadge>
                  )}
                </IonItem>
              ))}
            </ListSection>
          )}
        </>
      )}

      {/* UC-021: Buchen und Korrigieren – dasselbe Blatt, zwei Wege. */}
      <BookPointsModal
        isOpen={bookFor !== null || correcting !== null}
        members={all.map((member) => ({
          id: member.id,
          displayName: member.display_name,
        }))}
        preselected={bookFor ?? []}
        correcting={correcting}
        correctingLabel={
          correcting ? bookingLabel(correcting, ruleLabels.data ?? []) : undefined
        }
        onDismiss={() => {
          setBookFor(null);
          setCorrecting(null);
        }}
        onDone={(count, corrected) => {
          setBookFor(null);
          setCorrecting(null);
          toast.success(
            corrected
              ? t('bookPoints.corrected')
              : t('bookPoints.booked', { count }),
          );
        }}
      />

      {/* Mitgliedsdetails (Schritt 4–7) */}
      <FormModal
        isOpen={open !== null}
        title={open?.display_name ?? ''}
        canSubmit={!updateMember.isPending && !setMemberTeams.isPending}
        isSubmitting={updateMember.isPending || setMemberTeams.isPending}
        onDismiss={() => setOpen(null)}
        onSubmit={() => void save()}
      >
        {open && (
          <>
            <ListSection
              footnote={
                isLastAdmin(all, open.id) ? t('members.lastAdminHint') : undefined
              }
            >
              <IonItem>
                <IonLabel>{t('profile.memberSinceLabel')}</IonLabel>
                <IonNote slot="end">{formatDate(open.member_since)}</IonNote>
              </IonItem>

              <IonItem>
                <IonSelect
                  label={t('invite.roleLabel')}
                  value={role}
                  onIonChange={(e) => setRole(e.detail.value as MemberRole)}
                  cancelText={t('common.cancel')}
                  okText={t('common.ok')}
                >
                  {ASSIGNABLE_ROLES.map((entry) => (
                    <IonSelectOption key={entry} value={entry}>
                      {t(`invite.role.${entry}`)}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>

              {/* Vision §4: Die Sportchef:in führt einen Bereich. Ein Wort,
                  frei gewählt; leer heisst «alle Teams». */}
              {hasArea(role) && (
                <IonItem>
                  <IonInput
                    label={t('members.area')}
                    labelPlacement="stacked"
                    placeholder={t('members.areaPlaceholder')}
                    value={area}
                    onIonInput={(e) => setArea(e.detail.value ?? '')}
                  />
                </IonItem>
              )}

              <IonItem>
                <IonSelect
                  label={t('members.status')}
                  value={status}
                  onIonChange={(e) => setStatus(e.detail.value as MemberStatus)}
                  cancelText={t('common.cancel')}
                  okText={t('common.ok')}
                >
                  {MEMBER_STATUSES.map((entry) => (
                    <IonSelectOption key={entry} value={entry}>
                      {t(`members.statusValue.${entry}`)}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            </ListSection>

            {/* BR-025: Mehrere Teams gleichzeitig, deshalb Kästchen statt Auswahl. */}
            <ListSection title={t('members.teams')} footnote={t('members.teamsHint')}>
              {(teams.data ?? []).length === 0 ? (
                <IonItem>
                  <IonNote>{t('members.noTeams')}</IonNote>
                </IonItem>
              ) : (
                (teams.data ?? []).map((team) => (
                  <IonItem key={team.id}>
                    <IonCheckbox
                      checked={teamIds.includes(team.id)}
                      onIonChange={(e) =>
                        setTeamIds((current) =>
                          e.detail.checked
                            ? [...current, team.id]
                            : current.filter((id) => id !== team.id),
                        )
                      }
                    >
                      {team.name}
                    </IonCheckbox>
                  </IonItem>
                ))
              )}
            </ListSection>

            {/* UC-024 A4: dieselbe Ansicht als Gesprächsgrundlage. Ohne
                Einstieg wäre die Führungssicht gebaut und unerreichbar. */}
            <ListSection footnote={t('dimensions.leadHint')}>
              <IonItem
                button
                detail
                routerLink={`/tabs/profile/strengths?member=${open.id}`}
              >
                <IonLabel>{t('dimensions.leadTitle')}</IonLabel>
              </IonItem>
            </ListSection>

            {/* UC-021 Schritt 1 und A1: der Ledger dieses Mitglieds. Ihn sieht
                seit `0037` nur der Vorstand – und er sieht ihn, weil er ihn
                führt. */}
            {isAdmin && (
              <ListSection
                title={t('bookPoints.ledger')}
                footnote={t('bookPoints.ledgerHint')}
                action={
                  <IonButton
                    fill="clear"
                    size="small"
                    onClick={() => {
                      // Blätter werden nacheinander gezeigt, nicht ineinander:
                      // Ein Blatt im Blatt ist auf iOS kein Muster.
                      const id = open.id;
                      setOpen(null);
                      setBookFor([id]);
                    }}
                  >
                    {t('bookPoints.book')}
                  </IonButton>
                }
              >
                {ledger.isLoading ? (
                  <IonItem>
                    <IonNote>{t('common.loading')}</IonNote>
                  </IonItem>
                ) : (ledger.data ?? []).length === 0 ? (
                  <IonItem>
                    <IonNote>{t('common.empty')}</IonNote>
                  </IonItem>
                ) : (
                  (ledger.data ?? []).slice(0, 10).map((entry) => (
                    <IonItem key={entry.id}>
                      <IonLabel className="ion-text-wrap">
                        <h2>{bookingLabel(entry, ruleLabels.data ?? [])}</h2>
                        <IonNote>{formatDateTime(entry.created_at)}</IonNote>
                      </IonLabel>
                      <IonNote
                        slot="end"
                        color={entry.points >= 0 ? 'primary' : 'danger'}
                      >
                        {entry.points >= 0 ? `+${entry.points}` : entry.points}
                      </IonNote>
                      {/* Eine Gegenbuchung wird nicht ihrerseits ausgeglichen. */}
                      {entry.source_type !== 'correction' && (
                        <IonButton
                          slot="end"
                          size="small"
                          fill="clear"
                          color="medium"
                          onClick={() => {
                            setOpen(null);
                            setCorrecting(entry);
                          }}
                        >
                          {t('bookPoints.correct')}
                        </IonButton>
                      )}
                    </IonItem>
                  ))
                )}
              </ListSection>
            )}
          </>
        )}
      </FormModal>

      {/* A1: Team anlegen */}
      <FormModal
        isOpen={isTeamFormOpen}
        title={t('members.addTeam')}
        canSubmit={teamName.trim().length >= 2}
        isSubmitting={createTeam.isPending}
        error={createTeam.error ? (createTeam.error as Error).message : null}
        onDismiss={() => setTeamFormOpen(false)}
        onSubmit={() =>
          createTeam.mutate(teamName, {
            onSuccess: () => {
              setTeamFormOpen(false);
              toast.success(t('members.teamCreated'));
            },
          })
        }
      >
        <ListSection footnote={t('members.addTeamHint')}>
          <IonItem>
            <IonInput
              label={t('members.teamName')}
              labelPlacement="stacked"
              autocapitalize="words"
              value={teamName}
              onIonInput={(e) => setTeamName(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      </FormModal>
    </AppPage>
  );
}

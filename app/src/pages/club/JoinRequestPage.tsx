import { useState } from 'react';
import {
  IonButton,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useClub } from '../../hooks/useClub';
import { useTeams } from '../../hooks/useInvites';
import {
  useDecideJoinRequest,
  usePendingJoinRequests,
  type PendingJoinRequest,
} from '../../hooks/useJoinRequests';
import { useToast } from '../../hooks/useToast';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { FormModal } from '../../components/FormModal';
import { SkeletonList } from '../../components/Skeletons';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { DECIDABLE_ROLES } from '../../lib/joinRequest';
import { formatDateTime } from '../../lib/format';

type Role = (typeof DECIDABLE_ROLES)[number];

/**
 * Offene Beitritts-Anfragen (UC-004).
 *
 * Die Rolle admin wird von `decide_join_request()` geprüft, nicht vom
 * Ausblenden dieser Seite (BR-013, C-011).
 */
export function JoinRequestPage() {
  const { t } = useTranslation();
  const { isAdmin } = useClub();
  const toast = useToast();

  const requests = usePendingJoinRequests();
  const teams = useTeams();
  const decide = useDecideJoinRequest();

  const [open, setOpen] = useState<PendingJoinRequest | null>(null);
  const [role, setRole] = useState<Role>('member');
  const [teamId, setTeamId] = useState<string | null>(null);

  function openRequest(request: PendingJoinRequest) {
    setOpen(request);
    // BR-015: Ohne abweichende Wahl wird die Person Mitglied.
    setRole('member');
    setTeamId(request.team_id);
  }

  function submit(approve: boolean) {
    if (!open) return;
    decide.mutate(
      { requestId: open.id, approve, role, teamId },
      {
        onSuccess: (result) => {
          setOpen(null);
          toast.success(
            result === 'approved'
              ? t('joinRequest.approved')
              : t('joinRequest.rejected'),
          );
        },
        onError: (cause) => toast.failure(cause.message),
      },
    );
  }

  if (!isAdmin) {
    return (
      <AppPage title={t('joinRequest.title')} backHref="/tabs/profile">
        <EmptyState
          message={t('clubSettings.adminOnly')}
          action={{ label: t('profile.title'), routerLink: '/tabs/profile' }}
        />
      </AppPage>
    );
  }

  const rows = requests.data ?? [];

  return (
    <AppPage
      title={t('joinRequest.title')}
      backHref="/tabs/profile"
      onRefresh={() => requests.refetch()}
    >
      {requests.isLoading ? (
        <SkeletonList rows={3} />
      ) : requests.error ? (
        <ErrorState
          error={requests.error as Error}
          onRetry={() => void requests.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          message={t('joinRequest.empty')}
          action={{ label: t('invite.title'), routerLink: '/tabs/profile/invite' }}
        />
      ) : (
        <ListSection
          title={t('joinRequest.listTitle')}
          footnote={t('joinRequest.listFootnote')}
        >
          {rows.map((request) => (
            <IonItem key={request.id} button detail onClick={() => openRequest(request)}>
              <IonLabel className="ion-text-wrap">
                <h2>{request.teamName ?? t('invite.scopeClub')}</h2>
                <IonNote>
                  {t('joinRequest.requestedOn', {
                    date: formatDateTime(request.created_at),
                  })}
                </IonNote>
              </IonLabel>
            </IonItem>
          ))}
        </ListSection>
      )}

      <FormModal
        isOpen={open !== null}
        title={t('joinRequest.decide')}
        submitLabel={t('joinRequest.approve')}
        isSubmitting={decide.isPending}
        onDismiss={() => setOpen(null)}
        onSubmit={() => submit(true)}
      >
        <ListSection footnote={t('joinRequest.decideHint')}>
          <IonItem>
            <IonLabel>{t('joinRequest.requestedAt')}</IonLabel>
            <IonNote slot="end">
              {open ? formatDateTime(open.created_at) : ''}
            </IonNote>
          </IonItem>

          <IonItem>
            <IonSelect
              label={t('invite.roleLabel')}
              value={role}
              onIonChange={(e) => setRole(e.detail.value as Role)}
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
            >
              {DECIDABLE_ROLES.map((entry) => (
                <IonSelectOption key={entry} value={entry}>
                  {t(`invite.role.${entry}`)}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonSelect
              label={t('invite.scope')}
              value={teamId}
              onIonChange={(e) => setTeamId((e.detail.value as string | null) ?? null)}
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
            >
              <IonSelectOption value={null}>{t('invite.scopeClub')}</IonSelectOption>
              {(teams.data ?? []).map((team) => (
                <IonSelectOption key={team.id} value={team.id}>
                  {team.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </ListSection>

        {/* A1: Ablehnen steht bewusst nicht in der Kopfzeile neben
            «Aufnehmen» – die beiden sollen sich nicht verwechseln lassen. */}
        <div className="app-actions">
          <IonButton
            expand="block"
            fill="outline"
            color="medium"
            disabled={decide.isPending}
            onClick={() => submit(false)}
          >
            {t('joinRequest.reject')}
          </IonButton>
          <IonNote>{t('joinRequest.rejectHint')}</IonNote>
        </div>
      </FormModal>
    </AppPage>
  );
}

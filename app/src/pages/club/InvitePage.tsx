import { useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonNote,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { addOutline, copyOutline, shareOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { Share } from '@capacitor/share';
import { useClub } from '../../hooks/useClub';
import {
  INVALID_EXPIRY,
  INVITE_ROLES,
  INVITE_UNLIMITED_USES,
  defaultInviteExpiry,
  isInviteActive,
  useCreateInvite,
  useInvites,
  useRevokeInvite,
  useTeams,
} from '../../hooks/useInvites';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { FormModal } from '../../components/FormModal';
import { QrCode } from '../../components/QrCode';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { SkeletonList } from '../../components/Skeletons';
import { useToast } from '../../hooks/useToast';
import { canShareNatively, inviteLink } from '../../lib/invite';
import { formatDate } from '../../lib/format';
import type { Invite, InviteRole } from '../../lib/database.types';

/**
 * Einladungen verwalten (UC-003).
 *
 * Die Seite ist nur für den Vorstand sichtbar; durchgesetzt wird das von der
 * Policy `invites_admin` und nicht vom Ausblenden hier (BR-009, C-011).
 */
export function InvitePage() {
  const { t } = useTranslation();
  const { isAdmin } = useClub();
  const toast = useToast();

  const invites = useInvites();
  const teams = useTeams();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();

  const [isFormOpen, setFormOpen] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [role, setRole] = useState<InviteRole>('member');
  const [expiresOn, setExpiresOn] = useState(defaultInviteExpiry());
  const [maxUses, setMaxUses] = useState('');
  // A2: Wer die Rolle admin einlädt, bestätigt das ausdrücklich.
  const [adminConfirmed, setAdminConfirmed] = useState(false);

  const [shownInvite, setShownInvite] = useState<Invite | null>(null);

  // Der Hook meldet eine Kennung, wenn der Fehler an einem Feld hängt; alles
  // andere ist bereits eine Meldung der Datenbank.
  const rawError = createInvite.error ? (createInvite.error as Error).message : null;
  const createInviteError =
    rawError === INVALID_EXPIRY ? t(INVALID_EXPIRY) : rawError;

  function resetForm() {
    setTeamId(null);
    setRole('member');
    setExpiresOn(defaultInviteExpiry());
    setMaxUses('');
    setAdminConfirmed(false);
  }

  async function share(invite: Invite) {
    const url = inviteLink(invite.code);
    if (canShareNatively()) {
      try {
        await Share.share({ title: t('invite.shareTitle'), url });
        return;
      } catch {
        // Abbruch im Teilen-Dialog ist kein Fehler – dann bleibt Kopieren.
      }
    }
    await navigator.clipboard?.writeText(url);
    toast.success(t('invite.copied'));
  }

  if (!isAdmin) {
    return (
      <AppPage title={t('invite.title')} backHref="/tabs/profile">
        <EmptyState message={t('clubSettings.adminOnly')} />
      </AppPage>
    );
  }

  const rows = invites.data ?? [];

  return (
    <AppPage
      title={t('invite.title')}
      backHref="/tabs/profile"
      toolbarEnd={
        <IonButtons slot="end">
          <IonButton
            onClick={() => {
              resetForm();
              setFormOpen(true);
            }}
          >
            <IonIcon slot="icon-only" icon={addOutline} aria-label={t('invite.create')} />
          </IonButton>
        </IonButtons>
      }
      onRefresh={() => invites.refetch()}
    >
      {invites.isLoading ? (
        <SkeletonList />
      ) : invites.error ? (
        <ErrorState
          error={invites.error as Error}
          onRetry={() => void invites.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState message={t('invite.empty')} />
      ) : (
        <ListSection title={t('invite.listTitle')} footnote={t('invite.listFootnote')}>
          {rows.map((invite) => {
            const active = isInviteActive(invite);
            const team = teams.data?.find((entry) => entry.id === invite.team_id);

            return (
              <IonItemSliding key={invite.id}>
                <IonItem button detail onClick={() => setShownInvite(invite)}>
                  <IonLabel className="ion-text-wrap">
                    <h2>
                      {team ? team.name : t('invite.scopeClub')} ·{' '}
                      {t(`invite.role.${invite.role}`)}
                    </h2>
                    <IonNote>
                      {t('invite.expiresOn', { date: formatDate(invite.expires_at) })}
                      {' · '}
                      {invite.max_uses >= INVITE_UNLIMITED_USES
                        ? t('invite.usesUnlimited', { used: invite.uses })
                        : t('invite.uses', {
                            used: invite.uses,
                            max: invite.max_uses,
                          })}
                    </IonNote>
                  </IonLabel>
                  <IonBadge slot="end" color={active ? 'success' : 'medium'}>
                    {active ? t('invite.active') : t('invite.inactive')}
                  </IonBadge>
                </IonItem>

                {active && (
                  <IonItemOptions side="end">
                    <IonItemOption
                      color="danger"
                      disabled={revokeInvite.isPending}
                      onClick={() =>
                        revokeInvite.mutate(invite.id, {
                          onSuccess: () => toast.success(t('invite.revoked')),
                          onError: (cause) => toast.failure(cause.message),
                        })
                      }
                    >
                      {t('invite.revoke')}
                    </IonItemOption>
                  </IonItemOptions>
                )}
              </IonItemSliding>
            );
          })}
        </ListSection>
      )}

      {/* Erstellen (Schritte 2–7) */}
      <FormModal
        isOpen={isFormOpen}
        title={t('invite.create')}
        submitLabel={t('invite.createAction')}
        canSubmit={Boolean(expiresOn) && (role !== 'admin' || adminConfirmed)}
        isSubmitting={createInvite.isPending}
        error={createInviteError}
        onDismiss={() => setFormOpen(false)}
        onSubmit={() =>
          createInvite.mutate(
            {
              teamId,
              role,
              expiresOn,
              maxUses: maxUses.trim() ? Number(maxUses) : null,
            },
            {
              onSuccess: (invite) => {
                setFormOpen(false);
                setShownInvite(invite);
                toast.success(t('invite.created'));
              },
            },
          )
        }
      >
        <ListSection footnote={t('invite.scopeHint')}>
          <IonItem>
            <IonSelect
              label={t('invite.scope')}
              value={teamId}
              onIonChange={(e) => setTeamId((e.detail.value as string | null) ?? null)}
            >
              <IonSelectOption value={null}>{t('invite.scopeClub')}</IonSelectOption>
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
              value={role}
              onIonChange={(e) => {
                setRole(e.detail.value as InviteRole);
                setAdminConfirmed(false);
              }}
            >
              {INVITE_ROLES.map((entry) => (
                <IonSelectOption key={entry} value={entry}>
                  {t(`invite.role.${entry}`)}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </ListSection>

        {role === 'admin' && (
          <ListSection footnote={t('invite.adminWarning')}>
            <IonItem>
              <IonLabel className="ion-text-wrap">{t('invite.adminConfirm')}</IonLabel>
              <IonButton
                slot="end"
                fill={adminConfirmed ? 'solid' : 'outline'}
                size="small"
                onClick={() => setAdminConfirmed((value) => !value)}
              >
                {adminConfirmed ? t('invite.adminConfirmed') : t('common.confirm')}
              </IonButton>
            </IonItem>
          </ListSection>
        )}

        <ListSection footnote={t('invite.limitsHint')}>
          <IonItem>
            <IonInput
              type="date"
              label={t('invite.expiresLabel')}
              labelPlacement="stacked"
              value={expiresOn}
              onIonInput={(e) => setExpiresOn(e.detail.value ?? '')}
            />
          </IonItem>
          <IonItem>
            <IonInput
              type="number"
              inputmode="numeric"
              min={1}
              label={t('invite.maxUsesLabel')}
              labelPlacement="stacked"
              placeholder={t('invite.maxUsesUnlimited')}
              value={maxUses}
              onIonInput={(e) => setMaxUses(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      </FormModal>

      {/* Teilen (Schritt 7 und 8). Kein FormModal: Hier wird nichts erfasst,
          und zwei Knöpfe, die beide nur schliessen, wären eine Zumutung. */}
      <IonModal isOpen={shownInvite !== null} onDidDismiss={() => setShownInvite(null)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{t('invite.shareTitle')}</IonTitle>
            <IonButtons slot="end">
              <IonButton strong onClick={() => setShownInvite(null)}>
                {t('common.close')}
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          {shownInvite && (
            <>
              <QrCode value={inviteLink(shownInvite.code)} label={t('invite.qrLabel')} />

              <ListSection footnote={t('invite.shareHint')}>
                <IonItem>
                  <IonLabel className="ion-text-wrap">
                    <IonNote>{t('invite.linkLabel')}</IonNote>
                    <p>{inviteLink(shownInvite.code)}</p>
                  </IonLabel>
                </IonItem>
              </ListSection>

              <div className="app-actions">
                <IonButton expand="block" onClick={() => void share(shownInvite)}>
                  <IonIcon
                    slot="start"
                    icon={canShareNatively() ? shareOutline : copyOutline}
                    aria-hidden="true"
                  />
                  {canShareNatively() ? t('invite.share') : t('invite.copy')}
                </IonButton>
              </div>
            </>
          )}
        </IonContent>
      </IonModal>

    </AppPage>
  );
}

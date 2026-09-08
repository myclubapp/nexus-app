import { useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useClub } from '../hooks/useClub';
import { usePendingJoinRequests } from '../hooks/useJoinRequests';
import { useMyPoints } from '../hooks/useGamification';
import { useLeaderboardOptIn } from '../hooks/useProfile';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { useToast } from '../hooks/useToast';
import { FormModal } from '../components/FormModal';
import { DeleteAccountModal } from '../components/DeleteAccountModal';
import { ProfileEditModal } from '../components/ProfileEditModal';
import { PASSWORD_MIN_LENGTH, authErrorKey } from '../lib/authError';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { formatDate, formatDateTime } from '../lib/format';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { signOut, user, setPassword } = useAuth();
  const { activeMembership, activeClub, memberships, setActiveClub, isAdmin } = useClub();
  const points = useMyPoints();
  const pendingRequests = usePendingJoinRequests();
  const toast = useToast();

  const optIn = useLeaderboardOptIn();

  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isPasswordOpen, setPasswordOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, setSavingPassword] = useState(false);

  // UC-005 A2 setzt ein Passwort voraus, sagt aber nicht, wo es entsteht. Ein
  // Konto, das nur über Anmeldelinks existiert, hat keines – hier bekommt es
  // eines.
  async function savePassword() {
    setPasswordError(null);
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setPasswordError(t('auth.error.passwordTooShort'));
      return;
    }
    setSavingPassword(true);
    try {
      await setPassword(newPassword);
      setPasswordOpen(false);
      setNewPassword('');
      toast.success(t('profile.passwordSaved'));
    } catch (cause) {
      setPasswordError(
        t(authErrorKey(cause instanceof Error ? cause.message : undefined)),
      );
    } finally {
      setSavingPassword(false);
    }
  }

  const currentLanguage = (i18n.resolvedLanguage ?? 'de').split('-')[0];

  return (
    <AppPage title={t('profile.title')}>
      <ListSection>
        <IonItem button detail onClick={() => setProfileOpen(true)}>
          <IonLabel className="ion-text-wrap">
            <h2>{activeMembership?.display_name ?? user?.email}</h2>
            <IonNote>
              {activeMembership
                ? t('profile.memberSince', {
                    date: formatDate(activeMembership.member_since),
                  })
                : user?.email}
            </IonNote>
          </IonLabel>
        </IonItem>

        {memberships.length > 1 && (
          <IonItem>
            <IonSelect
              label={t('leaderboard.club')}
              value={activeMembership?.club_id}
              onIonChange={(e) => setActiveClub(e.detail.value as string)}
            >
              {memberships.map((membership) => (
                <IonSelectOption key={membership.club_id} value={membership.club_id}>
                  {membership.club.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        )}
      </ListSection>

      <ListSection title={t('profile.settings')}>
        <IonItem>
          <IonSelect
            label={t('profile.language')}
            value={currentLanguage}
            onIonChange={(e) => void i18n.changeLanguage(e.detail.value as string)}
          >
            {SUPPORTED_LANGUAGES.map((code) => (
              <IonSelectOption key={code} value={code}>
                {t(`language.${code}`)}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>

        {isAdmin && (
          <IonItem button routerLink="/tabs/profile/club" detail>
            <IonLabel>
              <h2>{t('clubSettings.open')}</h2>
              <IonNote>{activeClub?.name}</IonNote>
            </IonLabel>
          </IonItem>
        )}

        {isAdmin && (
          <IonItem button routerLink="/tabs/profile/members" detail>
            <IonLabel>{t('members.title')}</IonLabel>
          </IonItem>
        )}

        {isAdmin && (
          <IonItem button routerLink="/tabs/profile/invite" detail>
            <IonLabel>{t('invite.title')}</IonLabel>
          </IonItem>
        )}

        {isAdmin && (
          <IonItem button routerLink="/tabs/profile/requests" detail>
            <IonLabel>{t('joinRequest.title')}</IonLabel>
            {(pendingRequests.data?.length ?? 0) > 0 && (
              <IonBadge slot="end" color="danger">
                {pendingRequests.data!.length}
              </IonBadge>
            )}
          </IonItem>
        )}

        <IonItem
          button
          detail
          onClick={() => {
            setNewPassword('');
            setPasswordError(null);
            setPasswordOpen(true);
          }}
        >
          <IonLabel>{t('profile.setPassword')}</IonLabel>
        </IonItem>

        {/* UC-001 A3: Ein weiterer Verein neben den bestehenden. */}
        <IonItem button routerLink="/onboarding?another=1" detail>
          <IonLabel>{t('onboarding.createAnother')}</IonLabel>
        </IonItem>

        {/* A1, BR-029: Die Anzeige in Ranglisten ist abwählbar; Punkte
            sammelt die Person weiterhin. */}
        <IonItem>
          <IonToggle
            checked={activeMembership?.leaderboard_opt_in ?? true}
            disabled={!activeMembership || optIn.isPending}
            onIonChange={(e) =>
              optIn.mutate(e.detail.checked, {
                onSuccess: () => toast.success(t('common.saved')),
                onError: (cause) => toast.failure(cause.message),
              })
            }
          >
            {t('profile.leaderboardOptIn')}
          </IonToggle>
        </IonItem>
      </ListSection>

      <ListSection title={t('profile.pointHistory')}>
        {points.transactions.length === 0 ? (
          <IonItem>
            <IonNote>{t('common.empty')}</IonNote>
          </IonItem>
        ) : (
          points.transactions.slice(0, 20).map((entry) => (
            <IonItem key={entry.id}>
              <IonLabel className="ion-text-wrap">
                <h2>{entry.rule_code ?? entry.source_type}</h2>
                <IonNote>{formatDateTime(entry.created_at)}</IonNote>
              </IonLabel>
              <IonNote slot="end" color={entry.points >= 0 ? 'primary' : 'danger'}>
                {entry.points >= 0 ? `+${entry.points}` : entry.points}
              </IonNote>
            </IonItem>
          ))
        )}
      </ListSection>

      <div className="app-actions">
        <IonButton expand="block" fill="outline" onClick={() => void signOut()}>
          {t('auth.logout')}
        </IonButton>

        {/* C-023: Die Löschung muss aus der App heraus erreichbar sein –
            eine Auflage beider App-Stores. */}
        <IonButton
          expand="block"
          fill="clear"
          color="danger"
          onClick={() => setDeleteOpen(true)}
        >
          {t('deleteAccount.title')}
        </IonButton>
        <IonNote>{t('profile.deleteAccountHint')}</IonNote>
      </div>

      <ProfileEditModal
        isOpen={isProfileOpen}
        onDismiss={() => setProfileOpen(false)}
        onSaved={() => {
          setProfileOpen(false);
          toast.success(t('common.saved'));
        }}
      />

      <DeleteAccountModal
        isOpen={isDeleteOpen}
        onDismiss={() => setDeleteOpen(false)}
      />

      <FormModal
        isOpen={isPasswordOpen}
        title={t('profile.setPassword')}
        canSubmit={newPassword.length >= PASSWORD_MIN_LENGTH}
        isSubmitting={isSavingPassword}
        error={passwordError}
        onDismiss={() => setPasswordOpen(false)}
        onSubmit={() => void savePassword()}
      >
        <ListSection footnote={t('profile.passwordHint', { min: PASSWORD_MIN_LENGTH })}>
          <IonItem>
            <IonInput
              label={t('auth.password')}
              labelPlacement="stacked"
              type="password"
              autocomplete="new-password"
              value={newPassword}
              onIonInput={(e) => setNewPassword(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      </FormModal>
    </AppPage>
  );
}

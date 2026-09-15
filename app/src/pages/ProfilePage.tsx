import { useState } from 'react';
import {
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
import { isModuleOn } from '../lib/clubSettings';
import { useMyPoints, useRuleLabels } from '../hooks/useGamification';
import { bookingLabel } from '../lib/points';
import { useMyKudos } from '../hooks/useTasks';
import { useLeaderboardOptIn } from '../hooks/useProfile';
import { useRefreshOnEnter } from '../hooks/useRefreshOnEnter';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { useToast } from '../hooks/useToast';
import { FormModal } from '../components/FormModal';
import { DeleteAccountModal } from '../components/DeleteAccountModal';
import { ProfileEditModal } from '../components/ProfileEditModal';
import { ClubAdminLinks } from '../components/ClubAdminLinks';
import { ContributionGoalCard } from '../components/ContributionGoalCard';
import { PASSWORD_MIN_LENGTH, authErrorKey } from '../lib/authError';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { formatDate, formatDateTime } from '../lib/format';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { signOut, user, setPassword } = useAuth();
  const { activeClub, activeMembership, memberships, setActiveClub } = useClub();
  const points = useMyPoints();
  const rules = useRuleLabels();
  const kudos = useMyKudos();
  const toast = useToast();

  const optIn = useLeaderboardOptIn();

  // Die Profilseite bleibt als Tab gemountet; beim erneuten Betreten holt
  // Ionics `ionViewWillEnter` nach, was inzwischen veraltet ist – Punkte,
  // Dankesworte, Mitgliedschaften und die Zahl der offenen Beitrittsanfragen
  // aus `ClubAdminLinks`.
  useRefreshOnEnter([
    ['points'],
    ['rule-labels'],
    ['kudos'],
    ['memberships'],
    ['join-requests'],
    // UC-042: Der Fortschritt zum Saisonziel wächst mit jeder Buchung.
    ['contribution-goal'],
    ['next-contributions'],
  ]);

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
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
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

      {/* NFR-009: Jede Zustellung ist auch ohne Push abholbar. */}
      <ListSection>
        <IonItem button detail routerLink="/tabs/profile/inbox">
          <IonLabel>{t('inbox.title')}</IonLabel>
        </IonItem>
      </ListSection>

      <ListSection title={t('profile.settings')}>
        <IonItem>
          <IonSelect
            label={t('profile.language')}
            value={currentLanguage}
            onIonChange={(e) => void i18n.changeLanguage(e.detail.value as string)}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
          >
            {SUPPORTED_LANGUAGES.map((code) => (
              <IonSelectOption key={code} value={code}>
                {t(`language.${code}`)}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>

        {/* UC-034: Was ein Modul mitbringt, erscheint erst, wenn der Verein
            es eingeschaltet hat (FR-115). Das Ausblenden ist Bequemlichkeit;
            gesperrt ist es am Server (`module_enabled()` in `0052`). */}
        {isModuleOn(activeClub?.settings, 'voice') && (
          <IonItem button routerLink="/tabs/profile/voice" detail>
            <IonLabel>{t('voice.title')}</IonLabel>
          </IonItem>
        )}

        {isModuleOn(activeClub?.settings, 'meeting') && (
          <IonItem button routerLink="/tabs/profile/meeting" detail>
            <IonLabel>{t('meeting.title')}</IonLabel>
          </IonItem>
        )}

        {isModuleOn(activeClub?.settings, 'checkin') && (
          <IonItem button routerLink="/tabs/profile/mood" detail>
            <IonLabel>{t('checkin.pageTitle')}</IonLabel>
          </IonItem>
        )}

        {/* A4: Ohne aktiven Rechnungsdienst wird der Bereich **vollständig**
            ausgeblendet – nicht als leere Liste gezeigt. */}
        {isModuleOn(activeClub?.settings, 'invoice') && (
          <IonItem button routerLink="/tabs/profile/invoices" detail>
            <IonLabel>{t('invoice.title')}</IonLabel>
          </IonItem>
        )}

        <IonItem button routerLink="/tabs/profile/notifications" detail>
          <IonLabel>{t('notifications.title')}</IonLabel>
        </IonItem>

        <IonItem button routerLink="/tabs/profile/strengths" detail>
          <IonLabel>{t('dimensions.title')}</IonLabel>
        </IonItem>

        {/* UC-025: Für jedes Mitglied, nicht nur für Zuständige – es ist die
            Seite über die eigene Person. */}
        <IonItem button routerLink="/tabs/profile/transparency" detail>
          <IonLabel>{t('transparency.title')}</IonLabel>
        </IonItem>

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

      {/* FR-148: Die Verwaltungswege stehen in eigenen Gruppen, nicht zwischen
          den persönlichen Einstellungen – sonst liest sich «Mitglieder» wie
          eine Option des eigenen Kontos. Die Überschriften bringt
          `ClubAdminLinks` seit FR-178 mit; dadurch stehen hier und in `AppMenu`
          dieselben, statt zweimal von Hand gesetzt zu werden.

          Ohne Rolle rendert die Komponente nichts – eine Abfrage davor braucht
          es nicht mehr, seit die Überschriften innen liegen. Sie wäre ohnehin
          Bequemlichkeit, kein Schutz: Der liegt in `is_club_admin()` und den
          RLS-Policies. */}
      <ClubAdminLinks />

      {/* UC-019 Schritt 8: das Dankeswort auf dem eigenen Profil. Es steht
          **vor** der Punktehistorie – die Anerkennung kommt vor der Zahl
          (BR-078), und zwar auch in der Anordnung der Seite. */}
      {(kudos.data?.length ?? 0) > 0 && (
        <ListSection title={t('profile.kudos')} footnote={t('profile.kudosHint')}>
          {(kudos.data ?? []).map((entry) => (
            <IonItem key={entry.id}>
              <IonLabel className="ion-text-wrap">
                <h2>«{entry.kudos}»</h2>
                <IonNote>
                  {entry.taskTitle} · {formatDate(entry.confirmedAt)}
                </IonNote>
              </IonLabel>
            </IonItem>
          ))}
        </ListSection>
      )}

      {/* UC-042: der eigene Fortschritt zum Saisonziel – vor der Historie,
          weil er sagt, was noch ansteht, und die Historie, was war. Ohne
          Modul und ohne Ziel rendert die Karte nichts. */}
      <ContributionGoalCard />

      <ListSection
        title={t('profile.pointHistory')}
        action={
          <IonButton fill="clear" size="small" routerLink="/tabs/profile/points">
            {t('dashboard.allBookings')}
          </IonButton>
        }
      >
        {points.transactions.length === 0 ? (
          <IonItem lines="none">
            <IonLabel color="medium" className="ion-text-wrap">
              {t('common.empty')}
            </IonLabel>
          </IonItem>
        ) : (
          points.transactions.slice(0, 20).map((entry) => (
            <IonItem key={entry.id}>
              <IonLabel className="ion-text-wrap">
                <h2>{bookingLabel(entry, rules.data ?? [])}</h2>
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
              enterkeyhint="done"
              value={newPassword}
              onIonInput={(e) => setNewPassword(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      </FormModal>
    </AppPage>
  );
}

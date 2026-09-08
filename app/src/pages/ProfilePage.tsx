import {
  IonButton,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useClub } from '../hooks/useClub';
import { useMyPoints } from '../hooks/useGamification';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { formatDate, formatDateTime } from '../lib/format';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { signOut, user } = useAuth();
  const { activeMembership, activeClub, memberships, setActiveClub, isAdmin } = useClub();
  const points = useMyPoints();
  const queryClient = useQueryClient();

  const optIn = useMutation({
    mutationFn: async (value: boolean) => {
      if (!activeMembership) return;
      const { error } = await supabase
        .from('club_members')
        .update({ leaderboard_opt_in: value })
        .eq('id', activeMembership.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });

  const currentLanguage = (i18n.resolvedLanguage ?? 'de').split('-')[0];

  return (
    <AppPage title={t('profile.title')}>
      <ListSection>
        <IonItem>
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

        <IonItem>
          <IonToggle
            checked={activeMembership?.leaderboard_opt_in ?? true}
            disabled={!activeMembership || optIn.isPending}
            onIonChange={(e) => optIn.mutate(e.detail.checked)}
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
        <IonNote>{t('profile.deleteAccountHint')}</IonNote>
      </div>
    </AppPage>
  );
}

import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/react';
import { Navigate, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  calendarOutline,
  homeOutline,
  listOutline,
  personOutline,
  trophyOutline,
} from 'ionicons/icons';
import { DashboardPage } from './DashboardPage';
import { MarketplacePage } from './MarketplacePage';
import { LeaderboardPage } from './LeaderboardPage';
import { AgendaPage } from './AgendaPage';
import { ProfilePage } from './ProfilePage';
import { ClubSettingsPage } from './ClubSettingsPage';
import { InvitePage } from './club/InvitePage';
import { JoinRequestPage } from './club/JoinRequestPage';
import { MemberPage } from './club/MemberPage';
import { PointRulePage } from './club/PointRulePage';

/**
 * Fünf Tabs nach dem myclub-Vorbild (Architektur §8). Die Kindrouten sind
 * relativ zu /tabs; das verschachtelte Outlet braucht in Ionic 9 das
 * ionPage-Attribut, sonst überlagern sich die Seitenübergänge.
 */
export function TabsPage() {
  const { t } = useTranslation();

  return (
    <IonTabs>
      <IonRouterOutlet ionPage>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="marketplace" element={<MarketplacePage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/club" element={<ClubSettingsPage />} />
        <Route path="profile/invite" element={<InvitePage />} />
        <Route path="profile/requests" element={<JoinRequestPage />} />
        <Route path="profile/members" element={<MemberPage />} />
        <Route path="profile/rules" element={<PointRulePage />} />
        <Route path="" element={<Navigate to="dashboard" replace />} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="dashboard" href="/tabs/dashboard">
          <IonIcon icon={homeOutline} />
          <IonLabel>{t('tabs.dashboard')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="marketplace" href="/tabs/marketplace">
          <IonIcon icon={listOutline} />
          <IonLabel>{t('tabs.marketplace')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="leaderboard" href="/tabs/leaderboard">
          <IonIcon icon={trophyOutline} />
          <IonLabel>{t('tabs.leaderboard')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="agenda" href="/tabs/agenda">
          <IonIcon icon={calendarOutline} />
          <IonLabel>{t('tabs.agenda')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="profile" href="/tabs/profile">
          <IonIcon icon={personOutline} />
          <IonLabel>{t('tabs.profile')}</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}

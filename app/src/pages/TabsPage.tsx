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
import { useCheckInQueue } from '../hooks/useCheckIn';
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
import { NewsSourcePage } from './club/NewsSourcePage';
import { InboxPage } from './InboxPage';
import { PointHistoryPage } from './PointHistoryPage';
import { HealthPage } from './HealthPage';
import { TransparencyPage } from './TransparencyPage';
import { StrengthsPage } from './StrengthsPage';
import { PulsePage } from './PulsePage';
import { PulseReadPage } from './PulseReadPage';
import { NotificationsPage } from './NotificationsPage';
import { VoicePage } from './VoicePage';
import { MeetingPage } from './MeetingPage';
import { OfficePage } from './club/OfficePage';
import { PointRulePage } from './club/PointRulePage';

/**
 * Fünf Tabs nach dem myclub-Vorbild (Architektur §8). Die Kindrouten sind
 * relativ zu /tabs.
 *
 * Das verschachtelte Outlet bekommt bewusst kein `ionPage`: `IonTabs` legt
 * selbst schon einen `PageManager` um sich – das ist die Seite, die das
 * äussere Outlet einblendet. Mit `ionPage` würde zusätzlich das
 * `ion-router-outlet` selbst zur Seite; sie startet mit
 * `ion-page-invisible` und niemand blendet sie je ein. Sichtbar bliebe nur
 * der Tab-Balken, der ausserhalb der Seite liegt – die Tabs stehen, jeder
 * Screen ist weiss.
 */
export function TabsPage() {
  const { t } = useTranslation();
  // A5: Was im Funkloch gescannt wurde, geht von hier aus nach – einmal beim
  // Start und danach bei jedem `online`-Ereignis. An den Tabs aufgehängt,
  // weil dies die Hülle ist, die die ganze angemeldete Zeit über steht.
  useCheckInQueue();

  return (
    <IonTabs>
      <IonRouterOutlet>
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
        <Route path="profile/news" element={<NewsSourcePage />} />
        <Route path="profile/inbox" element={<InboxPage />} />
        <Route path="profile/points" element={<PointHistoryPage />} />
        <Route path="profile/health" element={<HealthPage />} />
        <Route path="profile/transparency" element={<TransparencyPage />} />
        <Route path="profile/strengths" element={<StrengthsPage />} />
        <Route path="profile/pulse" element={<PulsePage />} />
        <Route path="pulse/:pulseId" element={<PulseReadPage />} />
        <Route path="profile/notifications" element={<NotificationsPage />} />
        <Route path="profile/voice" element={<VoicePage />} />
        <Route path="profile/meeting" element={<MeetingPage />} />
        <Route path="profile/offices" element={<OfficePage />} />
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

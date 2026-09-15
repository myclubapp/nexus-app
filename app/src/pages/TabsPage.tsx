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
  calendar,
  calendarOutline,
  home,
  homeOutline,
  list,
  listOutline,
  person,
  personOutline,
  trophy,
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
import { BillingPage } from './club/BillingPage';
import { BillingPeriodPage } from './club/BillingPeriodPage';
import { BillingSetupPage } from './club/BillingSetupPage';
import { EventLabelPage } from './club/EventLabelPage';
import { MemberPage } from './club/MemberPage';
import { NewsSourcePage } from './club/NewsSourcePage';
import { ClubSetupPage } from './club/ClubSetupPage';
import { FederationPage } from './club/FederationPage';
import { LegacyImportPage } from './club/LegacyImportPage';
import { TeamPage } from './club/TeamPage';
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
import { MoodPage } from './MoodPage';
import { InvoicePage } from './InvoicePage';
import { PointRulePage } from './club/PointRulePage';
import { ContributionPage } from './club/ContributionPage';

/**
 * Tab-Symbol in Umriss- und gefüllter Variante. Welche sichtbar ist,
 * entscheidet `ion-tab-button.tab-selected` per CSS (`variables.css`) –
 * so braucht es keinen Zustand, der der Route hinterherläuft.
 */
function TabIcon({ outline, filled }: { outline: string; filled: string }) {
  return (
    <>
      <IonIcon className="app-tab-icon-outline" icon={outline} aria-hidden="true" />
      <IonIcon className="app-tab-icon-filled" icon={filled} aria-hidden="true" />
    </>
  );
}

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
        {/* FR-078: die Inbox aus der Kopfzeile der Start-Seite, mit Zurück dorthin. */}
        <Route path="dashboard/inbox" element={<InboxPage backHref="/tabs/dashboard" />} />
        <Route path="marketplace" element={<MarketplacePage />} />
        {/* UC-041: die Ämterliste aus dem Marktplatz, mit Zurück dorthin. */}
        <Route path="marketplace/offices" element={<OfficePage backHref="/tabs/marketplace" />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/club" element={<ClubSettingsPage />} />
        {/* UC-051: die Einrichtung nach der Gründung – überspringbar (BR-259). */}
        <Route path="profile/setup" element={<ClubSetupPage />} />
        <Route path="profile/invite" element={<InvitePage />} />
        <Route path="profile/requests" element={<JoinRequestPage />} />
        <Route path="profile/members" element={<MemberPage />} />
        {/* Die Begriffe je Terminart (BR-148) – eine eigene Seite, weil zwanzig
            Felder in den Einstellungen alles Übrige nach unten schoben. */}
        <Route path="profile/labels" element={<EventLabelPage />} />
        <Route path="profile/rules" element={<PointRulePage />} />
        {/* UC-042: die Beiträge der Saison, neben den Punkteregeln. */}
        <Route path="profile/contribution" element={<ContributionPage />} />
        <Route path="profile/news" element={<NewsSourcePage />} />
        <Route path="profile/federation" element={<FederationPage />} />
        <Route path="profile/legacy" element={<LegacyImportPage />} />
        <Route path="profile/teams" element={<TeamPage />} />
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
        <Route path="profile/mood" element={<MoodPage />} />
        <Route path="profile/invoices" element={<InvoicePage />} />
        {/* UC-046: die Sicht des Vorstands. Sie liegt neben «Meine
            Rechnungen», nicht darin – das eine ist die eigene Forderung, das
            andere die Kasse des Vereins. */}
        <Route path="profile/billing" element={<BillingPage />} />
        <Route path="profile/billing/setup" element={<BillingSetupPage />} />
        <Route path="profile/billing/:periodId" element={<BillingPeriodPage />} />
        <Route path="" element={<Navigate to="dashboard" replace />} />
      </IonRouterOutlet>

      {/* Die Beschriftung trägt den Namen des Tabs; das Symbol ist Dekor. */}
      <IonTabBar slot="bottom" translucent>
        <IonTabButton tab="dashboard" href="/tabs/dashboard">
          <TabIcon outline={homeOutline} filled={home} />
          <IonLabel>{t('tabs.dashboard')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="marketplace" href="/tabs/marketplace">
          <TabIcon outline={listOutline} filled={list} />
          <IonLabel>{t('tabs.marketplace')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="leaderboard" href="/tabs/leaderboard">
          <TabIcon outline={trophyOutline} filled={trophy} />
          <IonLabel>{t('tabs.leaderboard')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="agenda" href="/tabs/agenda">
          <TabIcon outline={calendarOutline} filled={calendar} />
          <IonLabel>{t('tabs.agenda')}</IonLabel>
        </IonTabButton>
        <IonTabButton tab="profile" href="/tabs/profile">
          <TabIcon outline={personOutline} filled={person} />
          <IonLabel>{t('tabs.profile')}</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}

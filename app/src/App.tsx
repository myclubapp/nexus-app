import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Navigate, Route } from 'react-router-dom';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional utility styles */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Follows the device setting; the club theme is layered on top at runtime. */
import '@ionic/react/css/palettes/dark.system.css';

import './theme/variables.css';

import { AuthProvider } from './hooks/useAuth';
import { ClubProvider } from './hooks/useClub';
import { LoginPage } from './pages/auth/LoginPage';
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage';
import { OnboardingPage } from './pages/onboarding/OnboardingPage';
import { JoinByInvitePage } from './pages/onboarding/JoinByInvitePage';
import { TabsPage } from './pages/TabsPage';
import {
  RedirectIfClubMember,
  RedirectIfSignedIn,
  RequireAuth,
  RequireClub,
} from './components/RouteGuards';

/**
 * Ein Erscheinungsbild auf allen Plattformen (NFR-032: eine Codebasis, keine
 * plattformspezifischen Zweige). Der iOS-Modus bringt die zusammenfallenden
 * grossen Titel und die gruppierten Listen mit, auf denen das UI aufbaut –
 * im Material-Modus gäbe es beides nicht.
 */
setupIonicReact({ mode: 'ios' });

export default function App() {
  return (
    <IonApp>
      <AuthProvider>
        <ClubProvider>
          <IonReactRouter>
            <IonRouterOutlet>
              <Route
                path="/login"
                element={
                  <RedirectIfSignedIn>
                    <LoginPage />
                  </RedirectIfSignedIn>
                }
              />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              {/* Ohne Anmeldeschranke: Der Einladungslink erreicht Gäste, die
                  noch kein Konto haben (UC-002). Die Seite selbst führt bei
                  Bedarf durch die Anmeldung. */}
              <Route path="/invite/:code" element={<JoinByInvitePage />} />
              <Route
                path="/onboarding"
                element={
                  <RequireAuth>
                    <RedirectIfClubMember>
                      <OnboardingPage />
                    </RedirectIfClubMember>
                  </RequireAuth>
                }
              />
              <Route
                path="/tabs/*"
                element={
                  <RequireAuth>
                    <RequireClub>
                      <TabsPage />
                    </RequireClub>
                  </RequireAuth>
                }
              />
              <Route path="/" element={<Navigate to="/tabs/dashboard" replace />} />
            </IonRouterOutlet>
          </IonReactRouter>
        </ClubProvider>
      </AuthProvider>
    </IonApp>
  );
}

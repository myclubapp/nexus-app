import {
  IonApp,
  IonRouterOutlet,
  IonSplitPane,
  setupIonicReact,
} from '@ionic/react';
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

/* Folgt der Geräteeinstellung; das Vereins-Theme legt sich zur Laufzeit darüber. */
import '@ionic/react/css/palettes/dark.system.css';

/* Die beiden Schriften der Marke (my-club.ch): Space Grotesk auf den Titeln,
   DM Sans im Fliesstext. Sie liegen als Paket im Bündel, nicht auf Googles
   Schriftserver – die Regel «kein Google» gilt auch für Schriften, und auf
   dem Gerät ohne Netz stünde die App sonst in der Systemschrift da. Beide
   Pakete sind variable Schnitte: eine Datei je Zeichensatz-Ausschnitt deckt
   alle Strichstärken ab. */
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/dm-sans';

import './theme/variables.css';

import { AuthProvider } from './hooks/useAuth';
import { ClubProvider } from './hooks/useClub';
import { LoginPage } from './pages/auth/LoginPage';
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage';
import { AuthVerifyPage } from './pages/auth/AuthVerifyPage';
import { OnboardingPage } from './pages/onboarding/OnboardingPage';
import { JoinByInvitePage } from './pages/onboarding/JoinByInvitePage';
import { TabsPage } from './pages/TabsPage';
import { AppMenu, APP_CONTENT_ID } from './components/AppMenu';
import { DeepLinkRouter } from './components/DeepLinkRouter';
import { HardwareBackExit } from './components/HardwareBackExit';
import { LocaleSync } from './components/LocaleSync';
import { SkeletonPage } from './components/Skeletons';
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
            {/* Android: die Zurück-Taste verlässt die App an der Wurzel
                (Ionic-Doku «Hardware Back Button»). Muss im Router stehen,
                weil sie `useIonRouter` braucht. */}
            <HardwareBackExit />
            {/* Der Link aus einer E-Mail öffnet die App – hier fährt sie an
                den Ort, den er nennt. */}
            <DeepLinkRouter />
            {/* UC-044: die Sprache der App auf dem Server, damit E-Mails in
                ihr geschrieben werden. */}
            <LocaleSync />
            {/* Ab lg (992 px) steht das Menü als Spalte neben dem Inhalt,
                darunter fährt es über den IonMenuButton ein. Das Hauptfeld
                muss ein direktes Kind mit genau dieser id sein – sonst warnt
                Ionic und die Spalte legt sich über den Inhalt. */}
            <IonSplitPane contentId={APP_CONTENT_ID} when="lg">
              <AppMenu />
              <IonRouterOutlet id={APP_CONTENT_ID}>
                <Route
                  path="/login"
                  element={
                    <RedirectIfSignedIn>
                      <LoginPage />
                    </RedirectIfSignedIn>
                  }
                />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                {/* Der Anmeldelink zum Kopieren (UC-005 A5). Er bringt den
                    Token-Hash statt eines PKCE-Codes mit und wirkt deshalb
                    auch in einem Browser, der die Anmeldung nicht begonnen
                    hat. */}
                <Route path="/auth/verify" element={<AuthVerifyPage />} />
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
                {/* Beide Weichen zeigen hier dasselbe Skelett statt eines
                    Spinners: Der Weg in die Tabs wartet auf die
                    Mitgliedschaften aus dem Netz, und was danach kommt, steht
                    fest – eine Seite mit Kopfzeile und Liste (guidelines §4).
                    Zwei verschiedene Zwischenbilder hintereinander wären ein
                    Flackern, deshalb reichen beide dasselbe herein.

                    `detached` ist keine Kür: Das Skelett steht im selben
                    Route-Element wie `TabsPage`. Als angemeldete `IonPage`
                    liesse es die Tabs unsichtbar im DOM stehen, sobald die
                    Mitgliedschaften zwischen etwa 30 und 200 ms brauchen –
                    siehe `DetachedPage`. */}
                <Route
                  path="/tabs/*"
                  element={
                    <RequireAuth pending={<SkeletonPage detached />}>
                      <RequireClub pending={<SkeletonPage detached />}>
                        <TabsPage />
                      </RequireClub>
                    </RequireAuth>
                  }
                />
                <Route path="/" element={<Navigate to="/tabs/dashboard" replace />} />
              </IonRouterOutlet>
            </IonSplitPane>
          </IonReactRouter>
        </ClubProvider>
      </AuthProvider>
    </IonApp>
  );
}

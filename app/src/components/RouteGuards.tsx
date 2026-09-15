import { useEffect, type ReactNode } from 'react';
import { IonContent } from '@ionic/react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useClub } from '../hooks/useClub';
import { DetachedPage } from './DetachedPage';
import { ErrorState, LoadingState } from './StateViews';
import { peekPendingInvite } from '../lib/invite';
import { forgetDeepLink, peekDeepLink, rememberDeepLink } from '../lib/deepLink';

/**
 * Ionic erwartet zu jeder Route eine Seite – auch für diese Zwischenanzeige.
 *
 * Der Spinner bleibt für die Weichen, bei denen wirklich offen ist, was folgt:
 * Anmeldung oder App, Onboarding oder Tabs (guidelines §4). Wo der Ausgang
 * feststeht, reicht die Route stattdessen ein `pending`-Skelett herein.
 *
 * Als {@link DetachedPage} und nicht als `IonPage`: Jedes Zwischenbild einer
 * Weiche steht im selben Route-Element wie die Seite, die es ablöst. Meldet
 * es sich beim Outlet an, bleibt die echte Seite unsichtbar.
 */
function LoadingPage() {
  return (
    <DetachedPage>
      <IonContent>
        <LoadingState />
      </IonContent>
    </DetachedPage>
  );
}

/**
 * `pending` ist das Zwischenbild, solange die Weiche noch nicht entschieden
 * hat. Es kommt von der Route und nicht aus dem Guard, weil nur die Route
 * weiss, wohin der Weg führt: Vor den Tabs steht ein Skelett in der Form der
 * folgenden Seite, vor Anmeldung und Onboarding der Spinner.
 */
interface GuardProps {
  children: ReactNode;
  pending?: ReactNode;
}

/** Aus demselben Grund losgelöst wie {@link LoadingPage}. */
function ErrorPage({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <DetachedPage>
      <IonContent>
        <ErrorState error={error} onRetry={onRetry} />
      </IonContent>
    </DetachedPage>
  );
}

export function RequireAuth({ children, pending }: GuardProps) {
  const { session, initialising } = useAuth();
  const location = useLocation();
  const target = `${location.pathname}${location.search}`;

  // Der Weg über die Anmeldung hinweg. Beides gehört hierher, weil dies die
  // einzige Stelle ist, die «abgemeldet unterwegs» und «angekommen» beide sieht.
  useEffect(() => {
    if (initialising) return;
    // Abgemeldet: merken, bevor die Anmeldeschranke den Weg verschluckt.
    if (!session) {
      rememberDeepLink(target);
      return;
    }
    // Angekommen: aufräumen. Erst hier und nicht beim Entscheiden – so bleibt
    // das Ziel auch dann stehen, wenn das Rendern zweimal läuft (StrictMode).
    if (peekDeepLink() === target) forgetDeepLink();
  }, [session, initialising, target]);

  if (initialising) return <>{pending ?? <LoadingPage />}</>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * A signed-in user without a membership has not finished onboarding yet –
 * they either start a club or redeem an invitation (MVP-Scope §6).
 */
export function RequireClub({ children, pending }: GuardProps) {
  const { memberships, isLoading, error, refetch } = useClub();
  if (isLoading) return <>{pending ?? <LoadingPage />}</>;
  // Eine gescheiterte Abfrage ist keine leere Mitgliederliste. Ohne diese
  // Unterscheidung landet ein Mitglied bei jedem Netzfehler im Gründungs-
  // Wizard und legt seinen Verein ein zweites Mal an.
  if (error) return <ErrorPage error={error} onRetry={refetch} />;
  if (memberships.length === 0) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { session, initialising } = useAuth();
  if (initialising) return <LoadingPage />;
  if (session) {
    // UC-005 A4: Eine gemerkte Einladung geht der Startseite vor – und vor ihr
    // steht nichts. Danach das Ziel, das ein Link aus einer E-Mail genannt hat.
    const pendingInvite = peekPendingInvite();
    if (pendingInvite) return <Navigate to={`/invite/${pendingInvite}`} replace />;
    return <Navigate to={peekDeepLink() ?? '/tabs/dashboard'} replace />;
  }
  return <>{children}</>;
}

/**
 * Das Gegenstück zu {@link RequireClub}: Wer bereits einem Verein angehört,
 * hat auf der Onboarding-Seite nichts mehr verloren. Ohne diese Weiche bleibt
 * die Seite nach `create_club` stehen und die Gründerin legt den Verein
 * mehrfach an.
 *
 * Ausnahme ist `?another=1`: UC-001 A3 erlaubt ausdrücklich, einen weiteren
 * Verein zu gründen. Die Absicht steht in der Route, damit die Weiterleitung
 * nach der Gründung wieder greift.
 */
export function RedirectIfClubMember({ children }: { children: ReactNode }) {
  const { memberships, isLoading, error, refetch } = useClub();
  const [searchParams] = useSearchParams();
  const wantsAnotherClub = searchParams.get('another') === '1';

  if (isLoading) return <LoadingPage />;
  if (error) return <ErrorPage error={error} onRetry={refetch} />;
  if (memberships.length > 0 && !wantsAnotherClub) {
    return <Navigate to="/tabs/dashboard" replace />;
  }
  return <>{children}</>;
}

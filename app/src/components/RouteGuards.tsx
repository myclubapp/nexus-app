import type { ReactNode } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useClub } from '../hooks/useClub';
import { ErrorState, LoadingState } from './StateViews';

/** Ionic expects every routed element to be a page, including this one. */
function LoadingPage() {
  return (
    <IonPage>
      <IonContent>
        <LoadingState />
      </IonContent>
    </IonPage>
  );
}

function ErrorPage({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <IonPage>
      <IonContent>
        <ErrorState error={error} onRetry={onRetry} />
      </IonContent>
    </IonPage>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, initialising } = useAuth();
  if (initialising) return <LoadingPage />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * A signed-in user without a membership has not finished onboarding yet –
 * they either start a club or redeem an invitation (MVP-Scope §6).
 */
export function RequireClub({ children }: { children: ReactNode }) {
  const { memberships, isLoading, error, refetch } = useClub();
  if (isLoading) return <LoadingPage />;
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
  if (session) return <Navigate to="/tabs/dashboard" replace />;
  return <>{children}</>;
}

/**
 * Das Gegenstück zu {@link RequireClub}: Wer bereits einem Verein angehört,
 * hat auf der Onboarding-Seite nichts mehr verloren. Ohne diese Weiche bleibt
 * die Seite nach `create_club` stehen und die Gründerin legt den Verein
 * mehrfach an.
 */
export function RedirectIfClubMember({ children }: { children: ReactNode }) {
  const { memberships, isLoading, error, refetch } = useClub();
  if (isLoading) return <LoadingPage />;
  if (error) return <ErrorPage error={error} onRetry={refetch} />;
  if (memberships.length > 0) return <Navigate to="/tabs/dashboard" replace />;
  return <>{children}</>;
}

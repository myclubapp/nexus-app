import { useEffect } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingState } from '../../components/StateViews';
import { peekPendingInvite } from '../../lib/invite';

/**
 * Landing page for the magic link on web. supabase-js exchanges the PKCE code
 * on load, so this page only waits for the session and gets out of the way.
 */
export function AuthCallbackPage() {
  const { session, initialising } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (initialising) return;
    // A1: Ohne Sitzung war der Link abgelaufen oder schon verwendet. Die
    // Begründung steht im Kontext und wird auf dem Anmeldebildschirm gezeigt.
    if (!session) {
      navigate('/login', { replace: true });
      return;
    }
    // UC-005 A4: Wer aus einem Einladungsfluss kam, kehrt dorthin zurück.
    const pendingInvite = peekPendingInvite();
    navigate(pendingInvite ? `/invite/${pendingInvite}` : '/tabs/dashboard', {
      replace: true,
    });
  }, [session, initialising, navigate]);

  return (
    <IonPage>
      <IonContent>
        <LoadingState />
      </IonContent>
    </IonPage>
  );
}

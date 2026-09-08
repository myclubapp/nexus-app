import { useEffect } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingState } from '../../components/StateViews';

/**
 * Landing page for the magic link on web. supabase-js exchanges the PKCE code
 * on load, so this page only waits for the session and gets out of the way.
 */
export function AuthCallbackPage() {
  const { session, initialising } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (initialising) return;
    navigate(session ? '/tabs/dashboard' : '/login', { replace: true });
  }, [session, initialising, navigate]);

  return (
    <IonPage>
      <IonContent>
        <LoadingState />
      </IonContent>
    </IonPage>
  );
}

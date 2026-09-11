import { useEffect } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingState } from '../../components/StateViews';
import { peekPendingInvite } from '../../lib/invite';

/**
 * Die Landeseite des Anmeldelinks im Browser. supabase-js tauscht den
 * PKCE-Code beim Laden; diese Seite wartet nur auf die Sitzung und macht
 * dann den Weg frei.
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

import { useEffect, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { emailOtpType } from '../../lib/authLink';
import { LoadingState } from '../../components/StateViews';
import { peekPendingInvite } from '../../lib/invite';
import { peekDeepLink } from '../../lib/deepLink';

/**
 * Der Anmeldelink zum Kopieren (UC-005 A5).
 *
 * `/auth/callback` nebenan nimmt einen **PKCE-Code** entgegen. Einlösen lässt
 * der sich nur dort, wo der Verifier liegt – im Browser, der die Anmeldung
 * gestartet hat, oder in der App. Wer die Adresse aus der Mail kopiert und in
 * einen anderen Browser einfügt, stand deshalb wortlos wieder auf dem
 * Anmeldebildschirm.
 *
 * Diese Seite löst statt des Codes den **Token-Hash** ein, den die Mail in
 * der Adresse mitbringt. `verifyOtp()` schickt ihn an denselben Endpunkt und
 * bekommt die Sitzung direkt zurück: kein Verifier, keine Bindung an ein
 * Gerät. Die Mail baut diese Adresse in `verifyLink()`
 * (`supabase/functions/auth-mail/hook.ts`).
 *
 * **Der Pfad wird von der App bewusst nicht beansprucht** (`CLAIMED_PREFIXES`
 * in `lib/deepLink.ts`): Er ist der Weg in den Browser. Beanspruchte ihn die
 * native App, führte die kopierte Adresse wieder dorthin zurück, wo sie
 * gerade nicht hinsollte.
 */

/**
 * Der Tausch je Token, geteilt über Aufrufe hinweg.
 *
 * Ein Token gilt genau einmal (BR-018). Unter `StrictMode` läuft der Effekt
 * zweimal, und der zweite Lauf holte sich sonst ein «bereits verwendet» für
 * eine Anmeldung, die eben geglückt ist. Beide Läufe warten deshalb auf
 * dasselbe Versprechen.
 */
const redemptions = new Map<string, Promise<string | null>>();

function redeem(tokenHash: string, type: EmailOtpType): Promise<string | null> {
  const known = redemptions.get(tokenHash);
  if (known) return known;
  const run = supabase.auth
    .verifyOtp({ token_hash: tokenHash, type })
    .then(({ error }) => (error ? error.message : null));
  redemptions.set(tokenHash, run);
  return run;
}

export function AuthVerifyPage() {
  const { session, reportAuthError } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [outcome, setOutcome] = useState<'pending' | 'ok' | 'failed'>('pending');

  const tokenHash = params.get('token_hash');
  const type = params.get('type');

  useEffect(() => {
    // Ohne Token ist die Adresse keine Anmeldung – dann führt der zweite
    // Effekt gleich auf den Anmeldebildschirm, wie bei einem abgelehnten Link.
    if (!tokenHash) {
      setOutcome('failed');
      return;
    }

    let active = true;
    void redeem(tokenHash, emailOtpType(type)).then((message) => {
      if (!active) return;
      // A1: Die Begründung überlebt den Wechsel auf den Anmeldebildschirm,
      // weil sie im Kontext steht und nicht auf dieser Seite.
      if (message) reportAuthError(message);
      setOutcome(message ? 'failed' : 'ok');
    });

    return () => {
      active = false;
    };
  }, [tokenHash, type, reportAuthError]);

  /**
   * Weitergeführt wird nach dem **Ausgang des Tauschs**, nicht nach dem
   * Vorhandensein einer Sitzung.
   *
   * `verifyOtp()` legt die Sitzung selbst ab und meldet sie über
   * `onAuthStateChange` an den Kontext – nur nicht zwingend im selben
   * Rendergang. Wer hier auf `!session` prüfte, schickte eine geglückte
   * Anmeldung auf den Anmeldebildschirm zurück, weil die Sitzung ein
   * Wimpernschlag zu spät kam. Bei `ok` wird deshalb gewartet, bis sie da
   * ist; bei `failed` geht es sofort weiter.
   */
  useEffect(() => {
    if (outcome === 'pending') return;
    if (outcome === 'failed') {
      navigate('/login', { replace: true });
      return;
    }
    if (!session) return;
    // Wie bei `/auth/callback`: erst die Einladung, dann ein gemerktes Ziel,
    // sonst das Dashboard. In einem frisch geöffneten Browser ist beides
    // leer – dort beginnt die Anmeldung am Anfang.
    const pendingInvite = peekPendingInvite();
    if (pendingInvite) {
      navigate(`/invite/${pendingInvite}`, { replace: true });
      return;
    }
    navigate(peekDeepLink() ?? '/tabs/dashboard', { replace: true });
  }, [outcome, session, navigate]);

  return (
    <IonPage>
      <IonContent>
        <LoadingState />
      </IonContent>
    </IonPage>
  );
}

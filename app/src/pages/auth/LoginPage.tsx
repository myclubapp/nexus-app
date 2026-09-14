import { useState, type FormEvent } from 'react';
import {
  IonButton,
  IonContent,
  IonInput,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonText,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { isConfigured } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { InlineError, NotConfiguredState } from '../../components/StateViews';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import {
  authErrorKey,
  resolveSignInAction,
  type SignInMethod,
} from '../../lib/authError';

/**
 * Anmeldung (UC-005).
 *
 * Der Link ist der Standardweg (BR-017: kein Drittanbieter-Login). Das
 * Passwort ist der zweite Weg für alle, die gerade kein Postfach zur Hand
 * haben (A2). Diese Seite verwendet bewusst kein `AppPage`: Sie hat keine
 * Kopfzeile und keinen grossen Titel.
 */
export function LoginPage() {
  const { t } = useTranslation();
  const { signInWithMagicLink, signInWithPassword, authError, clearAuthError } =
    useAuth();

  const [method, setMethod] = useState<SignInMethod>('link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  // A1: Der abgelehnte Link wird gemeldet, sobald diese Seite erscheint. Er
  // steht im Kontext, weil er ausserhalb jeder Seite entstanden ist.
  const message = error ?? (authError ? t(authErrorKey(authError)) : null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    clearAuthError();

    const action = resolveSignInAction({ method, email, password });
    if (action.kind === 'invalid') {
      setError(t(action.messageKey));
      return;
    }

    setStatus('sending');
    try {
      if (action.kind === 'password') {
        await signInWithPassword(action.email, action.password);
        // Bei Erfolg übernimmt `RedirectIfSignedIn` – diese Seite verschwindet.
        setStatus('idle');
      } else {
        await signInWithMagicLink(action.email);
        setStatus('sent');
      }
    } catch (cause) {
      setStatus('idle');
      setError(
        t(authErrorKey(cause instanceof Error ? cause.message : undefined)),
      );
    }
  }

  if (!isConfigured) {
    return (
      <IonPage>
        <IonContent>
          <NotConfiguredState />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="app-centered app-centered--login">
          <IonText>
            <h1>{t('auth.title')}</h1>
          </IonText>

          {status === 'sent' ? (
            <>
              <IonText>
                <p>{t('auth.checkInbox', { email })}</p>
              </IonText>
              <IonButton fill="clear" onClick={() => setStatus('idle')}>
                {t('auth.sendAgain')}
              </IonButton>
            </>
          ) : (
            <>
              <IonSegment
                value={method}
                onIonChange={(e) => {
                  setMethod(e.detail.value as SignInMethod);
                  setError(null);
                  clearAuthError();
                }}
              >
                <IonSegmentButton value="link">
                  <IonLabel>{t('auth.methodLink')}</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="password">
                  <IonLabel>{t('auth.methodPassword')}</IonLabel>
                </IonSegmentButton>
              </IonSegment>

              <form onSubmit={handleSubmit} className="app-centered">
                <IonText color="medium">
                  <p>
                    {method === 'link' ? t('auth.subtitle') : t('auth.passwordSubtitle')}
                  </p>
                </IonText>

                {/* `fill` gibt es nur im Material-Modus; ohne `mode="md"`
                    stünden die Felder im iOS-Modus als blosse Linien da
                    (Doku ion-input, «Filled Inputs»). */}
                <IonInput
                  label={t('auth.email')}
                  labelPlacement="floating"
                  fill="outline"
                  mode="md"
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  enterkeyhint={method === 'link' ? 'send' : 'next'}
                  value={email}
                  onIonInput={(e) => setEmail(e.detail.value ?? '')}
                />

                {method === 'password' && (
                  <IonInput
                    label={t('auth.password')}
                    labelPlacement="floating"
                    fill="outline"
                    mode="md"
                    type="password"
                    autocomplete="current-password"
                    enterkeyhint="go"
                    value={password}
                    onIonInput={(e) => setPassword(e.detail.value ?? '')}
                  />
                )}

                {message && <InlineError message={message} />}

                <IonButton type="submit" expand="block" disabled={status === 'sending'}>
                  {status === 'sending' ? (
                    <IonSpinner name="crescent" />
                  ) : method === 'link' ? (
                    t('auth.sendMagicLink')
                  ) : (
                    t('auth.signIn')
                  )}
                </IonButton>

                {method === 'password' && (
                  <IonText color="medium">
                    <p>{t('auth.noPasswordHint')}</p>
                  </IonText>
                )}
              </form>
            </>
          )}

          <LanguageSwitcher />
        </div>
      </IonContent>
    </IonPage>
  );
}

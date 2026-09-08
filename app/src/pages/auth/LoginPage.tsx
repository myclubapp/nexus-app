import { useState, type FormEvent } from 'react';
import {
  IonButton,
  IonContent,
  IonInput,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { isConfigured } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { NotConfiguredState } from '../../components/StateViews';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { t } = useTranslation();
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!EMAIL_PATTERN.test(email)) {
      setError(t('auth.invalidEmail'));
      return;
    }

    setStatus('sending');
    try {
      await signInWithMagicLink(email.trim());
      setStatus('sent');
    } catch (cause) {
      setStatus('idle');
      setError(cause instanceof Error ? cause.message : t('common.error'));
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
            <IonText>
              <p>{t('auth.checkInbox', { email })}</p>
            </IonText>
          ) : (
            <form onSubmit={handleSubmit} className="app-centered">
              <IonText color="medium">
                <p>{t('auth.subtitle')}</p>
              </IonText>

              <IonInput
                label={t('auth.email')}
                labelPlacement="floating"
                fill="outline"
                type="email"
                inputmode="email"
                autocomplete="email"
                value={email}
                onIonInput={(e) => setEmail(e.detail.value ?? '')}
              />

              {error && (
                <IonNote color="danger" role="alert">
                  {error}
                </IonNote>
              )}

              <IonButton type="submit" expand="block" disabled={status === 'sending'}>
                {status === 'sending' ? (
                  <IonSpinner name="crescent" />
                ) : (
                  t('auth.sendMagicLink')
                )}
              </IonButton>
            </form>
          )}

          <LanguageSwitcher />
        </div>
      </IonContent>
    </IonPage>
  );
}

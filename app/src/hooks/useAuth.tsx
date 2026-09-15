import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import i18n from '../i18n';
import { toLanguage } from '../lib/language';
import { authRedirectUrl, supabase, isConfigured } from '../lib/supabase';
import { inviteCodeFromUrl, peekPendingInvite, setPendingInvite } from '../lib/invite';
import { authErrorFromUrl } from '../lib/authError';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** Wahr, bis die gespeicherte Sitzung einmal gelesen wurde. */
  initialising: boolean;
  /**
   * Meldung des zuletzt abgelehnten Anmeldelinks (UC-005 A1). Sie entsteht
   * ausserhalb jeder Seite – beim Rücksprung – und muss den Anmeldebildschirm
   * überleben, der danach erst gerendert wird.
   */
  authError: string | null;
  clearAuthError: () => void;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** Setzt oder ändert das Passwort des angemeldeten Kontos (UC-008). */
  setPassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Macht aus dem Anmeldelink eine Sitzung. Er kommt auf dem Gerät als
 * `<scheme>://auth/callback?code=…` und im Browser als gewöhnliche URL;
 * beide tragen einen PKCE-Code, der genau einmal getauscht werden darf.
 *
 * Gibt die Fehlermeldung zurück, statt sie zu verschlucken: Ein abgelaufener
 * Link führte sonst wortlos zurück auf den Anmeldebildschirm (A1).
 */
async function exchangeCodeFromUrl(url: string): Promise<string | null> {
  const rejected = authErrorFromUrl(url);
  if (rejected) return rejected;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const code = parsed.searchParams.get('code');
  if (!code) return null;

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? error.message : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialising, setInitialising] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Im Browser tauscht supabase-js den Code selbst; der abgelehnte Link
  // hinterlässt seine Begründung nur in der Adresse. Sie wird einmal beim
  // Start gelesen und danach aus der Adresszeile entfernt, damit ein Neuladen
  // nicht dieselbe Meldung wiederholt.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rejected = authErrorFromUrl(window.location.href);
    if (!rejected) return;
    setAuthError(rejected);
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  useEffect(() => {
    if (!isConfigured) {
      setInitialising(false);
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitialising(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Deep Links der nativen Apps.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handle = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      // Ein Einladungslink trägt keinen Anmeldecode: Er wird nicht getauscht,
      // sondern gemerkt, damit die App nach der Anmeldung dorthin führt.
      const inviteCode = inviteCodeFromUrl(url);
      if (inviteCode) {
        setPendingInvite(inviteCode);
        return;
      }
      void exchangeCodeFromUrl(url).then(setAuthError);
    });

    return () => {
      void handle.then((listener) => listener.remove());
    };
  }, []);

  /**
   * Den Anmeldelink anfordern (UC-005).
   *
   * `data` landet in `raw_user_meta_data` und **nur beim ersten Mal** – für
   * ein bestehendes Konto lässt GoTrue es fallen. Genau dafür ist es hier:
   * Der Hook `auth-mail` (UC-048) baut die Mail im Look des Vereins, kennt
   * beim allerersten Anmeldelink aber weder Sprache noch Verein. Die Sprache
   * steht später in `notification_settings` (`useLocaleSync`), der Verein in
   * der Mitgliedschaft; bis dahin sind diese zwei Angaben die einzige Spur.
   *
   * Beides ist **Eingabe und kein Beleg**: `mail_brand()` prüft den Code
   * gegen `invites`, statt ihm zu glauben.
   */
  const signInWithMagicLink = useCallback(async (email: string) => {
    setAuthError(null);
    const inviteCode = peekPendingInvite();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: authRedirectUrl(),
        data: {
          locale: toLanguage(i18n.language),
          ...(inviteCode ? { invite_code: inviteCode } : {}),
        },
      },
    });
    if (error) throw error;
  }, []);

  // A2: Der zweite Weg für alle, die kein Postfach zur Hand haben. Ein Konto
  // ohne gesetztes Passwort scheitert hier mit derselben Meldung wie ein
  // falsches Passwort – der Bildschirm soll nicht verraten, welche Adressen
  // ein Konto haben.
  const signInWithPassword = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const setPassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAuthError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initialising,
      authError,
      clearAuthError,
      signInWithMagicLink,
      signInWithPassword,
      setPassword,
      signOut,
    }),
    [
      session,
      initialising,
      authError,
      clearAuthError,
      signInWithMagicLink,
      signInWithPassword,
      setPassword,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}

export { exchangeCodeFromUrl };

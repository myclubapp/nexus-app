import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, isConfigured } from '../lib/supabase';
import { SUPPORTED_LANGUAGES, type Language } from '../i18n';
import { useAuth } from './useAuth';

/** Die Sprache der Oberfläche auf die vier bekannten verengt. */
export function toLanguage(value: string | undefined): Language {
  const short = (value ?? '').slice(0, 2).toLowerCase();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(short)
    ? (short as Language)
    : 'de';
}

/**
 * Die Sprache der App auf dem Server nachführen (UC-044).
 *
 * i18next merkt sich die Sprache im Gerät; der Server kennt sie sonst nicht –
 * und eine E-Mail in der falschen Sprache wäre der häufigste Grund, den
 * Kanal abzuschalten. Ein Aufruf beim Anmelden und einer je Sprachwechsel;
 * der Server schreibt nur, wenn sich der Wert ändert.
 */
export function useLocaleSync() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const language = toLanguage(i18n.language);
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !isConfigured) return;
    const key = `${user.id}:${language}`;
    if (sent.current === key) return;
    sent.current = key;
    void supabase.rpc('set_locale', { p_locale: language }).then(({ error }) => {
      // Eine fehlgeschlagene Sprachmeldung ist kein Fehler, den die Person
      // sehen muss – beim nächsten Wechsel wird es erneut versucht.
      if (error) sent.current = null;
    });
  }, [user, language]);
}

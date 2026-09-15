import { SUPPORTED_LANGUAGES, type Language } from '../i18n';

/**
 * Die Sprache der Oberfläche auf die vier bekannten verengt.
 *
 * i18next liefert je nach Gerät `de`, `de-CH` oder `gsw`; der Server kennt
 * nur die vier Kürzel. Die Funktion stand bis UC-048 in `useLocaleSync.ts` –
 * sie ist reine Logik und wird inzwischen auch von `useAuth` gebraucht, das
 * der Hook seinerseits importiert. Ein Modul in `lib/` löst den Ring auf.
 */
export function toLanguage(value: string | undefined): Language {
  const short = (value ?? '').slice(0, 2).toLowerCase();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(short)
    ? (short as Language)
    : 'de';
}

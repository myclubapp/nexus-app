import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Der Anlass, wie er in der Adresse eines Anmeldelinks steht (UC-005).
 *
 * Das Gegenstück zu `authAction()` in `supabase/functions/auth-mail/
 * template.ts`: Dort wird der Anlass in die Adresse geschrieben, hier wieder
 * gelesen. **Beide Listen müssen dieselben sechs Werte kennen** – fehlt einer
 * hier, löste die Seite einen gültigen Link als Anmeldelink ein und bekäme
 * vom Server ein «Token not found».
 *
 * Unbekanntes gilt als Anmeldelink, wie drüben auch: Er ist der häufigste
 * Anlass, und ein Versuch ist besser als ein Abbruch.
 */
const ACTIONS: readonly EmailOtpType[] = [
  'signup',
  'magiclink',
  'invite',
  'recovery',
  'email_change',
  'email',
];

export function emailOtpType(value: string | null | undefined): EmailOtpType {
  return ACTIONS.includes(value as EmailOtpType) ? (value as EmailOtpType) : 'magiclink';
}

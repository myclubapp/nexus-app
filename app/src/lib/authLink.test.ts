import { describe, expect, it } from 'vitest';
import { emailOtpType } from './authLink';

describe('emailOtpType', () => {
  // Dieselben sechs Werte, die `authAction()` in
  // `supabase/functions/auth-mail/template.ts` in die Adresse schreibt.
  // Laufen die Listen auseinander, löste diese Seite einen gültigen Link als
  // Anmeldelink ein – und bekäme ein «Token not found».
  it('kennt jeden Anlass, den die Anmeldemail schreibt', () => {
    for (const action of [
      'signup',
      'magiclink',
      'invite',
      'recovery',
      'email_change',
      'email',
    ]) {
      expect(emailOtpType(action)).toBe(action);
    }
  });

  it('nimmt Unbekanntes als Anmeldelink – wie die Mail auch', () => {
    expect(emailOtpType('quatsch')).toBe('magiclink');
    expect(emailOtpType(null)).toBe('magiclink');
    expect(emailOtpType(undefined)).toBe('magiclink');
    expect(emailOtpType('')).toBe('magiclink');
  });
});

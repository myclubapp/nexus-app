/**
 * Fehler aus einer Rücksprung-Adresse der Anmeldung lesen (UC-005 A1).
 *
 * Supabase legt einen abgelehnten Anmeldelink je nach Fluss unterschiedlich ab:
 * bei PKCE als Query (`?error=…`), beim impliziten Fluss im Fragment
 * (`#error=…`). Wer nur eines von beiden liest, lässt die Person wortlos auf
 * dem Anmeldebildschirm stehen.
 */
export function authErrorFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // Das Fragment beginnt mit '#'; als Suchparameter gelesen ergibt es dieselbe
  // Struktur wie die Query.
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));

  const description =
    parsed.searchParams.get('error_description') ??
    fragment.get('error_description');
  const code =
    parsed.searchParams.get('error_code') ??
    fragment.get('error_code') ??
    parsed.searchParams.get('error') ??
    fragment.get('error');

  if (!description && !code) return null;
  return description ?? code;
}

/**
 * Übersetzungsschlüssel zu einer Fehlermeldung des Backends.
 *
 * Supabase antwortet auf Englisch und unübersetzt. Die Zuordnung deckt die
 * Fälle ab, die eine Person tatsächlich sieht; alles andere fällt auf eine
 * allgemeine Meldung zurück, damit nie ein englischer Satz stehen bleibt.
 */
export function authErrorKey(message: string | null | undefined): string {
  const text = (message ?? '').toLowerCase();

  if (!text) return 'auth.error.generic';
  if (text.includes('expired') || text.includes('otp_expired')) {
    return 'auth.error.linkExpired';
  }
  if (text.includes('invalid') && text.includes('credentials')) {
    return 'auth.error.wrongPassword';
  }
  if (text.includes('rate limit') || text.includes('too many')) {
    return 'auth.error.rateLimited';
  }
  if (text.includes('email not confirmed')) {
    return 'auth.error.emailNotConfirmed';
  }
  if (text.includes('password') && text.includes('should be at least')) {
    return 'auth.error.passwordTooShort';
  }
  return 'auth.error.generic';
}

/** Mindestlänge eines Passworts – dieselbe Vorgabe wie in Supabase. */
export const PASSWORD_MIN_LENGTH = 8;

// --- Entscheidung des Anmeldeformulars -------------------------------------

/** Die beiden Wege aus UC-005: Anmeldelink (Hauptablauf) und Passwort (A2). */
export type SignInMethod = 'link' | 'password';

export interface SignInIntent {
  method: SignInMethod;
  email: string;
  password: string;
}

/**
 * Was soll auf «Absenden» geschehen?
 *
 * Bewusst eine reine Funktion und nicht Teil der Seite: Ionic-Eingaben lassen
 * sich in jsdom nicht bedienen (siehe docs/TESTING.md), die Entscheidung
 * dahinter aber vollständig prüfen.
 */
export type SignInAction =
  | { kind: 'invalid'; messageKey: string }
  | { kind: 'link'; email: string }
  | { kind: 'password'; email: string; password: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resolveSignInAction(intent: SignInIntent): SignInAction {
  const email = intent.email.trim();

  if (!EMAIL_PATTERN.test(email)) {
    return { kind: 'invalid', messageKey: 'auth.invalidEmail' };
  }

  if (intent.method === 'password') {
    // Die Länge wird hier nicht geprüft: Ein bestehendes Passwort darf kürzer
    // sein als die heutige Mindestlänge, und die Prüfung gehört ohnehin auf
    // den Server. Leer ist trotzdem sinnlos.
    if (intent.password.length === 0) {
      return { kind: 'invalid', messageKey: 'auth.passwordRequired' };
    }
    return { kind: 'password', email, password: intent.password };
  }

  return { kind: 'link', email };
}

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
 * Meldungen, hinter denen eine Sitzung steckt, die es auf dem Server nicht
 * mehr gibt.
 *
 * Abmelden gilt in dieser App für **alle** Geräte: `signOut()` läuft ohne
 * `scope`, und Supabase widerruft dann jede Sitzung des Kontos. Das ist so
 * gewollt – nur erfährt das andere Gerät nichts davon. Es hält sein Token
 * weiter, zeigt ein angemeldetes Profil und scheitert erst beim nächsten
 * Schreiben mit «Session not found».
 *
 * GoTrue formuliert denselben Sachverhalt je nach Endpunkt anders, deshalb
 * die Liste. Sie steht **vor** der Prüfung auf «expired» in `authErrorKey`:
 * «JWT expired» trüge sonst die Meldung über abgelaufene Anmeldelinks.
 */
const SESSION_GONE_PATTERNS = [
  'session not found',
  'session_not_found',
  'session missing',
  'session expired',
  'session_expired',
  'session from session_id claim in jwt does not exist',
  'refresh token not found',
  'refresh_token_not_found',
  'invalid refresh token',
  'jwt expired',
];

export function isSessionGone(message: string | null | undefined): boolean {
  const text = (message ?? '').toLowerCase();
  if (!text) return false;
  return SESSION_GONE_PATTERNS.some((pattern) => text.includes(pattern));
}

/**
 * Was an einem Fehler von supabase-js zählt.
 *
 * `code` ist die Kennung, die GoTrue mitschickt (`weak_password`,
 * `same_password`, …), und der bessere Anker als der englische Satz daneben:
 * Der Text wechselt mit der Serverversion, der Code nicht. `reasons` trägt
 * allein der `AuthWeakPasswordError` – dort steht, **warum** ein Passwort
 * abgelehnt wurde ('length', 'characters', 'pwned').
 *
 * Abgelesen statt über `instanceof` geprüft: Der Fehler kommt hier als
 * `unknown` aus einem `catch` an, und ein Testfall soll ihn nachstellen
 * können, ohne die Fehlerklassen von supabase-js zu bauen.
 */
function readFailure(error: unknown): {
  code: string;
  message: string;
  reasons: string[];
} {
  if (typeof error === 'string') return { code: '', message: error, reasons: [] };
  if (!error || typeof error !== 'object') return { code: '', message: '', reasons: [] };

  const { code, message, reasons } = error as Record<string, unknown>;
  return {
    code: typeof code === 'string' ? code.toLowerCase() : '',
    message: typeof message === 'string' ? message : '',
    reasons: Array.isArray(reasons)
      ? reasons.filter((reason): reason is string => typeof reason === 'string')
      : [],
  };
}

/**
 * Fehlercodes von GoTrue, die jemand zu sehen bekommt.
 *
 * Der Code hat Vorrang vor der Textsuche weiter unten. Die bleibt für die
 * Fälle, die ohne Code ankommen: Der abgelehnte Anmeldelink steht als
 * `error_description` in der Rücksprungadresse (`authErrorFromUrl`), dort gibt
 * es kein Fehlerobjekt.
 */
const ERROR_CODE_KEYS: Record<string, string> = {
  session_not_found: 'auth.error.sessionExpired',
  session_expired: 'auth.error.sessionExpired',
  refresh_token_not_found: 'auth.error.sessionExpired',
  refresh_token_already_used: 'auth.error.sessionExpired',
  bad_jwt: 'auth.error.sessionExpired',
  no_authorization: 'auth.error.sessionExpired',
  otp_expired: 'auth.error.linkExpired',
  flow_state_expired: 'auth.error.linkExpired',
  flow_state_not_found: 'auth.error.linkExpired',
  invalid_credentials: 'auth.error.wrongPassword',
  email_not_confirmed: 'auth.error.emailNotConfirmed',
  over_request_rate_limit: 'auth.error.rateLimited',
  over_email_send_rate_limit: 'auth.error.rateLimited',
  // Beim Setzen eines Passworts (UC-005 A2). `same_password` kommt, wenn das
  // neue dem alten gleicht; `reauthentication_needed`, wenn im Projekt
  // «Require reauthentication when changing password» steht und die Anmeldung
  // älter als 24 Stunden ist – dann hilft nur eine neue Anmeldung, weil diese
  // App den Nonce-Umweg über `reauthenticate()` nicht anbietet.
  same_password: 'auth.error.passwordSame',
  reauthentication_needed: 'auth.error.passwordReauth',
};

/**
 * Warum GoTrue ein Passwort für schwach hält.
 *
 * Die Reihenfolge ist die der Meldung: Wer zu kurz **und** in einem Datenleck
 * steht, hört zuerst das, was sich mechanisch beheben lässt. «Zu schwach»
 * allein sagt niemandem, was zu tun ist – genau das war die alte Meldung.
 */
const WEAK_PASSWORD_KEYS: ReadonlyArray<readonly [string, string]> = [
  ['length', 'auth.error.passwordTooShort'],
  ['characters', 'auth.error.passwordCharacters'],
  ['pwned', 'auth.error.passwordPwned'],
];

/**
 * Übersetzungsschlüssel zu einem Fehler des Backends.
 *
 * Supabase antwortet auf Englisch und unübersetzt. Die Zuordnung deckt die
 * Fälle ab, die eine Person tatsächlich sieht; alles andere fällt auf eine
 * allgemeine Meldung zurück, damit nie ein englischer Satz stehen bleibt.
 *
 * `error` ist, was im `catch` ankommt – ein `AuthError` von supabase-js –,
 * oder eine blosse Zeichenkette, wenn die Begründung aus einer Adresse stammt.
 *
 * `fallback` gibt es, weil der allgemeine Text vom Anmeldebildschirm kommt
 * («Die Anmeldung hat nicht geklappt»). Im Profil wird kein Konto angemeldet,
 * sondern ein Passwort gesetzt – dort nennt derselbe Satz den falschen
 * Vorgang.
 */
export function authErrorKey(error: unknown, fallback = 'auth.error.generic'): string {
  const failure = readFailure(error);

  if (failure.code === 'weak_password') {
    const named = WEAK_PASSWORD_KEYS.find(([reason]) =>
      failure.reasons.includes(reason),
    );
    return named?.[1] ?? 'auth.error.passwordWeak';
  }

  const byCode = ERROR_CODE_KEYS[failure.code];
  if (byCode) return byCode;

  const text = failure.message.toLowerCase();

  if (!text) return fallback;
  // Vor 'expired': «JWT expired» ist keine Sache des Anmeldelinks.
  if (isSessionGone(text)) return 'auth.error.sessionExpired';
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
  return fallback;
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

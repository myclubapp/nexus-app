import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MIN_LENGTH,
  authErrorFromUrl,
  authErrorKey,
  isSessionGone,
  resolveSignInAction,
} from './authError';

/**
 * UC-005 A1: Ein abgelaufener Anmeldelink muss der Person gesagt werden.
 * Supabase legt die Begründung je nach Fluss in die Query oder ins Fragment –
 * wer nur eines liest, lässt sie wortlos auf dem Anmeldebildschirm stehen.
 */
describe('authErrorFromUrl', () => {
  it('liest den Fehler aus der Query (PKCE)', () => {
    expect(
      authErrorFromUrl(
        'https://app.myclub.ch/auth/callback?error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toBe('Email link is invalid or has expired');
  });

  it('liest den Fehler aus dem Fragment (impliziter Fluss)', () => {
    expect(
      authErrorFromUrl(
        'https://app.myclub.ch/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toBe('Email link is invalid or has expired');
  });

  it('liest den Fehler aus einem Deep Link', () => {
    expect(
      authErrorFromUrl('ch.myclub.nexus://auth/callback?error_code=otp_expired'),
    ).toBe('otp_expired');
  });

  it('fällt auf den Code zurück, wenn keine Beschreibung mitkommt', () => {
    expect(authErrorFromUrl('https://app.myclub.ch/?error=access_denied')).toBe(
      'access_denied',
    );
  });

  it('meldet null für eine Adresse ohne Fehler', () => {
    expect(authErrorFromUrl('https://app.myclub.ch/auth/callback?code=abc')).toBeNull();
    expect(authErrorFromUrl('https://app.myclub.ch/tabs/dashboard')).toBeNull();
    expect(authErrorFromUrl('keine-adresse')).toBeNull();
  });
});

/**
 * Die Meldungen von Supabase kommen auf Englisch. Ohne die Zuordnung stünde
 * ein englischer Satz in einer französischen Oberfläche (C-007).
 */
describe('authErrorKey', () => {
  it('erkennt einen abgelaufenen Link', () => {
    expect(authErrorKey('Email link is invalid or has expired')).toBe(
      'auth.error.linkExpired',
    );
    expect(authErrorKey('otp_expired')).toBe('auth.error.linkExpired');
  });

  it('erkennt falsche Zugangsdaten', () => {
    expect(authErrorKey('Invalid login credentials')).toBe('auth.error.wrongPassword');
  });

  it('erkennt die Ratenbegrenzung', () => {
    expect(authErrorKey('Email rate limit exceeded')).toBe('auth.error.rateLimited');
    expect(authErrorKey('For security purposes, too many requests')).toBe(
      'auth.error.rateLimited',
    );
  });

  it('erkennt eine unbestätigte Adresse', () => {
    expect(authErrorKey('Email not confirmed')).toBe('auth.error.emailNotConfirmed');
  });

  it('erkennt ein zu kurzes Passwort', () => {
    expect(authErrorKey('Password should be at least 8 characters')).toBe(
      'auth.error.passwordTooShort',
    );
  });

  it('fällt auf eine allgemeine Meldung zurück', () => {
    // Wichtiger als die Genauigkeit: Es bleibt nie ein englischer Satz stehen.
    expect(authErrorKey('some unexpected backend failure')).toBe('auth.error.generic');
    expect(authErrorKey(null)).toBe('auth.error.generic');
    expect(authErrorKey(undefined)).toBe('auth.error.generic');
    expect(authErrorKey('')).toBe('auth.error.generic');
  });

  it('unterscheidet nicht nach Gross- und Kleinschreibung', () => {
    expect(authErrorKey('EMAIL LINK IS INVALID OR HAS EXPIRED')).toBe(
      'auth.error.linkExpired',
    );
  });
});

describe('isSessionGone', () => {
  // Abmelden gilt für alle Geräte. Das andere Gerät merkt es erst hier.
  it.each([
    'Session not found',
    'session_not_found',
    'Auth session missing!',
    'Session from session_id claim in JWT does not exist',
    'Invalid Refresh Token: Refresh Token Not Found',
    'refresh_token_not_found',
    'JWT expired',
  ])('erkennt %s als widerrufene Sitzung', (message) => {
    expect(isSessionGone(message)).toBe(true);
  });

  it.each(['', null, undefined, 'Invalid login credentials', 'Email rate limit exceeded'])(
    'hält %s nicht für eine widerrufene Sitzung',
    (message) => {
      expect(isSessionGone(message)).toBe(false);
    },
  );

  it('unterscheidet nicht nach Gross- und Kleinschreibung', () => {
    expect(isSessionGone('SESSION NOT FOUND')).toBe(true);
  });
});

describe('authErrorKey und die widerrufene Sitzung', () => {
  it('nennt die widerrufene Sitzung beim Namen', () => {
    expect(authErrorKey('Session not found')).toBe('auth.error.sessionExpired');
  });

  // «JWT expired» enthält 'expired' und liefe sonst in die Meldung über
  // abgelaufene Anmeldelinks – die hier nichts erklärt.
  it('hält ein abgelaufenes Token vom Anmeldelink auseinander', () => {
    expect(authErrorKey('JWT expired')).toBe('auth.error.sessionExpired');
    expect(authErrorKey('Email link is invalid or has expired')).toBe(
      'auth.error.linkExpired',
    );
  });

  it('nimmt den übergebenen Rückfall statt der Anmeldemeldung', () => {
    expect(authErrorKey('something odd', 'auth.error.passwordSaveFailed')).toBe(
      'auth.error.passwordSaveFailed',
    );
    expect(authErrorKey(undefined, 'auth.error.passwordSaveFailed')).toBe(
      'auth.error.passwordSaveFailed',
    );
  });

  it('bleibt ohne Rückfall bei der allgemeinen Meldung', () => {
    expect(authErrorKey('something odd')).toBe('auth.error.generic');
  });
});

describe('PASSWORD_MIN_LENGTH', () => {
  it('entspricht der Vorgabe von Supabase', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });
});

/**
 * Die Entscheidung des Anmeldeformulars. Sie liegt bewusst hier und nicht in
 * der Seite: Ionic-Eingaben lassen sich in jsdom nicht bedienen, diese
 * Verzweigung aber vollständig prüfen (UC-005 Hauptablauf und A2).
 */
describe('resolveSignInAction', () => {
  it('schickt einen Anmeldelink an eine gültige Adresse', () => {
    expect(
      resolveSignInAction({ method: 'link', email: 'alex@example.com', password: '' }),
    ).toEqual({ kind: 'link', email: 'alex@example.com' });
  });

  it('schneidet Leerzeichen um die Adresse weg', () => {
    // Ein aus der Zwischenablage eingefügtes Leerzeichen darf die Anmeldung
    // nicht scheitern lassen.
    expect(
      resolveSignInAction({ method: 'link', email: '  alex@example.com  ', password: '' }),
    ).toEqual({ kind: 'link', email: 'alex@example.com' });
  });

  it.each([
    ['keine-adresse'],
    ['alex@'],
    ['@example.com'],
    ['alex example.com'],
    ['alex@example'],
    [''],
    ['   '],
  ])('weist %s als Adresse ab', (email) => {
    expect(resolveSignInAction({ method: 'link', email, password: '' })).toEqual({
      kind: 'invalid',
      messageKey: 'auth.invalidEmail',
    });
  });

  it('meldet mit Passwort an (A2)', () => {
    expect(
      resolveSignInAction({
        method: 'password',
        email: 'alex@example.com',
        password: 'geheim1234',
      }),
    ).toEqual({
      kind: 'password',
      email: 'alex@example.com',
      password: 'geheim1234',
    });
  });

  it('verlangt ein Passwort, bevor es sendet', () => {
    expect(
      resolveSignInAction({ method: 'password', email: 'alex@example.com', password: '' }),
    ).toEqual({ kind: 'invalid', messageKey: 'auth.passwordRequired' });
  });

  it('prüft die Adresse vor dem Passwort', () => {
    // Sonst meldet die Seite «Passwort fehlt», obwohl die Adresse das Problem ist.
    expect(
      resolveSignInAction({ method: 'password', email: 'kaputt', password: '' }),
    ).toEqual({ kind: 'invalid', messageKey: 'auth.invalidEmail' });
  });

  it('lässt ein kurzes bestehendes Passwort durch', () => {
    // Die Mindestlänge gilt beim Setzen, nicht beim Anmelden – ein älteres
    // Passwort darf kürzer sein, und die Prüfung gehört auf den Server.
    const action = resolveSignInAction({
      method: 'password',
      email: 'alex@example.com',
      password: 'kurz',
    });
    expect(action.kind).toBe('password');
  });

  it('gibt das Passwort unverändert weiter', () => {
    // Kein trim: Leerzeichen können Teil des Passworts sein.
    const action = resolveSignInAction({
      method: 'password',
      email: 'alex@example.com',
      password: '  mit rand  ',
    });
    expect(action).toMatchObject({ password: '  mit rand  ' });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import {
  deepLinkTarget,
  forgetDeepLink,
  peekDeepLink,
  rememberDeepLink,
} from './deepLink';

describe('deepLinkTarget', () => {
  it('führt den App Link aus der E-Mail auf seinen Pfad zurück', () => {
    expect(deepLinkTarget('https://app.my-club.ch/tabs/pulse/42')).toBe('/tabs/pulse/42');
  });

  it('nimmt die Query mit', () => {
    expect(deepLinkTarget('https://app.my-club.ch/tabs/agenda?event=7')).toBe(
      '/tabs/agenda?event=7',
    );
  });

  it('versteht denselben Ort als Deep Link, wo «tabs» im Host steht', () => {
    expect(deepLinkTarget('ch.myclub.nexus://tabs/profile/invoices')).toBe(
      '/tabs/profile/invoices',
    );
  });

  it('steuert die Einladung an', () => {
    expect(deepLinkTarget('https://app.my-club.ch/invite/abc123')).toBe('/invite/abc123');
  });

  // Der Anmeldelink gehört useAuth – hier darf nichts losfahren.
  it('lässt den Anmeldelink liegen', () => {
    expect(deepLinkTarget('ch.myclub.nexus://auth/callback?code=xyz')).toBeNull();
    expect(deepLinkTarget('https://app.my-club.ch/auth/callback?code=xyz')).toBeNull();
  });

  it('lässt den abgelehnten Anmeldelink liegen', () => {
    expect(
      deepLinkTarget('ch.myclub.nexus://auth/callback?error_code=otp_expired'),
    ).toBeNull();
  });

  it('beansprucht nichts ausserhalb von /tabs und /invite', () => {
    expect(deepLinkTarget('https://app.my-club.ch/login')).toBeNull();
    expect(deepLinkTarget('https://app.my-club.ch/')).toBeNull();
    expect(deepLinkTarget('https://app.my-club.ch/tabsanity')).toBeNull();
  });

  it('verträgt eine Adresse, die keine ist', () => {
    expect(deepLinkTarget('nicht mal eine url')).toBeNull();
  });
});

describe('gemerktes Ziel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('merkt den Weg und gibt ihn unverändert zurück', () => {
    rememberDeepLink('/tabs/pulse/42');
    expect(peekDeepLink()).toBe('/tabs/pulse/42');
  });

  // Ohne diese Schranke merkte sich der Speicher jede Zwischenstation, an der
  // die Anmeldeschranke zuschlägt.
  it('merkt sich nur, was die App auch beansprucht', () => {
    rememberDeepLink('/onboarding');
    expect(peekDeepLink()).toBeNull();
  });

  it('vergisst auf Verlangen', () => {
    rememberDeepLink('/tabs/agenda');
    forgetDeepLink();
    expect(peekDeepLink()).toBeNull();
  });

  // Der Grund für «lesen statt verbrauchen»: Unter StrictMode läuft das Rendern
  // zweimal. Ein verbrauchendes Lesen gäbe beim zweiten Mal null zurück und die
  // App führe aufs Dashboard statt ans Ziel.
  it('überlebt zweimaliges Lesen', () => {
    rememberDeepLink('/tabs/pulse/42');
    expect(peekDeepLink()).toBe('/tabs/pulse/42');
    expect(peekDeepLink()).toBe('/tabs/pulse/42');
  });

  it('ist nach zweimaligem Vergessen immer noch leer statt kaputt', () => {
    rememberDeepLink('/tabs/pulse/42');
    forgetDeepLink();
    forgetDeepLink();
    expect(peekDeepLink()).toBeNull();
  });
});

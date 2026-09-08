import { Capacitor } from '@capacitor/core';
import { env } from './env';

/** Pfad, unter dem eine Einladung geöffnet wird – in der App wie im Browser. */
export const INVITE_PATH = '/invite';

/**
 * Teilbarer Link zu einer Einladung.
 *
 * Bewusst immer die Web-Adresse, auch auf dem Gerät: Ein `ch.myclub.nexus://`-
 * Link führt bei Empfänger:innen ohne installierte App ins Leere. Die Web-Seite
 * öffnet die App, wenn es sie gibt (UC-002 A3).
 */
export function inviteLink(code: string): string {
  const origin =
    env.webRedirectUrl ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}${INVITE_PATH}/${code}`;
}

/**
 * Einladungscode aus einer geöffneten Adresse lesen.
 *
 * Deckt beide Formen ab: den Deep Link `ch.myclub.nexus://invite/<code>` und
 * die Web-Adresse `https://…/invite/<code>`. Gibt `null` zurück, wenn die
 * Adresse keine Einladung ist.
 */
export function inviteCodeFromUrl(url: string): string | null {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }

  // Beim Deep Link `scheme://invite/<code>` landet «invite» im Host, nicht im
  // Pfad – deshalb wird die ganze Adresse hinter dem Schema betrachtet.
  const afterScheme = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '/');
  const candidate = afterScheme.startsWith(`${INVITE_PATH}/`) ? afterScheme : path;

  const match = /^\/invite\/([A-Za-z0-9-]+)/.exec(candidate);
  return match ? match[1].toLowerCase() : null;
}

/** Kann das Gerät den nativen Teilen-Dialog anzeigen (UC-003, Schritt 8)? */
export function canShareNatively(): boolean {
  return Capacitor.isNativePlatform() || typeof navigator?.share === 'function';
}

// --- Gemerkte Einladung ----------------------------------------------------

const PENDING_INVITE_KEY = 'myclub.pendingInvite';

/**
 * Merkt den Einladungscode über die Anmeldung hinweg (UC-002 Schritt 4,
 * UC-005 A4).
 *
 * `localStorage` und nicht `sessionStorage`: Der Anmeldelink öffnet je nach
 * E-Mail-Programm einen neuen Tab, und der bekäme eine leere Sitzung.
 */
export function setPendingInvite(code: string): void {
  try {
    localStorage.setItem(PENDING_INVITE_KEY, code);
  } catch {
    // Ein gesperrter Speicher kostet nur den Rücksprung, nicht den Beitritt.
  }
}

/** Liest den gemerkten Code, ohne ihn zu verbrauchen. */
export function peekPendingInvite(): string | null {
  try {
    return localStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}

/** Liest den gemerkten Code und löscht ihn – er gilt genau einmal. */
export function takePendingInvite(): string | null {
  const code = peekPendingInvite();
  try {
    localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // siehe oben
  }
  return code;
}

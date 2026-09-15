import { authErrorFromUrl } from './authError';

/**
 * Pfade, die die App für sich beansprucht.
 *
 * Dieselbe Liste steht in `AndroidManifest.xml` (`pathPrefix`) und in
 * `public/.well-known/apple-app-site-association` (`components`). Laufen sie
 * auseinander, öffnet das Betriebssystem die App für eine Adresse, mit der
 * diese Funktion nichts anzufangen weiss – die App startet und bleibt auf der
 * Seite stehen, auf der sie zuletzt war.
 */
const CLAIMED_PREFIXES = ['/tabs/', '/invite/'];

/**
 * Das Ziel in der App zu einer von aussen geöffneten Adresse (`appUrlOpen`).
 *
 * Deckt beide Formen ab: den App Link `https://app.my-club.ch/tabs/pulse/…`
 * aus einer E-Mail und den Deep Link `ch.myclub.nexus://tabs/pulse/…`. Gibt
 * `null` zurück, wenn die Adresse kein Ziel ist, das angesteuert werden soll.
 *
 * Der Anmeldelink ist ausdrücklich keines: Ihn tauscht `useAuth` gegen eine
 * Sitzung, und wohin es danach geht, entscheiden die Weichen in `RouteGuards`.
 * Würde hier zusätzlich navigiert, führe die App mitten im Tausch los.
 */
export function deepLinkTarget(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // Gehört `useAuth`: der PKCE-Code und die Begründung eines abgelehnten Links.
  if (parsed.searchParams.has('code') || authErrorFromUrl(url)) return null;

  // Beim Deep Link `scheme://tabs/pulse/1` landet «tabs» im Host und nicht im
  // Pfad, weil das Schema keines der eingebauten ist. Beim App Link steht im
  // Host die Domain, die nicht zum Pfad gehört.
  const isWeb = parsed.protocol === 'https:' || parsed.protocol === 'http:';
  const path = isWeb ? parsed.pathname : `/${parsed.host}${parsed.pathname}`;

  if (!CLAIMED_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;
  return `${path}${parsed.search}`;
}

// --- Gemerktes Ziel --------------------------------------------------------

const PENDING_LINK_KEY = 'myclub.pendingDeepLink';

/**
 * Merkt das Ziel über die Anmeldung hinweg.
 *
 * Wer einen Link aus einer E-Mail antippt, ohne angemeldet zu sein, wird von
 * `RequireAuth` auf den Anmeldebildschirm geschickt – und landete danach auf
 * dem Dashboard, weil niemand mehr wusste, wohin er eigentlich wollte. Genau
 * die Leute trifft das, die die App gerade neu installiert haben.
 *
 * `localStorage` und nicht `sessionStorage`, aus demselben Grund wie bei
 * {@link setPendingInvite}: Der Anmeldelink öffnet je nach E-Mail-Programm
 * einen neuen Tab, und der bekäme eine leere Sitzung.
 */
export function rememberDeepLink(target: string): void {
  // Nur, was die App auch beansprucht. Ohne diese Schranke merkte sich der
  // Speicher jede Zwischenstation, an der die Anmeldeschranke zuschlägt.
  if (!CLAIMED_PREFIXES.some((prefix) => target.startsWith(prefix))) return;
  try {
    localStorage.setItem(PENDING_LINK_KEY, target);
  } catch {
    // Ein gesperrter Speicher kostet nur den Rücksprung, nicht die Anmeldung.
  }
}

/** Liest das gemerkte Ziel, ohne es zu verbrauchen. */
export function peekDeepLink(): string | null {
  try {
    return localStorage.getItem(PENDING_LINK_KEY);
  } catch {
    return null;
  }
}

/**
 * Vergisst das gemerkte Ziel – aufgerufen erst, wenn es erreicht ist.
 *
 * Bewusst kein `take` beim Entscheiden: Unter `StrictMode` läuft das Rendern
 * zweimal, und ein verbrauchendes Lesen gäbe beim zweiten Mal `null` zurück –
 * die App führe aufs Dashboard statt ans Ziel. Vergessen ist dagegen
 * wiederholbar.
 */
export function forgetDeepLink(): void {
  try {
    localStorage.removeItem(PENDING_LINK_KEY);
  } catch {
    // siehe oben
  }
}

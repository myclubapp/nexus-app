/**
 * Verbandsanbindung (UC-035).
 *
 * **BR-151: Der Schlüssel ist die Verifikation.** Es gibt kein
 * Vereinsverzeichnis und keinen Zuordnungsprozess – wer die Kennung seines
 * Vereins beim Verband kennt, ist berechtigt. Diese Datei kennt deshalb keine
 * Prüfung der Berechtigung, nur die der Eingabe.
 *
 * **BR-153: Schlüssel liegen im Tresor.** Der Schlüssel geht einmal zum Server
 * und kommt nie zurück; der Client hält ihn nur so lange, wie das Formular
 * offen ist. Es gibt hier deshalb keinen Typ, der einen gespeicherten
 * Schlüssel trägt.
 */

import { LEGACY_EXTERNAL_ID_PREFIX } from './legacy';

/** Die Verbände, die das alte Backend kennt – dieselben Kennungen. */
export const FEDERATIONS = [
  'swissunihockey',
  'swissvolley',
  'swisshandball',
  'swissturnverband',
] as const;

export type Federation = (typeof FEDERATIONS)[number];

export type FederationStatus = 'pending' | 'active' | 'error';

export interface FederationConnection {
  federation: Federation;
  federationClubId: string;
  status: FederationStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Ob ein Schlüssel hinterlegt ist – **nicht** welcher (BR-153). */
  hasKey: boolean;
  /**
   * Stehen die Beiträge dieses Verbands im Feed (FR-197, BR-260)?
   *
   * Voreingestellt **aus**: Ein Verein verbindet den Verband wegen des
   * Spielplans; die Medienmitteilungen sind eine zweite Frage, und sie wird
   * gestellt, nicht vorausgesetzt.
   */
  newsEnabled: boolean;
}

/**
 * Verlangt dieser Verband einen Schlüssel (A2)?
 *
 * Heute keiner: Die vier Schnittstellen sind offen, und die Vereinskennung
 * genügt. Die Frage steht trotzdem hier und nicht als `false` im Formular –
 * sobald ein Verband einen Schlüssel verlangt, ändert sich **eine** Zeile.
 */
const KEY_REQUIRED: Record<Federation, boolean> = {
  swissunihockey: false,
  swissvolley: false,
  swisshandball: false,
  swissturnverband: false,
};

export function requiresKey(federation: Federation): boolean {
  return KEY_REQUIRED[federation];
}

/**
 * Liefert dieser Verband Beiträge für den Feed (FR-197)?
 *
 * Heute nur swiss unihockey: Er veröffentlicht über Publishr, und
 * `sync-federation` liest diese Schnittstelle. Die drei übrigen Verbände haben
 * keine – das alte Backend kratzt dort ihre Websites ab, und eine abgelesene
 * HTML-Seite ist keine Zusage, auf die sich ein Verein verlassen soll.
 *
 * Die Frage steht hier und nicht als `true` im Formular: Kommt ein Verband
 * dazu, ändert sich **eine** Zeile – wie bei `requiresKey()`.
 *
 * **Das Gegenstück ist `newsEndpoint()` in `supabase/functions/sync-federation`.**
 * Beide Listen sagen dasselbe, und sie müssen zweimal dastehen: Die App kennt
 * weder Endpunkte noch Secrets, der Dienst kennt kein UI. Wer einen Verband
 * ergänzt, ergänzt beide.
 */
const NEWS_AVAILABLE: Record<Federation, boolean> = {
  swissunihockey: true,
  swissvolley: false,
  swisshandball: false,
  swissturnverband: false,
};

export function deliversNews(federation: Federation): boolean {
  return NEWS_AVAILABLE[federation];
}

export type FederationProblem = 'clubIdMissing' | 'keyMissing';

/**
 * Was an der Eingabe noch fehlt (Schritte 3 und 4).
 *
 * Reine Funktion, weil sich eine Ionic-Eingabe im Test nicht bedienen lässt
 * (docs/TESTING.md §6.4) – und weil die Regel «ohne Kennung nichts» sonst
 * zweimal stünde: hier und im Server.
 */
export function validateConnection(draft: {
  federation: Federation;
  federationClubId: string;
  apiKey: string;
}): FederationProblem[] {
  const problems: FederationProblem[] = [];

  if (draft.federationClubId.trim().length === 0) problems.push('clubIdMissing');
  if (requiresKey(draft.federation) && draft.apiKey.trim().length === 0) {
    problems.push('keyMissing');
  }

  return problems;
}

/**
 * Die Ampel einer Verbindung.
 *
 * `pending` ist bewusst **nicht** gelb: Eine Verbindung, die noch nie geprüft
 * wurde, ist kein Problem, sondern ein Anfang. Gelb bliebe sie, bis der
 * nächtliche Lauf sie bestätigt – und ein Vorstand, der eine gelbe Ampel
 * sieht, sucht einen Fehler, den es nicht gibt.
 */
export function statusTone(status: FederationStatus): string {
  if (status === 'active') return 'success';
  if (status === 'error') return 'danger';
  return 'medium';
}

/**
 * Ist der Abgleich stehengeblieben (A3)?
 *
 * Nicht dasselbe wie `status === 'error'`: Der Zustand wechselt erst nach drei
 * Tagen ohne erfolgreichen Lauf (`report_federation_sync()` in `0058`). Diese
 * Frage stellt die Ansicht, um den erklärenden Satz zu zeigen – die App bleibt
 * nutzbar, nur die Verbandsdaten veralten (BR-155).
 */
export function isStale(
  connection: Pick<FederationConnection, 'status' | 'lastSyncAt'>,
  now: Date = new Date(),
): boolean {
  if (connection.status !== 'active') return connection.status === 'error';
  if (!connection.lastSyncAt) return false;
  const days = (now.getTime() - new Date(connection.lastSyncAt).getTime()) / 86_400_000;
  return days > 3;
}

/** Was der Abgleich einer Verbindung zurückgibt (`sync-federation`, Betriebsart `sync`). */
export interface FederationSyncResult {
  ok: boolean;
  teams?: number;
  games?: number;
  stale?: number;
  /** FR-197: wie viele Verbandsbeiträge im Feed stehen. */
  news?: number;
  /** Warum keine – ohne dass die Verbindung deshalb als kaputt gilt (BR-155). */
  newsError?: string;
  error?: string;
}

/**
 * UC-039, Schritt 9: Wie viele Spiele der Abgleich brachte – oder warum keine.
 *
 * Die Verknüpfung steht in beiden Fällen; der Unterschied ist nur, was die
 * Meldung sagt: die Zahl der Spiele, oder dass sie mit dem nächsten Lauf
 * kommen und weshalb nicht jetzt. Deshalb kein Fehler, sondern eine
 * Beschreibung (A7).
 */
export type GamesSync = { games: number; error: null } | { games: null; error: string };

export function readGamesSync(
  result: FederationSyncResult | null | undefined,
  fallback = 'Keine Antwort',
): GamesSync {
  if (result?.ok) return { games: result.games ?? 0, error: null };
  return { games: null, error: result?.error?.trim() || fallback };
}

/**
 * Stammt ein Termin vom Verband (UC-039)?
 *
 * `events.external_id` tragen zwei Quellen: der Verband (`0060`) und die
 * bisherige myclub-App (`0069`). Nur die erste macht einen Verbandstermin
 * aus – ein übernommenes Training ist ein gewöhnliches Training und heisst
 * im Detail auch so.
 */
export function isFederationEvent(event: { external_id?: string | null }): boolean {
  const id = event.external_id;
  return !!id && !id.startsWith(LEGACY_EXTERNAL_ID_PREFIX);
}

/**
 * Welcher Verband einen Termin liefert (UC-039).
 *
 * Die Kennung eines Verbandstermins ist `<verband>:<spielkennung>`
 * (`sync-federation`), und der Verband ist einer der vier bekannten. Das
 * Detail nennt ihn beim Namen – «Spiel · Swiss Unihockey», nicht «vom
 * Verband»: Ein Verein kann an zwei Verbänden hängen, und wer das Spiel
 * liest, soll wissen, wessen Spielplan es ist.
 */
export function federationOf(event: { external_id?: string | null }): Federation | null {
  const id = event.external_id;
  if (!id) return null;
  const colon = id.indexOf(':');
  if (colon < 0) return null;
  const prefix = id.slice(0, colon);
  return (FEDERATIONS as readonly string[]).includes(prefix) ? (prefix as Federation) : null;
}

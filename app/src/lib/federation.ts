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

/**
 * Übernahme aus der bisherigen myclub-App (UC-040).
 *
 * **BR-185: Das Service-Konto bleibt auf dem Server.** Diese Datei kennt
 * deshalb keinen Schlüssel und keine Firebase-Adresse – nur die Kennung des
 * Vereins in der alten App, wie sie in deren Adresse steht (`/club/su-452800`).
 */

export type LegacyStatus = 'pending' | 'active' | 'error';

export interface LegacySource {
  firebaseClubId: string;
  status: LegacyStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Wie viele Termine, Mitglieder und Antworten der letzte gelungene Lauf brachte. */
  importedEvents: number;
  importedMembers: number;
  importedResponses: number;
}

/** Dieselbe Regel wie der Check in `0069_legacy_sources.sql`. */
export const FIREBASE_CLUB_ID_PATTERN = /^[A-Za-z0-9_-]{2,60}$/;

/**
 * Womit `events.external_id` bei übernommenen Terminen beginnt – dieselbe
 * Regel wie `mapEvent()`/`mapTraining()` in `sync-legacy/mapping.ts`
 * («legacy:<Art>:<Id>»). Verbandsspiele tragen «<Verband>:<Spiel>» (`0060`).
 */
export const LEGACY_EXTERNAL_ID_PREFIX = 'legacy:';

/**
 * Die Kennung aus der Eingabe lesen (Schritt 3).
 *
 * Wer die Adresse der alten App einfügt («…/club/su-452800» oder mit
 * angehängtem Pfad), meint die Kennung darin – die App verlangt nicht, dass
 * jemand sie von Hand herausschneidet.
 */
export function normalizeFirebaseClubId(input: string): string {
  const trimmed = input.trim();
  const inUrl = /\/club\/([A-Za-z0-9_-]+)/.exec(trimmed);
  if (inUrl) return inUrl[1];
  return trimmed.replace(/^\/+|\/+$/g, '');
}

export type LegacyProblem = 'clubIdMissing' | 'clubIdInvalid';

/** Was an der Eingabe noch fehlt – reine Funktion, wie `validateConnection` (UC-035). */
export function validateFirebaseClubId(input: string): LegacyProblem[] {
  const id = normalizeFirebaseClubId(input);
  if (id.length === 0) return ['clubIdMissing'];
  if (!FIREBASE_CLUB_ID_PATTERN.test(id)) return ['clubIdInvalid'];
  return [];
}

/** Die Ampel – dieselben Töne wie beim Verband: `pending` ist ein Anfang, kein Problem. */
export function statusTone(status: LegacyStatus): string {
  if (status === 'active') return 'success';
  if (status === 'error') return 'danger';
  return 'medium';
}

/**
 * Ist die Übernahme stehengeblieben (A2)?
 *
 * Der Zustand wechselt erst nach drei Tagen ohne gelungenen Lauf
 * (`report_legacy_sync()`); die Ansicht zeigt den erklärenden Satz aber
 * schon, sobald der letzte Lauf so lange zurückliegt.
 */
export function isStale(
  source: Pick<LegacySource, 'status' | 'lastSyncAt'>,
  now: Date = new Date(),
): boolean {
  if (source.status !== 'active') return source.status === 'error';
  if (!source.lastSyncAt) return false;
  const days = (now.getTime() - new Date(source.lastSyncAt).getTime()) / 86_400_000;
  return days > 3;
}

/** Was der Testaufruf zurückgibt (Schritt 4, A1). */
export interface LegacyCheck {
  ok: boolean;
  name?: string | null;
  members?: number;
  teams?: number;
  events?: number;
  helpers?: number;
  shifts?: number;
  trainings?: number;
  games?: number;
  responses?: number;
  error?: string;
}

/** Was die Übernahme zurückgibt (`sync-legacy`, Betriebsart `sync`). */
export interface LegacySyncResult {
  ok: boolean;
  members?: number;
  teams?: number;
  events?: number;
  helpers?: number;
  trainings?: number;
  shifts?: number;
  responses?: number;
  unmatched?: number;
  error?: string;
}

/**
 * Die Zahl der übernommenen Termine und Antworten – oder warum keine kamen.
 * Die Quelle ist in beiden Fällen gespeichert; der Unterschied ist nur, was
 * die Meldung sagt.
 */
export type LegacySync =
  | { count: number; responses: number; error: null }
  | { count: null; responses: null; error: string };

export function readLegacySync(
  result: LegacySyncResult | null | undefined,
  fallback = 'Keine Antwort',
): LegacySync {
  if (result?.ok) {
    return {
      count: (result.events ?? 0) + (result.helpers ?? 0) + (result.trainings ?? 0),
      responses: result.responses ?? 0,
      error: null,
    };
  }
  return { count: null, responses: null, error: result?.error?.trim() || fallback };
}

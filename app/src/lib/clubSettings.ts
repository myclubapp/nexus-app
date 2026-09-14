import type { ClubModule, ClubSettings, EventType } from './database.types';
import type { Language } from '../i18n';
import { SUPPORTED_LANGUAGES } from '../i18n';

/** Ein Begriff in bis zu vier Sprachen (BR-148). */
export type LabelSet = Partial<Record<Language, string>>;

/**
 * Den Begriff für diese Terminart in dieser Sprache auflösen.
 *
 * Drei Stufen, in dieser Reihenfolge:
 *   1. der Begriff in der gewählten Sprache,
 *   2. **irgendein** hinterlegter Begriff – wer «Probe» nur auf Deutsch
 *      eingetragen hat, meint ihn auch auf Französisch; ein Verein, der etwas
 *      gesagt hat, soll nicht auf die Standardübersetzung zurückfallen,
 *   3. nichts – dann greift `t('agenda.type.…')` beim Aufrufer.
 *
 * Reine Funktion, weil dieselbe Regel im Formular und in der Anzeige gilt
 * (guidelines.md §9).
 */
export function resolveLabel(
  labels: ClubSettings['labels'],
  type: EventType,
  language: string,
): string | null {
  const set = labels?.[type];
  if (!set) return null;

  const own = set[language as Language]?.trim();
  if (own) return own;

  for (const code of SUPPORTED_LANGUAGES) {
    const fallback = set[code]?.trim();
    if (fallback) return fallback;
  }
  return null;
}

/**
 * Ist ein Modul eingeschaltet?
 *
 * **Fehlt der Eintrag, ist es aus.** Das ist der Unterschied zu jeder anderen
 * Einstellung dieser App: K7 verlangt den Zero-Config-Start, und ein Modul,
 * das ungefragt da ist, wäre keine progressive Aktivierung (BR-150). Dieselbe
 * Regel steht als `module_enabled()` in `0052` – hier entscheidet sie nur, ob
 * ein Weg erscheint.
 */
export function isModuleOn(
  settings: ClubSettings | null | undefined,
  module: ClubModule,
): boolean {
  return settings?.modules?.[module] === true;
}

/**
 * Die Einstellungen eines Vereins aus dem Formularstand aufbauen.
 *
 * Leere Begriffe, Farben, Module und DNA-Felder werden **nicht** abgelegt:
 * `eventLabel()` fällt dann auf die Standardübersetzung zurück, und ein Verein
 * ohne eigene Farbe zeigt wieder die Basisfarben. Bliebe ein leerer Wert
 * stehen, wäre das eine Einstellung, die etwas verspricht und nichts bewirkt.
 *
 * **Was fehlt, bleibt stehen.** Jedes Feld der Eingabe ist wahlfrei: Eine Seite,
 * die nur die Begriffe führt, schickt nur die Begriffe – Farben, Module und DNA
 * bleiben unangetastet. Ein fehlendes Feld heisst «nicht angefasst», ein leeres
 * heisst «weg».
 *
 * Reine Funktion, weil die Entscheidung sonst in einem Ereignis-Handler
 * steckte, den kein Test bedienen kann (guidelines.md §9).
 */
export function buildClubSettings(
  current: ClubSettings | null | undefined,
  input: {
    labels?: Partial<Record<EventType, LabelSet>>;
    theme?: ClubSettings['theme'];
    modules?: Partial<Record<ClubModule, boolean>>;
    dna?: NonNullable<ClubSettings['dna']>;
    logoUrl?: string;
    /** Konzept §7.2: Ausschnitt und Ränge ohne Punktzahl. */
    leaderboard?: { topOnly: string; hidePoints: boolean };
    /** UC-042: das Saisonziel für den Beitrag, in Punkten. */
    goal?: { seasonPoints: string };
  },
): ClubSettings {
  const settings: ClubSettings = { ...current };

  // Was der Aufrufer nicht mitschickt, fasst diese Funktion nicht an: Seit die
  // Begriffe auf einer eigenen Seite stehen, speichert jede Seite nur ihren
  // eigenen Ausschnitt – und dürfte den Rest nicht mit einem leeren Entwurf
  // überschreiben.
  if (input.labels) {
    // Je Terminart bleiben nur die Sprachen stehen, in denen etwas steht – und
    // eine Terminart ohne einzige Sprache verschwindet ganz.
    const cleanLabels = Object.fromEntries(
      Object.entries(input.labels)
        .map(([type, set]) => [
          type,
          Object.fromEntries(
            Object.entries(set ?? {}).filter(([, value]) => value?.trim()),
          ),
        ])
        .filter(([, set]) => Object.keys(set as object).length > 0),
    );

    if (Object.keys(cleanLabels).length > 0) settings.labels = cleanLabels;
    else delete settings.labels;
  }

  if (input.theme) {
    const cleanTheme = Object.fromEntries(
      Object.entries(input.theme).filter(([, value]) => value?.trim()),
    );

    if (Object.keys(cleanTheme).length > 0) settings.theme = cleanTheme;
    else delete settings.theme;
  }

  if (input.modules) {
    // Nur eingeschaltete Module werden abgelegt. Ein `false` wäre dasselbe wie
    // ein fehlender Eintrag und machte die Einstellung nur länger.
    const cleanModules = Object.fromEntries(
      Object.entries(input.modules).filter(([, value]) => value === true),
    );

    if (Object.keys(cleanModules).length > 0) settings.modules = cleanModules;
    else delete settings.modules;
  }

  if (input.dna) {
    const cleanDna = Object.fromEntries(
      Object.entries(input.dna).filter(([, value]) => value?.trim()),
    );

    if (Object.keys(cleanDna).length > 0) settings.dna = cleanDna;
    else delete settings.dna;
  }

  if (input.logoUrl !== undefined) {
    if (input.logoUrl.trim()) settings.logoUrl = input.logoUrl.trim();
    else delete settings.logoUrl;
  }

  // Rangliste: Ein Ausschnitt unter 1 ist keiner (dann gilt die Vorgabe), und
  // ein `false` ist dasselbe wie kein Eintrag.
  if (input.leaderboard) {
    const topOnly = Math.floor(Number(input.leaderboard.topOnly));
    const clean: NonNullable<ClubSettings['leaderboard']> = {};
    if (Number.isFinite(topOnly) && topOnly >= 1) clean.topOnly = topOnly;
    if (input.leaderboard.hidePoints) clean.hidePoints = true;
    if (Object.keys(clean).length > 0) settings.leaderboard = clean;
    else delete settings.leaderboard;
  }

  // Saisonziel: Ein leeres Feld heisst «kein Ziel» und verschwindet ganz –
  // dann zeigt die Übersicht nur das Ist, und es gibt keine Ampel ohne
  // Massstab (UC-042 A2). Die Null bleibt ausdrücklich **nicht** stehen: Ein
  // Vereinsziel von null hiesse, der ganze Verein wäre befreit, und das sagt
  // man, indem man kein Ziel setzt.
  if (input.goal) {
    const seasonPoints = Math.floor(Number(input.goal.seasonPoints));
    if (input.goal.seasonPoints.trim() !== '' && Number.isFinite(seasonPoints) && seasonPoints >= 1) {
      settings.goal = { seasonPoints };
    } else {
      delete settings.goal;
    }
  }

  return settings;
}

/**
 * Hat sich der Saisonbeginn geändert (A4)?
 *
 * Die Rückfrage hängt nicht daran, ob das Feld angefasst wurde, sondern ob der
 * Wert ein anderer ist: Wer denselben Tag erneut eingibt, ändert nichts und
 * soll nicht gefragt werden.
 */
export function seasonStartChanged(
  before: string | null | undefined,
  after: string,
): boolean {
  return (before ?? '') !== after;
}

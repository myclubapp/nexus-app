import { TASK_CATEGORIES, type TaskCategory } from './task';

/**
 * Das Beitrags-Profil (UC-033).
 *
 * **BR-142: «Anfragen statt abfragen.»** Der Verein fragt, was für das Mitglied
 * ein sinnvoller Beitrag wäre, statt nur zu fragen, wer eine offene Aufgabe
 * übernimmt.
 *
 * Die Interessen kommen aus `TASK_CATEGORIES` und nicht aus einer zweiten
 * Aufzählung: Zwei Listen, die auseinanderlaufen, ergeben kein Matching – die
 * Datenbank prüft dieselben acht Werte (`0051`).
 */
export { TASK_CATEGORIES };
export type ContributionInterest = TaskCategory;

/**
 * Die Zeitbudgets – dieselben Werte wie der Constraint in `0051`.
 *
 * Englisch, wie jeder Datenbankwert (CLAUDE.md §Regeln). Das Entitätsmodell
 * nennt die deutschen Wörter; die sind die Anzeige, nicht der Wert.
 */
export const TIME_BUDGETS = ['once', 'monthly', 'seasonal'] as const;
export type TimeBudget = (typeof TIME_BUDGETS)[number];

/** Die Höchstlänge der Beschreibung – derselbe Wert wie der Constraint in `0051`. */
export const MAX_STRENGTHS = 1000;

export interface ContributionProfile {
  interests: ContributionInterest[];
  strengths: string;
  timeBudget: TimeBudget | null;
  /** Wann das Profil zuletzt gepflegt wurde; `null` bei einer leeren Zeile. */
  updatedAt: string | null;
}

export interface ContributionDraft {
  interests: ContributionInterest[];
  strengths: string;
  timeBudget: TimeBudget | null;
}

/**
 * Ist das Profil ausgefüllt?
 *
 * Eine Zeile allein genügt nicht: A1 legt eine an, die nur festhält, dass
 * gefragt wurde. Ausgefüllt ist es erst mit einem Interesse oder einem Satz –
 * und genau daran hängt, ob es persönliche Vorschläge gibt.
 */
export function isProfileFilled(profile: ContributionProfile | null): boolean {
  if (!profile) return false;
  return profile.interests.length > 0 || profile.strengths.trim().length > 0;
}

export type ContributionProblem = 'budgetMissing' | 'strengthsTooLong' | 'nothingChosen';

/**
 * Was am Profil fehlt (Schritte 2–5).
 *
 * **Ein leeres Profil ist gültig** – das ist A1, «später ausfüllen», und BR-143:
 * Ohne Profil bleibt die App vollständig nutzbar. Verlangt wird nur, was ein
 * *ausgefülltes* Profil braucht: sein Zeitbudget, weil BR-144 sonst nicht
 * anwendbar wäre.
 *
 * `nothingChosen` ist deshalb **kein** Fehler, sondern der Hinweis für den
 * Fall, dass jemand ein Zeitbudget wählt und sonst nichts – dann fehlt dem
 * Matching die Grundlage.
 */
export function validateProfile(draft: ContributionDraft): ContributionProblem[] {
  const problems: ContributionProblem[] = [];
  const filled = draft.interests.length > 0 || draft.strengths.trim().length > 0;

  if (filled && draft.timeBudget === null) problems.push('budgetMissing');
  if (draft.strengths.trim().length > MAX_STRENGTHS) problems.push('strengthsTooLong');
  if (!filled && draft.timeBudget !== null) problems.push('nothingChosen');

  return problems;
}

/**
 * Wie viele Beiträge dieses Budget im Zeitraum zulässt.
 *
 * Die Zahlen stehen an **einer** Stelle in der Datenbank
 * (`contribution_budget_left()`); hier stehen sie, damit die Ansicht den Fall
 * A4 erklären kann, statt eine leere Liste zu zeigen.
 */
export function budgetCap(budget: TimeBudget): number {
  if (budget === 'seasonal') return 3;
  return 1;
}

/**
 * Sind die persönlichen Vorschläge zurückgestellt (A4)?
 *
 * `null` heisst «kein Budget gesetzt» und damit unbeschränkt – nicht null
 * (BR-143). Diese Unterscheidung ist der ganze Unterschied zwischen «du hast
 * nichts angegeben» und «du hast genug getan».
 */
export function isBudgetSpent(left: number | null | undefined): boolean {
  return typeof left === 'number' && left <= 0;
}

/**
 * Die Interessen aus der Datenbank in geprüfte Werte.
 *
 * Was die Datenbank liefert, ist `jsonb`. Ein Wert, den die Kategorienliste
 * nicht kennt, fällt heraus statt einen Schlüssel `taskCategory.undefined` in
 * die Ansicht zu tragen.
 */
export function readInterests(raw: unknown): ContributionInterest[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is ContributionInterest =>
    (TASK_CATEGORIES as readonly string[]).includes(value as string),
  );
}

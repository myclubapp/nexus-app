/**
 * Das Saisonziel für den Beitrag (UC-042).
 *
 * Die alte myclub-App führte zwei Konten: ein Soll in «Helferpunkten» und
 * daneben ein Punktesystem mit einer anderen Skala. Hier ist beides dieselbe
 * Zahl – das Ziel steht in Punkten, das Ist ist die Summe der Buchungen der
 * Säulen 3 und 7 (`contribution_points()` in `0080`).
 *
 * Diese Datei rechnet nur; sie holt nichts und zeigt nichts.
 */

import { toCsv } from './csv';

/** Die Stufen der Ampel. Dieselben Namen wie `contribution_overview()`. */
export type GoalState = 'reached' | 'onTrack' | 'open' | 'exempt' | 'unset';

/**
 * Die Stufe selbst rechnet der **Server** (`contribution_state()` in `0080`),
 * und zwar für beide Sichten dieselbe. Hier steht sie bewusst nicht noch
 * einmal: Zwei Fassungen derselben Schwelle laufen auseinander, und dann zeigt
 * die App eine andere Farbe, als der Vorstand in seiner Liste sieht. Die
 * Schwellen (voll, halb) sind aus der bisherigen myclub-App übernommen
 * (`helfer-punkte-club.page.html`).
 */

/** Die Farbe zur Stufe – Ionic-Farben, keine eigenen. */
export function goalColor(state: GoalState): 'success' | 'warning' | 'danger' | 'medium' {
  switch (state) {
    case 'reached':
      return 'success';
    case 'onTrack':
      return 'warning';
    case 'open':
      return 'danger';
    default:
      return 'medium';
  }
}

/**
 * Der Anteil für den Fortschrittsbalken, zwischen 0 und 1.
 *
 * `IonProgressBar` erwartet genau diesen Bereich; ein Wert über 1 zeichnet den
 * Balken über seine Breite hinaus. Wer sein Ziel übertrifft, sieht deshalb
 * einen vollen Balken und die Zahl daneben.
 */
export function goalProgress(earned: number, goal: number | null): number {
  if (!goal || goal <= 0) return 0;
  return Math.min(Math.max(earned / goal, 0), 1);
}

/**
 * Der Anteil, den **Geleistetes und Eingeplantes zusammen** füllen (FR-198).
 *
 * `IonProgressBar` zeichnet mit `buffer` einen zweiten, blasseren Abschnitt –
 * dafür ist diese Zahl da. Sie liegt nie unter `goalProgress()`: Ein Puffer
 * hinter dem Balken sähe aus, als wäre etwas verloren gegangen.
 *
 * Getrennt gerundet wird hier nichts; die Karte zeigt die Zahlen daneben im
 * Klartext, und zwei Wege zur selben Aussage widersprechen sich irgendwann.
 */
export function plannedProgress(
  earned: number,
  planned: number,
  goal: number | null,
): number {
  if (!goal || goal <= 0) return 0;
  return Math.min(Math.max((earned + Math.max(planned, 0)) / goal, 0), 1);
}

/**
 * Der Vorschlag beim Einschalten: vier Einsätze der Regel, die einen Einsatz
 * bucht.
 *
 * Vier ist die Zahl aus dem Helferreglement der bisherigen App – dort waren es
 * vier Punkte, hier sind es vier **Einsätze**, weil ein Einsatz nicht mehr 1
 * zählt, sondern seinen Wert nach Dauer. Ohne Regel kein Vorschlag: Eine Zahl
 * aus dem Nichts wäre geraten.
 */
export const GOAL_SUGGESTION_SHIFTS = 4;

export function suggestedSeasonGoal(shiftRulePoints: number | null | undefined): number | null {
  if (!shiftRulePoints || shiftRulePoints <= 0) return null;
  return shiftRulePoints * GOAL_SUGGESTION_SHIFTS;
}

/** Eine Zeile der Vorstandsübersicht, so wie `contribution_overview()` sie gibt. */
export interface ContributionRow {
  member_id: string;
  name: string | null;
  avatar_url: string | null;
  goal: number | null;
  earned: number;
  /** Zugesagt und noch nicht gebucht (FR-198). */
  planned: number;
  remaining: number | null;
  state: GoalState;
}

/**
 * Die Übersicht als CSV für den Kassier (BR-203).
 *
 * Trennzeichen, Quotierung und Zeilenende stehen seit UC-043 in `lib/csv.ts`
 * – der Mitglieder-Export braucht dieselben Regeln, und zweimal dieselbe
 * Quotierung wäre zweimal dieselbe Regel.
 */
export function contributionCsv(rows: ContributionRow[], header: string[]): string {
  return toCsv(
    header,
    rows.map((row) => [
      row.name ?? '',
      row.earned,
      row.planned,
      row.goal,
      row.remaining,
      row.state,
    ]),
  );
}

import { describe, expect, it } from 'vitest';
import {
  GOAL_SUGGESTION_SHIFTS,
  contributionCsv,
  goalColor,
  goalProgress,
  plannedProgress,
  suggestedSeasonGoal,
  type ContributionRow,
} from './contributionGoal';

// Die **Stufe** rechnet der Server (`contribution_state()` in `0080`) – sie
// steht bewusst nicht zweimal im Repository. Geprüft wird hier, was der Client
// daraus macht.

describe('goalColor', () => {
  it('gibt jeder Stufe eine Ionic-Farbe', () => {
    expect(goalColor('reached')).toBe('success');
    expect(goalColor('onTrack')).toBe('warning');
    expect(goalColor('open')).toBe('danger');
    // «Befreit» und «kein Ziel» sind keine Ampelstufen: keine Farbe, die
    // Dringlichkeit behauptet.
    expect(goalColor('exempt')).toBe('medium');
    expect(goalColor('unset')).toBe('medium');
  });
});

describe('goalProgress', () => {
  it('bleibt zwischen 0 und 1, auch über dem Ziel', () => {
    // `IonProgressBar` zeichnet über 1 hinaus über seine Breite.
    expect(goalProgress(0, 200)).toBe(0);
    expect(goalProgress(100, 200)).toBe(0.5);
    expect(goalProgress(400, 200)).toBe(1);
    expect(goalProgress(50, 0)).toBe(0);
    expect(goalProgress(50, null)).toBe(0);
  });
});

describe('plannedProgress', () => {
  it('zählt Eingeplantes zum Geleisteten und bleibt zwischen 0 und 1', () => {
    expect(plannedProgress(50, 50, 200)).toBe(0.5);
    expect(plannedProgress(0, 100, 200)).toBe(0.5);
    // Über dem Ziel bleibt der Balken voll – wie `goalProgress()`.
    expect(plannedProgress(150, 150, 200)).toBe(1);
    expect(plannedProgress(50, 0, 0)).toBe(0);
    expect(plannedProgress(50, 0, null)).toBe(0);
  });

  it('liegt nie unter dem Geleisteten', () => {
    // Ein Puffer **hinter** dem Fortschritt sähe aus, als wäre etwas verloren
    // gegangen. Eine negative Zahl kann der Server zwar nicht liefern, aber
    // die Rechnung darf sie auch nicht durchreichen.
    expect(plannedProgress(100, -50, 200)).toBe(goalProgress(100, 200));
    expect(plannedProgress(100, 0, 200)).toBe(goalProgress(100, 200));
  });
});

describe('suggestedSeasonGoal', () => {
  it('rechnet vier Einsätze der Regel – aus dem Nichts nichts', () => {
    expect(suggestedSeasonGoal(50)).toBe(50 * GOAL_SUGGESTION_SHIFTS);
    expect(suggestedSeasonGoal(0)).toBeNull();
    expect(suggestedSeasonGoal(null)).toBeNull();
    expect(suggestedSeasonGoal(undefined)).toBeNull();
  });
});

describe('contributionCsv', () => {
  const rows: ContributionRow[] = [
    {
      member_id: 'a',
      name: 'Anna Beispiel',
      avatar_url: null,
      goal: 200,
      earned: 50,
      planned: 75,
      remaining: 150,
      state: 'open',
    },
    {
      member_id: 'b',
      // Ein Name mit Semikolon und Anführungszeichen darf die Spalten nicht
      // verschieben – sonst liest der Kassier eine Zeile falsch.
      name: 'Bö; "Chäs" Meier',
      avatar_url: null,
      goal: null,
      earned: 0,
      planned: 0,
      remaining: null,
      state: 'unset',
    },
  ];

  it('trennt mit Semikolon und schützt Sonderzeichen', () => {
    const csv = contributionCsv(rows, [
      'Name',
      'Geleistet',
      'Eingeplant',
      'Ziel',
      'Offen',
      'Stand',
    ]);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('"Name";"Geleistet";"Eingeplant";"Ziel";"Offen";"Stand"');
    // Geleistet und eingeplant stehen nebeneinander und werden **nicht**
    // addiert: Der Kassier soll die Zusage von der Leistung unterscheiden.
    expect(lines[1]).toBe('"Anna Beispiel";"50";"75";"200";"150";"open"');
    // Das Anführungszeichen ist verdoppelt, das Semikolon bleibt im Feld.
    expect(lines[2]).toBe('"Bö; ""Chäs"" Meier";"0";"0";"";"";"unset"');
    expect(lines).toHaveLength(3);
  });

  it('gibt ohne Zeilen nur die Kopfzeile', () => {
    expect(contributionCsv([], ['Name'])).toBe('"Name"');
  });
});

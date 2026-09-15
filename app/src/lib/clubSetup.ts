/**
 * Der Einrichtungs-Assistent nach der Gründung (UC-051, FR-195).
 *
 * **Er ist kein Teil der Gründung.** BR-004 hält den Gründungs-Wizard bei drei
 * Eingabeschritten, und BR-002 verlangt, dass der Verein danach ohne einen
 * einzigen Konfigurationsschritt nutzbar ist. Beides bleibt: Der Assistent
 * führt durch die vier Fragen, die ein frisch gegründeter Verein **hat** –
 * Verband, Teams, Beispielinhalte, Mitglieder –, und wer ihn überspringt,
 * verliert nichts.
 *
 * Die Reihenfolge ist nicht beliebig: Der Verband steht zuerst, weil er die
 * Teams mitbringt (UC-039 A1); die Teams stehen vor den Mitgliedern, weil eine
 * Einladung ein Team benennen kann (UC-003). Die Beispielinhalte stehen
 * dazwischen, wo die Person zum ersten Mal sieht, dass die App nicht leer ist.
 */
import type { Federation } from './federation';

/** Wo der Assistent wohnt. An **einer** Stelle, weil vier Wege dorthin führen. */
export const CLUB_SETUP_ROUTE = '/tabs/profile/setup';

export const SETUP_STEPS = ['federation', 'news', 'teams', 'samples', 'members'] as const;

export type SetupStepId = (typeof SETUP_STEPS)[number];

/**
 * Welche Schritte der Assistent zeigt.
 *
 * Die Frage nach den Verbandsnews erscheint **erst, wenn ein Verband
 * verbunden ist** – vorher gäbe es nichts anzuzeigen und niemanden zu fragen.
 * Sie schiebt sich damit unmittelbar hinter den Schritt, der sie auslöst: Wer
 * im ersten Schritt verbindet, bekommt sie im zweiten (UC-035, Schritt 7).
 *
 * Reine Funktion, weil dieselbe Liste den Fortschrittsbalken, die
 * Schrittzählung und den Inhalt bestimmt – und weil sich eine Schrittführung
 * im Test sonst nur über Klicks prüfen liesse (docs/TESTING.md §6.4).
 */
export function setupSteps(hasFederation: boolean): SetupStepId[] {
  return SETUP_STEPS.filter((step) => step !== 'news' || hasFederation);
}

/**
 * Der sichtbare Schritt, nachdem sich die Liste geändert hat.
 *
 * Verbindet jemand im ersten Schritt einen Verband, wächst die Liste um den
 * News-Schritt; fällt die Verbindung weg, schrumpft sie. Ohne diese Klammer
 * stünde der Assistent danach auf einem Schritt, den es nicht mehr gibt, und
 * `Wizard` zeigte den letzten – also «Mitglieder» statt «Teams».
 */
export function clampStep(index: number, steps: readonly SetupStepId[]): number {
  if (steps.length === 0) return 0;
  return Math.min(Math.max(index, 0), steps.length - 1);
}

/**
 * Was der News-Schritt zu einer Verbindung sagen kann.
 *
 * Drei Zustände, und alle drei sind ehrlich: Der Verband liefert Beiträge und
 * der Verein hat sie an; er liefert und der Verein hat sie aus; oder es gibt
 * für diesen Verband keine Beiträge – dann steht dort kein Schalter, der nichts
 * bewirkt, sondern der Satz, warum.
 */
export type NewsOffer = 'on' | 'off' | 'unavailable';

export function newsOffer(
  connection: { federation: Federation; newsEnabled: boolean },
  deliversNews: (federation: Federation) => boolean,
): NewsOffer {
  if (!deliversNews(connection.federation)) return 'unavailable';
  return connection.newsEnabled ? 'on' : 'off';
}

/**
 * Was die Person liest, nachdem sie den Schalter umgelegt hat.
 *
 * Drei Ausgänge, und der mittlere ist der, den man vergisst: **eingeschaltet,
 * aber noch nichts da**. Das ist kein Fehlschlag – die Verbindung steht, nur
 * der Abruf kam nicht durch (BR-155) –, und die Meldung sagt genau das, mit dem
 * Grund des Verbands im Wortlaut.
 *
 * Reine Funktion, weil zwei Ansichten dieselbe Meldung zeigen: die
 * Verbandsseite und der Einrichtungs-Assistent.
 */
export function newsToggleMessageKey(result: {
  enabled: boolean;
  syncError: string | null;
}): 'federation.newsOff' | 'federation.newsOn' | 'federation.newsPending' {
  if (!result.enabled) return 'federation.newsOff';
  return result.syncError ? 'federation.newsPending' : 'federation.newsOn';
}

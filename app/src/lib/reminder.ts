/**
 * Die Entscheidungen rund um die Erinnerung (UC-015).
 *
 * Reine Funktionen, weil beide Verzweigungen fachlich sind und keine
 * Bedienung: wann der Weg überhaupt dasteht (A2), und was die Rückmeldung
 * sagt (A1). Im Ereignis-Handler wären sie ungeprüft – genau dort sass der
 * Fehler, dass jede Rückgabe `0` als «schon erinnert» gemeldet wurde
 * (docs/TESTING.md §4).
 */

export interface ReminderResult {
  notified: number;
  /** Nur gesetzt, wenn die 24-Stunden-Frist noch läuft. */
  lastReminder: string | null;
}

export type ReminderMessage =
  | { kind: 'sent'; count: number }
  | { kind: 'tooSoon'; lastReminder: string }
  | { kind: 'noneLeft' };

/**
 * Was ist zu melden?
 *
 * Der Server gibt `notified = 0` in mehreren Lagen zurück: die Frist läuft
 * (A1), niemand ist mehr offen (A2), oder es war ein Beispielinhalt. Nur die
 * erste trägt einen Zeitpunkt – und nur sie darf von «bereits erinnert»
 * sprechen. Ohne diese Unterscheidung meldete die App ein leeres Datum und
 * behauptete eine Erinnerung, die es nie gab.
 */
export function reminderMessage(result: ReminderResult): ReminderMessage {
  if (result.notified > 0) return { kind: 'sent', count: result.notified };
  if (result.lastReminder) return { kind: 'tooSoon', lastReminder: result.lastReminder };
  return { kind: 'noneLeft' };
}

export interface RemindableEvent {
  isDraft: boolean;
  isCancelled: boolean;
  hasStarted: boolean;
  /** Wie viele noch nicht geantwortet haben – `null`, solange unbekannt. */
  undecided: number | null;
  isTrainer: boolean;
  /**
   * Der Termin hat Schichten (BR-196). Dann gibt es keine Antwort auf den
   * Anlass, also auch niemanden, der sie schuldig bliebe – die Erinnerung
   * ginge an den ganzen Verein, auch wenn kein Platz mehr frei ist.
   */
  viaShifts?: boolean;
}

/**
 * Steht der Weg zum Erinnern offen (A2)?
 *
 * Bei unbekannter Zahl – die Mitgliederabfrage lädt noch oder ist
 * fehlgeschlagen – bleibt der Weg **offen**. Ihn zu verbergen sähe aus wie
 * «alle haben geantwortet», und der Server weist ohnehin ab, wenn niemand
 * offen ist. Ein stiller Fehler darf nicht wie ein Erfolg aussehen.
 */
export function canRemind(event: RemindableEvent): boolean {
  if (!event.isTrainer) return false;
  if (event.isDraft || event.isCancelled || event.hasStarted) return false;
  if (event.viaShifts) return false;
  return event.undecided === null || event.undecided > 0;
}

/**
 * Das Zeitfenster des Check-ins im Client (UC-014, BR-054).
 *
 * Entschieden wird es weiterhin auf dem Server – der Client kennt das Token
 * gar nicht und könnte die Prüfung nicht ersetzen (BR-056). Diese Rechnung
 * beantwortet nur, **ob der Knopf dasteht**: Ein Einstieg, der im gültigen
 * Fenster fehlt, ist so schlimm wie einer, der ausserhalb hinführt.
 *
 * Die Grenzen müssen mit `check_in()` übereinstimmen. Laufen sie auseinander,
 * zeigt die App einen Knopf, der abgewiesen wird – oder verbirgt einen, der
 * ginge.
 */

/** BR-054: Das Fenster öffnet 30 Minuten vor Beginn. */
export const CHECK_IN_LEAD_MINUTES = 30;

/** BR-054: Ohne Endzeit gilt eine Standarddauer von drei Stunden. */
export const CHECK_IN_DEFAULT_HOURS = 3;

export interface CheckInWindowInput {
  startsAt: string;
  endsAt: string | null;
  isCancelled: boolean;
  /** Ein Entwurf hat noch nicht stattgefunden. */
  isDraft: boolean;
}

/**
 * Steht der Check-in gerade offen?
 *
 * Ausdrücklich **nicht** an «bevorstehend» oder «vergangen» gebunden: Die
 * Agenda teilt bei `starts_at`, das Fenster reicht aber bis zum Ende. Wer die
 * Halle um 19:05 betritt, findet den Termin unter «Vergangen» – einchecken darf
 * er trotzdem.
 */
export function isCheckInOpen(
  event: CheckInWindowInput,
  now: Date = new Date(),
): boolean {
  if (event.isCancelled || event.isDraft) return false;

  const start = new Date(event.startsAt).getTime();
  if (Number.isNaN(start)) return false;

  const end = event.endsAt ? new Date(event.endsAt).getTime() : Number.NaN;
  const closesAt = Number.isNaN(end)
    ? start + CHECK_IN_DEFAULT_HOURS * 60 * 60 * 1000
    : end;

  const opensAt = start - CHECK_IN_LEAD_MINUTES * 60 * 1000;
  const current = now.getTime();

  return current >= opensAt && current <= closesAt;
}

import i18n from '../i18n';

/**
 * Die Schweizer Ausprägung der App-Sprache – für `Intl` und für jedes
 * `IonDatetime`. Nicht `i18n.language` selbst: «de» formatiert nach
 * Deutschland, «de-CH» hält Datum, Uhrzeit und Zahl so, wie Vereinsmitglieder
 * sie kennen. Eine Funktion, kein Wert: Sie wechselt mit der Sprache.
 */
export function appLocale(): string {
  const language = (i18n.resolvedLanguage ?? 'de').split('-')[0];
  const map: Record<string, string> = {
    de: 'de-CH',
    fr: 'fr-CH',
    it: 'it-CH',
    en: 'en-GB',
  };
  return map[language] ?? 'de-CH';
}

/**
 * Was jedes `IonDatetime` der App gleich hält – dazu `locale={appLocale()}`:
 * Montag als Wochenstart und Stunden von 00 bis 23 ohne AM/PM, auf jeder
 * Plattform und in jeder Sprache. Die Datumsfelder der bestehenden myclub-App
 * setzen dasselbe (`[firstDayOfWeek]="1"`); wer ein Datum wählt, findet die
 * Woche so vor, wie sie im Vereinskalender steht.
 */
export const DATETIME_DEFAULTS = {
  firstDayOfWeek: 1,
  hourCycle: 'h23',
} as const;

/** Auch die Anzeige zählt 00–23 – dieselbe Vorgabe wie die Wähler. */
const hourCycle = DATETIME_DEFAULTS.hourCycle;

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Tag und Uhrzeit mit Jahr – «Di., 29.09.2026, 20:30». Das Jahr steht immer
 * da (Entscheid 2026-09-13): Termine reichen über den Saisonwechsel hinaus,
 * und ein Datum ohne Jahr lässt raten, ob es der letzte oder der nächste
 * September ist.
 */
export function formatDateTime(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(appLocale(), {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle,
  }).format(date);
}

export function formatDate(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(appLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** Der ganze Tag ausgeschrieben – «Sonntag, 13. September 2026» über der Tagesliste. */
export function formatDayLong(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(appLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Nur die Uhrzeit – für das Ende eines Termins, dessen Beginn schon dasteht. */
export function formatTime(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(appLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle,
  }).format(date);
}

/**
 * `Date` als lokales `YYYY-MM-DDTHH:mm` für ein `datetime-local`-Feld – nie
 * über `toISOString()`, das rechnet nach UTC und verschiebt die Stunde.
 */
export function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

import i18n from '../i18n';

function locale(): string {
  const language = (i18n.resolvedLanguage ?? 'de').split('-')[0];
  // Swiss regional formats keep dates and numbers familiar for club members.
  const map: Record<string, string> = {
    de: 'de-CH',
    fr: 'fr-CH',
    it: 'it-CH',
    en: 'en-GB',
  };
  return map[language] ?? 'de-CH';
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale(), {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** Nur die Uhrzeit – für das Ende eines Termins, dessen Beginn schon dasteht. */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale(), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

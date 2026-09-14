/**
 * Die Mail aus den Meldungen (UC-044) – reine Funktionen, `deno test` in
 * diesem Ordner.
 *
 * Gerüst aus `github.com/myclubapp/email-templates`: Tabellenlayout auf
 * 600 px, Kopfband in der Vereinsfarbe, Gruss, Inhalt, Fusszeile. Die Texte
 * sind neu und in den vier Sprachen der App; die Inhalte kommen aus den
 * Zeilen von `notifications`, nicht aus einer eigenen Vorlage je Anlass –
 * eine Meldung ist eine Meldung, ob sie in der Inbox oder im Postfach liegt.
 *
 * Zwei Formen aus derselben Funktion: **eine** Meldung (sofort oder dringend)
 * und die **Zusammenfassung** (täglich oder wöchentlich). Der Unterschied
 * liegt im Betreff und in der Anrede, nicht im Aufbau.
 */

export type Locale = 'de' | 'fr' | 'it' | 'en';

export interface MailItem {
  id: string;
  category: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  clubName: string | null;
  clubColor: string | null;
}

export interface MailGroup {
  email: string;
  locale: Locale;
  displayName: string | null;
  mode: 'immediate' | 'daily' | 'weekly' | 'off';
  items: MailItem[];
}

export interface RenderOptions {
  /** Öffentliche Adresse der App; ohne sie gibt es keine Links. */
  appUrl: string | null;
  now?: Date;
}

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

const FALLBACK_COLOR = '#795deb';

const LOCALE_TAGS: Record<Locale, string> = {
  de: 'de-CH',
  fr: 'fr-CH',
  it: 'it-CH',
  en: 'en-GB',
};

type Strings = {
  greeting: (name: string | null) => string;
  intro: (count: number, mode: MailGroup['mode']) => string;
  subjectMany: (count: number, club: string | null) => string;
  open: string;
  why: string;
  settings: string;
  from: (club: string) => string;
  categories: Record<string, string>;
};

const STRINGS: Record<Locale, Strings> = {
  de: {
    greeting: (name) => (name ? `Hallo ${name}` : 'Hallo'),
    intro: (count, mode) =>
      count === 1
        ? 'Eine neue Meldung aus deinem Verein:'
        : mode === 'weekly'
          ? `${count} Meldungen aus deinem Verein in dieser Woche:`
          : `${count} neue Meldungen aus deinem Verein:`,
    subjectMany: (count, club) => (club ? `${club}: ${count} neue Meldungen` : `${count} neue Meldungen`),
    open: 'In der App öffnen',
    why: 'Du erhältst diese Mail, weil du in den Benachrichtigungen den E-Mail-Kanal eingeschaltet hast. Die Inbox in der App enthält immer alles.',
    settings: 'Benachrichtigungen einstellen',
    from: (club) => `Von ${club}`,
    categories: {
      event: 'Termin',
      points: 'Punkte',
      task: 'Aufgabe',
      news: 'News',
      pulse: 'Vereins-Puls',
      input: 'Vorschlag',
      system: 'Anschluss',
      join_request: 'Beitritt',
      general: 'Meldung',
    },
  },
  fr: {
    greeting: (name) => (name ? `Bonjour ${name}` : 'Bonjour'),
    intro: (count, mode) =>
      count === 1
        ? 'Un nouveau message de ton club :'
        : mode === 'weekly'
          ? `${count} messages de ton club cette semaine :`
          : `${count} nouveaux messages de ton club :`,
    subjectMany: (count, club) => (club ? `${club} : ${count} nouveaux messages` : `${count} nouveaux messages`),
    open: 'Ouvrir dans l’app',
    why: 'Tu reçois cet e-mail parce que tu as activé le canal e-mail dans les notifications. La boîte de réception de l’app contient toujours tout.',
    settings: 'Régler les notifications',
    from: (club) => `De ${club}`,
    categories: {
      event: 'Rendez-vous',
      points: 'Points',
      task: 'Tâche',
      news: 'Actualité',
      pulse: 'Pouls du club',
      input: 'Proposition',
      system: 'Connexion',
      join_request: 'Adhésion',
      general: 'Message',
    },
  },
  it: {
    greeting: (name) => (name ? `Ciao ${name}` : 'Ciao'),
    intro: (count, mode) =>
      count === 1
        ? 'Un nuovo messaggio dalla tua società:'
        : mode === 'weekly'
          ? `${count} messaggi dalla tua società questa settimana:`
          : `${count} nuovi messaggi dalla tua società:`,
    subjectMany: (count, club) => (club ? `${club}: ${count} nuovi messaggi` : `${count} nuovi messaggi`),
    open: 'Apri nell’app',
    why: 'Ricevi questa e-mail perché hai attivato il canale e-mail nelle notifiche. La posta in arrivo nell’app contiene sempre tutto.',
    settings: 'Impostare le notifiche',
    from: (club) => `Da ${club}`,
    categories: {
      event: 'Appuntamento',
      points: 'Punti',
      task: 'Compito',
      news: 'Notizia',
      pulse: 'Polso della società',
      input: 'Proposta',
      system: 'Collegamento',
      join_request: 'Adesione',
      general: 'Messaggio',
    },
  },
  en: {
    greeting: (name) => (name ? `Hi ${name}` : 'Hi'),
    intro: (count, mode) =>
      count === 1
        ? 'One new message from your club:'
        : mode === 'weekly'
          ? `${count} messages from your club this week:`
          : `${count} new messages from your club:`,
    subjectMany: (count, club) => (club ? `${club}: ${count} new messages` : `${count} new messages`),
    open: 'Open in the app',
    why: 'You receive this email because you switched on the email channel in your notification settings. The inbox in the app always holds everything.',
    settings: 'Notification settings',
    from: (club) => `From ${club}`,
    categories: {
      event: 'Event',
      points: 'Points',
      task: 'Task',
      news: 'News',
      pulse: 'Club pulse',
      input: 'Proposal',
      system: 'Connection',
      join_request: 'Membership',
      general: 'Message',
    },
  },
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Ein Link in die App – nur mit bekannter Adresse, und nur relativ. */
export function appLink(appUrl: string | null, link: string | null): string | null {
  if (!appUrl || !link) return null;
  if (!link.startsWith('/')) return null;
  return appUrl.replace(/\/+$/, '') + link;
}

/** Eine Farbe aus den Vereinseinstellungen, sonst die Grundfarbe. */
export function headerColor(items: MailItem[]): string {
  const color = items.find((item) => item.clubColor)?.clubColor ?? '';
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : FALLBACK_COLOR;
}

/** Der Verein, wenn alle Meldungen aus demselben stammen. */
export function singleClub(items: MailItem[]): string | null {
  const names = new Set(items.map((item) => item.clubName ?? ''));
  if (names.size !== 1) return null;
  return items[0]?.clubName ?? null;
}

function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    timeZone: 'Europe/Zurich',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function subjectFor(group: MailGroup): string {
  const t = STRINGS[group.locale];
  const club = singleClub(group.items);
  if (group.items.length === 1) {
    const title = group.items[0].title;
    return club ? `${club}: ${title}` : title;
  }
  return t.subjectMany(group.items.length, club);
}

export function renderMail(group: MailGroup, options: RenderOptions): RenderedMail {
  const t = STRINGS[group.locale];
  const color = headerColor(group.items);
  const club = singleClub(group.items);
  const year = (options.now ?? new Date()).getFullYear();
  const settingsUrl = appLink(options.appUrl, '/tabs/profile/notifications');
  const brand = club ?? 'myclub';

  const itemsHtml = group.items
    .map((item) => {
      const url = appLink(options.appUrl, item.link);
      const category = t.categories[item.category] ?? t.categories.general;
      const meta = [category, formatTime(item.createdAt, group.locale)];
      if (!club && item.clubName) meta.unshift(item.clubName);
      return `
            <tr>
              <td style="padding: 18px 0; border-top: 1px solid #ebebeb;">
                <p style="margin: 0 0 4px; font-family: Helvetica, Arial, sans-serif; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: #8a8a8a;">${escapeHtml(meta.join(' · '))}</p>
                <p style="margin: 0 0 6px; font-family: Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 700; line-height: 24px; color: #111111;">${escapeHtml(item.title)}</p>
                ${item.body ? `<p style="margin: 0 0 10px; font-family: Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px; color: #444444;">${escapeHtml(item.body)}</p>` : ''}
                ${url ? `<p style="margin: 0;"><a href="${escapeHtml(url)}" style="font-family: Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; color: ${color}; text-decoration: none;">${escapeHtml(t.open)} →</a></p>` : ''}
              </td>
            </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="${group.locale}">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(subjectFor(group))}</title>
</head>
<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">
  <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden;">${escapeHtml(group.items[0]?.title ?? '')}</div>
  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td bgcolor="${color}" align="center" style="padding: 28px 10px 60px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
          <tr>
            <td align="left" style="font-family: Helvetica, Arial, sans-serif; font-size: 14px; letter-spacing: .08em; text-transform: uppercase; color: #ffffff; opacity: .9;">${escapeHtml(brand)}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td bgcolor="#f4f4f4" align="center" style="padding: 0 10px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: -40px;">
          <tr>
            <td bgcolor="#ffffff" align="left" style="padding: 32px 30px 12px; border-radius: 6px 6px 0 0;">
              <p style="margin: 0 0 6px; font-family: Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 700; color: #111111;">${escapeHtml(t.greeting(group.displayName))}</p>
              <p style="margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px; color: #444444;">${escapeHtml(t.intro(group.items.length, group.mode))}</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" align="left" style="padding: 6px 30px 30px; border-radius: 0 0 6px 6px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">${itemsHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td align="left" style="padding: 24px 30px 40px; font-family: Helvetica, Arial, sans-serif; font-size: 13px; line-height: 19px; color: #777777;">
              <p style="margin: 0 0 8px;">${escapeHtml(t.why)}${settingsUrl ? ` <a href="${escapeHtml(settingsUrl)}" style="color: #555555;">${escapeHtml(t.settings)}</a>` : ''}</p>
              <p style="margin: 0;">&reg; myclub | the next generation ${year}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textItems = group.items
    .map((item) => {
      const url = appLink(options.appUrl, item.link);
      const lines = [
        `${t.categories[item.category] ?? t.categories.general} · ${formatTime(item.createdAt, group.locale)}`,
        item.title,
      ];
      if (item.body) lines.push(item.body);
      if (url) lines.push(url);
      return lines.join('\n');
    })
    .join('\n\n');

  const text = [
    t.greeting(group.displayName),
    '',
    t.intro(group.items.length, group.mode),
    '',
    textItems,
    '',
    t.why,
    settingsUrl ?? '',
  ]
    .join('\n')
    .trimEnd();

  return { subject: subjectFor(group), html, text };
}

/**
 * Das Gerüst, in dem **jede** Mail dieser App steht (FR-182).
 *
 * Vorher hatte jede Mailart ihr eigenes Blatt: die Meldungsmail ein
 * Tabellenlayout mit Kopfband (UC-044), die Rechnungsmail ein nacktes `<div>`
 * (UC-046), die Anmeldemail gar keines – sie kam aus der Standardvorlage von
 * GoTrue. Drei Absender für einen Verein.
 *
 * Hier steht das Blatt einmal: Kopfband in der Vereinsfarbe, das Logo, wenn
 * eines hinterlegt ist, 600 px Breite, Fusszeile mit dem Grund der Zustellung.
 * Die Mailarten liefern nur noch ihre Abschnitte.
 *
 * **Reine Funktionen, keine Abhängigkeiten.** Das Modul liegt in `_shared`,
 * wird also in jede Function hineingebündelt und läuft unter `deno test`.
 *
 * Zwei Regeln, die hier und nicht in den Aufrufern stehen:
 *
 * * **Jeder eingesetzte Wert wird maskiert.** Vereinsnamen, Titel und Namen
 *   kommen aus der Datenbank, die Farbe und die Logoadresse aus den
 *   Vereinseinstellungen, die Sprache aus dem Konto – nichts davon ist
 *   vertrauenswürdig genug, um ungeprüft in HTML zu landen.
 * * **Jede Mail sagt, warum sie kommt.** `footnote` ist Pflicht, nicht
 *   Zierrat: Eine Mail ohne Grund ist eine Mail, die abbestellt wird.
 */

export type Locale = 'de' | 'fr' | 'it' | 'en';

export const LOCALES: readonly Locale[] = ['de', 'fr', 'it', 'en'];

/**
 * Die Grundfarbe der App – der Rückfall, wenn ein Verein keine gesetzt hat.
 * Nicht exportiert: Wer sie braucht, geht über `brandColor()`, sonst stünde
 * die Entscheidung «Farbe oder Rückfall» an zwei Stellen.
 */
const FALLBACK_COLOR = '#795deb';

export const LOCALE_TAGS: Record<Locale, string> = {
  de: 'de-CH',
  fr: 'fr-CH',
  it: 'it-CH',
  en: 'en-GB',
};

/** Die Absenderidentität einer Mail: Verein, Farbe, Logo. */
export interface MailBrand {
  clubName: string | null;
  color: string | null;
  logoUrl: string | null;
}

/** Ein Abschnitt im Blatt – die Mailart baut ihn, das Gerüst rahmt ihn. */
export interface MailSection {
  html: string;
  text: string;
}

export interface ShellInput {
  brand: MailBrand;
  locale: Locale;
  /** Der Betreff; steht auch im `<title>`. */
  subject: string;
  /** Die Vorschauzeile der Postfach-Liste. */
  preheader: string;
  /** Die Anrede; fehlt sie, beginnt das Blatt mit dem ersten Abschnitt. */
  greeting?: string | null;
  sections: MailSection[];
  /** Warum diese Mail kommt. Pflicht. */
  footnote: string;
  footnoteLink?: { label: string; url: string } | null;
  year: number;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Eine Adresse, die in ein `href` oder `src` darf.
 *
 * Nur `https:` – `javascript:` und `data:` sind in Mailprogrammen wirkungslos
 * bis gefährlich, und eine Logoadresse kommt aus einem Feld, das der Vorstand
 * füllt. `http:` fällt weg, weil ein Bild ohne TLS in jedem modernen Client
 * blockiert wird und die Mail nur beschädigt aussehen lässt.
 */
export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Ein Link in die App – nur mit bekannter Adresse, und nur relativ. */
export function appLink(appUrl: string | null, link: string | null): string | null {
  if (!appUrl || !link) return null;
  if (!link.startsWith('/')) return null;
  return appUrl.replace(/\/+$/, '') + link;
}

/** Die Vereinsfarbe, wenn sie eine ist; sonst die Grundfarbe. */
export function brandColor(color: string | null | undefined): string {
  return /^#[0-9a-fA-F]{6}$/.test(color ?? '') ? (color as string).toLowerCase() : FALLBACK_COLOR;
}

/**
 * Schrift auf dem Kopfband: weiss oder dunkel.
 *
 * Ein Verein mit einer hellen Farbe (Gelb, Hellgrün) bekäme sonst weisse
 * Schrift auf hellem Grund – das Kopfband wäre leer. Die Schwelle ist die
 * relative Helligkeit nach WCAG; ab 0.5 ist Dunkel die bessere Wahl.
 */
export function onBrand(color: string): string {
  const hex = color.replace('#', '');
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
}

// --- Abschnitte -------------------------------------------------------------

const FONT = 'Helvetica, Arial, sans-serif';

export function paragraph(text: string): MailSection {
  return {
    html: `<p style="margin: 0 0 14px; font-family: ${FONT}; font-size: 16px; line-height: 24px; color: #444444;">${escapeHtml(text)}</p>`,
    text,
  };
}

export function heading(text: string): MailSection {
  return {
    html: `<p style="margin: 22px 0 10px; font-family: ${FONT}; font-size: 17px; font-weight: 700; line-height: 24px; color: #111111;">${escapeHtml(text)}</p>`,
    text: `\n${text}`,
  };
}

/**
 * Das Warum – die Zeile, die eine Meldung von einer Anweisung unterscheidet
 * (FR-183). Abgesetzt durch einen Balken in der Vereinsfarbe, damit sie beim
 * Überfliegen nicht als Nebensatz untergeht.
 */
export function whyLine(label: string, text: string, color: string): MailSection {
  return {
    html: `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 14px;"><tr>
                  <td width="3" bgcolor="${color}" style="width: 3px; line-height: 1px; font-size: 1px;">&nbsp;</td>
                  <td style="padding: 2px 0 2px 12px; font-family: ${FONT}; font-size: 15px; line-height: 22px; color: #555555;"><strong style="color: #333333;">${escapeHtml(label)}</strong> ${escapeHtml(text)}</td>
                </tr></table>`,
    text: `${label} ${text}`,
  };
}

/** Beschriftete Werte – Betrag, Fälligkeit, Referenz. */
export function facts(rows: [string, string][]): MailSection {
  const html = rows
    .map(
      ([label, value]) => `<tr>
                  <td style="padding: 5px 16px 5px 0; font-family: ${FONT}; font-size: 15px; line-height: 22px; color: #777777; white-space: nowrap;">${escapeHtml(label)}</td>
                  <td style="padding: 5px 0; font-family: ${FONT}; font-size: 15px; line-height: 22px; color: #111111; font-weight: 700;">${escapeHtml(value)}</td>
                </tr>`,
    )
    .join('');
  return {
    html: `<table border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 16px;">${html}
              </table>`,
    text: rows.map(([label, value]) => `${label}: ${value}`).join('\n'),
  };
}

/**
 * Die Schaltfläche.
 *
 * Als Tabelle und nicht als gestyltes `<a>`: Outlook rendert ein Blockelement
 * mit Innenabstand nicht, eine Tabellenzelle schon. Der Textteil trägt die
 * nackte Adresse, weil ein Klick dort nichts anzuklicken hat.
 */
export function button(label: string, url: string, color: string): MailSection {
  const safe = safeUrl(url);
  if (!safe) return { html: '', text: '' };
  return {
    html: `<table border="0" cellpadding="0" cellspacing="0" style="margin: 6px 0 18px;"><tr>
                  <td bgcolor="${color}" style="border-radius: 6px;">
                    <a href="${escapeHtml(safe)}" style="display: inline-block; padding: 13px 26px; font-family: ${FONT}; font-size: 16px; font-weight: 700; color: ${onBrand(color)}; text-decoration: none; border-radius: 6px;">${escapeHtml(label)}</a>
                  </td>
                </tr></table>`,
    text: `${label}: ${safe}`,
  };
}

/**
 * Die Adresse zum Kopieren – unter einer Schaltfläche, die dasselbe Ziel hat.
 *
 * Eine Schaltfläche lässt sich antippen, aber nicht markieren. Wer die Mail
 * auf dem einen Gerät liest und sich auf dem anderen anmelden will, braucht
 * die Adresse als Text. Deshalb steht sie hier ausgeschrieben – in einem
 * Kasten, damit sie nicht wie ein Satz gelesen wird, und mit
 * `word-break: break-all`, damit kein Mailprogramm sie am Rand abschneidet.
 *
 * Der Textteil setzt die Adresse auf eine **eigene** Zeile: Steht sie hinter
 * einem Doppelpunkt, hängen manche Programme das Satzzeichen an den Link.
 */
export function copyLink(label: string, url: string): MailSection {
  const safe = safeUrl(url);
  if (!safe) return { html: '', text: '' };
  return {
    html: `<p style="margin: 0 0 6px; font-family: ${FONT}; font-size: 14px; line-height: 20px; color: #777777;">${escapeHtml(label)}</p>
              <p style="margin: 0 0 18px; padding: 10px 12px; background-color: #f6f6f6; border: 1px solid #e6e6e6; border-radius: 6px; font-family: ${FONT}; font-size: 13px; line-height: 19px; color: #555555; word-break: break-all;"><a href="${escapeHtml(safe)}" style="color: #555555; text-decoration: none;">${escapeHtml(safe)}</a></p>`,
    text: `${label}\n${safe}`,
  };
}

/** Ein Link als Zeile, für alles, was keine Schaltfläche verdient. */
export function linkLine(label: string, url: string, color: string): MailSection {
  const safe = safeUrl(url);
  if (!safe) return { html: '', text: '' };
  return {
    html: `<p style="margin: 0 0 14px;"><a href="${escapeHtml(safe)}" style="font-family: ${FONT}; font-size: 15px; font-weight: 700; color: ${color}; text-decoration: none;">${escapeHtml(label)} &rarr;</a></p>`,
    text: `${label}: ${safe}`,
  };
}

/** Eine nummerierte Übersicht – die Schritte der Willkommensmail. */
export function steps(items: { title: string; body: string }[], color: string): MailSection {
  const html = items
    .map(
      (item, index) => `<tr>
                  <td valign="top" width="30" style="padding: 0 12px 16px 0; font-family: ${FONT}; font-size: 16px; font-weight: 700; line-height: 22px; color: ${color};">${index + 1}.</td>
                  <td valign="top" style="padding: 0 0 16px;">
                    <p style="margin: 0 0 2px; font-family: ${FONT}; font-size: 16px; font-weight: 700; line-height: 22px; color: #111111;">${escapeHtml(item.title)}</p>
                    <p style="margin: 0; font-family: ${FONT}; font-size: 15px; line-height: 22px; color: #555555;">${escapeHtml(item.body)}</p>
                  </td>
                </tr>`,
    )
    .join('');
  return {
    html: `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 4px 0 6px;">${html}
              </table>`,
    text: items.map((item, index) => `${index + 1}. ${item.title}\n   ${item.body}`).join('\n'),
  };
}

/** Eine Meldung in der Liste der Meldungsmail. */
export function notice(input: {
  meta: string;
  title: string;
  body: string | null;
  why: MailSection | null;
  url: string | null;
  openLabel: string;
  color: string;
  first: boolean;
}): MailSection {
  const link = input.url ? linkLine(input.openLabel, input.url, input.color) : null;
  return {
    html: `<table border="0" cellpadding="0" cellspacing="0" width="100%"><tr>
                  <td style="padding: ${input.first ? '0 0 18px' : '18px 0'}; ${input.first ? '' : 'border-top: 1px solid #ebebeb;'}">
                    <p style="margin: 0 0 4px; font-family: ${FONT}; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: #8a8a8a;">${escapeHtml(input.meta)}</p>
                    <p style="margin: 0 0 6px; font-family: ${FONT}; font-size: 18px; font-weight: 700; line-height: 24px; color: #111111;">${escapeHtml(input.title)}</p>
                    ${input.body ? `<p style="margin: 0 0 12px; font-family: ${FONT}; font-size: 16px; line-height: 24px; color: #444444;">${escapeHtml(input.body)}</p>` : ''}
                    ${input.why ? input.why.html : ''}
                    ${link ? link.html : ''}
                  </td>
                </tr></table>`,
    text: [input.meta, input.title, input.body ?? '', input.why?.text ?? '', link?.text ?? '']
      .filter((line) => line !== '')
      .join('\n'),
  };
}

// --- Das Blatt --------------------------------------------------------------

/**
 * Das Kopfband: Logo, wenn eines hinterlegt ist, darunter der Vereinsname.
 *
 * Der Name steht **auch dann**, wenn ein Logo da ist. Die meisten
 * Mailprogramme laden Bilder erst auf Klick; ohne die Zeile wäre das Band bei
 * der ersten Ansicht leer.
 */
function bandHtml(brand: MailBrand, color: string): string {
  const ink = onBrand(color);
  const logo = safeUrl(brand.logoUrl);
  const name = brand.clubName ?? 'myclub';
  const logoHtml = logo
    ? `<tr><td align="left" style="padding: 0 0 12px;"><img src="${escapeHtml(logo)}" alt="${escapeHtml(name)}" height="40" style="height: 40px; max-height: 40px; width: auto; border: 0; display: block;"></td></tr>`
    : '';
  return `${logoHtml}<tr><td align="left" style="font-family: ${FONT}; font-size: 14px; letter-spacing: .08em; text-transform: uppercase; color: ${ink};">${escapeHtml(name)}</td></tr>`;
}

export function renderShell(input: ShellInput): { html: string; text: string } {
  const color = brandColor(input.brand.color);
  const body = input.sections.filter((section) => section.html !== '' || section.text !== '');

  const html = `<!DOCTYPE html>
<html lang="${input.locale}">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.subject)}</title>
</head>
<body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">
  <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden;">${escapeHtml(input.preheader)}</div>
  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td bgcolor="${color}" align="center" style="padding: 28px 10px 60px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
          ${bandHtml(input.brand, color)}
        </table>
      </td>
    </tr>
    <tr>
      <td bgcolor="#f4f4f4" align="center" style="padding: 0 10px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: -40px;">
          <tr>
            <td bgcolor="#ffffff" align="left" style="padding: 32px 30px 24px; border-radius: 6px;">
              ${input.greeting ? `<p style="margin: 0 0 14px; font-family: ${FONT}; font-size: 20px; font-weight: 700; color: #111111;">${escapeHtml(input.greeting)}</p>` : ''}
              ${body.map((section) => section.html).join('\n              ')}
            </td>
          </tr>
          <tr>
            <td align="left" style="padding: 24px 30px 40px; font-family: ${FONT}; font-size: 13px; line-height: 19px; color: #777777;">
              <p style="margin: 0 0 8px;">${escapeHtml(input.footnote)}${
                input.footnoteLink && safeUrl(input.footnoteLink.url)
                  ? ` <a href="${escapeHtml(safeUrl(input.footnoteLink.url)!)}" style="color: #555555;">${escapeHtml(input.footnoteLink.label)}</a>`
                  : ''
              }</p>
              <p style="margin: 0;">&reg; myclub | the next generation ${input.year}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    input.greeting ?? '',
    '',
    ...body.map((section) => section.text),
    '',
    input.footnote,
    input.footnoteLink ? (safeUrl(input.footnoteLink.url) ?? '') : '',
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { html, text };
}

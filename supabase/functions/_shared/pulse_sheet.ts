/**
 * Das Blatt des Vereins-Pulses (UC-050, FR-188).
 *
 * **Warum es hier steht und nicht in `send-mail`:** Zwei Wege brauchen es –
 * der Versandlauf und die Vorschau, mit der der Vorstand vor der Freigabe
 * sieht, was ankommt (FR-189). Zwei Abschriften desselben Blatts würden
 * auseinanderlaufen, und dann zeigte die Vorschau etwas, das niemand bekommt.
 *
 * **Was es nicht tut:** Es entscheidet nicht, wer etwas sehen darf. Die
 * Nutzlast kommt aus `pulse_payload()`, und die Policy aus `0044` hat dort
 * schon entschieden.
 *
 * **BR-248:** Dieselben drei Abschnitte in derselben Reihenfolge wie in der
 * App (BR-113). Der persönliche Punktestand steht **nicht** im Blatt – er
 * gehört einer Person und die Mail geht an alle; wer ihn sehen will, öffnet
 * die App, wo er nach den Abschnitten steht (BR-114).
 */

import {
  brandColor,
  button,
  escapeHtml,
  heading,
  LOCALE_TAGS,
  paragraph,
  renderShell,
  safeUrl,
  type Locale,
  type MailBrand,
  type MailSection,
} from './mail.ts';

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Die Abschnitte in fester Reihenfolge (BR-113). */
export const PULSE_SECTIONS = ['happening', 'workingOn', 'joinIn'] as const;
export type PulseSection = (typeof PULSE_SECTIONS)[number];

export interface PulseSheetItem {
  kind: 'event' | 'task' | 'shift' | 'decision' | 'news';
  id: string;
  title: string;
  at: string | null;
  detail: string | null;
  /** Nur bei Beiträgen von der Website: die Adresse ausserhalb der App. */
  url?: string | null;
}

export interface PulseSheetGreeting {
  text: string | null;
  office: string | null;
  names: string[];
  imageUrl: string | null;
}

export interface PulseSheetPayload {
  pulseId: string;
  intro: string | null;
  sections: Record<PulseSection, PulseSheetItem[]>;
  greeting: PulseSheetGreeting | null;
}

export interface PulseSheetInput {
  brand: MailBrand;
  locale: Locale;
  /** Die Anrede – der Name der Empfängerin, wenn einer bekannt ist. */
  displayName: string | null;
  payload: PulseSheetPayload;
  /** Öffentliche Adresse der App; ohne sie gibt es keinen Knopf. */
  appUrl: string | null;
  /** Warum diese Mail kommt – Pflicht, wie in jedem Blatt (FR-183). */
  footnote: string;
  footnoteLink?: { label: string; url: string } | null;
  now?: Date;
}

type Strings = {
  greeting: (name: string | null) => string;
  subject: (club: string | null) => string;
  preheader: string;
  sections: Record<PulseSection, string>;
  kinds: Record<PulseSheetItem['kind'], string>;
  open: string;
  readOnSite: string;
  noDate: string;
  /** A2: Das Amt ist vakant – es grüsst der Vorstand. */
  board: string;
};

const STRINGS: Record<Locale, Strings> = {
  de: {
    greeting: (name) => (name ? `Hallo ${name}` : 'Hallo'),
    subject: (club) => (club ? `${club}: Vereins-Puls` : 'Vereins-Puls'),
    preheader: 'Was passiert, woran wir arbeiten, wo du dabei sein kannst.',
    sections: {
      happening: 'Was passiert',
      workingOn: 'Woran wir arbeiten',
      joinIn: 'Wo du dabei sein kannst',
    },
    kinds: {
      event: 'Termin',
      task: 'Aufgabe',
      shift: 'Schicht',
      decision: 'Aus dem Vorstand',
      news: 'Beitrag',
    },
    open: 'In der App öffnen',
    readOnSite: 'Auf der Website lesen',
    noDate: 'ohne Datum',
    board: 'Der Vorstand',
  },
  fr: {
    greeting: (name) => (name ? `Bonjour ${name}` : 'Bonjour'),
    subject: (club) => (club ? `${club} : pouls du club` : 'Pouls du club'),
    preheader: 'Ce qui se passe, ce sur quoi nous travaillons, où tu peux participer.',
    sections: {
      happening: 'Ce qui se passe',
      workingOn: 'Ce sur quoi nous travaillons',
      joinIn: 'Où tu peux participer',
    },
    kinds: {
      event: 'Rendez-vous',
      task: 'Tâche',
      shift: 'Créneau',
      decision: 'Du comité',
      news: 'Actualité',
    },
    open: 'Ouvrir dans l’app',
    readOnSite: 'Lire sur le site',
    noDate: 'sans date',
    board: 'Le comité',
  },
  it: {
    greeting: (name) => (name ? `Ciao ${name}` : 'Ciao'),
    subject: (club) => (club ? `${club}: polso della società` : 'Polso della società'),
    preheader: 'Che cosa succede, a che cosa stiamo lavorando, dove puoi esserci.',
    sections: {
      happening: 'Che cosa succede',
      workingOn: 'A che cosa stiamo lavorando',
      joinIn: 'Dove puoi esserci',
    },
    kinds: {
      event: 'Appuntamento',
      task: 'Compito',
      shift: 'Turno',
      decision: 'Dal comitato',
      news: 'Contributo',
    },
    open: 'Apri nell’app',
    readOnSite: 'Leggi sul sito',
    noDate: 'senza data',
    board: 'Il comitato',
  },
  en: {
    greeting: (name) => (name ? `Hi ${name}` : 'Hi'),
    subject: (club) => (club ? `${club}: club pulse` : 'Club pulse'),
    preheader: 'What is happening, what we are working on, where you can join in.',
    sections: {
      happening: 'What is happening',
      workingOn: 'What we are working on',
      joinIn: 'Where you can join in',
    },
    kinds: {
      event: 'Event',
      task: 'Task',
      shift: 'Shift',
      decision: 'From the board',
      news: 'Post',
    },
    open: 'Open in the app',
    readOnSite: 'Read on the website',
    noDate: 'no date',
    board: 'The board',
  },
};

function formatWhen(iso: string | null, locale: Locale, fallback: string): string {
  if (!iso) return fallback;
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    timeZone: 'Europe/Zurich',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/**
 * Die Einträge eines Abschnitts – eine Zeile je Eintrag, Titel und darunter
 * die Einordnung. Bewusst schlanker als `notice()`: Ein Puls trägt bis zu
 * zwanzig Zeilen, und zwanzig umrandete Kästen sind eine Wand.
 */
export function pulseItems(
  items: PulseSheetItem[],
  locale: Locale,
  color: string,
): MailSection {
  const t = STRINGS[locale];

  const rows = items
    .map((item) => {
      const meta = [t.kinds[item.kind] ?? t.kinds.news, formatWhen(item.at, locale, t.noDate)];
      if (item.detail) meta.push(item.detail);
      // A7: Nur ein Beitrag von der Website führt nach draussen – und das
      // steht dran, damit der Absprung nicht wie ein Fehler wirkt.
      const external = item.kind === 'news' ? safeUrl(item.url ?? null) : null;
      return `<tr>
                  <td valign="top" width="3" bgcolor="${color}" style="width: 3px; line-height: 1px; font-size: 1px;">&nbsp;</td>
                  <td valign="top" style="padding: 0 0 14px 12px;">
                    <p style="margin: 0 0 2px; font-family: ${FONT}; font-size: 16px; font-weight: 700; line-height: 22px; color: #111111;">${escapeHtml(item.title)}</p>
                    <p style="margin: 0; font-family: ${FONT}; font-size: 14px; line-height: 20px; color: #777777;">${escapeHtml(meta.join(' · '))}</p>
                    ${external ? `<p style="margin: 4px 0 0; font-family: ${FONT}; font-size: 14px; line-height: 20px;"><a href="${external}" style="color: ${color};">${escapeHtml(t.readOnSite)}</a></p>` : ''}
                  </td>
                </tr>`;
    })
    .join('');

  return {
    html: `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 8px;">${rows}
              </table>`,
    text: items
      .map((item) => {
        const meta = [t.kinds[item.kind] ?? t.kinds.news, formatWhen(item.at, locale, t.noDate)];
        if (item.detail) meta.push(item.detail);
        const external = item.kind === 'news' ? safeUrl(item.url ?? null) : null;
        return `– ${item.title} (${meta.join(' · ')})${external ? `\n  ${external}` : ''}`;
      })
      .join('\n'),
  };
}

/**
 * Der Gruss am Fuss (FR-191, FR-192).
 *
 * **Name und Amt sind Text, nicht Bildinhalt** (BR-254). Die meisten
 * Postfächer laden Bilder erst auf Klick; ein Gruss, der nur als Bild
 * existierte, käme bei der Mehrheit nicht an. Das Porträt steht deshalb
 * daneben und trägt nichts, was nicht auch geschrieben dasteht.
 */
export function pulseSignature(
  greeting: PulseSheetGreeting,
  locale: Locale,
  color: string,
): MailSection | null {
  const t = STRINGS[locale];
  const text = greeting.text?.trim() ?? '';
  const names = greeting.names.map((name) => name.trim()).filter((name) => name.length > 0);
  const office = greeting.office?.trim() ?? '';
  if (!text && names.length === 0 && !office) return null;

  // A2: vakantes Amt – der Vorstand grüsst, und das Porträt fällt weg.
  const signer = names.length > 0 ? names.join(', ') : t.board;
  const image = names.length > 0 ? safeUrl(greeting.imageUrl) : null;

  const lines = `${text ? `<p style="margin: 0 0 8px; font-family: ${FONT}; font-size: 16px; line-height: 24px; color: #444444;">${escapeHtml(text)}</p>` : ''}
                    <p style="margin: 0; font-family: ${FONT}; font-size: 16px; font-weight: 700; line-height: 22px; color: #111111;">${escapeHtml(signer)}</p>
                    ${office ? `<p style="margin: 0; font-family: ${FONT}; font-size: 14px; line-height: 20px; color: #777777;">${escapeHtml(office)}</p>` : ''}`;

  return {
    html: `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 22px 0 0; border-top: 1px solid #ebebeb;"><tr>
                  ${image ? `<td valign="top" width="64" style="padding: 18px 14px 0 0;"><img src="${image}" width="56" height="56" alt="" style="display: block; width: 56px; height: 56px; border-radius: 28px; border: 1px solid ${color};"></td>` : ''}
                  <td valign="top" style="padding: 18px 0 0;">${lines}
                  </td>
                </tr></table>`,
    text: [text, signer, office].filter((line) => line !== '').join('\n'),
  };
}

export function pulseSubject(locale: Locale, club: string | null): string {
  return STRINGS[locale].subject(club);
}

/** Das ganze Blatt. */
export function renderPulseSheet(input: PulseSheetInput): {
  subject: string;
  html: string;
  text: string;
} {
  const t = STRINGS[input.locale];
  const color = brandColor(input.brand.color);
  const sections: MailSection[] = [];

  // Der Einleitungssatz des Vorstands – freiwillig, deshalb ohne Überschrift.
  const intro = input.payload.intro?.trim();
  if (intro) sections.push(paragraph(intro));

  for (const section of PULSE_SECTIONS) {
    const items = input.payload.sections[section] ?? [];
    if (items.length === 0) continue;
    sections.push(heading(t.sections[section]));
    sections.push(pulseItems(items, input.locale, color));
  }

  const link = input.appUrl
    ? safeUrl(`${input.appUrl.replace(/\/$/, '')}/tabs/pulse/${input.payload.pulseId}`)
    : null;
  if (link) sections.push(button(t.open, link, color));

  const signature = input.payload.greeting
    ? pulseSignature(input.payload.greeting, input.locale, color)
    : null;
  if (signature) sections.push(signature);

  const subject = pulseSubject(input.locale, input.brand.clubName);
  const shell = renderShell({
    brand: input.brand,
    locale: input.locale,
    subject,
    preheader: intro || t.preheader,
    greeting: t.greeting(input.displayName),
    sections,
    footnote: input.footnote,
    footnoteLink: input.footnoteLink ?? null,
    year: (input.now ?? new Date()).getFullYear(),
  });

  return { subject, ...shell };
}

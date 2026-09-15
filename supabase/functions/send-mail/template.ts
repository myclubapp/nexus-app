/**
 * Die Mail aus den Meldungen (UC-044, UC-048) – reine Funktionen,
 * `deno test` in diesem Ordner.
 *
 * Das Blatt selbst steht seit UC-048 in `_shared/mail.ts` und ist für jede
 * Mailart dasselbe: Kopfband in der Vereinsfarbe, das Logo, wenn eines
 * hinterlegt ist, Fusszeile mit dem Grund der Zustellung. Hier stehen nur noch
 * die Texte – in den vier Sprachen der App – und die Entscheidung, welches
 * Blatt eine Zeile bekommt.
 *
 * Drei Formen aus derselben Funktion:
 *   * **eine** Meldung (sofort oder dringend),
 *   * die **Zusammenfassung** (täglich oder wöchentlich),
 *   * das **Willkommensblatt** (FR-184) – die einzige Zeile, die ein eigenes
 *     Blatt trägt, erkennbar an `template = 'welcome'`.
 *
 * **Das Warum (FR-183).** Jede Meldung trägt es mit: entweder ihr eigenes –
 * das `why` der Aufgabe, des Amts, des Termins – oder den Standardsatz ihrer
 * Kategorie. Der eigene Satz steht immer; der Standardsatz nur, wenn die Mail
 * **eine** Meldung trägt: In einer Zusammenfassung mit zwölf Zeilen wäre
 * zwölfmal derselbe Satz Lärm, und die Kategorie steht ohnehin über jeder
 * Zeile.
 *
 * Die Standardsätze stehen hier **und** in `src/i18n/locales/*.json`
 * (`notifications.why.*`) für die Inbox. Eine Edge Function hat keinen Zugang
 * zu den Sprachdateien der App; dieselbe Trennung wie bei `invoice-run/mail.ts`.
 * Wer einen Satz ändert, ändert ihn an beiden Stellen.
 */

import {
  appLink,
  brandColor,
  button,
  heading,
  linkLine,
  LOCALE_TAGS,
  notice,
  paragraph,
  renderShell,
  steps,
  whyLine,
  type Locale,
  type MailBrand,
  type MailSection,
} from '../_shared/mail.ts';

export { appLink };
export type { Locale };

export interface MailItem {
  id: string;
  category: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  /** Das Warum dieser Meldung, wenn der Auslöser eines mitgegeben hat. */
  why: string | null;
  /** Ein eigenes Blatt statt der Meldungsliste, z.B. `welcome`. */
  template: string | null;
  clubName: string | null;
  clubColor: string | null;
  clubLogo: string | null;
  /** Das Warum des Vereins selbst (`clubs.settings.dna.why`, FR-114). */
  clubWhy: string | null;
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
  /** Die Website, auf der die Einzelheiten stehen (FR-184). */
  helpUrl?: string | null;
  now?: Date;
}

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

type Strings = {
  greeting: (name: string | null) => string;
  intro: (count: number, mode: MailGroup['mode']) => string;
  subjectMany: (count: number, club: string | null) => string;
  open: string;
  whyLabel: string;
  channelWhy: string;
  settings: string;
  categories: Record<string, string>;
  /** Der Standardsatz je Kategorie – das Warum, wenn keines mitkam. */
  categoryWhy: Record<string, string>;
  welcome: {
    intro: (club: string) => string;
    clubWhyLabel: string;
    how: string;
    steps: { title: string; body: string }[];
    whyHeading: string;
    why: string;
    open: string;
    more: string;
    footnote: (club: string) => string;
  };
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
    whyLabel: 'Warum:',
    channelWhy:
      'Du erhältst diese Mail, weil du in den Benachrichtigungen den E-Mail-Kanal eingeschaltet hast. Die Inbox in der App enthält immer alles.',
    settings: 'Benachrichtigungen einstellen',
    categories: {
      event: 'Termin',
      points: 'Punkte',
      task: 'Aufgabe',
      news: 'News',
      pulse: 'Vereins-Puls',
      input: 'Vorschlag',
      system: 'Anschluss',
      join_request: 'Beitritt',
      invoice: 'Rechnung',
      general: 'Meldung',
    },
    categoryWhy: {
      event: 'Der Verein plant mit deiner Antwort – auch ein Nein hilft.',
      points: 'Damit du siehst, wofür dein Beitrag gezählt hat.',
      task: 'Weil der Verein für diese Arbeit Hände braucht.',
      news: 'Damit du weisst, was im Verein läuft.',
      pulse: 'Die Woche des Vereins auf einen Blick – damit niemand raten muss.',
      input: 'Damit du siehst, was aus deinem Anliegen geworden ist.',
      system: 'Es betrifft deinen Zugang zur App.',
      join_request: 'Es betrifft deine Mitgliedschaft.',
      invoice: 'Die Beiträge tragen den Vereinsbetrieb.',
      general: 'Aus deinem Verein.',
    },
    welcome: {
      intro: (club) =>
        `schön, bist du da. ${club} führt den Verein mit myclub. Hier die Übersicht in einer Minute – die Einzelheiten kannst du später nachlesen.`,
      clubWhyLabel: 'Darum gibt es uns:',
      how: 'So funktioniert es',
      steps: [
        {
          title: 'Zusagen oder absagen',
          body: 'Jeder Termin fragt dich, ob du kommst. Deine Antwort ist die Planungsgrundlage – auch ein Nein hilft weiter als ein Schweigen.',
        },
        {
          title: 'Mithelfen, wo es passt',
          body: 'Aufgaben, Schichten und Ämter stehen offen und nennen immer, wozu sie dienen und wem sie helfen. Du wählst, was zu dir passt.',
        },
        {
          title: 'Punkte kommen von selbst',
          body: 'Für jeden Beitrag schreibt der Verein Punkte gut – automatisch, ohne dass du etwas melden musst.',
        },
        {
          title: 'Dein Beitrag über die Saison',
          body: 'Die Übersicht zeigt, wo du stehst. Sie misst deinen eigenen Weg, nicht den Abstand zu anderen.',
        },
        {
          title: 'Alles in der Inbox',
          body: 'Jede Meldung landet dort. Ob sie zusätzlich per E-Mail kommt und wie oft, entscheidest du in den Einstellungen.',
        },
      ],
      whyHeading: 'Warum das Ganze',
      why: 'Vereinsarbeit verteilt sich auf wenige Schultern, weil niemand sieht, wer was tut. Wird es sichtbar, lässt es sich teilen – das ist der ganze Gedanke dahinter.',
      open: 'App öffnen',
      more: 'Alle Einzelheiten auf der Website',
      footnote: (club) => `Du erhältst diese Mail einmalig, weil du ${club} beigetreten bist.`,
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
    whyLabel: 'Pourquoi :',
    channelWhy:
      'Tu reçois cet e-mail parce que tu as activé le canal e-mail dans les notifications. La boîte de réception de l’app contient toujours tout.',
    settings: 'Régler les notifications',
    categories: {
      event: 'Rendez-vous',
      points: 'Points',
      task: 'Tâche',
      news: 'Actualité',
      pulse: 'Pouls du club',
      input: 'Proposition',
      system: 'Connexion',
      join_request: 'Adhésion',
      invoice: 'Facture',
      general: 'Message',
    },
    categoryWhy: {
      event: 'Le club planifie avec ta réponse – même un non fait avancer.',
      points: 'Pour que tu voies ce que ta contribution a compté.',
      task: 'Parce que le club a besoin de bras pour ce travail.',
      news: 'Pour que tu saches ce qui se passe au club.',
      pulse: 'La semaine du club en un coup d’œil – pour que personne ne devine.',
      input: 'Pour que tu voies ce qu’est devenue ta demande.',
      system: 'Cela concerne ton accès à l’app.',
      join_request: 'Cela concerne ton adhésion.',
      invoice: 'Les cotisations font vivre le club.',
      general: 'De ton club.',
    },
    welcome: {
      intro: (club) =>
        `content que tu sois là. ${club} gère son club avec myclub. Voici l’essentiel en une minute – les détails se lisent plus tard.`,
      clubWhyLabel: 'Notre raison d’être :',
      how: 'Comment ça marche',
      steps: [
        {
          title: 'Confirmer ou décliner',
          body: 'Chaque rendez-vous te demande si tu viens. Ta réponse est la base de la planification – un non aide plus qu’un silence.',
        },
        {
          title: 'Donner un coup de main',
          body: 'Tâches, créneaux et fonctions sont ouverts et disent toujours à quoi ils servent et à qui ils profitent. Tu choisis ce qui te convient.',
        },
        {
          title: 'Les points viennent tout seuls',
          body: 'Le club crédite des points pour chaque contribution – automatiquement, sans que tu aies à l’annoncer.',
        },
        {
          title: 'Ta contribution sur la saison',
          body: 'L’aperçu montre où tu en es. Il mesure ton propre chemin, pas l’écart avec les autres.',
        },
        {
          title: 'Tout dans la boîte de réception',
          body: 'Chaque message y arrive. C’est toi qui décides s’il part aussi par e-mail, et à quelle fréquence.',
        },
      ],
      whyHeading: 'Pourquoi tout cela',
      why: 'Le travail associatif repose sur quelques épaules parce que personne ne voit qui fait quoi. Rendu visible, il peut se partager – c’est toute l’idée.',
      open: 'Ouvrir l’app',
      more: 'Tous les détails sur le site',
      footnote: (club) => `Tu reçois cet e-mail une seule fois, parce que tu as rejoint ${club}.`,
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
    whyLabel: 'Perché:',
    channelWhy:
      'Ricevi questa e-mail perché hai attivato il canale e-mail nelle notifiche. La posta in arrivo nell’app contiene sempre tutto.',
    settings: 'Impostare le notifiche',
    categories: {
      event: 'Appuntamento',
      points: 'Punti',
      task: 'Compito',
      news: 'Notizia',
      pulse: 'Polso della società',
      input: 'Proposta',
      system: 'Collegamento',
      join_request: 'Adesione',
      invoice: 'Fattura',
      general: 'Messaggio',
    },
    categoryWhy: {
      event: 'La società pianifica con la tua risposta – anche un no aiuta.',
      points: 'Perché tu veda per cosa è valso il tuo contributo.',
      task: 'Perché per questo lavoro la società ha bisogno di mani.',
      news: 'Perché tu sappia cosa succede nella società.',
      pulse: 'La settimana della società a colpo d’occhio – così nessuno deve indovinare.',
      input: 'Perché tu veda che ne è stato della tua proposta.',
      system: 'Riguarda il tuo accesso all’app.',
      join_request: 'Riguarda la tua adesione.',
      invoice: 'Le quote sostengono la società.',
      general: 'Dalla tua società.',
    },
    welcome: {
      intro: (club) =>
        `bello che ci sei. ${club} gestisce la società con myclub. Ecco il quadro in un minuto – i dettagli si leggono dopo.`,
      clubWhyLabel: 'Per questo esistiamo:',
      how: 'Come funziona',
      steps: [
        {
          title: 'Confermare o disdire',
          body: 'Ogni appuntamento ti chiede se vieni. La tua risposta è la base della pianificazione – anche un no aiuta più di un silenzio.',
        },
        {
          title: 'Dare una mano',
          body: 'Compiti, turni e cariche sono aperti e dicono sempre a cosa servono e a chi giovano. Scegli ciò che ti si addice.',
        },
        {
          title: 'I punti arrivano da soli',
          body: 'Per ogni contributo la società accredita punti – automaticamente, senza che tu debba annunciare nulla.',
        },
        {
          title: 'Il tuo contributo nella stagione',
          body: 'Il quadro mostra a che punto sei. Misura il tuo percorso, non la distanza dagli altri.',
        },
        {
          title: 'Tutto nella posta in arrivo',
          body: 'Ogni messaggio finisce lì. Se arrivi anche per e-mail, e quanto spesso, lo decidi tu.',
        },
      ],
      whyHeading: 'Perché tutto questo',
      why: 'Il lavoro di società pesa su poche spalle perché nessuno vede chi fa cosa. Reso visibile, si può dividere – è tutta qui l’idea.',
      open: 'Apri l’app',
      more: 'Tutti i dettagli sul sito',
      footnote: (club) => `Ricevi questa e-mail una sola volta, perché sei entrato in ${club}.`,
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
    whyLabel: 'Why:',
    channelWhy:
      'You receive this email because you switched on the email channel in your notification settings. The inbox in the app always holds everything.',
    settings: 'Notification settings',
    categories: {
      event: 'Event',
      points: 'Points',
      task: 'Task',
      news: 'News',
      pulse: 'Club pulse',
      input: 'Proposal',
      system: 'Connection',
      join_request: 'Membership',
      invoice: 'Invoice',
      general: 'Message',
    },
    categoryWhy: {
      event: 'The club plans around your answer – a no helps too.',
      points: 'So you can see what your contribution counted for.',
      task: 'Because the club needs hands for this work.',
      news: 'So you know what is going on in the club.',
      pulse: 'The club’s week at a glance – so nobody has to guess.',
      input: 'So you can see what became of your proposal.',
      system: 'It concerns your access to the app.',
      join_request: 'It concerns your membership.',
      invoice: 'Membership fees carry the club.',
      general: 'From your club.',
    },
    welcome: {
      intro: (club) =>
        `good to have you here. ${club} runs the club with myclub. Here is the overview in a minute – the details can wait.`,
      clubWhyLabel: 'This is why we exist:',
      how: 'How it works',
      steps: [
        {
          title: 'Accept or decline',
          body: 'Every event asks whether you are coming. Your answer is what the planning rests on – a no helps more than silence.',
        },
        {
          title: 'Lend a hand where it fits',
          body: 'Tasks, shifts and offices are open and always say what they are for and who they help. You pick what suits you.',
        },
        {
          title: 'Points come by themselves',
          body: 'The club credits points for every contribution – automatically, with nothing for you to report.',
        },
        {
          title: 'Your contribution over the season',
          body: 'The overview shows where you stand. It measures your own path, not the gap to others.',
        },
        {
          title: 'Everything in the inbox',
          body: 'Every message lands there. Whether it also goes out by email, and how often, is yours to decide.',
        },
      ],
      whyHeading: 'Why all this',
      why: 'Club work rests on a few shoulders because nobody sees who does what. Made visible, it can be shared – that is the whole idea.',
      open: 'Open the app',
      more: 'All the details on the website',
      footnote: (club) => `You receive this email once, because you joined ${club}.`,
    },
  },
};

/** Der Verein, wenn alle Meldungen aus demselben stammen. */
export function singleClub(items: MailItem[]): string | null {
  const names = new Set(items.map((item) => item.clubName ?? ''));
  if (names.size !== 1) return null;
  return items[0]?.clubName ?? null;
}

/** Die Marke des Blatts: der Verein der ersten Meldung, die einen nennt. */
export function brandOf(items: MailItem[]): MailBrand {
  const source = items.find((item) => item.clubName) ?? items[0];
  return {
    clubName: singleClub(items) ?? source?.clubName ?? null,
    color: items.find((item) => item.clubColor)?.clubColor ?? null,
    logoUrl: items.find((item) => item.clubLogo)?.clubLogo ?? null,
  };
}

/** Die Kopfbandfarbe – aus der Marke, mit der Grundfarbe als Rückfall. */
export function headerColor(items: MailItem[]): string {
  return brandColor(brandOf(items).color);
}

function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    timeZone: 'Europe/Zurich',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/**
 * Das Warum einer Meldung (FR-183).
 *
 * `own` ist das Warum des Auslösers – der Satz, den der Vorstand an der
 * Aufgabe oder am Amt geschrieben hat. Fehlt er, springt der Standardsatz der
 * Kategorie ein, aber nur bei einer einzelnen Meldung (`alone`).
 */
export function whyText(
  locale: Locale,
  category: string,
  own: string | null,
  alone: boolean,
): string | null {
  const trimmed = own?.trim();
  if (trimmed) return trimmed;
  if (!alone) return null;
  const t = STRINGS[locale];
  return t.categoryWhy[category] ?? t.categoryWhy.general;
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

/** Das Willkommensblatt (FR-184, UC-048). */
function renderWelcome(
  group: MailGroup,
  item: MailItem,
  options: RenderOptions,
): RenderedMail {
  const t = STRINGS[group.locale].welcome;
  const brand = brandOf([item]);
  const color = brandColor(brand.color);
  const club = brand.clubName ?? 'myclub';
  const dashboard = appLink(options.appUrl, '/tabs/dashboard');
  const clubWhy = item.clubWhy?.trim();

  const sections: MailSection[] = [paragraph(t.intro(club))];
  if (clubWhy) sections.push(whyLine(t.clubWhyLabel, clubWhy, color));
  sections.push(heading(t.how), steps(t.steps, color));
  sections.push(heading(t.whyHeading), paragraph(t.why));
  if (dashboard) sections.push(button(t.open, dashboard, color));
  if (options.helpUrl) sections.push(linkLine(t.more, options.helpUrl, color));

  const subject = subjectFor(group);
  const shell = renderShell({
    brand,
    locale: group.locale,
    subject,
    preheader: t.intro(club),
    greeting: STRINGS[group.locale].greeting(group.displayName) + ',',
    sections,
    footnote: t.footnote(club),
    footnoteLink: null,
    year: (options.now ?? new Date()).getFullYear(),
  });

  return { subject, ...shell };
}

export function renderMail(group: MailGroup, options: RenderOptions): RenderedMail {
  if (group.items.length === 1 && group.items[0].template === 'welcome') {
    return renderWelcome(group, group.items[0], options);
  }

  const t = STRINGS[group.locale];
  const brand = brandOf(group.items);
  const color = brandColor(brand.color);
  const club = brand.clubName;
  const alone = group.items.length === 1;
  const settingsUrl = appLink(options.appUrl, '/tabs/profile/notifications');

  const sections: MailSection[] = [paragraph(t.intro(group.items.length, group.mode))];

  group.items.forEach((item, index) => {
    const meta = [t.categories[item.category] ?? t.categories.general, formatTime(item.createdAt, group.locale)];
    if (!club && item.clubName) meta.unshift(item.clubName);
    const why = whyText(group.locale, item.category, item.why, alone);
    sections.push(
      notice({
        meta: meta.join(' · '),
        title: item.title,
        body: item.body,
        why: why ? whyLine(t.whyLabel, why, color) : null,
        url: appLink(options.appUrl, item.link),
        openLabel: t.open,
        color,
        first: index === 0,
      }),
    );
  });

  const subject = subjectFor(group);
  const shell = renderShell({
    brand,
    locale: group.locale,
    subject,
    preheader: group.items[0]?.title ?? '',
    greeting: t.greeting(group.displayName),
    sections,
    footnote: t.channelWhy,
    footnoteLink: settingsUrl ? { label: t.settings, url: settingsUrl } : null,
    year: (options.now ?? new Date()).getFullYear(),
  });

  return { subject, ...shell };
}

/**
 * Die Begleitmail zur Rechnung, in vier Sprachen (UC-046, Schritt 10).
 *
 * Sie steht hier und nicht in `src/i18n`: Eine Edge Function hat keinen Zugang
 * zu den Sprachdateien der App. Dieselbe Trennung wie bei `send-mail`.
 *
 * Der Ton ist der der App und nicht der eines Inkassobüros: Die Rechnung liegt
 * bei, der Weg zur App steht daneben, und es steht kein Wort über Folgen einer
 * späten Zahlung (BR-158).
 */
export type Locale = 'de' | 'fr' | 'it' | 'en';

export interface InvoiceMailInput {
  clubName: string;
  name: string;
  purpose: string;
  amount: string;
  dueDate: string;
  incompleteAddress: boolean;
}

const TEXTS: Record<Locale, {
  subject: (club: string, purpose: string) => string;
  greeting: (name: string) => string;
  intro: (club: string, purpose: string) => string;
  amount: string;
  due: string;
  attachment: string;
  incomplete: string;
  closing: (club: string) => string;
}> = {
  de: {
    subject: (club, purpose) => `Rechnung ${club} – ${purpose}`,
    greeting: (name) => `Hallo ${name}`,
    intro: (club, purpose) => `${club} stellt dir die Rechnung für ${purpose}.`,
    amount: 'Betrag',
    due: 'Zahlbar bis',
    attachment: 'Die Rechnung mit QR-Einzahlungsschein liegt als PDF bei.',
    incomplete:
      'Deine Adressangaben sind unvollständig. Bitte ergänze sie in deinem Profil, damit die nächste Rechnung richtig zugestellt wird.',
    closing: (club) => `Danke und bis bald\n${club}`,
  },
  fr: {
    subject: (club, purpose) => `Facture ${club} – ${purpose}`,
    greeting: (name) => `Bonjour ${name}`,
    intro: (club, purpose) => `${club} t'adresse la facture pour ${purpose}.`,
    amount: 'Montant',
    due: 'Payable jusqu\'au',
    attachment: 'La facture avec le bulletin de versement QR est jointe en PDF.',
    incomplete:
      'Tes coordonnées sont incomplètes. Merci de les compléter dans ton profil pour que la prochaine facture te parvienne correctement.',
    closing: (club) => `Merci et à bientôt\n${club}`,
  },
  it: {
    subject: (club, purpose) => `Fattura ${club} – ${purpose}`,
    greeting: (name) => `Ciao ${name}`,
    intro: (club, purpose) => `${club} ti invia la fattura per ${purpose}.`,
    amount: 'Importo',
    due: 'Pagabile entro il',
    attachment: 'La fattura con la polizza di versamento QR è allegata in PDF.',
    incomplete:
      'I tuoi dati di indirizzo sono incompleti. Completali nel tuo profilo, così la prossima fattura arriverà correttamente.',
    closing: (club) => `Grazie e a presto\n${club}`,
  },
  en: {
    subject: (club, purpose) => `Invoice ${club} – ${purpose}`,
    greeting: (name) => `Hi ${name}`,
    intro: (club, purpose) => `${club} is sending you the invoice for ${purpose}.`,
    amount: 'Amount',
    due: 'Payable by',
    attachment: 'The invoice with the Swiss QR payment slip is attached as a PDF.',
    incomplete:
      'Your address details are incomplete. Please complete them in your profile so the next invoice reaches you properly.',
    closing: (club) => `Thank you and see you soon\n${club}`,
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Die Beschriftungen **auf dem Blatt** (nicht in der Mail).
 *
 * Die Rechnung ist ein Dokument des Vereins an eine Person – sie gehört in
 * deren Sprache, wie jeder andere Benutzertext (CLAUDE.md). `swissqrbill`
 * übersetzt den Einzahlungsschein selbst, sobald es `language` bekommt; was
 * darüber steht, kommt von hier.
 */
export const PDF_LABELS: Record<Locale, {
  position: string;
  description: string;
  amount: string;
  total: string;
  reference: string;
  date: string;
  incomplete: string;
}> = {
  de: {
    position: 'Pos.',
    description: 'Bezeichnung',
    amount: 'Betrag',
    total: 'Total',
    reference: 'Referenz',
    date: 'Rechnungsdatum',
    incomplete:
      'Hinweis: Die Adressangaben sind unvollständig. Bitte ergänze sie in deinem Profil, damit die nächste Rechnung richtig zugestellt wird.',
  },
  fr: {
    position: 'Pos.',
    description: 'Désignation',
    amount: 'Montant',
    total: 'Total',
    reference: 'Référence',
    date: 'Date de facture',
    incomplete:
      'Remarque : tes coordonnées sont incomplètes. Merci de les compléter dans ton profil pour que la prochaine facture te parvienne correctement.',
  },
  it: {
    position: 'Pos.',
    description: 'Denominazione',
    amount: 'Importo',
    total: 'Totale',
    reference: 'Riferimento',
    date: 'Data della fattura',
    incomplete:
      'Nota: i tuoi dati di indirizzo sono incompleti. Completali nel tuo profilo, così la prossima fattura arriverà correttamente.',
  },
  en: {
    position: 'Pos.',
    description: 'Description',
    amount: 'Amount',
    total: 'Total',
    reference: 'Reference',
    date: 'Invoice date',
    incomplete:
      'Note: your address details are incomplete. Please complete them in your profile so the next invoice reaches you properly.',
  },
};

/** Die Sprache, in der `swissqrbill` den Einzahlungsschein beschriftet. */
export function billLanguage(locale: Locale): 'DE' | 'FR' | 'IT' | 'EN' {
  return locale.toUpperCase() as 'DE' | 'FR' | 'IT' | 'EN';
}

/**
 * Die Referenz, wie sie auf dem Einzahlungsschein steht: von **rechts** in
 * Fünfergruppen (SIX). Dieselbe Regel wie `formatQrReference()` in der App –
 * links gruppiert stünde dieselbe Zahl auf demselben Blatt zweimal
 * verschieden.
 */
export function groupReference(reference: string): string {
  const clean = reference.replace(/\s/g, '');
  const head = clean.length % 5;
  const groups: string[] = [];
  if (head > 0) groups.push(clean.slice(0, head));
  for (let index = head; index < clean.length; index += 5) {
    groups.push(clean.slice(index, index + 5));
  }
  return groups.join(' ');
}

/** Ein Datum, wie es in der Schweiz auf einer Rechnung steht. */
export function swissDate(date: Date): string {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

export function invoiceMail(
  locale: Locale,
  input: InvoiceMailInput,
): { subject: string; text: string; html: string } {
  const t = TEXTS[locale] ?? TEXTS.de;

  const lines = [
    t.greeting(input.name),
    '',
    t.intro(input.clubName, input.purpose),
    '',
    `${t.amount}: ${input.amount}`,
    `${t.due}: ${input.dueDate}`,
    '',
    t.attachment,
  ];
  if (input.incompleteAddress) lines.push('', t.incomplete);
  lines.push('', t.closing(input.clubName));

  const text = lines.join('\n');
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.5;color:#1f2933">${
    lines
      .map((line) => (line === '' ? '<div style="height:12px"></div>' : `<div>${escapeHtml(line)}</div>`))
      .join('')
  }</div>`;

  return { subject: t.subject(input.clubName, input.purpose), text, html };
}

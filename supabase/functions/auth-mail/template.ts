/**
 * Die Anmeldemail im Vereins-Look (FR-182, UC-048) – reine Funktionen,
 * `deno test` in diesem Ordner.
 *
 * Bis UC-048 kam diese Mail aus der Standardvorlage von GoTrue: englisch,
 * ohne Verein, ohne Erklärung. Sie war damit die **erste** Mail, die ein neues
 * Mitglied bekam – und die einzige, die nicht nach dem Verein aussah.
 *
 * Sechs Anlässe, ein Blatt. Der Unterschied liegt im Betreff, im Satz darüber
 * und im Warum darunter, nicht im Aufbau.
 *
 * **Das Warum ist hier keine Höflichkeit, sondern Sicherheit** (FR-183,
 * NFR-040): Wer eine Anmeldemail bekommt, die er nicht angefordert hat, muss
 * aus der Mail selbst erfahren, dass Nichtstun der richtige Schritt ist.
 */

import {
  brandColor,
  button,
  paragraph,
  renderShell,
  whyLine,
  type Locale,
  type MailBrand,
  type MailSection,
} from '../_shared/mail.ts';

/** Die Anlässe, die GoTrue als `email_action_type` schickt. */
export type AuthAction =
  | 'signup'
  | 'magiclink'
  | 'invite'
  | 'recovery'
  | 'email_change'
  | 'email';

export interface AuthMailInput {
  action: AuthAction;
  locale: Locale;
  brand: MailBrand;
  /** Die Adresse hinter der Schaltfläche. */
  confirmUrl: string;
  year: number;
}

type ActionStrings = { subject: string; intro: string; action: string; why: string };

type Strings = {
  greeting: string;
  whyLabel: string;
  validity: string;
  footnote: string;
  actions: Record<AuthAction, ActionStrings>;
};

const STRINGS: Record<Locale, Strings> = {
  de: {
    greeting: 'Hallo',
    whyLabel: 'Warum diese Mail:',
    validity: 'Der Link gilt eine Stunde und nur ein einziges Mal.',
    footnote:
      'Diese Mail gehört zu deinem Zugang und lässt sich nicht abbestellen – sie kommt nur, wenn jemand sie anfordert.',
    actions: {
      magiclink: {
        subject: 'Dein Anmeldelink',
        intro: 'Hier ist dein Anmeldelink. Ein Klick genügt, ein Passwort brauchst du nicht.',
        action: 'Jetzt anmelden',
        why: 'Für diese Adresse wurde eine Anmeldung angefordert. Warst du das nicht, ignoriere die Mail – ohne den Link geschieht nichts.',
      },
      signup: {
        subject: 'Bestätige deine Adresse',
        intro: 'Willkommen. Bestätige einmal kurz, dass diese Adresse dir gehört – danach ist dein Zugang bereit.',
        action: 'Adresse bestätigen',
        why: 'Wir prüfen die Adresse, damit niemand ein Konto auf eine fremde Mailadresse eröffnen kann.',
      },
      invite: {
        subject: 'Du bist eingeladen',
        intro: 'Du wurdest eingeladen. Über diesen Link richtest du deinen Zugang ein.',
        action: 'Einladung annehmen',
        why: 'Jemand aus dem Vorstand hat dich eingeladen. Willst du nicht dabei sein, lass die Mail einfach liegen.',
      },
      recovery: {
        subject: 'Passwort zurücksetzen',
        intro: 'Über diesen Link setzt du ein neues Passwort.',
        action: 'Neues Passwort setzen',
        why: 'Für diese Adresse wurde ein neues Passwort angefordert. Warst du das nicht, bleibt dein bisheriges gültig – du musst nichts tun.',
      },
      email_change: {
        subject: 'Neue E-Mail-Adresse bestätigen',
        intro: 'Bestätige die Änderung deiner E-Mail-Adresse.',
        action: 'Änderung bestätigen',
        why: 'Wir fragen an beiden Adressen nach, damit eine Änderung nicht an dir vorbei geschehen kann.',
      },
      email: {
        subject: 'Dein Bestätigungscode',
        intro: 'Für den nächsten Schritt braucht die App eine Bestätigung von dir.',
        action: 'Bestätigen',
        why: 'Die App fragt vor besonders heiklen Schritten noch einmal nach, ob wirklich du am Gerät bist.',
      },
    },
  },
  fr: {
    greeting: 'Bonjour',
    whyLabel: 'Pourquoi cet e-mail :',
    validity: 'Le lien est valable une heure et une seule fois.',
    footnote:
      'Cet e-mail fait partie de ton accès et ne peut pas être désactivé – il n’arrive que si quelqu’un le demande.',
    actions: {
      magiclink: {
        subject: 'Ton lien de connexion',
        intro: 'Voici ton lien de connexion. Un clic suffit, aucun mot de passe nécessaire.',
        action: 'Se connecter',
        why: 'Une connexion a été demandée pour cette adresse. Si ce n’était pas toi, ignore cet e-mail – sans le lien, rien ne se passe.',
      },
      signup: {
        subject: 'Confirme ton adresse',
        intro: 'Bienvenue. Confirme brièvement que cette adresse est bien la tienne – ensuite ton accès est prêt.',
        action: 'Confirmer l’adresse',
        why: 'Nous vérifions l’adresse pour que personne ne puisse ouvrir un compte sur l’e-mail d’un autre.',
      },
      invite: {
        subject: 'Tu es invité',
        intro: 'Tu as été invité. Ce lien te permet de créer ton accès.',
        action: 'Accepter l’invitation',
        why: 'Quelqu’un du comité t’a invité. Si tu ne souhaites pas participer, laisse simplement cet e-mail de côté.',
      },
      recovery: {
        subject: 'Réinitialiser le mot de passe',
        intro: 'Ce lien te permet de définir un nouveau mot de passe.',
        action: 'Définir un mot de passe',
        why: 'Un nouveau mot de passe a été demandé pour cette adresse. Si ce n’était pas toi, l’ancien reste valable – tu n’as rien à faire.',
      },
      email_change: {
        subject: 'Confirmer la nouvelle adresse e-mail',
        intro: 'Confirme la modification de ton adresse e-mail.',
        action: 'Confirmer la modification',
        why: 'Nous demandons aux deux adresses, pour qu’un changement ne puisse pas se faire à ton insu.',
      },
      email: {
        subject: 'Ton code de confirmation',
        intro: 'Pour l’étape suivante, l’app a besoin d’une confirmation de ta part.',
        action: 'Confirmer',
        why: 'Avant les étapes sensibles, l’app vérifie une fois de plus que c’est bien toi.',
      },
    },
  },
  it: {
    greeting: 'Ciao',
    whyLabel: 'Perché questa e-mail:',
    validity: 'Il link vale un’ora e una sola volta.',
    footnote:
      'Questa e-mail fa parte del tuo accesso e non si può disattivare – arriva solo se qualcuno la richiede.',
    actions: {
      magiclink: {
        subject: 'Il tuo link di accesso',
        intro: 'Ecco il tuo link di accesso. Basta un clic, non serve una password.',
        action: 'Accedi ora',
        why: 'Per questo indirizzo è stato richiesto un accesso. Se non sei stato tu, ignora l’e-mail – senza il link non succede nulla.',
      },
      signup: {
        subject: 'Conferma il tuo indirizzo',
        intro: 'Benvenuto. Conferma brevemente che questo indirizzo è tuo – poi il tuo accesso è pronto.',
        action: 'Conferma l’indirizzo',
        why: 'Verifichiamo l’indirizzo perché nessuno possa aprire un conto sull’e-mail di un altro.',
      },
      invite: {
        subject: 'Sei invitato',
        intro: 'Sei stato invitato. Con questo link crei il tuo accesso.',
        action: 'Accetta l’invito',
        why: 'Qualcuno del comitato ti ha invitato. Se non vuoi partecipare, lascia perdere questa e-mail.',
      },
      recovery: {
        subject: 'Reimpostare la password',
        intro: 'Con questo link imposti una nuova password.',
        action: 'Imposta una password',
        why: 'Per questo indirizzo è stata richiesta una nuova password. Se non sei stato tu, quella attuale resta valida – non devi fare nulla.',
      },
      email_change: {
        subject: 'Conferma il nuovo indirizzo e-mail',
        intro: 'Conferma la modifica del tuo indirizzo e-mail.',
        action: 'Conferma la modifica',
        why: 'Chiediamo a entrambi gli indirizzi, così una modifica non può avvenire a tua insaputa.',
      },
      email: {
        subject: 'Il tuo codice di conferma',
        intro: 'Per il passo successivo l’app ha bisogno di una tua conferma.',
        action: 'Conferma',
        why: 'Prima dei passi delicati l’app verifica ancora una volta che al dispositivo ci sia davvero tu.',
      },
    },
  },
  en: {
    greeting: 'Hi',
    whyLabel: 'Why this email:',
    validity: 'The link is valid for one hour and only once.',
    footnote:
      'This email belongs to your account access and cannot be switched off – it only arrives when someone asks for it.',
    actions: {
      magiclink: {
        subject: 'Your sign-in link',
        intro: 'Here is your sign-in link. One click is enough, no password needed.',
        action: 'Sign in now',
        why: 'A sign-in was requested for this address. If that was not you, ignore this email – without the link nothing happens.',
      },
      signup: {
        subject: 'Confirm your address',
        intro: 'Welcome. Confirm briefly that this address is yours – then your access is ready.',
        action: 'Confirm address',
        why: 'We check the address so nobody can open an account on someone else’s email.',
      },
      invite: {
        subject: 'You are invited',
        intro: 'You have been invited. This link sets up your access.',
        action: 'Accept invitation',
        why: 'Someone on the board invited you. If you would rather not join, simply leave this email be.',
      },
      recovery: {
        subject: 'Reset your password',
        intro: 'This link lets you set a new password.',
        action: 'Set a new password',
        why: 'A new password was requested for this address. If that was not you, your current one stays valid – there is nothing to do.',
      },
      email_change: {
        subject: 'Confirm your new email address',
        intro: 'Confirm the change of your email address.',
        action: 'Confirm the change',
        why: 'We ask at both addresses so a change cannot happen without you.',
      },
      email: {
        subject: 'Your confirmation code',
        intro: 'For the next step the app needs a confirmation from you.',
        action: 'Confirm',
        why: 'Before sensitive steps the app checks once more that it really is you at the device.',
      },
    },
  },
};

/** Der Anlass, wie GoTrue ihn schickt; Unbekanntes gilt als Anmeldelink. */
export function authAction(value: string | null | undefined): AuthAction {
  const known: AuthAction[] = ['signup', 'magiclink', 'invite', 'recovery', 'email_change', 'email'];
  return known.includes(value as AuthAction) ? (value as AuthAction) : 'magiclink';
}

export function authMail(input: AuthMailInput): { subject: string; html: string; text: string } {
  const t = STRINGS[input.locale] ?? STRINGS.de;
  const a = t.actions[input.action];
  const color = brandColor(input.brand.color);
  const club = input.brand.clubName;

  // Der Betreff nennt den Verein, wenn einer bekannt ist: Im Postfach steht
  // sonst «Dein Anmeldelink» ohne jeden Hinweis, wovon.
  const subject = club ? `${club}: ${a.subject}` : a.subject;

  const sections: MailSection[] = [
    paragraph(a.intro),
    button(a.action, input.confirmUrl, color),
    paragraph(t.validity),
    whyLine(t.whyLabel, a.why, color),
  ];

  const shell = renderShell({
    brand: input.brand,
    locale: input.locale,
    subject,
    preheader: a.intro,
    greeting: t.greeting,
    sections,
    footnote: t.footnote,
    footnoteLink: null,
    year: input.year,
  });

  return { subject, ...shell };
}

/**
 * Der Profil-Assistent (UC-053, FR-200).
 *
 * **Warum es ihn braucht.** UC-051 richtet den *Verein* ein. Für die Person,
 * die danach beitritt, gab es nichts Entsprechendes: Sie landet im Dashboard,
 * und Bild, Name und Meldungen liegen hinter drei verschiedenen Blättern, von
 * denen keines sie darauf anspricht. Das Ergebnis steht in jeder
 * Mitgliederliste – Anzeigename gleich E-Mail-Adresse, kein Bild, kein Gerät.
 *
 * **Er ist ein Angebot, keine Hürde** (BR-270). Vier Fragen, jede einzeln
 * überspringbar, und der Ausstieg steht in jedem Schritt. Wer ihn verlässt,
 * verliert nichts: Jeder Schritt schreibt sofort, und die Wege zu denselben
 * Feldern bleiben, wo sie waren.
 */

/** Wo der Assistent wohnt. `/tabs/profile/setup` gehört dem Verein (UC-051). */
export const PROFILE_SETUP_ROUTE = '/tabs/profile/onboarding';

export const PROFILE_SETUP_STEPS = ['photo', 'name', 'contact', 'notifications'] as const;

export type ProfileSetupStepId = (typeof PROFILE_SETUP_STEPS)[number];

/**
 * Der Anzeigename, den niemand gewählt hat.
 *
 * `request_join()` und die Einladung setzen ihn beim Beitritt auf den Teil vor
 * dem @ (`0010`), wenn das Konto keinen vollen Namen mitbringt. Genau dieser
 * Zustand ist der Anlass des Assistenten – und die Prüfung muss ihn erkennen,
 * ohne einen selbst gewählten Namen zu beanstanden, der zufällig so aussieht.
 */
export function isPlaceholderName(
  displayName: string | null | undefined,
  accountEmail: string | null | undefined,
): boolean {
  const name = (displayName ?? '').trim();
  const email = (accountEmail ?? '').trim();
  if (name === '') return true;
  if (email === '') return false;
  return name.toLowerCase() === email.split('@')[0].toLowerCase();
}

/**
 * Hat die Person ihr Profil angefasst?
 *
 * Die Schwelle ist mit Absicht niedrig: **ein Bild oder ein selbst gewählter
 * Name** genügt. Sie entscheidet, wie lange die Karte auf dem Dashboard steht,
 * und eine hohe Schwelle machte aus einem Angebot eine Mahnung – wer kein Bild
 * will, soll nicht dauerhaft daran erinnert werden.
 */
export function isProfileStarted(input: {
  avatarUrl: string | null | undefined;
  displayName: string | null | undefined;
  accountEmail: string | null | undefined;
}): boolean {
  if (input.avatarUrl) return true;
  return !isPlaceholderName(input.displayName, input.accountEmail);
}

/**
 * Gibt es die Spalte in der laufenden Datenbank überhaupt schon?
 *
 * **Der Unterschied zwischen `null` und `undefined` trägt hier eine
 * Bereitstellung.** PostgREST liefert nur Spalten, die es gibt: `null` heisst
 * «die Frage ist offen», `undefined` heisst «`0105` ist noch nicht
 * eingespielt». Die App wird beim Merge von Vercel gebaut, die Migration spielt
 * Sandro von Hand ein – dazwischen liegt ein Fenster, und ohne diese
 * Unterscheidung ginge der Assistent darin bei **jedem** Blick aufs Dashboard
 * erneut auf, während «Fertig» nichts zu schreiben hätte.
 */
export function isSetupAvailable(input: {
  profileSetupAt: string | null | undefined;
}): boolean {
  return input.profileSetupAt !== undefined;
}

/**
 * Soll der Assistent von selbst aufgehen?
 *
 * Nur einmal je Mitgliedschaft, und nur, solange niemand geantwortet hat:
 * `profileSetupAt` trägt den Zeitpunkt, an dem gefragt wurde – **durchlaufen
 * oder übersprungen ist dasselbe** (BR-270). Ein zweites Mal ungefragt
 * aufzugehen wäre keine Hilfe mehr, sondern eine Sperre vor dem Dashboard.
 */
export function shouldStartSetup(input: {
  profileSetupAt: string | null | undefined;
}): boolean {
  if (!isSetupAvailable(input)) return false;
  return !input.profileSetupAt;
}

/**
 * Darf die Karte auf dem Dashboard stehen?
 *
 * Sie ist der Weg zurück für alle, die den Assistenten übersprungen haben –
 * und sie verschwindet, sobald das Profil angefangen ist, nicht erst, wenn es
 * vollständig ist.
 */
export function shouldOfferSetupCard(input: {
  avatarUrl: string | null | undefined;
  displayName: string | null | undefined;
  accountEmail: string | null | undefined;
  profileSetupAt: string | null | undefined;
}): boolean {
  // Solange `0105` fehlt, führte die Karte in einen Assistenten, dessen
  // «Fertig» nichts festhalten kann – sie bleibt bis dahin weg.
  if (!isSetupAvailable(input)) return false;
  return !isProfileStarted(input);
}

/** Blockiert «Weiter» im Namensschritt: ein Mitglied trägt immer einen Namen (BR-031). */
export function isNameStepComplete(input: {
  displayName: string;
  firstName: string;
  lastName: string;
}): boolean {
  if (input.displayName.trim() !== '') return true;
  // BR-208: Ohne eigenen Anzeigenamen tragen Vor- und Nachname ihn.
  return input.firstName.trim() !== '' && input.lastName.trim() !== '';
}

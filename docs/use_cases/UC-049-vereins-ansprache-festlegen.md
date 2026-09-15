# Use Case: Ansprache des Vereins festlegen

## Overview

**Use Case ID:** UC-049
**Use Case Name:** Ansprache des Vereins festlegen
**Primary Actor:** Vorstand
**Secondary Actor:** Mitglied, System
**Goal:** Der Verein spricht seine Mitglieder überall gleich an – per Du oder per Sie, in der App wie in jeder E-Mail
**Status:** Draft

## Preconditions

- Der Verein existiert, und die Vereinseinstellungen sind dem Vorstand zugänglich (UC-034).
- Die Sprachdateien tragen zu jedem Satz, der eine Person anspricht, eine Sie-Fassung (BR-244). Ohne sie ist die Wahl nicht wirksam schaltbar.
- Die Meldungstexte stehen als Schlüssel und nicht als fester Wortlaut in der Zeile (FR-187) – `title`, `body` **und** `why`. Das ist die Voraussetzung dafür, dass «überall» auch die Inbox einschliesst.

## Main Success Scenario

1. Vorstand öffnet die Vereinseinstellungen, Abschnitt Identität.
2. System zeigt die Ansprache als Wahl zwischen «Du» und «Sie» und nennt die Vorgabe: **Du**.
3. Vorstand wählt «Sie».
4. System speichert die Wahl am Verein und sagt, was sie umfasst: alle Mitglieder, alle Kanäle, alle vier Sprachen.
5. Jede Ansicht der App setzt von da an die Sie-Fassung ihrer Texte ein – in der Sprache, die das Mitglied gewählt hat (FR-110).
6. Jede E-Mail des Vereins tut dasselbe: Meldung, Zusammenfassung, Willkommensblatt, Rechnung, Pulsblatt.
7. Die Anmeldemail folgt der Ansprache des Vereins, den der Einladungscode nennt; kennt sie keinen, gilt die Vorgabe.

## Alternative Flows

### A1: Verein, der nie etwas einstellt

**Trigger:** Ein neuer Verein wird gegründet und öffnet die Einstellung nie (Schritt 1)
**Flow:**

1. Der Verein duzt. Die Vorgabe ist hinterlegt, ohne dass jemand sie setzt – Zero-Config-Start (K7, BR-150).
2. Use case ends.

### A2: Mitglied in zwei Vereinen

**Trigger:** Eine Person gehört zu einem Verein, der duzt, und zu einem, der siezt (Schritt 5)
**Flow:**

1. Die App spricht sie so an, wie der gerade aktive Verein es festgelegt hat; wechselt sie den Verein, wechselt die Ansprache mit.
2. Eine E-Mail folgt dem Verein, aus dem die Meldung stammt – nicht dem, der zuletzt aktiv war.
3. Trägt eine Zusammenfassung Zeilen aus beiden Vereinen, gilt die Ansprache des Vereins, der das Blatt brandet (`brandOf`).

### A3: Englisch

**Trigger:** Das Mitglied liest die App auf Englisch (Schritt 5)
**Flow:**

1. Englisch unterscheidet nicht zwischen Du und Sie. Die Wahl bleibt ohne Wirkung, und die Oberfläche sagt das nicht extra – sie wäre sonst eine Erklärung für ein Nichtereignis.

### A4: Die Sie-Fassung ist unvollständig

**Trigger:** Ein Satz hat keine Sie-Fassung (Auslieferung, nicht Laufzeit)
**Flow:**

1. `npm run i18n:check` schlägt an und die Auslieferung scheitert (BR-244).
2. Es gibt kein Blatt, das zur Hälfte siezt und zur Hälfte duzt – die halbe Umstellung ist schlechter als das konsequente Du.
3. Für die Mailtexte greift die Prüfung nicht von selbst: Sie liegen ausserhalb von `src/i18n` und brauchen eine eigene Vollständigkeitsprüfung (BR-244).

### A5: Meldungen von vor der Umstellung

**Trigger:** Der Verein stellt auf «Sie» um, und in den Inboxen liegen Meldungen von vorher (Schritt 5)
**Flow:**

1. Zeilen, die ihren Wortlaut mitführen, behalten ihn. Rückwirkend wird nichts umgeschrieben.
2. Zeilen, die als Schlüssel gespeichert sind (FR-187), erscheinen beim nächsten Öffnen in der neuen Ansprache.

## Postconditions

### Success Postconditions

- Der Verein hat genau eine Ansprache, und sie steht in den Vereinseinstellungen.
- App, Inbox und jede E-Mail verwenden dieselbe Ansprache in derselben Sprache.
- Ein Verein, der nichts einstellt, duzt.

### Failure Postconditions

- Die Wahl ist nicht gespeichert; der Verein bleibt bei der bisherigen Ansprache.
- Keine gemischte Ansprache innerhalb eines Blatts oder eines Bildschirms.

## Business Rules

### BR-243: Eine Ansprache je Verein

Die Ansprache gehört dem Verein, nicht dem Mitglied und nicht dem Kanal. Ein Verein hat eine Stimme; wer per Sie schreibt, schreibt auch in der App per Sie. Die Vorgabe ist **Du** und ist hinterlegt, ohne dass jemand sie setzt. Eine Ansprache je Mitglied ist damit ausdrücklich nicht vorgesehen – sie würde aus einer Vereinsentscheidung eine Einstellung machen, die niemand pflegt.

### BR-244: Vollständig oder gar nicht

Die Sie-Fassung existiert für **jeden** Satz, der eine Person anspricht, in Deutsch, Französisch und Italienisch. `npm run i18n:check` erzwingt das wie bei jedem anderen Schlüssel. Ein Blatt, das zur Hälfte siezt, wirkt nachlässiger als eines, das konsequent duzt – deshalb ist die Vollständigkeit Bedingung der Umschaltung und nicht ihr Ziel.

**Die Mailtexte gehören dazu, und die Prüfung sieht sie nicht.** Sie stehen in
drei Edge Functions (`send-mail/template.ts`, `auth-mail/template.ts`,
`invoice-run/mail.ts` samt `PDF_LABELS`), weil eine Edge Function keinen Zugang
zu den Sprachdateien der App hat. Alle drei sind heute durchgehend in der
Du-Form. Die Prüfung muss deshalb auch dort greifen, sonst ist die Umstellung
in der App vollständig und im Postfach halb.

### BR-245: Siezen ohne Anredefeld

Das Profil führt bewusst kein Geschlecht (darum ist FR-131 zurückgestellt). Die Sie-Fassung schreibt deshalb «Guten Tag Max Meier» und nie «Guten Tag Herr Meier». Wer «Herr» und «Frau» will, braucht zuerst ein Anredefeld – das ist eine eigene Entscheidung und keine Folge dieser.

### BR-246: Englisch ist von der Prüfung ausgenommen

`en.json` trägt keine `_formal`-Schlüssel, weil Englisch die Unterscheidung nicht kennt. Die Ausnahme steht in `check-i18n.mjs` und ist dort begründet; 195 wortgleiche englische Dubletten wären eine Einladung zur Drift.

### BR-247: Tonalität und Ansprache sind zwei Felder

`clubs.settings.dna.tone` bleibt der Freitext für die Textfunktionen (FR-114). Die Ansprache ist ein Wert mit zwei Zuständen, den ein Renderer auswerten kann. Wer beides in ein Feld legt, hat eine Einstellung, die niemand lesen kann, und eine Prosa, die niemand pflegt.

### BR-257: Schlüssel oder Prosa, nie beides

Eine Meldung trägt ihren Text entweder als **Schlüssel** – dann übersetzt ihn
die Darstellung und richtet die Ansprache aus – oder als **Prosa des Vereins**,
und dann bleibt er unangetastet. Die Grenze läuft heute schon quer durch
`notify()`: «Kommst du?» ist ein Satz des Produkts, `v_task.title` und
`v_task.why` sind Sätze, die der Verein selbst geschrieben hat (FR-051). Ein
Aufgabentitel ist so wenig übersetzbar wie eine News – wer ihn zum Schlüssel
machen wollte, schaffte das Warum-Pflichtfeld ab.

Deshalb ist es ein **eigenes Feld** neben dem Schlüssel und nicht eine Regel im
Kopf des Aufrufers. Bei 90 Aufrufstellen wird sonst die Hälfte falsch
einsortiert, und der Fehler fällt erst in der vierten Sprache auf. Für die
Standardsätze je Kategorie ist die Form schon gebaut: `notifications.why.*`,
zwölf Kategorien, vier Sprachen.

## Vorgesehene Umsetzung

| Anforderung | Wo |
| --- | --- |
| FR-185 | `clubs.settings.tone.address` (`'informal' \| 'formal'`, Vorgabe `informal`), `ClubSettingsPage`, `useClubSettings` |
| FR-186 | i18next-Kontext (`t(key, { context: 'formal' })`), `useLocaleSync`; für die Mails die drei Textdateien (`send-mail/template.ts`, `auth-mail/template.ts`, `invoice-run/mail.ts`) – das Blatt selbst in `_shared/mail.ts` bleibt unberührt |
| FR-186 | Die Wahl muss zum Versandlauf gelangen: `pending_mail()` und `mail_brand()` aus `0096` erweitern (nicht die Fassung aus `0084`) |
| FR-187 | `notifications`: Schlüssel und Parameter statt Wortlaut in `title`, `body` **und** `why`; die 90 `notify()`-Aufrufe in den Migrationen; `InboxPage`, `send-mail/template.ts` |
| BR-257 | Eigenes Feld für die Sorte an `notifications`; die zwei Rechnungserinnerungen in `0096` sind Sorte «Schlüssel», `tasks.why`/`functionary_roles.why`/`events.why` sind Sorte «Prosa» |
| BR-244 | `app/scripts/check-i18n.mjs` |
| BR-246 | `app/scripts/check-i18n.mjs` |

## Abhängigkeit, die diesen Use Case teuer macht

FR-187 ist kein Nebenschritt, sondern der grössere Teil der Arbeit. Heute
schreiben 90 `notify()`-Aufrufe deutschen Wortlaut in `notifications.title`
und `notifications.body`, und `InboxPage` zeigt ihn roh. Eine
französischsprachige Person liest also deutsche Meldungstitel – eine
bestehende Lücke gegenüber der Vier-Sprachen-Regel, unabhängig von der
Ansprache. Wer FR-186 ohne FR-187 baut, schaltet eine App um, deren Meldungen
weiter deutsch und weiter duzend bleiben. Reihenfolge deshalb: FR-187, dann
FR-185 und FR-186 gemeinsam für App und Mail.

Die Spalte `notifications.why` aus `0096` gehört in denselben Schnitt: Sie ist
derselbe deutsche Klartext. Wird `title` zum Schlüssel und `why` nicht, steht
in der Inbox einer französischsprachigen Person ein französischer Titel über
einem deutschen Warum – und der Bruch wäre neu, nicht geerbt. Die Unterscheidung
dafür ist BR-257.

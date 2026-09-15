# Use Case: Mail im Vereins-Look, mit Warum und Begrüssung

## Overview

**Use Case ID:** UC-048
**Use Case Name:** Mail im Vereins-Look, mit Warum und Begrüssung
**Primary Actor:** Mitglied
**Secondary Actor:** System, Vorstand
**Goal:** Jede E-Mail des Vereins sieht nach dem Verein aus, sagt warum sie kommt, und wer beitritt, versteht in einer Minute, wie es funktioniert
**Status:** Implemented – die Migration `0096` und die Function `auth-mail` sind gebaut und geprüft, aber noch nicht deployt (Stand 15.09.2026)

## Preconditions

- Der Versanddienst ist eingerichtet (BR-212): SMTP-Zugang und Absender liegen als Secrets vor.
- Für die Anmeldemail steht zusätzlich das Secret `SEND_EMAIL_HOOK_SECRET` und der Hook `[auth.hook.send_email]` in `config.toml` (BR-241).
- Vereinsfarbe und Logo sind Vereinseinstellungen (FR-111, UC-034); fehlen sie, gilt der Auftritt von myclub.

## Main Success Scenario

1. Gast öffnet einen Einladungslink und fordert den Anmeldelink an. App gibt dabei ihre Sprache und den Einladungscode mit.
2. System prüft den Code gegen die Einladungen, ermittelt daraus den Verein und baut die Anmeldemail in dessen Auftritt: Logo, Farbe, Vereinsname im Betreff und im Absender.
3. Die Mail nennt den Link, den Code als zweiten Weg – und darunter, **warum** sie gekommen ist und dass Nichtstun genügt, falls die Anmeldung nicht von der Person stammt.
4. Gast meldet sich an und löst die Einladung ein. System legt die Mitgliedschaft an.
5. System löst die Begrüssung aus: eine Meldung mit eigenem Blatt für das Postfach.
6. Der Versandlauf setzt daraus die Willkommensmail zusammen – Übersicht in fünf Schritten, das Warum des Vereins, wenn eines hinterlegt ist, das Warum des Ganzen, ein Knopf in die App und der Verweis auf die Website für die Einzelheiten.
7. Von da an trägt jede weitere Meldung dasselbe Blatt und ihr Warum: der Satz des Auslösers, sonst der Standardsatz ihrer Kategorie.
8. Dieselbe Zeile steht in der Inbox der App, mit demselben Warum.

## Alternative Flows

### A1: Anmeldung ohne Einladung

**Trigger:** Eine Person meldet sich an, ohne einem Einladungslink zu folgen (Schritt 1)
**Flow:**

1. System sucht den Verein über ihre Mitgliedschaften und nimmt den zuletzt beigetretenen.
2. Ist sie in keinem Verein, trägt die Mail den Auftritt von myclub.
3. Use case continues at step 3.

### A2: Beitritt über eine Anfrage statt über eine Einladung

**Trigger:** Der Vorstand nimmt eine Beitritts-Anfrage an (statt Schritt 4)
**Flow:**

1. System legt die Mitgliedschaft an und löst dieselbe Begrüssung aus.
2. Use case continues at step 5.

### A3: Die Person ist schon begrüsst worden

**Trigger:** Eine Einladung wird ein zweites Mal eingelöst, oder die Anfrage wird angenommen, nachdem die Person bereits über eine Einladung beigetreten ist (Schritt 5)
**Flow:**

1. System stellt fest, dass für diese Person und diesen Verein schon eine Begrüssung besteht (BR-240).
2. Es entsteht keine zweite. Use case ends.

### A4: Kein E-Mail-Kanal

**Trigger:** Das Mitglied hat «Keine E-Mail» gewählt (Schritt 6)
**Flow:**

1. Es geht keine Willkommensmail hinaus – die Einstellung steht über dem Anlass.
2. Die Begrüssung steht in der Inbox der App (BR-117). Use case continues at step 8.

### A5: Der Auslöser kennt ein eigenes Warum

**Trigger:** Die Meldung gehört zu einer Aufgabe, einem Amt oder einer Rechnung, deren Zweck erfasst ist (Schritt 7)
**Flow:**

1. System stellt den erfassten Satz an die Stelle des Standardsatzes.
2. In einer Zusammenfassung steht er an jeder Zeile, die einen trägt; der Standardsatz der Kategorie erscheint dort nicht, weil er sich sonst zwölfmal wiederholte.

### A6: Der Versand der Anmeldemail scheitert

**Trigger:** Der SMTP-Server lehnt die Anmeldemail ab (Schritt 2)
**Flow:**

1. System hat bereits geantwortet – Supabase Auth gibt einem Hook fünf Sekunden für den ganzen Aufruf, und ein SMTP-Gespräch passt darin nicht verlässlich. Geprüft ist zu diesem Zeitpunkt, dass Signatur, Rumpf und Secrets stimmen.
2. Der gescheiterte Versand steht im Log der Function `auth-mail`. Die Person fordert den Link erneut an.
3. Bleibt es dabei, kann der Vorstand den Hook in `config.toml` abschalten – Supabase Auth verschickt dann wieder seine eigene Vorlage (NFR-040).

### A7: Verein ohne Logo oder Farbe

**Trigger:** Die Vereinseinstellungen tragen kein Logo oder keine Farbe (Schritt 2, 6, 7)
**Flow:**

1. System setzt die Grundfarbe von myclub ein und lässt das Bild weg. Der Vereinsname steht in jedem Fall im Kopfband.

## Postconditions

### Success Postconditions

- Anmeldemail, Meldungsmail, Willkommensmail und Rechnungsmail stehen im selben Blatt und tragen den Auftritt des Vereins.
- Jede Meldung trägt in Mail und Inbox einen Satz, der ihren Zweck nennt.
- Ein neues Mitglied hat genau eine Willkommensmail je Verein bekommen.

### Failure Postconditions

- Scheitert der Versand einer Meldungsmail, bleibt die Zeile offen und die Inbox vollständig (UC-044 A2).
- Scheitert der Versand der Anmeldemail, bekommt die Person eine Fehlermeldung statt eines stillen Nichts.

## Business Rules

### BR-239: Jede Meldung sagt, warum sie kommt

Eine Meldung trägt entweder das Warum ihres Auslösers oder den Standardsatz ihrer Kategorie. Es gibt keine Meldung ohne Warum – in der Inbox nicht und in der Mail nicht. Der Standardsatz erklärt die Zustellung («der Verein plant mit deiner Antwort»), das Warum des Auslösers den Anlass («der Erlös finanziert die Trikots»). In einer Zusammenfassung mit mehreren Zeilen erscheint der Standardsatz nicht, der Satz des Auslösers schon.

### BR-240: Eine Begrüssung je Person und Verein

Die Willkommensmail entsteht genau einmal, gleichgültig über welchen Weg jemand beitritt und wie oft. Wer austritt und wieder beitritt, bekommt keine zweite. Die Prüfung liegt in `welcome_member()` und nicht in den zwei Aufrufern.

### BR-241: Der Verein ist der Absendername, nicht die Absenderadresse

Im Postfach steht «TV Musterhausen (myclub)»; die Adresse bleibt die des Dienstes. Eine fremde Absenderadresse fiele durch SPF und DKIM und landete im Spam. Vereinsname, Farbe und Logo sind Anzeige, nicht Zustellweg.

### BR-242: Was ins Blatt darf, ist geprüft

Jeder eingesetzte Wert wird maskiert, und als Bild- oder Linkadresse zählt nur `https:`. Vereinsname, Titel und Logoadresse kommen aus Eingabefeldern; die Sprache und der Einladungscode der Anmeldemail kommen aus den Anmeldedaten und werden serverseitig gegen `invites` geprüft, nicht geglaubt.

## Traceability

| Anforderung | Wo umgesetzt |
| --- | --- |
| FR-182 | `supabase/functions/_shared/mail.ts` (Blatt), `_shared/smtp.ts` (Absendername), `auth-mail/`, `send-mail/template.ts`, `invoice-run/mail.ts`, `0096` (`mail_brand`, `pending_mail`) |
| FR-183 | `0096` (`notifications.why`, `notify()`), `app/src/lib/notificationWhy.ts`, `app/src/pages/InboxPage.tsx`, `send-mail/template.ts` |
| FR-184 | `0096` (`notifications.mail_template`, `welcome_member`, `redeem_invite`, `decide_join_request`), `send-mail/template.ts` (Willkommensblatt) |
| NFR-040 | `auth-mail/index.ts` (Rückfall je Angabe), `supabase/config.toml` (`[auth.hook.send_email]`) |
| BR-239 | `send-mail/template.ts` (`whyText`), `app/src/lib/notificationWhy.ts` |
| BR-240 | `0096` (`welcome_member`, Index `notifications_welcome_idx`) |
| BR-241 | `_shared/smtp.ts` (`fromHeader`) |
| BR-242 | `_shared/mail.ts` (`escapeHtml`, `safeUrl`), `0096` (`mail_brand`) |

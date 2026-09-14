# Implementation Plan: UC-044 — Meldungen per E-Mail erhalten

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                            |
| **Goal**          | Meldungen auch im Postfach, gebündelt oder sofort, in eigener Sprache |
| **Plan created**  | 2026-09-14                                                          |
| **Status**        | Done                                                                |

## Overview

Seit 0045 entsteht jede Meldung an einer Stelle (`notify()`) und trägt dort
den Vermerk, ob sie als Push hinausgehen darf. E-Mail ist deshalb kein
zweites Meldungssystem, sondern ein **zweiter Vermerk an derselben Zeile**
und ein **zweiter Abholer**. Das ist der Stufenplan aus dem MVP-Schnitt
(§10.2, Kandidat ④): geteilte Logik in den Edge Functions jetzt, ein eigener
Messaging-Dienst erst, wenn Billing produktiv Mails verschickt.

Anders als Push hat dieser Kanal seinen Transport: Sandro hat am 2026-09-14
den Infomaniak-Zugang für `info@my-club.ch` gegeben. Er liegt als Secret der
Edge Function, nie im Repository (BR-212).

Gegenstück im alten Backend: `utils/email.ts` legte Mails in eine
Firestore-Collection und überliess sie der Firebase-Extension; die Vorlagen
aus `myclubapp/email-templates` (Handlebars auf Litmus-Tabellenlayout) geben
das Gerüst – Kopfband, Gruss, Inhalt, Fusszeile. Die Texte sind neu und
viersprachig.

## Related Use Cases

- UC-028 Benachrichtigungen einstellen — die Matrix, die um eine Spalte wächst
- UC-027 Vereins-Puls — der Puls ist die Wochenmail (BR-211)
- UC-009 / UC-004 — Absage und Beitritts-Entscheid, die dringend sind
- UC-023 / UC-032 — Fürsorge und Befinden, die nie per Mail gehen (BR-210)

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                  | Status vorher | Ziel        | Notizen                                                       |
| ------ | ---------------------- | ------------- | ----------- | ------------------------------------------------------------- |
| FR-164 | Meldungen per E-Mail   | –             | Implemented | Vermerk in `notify()`, Abholer `pending_mail()`, Cron `mail-send` alle 5 min, Edge Function `send-mail` über SMTP 465 |
| FR-165 | E-Mail-Zusammenfassung | –             | Implemented | Modus sofort / täglich 18:00 / wöchentlich So 18:00 / aus; berechnet in `email_decision()` |

### Business Rules

| ID     | Regel                                    | Ziel        | Notizen                                                   |
| ------ | ---------------------------------------- | ----------- | --------------------------------------------------------- |
| BR-210 | Fürsorge und Befinden nie per E-Mail     | Implemented | Erste Prüfung in `email_decision()`, vor jeder Einstellung; die Seite zeigt die Zeilen nicht |
| BR-211 | Zustellung bündelt, Dringlichkeit bricht | Implemented | `notify(..., p_urgent)`; gesetzt in `cancel_event`, `decide_join_request`; Kategorie `pulse` immer sofort |
| BR-212 | Mail-Zugang nie im Repository            | Implemented | Secrets `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `MAIL_FROM_NAME`; 503 mit Nennung der fehlenden Variable |
| BR-213 | Eine Mail je Konto und Lauf              | Implemented | `pending_mail()` nimmt erst Konten, dann deren Zeilen; Sperre `email_claimed_at` 10 min |
| BR-117 | Die Inbox ist nicht abschaltbar          | unverändert | `email_wanted` ist ein Vermerk, die Zeile entsteht immer  |
| BR-120 | Sicherheitsrelevante Zustellungen        | unverändert | Magic Link bleibt bei Supabase Auth                       |

---

## Current State (vor der Umsetzung)

- `notify()` (0045) schreibt `push_wanted`/`push_after`; kein E-Mail-Vermerk.
- Kein Versand irgendeiner Art: keine Edge Function für Push oder Mail, kein
  SMTP-Zugang, keine Sprache auf dem Server (i18next hält sie im Gerät).
- Architektur §3.3 und die Edge-Function-Tabelle nennen einen wöchentlichen
  Digest `jobs-digest`, gebaut war nichts davon.

## Tasks

| # | Task | Status | Dateien |
|---|------|--------|---------|
| 1 | Migration: `email`, `email_mode`, `locale` an `notification_settings`; `email_*` an `notifications`; `email_decision()`; `notify()` mit `p_urgent`; `cancel_event`/`decide_join_request` dringend; `set_notification_settings` erweitert; `set_locale()`; `pending_mail()`, `mark_mail_sent()`, `mark_mail_failed()`; `send_pending_mail()` + Cron `mail-send` | Done | `supabase/migrations/0084_email_notifications.sql` |
| 2 | Edge Function `send-mail`: Betriebsarten `run` und `test`, SMTP über denomailer, Gruppierung je Konto, Quittung | Done | `supabase/functions/send-mail/index.ts` |
| 3 | Vorlage viersprachig, HTML und Text, Vereinsfarbe, Links nur mit `APP_URL` | Done | `supabase/functions/send-mail/template.ts`, `template_test.ts` (8 Tests) |
| 4 | App: `EMAIL_CATEGORIES`, `EMAIL_MODES`, `isEmailEnabled()`, `toEmailMode()` | Done | `app/src/lib/notifications.ts` (+ 6 Tests) |
| 5 | App: Hook liest und schreibt `email`, `email_mode`, `locale` | Done | `app/src/hooks/useNotificationSettings.ts` |
| 6 | App: Abschnitt «E-Mail» mit Modus und Kategorien | Done | `app/src/pages/NotificationsPage.tsx` |
| 7 | App: Sprache beim Anmelden und Sprachwechsel an den Server | Done | `app/src/hooks/useLocaleSync.ts`, `app/src/components/LocaleSync.tsx`, `App.tsx` |
| 8 | i18n in vier Sprachen | Done | `notifications.email*` |
| 9 | Betrieb: Secrets gesetzt, Function deployt, Probemail an `info@my-club.ch` (HTTP 200), Migration per `db query` eingespielt und als applied repariert | Done | — |
| 10 | Docs: UC, Requirements, README, Entitätsmodell, Testplan | Done | — |

## Verhaltensprüfung (2026-09-14, gegen das Remote-Projekt)

`email_decision()` mit elf Fällen, `notify()`, `pending_mail()` zweimal
(Sperre), alles in einem `do`-Block mit `raise exception` zurückgerollt:

| Fall | Ergebnis |
|---|---|
| täglich, 10:00 | fällig 14.09. 18:00 |
| täglich, 19:00 | fällig 15.09. 18:00 |
| wöchentlich, Montag | fällig So 20.09. 18:00 |
| wöchentlich, Sonntag 19:00 | fällig So 27.09. 18:00 |
| dringend bei täglich · Puls bei wöchentlich | sofort |
| health bei sofort · checkin bei täglich | nie |
| aus, auch dringend · Kategorie abgewählt | nie |
| ohne Zeile in `notification_settings` | täglich 18:00 |
| `notify()` sofort-Modus | `email_wanted` true, `email_after` null |
| `pending_mail()` | 1 Zeile mit Adresse; zweiter Abruf 0 Zeilen (Sperre), `email_attempts` 1 |

Probemail: `{mode:'test', to:'info@my-club.ch'}` → `{"sent":1}` über Port 465.
**Port 587 mit STARTTLS scheitert in der Edge-Laufzeit** (`invalid cmd` aus
denomailer, unbehandelte Ablehnung beendet den Isolate → leeres 503).
Deshalb 465 mit TLS von Anfang an, und ein `unhandledrejection`-Fänger, damit
ein SMTP-Fehler den Aufrufer als 502 mit Text erreicht statt als leeres 503.

## Offene Punkte

- ~~`APP_URL` ist nicht gesetzt~~ — **erledigt am 2026-09-14**:
  `APP_URL=https://app.my-club.ch`. Die Mail trägt seither beide Links
  (`/tabs/agenda?event=…` und `/tabs/profile/notifications`), gemessen an der
  gerenderten Vorlage und mit einer Probemail bestätigt.
- **Bestandskonten aus der Übernahme (UC-040):** Der alte Wert `settingsEmail`
  wird nicht mitgenommen; alle Konten starten mit «täglich». Betroffen sind
  nur Konten mit `user_id`, also registrierte Personen.
- Die Puls-Wochenmail nutzt heute dieselbe Vorlage wie jede Meldung (Titel,
  Intro). Eine eigene Form mit den drei Abschnitten gehört zum Vorhaben
  «Puls-Karte» (Meldungslandkarte, Abschnitt 5).

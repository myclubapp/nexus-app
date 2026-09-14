# Manual Test Plan: UC-044 — Meldungen per E-Mail erhalten

**Use Case:** [UC-044](../use_cases/UC-044-meldungen-per-email.md)
**Geltungsbereich:** Zustellmodus, Kategorien, Dringlichkeit, Sprache, Versand und Quittung
**Anforderungen:** FR-164, FR-165
**Regeln:** BR-210, BR-211, BR-212, BR-213 (BR-117, BR-120 unverändert)
**Erstellt:** 2026-09-14

## Vorbereitung

- **M** — Mitglied mit E-Mail-Adresse am Konto, **V** — Vorstand desselben Vereins.
- Migration `0084_email_notifications.sql` ist eingespielt, `send-mail` deployt, die sechs SMTP-Secrets gesetzt.
- Zugriff auf das Postfach von **M** und auf die Datenbank (`notifications`).

---

## TC-001: Der Abschnitt «E-Mail» (Hauptablauf Schritte 1–4, FR-165)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** Profil → «Benachrichtigungen» öffnen | Unter «Push je Kategorie» steht ein Abschnitt «E-Mail» | | |
| 2 | Die Zustellung ansehen | Vorgabe «Täglich um 18:00 gebündelt»; Auswahl Sofort / Täglich / Wöchentlich / Keine E-Mail | | |
| 3 | Die Kategorien darunter zählen | Termine, Punkte, Aufgaben, News, Vereins-Puls, Vorschläge und Anliegen, Anschlüsse, Beitritte – **ohne** Hinweise und Befinden (BR-210) | | |
| 4 | Die Fussnote lesen | Nennt Absagen, Beitritts-Entscheid und Puls als «immer sofort» und Fürsorge/Befinden als «nie per E-Mail» | | |
| 5 | «Keine E-Mail» wählen | Die Kategorien verschwinden; die Fussnote sagt, dass die Inbox weiterhin alles enthält | | |
| 6 | «Sofort» wählen, «Aufgaben» abwählen, speichern | Toast «Gespeichert» | | |
| 7 | Seite neu laden | Modus «Sofort», «Aufgaben» aus | | |
| 8 | In `notification_settings` die Zeile von **M** prüfen | `email_mode = 'immediate'`, `email = {"task": false}`, `locale` = Sprache der App | | |

---

## TC-002: Die Zeile trägt den Vermerk (Schritt 5, BR-117)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **M** steht auf «Sofort» (TC-001). Als **V** einen Termin ankündigen | — | | |
| 2 | In `notifications` die neue Zeile von **M** prüfen | `email_wanted = true`, `email_after` leer | | |
| 3 | Als **V** eine Aufgabe publizieren (Kategorie abgewählt) | Zeile entsteht in der Inbox, `email_wanted = false` | | |
| 4 | Als **M** die Inbox öffnen | Beide Meldungen sind da (BR-117) | | |

---

## TC-003: Bündelung und Dringlichkeit (A1, BR-211)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** «Täglich» wählen und speichern | — | | |
| 2 | Als **V** einen Termin ankündigen | Zeile von **M**: `email_after` = heute 18:00 Europe/Zurich (oder morgen, wenn es schon später ist) | | |
| 3 | Als **V** denselben Termin absagen | Zeile «Abgesagt: …»: `email_after` leer – sofort | | |
| 4 | Als **V** den Vereins-Puls freigeben | Zeile «Der Vereins-Puls»: `email_after` leer – sofort | | |
| 5 | Als **M** «Wöchentlich» wählen; als **V** eine News publizieren | `email_after` = nächster Sonntag 18:00 | | |
| 6 | Als **M** «Keine E-Mail» wählen; als **V** einen Termin absagen | `email_wanted = false` – «aus» gilt auch für Dringendes | | |

---

## TC-004: Versand und Quittung (Schritte 6–7, BR-213)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **M** auf «Sofort»; als **V** zwei Termine kurz nacheinander ankündigen | Zwei Zeilen mit `email_wanted = true` | | |
| 2 | Bis zu fünf Minuten warten (Cron `mail-send`) oder `select send_pending_mail()` ausführen | — | | |
| 3 | Postfach von **M** prüfen | **Eine** Mail mit Betreff «{Verein}: 2 neue Meldungen», Kopfband in der Vereinsfarbe, Gruss mit Anzeigename, beide Meldungen mit Kategorie und Zeit in Europe/Zurich | | |
| 4 | Die zwei Zeilen prüfen | `email_sent_at` gesetzt, `email_error` leer, `email_attempts = 1` | | |
| 5 | Nur eine Meldung erzeugen und warten | Betreff «{Verein}: {Titel}» | | |

---

## TC-005: Sprache (A4)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** die App auf Französisch stellen | `notification_settings.locale = 'fr'` (ohne die Seite zu speichern) | | |
| 2 | Eine Meldung auslösen und die Mail abwarten | «Bonjour {Name}», Kategorien und Fusszeile auf Französisch | | |

---

## TC-006: Versand scheitert und Konto ohne Adresse (A2, A3, BR-212)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Secret `SMTP_PASSWORD` auf einen falschen Wert setzen, Function neu deployen, `send-mail` mit `{mode:'test', to:…}` aufrufen | HTTP 502 mit Fehlertext des Servers, kein leeres 503 | | |
| 2 | Secret `SMTP_HOST` entfernen, aufrufen | HTTP 503 «Secret SMTP_HOST fehlt» | | |
| 3 | Secrets wiederherstellen; mit falschem Kennwort einen Lauf abwarten | Zeilen: `email_error` gesetzt, `email_claimed_at` leer, `email_attempts` zählt hoch; nach 5 Versuchen keine weiteren | | |
| 4 | Ein Konto ohne E-Mail-Adresse (etwa Telefon-Anmeldung) benachrichtigen | `email_wanted = false`, `email_error = 'Konto ohne E-Mail-Adresse'` | | |

---

## TC-007: Nie per E-Mail (BR-210)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** mit «Sofort» ein Fürsorge-Signal auslösen (etwa `health-detect`) | Zeile «Ein Hinweis wartet auf dich»: `email_wanted = false` | | |
| 2 | Als **M** einen Termin besuchen, Check-in-Frage abwarten | Zeile «Wie ging es dir?»: `email_wanted = false` | | |
| 3 | In `notification_settings.email` von Hand `{"health": true}` setzen und Schritt 1 wiederholen | Weiterhin `email_wanted = false` – die Regel steht über der Einstellung | | |

# Manual Test Plan: UC-028 — Benachrichtigungen einstellen

**Use Case:** [UC-028](../use_cases/UC-028-benachrichtigungen-einstellen.md)
**Geltungsbereich:** Kategorien, stille Zeiten, Geräte, Unabschaltbarkeit der Inbox
**Anforderungen:** FR-080, FR-081 (FR-079 bleibt offen)
**Regeln:** BR-117, BR-118, BR-120 (BR-119 betrifft den Transport)
**Erstellt:** 2026-09-10

## Vorbereitung

- **M** — Mitglied, **V** — Vorstand desselben Vereins.
- Migration `0045_notification_settings.sql` ist eingespielt.

---

## TC-001: Die Matrix (Hauptablauf, FR-080, BR-118)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** Profil → «Benachrichtigungen» öffnen | Die Seite öffnet sich | | |
| 2 | Den ersten Abschnitt lesen | «Die Inbox» steht zuoberst, mit **Begründung**, warum sie nicht abschaltbar ist (Schritt 3, BR-117) | | |
| 3 | Nach einem ausgegrauten Inbox-Schalter suchen | Es gibt keinen – die Regel steht als Satz da, nicht als tote Bedienung | | |
| 4 | Die Kategorien ansehen | Termine, Punkte, Aufgaben, News, Puls, Hinweise, Beitritte – je mit Erklärung | | |
| 5 | Den Hinweis unter der Matrix lesen | Er sagt offen, dass Push noch nicht in Betrieb ist, die Wahl aber ab sofort gilt | | |
| 6 | «Termine» abwählen und speichern | Toast «Gespeichert» | | |
| 7 | Die Seite neu laden | Der Schalter steht weiterhin auf «aus» | | |

---

## TC-002: Die Inbox bleibt (BR-117)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Mit abgewählter Kategorie «Termine» als **V** einen Termin ankündigen | — | | |
| 2 | Als **M** die Inbox öffnen | Die Nachricht ist **da** (BR-117) | | |
| 3 | In der Datenbank `push_wanted` an dieser Zeile prüfen | `false` – abgewählt ist nur der Push-Vermerk | | |
| 4 | Eine Nachricht einer **nicht** abgewählten Kategorie prüfen | `push_wanted` ist `true` | | |

---

## TC-003: Stille Zeiten (A3, FR-081)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Nachts kein Push» einschalten | Zwei Zeitfelder erscheinen, vorbelegt mit 22:00 und 07:00 | | |
| 2 | Speichern | Toast bestätigt | | |
| 3 | **Die Kategorien erneut prüfen** | Die zuvor abgewählte Kategorie ist **weiterhin** abgewählt | | |
| 4 | Beide Zeiten gleich setzen | Speichern sperrt und erklärt warum | | |
| 5 | Eine Zeit leeren | Ebenso – ein halbes Fenster ist kein Fenster | | |
| 6 | Mit aktivem Fenster nachts eine Benachrichtigung erzeugen | In der Inbox sofort da; `push_after` steht auf das Ende des Fensters | | |
| 7 | Dasselbe am Nachmittag | `push_after` bleibt leer | | |
| 8 | Ein Fenster über Mitternacht (22:00–07:00) um 23 Uhr prüfen | Es greift – das Fenster darf den Tag überschreiten | | |

---

## TC-004: Geräte (A4)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Abschnitt «Registrierte Geräte» ansehen | «Noch kein Gerät registriert», mit Erklärung | | |
| 2 | Von Hand einen Eintrag in `push_tokens` anlegen | Er erscheint mit Plattform und Datum | | |
| 3 | «Abmelden» wählen | Er verschwindet | | |
| 4 | `forget_device` mit dem Gerät einer **anderen** Person aufrufen | Abgewiesen | | |

---

## TC-005: Fremde Einstellungen und Sicherheit (BR-120)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** die Einstellungen von **M** abfragen | Leer – sie gehören dem Konto | | |
| 2 | Als **V** eigene Einstellungen setzen | **M** bleibt unverändert | | |
| 3 | Die Fussnote unten lesen | Anmeldelinks und Kontolöschung laufen über E-Mail und bleiben unberührt (BR-120) | | |
| 4 | Sich abmelden und einen Anmeldelink anfordern | Er kommt per E-Mail – unabhängig von jeder Einstellung | | |

---

## Vier Sprachen

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch, Italienisch und Englisch stellen | Kategorien, Erklärungen und Hinweise sind übersetzt | | |

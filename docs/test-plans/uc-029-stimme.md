# Manual Test Plan: UC-029 — Anliegen erfassen und adressieren

**Use Case:** [UC-029](../use_cases/UC-029-sprachmemo-aufnehmen.md)
**Geltungsbereich:** Arten, Adressierung, Anonymität, Privatheit, Kontingent
**Anforderungen:** FR-086 bis FR-090 (FR-085 bleibt offen)
**Regeln:** BR-121 bis BR-124, BR-126, BR-127 (BR-125 betrifft die Transkription)
**Erstellt:** 2026-09-10

## Vorbereitung

- **V** — Vorstand, **TR** — Trainer:in von Team «Aktive».
- **A** — Mitglied in «Aktive», **B** — unbeteiligtes Mitglied.
- Migration `0046_voice_notes.sql` ist eingespielt.

---

## TC-001: Privates bleibt privat (FR-087, FR-088, BR-123)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **A** Profil → «Stimme» öffnen | Der Hinweis oben sagt offen, dass die Aufnahme noch fehlt und warum | | |
| 2 | «Anliegen erfassen» wählen, Art «Für mich», Text schreiben, absenden | Toast «Gespeichert. Das bleibt bei dir.» | | |
| 3 | Als **V** die Seite öffnen | Das Anliegen von **A** ist **nicht** da (BR-123) | | |
| 4 | Als **V** `voice_notes` direkt abfragen | Ebenfalls nicht – die Policy hält, nicht die Abfrage | | |
| 5 | Als **TR** dasselbe versuchen | Ebenfalls nicht | | |
| 6 | Als **TR** ein Trainer-Logbuch schreiben | Die Art steht nur Trainer:innen zur Wahl | | |
| 7 | Als **A** prüfen, ob die Art «Trainer-Logbuch» angeboten wird | Nein | | |
| 8 | Prüfen, ob wegen eines privaten Anliegens jemand benachrichtigt wurde | Niemand | | |

---

## TC-002: Gerichtetes Feedback (FR-089)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **A** ein Anliegen «An die Trainer:innen» senden | Es entsteht | | |
| 2 | Als **TR** die Inbox prüfen | Meldung «Ein Anliegen ist eingegangen» | | |
| 3 | Den Text der Meldung ansehen | Er enthält das Anliegen **nicht** – das gehört in die App, nicht auf einen Sperrbildschirm | | |
| 4 | Als **TR** die Seite öffnen | Das Anliegen steht da | | |
| 5 | Als **V** dieselbe Seite | Es steht **nicht** da – gemeint waren Trainer:innen | | |
| 6 | Als **B** prüfen | Ebenfalls nicht | | |
| 7 | Ein Anliegen «An den Vorstand» senden | **V** sieht es, **TR** nicht | | |
| 8 | Ein Anliegen an eine **Person** senden | Nur diese Person sieht es | | |

---

## TC-003: Anonym (FR-090, BR-122)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **A** die Art «Anonym an den Vorstand» wählen | Der Hinweis erklärt das Ticket auf dem Gerät | | |
| 2 | Absenden | Toast bestätigt | | |
| 3 | Als **V** das Anliegen ansehen | Es steht da, **ohne** jede Angabe zur Person | | |
| 4 | In der Datenbank die Zeile prüfen | `author_member_id` leer, `created_at` leer, nur die Kalenderwoche | | |
| 5 | Versuchen, per SQL eine anonyme Zeile **mit** Autor einzufügen | Vom Constraint abgewiesen – die Anonymität steht im Schema (BR-122) | | |
| 6 | Dasselbe mit Zeitstempel | Ebenfalls abgewiesen | | |
| 7 | Im Browser-Speicher nachsehen | Das Ticket liegt dort, der Server kennt nur den Prüfwert | | |

---

## TC-004: Der Text geht so raus, wie er dasteht (BR-121)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Ein Anliegen ohne Text absenden wollen | Gesperrt, mit Begründung | | |
| 2 | Den Text mit Leerzeichen davor und danach schreiben | Er wird getrimmt gespeichert | | |
| 3 | Die Fussnote unter dem Textfeld lesen | «Was hier steht, geht so raus» | | |
| 4 | Ein Anliegen «An eine Person» ohne Person absenden wollen | Gesperrt | | |

---

## TC-005: Kontingent (A5)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Zähler oben ablesen | «Diesen Monat noch N Anliegen möglich» | | |
| 2 | `clubs.settings.voice.monthlyQuota` auf 1 setzen und ein Anliegen senden | Der Zähler steht auf 0 | | |
| 3 | Ein weiteres senden wollen | Der Knopf ist gesperrt; direkt aufgerufen wird es abgewiesen | | |
| 4 | Prüfen, ob das Kontingent auch für anonyme Anliegen zählt | Ja – es zählt die Person, ohne sie am Anliegen festzuhalten | | |

---

## TC-006: Keine Auswertung (BR-126)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Nach einer Suche über fremde Anliegen suchen | Es gibt keine | | |
| 2 | Nach einem Export suchen | Es gibt keinen | | |
| 3 | Die Indizes auf `voice_notes` prüfen | Keiner über `transcript` – kein Volltext, kein Schlagwort-Scan | | |

---

## Vier Sprachen

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch, Italienisch und Englisch stellen | Arten, Hinweise und der Anonymitäts-Hinweis sind übersetzt | | |

# Manual Test Plan: UC-021 — Punkte manuell buchen oder korrigieren

**Use Case:** [UC-021](../use_cases/UC-021-punkte-manuell-buchen.md)
**Geltungsbereich:** Buchung von Hand, Sammelbuchung, Gegenbuchung, Notizpflicht, Unveränderlichkeit
**Anforderungen:** FR-042, FR-043
**Regeln:** BR-085 bis BR-088
**Erstellt:** 2026-09-09

## Vorbereitung

- **V** — Vorstand (`admin`), **TR** — Trainer:in, **M1** und **M2** — Mitglieder.
- **M1** hat bereits automatische Buchungen (Training, Aufgabe).
- Migration `0038_manual_points.sql` ist eingespielt.

---

## TC-001: Buchen (Hauptablauf)

**Priority:** High
**Preconditions:** Als **V** in der Mitgliederverwaltung.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **M1** öffnen | Das Blatt zeigt unten den Abschnitt «Punktebuchungen» mit den letzten Buchungen | | |
| 2 | Dort «Buchen» wählen | Das Mitgliedsblatt schliesst, das Buchungsblatt öffnet sich – **M1** ist vorausgewählt | | |
| 3 | Die Felder prüfen | Mitglieder, Säule, Punkte, Anlass (Schritt 2) | | |
| 4 | Säule und Punktwert setzen, Anlass schreiben, buchen | Toast «1 Buchung erstellt» | | |
| 5 | **M1** erneut öffnen | Die Buchung steht zuoberst, mit dem **Anlass** als Überschrift | | |
| 6 | Als **M1** die Inbox öffnen | Nachricht «Punkte gutgeschrieben» mit Anlass und Wert (Schritt 7) | | |
| 7 | Als **M1** die Punktehistorie öffnen | Die Buchung steht da und lässt sich nach ihrer Säule filtern | | |
| 8 | Den Punktestand auf dem Dashboard prüfen | Er ist um den Wert gestiegen | | |

---

## TC-002: Notizpflicht und Vorzeichen (A2, BR-086, BR-087)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Ein Buchungsblatt öffnen, ohne etwas auszufüllen | «Buchen» ist gesperrt | | |
| 2 | Die Hinweise lesen | Sie nennen die fehlende Person **und** den fehlenden Anlass | | |
| 3 | Alles ausser dem Anlass ausfüllen | Weiterhin gesperrt, der Hinweis bleibt stehen | | |
| 4 | Einen Punktwert **0** eingeben | Gesperrt, mit dem Hinweis, dass ein Abzug nur als Korrektur entsteht | | |
| 5 | Einen negativen Wert eingeben | Ebenso | | |
| 6 | `book_points_manually` direkt mit leerer Notiz aufrufen | Serverseitig abgewiesen | | |

---

## TC-003: Sammelbuchung (A3)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | In der Mitgliederverwaltung oben «Punkte buchen» wählen | Das Blatt öffnet sich ohne Vorauswahl | | |
| 2 | **M1** und **M2** wählen, Wert und Anlass setzen, buchen | Toast «2 Buchungen erstellt» | | |
| 3 | Beide Mitglieder prüfen | Jedes hat **eine** Buchung mit demselben Wert und demselben Anlass | | |
| 4 | Beide Inboxen prüfen | Beide wurden benachrichtigt | | |

---

## TC-004: Korrektur (A1, BR-085)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **M1** öffnen und bei einer Buchung «Korrigieren» wählen | Das Blatt zeigt die ursprüngliche Buchung und die vorgeschlagene Gegenbuchung mit umgekehrtem Vorzeichen | | |
| 2 | Ohne Begründung bestätigen wollen | Gesperrt, mit Hinweis | | |
| 3 | Eine Begründung schreiben und bestätigen | Toast «Ausgeglichen. Die ursprüngliche Buchung bleibt stehen.» | | |
| 4 | Den Ledger von **M1** ansehen | **Zwei** Zeilen: das Original unverändert und die Gegenbuchung (BR-085) | | |
| 5 | Den Punktestand prüfen | Er ist um den Betrag gesunken, die Summe stimmt | | |
| 6 | Die Saison der Gegenbuchung prüfen | Sie liegt in der Saison des **Originals**, nicht in der laufenden | | |
| 7 | Dieselbe Buchung ein zweites Mal korrigieren wollen | Abgewiesen (BR-088) | | |
| 8 | Bei der **Gegenbuchung** nach «Korrigieren» suchen | Es gibt keinen Knopf; direkt aufgerufen wird es abgewiesen | | |
| 9 | Als **M1** die Inbox prüfen | Nachricht «Buchung korrigiert» mit Begründung | | |

---

## TC-005: Der Ledger ist unveränderlich (BR-085)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** über die REST-Schnittstelle eine Buchung ändern wollen | Es wird **keine** Zeile geändert – die Antwort ist leer, nicht ein Fehler | | |
| 2 | Als **V** eine Buchung löschen wollen | Ebenso: null Zeilen | | |
| 3 | Die Buchung erneut ansehen | Unverändert | | |
| 4 | In der Oberfläche nach «Löschen» oder «Ändern» suchen | Gibt es nicht – nur «Korrigieren» | | |

---

## TC-006: Rollen (A4)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **TR** die Mitgliederverwaltung öffnen | **Kein** «Punkte buchen» in der Kopfzeile, kein Ledger im Mitgliedsblatt | | |
| 2 | Als **TR** `book_points_manually` direkt aufrufen | Abgewiesen – die Voraussetzung nennt ausdrücklich `admin` | | |
| 3 | Als **M1** dasselbe | Abgewiesen | | |
| 4 | Als **V** für ein Mitglied eines **fremden** Vereins buchen | Abgewiesen | | |

---

## Vier Sprachen

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch, Italienisch und Englisch stellen | Buchungsblatt, Hinweise, Säulen und Meldungen sind übersetzt, kein Schlüssel steht im Klartext | | |

# Manual Test Plan: UC-019 — Aufgabe bestätigen und Kudos geben

**Use Case:** [UC-019](../use_cases/UC-019-aufgabe-bestaetigen.md)
**Geltungsbereich:** Bestätigung, Kudos, Punkteregel, Nachbesserung, Doppelbuchung, Selbstbestätigung
**Anforderungen:** FR-054, FR-055
**Regeln:** BR-065, BR-077 bis BR-080
**Erstellt:** 2026-09-09

## Vorbereitung

- **V** — Vorstand, **TR** — Trainer:in, **M1** und **M2** — Mitglieder.
- Punkteregel `task_done` besteht mit **20** Punkten und ist aktiv (UC-016).
- Vier ausgeschriebene und von **M1** übernommene und gemeldete Aufgaben:
  - **A1** «Bewilligung», Punktwert **50**.
  - **A2** «Nur Dank», Punktwert **0**.
  - **A3** «Zu zweit», zwei Plätze, von **M1** und **M2** übernommen und gemeldet.
  - **A4** «Nachbessern», mit Nachweis-Link.
- Migration `0036_task_confirmation.sql` ist eingespielt.

---

## TC-001: Bestätigen mit Dankeswort (Hauptablauf)

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Inbox öffnen | Nachricht «Aufgabe erledigt gemeldet» mit Titel und Name (Schritt 1) | | |
| 2 | Marktplatz öffnen | Zuoberst «Wartet auf deine Bestätigung» – vor dem Angebot (Schritt 2) | | |
| 3 | **A1** antippen | Das Blatt zeigt **M1**, den Einreichungszeitpunkt und den Nachweis (Schritt 3) | | |
| 4 | Nach einer Punktzahl im Blatt suchen | Es steht **keine** – die Zahl ist nicht die Überschrift (BR-078) | | |
| 5 | Ein Dankeswort schreiben und «Bestätigen» wählen | Toast: erst der Dank, dann «dazu 50 Punkte» | | |
| 6 | Als **M1** die Inbox öffnen | Die Nachricht trägt das **Dankeswort als Titel**, die Zahl steht im Text (Schritt 7, BR-078) | | |
| 7 | Als **M1** das Profil öffnen | Der Abschnitt «Dank» steht **über** der Punktehistorie und zeigt das Wort (Schritt 8) | | |
| 8 | Die Punktehistorie prüfen | Eine Buchung über **50** – der Wert der Aufgabe, nicht die 20 der Regel (BR-077) | | |
| 9 | Den Marktplatz erneut ansehen | **A1** ist weg – sie ist erledigt | | |

---

## TC-002: Ohne Dankeswort (A2)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Einreichung öffnen, ohne ins Feld zu schreiben | Der Hinweis «Ein Dankeswort wirkt mehr als die Zahl» steht da | | |
| 2 | Ein Zeichen tippen | Der Hinweis verschwindet | | |
| 3 | Das Feld wieder leeren und «Bestätigen» wählen | Es geht trotzdem – der Hinweis sperrt nicht | | |
| 4 | Als Mitglied die Inbox prüfen | Die Nachricht trägt einen Standard-Dank als Titel, nie eine nackte Zahl | | |

---

## TC-003: Nur Dank (A3, FR-040)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **A2** («Nur Dank», 0 Punkte) bestätigen | Toast nennt den Dank, **ohne** Punktzahl | | |
| 2 | Die Punktehistorie des Mitglieds prüfen | **Keine** Buchung | | |
| 3 | Die Inbox des Mitglieds prüfen | Nachricht mit Dank, **ohne** «0 Punkte» | | |
| 4 | Den Status der Aufgabe prüfen | Erledigt – die Anerkennung hängt nicht an der Zahl | | |

---

## TC-004: Punkteregel und Häufigkeitsgrenze (BR-065)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | In den Punkteregeln `task_done` **deaktivieren** | — | | |
| 2 | Eine Einreichung bestätigen | Bestätigt, Toast **ohne** Punktzahl | | |
| 3 | Die Punktehistorie prüfen | **Keine** Buchung – die abgeschaltete Säule wirkt (BR-065) | | |
| 4 | Den Status der Aufgabe prüfen | Trotzdem erledigt | | |
| 5 | `task_done` wieder aktivieren und auf **1 pro Woche** begrenzen | — | | |
| 6 | Demselben Mitglied zwei Aufgaben in derselben Woche bestätigen | Die zweite bucht **nicht** – die Grenze wirkt in der Buchungsfunktion | | |
| 7 | Prüfen, ob das Frontend die Grenze umgehen kann | Nein – sie steht ausschliesslich im Server | | |

---

## TC-005: Keine Doppelbuchung (A4, BR-079)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine bereits bestätigte Übernahme erneut öffnen | Es gibt keinen zweiten «Bestätigen»-Knopf | | |
| 2 | `confirm_task` direkt ein zweites Mal aufrufen | Ergebnis `0 / false`, still verworfen | | |
| 3 | Die Punktehistorie prüfen | Genau **eine** Buchung zur Aufgabe | | |
| 4 | Die Inbox des Mitglieds prüfen | Genau **eine** Nachricht, das Dankeswort unverändert | | |

---

## TC-006: Selbstbestätigung (BR-080)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **TR** eine Aufgabe selbst übernehmen und melden | Gelingt | | |
| 2 | Als **TR** den Marktplatz öffnen | Die eigene Aufgabe steht **nicht** unter «Wartet auf deine Bestätigung» | | |
| 3 | Das Blatt einer Aufgabe öffnen, in der auch die eigene Meldung offen ist | Der Hinweis «Deine eigene Übernahme bestätigt jemand anderes» steht da, ohne Knopf | | |
| 4 | `confirm_task` für die eigene Übernahme direkt aufrufen | Abgewiesen | | |
| 5 | Als **V** dieselbe Übernahme bestätigen | Gelingt | | |

---

## TC-007: Nachbesserung (A1)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **A4** öffnen und «Nachbessern» wählen | Ein zweites Feld erscheint | | |
| 2 | «Zurück an die Person» ohne Text versuchen | Gesperrt, und der Grund steht da | | |
| 3 | Einen Hinweis schreiben und senden | Toast «Zurückgegeben. Die Person weiss, was noch fehlt.» | | |
| 4 | Als **M1** die Inbox prüfen | Nachricht mit dem Aufgabentitel und dem Hinweis im Text | | |
| 5 | Als **M1** die Aufgabe öffnen | Sie steht wieder unter «Von mir übernommen», mit «Erledigt melden» | | |
| 6 | Prüfen, ob die Übernahme verloren ging | Nein – nur die Meldung ist zurückgenommen | | |
| 7 | Prüfen, ob Punkte gebucht wurden | Keine | | |
| 8 | Eine **bestätigte** Übernahme zurückweisen versuchen | Abgewiesen | | |

---

## TC-008: Mehrere Übernehmende (A2 aus UC-018)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **A3** öffnen | Beide Namen stehen da, je mit eigenem Dankesfeld | | |
| 2 | Zwei **verschiedene** Dankesworte schreiben und einzeln bestätigen | Jede Person bekommt **ihren** Satz, nicht denselben | | |
| 3 | Nach der ersten Bestätigung den Status prüfen | Die Aufgabe ist **noch nicht** erledigt – **M2** verliert sie nicht unter den Händen | | |
| 4 | Nach der zweiten Bestätigung | Erst jetzt erledigt | | |
| 5 | Die Buchungen prüfen | Je Person eine, beide mit dem Wert der Aufgabe | | |

---

## TC-009: Nachweis (Sicherheit)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Einreichung mit Nachweis öffnen | Der Verweis steht als **Text**, nicht als anklickbarer Link | | |
| 2 | Die Fussnote lesen | Sie sagt, dass die Quelle fremd ist und man ihr trauen muss | | |

---

## Vier Sprachen

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch, Italienisch und Englisch stellen | Bestätigungs-Blatt, Hinweise, Toasts und der Abschnitt «Dank» sind übersetzt, kein Schlüssel steht im Klartext | | |

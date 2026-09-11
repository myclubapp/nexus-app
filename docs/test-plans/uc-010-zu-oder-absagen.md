# Manual Test Plan: UC-010 — Auf einen Termin zu- oder absagen

**Use Case:** [UC-010](../use_cases/UC-010-zu-oder-absagen.md)
**Geltungsbereich:** Zusage, Absage mit Grund, Abmeldeprämie, Teilnehmerstand, Sperren
**Anforderungen:** FR-024, FR-025, FR-026, FR-027
**Regeln:** BR-037 bis BR-040
**Erstellt:** 2026-09-09

## Vorbereitung

- Ein Verein mit dem Team «Aktive» (vier Mitglieder) und weiteren Mitgliedern
  ausserhalb dieses Teams.
- **M** — Mitglied im Team «Aktive», **T** — Trainer:in, **V** — Vorstand.
- Termine, die vor dem Test angelegt werden:
  - **E1** Team-Termin «Aktive», Beginn **in 48 Stunden**, Regel «Training besucht»
  - **E2** Team-Termin «Aktive», Beginn **in 3 Stunden**
  - **E3** Vereinstermin, Beginn in 48 Stunden
  - **E4** Termin, der **bereits begonnen** hat
- Die Regel `decline_early` («Rechtzeitig abgemeldet», 5 Punkte) ist aktiv.
- Migration `0017_attendance_response.sql` ist eingespielt.

---

## TC-001: Zusagen (Hauptablauf)

**Priority:** High
**Preconditions:** Als **M** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Agenda» öffnen | **E1** und **E2** stehen da, **E3** ebenfalls | | |
| 2 | Die Zeile von **E1** ansehen | Links ein gelbes Fragezeichen (noch offen), rechts die Zahl **0**; darüber die Spaltenköpfe «Status» und «Teilnehmer» | | |
| 3 | Die Zeile nach rechts wischen und den grünen Haken antippen – alternativ das Fragezeichen antippen | Toast **oben**; links steht jetzt ein grüner Haken, rechts die **1** | | |
| 4 | Die Zahl rechts antippen | Das Detail öffnet sich als Karte über der Seite: Eckdaten mit Symbolen, «Mein Status» als grüner runder Knopf, die Liste «Zugesagt: 1» mit dem eigenen Namen, «Keine Antwort: 3» zugeklappt | | |
| 5 | Als **T** die Agenda öffnen | Unter **E1** steht zusätzlich «1 zugesagt · 0 abgesagt · 3 offen» – die Zahlen sieht nur, wer plant | | |
| 6 | Bei **E3** (Vereinstermin) den Stand ablesen | Die Grundlage ist der **ganze Verein**, nicht das Team | | |

---

## TC-002: Absagen mit Grund (A1, FR-026)

**Priority:** High
**Preconditions:** Als **M** angemeldet, **E1** beginnt in 48 Stunden.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **E1** nach rechts wischen und das rote Kreuz antippen – alternativ den grünen Haken am Zeilenanfang | Ein Blatt mit vorformulierten Gründen öffnet sich | | |
| 2 | Die Gründe ansehen | Krank, Arbeit, Familie, Abwesend, Verletzt, Anderer Grund | | |
| 3 | Den Hinweis unten lesen | «Du meldest dich rechtzeitig ab – das zählt für deine Verlässlichkeit» | | |
| 4 | «Anderer Grund» wählen | Ein Freitextfeld erscheint | | |
| 5 | Das Feld leer lassen | «Absage senden» ist ausgegraut | | |
| 6 | «Ferienabwesenheit» eintragen und senden | Toast nennt die **5 Punkte** für die rechtzeitige Abmeldung | | |
| 7 | Die Zeile ansehen und das Detail öffnen | Links ein rotes Kreuz, rechts die **0**; im Detail steht der Name unter «Abgesagt: 1» – den Grund sieht nur **T** | | |
| 8 | Dashboard öffnen | Der Punktestand ist um 5 gestiegen | | |
| 9 | Die Punktehistorie ansehen | Ein Eintrag «Rechtzeitig abgemeldet» | | |
| 10 | Als **T** den Termin ansehen | Die Absage ist im Stand sichtbar | | |

---

## TC-003: Die 24-Stunden-Frist (BR-040)

**Priority:** High
**Preconditions:** Als **M** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Bei **E2** (in 3 Stunden) nach rechts wischen und das rote Kreuz antippen | Der Hinweis lautet «Der Termin beginnt bald. Eine Absage kostet nie Punkte.» | | |
| 2 | «Krank» wählen und senden | Toast **ohne** Punkteangabe | | |
| 3 | Punktestand prüfen | **Unverändert** | | |
| 4 | Punktehistorie prüfen | **Kein** Eintrag für diese Absage | | |
| 5 | Prüfen, ob Punkte **abgezogen** wurden | Nein – eine Absage kostet nie Punkte (BR-039) | | |
| 6 | Einen Termin knapp **über** 24 Stunden absagen | Punkte entstehen | | |
| 7 | Einen Termin knapp **unter** 24 Stunden absagen | Keine Punkte | | |

---

## TC-004: Antwort ändern (A2, BR-037)

**Priority:** High
**Preconditions:** Als **M** angemeldet, **E1** (48 Stunden), noch ohne Antwort.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Zusagen | Stand: 1 zugesagt | | |
| 2 | Absagen mit Grund «Arbeit» | Stand: 0 zugesagt, 1 abgesagt; **5 Punkte** gebucht | | |
| 3 | Wieder zusagen | Stand: 1 zugesagt, 0 abgesagt | | |
| 4 | Punktestand prüfen | Die 5 Punkte **bleiben** – sie werden nicht zurückgenommen (A2) | | |
| 5 | Erneut absagen, Grund «Familie» | Der neue Grund steht am Termin | | |
| 6 | Punktehistorie zählen | **Ein** Eintrag «Rechtzeitig abgemeldet», nicht zwei (BR-040, NFR-017) | | |
| 7 | Den Teilnehmerstand prüfen | Die Person zählt genau **einmal** | | |

---

## TC-005: Abgesagter Termin (A3)

**Priority:** High
**Preconditions:** **T** hat **E3** abgesagt (UC-009 A4) mit Grund «Halle gesperrt».

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** die Agenda öffnen | **E3** zeigt links ein rotes Ausrufezeichen und in der Zeile «Abgesagt: Halle gesperrt» | | |
| 2 | Die Zeile nach rechts wischen und das Symbol antippen | **Keine Wischleiste, das Symbol reagiert nicht** | | |
| 3 | Nach dem Check-in-Knopf suchen | Fehlt ebenfalls | | |
| 4 | Mit einem HTTP-Aufruf `respond_to_event` auf **E3** | Fehler «Dieser Termin wurde abgesagt» | | |

---

## TC-006: Nach Terminbeginn (BR-038)

**Priority:** High
**Preconditions:** **E4** hat bereits begonnen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** die Agenda öffnen, **E4** suchen | Keine Antwortknöpfe mehr | | |
| 2 | Mit einem HTTP-Aufruf `respond_to_event` auf **E4** | Fehler «Der Termin hat begonnen; jetzt zählt die Anwesenheit» | | |
| 3 | Auf «Vergangen» umschalten | **E4** steht dort, ohne Antwortmöglichkeit | | |
| 4 | Einen Termin **eine Minute vor** Beginn absagen | Geht noch – die Grenze ist der Beginn, nicht die Frist | | |

---

## TC-007: Die Regel ist abschaltbar (FR-040, UC-016)

**Priority:** Medium
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Punkteregeln öffnen, Säule «Verlässlichkeit» | «Rechtzeitig abgemeldet» steht dort mit 5 Punkten | | |
| 2 | Die Regel ausschalten | — | | |
| 3 | Als **M** einen Termin rechtzeitig absagen | Toast **ohne** Punkteangabe; keine Buchung | | |
| 4 | Die Regel wieder einschalten und den Wert auf 10 setzen | — | | |
| 5 | Erneut rechtzeitig absagen (anderer Termin) | **10** Punkte | | |
| 6 | Den Wert auf 0 setzen (Nur-Dank) | Eine Absage erzeugt keine Zahl mehr | | |

---

## TC-008: Vier Sprachen

**Priority:** High
**Preconditions:** Als **M** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf Französisch das Absage-Blatt öffnen | Alle sechs Gründe französisch | | |
| 2 | Den Frist-Hinweis lesen | Französisch, je nach Termin die passende Variante | | |
| 3 | Als **T** den Teilnehmerstand ablesen; als **M** das Detail öffnen | «2 oui · 1 non · 3 sans réponse»; im Detail «Mon statut», «Inscrits : 2», «Absents : 1», «Sans réponse : 3» | | |
| 4 | Eine rechtzeitige Absage senden | Der Toast nennt die Punkte auf Französisch | | |
| 5 | Auf Italienisch und Englisch wiederholen | Wie oben (C-007) | | |

---

## TC-009: Darstellung und Netz

**Priority:** Medium
**Preconditions:** Als **M** angemeldet, auf jedem Gerät der Matrix.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Agenda auf dem kleinsten Gerät | Stand und Knöpfe ohne Scrollen erkennbar | | |
| 2 | Die drei Knöpfe antippen | Jeder hat eine Trefferfläche von mindestens 44 × 44 px | | |
| 3 | Das Absage-Blatt öffnen | Die sechs Gründe ohne Scrollen sichtbar | | |
| 4 | Im Dunkelmodus | Der Hinweis «rechtzeitig» bleibt als solcher erkennbar | | |
| 5 | Flugmodus ein, zusagen | Toast **oben** mit Fehlermeldung; der Stand bleibt unverändert | | |
| 6 | Flugmodus ein, absagen | Fehler **im Blatt**; der gewählte Grund bleibt stehen | | |
| 7 | Flugmodus aus, erneut absagen | Geht durch; **eine** Antwort, **eine** Buchung | | |
| 8 | Mit Bedienhilfen durch einen Termin gehen | Stand und Knöpfe werden vorgelesen (NFR-027) | | |

---

## Test Matrix

| Device / Browser | OS / Version | Screen Size | Status |
| ---------------- | ------------ | ----------- | ------ |
| Chrome (latest) | macOS / Windows | Desktop | |
| Safari (latest) | macOS | Desktop | |
| Firefox (latest) | macOS / Windows | Desktop | |
| Safari | iOS 17+ | iPhone SE (klein) | |
| Safari | iOS 17+ | iPhone 15 | |
| Chrome | Android 14+ | Pixel 7 | |
| Safari | iPadOS 17+ | iPad Gen 11 | |

---

## Summary

| Test Case | Titel | Priority | Result |
| --------- | ----- | -------- | ------ |
| TC-001 | Zusagen | High | |
| TC-002 | Absagen mit Grund | High | |
| TC-003 | Die 24-Stunden-Frist | High | |
| TC-004 | Antwort ändern | High | |
| TC-005 | Abgesagter Termin | High | |
| TC-006 | Nach Terminbeginn | High | |
| TC-007 | Die Regel ist abschaltbar | Medium | |
| TC-008 | Vier Sprachen | High | |
| TC-009 | Darstellung und Netz | Medium | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

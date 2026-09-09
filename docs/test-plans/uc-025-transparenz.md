# Manual Test Plan: UC-025 — Transparenz-Seite und Health-Opt-out

**Use Case:** [UC-025](../use_cases/UC-025-transparenz-seite.md)
**Geltungsbereich:** Auskunft, Empfänger:innen, Nicht-Erhebung, Opt-out, Erklärung der Signaltypen
**Anforderungen:** FR-073, FR-074, FR-075 (teilweise)
**Regeln:** BR-105 bis BR-108
**Erstellt:** 2026-09-09

## Vorbereitung

- **M** — Mitglied in Team A, zu dem ein Hinweis besteht (UC-023: auf die
  letzten Termine nicht geantwortet), mit mindestens einer Punktebuchung.
- **TA** — Trainer:in von Team A. **V** — Vorstand.
- Migrationen `0040` und `0041` sind eingespielt.

---

## TC-001: Auskunft (Hauptablauf, BR-105)

**Priority:** High
**Preconditions:** Als **M** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Profil öffnen | Der Eintrag «Was sieht mein Verein?» steht da – für **jedes** Mitglied | | |
| 2 | Ihn antippen | Die Seite öffnet sich | | |
| 3 | Den ersten Abschnitt lesen | Anwesenheiten, Zu- und Absagen, Zahlungsstatus – mehr nicht (Schritt 2) | | |
| 4 | Beim Zahlungsstatus nachsehen | Er ist als «noch nicht in Betrieb» gekennzeichnet | | |
| 5 | Den Abschnitt «Hinweise zu dir» ansehen | Der bestehende Hinweis steht da, mit Ampel (Schritt 3) | | |
| 6 | Die Zeile lesen | Sie nennt, **wer** ihn sieht (Schritt 4) | | |
| 7 | `health_signals` als **M** direkt abfragen | Leer – die Auskunft läuft über eine eigene Funktion, nicht über eine gelockerte Policy | | |

---

## TC-002: Was nicht erhoben wird (BR-108)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Abschnitt «Was ausdrücklich nicht erhoben wird» suchen | Er ist da | | |
| 2 | Den Inhalt prüfen | App-Nutzung, Lesebestätigungen, Standort und Inhalte werden **einzeln** benannt | | |
| 3 | Die Fussnote lesen | Sie sagt, dass das eine Zusage ist und keine Selbstverständlichkeit | | |

---

## TC-003: Erklärung eines Signaltyps (A3, FR-075)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Einen Hinweis antippen | Ein Blatt erklärt die Definition **und** die geltende Schwelle | | |
| 2 | «Wer sieht das» lesen | Trainer:innen und Vorstand | | |
| 3 | Das Verfallsdatum ansehen | Es steht da, mit dem Hinweis, dass danach gelöscht wird | | |
| 4 | Nach einer Möglichkeit suchen, die Schwelle zu **ändern** | Es gibt keine – FR-075 ist hier nur lesend | | |

---

## TC-004: Opt-out (Schritte 6–8, BR-106, BR-107)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Schalter «Keine Hinweise zu meiner Person» umlegen | Toast nennt, **wie viele** bestehende Hinweise gelöscht wurden | | |
| 2 | Den Schalter ansehen, ohne die Seite neu zu laden | Er steht auf «an» und springt nicht zurück | | |
| 3 | Den Abschnitt «Hinweise zu dir» prüfen | Leer, mit Erklärung (A1) | | |
| 4 | Als **TA** die Vereins-Gesundheit öffnen | Der Hinweis zu **M** ist weg (BR-106) | | |
| 5 | Als **M** den Punktestand und die Rangliste prüfen | Unverändert (BR-107) | | |
| 6 | Die Fussnote unter dem Schalter lesen | Sie sagt, dass **M** weiterhin anonym in Aggregate einfliesst | | |
| 7 | `detect_health_signals()` auslösen | Zu **M** entsteht **kein** neuer Hinweis | | |

---

## TC-005: Opt-out zurücknehmen (A2)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Schalter zurücklegen | Toast «Rückwirkend entsteht nichts» | | |
| 2 | Die Liste sofort prüfen | Leer – die gelöschten Hinweise kommen **nicht** zurück | | |
| 3 | `detect_health_signals()` auslösen | Jetzt entsteht wieder einer | | |

---

## TC-006: Nur die eigenen Daten

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **TA** die Transparenz-Seite öffnen | Sie zeigt nur Hinweise zu **TA** selbst, nicht die des Teams | | |
| 2 | Als **TA** den Opt-out setzen | Er wirkt nur für **TA**; der Hinweis zu **M** bleibt | | |
| 3 | `my_health_signals` mit einer fremden Vereins-Id aufrufen | Leer | | |

---

## Vier Sprachen

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch, Italienisch und Englisch stellen | Datenarten, Nicht-Erhebung, Erklärungen und der Schalter sind übersetzt | | |

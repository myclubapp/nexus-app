# Manual Test Plan: UC-022 — Leaderboard einsehen

**Use Case:** [UC-022](../use_cases/UC-022-leaderboard-einsehen.md)
**Geltungsbereich:** Vereins- und Team-Rangliste, Zeitraum, Säule, eigene Position, Opt-out
**Anforderungen:** FR-046 bis FR-049
**Regeln:** BR-089 bis BR-093
**Erstellt:** 2026-09-09

## Vorbereitung

- **M1** — Mitglied im Team «Aktive», mit Punkten aus **zwei** Säulen, davon
  ein Teil älter als 14 Tage.
- **M2** — Mitglied im Team «Aktive», mit wenigen Punkten.
- **M3** — Mitglied **ohne** Team.
- **M4** — Mitglied mit vielen Punkten und **abgewählter** Ranglisten-Teilnahme.
- **M5** — Mitglied in **zwei** Teams.
- Migration `0039_leaderboard.sql` ist eingespielt.

---

## TC-001: Vereinsrangliste (Hauptablauf)

**Priority:** High
**Preconditions:** Als **M1** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Rangliste» öffnen | Die Vereinsrangliste der laufenden Saison mit Rang, Name und Punktzahl | | |
| 2 | Die eigene Zeile suchen | Sie ist hervorgehoben (Schritt 3) | | |
| 3 | Die Fussnote lesen | Sie nennt den eigenen Rang | | |
| 4 | Nach einer Kennzeichnung der letzten Plätze suchen | Es gibt keine, und keine Aufforderung an schlecht Platzierte (BR-089) | | |
| 5 | Nach einer Ansicht «nach Mitgliederwert» oder «nach Gesundheit» suchen | Es gibt keine (BR-093) | | |

---

## TC-002: Team-Rangliste (FR-047, A4)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** oben auf «Aktive» wechseln | Die Rangliste zeigt **nur** das Team – nicht mehr eine leere Liste | | |
| 2 | Die Namen prüfen | **M3** (ohne Team) steht nicht darin | | |
| 3 | Als **M3** (ohne Team) die Seite öffnen | Der Umschalter fehlt ganz – die Team-Ansicht steht nicht zur Wahl (A4) | | |
| 4 | Als **M5** (zwei Teams) auf «Team» wechseln | Eine Auswahl der eigenen Teams erscheint | | |
| 5 | Das zweite Team wählen | Die Rangliste wechselt | | |

---

## TC-003: Zeitraum (FR-049)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Zeitraum «Saison» prüfen | Punkte der laufenden Saison | | |
| 2 | Auf «Monat» wechseln | Nur Buchungen der letzten 30 Tage zählen | | |
| 3 | Auf «Woche» wechseln | Die ältere Buchung von **M1** fällt heraus, die Punktzahl sinkt | | |
| 4 | Auf «Gesamt» wechseln | Auch Buchungen früherer Saisons zählen mit | | |
| 5 | Ein neu eingetretenes Mitglied betrachten | In «Woche» steht es weiter vorn als in «Gesamt» – dafür ist der Zeitraum da | | |

---

## TC-004: Säule (FR-048, A1)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Säule «Helfer» (3) wählen | Nur Helferpunkte zählen – die frühere Helfer-Auswertung ohne eigenes Modul | | |
| 2 | Ein Mitglied ohne Punkte dieser Säule suchen | Es steht nicht in der Liste | | |
| 3 | Eine Buchung **von Hand** in Säule 7 prüfen | Sie zählt bei Säule 7 mit, obwohl sie keine Regel hat | | |
| 4 | Auf «Alle Säulen» zurückwechseln | Die Summen entsprechen wieder dem Gesamtbild | | |

---

## TC-005: Die eigene Position (BR-090, A3)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `clubs.settings.leaderboard.topOnly` auf **3** setzen | — | | |
| 2 | Als ein Mitglied auf einem hinteren Rang die Seite öffnen | Drei Ränge **und** die eigene Zeile | | |
| 3 | Zwischen beiden Blöcken prüfen | Ein «…» zeigt die Lücke – die Rangfolge bleibt lesbar | | |
| 4 | Als Mitglied auf Rang 2 prüfen | Kein «…» – die eigene Zeile steht im Ausschnitt | | |
| 5 | Die Einstellung entfernen | Es werden wieder 20 Ränge gezeigt | | |
| 6 | Einen unsinnigen Wert (0) setzen | Die Vorgabe greift, die Liste bleibt brauchbar | | |

---

## TC-006: Abgewählte Teilnahme (BR-091, A2)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** die Rangliste ansehen | **M4** kommt nicht vor, obwohl er die meisten Punkte hat | | |
| 2 | Als **M4** die Rangliste öffnen | Sie ist sichtbar, **M4** findet sich aber selbst nicht darin | | |
| 3 | Als **M4** den Hinweis oben lesen | Er erklärt, dass die Teilnahme abgewählt ist | | |
| 4 | Als **M4** das Dashboard öffnen | Der eigene Stand ist da – Punkte werden weiter gesammelt | | |
| 5 | Als **M4** die Teilnahme wieder einschalten | **M4** erscheint in der Rangliste, ohne dass Punkte verloren gingen | | |

---

## TC-007: Fremde Vereine und Aktualität

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `leaderboard_rows` mit der Id eines fremden Vereins aufrufen | Abgewiesen | | |
| 2 | Eine Buchung erzeugen und die Rangliste innert fünf Minuten prüfen | Sie ist auf dem neuen Stand (BR-092) | | |
| 3 | Nach unten ziehen | Sie lädt sofort neu | | |

---

## Vier Sprachen

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch, Italienisch und Englisch stellen | Umschalter, Zeiträume, Säulen und Hinweise sind übersetzt, kein Schlüssel steht im Klartext | | |

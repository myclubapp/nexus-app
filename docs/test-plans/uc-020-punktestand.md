# Manual Test Plan: UC-020 — Punktestand und «Nächste Punkte» einsehen

**Use Case:** [UC-020](../use_cases/UC-020-punktestand-einsehen.md)
**Geltungsbereich:** Saison- und Gesamtstand, Buchungen, Vorschläge, Historie mit Filter, Ledger-Sichtbarkeit
**Anforderungen:** FR-041, FR-044, FR-045
**Regeln:** BR-081 bis BR-084
**Erstellt:** 2026-09-09

## Vorbereitung

- **M1** — Mitglied mit Buchungen in **zwei** Saisons, im Team «Aktive».
- **M2** — Mitglied ohne Buchungen, **ohne** Team, mit abgewähltem Leaderboard.
- **V** — Vorstand.
- Offen im Verein: ein Vereinstraining mit hinterlegter Regel, ein Team-Termin
  für «Aktive», ein Helfer-Event mit unterbesetzter Schicht, eine offene
  Aufgabe, sowie eine Aufgabe, die **M1** bereits übernommen hat.
- Migration `0037_points_overview.sql` ist eingespielt.

---

## TC-001: Wirkungs-Tab (Hauptablauf)

**Priority:** High
**Preconditions:** Als **M1** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Wirkung» öffnen | Zwei Kennzahlen: Saison **und** Gesamt seit Eintritt (BR-081) | | |
| 2 | Die Zahlen mit der Historie vergleichen | Der Gesamtstand enthält die Buchungen der Vorsaison, der Saisonstand nicht | | |
| 3 | Nach einem Rang oder Vergleich suchen | Es gibt keinen (BR-084) | | |
| 4 | «Zuletzt gutgeschrieben» ansehen | Drei Buchungen mit **Anlass**, Datum und Wert – kein Regelcode wie `task_done` | | |
| 5 | «Nächste Punkte» ansehen | Konkrete Beiträge: Termin, Schicht, Aufgabe – je mit Art, Datum und Punktwert | | |
| 6 | Prüfen, ob eine Regel ohne Anlass erscheint | Nein: «Training besucht +10» ohne Termin steht nicht mehr da | | |
| 7 | Einen Termin-Vorschlag antippen | Die Agenda öffnet sich, der Termin ist hervorgehoben (Schritt 6) | | |
| 8 | Einen **Schicht**-Vorschlag antippen | Die Agenda öffnet sich beim **Helfer-Event** – nicht auf einer leeren Seite | | |
| 9 | Einen Aufgaben-Vorschlag antippen | Der Marktplatz öffnet sich, die Aufgabe ist hervorgehoben | | |

---

## TC-002: Vorschläge sind persönlich (BR-083)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M2** (ohne Team) den Tab «Wirkung» öffnen | Der Team-Termin steht **nicht** unter den Vorschlägen | | |
| 2 | Als **M1** (im Team) prüfen | Der Team-Termin steht da | | |
| 3 | Als **M1** auf einen Termin zusagen und neu laden | Der Termin verschwindet aus den Vorschlägen | | |
| 4 | Die bereits übernommene Aufgabe suchen | Sie wird **nicht** vorgeschlagen | | |
| 5 | Die Schicht voll besetzen und neu laden | Sie verschwindet aus den Vorschlägen | | |
| 6 | Ein Helfer-Event ansehen | Es erscheint **nur** über seine Schicht, nicht zusätzlich als Termin | | |

---

## TC-003: Noch keine Punkte (A1) und nichts offen (A4)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M2** (ohne Buchung) den Tab «Wirkung» öffnen | Statt eines leeren Stands eine Begrüssung mit Hinweis (A1) | | |
| 2 | Darunter prüfen | Der nächste erreichbare Beitrag steht da | | |
| 3 | Alle offenen Termine, Schichten und Aufgaben schliessen | — | | |
| 4 | Den Tab «Wirkung» neu laden | «Gerade steht nichts an» statt eines leeren Bereichs (A4) | | |

---

## TC-004: Vollständige Historie (A2, FR-041)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf dem Wirkungs-Tab «Alle anzeigen» wählen | Die Punktehistorie öffnet sich | | |
| 2 | Die Saison-Auswahl in der Kopfzeile prüfen | Sie nennt «Alle» und jede Saison mit Buchungen | | |
| 3 | Eine Saison wählen | Nur deren Buchungen stehen da, die Summe passt | | |
| 4 | Nach einer Säule filtern | Nur Buchungen dieser Säule bleiben | | |
| 5 | Eine Kombination wählen, zu der es nichts gibt | «Zu dieser Auswahl gibt es keine Buchung» statt einer leeren Liste | | |
| 6 | Eine Regel in den Vereinseinstellungen **deaktivieren** | — | | |
| 7 | Die Historie erneut öffnen | Die alten Buchungen tragen weiterhin ihren Anlass, nicht den Regelcode | | |
| 8 | Beim Scrollen die Kopfzeile beobachten | Der Saisonfilter bleibt stehen | | |
| 9 | Vom Profil aus «Alle anzeigen» wählen | Führt auf dieselbe Seite | | |

---

## TC-005: Der Ledger gehört der Person (BR-084, NFR-022)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** `point_transactions` von **M2** über die REST-Schnittstelle abfragen | Leer – fremde Buchungen sind nicht lesbar | | |
| 2 | Als **V** dieselbe Abfrage | Sichtbar – der Vorstand bucht von Hand und korrigiert (UC-021) | | |
| 3 | Als **M1** die Rangliste öffnen | Sie funktioniert weiterhin und zeigt die eigene Position | | |
| 4 | **M2** (Leaderboard abgewählt) suchen | Nicht in der Rangliste – und die Buchungen bleiben auch sonst verborgen | | |
| 5 | Als **M1** die Rangliste eines **fremden** Vereins abfragen | Leer | | |

---

## TC-006: Saisonlogik (BR-082)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Saisonstart des Vereins auf den 1. Juni setzen | — | | |
| 2 | Eine Buchung am **31. Mai** prüfen | Sie gehört zur **Vorsaison** | | |
| 3 | Eine Buchung am **1. Juni** prüfen | Sie gehört zur neuen Saison | | |
| 4 | Die Saisonangabe auf dem Wirkungs-Tab mit der in der Rangliste vergleichen | Beide nennen dieselbe Saison | | |

---

## TC-007: Aktualisierung (A3)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** den Tab «Wirkung» offen lassen und die App in den Hintergrund legen | — | | |
| 2 | Als **V** eine Aufgabe von **M1** bestätigen | — | | |
| 3 | Als **M1** zur App zurückkehren | Der Punktestand steht ohne Zutun auf dem neuen Wert | | |
| 4 | Zusätzlich nach unten ziehen | Alle Bereiche laden neu | | |

---

## Vier Sprachen

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch, Italienisch und Englisch stellen | Kennzahlen, Vorschlagsarten, Historie und Filter sind übersetzt, kein Schlüssel steht im Klartext | | |

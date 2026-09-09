# Implementation Plan: UC-012 — Helfer-Schicht übernehmen

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                            |
| **Goal**          | Sich für eine konkrete Schicht eines Helfer-Events verbindlich eintragen |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | Draft                                                               |

## Overview

Die Gegenseite zu UC-011: Was der Vorstand ausgeschrieben hat, wird hier
übernommen. Der Schritt ist klein, die Regeln sind es nicht — eine Schicht
nimmt nur so viele Personen auf, wie sie braucht (BR-046), das Austragen
bleibt jederzeit folgenlos (BR-047), und **Punkte entstehen hier nicht**
(BR-045). Sie kommen erst mit der Bestätigung in UC-013.

## Related Use Cases

- UC-011 Helfer-Event ausschreiben — die Gegenseite
- UC-013 Helfer-Schicht bestätigen — löst die Punkte aus
- UC-010 Zu- oder absagen — dieselbe Tabelle `attendance`, anderer Anlass

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                | User Story (Kurz)                                | Status      | Notizen                                    |
| ------ | -------------------- | ------------------------------------------------ | ----------- | ------------------------------------------ |
| FR-031 | Schicht übernehmen   | Für eine einzelne Schicht ein- und austragen     | In Progress | Der Kern dieses Use Case                   |
| FR-030 | Helfer-Event         | Schichten mit Zeitfenster und Personalbedarf     | Implemented | UC-011; hier nur die Anzeige der Besetzung |

### Business Rules

| ID     | Regel                          | Umsetzung geplant als                                                        |
| ------ | ------------------------------ | ---------------------------------------------------------------------------- |
| BR-045 | Punkte erst nach Bestätigung   | Der Eintrag schreibt `status = 'registered'`; keine Punktequelle              |
| BR-046 | Besetzung ist begrenzt         | Serverseitig in `take_shift()`, mit Sperre gegen das Wettrennen (A1)          |
| BR-047 | Austragen ist jederzeit möglich| Kein Zeitfenster, kein Abzug; Meldung an die Organisation unter 48 Stunden    |
| BR-048 | Freiwilligkeit                 | Keine Zuweisung von aussen — es gibt schlicht keinen Weg dazu                 |

### Non-Functional Requirements

| ID      | Titel              | Kategorie | Trifft zu | Notizen                                                    |
| ------- | ------------------ | --------- | --------- | ---------------------------------------------------------- |
| NFR-011 | Mandantentrennung  | Security  | Ja        | Eintrag nur im eigenen Verein                              |
| NFR-034 | Punktequellen      | Maintainability | Ja  | Hier entsteht **keine** Punktequelle (BR-045)              |
| NFR-037 | Kein leerer Bildschirm | Usability | Ja     | Ein Event ohne freie Plätze sagt das, statt nichts zu zeigen |
| NFR-028 | Sprachparität      | Usability | Ja        | Auch Überschneidungs- und Vollmeldung                      |

---

## Current State

- `app/src/lib/shift.ts` liefert bereits `shiftCoverage()` und
  `shiftsOverlap()` — beides für diesen Use Case geschrieben, beides getestet.
- `useAgenda()` lädt Schichten und Anwesenheiten schon mit
  (`select('*, shifts:event_shifts(*), attendance(*)')`).
- `attendance` trägt `shift_id` seit 0003; die Policies erlauben dem Mitglied
  Einträge für sich selbst mit Status `registered`.

---

## Missing Pieces

| #   | Was fehlt                                                                                                     | Anforderung | Quelle          |
| --- | ------------------------------------------------------------------------------------------------------------- | ----------- | --------------- |
| 1   | **`attendance` hat den Primärschlüssel `(event_id, member_id)`** — damit ist genau **eine** Schicht pro Event möglich. A3 verlangt mehrere. | A3 | Schema-Konflikt |
| 2   | `take_shift()` / `release_shift()` gibt es nicht; ohne Serverfunktion ist BR-046 im Wettrennen nicht haltbar    | BR-046, A1  | Automated       |
| 3   | Keine Detailansicht eines Helfer-Events — Schritt 1 und 2 haben kein Ziel                                       | Schritt 1–2 | Automated       |
| 4   | Die Meldung an die Organisation bei kurzfristiger Unterdeckung (A2 Schritt 2)                                   | BR-047      | Automated       |
| 5   | Die Überschneidungswarnung mit ausdrücklicher Bestätigung (A4)                                                  | A4          | Automated       |

**Fund 1 ist der Kern der Arbeit.** Der Primärschlüssel stammt aus einer Zeit,
in der `attendance` nur Zu- und Absagen zu Terminen trug; dort ist «eine
Antwort pro Person und Termin» richtig. Für Schichten ist er falsch. Der
Schlüssel muss `(event_id, member_id, shift_id)` werden — mit der Feinheit,
dass `shift_id` nullbar ist und Postgres NULL-Werte in einem eindeutigen Index
nicht als gleich behandelt: Ohne `nulls not distinct` könnte jemand beliebig
oft zum selben Termin zusagen.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                   | Impact | Owner |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------ | ----- |
| 1   | Der Schlüsselwechsel bricht **beide** bestehenden Upserts: `check_in()` (0003) und `respond_to_event()` (0017) nennen `on conflict (event_id, member_id)`. Ohne passenden eindeutigen Index scheitern sie zur Laufzeit mit «no unique or exclusion constraint matching the ON CONFLICT specification». Beide sind in derselben Migration mitzuziehen — und danach gegen die Datenbank nachzumessen. | High | Dev |
| 2   | `confirm_shift()` bucht weiterhin den **Regelwert** statt `event_shifts.points` — offen aus UC-011, fällig in UC-013. | High | Dev |

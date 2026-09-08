# Implementation Plan: UC-016 — Punkteregeln konfigurieren

|                   |                                                  |
| ----------------- | ------------------------------------------------ |
| **Primary Actor** | Vorstand                                          |
| **Goal**          | Das Punktesystem an die Kultur des eigenen Vereins anpassen |
| **Plan created**  | 2026-09-09                                        |
| **Status**        | Done                                              |

## Overview

Der Vorstand sieht alle Regeln nach den sieben Säulen gruppiert und passt
Punktwerte, Aktivierung und Häufigkeitsgrenzen an. Zwei Regeln über den Regeln
tragen den Use Case: Eine Änderung wirkt **nur nach vorne** (BR-063), und eine
Regel trägt nie einen negativen Wert (BR-066) – ein Punkteabzug als
Dauereinrichtung widerspricht dem Konzept, negative Buchungen entstehen
ausschliesslich als Korrektur.

## Related Use Cases

- UC-001 Verein gründen — sät den Satz Standardregeln, den diese Seite zeigt
- UC-014 QR-Check-in und UC-013 Schicht bestätigen — buchen über diese Regeln
- UC-021 Punkte manuell buchen — der einzige Weg zu einem negativen Wert
- UC-022 Leaderboard einsehen — die Säulenfilterung folgt dieser Gliederung

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                         | User Story (Kurz)                            | Status      | Notizen                                                     |
| ------ | ----------------------------- | -------------------------------------------- | ----------- | ----------------------------------------------------------- |
| FR-035 | Standard-Punkteregeln         | Vollständiger Satz passend zur Vereinsart    | Implemented | Aus UC-001; hier sichtbar und änderbar                      |
| FR-036 | Punktwerte anpassen           | Punktwerte pro Regel anpassen                | Implemented | Mit Hinweis, dass es nur nach vorne wirkt                   |
| FR-037 | Regel aktivieren/deaktivieren | Einzelne Regeln und ganze Säulen             | Implemented | A2 über `set_pillar_active()`                               |
| FR-038 | Eigene Regel anlegen          | Code, Bezeichnung und Wert selbst vergeben   | Implemented | A3, mit Prüfung auf freien Code                             |
| FR-040 | Nur-Dank-Modus                | Nur danken statt punkten                     | Implemented | A4: Punktwert null bei aktiver Regel                        |

### Business Rules

| ID     | Regel                            | Status      | Notizen                                                                |
| ------ | -------------------------------- | ----------- | ---------------------------------------------------------------------- |
| BR-063 | Änderungen wirken nur nach vorne  | Implemented | Der Ledger wird nie angefasst; steht als Fussnote auf der Seite        |
| BR-064 | Regelcode je Verein eindeutig     | Implemented | `unique (club_id, code)` aus 0002, im Formular vorab geprüft           |
| BR-065 | Häufigkeitsgrenzen serverseitig   | Implemented | `rule_limit_reached()`; nachgemessen: 5 Versuche, 4 Buchungen          |
| BR-066 | Kein Punkteabzug als Regel        | Implemented | check-Constraint `points >= 0`; nachgemessen                           |
| BR-067 | Standardregeln bleiben verfügbar  | Implemented | Deaktivieren löscht nicht; nachgemessen: 8 Regeln bleiben              |

### Non-Functional Requirements

| ID      | Titel                      | Kategorie       | Trifft zu | Notizen                                                      |
| ------- | -------------------------- | --------------- | --------- | ------------------------------------------------------------ |
| NFR-034 | Punktequellen als Funktion | Maintainability | Ja        | Die Grenze steckt in `award_points()`, nicht im Frontend      |
| NFR-013 | Funktionsrechte            | Security        | Ja        | `award_points` und `rule_limit_reached` bleiben intern        |
| NFR-011 | Mandantentrennung          | Security        | Ja        | `set_pillar_active()` prüft `is_club_admin()`                 |
| NFR-028 | Sprachparität              | Usability       | Ja        | Auch die sieben Säulennamen und die vier Zeiträume            |

---

## Current State

- `supabase/migrations/0014_point_rules.sql`: Constraint `points >= 0`,
  `rule_limit_reached()` für Tag, Woche, Monat und Saison, `award_points()`
  darauf umgestellt, `set_pillar_active()`.
- `app/src/lib/pointRule.ts`: Säulen, Grenzen lesen und schreiben,
  Nur-Dank-Erkennung, Code-Prüfung – reine Logik, vollständig geprüft.
- `app/src/hooks/usePointRules.ts`: alle Regeln, ändern, Säule schalten, anlegen.
- `app/src/pages/club/PointRulePage.tsx`: nach Säulen gruppierte Liste,
  Bearbeiten-Blatt, eigene Regel.
- `app/src/components/FirstStepsCard.tsx`: «Punkteregeln ansehen» aus UC-001
  führt jetzt hierher statt in die allgemeinen Vereinseinstellungen.

---

## Missing Pieces

| #   | Was fehlt                                                                  | Anforderung | Quelle          |
| --- | -------------------------------------------------------------------------- | ----------- | --------------- |
| ~~1~~ | ~~Punktwerte, Aktivierung, Säulen, eigene Regeln, Grenzen~~ – erledigt    | FR-036–038  | Automated       |
| 2   | Eine eigene Regel lässt sich nicht wieder löschen – nur stilllegen          | FR-038      | Cross-reference |
| 3   | Der Nur-Dank-Modus wirkt auf die Buchung; die Anzeige «Dank statt Zahl» in Dashboard und Verlauf entsteht mit UC-019 und UC-020 | FR-040 | Cross-reference |

---

## Implementation Guidelines

- **UI-Komponenten:** `AppPage`, `ListSection` mit `action` für den
  Säulenschalter, `FormModal`, `IonToggle`, `IonSelect`, `SkeletonList`,
  `useToast()`. Kein neues Bauteil.
- **Styling:** nur Klassen aus `src/theme/variables.css`.
- **Struktur:** Seite unter `src/pages/club/`, Logik in `src/lib/pointRule.ts`.

---

## Implementation Tasks

- [x] 1. Migration `0014_point_rules.sql`: Constraint `points >= 0` (BR-066).
- [x] 2. `rule_limit_reached()` für Tag, Woche, Monat und Saison; `award_points()`
      darauf umgestellt (BR-065, A5).
- [x] 3. `set_pillar_active()` für A2, mit Prüfung auf `is_club_admin()`.
- [x] 4. `src/lib/pointRule.ts` mit Grenzen, Säulen und Code-Prüfung.
- [x] 5. `usePointRules.ts` mit allen vier Zugriffen.
- [x] 6. `PointRulePage`: nach Säulen gruppiert, mit Zustand je Regel.
- [x] 7. Bearbeiten-Blatt mit Wert, Aktivierung und Häufigkeitsgrenze.
- [x] 8. Eigene Regel anlegen mit Prüfung auf freien Code (A3, BR-064).
- [x] 9. Route, Einstieg im Profil, und «Punkteregeln ansehen» aus UC-001
      führt jetzt hierher.
- [x] 10. **i18n-Vollständigkeit** — vier Sprachen, sieben Säulen, vier Zeiträume.
- [x] 11. **Verdrahtung und Fehlerrückmeldung** — jeder Fehlschlag als Toast.
- [x] 12. Vitest inklusive Architekturprüfung gegen die Migration.
- [x] 13. **Migration gegen die Datenbank prüfen**: negativer Wert,
      Häufigkeitsgrenze, Säule abschalten, Regeln bleiben erhalten.
- [x] 14. Manueller Testplan `docs/test-plans/uc-016-punkteregeln.md`.
- [x] 15. **Statusabgleich** — FR-035 bis FR-038 und FR-040 auf `Implemented`.
- [ ] 16. **Plattform-Parität** — Blatt und Säulenschalter auf iOS, Android, Browser.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                                     | Impact | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **Spec-Lücke:** A4 «Nur-Dank» nennt keinen eigenen Zustand. Angenommen: Punktwert null bei **aktiver** Regel. Eine ausgeschaltete Regel heisst «gibt es bei uns nicht», null heisst «zählt, aber ohne Zahl» – das ist nicht dasselbe und wird im UI unterschieden. Durch Test festgehalten. | Medium | Stakeholder |
| 2   | **Spec-Lücke:** A5 nennt «dreimal pro Woche» als Beispiel, aber keinen Satz möglicher Zeiträume. Angenommen: Tag, Woche, Monat, Saison – in App und SQL identisch, durch Architekturtest gehalten.                  | Low    | Stakeholder |
| 3   | Die Grenze kennt zwei Formen in `meta`: `max_per_week` aus den Vorlagen und die allgemeine `max_per_period`. Beide zu lesen ist nötig, damit bestehende Vereine weiterlaufen; beim Schreiben wird die Kurzform entfernt, sonst gewänne sie. | Medium | Dev |
| 4   | Eine eigene Regel lässt sich anlegen, aber nicht löschen. Das ist bewusst: An einer Regel hängen Buchungen, und BR-063 verbietet, den Ledger nachträglich zu verändern. Stilllegen ist der vorgesehene Weg.        | Low    | Dev         |

---

## Progress Log

| Datum      | Update                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-09 | Plan erstellt und umgesetzt: Migration 0014, `pointRule.ts`, `usePointRules.ts`, `PointRulePage`. 154 Vitest-Tests grün.                  |
| 2026-09-09 | Gegen die Datenbank geprüft: Eine Regel mit negativem Wert wird vom Constraint abgewiesen (BR-066); fünf Buchungsversuche auf einer Regel mit `max_per_week: 4` ergeben genau vier Buchungen (BR-065); eine abgeschaltete Säule bucht nichts mehr, und alle acht Regeln bleiben erhalten (BR-067). Testdaten entfernt. |

# Implementation Plan: UC-009 — Termin erstellen

|                   |                                                        |
| ----------------- | ------------------------------------------------------ |
| **Primary Actor** | Trainer:in                                              |
| **Goal**          | Einen einzelnen Termin oder eine Terminserie erfassen, damit das Team Bescheid weiss |
| **Plan created**  | 2026-09-09                                              |
| **Status**        | Done                                                    |

## Overview

Eine Trainer:in erfasst einen Termin mit Typ, Zeit, Ort und Zuständigkeit; das
System schlägt die passende Punkteregel vor, erzeugt das Check-in-Token und
benachrichtigt die Betroffenen. Wiederkehrende Termine entstehen als Serie mit
Vorschau, damit niemand sechzig Termine anlegt, ohne sie gesehen zu haben.

Zwei Regeln tragen den Use Case: Der Punktwert einer Teilnahme hängt am Termin
und nicht an einer Eingabe beim Check-in (BR-034), und ein Aufruf trägt seinen
Sinnzusammenhang, bevor er sichtbar wird (BR-036).

## Related Use Cases

- UC-010 Auf einen Termin zu- oder absagen — die Gegenseite
- UC-011 Helfer-Event ausschreiben — A3 führt dorthin
- UC-014 QR-Check-in — verwendet das hier erzeugte Token und die Regel
- UC-015 Unentschlossene erinnern — setzt den Teilnehmerstand voraus
- UC-016 Punkteregeln konfigurieren — liefert die Regeln zur Auswahl

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                 | User Story (Kurz)                             | Status      | Notizen                                                    |
| ------ | --------------------- | --------------------------------------------- | ----------- | ---------------------------------------------------------- |
| FR-021 | Termin erstellen      | Titel, Typ, Zeit und Ort erfassen             | Implemented | Über `EventForm`; die Policy prüft die Rolle               |
| FR-022 | Terminserie erstellen | Wiederkehrende Termine als Serie              | Implemented | A1, mit Vorschau und Obergrenze                            |
| FR-023 | Termin absagen        | Mit Begründung absagen                        | Implemented | A4 über `cancel_event()`; nachgemessen                     |
| FR-029 | Teilnehmerbedarf      | Benötigte Teilnehmerzahl hinterlegen          | Implemented | Feld im Formular, Unterdeckung in der Agenda (2026-09-11)  |

### Business Rules

| ID     | Regel                                          | Status      | Notizen                                                              |
| ------ | ---------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| BR-032 | Termintypen neutral, Labels vereinsspezifisch   | Implemented | Die Auswahl zeigt `eventLabel()`, die Datenbank kennt nur `type`     |
| BR-033 | Nur Trainer:innen und Vorstand erfassen         | Implemented | Neue Policy `events_trainer_write`; die alte kannte nur den Vorstand |
| BR-034 | Punkteregel ist am Termin verankert             | Implemented | `point_rule_code` am Termin, vorgeschlagen nach Typ                  |
| BR-035 | Absage braucht einen Grund                      | Implemented | Constraint **und** Prüfung in `cancel_event()`; nachgemessen         |
| BR-036 | Warum-Pflicht bei Aufrufen                      | Implemented | check-Constraint auf `events`; nachgemessen                          |

### Non-Functional Requirements

| ID      | Titel               | Kategorie | Trifft zu | Notizen                                                        |
| ------- | ------------------- | --------- | --------- | -------------------------------------------------------------- |
| NFR-016 | QR-Token-Gültigkeit | Security  | Ja        | Das Token entsteht beim Anlegen; die Frist prüft `check_in()`  |
| NFR-011 | Mandantentrennung   | Security  | Ja        | Policy über `is_club_trainer()`                                |
| NFR-013 | Funktionsrechte     | Security  | Ja        | `cancel_event` und `announce_event` nur für `authenticated`    |
| NFR-009 | Push-Fallback       | Availability | Ja     | Die Ankündigung landet in der Inbox                            |
| NFR-028 | Sprachparität       | Usability | Ja        | Auch die drei Rhythmen und die Vorschau mit Plural             |

---

## Current State

- `supabase/migrations/0015_events.sql`: Tabelle `event_series`; auf `events`
  die Spalten `series_id`, `why`, `capacity_needed`, `cancelled_at`,
  `cancelled_reason`, `is_sample`, `created_by`, `audience_role_ids`; der Typ
  `meeting`; drei check-Constraints (Zeitfolge, Absagegrund, Warum-Pflicht);
  `is_club_trainer()` und die darauf umgestellten Policies; `cancel_event()`
  und `announce_event()`.
- `app/src/lib/eventSeries.ts`: Serienberechnung, Dauer, Warum-Pflicht,
  Regelvorschlag und die Entwurfsprüfung – reine Logik, 32 Tests.
- `app/src/hooks/useEvents.ts`: anlegen (einzeln und als Serie), ankündigen,
  absagen, ändern mit Geltungsbereich (A2).
- `app/src/components/EventFormModal.tsx`: das Formular mit Vorschau.
- `app/src/pages/AgendaPage.tsx`: das Pluszeichen unten rechts, nur für Trainer:innen.

---

## Missing Pieces

| #   | Was fehlt                                                                      | Anforderung | Quelle          |
| --- | ------------------------------------------------------------------------------ | ----------- | --------------- |
| 1   | ~~**Teilnehmerbedarf** (`capacity_needed`) hat kein Feld im Formular~~ – erledigt am 2026-09-11 | FR-029      | Cross-reference |
| 2   | A2 «Einzeltermin einer Serie ändern» ist als Hook da, aber ohne Bedienoberfläche | FR-022      | Automated       |
| 3   | Die Absage hat noch keinen Einstieg in der Agenda – `cancel_event()` ist bereit | FR-023      | Automated       |

---

## Implementation Guidelines

- **UI-Komponenten:** `FormModal` mit `ListSection`, `IonSelect` für Typ, Team
  und Regel, `IonInput type="datetime-local"` für die Zeiten, `IonToggle` für
  die Serie. Kein neues Bauteil.
- **Styling:** nur Klassen aus `src/theme/variables.css`.
- **Struktur:** Formular unter `src/components/`, Datenzugriff in
  `src/hooks/useEvents.ts`, Serien- und Prüflogik in `src/lib/eventSeries.ts`.

---

## Implementation Tasks

- [x] 1. Migration `0015_events.sql`: fehlende Spalten aus dem Entitätsmodell.
- [x] 2. Dieselbe Migration: Constraints für Zeitfolge (A5), Absagegrund
      (BR-035) und Warum-Pflicht (BR-036).
- [x] 3. `is_club_trainer()` und die umgestellten Policies (BR-033) – die alte
      `events_admin_write` liess eine Trainer:in nicht an ihr eigenes Training.
- [x] 4. `cancel_event()` mit Pflichtgrund und Nachricht an alle Betroffenen (A4).
- [x] 5. `announce_event()` für Schritt 10, getrennt vom Anlegen.
- [x] 6. `src/lib/eventSeries.ts` mit Serienberechnung und Entwurfsprüfung.
- [x] 7. `useEvents.ts`: anlegen, ankündigen, absagen, ändern.
- [x] 8. `EventForm` mit Typ, Zeiten, Ort, Team, Regelvorschlag und Warum.
- [x] 9. Serie mit Vorschau und Obergrenze (A1).
- [x] 10. Einstieg in der Agenda, nur für Trainer:innen und Vorstand.
- [x] 11. **i18n-Vollständigkeit** — vier Sprachen, Rhythmen und Plural.
- [x] 12. **Verdrahtung und Fehlerrückmeldung** — Fehler im Blatt, Erfolg als Toast.
- [x] 13. Vitest für die Serien- und Prüflogik (32 Tests).
- [x] 14. **Migration gegen die Datenbank prüfen**: Zeitfolge, Warum-Pflicht,
      Absage ohne Grund, Absage mit Grund und Zustellung, zweite Absage folgenlos.
- [x] 15. Manueller Testplan `docs/test-plans/uc-009-termin-erstellen.md`.
- [x] 16. **Statusabgleich** — FR-021 bis FR-023 auf `Implemented`.
- [x] 17. **Teilnehmerbedarf** ins Formular (FR-029) – erledigt am 2026-09-11.
- [x] 18. **Absage und Serienänderung** in der Agenda bedienbar machen –
      erledigt am 2026-09-11. Befund derselben Klasse wie in UC-022 und UC-024:
      `useCancelEvent()` und `useUpdateEvent()` waren gebaut und von keiner
      Ansicht aus erreichbar. FR-023 stand auf `Implemented`, ohne dass sich
      ein Termin absagen liess.
- [ ] 19. **Plattform-Parität** — die Datums- und Zeitauswahl auf iOS, Android
      und im Browser; `datetime-local` verhält sich dort unterschiedlich.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                                                | Impact | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **Spec-Lücke:** A1 nennt «Rhythmus, Wochentag und Enddatum», aber keinen Satz möglicher Rhythmen. Angenommen: wöchentlich, zweiwöchentlich, monatlich. Der Wochentag ergibt sich aus dem ersten Termin, statt ihn doppelt zu fragen. | Medium | Stakeholder |
| 2   | **Spec-Lücke:** Wie viele Termine darf eine Serie anlegen? Angenommen: 60. Ein Tippfehler im Jahr erzeugte sonst Hunderte von Terminen und ebenso viele Zustellungen. Durch Test festgehalten.                                  | Medium | Stakeholder |
| 3   | Schritt 10 kündigt bei einer Serie **einmal** an, nicht je Termin – sonst wäre die Inbox unbrauchbar. Die Spezifikation sagt dazu nichts.                                                                                       | Medium | Stakeholder |
| 4   | `announce_event()` läuft nach dem Anlegen. Scheitert sie, steht der Termin trotzdem in der Agenda. Das ist die bessere Hälfte des Fehlers, weicht aber von der Failure Postcondition ab, die «niemand wird benachrichtigt» mit «kein Termin» koppelt. | Medium | Architect |
| 5   | Die Policy `events_admin_write` wurde **ersetzt**. Jeder bestehende Verein bekommt damit die weitere Regel – gewollt (BR-033), aber eine Rechteänderung an bestehenden Daten.                                                   | Medium | Dev         |
| 6   | `datetime-local` sieht auf iOS, Android und im Desktop-Browser verschieden aus und liefert je nach Plattform andere Formate. Der Gerätetest muss das ausdrücklich prüfen.                                                       | Medium | Dev         |

---

## Progress Log

| Datum      | Update                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-09 | Plan erstellt und umgesetzt: Migration 0015, `eventSeries.ts`, `useEvents.ts`, `EventFormModal`, Einstieg in der Agenda. 186 Vitest-Tests grün. |
| 2026-09-09 | Gegen die Datenbank geprüft: Ein Ende vor dem Beginn wird vom Constraint abgewiesen (A5); ein Helfer-Event ohne Warum ebenso (BR-036); `cancel_event()` weist eine Absage ohne Grund ab (BR-035), vermerkt sie mit Grund und stellt genau eine Nachricht zu; eine zweite Absage ändert nichts und benachrichtigt niemanden erneut. Testdaten entfernt. |

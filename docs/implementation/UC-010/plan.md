# Implementation Plan: UC-010 — Auf einen Termin zu- oder absagen

|                   |                                                        |
| ----------------- | ------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                |
| **Goal**          | Der Organisation rechtzeitig mitteilen, ob man an einem Termin teilnimmt |
| **Plan created**  | 2026-09-09                                              |
| **Status**        | Done                                                    |

## Overview

Ein Mitglied sagt zu oder ab; die Absage trägt einen Grund, damit die
Organisation planen kann. Wer mehr als 24 Stunden vorher absagt, bekommt Punkte
für die Verlässlichkeit – aber nie einen Abzug (BR-039). Der Teilnehmerstand
steht am Termin und ist die Grundlage für UC-015.

Die Regeln liegen vollständig auf dem Server: Ein Client, der die 24-Stunden-
Frist selbst rechnet, kann sie auch umgehen.

## Related Use Cases

- UC-009 Termin erstellen — die Gegenseite; liefert Absage und Zeitfenster
- UC-012 Helfer-Schicht übernehmen — A4 führt dorthin
- UC-014 QR-Check-in — übernimmt nach Terminbeginn
- UC-015 Unentschlossene erinnern — arbeitet mit dem hier entstehenden Stand
- UC-016 Punkteregeln konfigurieren — die Regel `decline_early` ist abschaltbar

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                 | User Story (Kurz)                          | Status      | Notizen                                                    |
| ------ | --------------------- | ------------------------------------------ | ----------- | ---------------------------------------------------------- |
| FR-025 | Zusage erteilen       | Einem Termin zusagen                       | Implemented | Über `respond_to_event()`                                  |
| FR-026 | Absage mit Grund      | Mit einem Grund absagen                    | Implemented | Vorformulierte Gründe **und** Freitext (A1)                |
| FR-027 | Teilnehmerstand sehen | Zusagen, Absagen und Unentschlossene sehen | Implemented | `tallyAttendance()`; Grundlage für UC-015                  |
| FR-024 | Agenda ansehen        | Kommende Termine nach Teams gefiltert      | Implemented | Bestand schon; hier um Stand und Absagegrund ergänzt        |

### Business Rules

| ID     | Regel                                       | Status      | Notizen                                                                  |
| ------ | ------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| BR-037 | Eine Antwort pro Mitglied und Termin         | Implemented | Upsert auf den Primärschlüssel; nachgemessen mit vier Wechseln           |
| BR-038 | Antwort bis Terminbeginn änderbar            | Implemented | Nach dem Beginn weist `respond_to_event()` ab; nachgemessen              |
| BR-039 | Absage ohne Punkteabzug                      | Implemented | Es gibt schlicht keinen Zweig, der Punkte entzieht                       |
| BR-040 | Frist für die Abmeldeprämie                  | Implemented | `decline_is_early()`; nachgemessen 48 h → 5 Punkte, 3 h → 0              |

### Non-Functional Requirements

| ID      | Titel                    | Kategorie       | Trifft zu | Notizen                                                       |
| ------- | ------------------------ | --------------- | --------- | ------------------------------------------------------------- |
| NFR-034 | Punktequellen als Funktion | Maintainability | Ja      | Die Prämie bucht `award_points()`, nicht das Frontend         |
| NFR-017 | Dedup des Ledgers        | Security        | Ja        | Die Prämie entsteht je Termin höchstens einmal                |
| NFR-013 | Funktionsrechte          | Security        | Ja        | `respond_to_event` nur für `authenticated`                    |
| NFR-028 | Sprachparität            | Usability       | Ja        | Auch die sechs Absagegründe                                   |
| NFR-022 | Keine Verhaltensdaten    | Security        | Ja        | Der Grund bleibt am Termin und wird nicht ausgewertet         |

---

## Current State

- `supabase/migrations/0017_attendance_response.sql`: `decline_reason` und
  `responded_at` auf `attendance`; die Regel `decline_early` für bestehende
  **und** neue Vereine; `decline_is_early()`; `respond_to_event()`.
- `app/src/lib/attendance.ts`: Frist, Antwortsperre, Teilnehmerstand und die
  vorformulierten Gründe – reine Logik.
- `app/src/hooks/useAgenda.ts`: `useRespondToEvent()` läuft jetzt über die RPC
  statt über einen direkten Upsert.
- `app/src/components/DeclineModal.tsx`: das Absage-Blatt mit Gründen.
- `app/src/pages/AgendaPage.tsx`: Teilnehmerstand, Absagegrund, gesperrte
  Knöpfe bei abgesagtem oder begonnenem Termin.

---

## Missing Pieces

| #   | Was fehlt                                                                     | Anforderung | Quelle          |
| --- | ----------------------------------------------------------------------------- | ----------- | --------------- |
| 1   | A4: Ein Helfer-Event zeigt noch keine Schichtenliste statt der Zusage          | FR-031      | Cross-reference |
| 2   | Eine Detailansicht des Termins (Schritt 2 nennt Titel, Zeit, Ort **und** Warum) | FR-024     | Automated       |
| 3   | Der Hinweis auf den Punktwert einer Teilnahme (Schritt 5) fehlt in der Liste    | FR-025      | Automated       |

---

## Implementation Guidelines

- **UI-Komponenten:** `FormModal` für das Absage-Blatt, `IonRadioGroup` für die
  vorformulierten Gründe, `ListSection`, `useToast()`. Kein neues Bauteil.
- **Styling:** nur Klassen aus `src/theme/variables.css`.
- **Struktur:** Blatt unter `src/components/`, Logik in `src/lib/attendance.ts`,
  Datenzugriff in `src/hooks/useAgenda.ts`.

---

## Implementation Tasks

- [x] 1. Migration `0017_attendance_response.sql`: `decline_reason`,
      `responded_at`, die Regel `decline_early`, `decline_is_early()`.
- [x] 2. `respond_to_event()` mit allen vier Regeln: eine Antwort je Termin,
      Sperre nach Beginn, Sperre bei Absage, Prämie nur rechtzeitig.
- [x] 3. `src/lib/attendance.ts` als Gegenstück zur SQL-Frist.
- [x] 4. `useRespondToEvent()` auf die RPC umgestellt.
- [x] 5. `DeclineModal` mit vorformulierten Gründen und Freitext (A1).
- [x] 6. Teilnehmerstand, Absagegrund und gesperrte Knöpfe in der Agenda.
- [x] 7. **i18n-Vollständigkeit** — vier Sprachen, sechs Gründe.
- [x] 8. **Verdrahtung und Fehlerrückmeldung** — Fehler im Blatt, Erfolg als
      Toast; die Prämie wird genannt, wenn sie entstand.
- [x] 9. Vitest inklusive Architekturprüfung gegen die Migration.
- [x] 10. **Migration gegen die Datenbank prüfen**: Frist, Wechsel hin und her,
      abgesagter Termin, begonnener Termin.
- [x] 11. Manueller Testplan `docs/test-plans/uc-010-zu-oder-absagen.md`.
- [x] 12. **Statusabgleich** — FR-025, FR-026, FR-027 auf `Implemented`.
- [x] 13. **Terminansicht** mit Warum (Schritt 2) – `EventDetailModal`; der Punktwert (Schritt 5) bleibt offen.
- [x] 15. **Schnitt der bestehenden myclub-App** — Status-Symbol am Zeilenanfang, Wischen für die Gegenantwort, Zusagen-Zahl rechts, Spaltenköpfe «Status / Teilnehmer», Detail mit «Mein Status» und den drei Listen.
- [ ] 14. **Plattform-Parität** — Blatt und Radioliste auf iOS, Android, Browser.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                                 | Impact | Owner       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **Spec-Lücke:** A1 nennt «vorformulierte Gründe», aber keine Liste. Angenommen: krank, Arbeit, Familie, abwesend, verletzt, anderer Grund. Der letzte öffnet ein Freitextfeld, damit keine Absage in eine Schublade gezwungen wird. | Medium | Stakeholder |
| 2   | **Spec-Lücke:** Die Regel für die Abmeldeprämie hat keinen Code in der Spezifikation. Angenommen: `decline_early`, Säule 6 (Verlässlichkeit), 5 Punkte. Bestehende Vereine bekommen sie per Migration, neue über `seed_point_rules()`. Sie ist wie jede Regel abschaltbar (UC-016). | Medium | Stakeholder |
| ~~3~~ | ~~Die Zahl der Unentschlossenen rechnete mit der Vereinsgrösse und war bei jedem Team-Termin zu hoch.~~ Behoben: Grundlage ist jetzt das betroffene Team, sonst der Verein. | — | Dev |
| 4   | Der Absagegrund ist Freitext und landet in der Datenbank. NFR-022 verbietet Verhaltensdaten; ein Grund ist keine, aber die Aufbewahrungsdauer ist offen (dieselbe Frage wie bei den Sprachmemos). | Medium | Stakeholder |

---

## Progress Log

| Datum      | Update                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-09 | Plan erstellt und umgesetzt: Migration 0017, `attendance.ts`, `DeclineModal`, Agenda mit Teilnehmerstand. |
| 2026-09-09 | Gegen die Datenbank geprüft: Absage 48 h vorher → 5 Punkte, 3 h vorher → 0 (BR-040); vier Wechsel zwischen Zu- und Absage ergeben **eine** Antwortzeile und **eine** Prämienbuchung (BR-037, NFR-017); ein abgesagter Termin (A3) und ein begonnener (BR-038) weisen jede Antwort ab. Testdaten entfernt. |
| 2026-09-09 | Die Migration lag zunächst als `0016`; parallel war remote bereits ein `0016_guard_last_admin_club_delete` eingespielt. Meine Migration ist auf `0017` umnummeriert und der Verlauf geradegezogen. |
| 2026-09-11 | An-/Abmeldung auf den Schnitt der bestehenden myclub-App (`github.com/myclubapp/app`: `trainings.page.html`, `training-detail.page.html`, `status-icon`) gebracht: `AttendanceStatusIcon` (Ampel-Symbol, Tippen schaltet um), `IonItemSliding` mit grünem Haken und rotem Kreuz, Zusagen-Zahl als `IonBadge`, Spaltenköpfe, Termin-Detail `EventDetailModal` mit Eckdaten, «Mein Status» und Akkordeons Zugesagt / Abgesagt / Keine Antwort. Die Absage läuft weiterhin über das Blatt mit dem Grund (FR-026). Team-Termine zeigen Nichtbetroffenen «nicht für dich» statt eines Antwortstands. |

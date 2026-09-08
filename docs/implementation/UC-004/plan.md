# Implementation Plan: UC-004 — Beitritts-Anfrage entscheiden

|                   |                                                                        |
| ----------------- | ---------------------------------------------------------------------- |
| **Primary Actor** | Vorstand                                                                |
| **Goal**          | Über eine offene Beitritts-Anfrage entscheiden und die Person aufnehmen oder ablehnen |
| **Plan created**  | 2026-09-08                                                              |
| **Status**        | Done                                                                    |

## Overview

Wer keine Einladung hat, stellt eine Anfrage an den Verein; der Vorstand nimmt
auf oder lehnt ab. Jeder Entscheid hält fest, wer wann entschieden hat
(BR-014), und die anfragende Person erfährt das Ergebnis – bei einer Ablehnung
neutral formuliert und ohne gespeicherte Begründung (BR-016).

Der Weg ergänzt UC-002: Eine abgelaufene oder ausgeschöpfte Einladung bietet
ausdrücklich diesen Ausweg an.

## Related Use Cases

- UC-002 Per Einladung beitreten — der andere Weg; verweist bei ungültiger
  Einladung hierher
- UC-003 Einladung erstellen — die Alternative, die keine Entscheidung braucht
- UC-007 Mitglieder und Teams verwalten — nimmt die entstandene Mitgliedschaft auf
- UC-028 Benachrichtigungen einstellen — die Inbox, in der der Entscheid landet

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                      | User Story (Kurz)                                   | Status  | Notizen                                                        |
| ------ | -------------------------- | --------------------------------------------------- | ------- | -------------------------------------------------------------- |
| FR-009 | Beitritts-Anfrage stellen  | Ohne Einladung eine Anfrage an einen Verein stellen | Implemented | Dritter Weg im Onboarding, über den Kurznamen des Vereins    |
| FR-010 | Beitritts-Anfrage entscheiden | Anfragen genehmigen oder ablehnen                | Implemented | `JoinRequestPage`; gegen die Datenbank geprüft                |
| FR-078 | In-App-Inbox               | Jede Benachrichtigung nachlesen                      | Partial | `notifications` und `useInbox()` bestehen; die Ansicht ist UC-028 |

### Business Rules

| ID     | Regel                              | Status  | Notizen                                                              |
| ------ | ---------------------------------- | ------- | -------------------------------------------------------------------- |
| BR-013 | Entscheid nur durch den Vorstand    | Implemented | In `decide_join_request()` geprüft; gegen ein Mitgliedskonto nachgemessen |
| BR-014 | Entscheid ist nachvollziehbar       | Implemented | `decided_by` und `decided_at` werden gesetzt – nachgemessen           |
| BR-015 | Standardrolle bei Aufnahme          | Implemented | Formular und `resolveJoinDecision()` fallen auf `member` zurück       |
| BR-016 | Ablehnung ohne Begründungszwang     | Implemented | Kein Begründungsfeld, keine Spalte, neutrale Nachricht                |

### Non-Functional Requirements

| ID      | Titel               | Kategorie | Trifft zu | Notizen                                                            |
| ------- | ------------------- | --------- | --------- | ------------------------------------------------------------------ |
| NFR-011 | Mandantentrennung   | Security  | Ja        | Eine Anfrage darf nur der betroffene Verein sehen                  |
| NFR-013 | Funktionsrechte     | Security  | Ja        | Zwei neue `security definer`-Funktionen brauchen eigene Grants     |
| NFR-009 | Push-Fallback       | Availability | Ja     | Der Entscheid landet in der Inbox, unabhängig von Push             |
| NFR-028 | Sprachparität       | Usability | Ja        | Auch die Benachrichtigungstexte                                     |
| NFR-022 | Keine Verhaltensdaten | Security | Ja       | Eine Ablehnung speichert keine Begründung (BR-016)                 |

---

## Current State

- `supabase/migrations/0001_core.sql`: Tabelle `join_requests` mit `status`,
  `decided_by`, `decided_at` und der Eindeutigkeit je Verein und Konto.
- `supabase/migrations/0006_rls.sql`: `join_requests_own` (lesen),
  `join_requests_insert` (selbst stellen), `join_requests_decide` (Vorstand).
- `app/src/hooks/useNews.ts`: `useInbox()` liest `notifications`.
- `app/src/pages/onboarding/JoinByInvitePage.tsx`: bietet bei ungültiger
  Einladung «Beitritts-Anfrage stellen» an – **der Knopf führt heute nur ins
  Onboarding**, weil es die Anfrage nicht gibt.
- **Nicht vorhanden:** ein Weg, eine Anfrage zu stellen; die Liste offener
  Anfragen; der Entscheid; die Benachrichtigung; der Status `withdrawn` (A3);
  die Spalte `notifications.category` aus dem Entitätsmodell.

---

## Missing Pieces

| #   | Was fehlt                                                                            | Anforderung        | Quelle          |
| --- | ------------------------------------------------------------------------------------ | ------------------ | --------------- |
| 1   | Ein Gast kann keine Anfrage stellen – und findet den Verein nicht                     | FR-009             | Automated       |
| 2   | Die Liste offener Anfragen fehlt                                                      | FR-010, Schritt 2/3 | Automated      |
| 3   | Aufnehmen und Ablehnen mit Vermerk der entscheidenden Person                          | FR-010, BR-013–015 | Automated       |
| 4   | Die anfragende Person wird nicht benachrichtigt                                       | Schritt 7, A1      | Automated       |
| 5   | Status `withdrawn` für die zurückgezogene Anfrage (A3)                                 | A3                 | Cross-reference |
| 6   | `notifications.category` aus dem Entitätsmodell fehlt in der Tabelle                   | FR-078             | Cross-reference |

---

## Implementation Guidelines

- **UI-Komponenten:** `AppPage`, `ListSection`, `SkeletonList`, `EmptyState`,
  `ErrorState`, `FormModal` für den Entscheid, `IonSelect` für Rolle und Team,
  `useToast()` für die Rückmeldung, `IonBadge` für die Anzahl offener Anfragen.
  Kein neues Bauteil.
- **Styling:** nur Klassen aus `src/theme/variables.css`.
- **Struktur:** Seite unter `src/pages/club/`, Datenzugriff in
  `src/hooks/useJoinRequests.ts`. Entscheidungslogik als reine Funktion in
  `src/lib/`, weil Ionic-Eingaben im Test nicht bedienbar sind.

---

## Implementation Tasks

- [x] 1. Migration `0010_join_requests.sql`: `notifications.category`,
      Status `withdrawn`, Index auf offene Anfragen je Verein.
- [x] 2. Dieselbe Migration: `notify()` als interne Routine, die einen
      Inbox-Eintrag schreibt – von hier an brauchen sie viele Use Cases.
- [x] 3. Dieselbe Migration: `find_club_by_slug()` gibt zu einem exakten
      Kurznamen Verein und Name zurück, damit ein Gast seinen Verein findet.
- [x] 4. Dieselbe Migration: `request_join(p_club_id, p_team_id)` legt die
      Anfrage an, verwirft eine doppelte still und benachrichtigt den Vorstand.
- [x] 5. Dieselbe Migration: `decide_join_request(p_request_id, p_approve,
      p_role, p_team_id)` – prüft `is_club_admin()`, vermerkt Entscheid und
      Zeitpunkt, legt bei Aufnahme die Mitgliedschaft an, benachrichtigt.
- [x] 6. Dieselbe Migration: `withdraw_join_request()` für A3 und die Grants
      aller neuen Funktionen (NFR-013).
- [x] 7. `src/hooks/useJoinRequests.ts`: offene Anfragen, eigene Anfrage,
      Stellen, Entscheiden, Zurückziehen.
- [x] 8. `OnboardingPage`: dritter Weg «Beitritts-Anfrage» mit Kurzname-Suche
      und Bestätigung des gefundenen Vereins.
- [x] 9. Eigene Anfrage sichtbar machen, solange sie offen ist – sonst weiss die
      anfragende Person nicht, dass sie wartet.
- [x] 10. `JoinRequestPage` für den Vorstand: Liste, Entscheid, Rolle und Team.
- [x] 11. Einstieg im Profil mit der Anzahl offener Anfragen.
- [x] 12. **i18n-Vollständigkeit** — alle Texte in vier Sprachen.
- [x] 13. **Verdrahtung und Fehlerrückmeldung** — jeder Fehlschlag zeigt eine
      Meldung.
- [x] 14. Vitest für die reine Logik des Entscheids.
- [x] 15. Manueller Testplan `docs/test-plans/uc-004-beitritts-anfrage.md`.
- [x] 16. **Migration gegen die Datenbank prüfen**, inklusive der Grants.
- [ ] 17. **Statusabgleich** — FR-009 und FR-010 nachziehen, `Status` in
      `UC-004-beitritts-anfrage-entscheiden.md` setzen.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                                                       | Impact | Owner       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **Spec-Lücke:** Wie findet ein Gast «seinen» Verein? Ein Verzeichnis ist ausgeschlossen (C-028: kein öffentlicher Bereich). Annahme: Er gibt den Kurznamen ein, den ihm der Verein nennt; `find_club_by_slug()` antwortet nur auf einen exakten Treffer und nur angemeldeten Personen. Durch Test festgehalten. | Medium | Stakeholder |
| 2   | Kurznamen entstehen aus dem Vereinsnamen und sind damit erratbar. Die Funktion gibt nur den Namen zurück, den die Person ohnehin kennen muss – kein Mitgliederbestand, keine Interna. Ein Verzeichnis entsteht dadurch nicht.          | Low    | Architect   |
| 3   | **Spec-Lücke:** Darf eine abgelehnte Person erneut anfragen? Die Spezifikation schweigt. Annahme: ja, aber erst, wenn die alte Anfrage einen Endstatus trägt – die Eindeutigkeit je Verein und Konto verlangt ohnehin eine Bereinigung.  | Medium | Stakeholder |
| 4   | Der Entscheid landet in `notifications`; die Ansicht dafür entsteht erst mit UC-028. Bis dahin sieht die anfragende Person das Ergebnis am Zustand ihrer Anfrage im Onboarding.                                                       | Medium | Dev         |

---

## Progress Log

| Datum      | Update                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-08 | Plan erstellt                                                                                                                         |
| 2026-09-08 | Umsetzung: Migration 0010 (`notify()`, `find_club_by_slug()`, `request_join()`, `decide_join_request()`, `withdraw_join_request()`, Status `withdrawn`, `notifications.category`), dritter Onboarding-Weg, `JoinRequestPage`. 98 Vitest-Tests grün. |
| 2026-09-08 | Gegen die Datenbank geprüft: Anfrage stellen benachrichtigt genau einen Vorstand und legt keine Mitgliedschaft an; ein Mitglied wird beim Entscheiden abgewiesen (BR-013); die Aufnahme vermerkt Entscheider:in und Zeitpunkt (BR-014) und legt die Mitgliedschaft mit der gewählten Rolle an; ein zweiter Entscheid kippt den ersten nicht und erzeugt keine zweite Nachricht. `notify()` ist für `anon` und `authenticated` gesperrt. Testdaten entfernt. |
| 2026-09-08 | Code-Review: Das Zurückziehen zeigte einen Fehlschlag nicht an – `InlineError` ergänzt. `onboarding.requestSent` war durch `requestPending` ersetzt und wurde entfernt. |

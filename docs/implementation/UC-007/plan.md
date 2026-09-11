# Implementation Plan: UC-007 — Mitglieder, Rollen und Teams verwalten

|                   |                                                          |
| ----------------- | -------------------------------------------------------- |
| **Primary Actor** | Vorstand                                                  |
| **Goal**          | Die Vereinsstruktur abbilden, indem Mitglieder Rollen und Teams zugeordnet werden |
| **Plan created**  | 2026-09-09                                                |
| **Status**        | Done                                                      |

## Overview

Der Vorstand sieht alle Mitglieder mit Rolle, Teams und Status, sucht und
filtert darin und ändert Rolle, Status und Team-Zuordnung. Die eine Regel, die
dabei nie brechen darf: Ein Verein hat zu jedem Zeitpunkt mindestens eine
Person mit Vorstandsrechten (BR-026). Sie hängt an einem Trigger und nicht an
einem ausgeblendeten Knopf, damit sie auch bei einem direkten Aufruf der
REST-API greift (BR-027).

## Related Use Cases

- UC-004 Beitritts-Anfrage entscheiden — legt Mitgliedschaften an
- UC-003 Einladung erstellen — der Geltungsbereich sind die hier gepflegten Teams
- UC-006 Konto löschen — verlangt einen zweiten Vorstand, der hier bestimmt wird
- UC-009 Termin erstellen — Termine hängen an Teams
- UC-022 Leaderboard einsehen — die Team-Rangliste folgt dieser Zuordnung

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                   | User Story (Kurz)                                | Status      | Notizen                                                       |
| ------ | ----------------------- | ------------------------------------------------ | ----------- | ------------------------------------------------------------- |
| FR-013 | Mitgliederliste         | Alle Mitglieder mit Rolle, Team und Status sehen | Implemented | `MemberPage`, sortiert nach Name                              |
| FR-014 | Rolle zuweisen          | member, trainer oder admin zuweisen              | Implemented | `superadmin` wird bewusst nicht angeboten                     |
| FR-015 | Team anlegen            | Teams anlegen und benennen                       | Implemented | A1, direkt aus der Mitgliederverwaltung                       |
| FR-016 | Team-Zuordnung          | Mitglieder einem oder mehreren Teams zuordnen    | Implemented | `set_member_teams()` setzt den ganzen Satz in einem Schritt   |
| FR-017 | Mitgliedsstatus pflegen | aktiv, passiv, Ehrenmitglied, ausgetreten        | Implemented | A3                                                            |

### Business Rules

| ID     | Regel                          | Status      | Notizen                                                                        |
| ------ | ------------------------------ | ----------- | ------------------------------------------------------------------------------ |
| BR-024 | Vier Rollen                     | Implemented | Die Reichweite von Trainer:innen entsteht über die Team-Zuordnung              |
| BR-025 | Mehrfachzuordnung               | Implemented | Kästchen statt Auswahl; gegen die Datenbank nachgemessen                       |
| BR-026 | Mindestens ein Vorstand         | Implemented | Trigger auf `club_members`, bei Update **und** Delete; nachgemessen            |
| BR-027 | Rollenprüfung serverseitig      | Implemented | Policy und Trigger; der direkte SQL-Weg wurde abgewiesen                       |

### Non-Functional Requirements

| ID      | Titel               | Kategorie   | Trifft zu | Notizen                                                          |
| ------- | ------------------- | ----------- | --------- | ---------------------------------------------------------------- |
| NFR-002 | Listenaufbau ≤ 2 s  | Performance | Ja        | Eine Abfrage mit eingebetteten Teams statt N+1; gefiltert wird im Client |
| NFR-011 | Mandantentrennung   | Security    | Ja        | `set_member_teams()` weist ein Team aus einem fremden Verein ab  |
| NFR-013 | Funktionsrechte     | Security    | Ja        | Die Trigger-Funktionen sind für niemanden ausführbar             |
| NFR-028 | Sprachparität       | Usability   | Ja        | Auch Rollen- und Statusnamen, inklusive Plural                   |

---

## Current State

- `supabase/migrations/0012_members_teams.sql`: `count_club_admins()`,
  `guard_last_admin()` als Trigger auf Update und Delete, `set_member_teams()`.
- `app/src/lib/member.ts`: `filterMembers()`, `isLastAdmin()` und die
  Auswahllisten – reine Logik, vollständig geprüft.
- `app/src/hooks/useMembers.ts`: Liste mit Teams, Rolle und Status ändern,
  Teams setzen, Team anlegen.
- `app/src/pages/club/MemberPage.tsx`: Suche, drei Filter, Detailblatt,
  Team-Anlage.
- `app/src/pages/ProfilePage.tsx`, `TabsPage.tsx`: Einstieg und Route.

---

## Missing Pieces

| #   | Was fehlt                                                                       | Anforderung | Quelle          |
| --- | ------------------------------------------------------------------------------- | ----------- | --------------- |
| ~~1~~ | ~~Mitgliederliste, Rollenwechsel, Team-Zuordnung, Status~~ – erledigt          | FR-013–017  | Automated       |
| 2   | Ein Team lässt sich umbenennen oder auflösen – die Spezifikation nennt nur das Anlegen | FR-015 | Cross-reference |
| 3   | Der Anzeigename eines Mitglieds ist für den Vorstand nicht änderbar; UC-008 gibt ihn der Person selbst | FR-018 | Cross-reference |

---

## Implementation Guidelines

- **UI-Komponenten:** `AppPage` mit `IonSearchbar` in der zweiten Toolbar,
  `ListSection`, `FormModal` für Detail und Team-Anlage, `IonCheckbox` für die
  Mehrfachzuordnung, `IonSelect` für Rolle und Status, `SkeletonList`,
  `useToast()`. Kein neues Bauteil.
- **Styling:** nur Klassen aus `src/theme/variables.css`.
- **Struktur:** Seite unter `src/pages/club/`, Datenzugriff in
  `src/hooks/useMembers.ts`, Filterlogik als reine Funktion in `src/lib/member.ts`.

---

## Implementation Tasks

- [x] 1. Migration `0012_members_teams.sql`: `count_club_admins()` und der
      Trigger, der den letzten Vorstand schützt – bei Update und bei Delete.
- [x] 2. Dieselbe Migration: `set_member_teams()` setzt den ganzen Satz Teams
      in einem Schritt und weist fremde Teams ab.
- [x] 3. `src/lib/member.ts`: Filtern, Sortieren, `isLastAdmin()`.
- [x] 4. `src/hooks/useMembers.ts`: Liste mit Teams, Änderungen, Team-Anlage.
- [x] 5. `MemberPage`: Liste mit Suche und drei Filtern (Schritt 2, A4).
- [x] 6. Detailblatt mit Rolle, Status, Eintrittsdatum und Teams (Schritt 4–7).
- [x] 7. Hinweis im Detail, wenn die Person der einzige Vorstand ist (A2).
- [x] 8. Team anlegen aus der Mitgliederverwaltung (A1).
- [x] 9. Route und Einstieg im Profil.
- [x] 10. **i18n-Vollständigkeit** — vier Sprachen, Plural über `_one`/`_other`.
- [x] 11. **Verdrahtung und Fehlerrückmeldung** — jeder Fehlschlag zeigt eine
      Meldung; die Abweisung des Triggers ist die Erklärung.
- [x] 12. Vitest für `filterMembers()` und `isLastAdmin()`.
- [x] 13. **Migration gegen die Datenbank prüfen**: Herabstufung des letzten
      Vorstands, Team-Zuordnung durch eine Trainer:in, Mehrfachzuordnung,
      Ersetzen statt Anhängen.
- [x] 14. Manueller Testplan `docs/test-plans/uc-007-mitglieder-teams.md`.
- [x] 15. **Statusabgleich** — FR-013 bis FR-017 auf `Implemented`,
      Use-Case-Status gesetzt.
- [ ] 16. **Plattform-Parität** — Suchfeld, Kästchen und Blatt auf iOS,
      Android und im Browser.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                                                 | Impact | Owner       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | Das Speichern läuft in zwei Schritten: erst Rolle und Status, dann die Teams. Scheitert der zweite, ist der erste bereits gespeichert. Der Toast nennt den Fehler, und ein zweiter Versuch ist gefahrlos – eine gemeinsame Funktion wäre sauberer, aber für den seltenen Fall zu viel. | Medium | Dev |
| 2   | **Spec-Lücke:** Ein Team lässt sich anlegen, aber nicht umbenennen oder auflösen. Die Spezifikation nennt nur A1 «Team anlegen». Angenommen: Umbenennen und Auflösen sind später eigene Schritte, nicht Teil von UC-007.        | Low    | Stakeholder |
| 3   | Gefiltert wird im Client. Bei 500 Mitgliedern (NFR-002) ist das schnell genug; bei deutlich mehr müsste die Suche auf den Server wandern.                                                                                       | Low    | Dev         |
| 4   | Eine über UC-006 gelöschte Person bleibt als «Ehemaliges Mitglied» mit Status `left` in der Liste. Das ist gewollt (die Punktebuchungen hängen daran), muss dem Vorstand aber erklärt werden.                                    | Low    | Dev         |

---

## Nachtrag vom 2026-09-11: die Teamseite

Die Spezifikation verlangt Teams nur als Zuordnung (Schritt 6, A1); die
bestehende myclub-App hat drei Seiten dafür, und UC-039 setzt in Schritt 1 ein
Teamformular voraus, das es nicht gab. Jetzt: `TeamPage` (nach Bereich
gruppiert, Plus unten rechts), `TeamDetailModal` (Name, Bereich, Mitglieder
mit Wischen zum Entfernen, Löschen mit Rückfrage) und `delete_team()` als
Riegel gegen ein Team mit Terminen – `events.team_id` kaskadiert, und niemand
will mit einem Team dessen Vergangenheit löschen. Dazu in der Mitgliederliste
der Avatar am Zeilenanfang und die Rolle als Abzeichen, wie im `user-list-item`
der alten App.

## Progress Log

| Datum      | Update                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-09 | Plan erstellt und umgesetzt: Migration 0012, `member.ts`, `useMembers.ts`, `MemberPage`. 120 Vitest-Tests grün.                             |
| 2026-09-09 | Gegen die Datenbank geprüft: Die Herabstufung des einzigen Vorstands wird auch **direkt in SQL** abgewiesen (BR-026, BR-027); mit einem zweiten Vorstand geht sie durch; eine Trainer:in darf keine Teams setzen; `set_member_teams()` ordnet mehreren Teams zu (BR-025) und **ersetzt** den Satz, statt anzuhängen. Testdaten entfernt. |
| 2026-09-09 | Code-Review ohne Befund: keine Inline-Styles, keine ARIA-Rolle auf einer Ionic-Komponente, kein ungenutzter Schlüssel. Dabei aufgefallen und behoben: `members.count` brauchte `_one`/`_other`, ein blosser `count`-Schlüssel wird von i18next nie verwendet. |

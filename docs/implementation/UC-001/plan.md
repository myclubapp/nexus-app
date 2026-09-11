# Implementation Plan: UC-001 — Verein gründen

|                   |                                                                        |
| ----------------- | ---------------------------------------------------------------------- |
| **Primary Actor** | Vorstand                                                                |
| **Goal**          | Einen Vereins-Workspace anlegen, der sofort ohne weitere Konfiguration nutzbar ist |
| **Plan created**  | 2026-09-08                                                              |
| **Status**        | In Progress                                                             |

## Overview

Eine Person legt einen Verein an und wird dabei zum Vorstand. Der Wizard fragt
Name, Vereinsart und Saisonbeginn ab – höchstens drei Schritte, damit die
Gründung unter drei Minuten bleibt. Das System erzeugt Kurznamen, Mitgliedschaft
mit der Rolle `admin`, den zur Vereinsart passenden Satz Punkteregeln und die
Standard-Terminlabels, und führt danach auf einen Startbildschirm mit genau drei
Handlungsangeboten. Der Verein ist damit ohne einen weiteren
Konfigurationsschritt benutzbar (Zero-Config-Start, K7).

## Related Use Cases

`docs/use_cases.md` (Use-Case-Diagramm) existiert nicht – die Beziehungen
stammen aus den Spezifikationen selbst:

- UC-005 Anmelden — Vorbedingung
- UC-003 Einladung erstellen — eines der drei Handlungsangebote in Schritt 9
- UC-009 Termin erstellen — eines der drei Handlungsangebote
- UC-016 Punkteregeln konfigurieren — eines der drei Handlungsangebote
- UC-002 Per Einladung beitreten — der andere Weg in einen Verein

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel               | User Story (Kurz)                                          | Status  | Notizen                                                                     |
| ------ | ------------------- | ---------------------------------------------------------- | ------- | --------------------------------------------------------------------------- |
| FR-004 | Verein gründen      | Vorstand legt Workspace in unter drei Minuten an            | Partial | `create_club()` und `OnboardingPage` bestehen; der Wizard ist einstufig      |
| FR-005 | Vereinsart wählen   | Vereinsart beim Gründen angeben                             | Partial | Auswahl vorhanden; «Anderes» nimmt keine eigene Bezeichnung entgegen        |
| FR-006 | Zero-Config-Start   | Agenda, Einladung und Punkteregeln sofort nutzbar           | Partial | Punkteregeln werden gesät; Terminlabels und der Startbildschirm fehlen      |
| FR-113 | Saisonbeginn setzen | Punkte und Ranglisten auf die eigene Saison zuschneiden     | Missing | Nur nachträglich in den Vereinseinstellungen, nicht im Gründungsablauf       |
| FR-112 | Begriffe konfigurieren | Bezeichnungen für Termintypen festlegen                  | Partial | Änderbar in den Einstellungen; bei der Gründung wird nichts vorbelegt        |
| FR-011 | Mehrere Vereine     | Mehreren Vereinen angehören und wechseln                    | Partial | Wechsler im Profil vorhanden; ein weiterer Verein lässt sich nicht gründen   |
| FR-035 | Standard-Punkteregeln | Vollständiger Satz passend zur Vereinsart                 | Implemented | `seed_point_rules()` in `0005_onboarding.sql`                             |

### Business Rules

| ID     | Regel                                                        | Status  | Notizen                                                                   |
| ------ | ------------------------------------------------------------ | ------- | ------------------------------------------------------------------------- |
| BR-001 | Vereinsart steuert nur Vorlagen, ist jederzeit änderbar       | Partial | Sie schränkt nichts ein; änderbar ist sie in den Einstellungen noch nicht  |
| BR-002 | Zero-Config-Start                                             | Partial | Terminlabels fehlen, der Startbildschirm führt nicht weiter                |
| BR-003 | Gründerin wird Vorstand, ein Verein hat immer einen Vorstand   | Partial | `create_club()` setzt `admin`; die Untergrenze schützt niemand (siehe UC-007) |
| BR-004 | Höchstens drei Eingabeschritte                                | Missing | Heute ein Formular ohne Schritte und ohne Saisonbeginn                     |

### Non-Functional Requirements

| ID      | Titel                    | Kategorie       | Trifft zu | Notizen                                                             |
| ------- | ------------------------ | --------------- | --------- | ------------------------------------------------------------------- |
| NFR-024 | Gründungsdauer ≤ 3 min   | Usability       | Ja        | Der Wizard bestimmt sie unmittelbar                                 |
| NFR-011 | Mandantentrennung        | Security        | Ja        | Neuer Verein muss sofort unter RLS stehen                           |
| NFR-013 | Funktionsrechte          | Security        | Ja        | Neue Signatur von `create_club()` braucht eigene Grants             |
| NFR-028 | Sprachparität            | Usability       | Ja        | Wizard-Texte in allen vier Sprachen                                 |
| NFR-035 | Saisonlogik konsistent   | Maintainability | Ja        | Der hier gesetzte Saisonbeginn speist `season_label()`              |
| NFR-033 | Typsicherheit            | Maintainability | Ja        | `npm run verify`                                                    |
| NFR-027 | Barrierefreiheit         | Usability       | Ja        | Onboarding ist ein Kernfluss                                        |

---

## Current State

- `supabase/migrations/0005_onboarding.sql`: `create_club(p_name, p_club_kind)`
  legt Verein, eindeutigen Slug (Schritt 8, A1) und die Mitgliedschaft mit
  Rolle `admin` an und ruft `seed_point_rules()`. Nimmt **keinen** Saisonbeginn
  entgegen und schreibt **keine** Terminlabels.
- `supabase/migrations/0005_onboarding.sql`: `seed_point_rules()` erzeugt je
  Vereinsart einen Satz Regeln über die sieben Säulen (FR-035).
- `supabase/migrations/0007_function_grants.sql`: `create_club(text, text)` ist
  `authenticated` freigegeben, `seed_point_rules` niemandem.
- `app/src/pages/onboarding/OnboardingPage.tsx`: ein Formular mit Name und
  Vereinsart (Schritte 1–5), ohne Saisonbeginn und ohne Schrittführung.
- `app/src/components/RouteGuards.tsx`: `RedirectIfClubMember` verhindert, dass
  die Seite nach der Gründung stehen bleibt.
- `app/src/hooks/useClub.tsx`: Vereinswechsler und `eventLabel()` lesen bereits
  aus `clubs.settings.labels` – dort steht nach der Gründung nichts.
- **Nicht vorhanden:** Schritt 6/7 (Saisonbeginn), Schritt 9 (Startbildschirm
  mit drei Angeboten), A3 (weiterer Verein), eigene Bezeichnung bei «Anderes».

---

## Missing Pieces

| #   | Was fehlt                                                                | Anforderung             | Quelle           |
| --- | ------------------------------------------------------------------------ | ----------------------- | ---------------- |
| 1   | Saisonbeginn im Gründungsablauf, mit einem zur Vereinsart passenden Vorschlag | FR-113, UC-001 Schritt 6/7 | Cross-reference |
| 2   | Standard-Terminlabels werden bei der Gründung nicht gesetzt              | FR-112, FR-006, BR-002  | Cross-reference  |
| 3   | Wizard mit höchstens drei Schritten statt eines Formulars                 | BR-004, NFR-024         | Cross-reference  |
| 4   | Startbildschirm mit genau drei Handlungsangeboten                         | FR-006, UC-001 Schritt 9 | Automated       |
| 5   | Eigene Bezeichnung bei Vereinsart «Anderes»                              | FR-005, UC-001 Schritt 5 | Automated        |
| 6   | Weiteren Verein gründen, wenn bereits eine Mitgliedschaft besteht         | FR-011, A3              | Automated        |
| 7   | Eingaben bleiben nach einem Fehler im Formular erhalten                   | UC-001 Failure Postcondition | Automated   |
| 8   | Alte Signatur `create_club(text, text)` bliebe als offener RPC bestehen   | NFR-013                 | Cross-reference  |

---

## Implementation Guidelines

Aus `docs/guidelines.md`, verbindlich:

- **UI-Komponenten:** `AppPage` als Seitengerüst, `ListSection` für die
  Auswahllisten (Vereinsart, Handlungsangebote), `StateViews` für Lade- und
  Fehlerzustände, `IonSegment` für die Wahl zwischen Gründen und Beitreten,
  `IonInput`/`IonDatetime` für die Eingaben, `IonProgressBar` für den
  Wizard-Fortschritt. Kein neues Bauteil, ausser dem Wizard-Rahmen selbst –
  der ist eigenständig genug für `src/components/`.
- **Styling:** ausschliesslich Klassen aus `src/theme/variables.css`. Neue
  Klassen mit Präfix `app-`. Keine Inline-Styles.
- **Struktur & Benennung:** Seite bleibt unter `src/pages/onboarding/`,
  Bezeichner englisch, Kommentare deutsch. Datenbankänderung als
  `supabase/migrations/0008_club_founding.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0008_club_founding.sql`: `default_event_labels(p_club_kind)`
      liefert je Vereinsart die Standard-Terminlabels als `jsonb`.
- [x] 2. Dieselbe Migration: `default_season_start(p_club_kind)` liefert den
      vorgeschlagenen Saisonbeginn, damit Vorschlag und Serverwert nicht
      auseinanderlaufen.
- [x] 3. Dieselbe Migration: `create_club(p_name, p_club_kind, p_season_start,
      p_kind_label)` ersetzt die alte Fassung, setzt `season_start` und schreibt
      Labels und – bei «Anderes» – die eigene Bezeichnung nach `clubs.settings`.
- [x] 4. Dieselbe Migration: alte Signatur `create_club(text, text)` löschen und
      Grants für die neue Signatur setzen — NFR-013.
- [x] 5. `src/lib/clubKind.ts` mit Test, der die Monate gegen die Migration hält.
- [x] 6. `src/components/Wizard.tsx`: Schrittführung mit Fortschritt.
- [x] 7. `OnboardingPage` auf `AppPage` + `Wizard`: drei Schritte, Eingaben
      bleiben bei einem Fehler stehen.
- [x] 8. `useCreateClub()` in `src/hooks/useOnboarding.ts`.
- [x] 9. `FirstStepsCard` auf dem Dashboard: genau drei Handlungsangebote.
- [x] 10. Weiteren Verein gründen: Eintrag im Profil, `?another=1` als
      Ausnahme in `RedirectIfClubMember`, Weiterleitung nach der Gründung.
- [x] 11. **i18n-Vollständigkeit** — alle neuen Texte in vier Sprachen,
      `npm run i18n:check` läuft durch.
- [x] 12. **Mock- und Vertragsabgleich** — `database.generated.ts` hinkt der
      Migration hinterher und lässt sich ohne Datenbank nicht neu erzeugen. Die
      neuen Signaturen sind deshalb in `database.types.ts` überlagert, mit dem
      Vermerk, sie nach dem nächsten `types:generate` zu entfernen (NFR-036).
- [x] 14. **Verdrahtung und Fehlerrückmeldung** — geprüft; kein unbenutzter
      neuer Schlüssel, jeder Fehlschlag zeigt eine Meldung.
- [ ] 13. **Plattform-Parität** — Wizard und Datumsauswahl auf iOS, Android und
      im Browser (Testplan TC-009).
- [x] 15. **Beispielinhalte** — Schritt 9 der Spezifikation verlangt
      gekennzeichnete Beispielinhalte. Geliefert von UC-037 am 2026-09-11:
      `create_club()` legt sie mit an, `seed_sample_content()` kennzeichnet sie.
- [x] 16. **Migrationen gegen eine laufende Datenbank prüfen**
      (`supabase db reset`).
- [ ] 17. **Statusabgleich** — FR-004, FR-005, FR-006, FR-112, FR-113 nachziehen
      und `Status` in `UC-001-verein-gruenden.md` setzen. Erst nach 13, 15, 16.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                | Impact | Owner       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **Spec-Lücke:** Welcher Saisonbeginn passt zu welcher Vereinsart? Die Spezifikation sagt nur «schlägt einen passenden Monat vor». Annahme: Sport 1. Juli, Musik 1. September, Kultur 1. September, Jugend 1. August, Quartier 1. Januar, Anderes 1. Januar. Festgehalten durch einen Test auf `defaultSeasonStart()`. Klärung nötig. | Medium | Stakeholder |
| 2   | **Spec-Lücke:** Wann gilt ein Verein als «neu» und zeigt die drei Handlungsangebote? Annahme: solange kein Termin existiert und der Verein höchstens ein Mitglied hat. Durch Test festgehalten. | Low | Stakeholder |
| ~~3~~ | ~~Migrationen nur im Repository.~~ Erledigt: am 2026-09-08 nach ausdrücklicher Freigabe auf das verknüpfte Projekt angewendet und geprüft. | — | Dev |
| 4   | BR-003 verlangt, dass ein Verein nie ohne Vorstand bleibt. Die Gründung erfüllt das; die Absicherung gegen Herabstufung und Kontolöschung gehört zu UC-007 und UC-006. | Medium | Dev |
| 5   | `docs/use_cases.md` und `docs/entity_model.md` sind während der Umsetzung entstanden; die Beziehungen im Plan stammen noch aus den Spezifikationen selbst. | Low | Architect |
| 6   | Schritt 9 der Spezifikation (gekennzeichnete Beispielinhalte) ist nach der Planerstellung dazugekommen und gehört zu UC-037. UC-001 ist bis dahin nicht vollständig. | Medium | Dev |

---

## Progress Log

| Datum      | Update                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-08 | Plan erstellt                                                                                                                   |
| 2026-09-08 | Umsetzung: Migration 0008, Wizard, `clubKind.ts`, `FirstStepsCard`, weiterer Verein. 53 Vitest-Tests grün, Typen/Lint/i18n sauber. |
| 2026-09-08 | Code-Review: vier Blocker und vier «Should fix» gefunden und behoben (fehlende Toast-Schlüssel, Weiterleitung beim zweiten Verein, Pflichtfeld Ablaufdatum, doppelter Sentinel, fehlende Fehlerrückmeldung, Teilen-Blatt als Formular). |
| 2026-09-08 | Offen: Schritt 9 (Beispielinhalte, UC-037), Datenbankprüfung, Gerätetest. UC-001 bleibt deshalb «In Progress».                   |
| 2026-09-08 | Migrationen 0008 und 0009 auf das verknüpfte Projekt angewendet und geprüft: Funktionsrechte (`award_points`, `seed_point_rules` und die Vorlagen-Helfer sind für `anon` und `authenticated` gesperrt, die alten Signaturen sind weg), Saisonmonate und Terminlabels je Vereinsart stimmen mit `clubKind.ts` überein, `preview_invite()` liefert für gültig / abgelaufen / ausgeschöpft / zurückgezogen / unbekannt die richtigen Gründe, `redeem_invite()` weist eine abgelaufene Einladung ab und stuft eine bestehende Rolle nicht herab (BR-008). Testdaten wieder entfernt, Datenbank im Ausgangszustand. |
| 2026-09-08 | `types:generate` gegen das Projekt gelaufen; die Übergangs-Überlagerung in `database.types.ts` ist wieder entfernt (NFR-036). Migrationsverlauf auf 0008/0009 abgeglichen. |
| 2026-09-08 | Offen bleiben Schritt 9 (Beispielinhalte, UC-037) und der Gerätetest. Status deshalb weiterhin «In Progress». |

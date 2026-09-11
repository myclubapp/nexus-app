# Implementation Plan: UC-003 — Einladung erstellen

|                   |                                                                     |
| ----------------- | ------------------------------------------------------------------- |
| **Primary Actor** | Vorstand                                                             |
| **Goal**          | Einen Einladungslink mit Geltungsbereich, Rolle und Ablauf erzeugen und verteilen |
| **Plan created**  | 2026-09-08                                                           |
| **Status**        | Done                                                          |

## Overview

Der Vorstand erzeugt einen Einladungslink: Geltungsbereich (ganzer Verein oder
ein Team), Rolle, Ablaufdatum und Höchstzahl Einlösungen. Das Formular ist so
vorbelegt, dass ein einziger Tap genügt. Ergebnis sind ein Link und ein
QR-Code zum Teilen. Eine bestehende Einladung lässt sich zurückziehen, ohne
dass bereits erteilte Mitgliedschaften davon berührt werden.

## Related Use Cases

- UC-002 Per Einladung beitreten — löst den hier erzeugten Link ein
- UC-001 Verein gründen — «Mitglieder einladen» ist eines der drei Startangebote
- UC-007 Mitglieder und Teams verwalten — die Teams für den Geltungsbereich

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel               | User Story (Kurz)                                          | Status  | Notizen                                                    |
| ------ | ------------------- | ---------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| FR-007 | Einladung erstellen | Links und QR-Codes mit Geltungsbereich, Rolle und Ablauf   | Implemented | Gegen die Datenbank geprüft                             |
| FR-015 | Team anlegen        | Teams anlegen und benennen                                 | Missing | Der Geltungsbereich listet nur bestehende Teams (UC-007)   |

### Business Rules

| ID     | Regel                                          | Status      | Notizen                                                                       |
| ------ | ---------------------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| BR-009 | Nur der Vorstand lädt ein                       | Implemented | Policy `invites_admin`; das Ausblenden im UI ist nur Bequemlichkeit           |
| BR-010 | Einladungscode ist nicht erratbar               | Implemented | Neuer Standard: 16 Bytes statt 6, also 128 statt 48 Bit                        |
| BR-011 | Einladung überträgt nie mehr als die eigene Rolle | Implemented | Auswahl kennt nur member, trainer, admin – `superadmin` ist nicht einladbar   |
| BR-012 | Widerruf wirkt nur nach vorne                   | Implemented | Spalte `revoked_at` statt einer Löschung                                       |

### Non-Functional Requirements

| ID      | Titel             | Kategorie | Trifft zu | Notizen                                                             |
| ------- | ----------------- | --------- | --------- | ------------------------------------------------------------------- |
| NFR-011 | Mandantentrennung | Security  | Ja        | Einladungen sind nur im eigenen Verein lesbar                       |
| NFR-013 | Funktionsrechte   | Security  | Ja        | Keine neue `security definer`-Funktion für das Erstellen nötig      |
| NFR-028 | Sprachparität     | Usability | Ja        | Rollennamen, Zustände und die beiden Toasts                         |
| NFR-027 | Barrierefreiheit  | Usability | Ja        | Der QR-Code trägt eine Textbeschreibung                             |

---

## Current State

- `supabase/migrations/0009_invites.sql`: Spalte `revoked_at`, längerer
  Standardcode, Index auf `(club_id, created_at)`.
- `supabase/migrations/0006_rls.sql`: Policy `invites_admin` bestand bereits und
  trägt BR-009 – Einladungen sind für Mitglieder nicht einmal auflistbar.
- `app/src/hooks/useInvites.ts`: Liste, Erstellen, Widerrufen, Teams; dazu die
  reine Logik `isInviteActive()` und `defaultInviteExpiry()`.
- `app/src/pages/club/InvitePage.tsx`: Liste mit Zustand, Erfassungsblatt mit
  Vorbelegung, ausdrückliche Bestätigung für die Rolle Vorstand, Teilen-Blatt
  mit QR-Code, Widerruf über `IonItemSliding`.
- `app/src/components/QrCode.tsx`: QR-Code als Data-URL, ohne fremden Dienst.
- `app/src/pages/TabsPage.tsx`, `ProfilePage.tsx`: Route und Einstieg.

---

## Missing Pieces

| #   | Was fehlt                                                                    | Anforderung | Quelle          |
| --- | ---------------------------------------------------------------------------- | ----------- | --------------- |
| ~~1~~ | ~~Prüfung gegen eine laufende Datenbank~~ – am 2026-09-08 erledigt        | FR-007      | Automated       |
| 2   | Ein Team direkt aus dem Einladungsformular anlegen                            | FR-015      | Cross-reference |
| 3   | Vitest für `InvitePage` selbst (heute nur die reine Logik der Hooks)          | FR-007      | Automated       |

---

## Implementation Guidelines

- **UI-Komponenten:** `AppPage` (mit `createActions` für das Pluszeichen unten rechts),
  `ListSection`, `FormModal` fürs Erfassen, `IonModal` fürs Teilen-Blatt (dort
  wird nichts erfasst), `IonItemSliding` für den Widerruf, `SkeletonList`,
  `useToast()` für die Rückmeldung. Neu nur `QrCode` – es gab kein Bauteil dafür.
- **Styling:** `.app-qr` in `src/theme/variables.css`; keine Inline-Styles.
- **Struktur:** Seite unter `src/pages/club/`, Datenzugriff in `useInvites.ts`.

---

## Implementation Tasks

- [x] 1. Migration `0009_invites.sql`: `revoked_at`, längerer Standardcode, Index.
- [x] 2. `useInvites.ts`: `useInvites`, `useTeams`, `useCreateInvite`,
      `useRevokeInvite` plus `isInviteActive()` und `defaultInviteExpiry()`.
- [x] 3. `QrCode`-Komponente mit nachgeladener Bibliothek.
- [x] 4. `InvitePage`: Liste, Erfassungsblatt mit Vorbelegung, Teilen, Widerruf.
- [x] 5. Ausdrückliche Bestätigung für die Rolle Vorstand (A2), die beim
      Rollenwechsel zurückfällt.
- [x] 6. Teilen über `@capacitor/share`, im Browser Rückfall auf Kopieren.
- [x] 7. Route `/tabs/profile/invite` und Einstieg im Profil.
- [x] 8. **i18n-Vollständigkeit** — vier Sprachen, `i18n:check` grün.
- [x] 9. **Wiring und Fehlerrückmeldung** — Toast oben bei Erfolg und Fehler,
      Feldfehler im Formular.
- [x] 10. Vitest für `isInviteActive()` und `defaultInviteExpiry()`.
- [x] 11. Manueller Testplan `docs/test-plans/uc-003-einladung-erstellen.md`.
- [x] 12. **Migrationen gegen eine laufende Datenbank prüfen**, insbesondere die
      Policy `invites_admin` gegen ein Mitgliedskonto (Testplan TC-008).
- [ ] 13. **Plattform-Parität** — Teilen-Dialog auf iOS und Android, Wischgeste
      mit Maus im Desktop-Browser.
- [x] 14. **Statusabgleich** — FR-007 auf `Implemented`, Use-Case-Status gesetzt.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                          | Impact | Owner       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| ~~1~~ | ~~Migration 0009 nie ausgeführt.~~ Erledigt: am 2026-09-08 angewendet und geprüft, inklusive der Funktionsrechte. | — | Dev |
| 2   | **Spec-Lücke:** «unbegrenzte Einlösungen» hat in der Spezifikation keine Zahl, `invites.max_uses` ist aber `not null`. Angenommen: 1 000 000 steht für «ohne Grenze», festgehalten in `INVITE_UNLIMITED_USES`. | Low | Stakeholder |
| 3   | BR-011 ist heute strukturell erfüllt, weil nur Vorstände einladen und `superadmin` nicht wählbar ist. Käme eine Rolle zwischen admin und superadmin dazu, bräuchte es eine Prüfung in der Datenbank.      | Medium | Architect   |
| 4   | Ein Team lässt sich nicht aus dem Formular heraus anlegen; ohne Teams bietet der Geltungsbereich nur «Ganzer Verein». Gehört zu UC-007.                                                                  | Low    | Dev         |

---

## Progress Log

| Datum      | Update                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| 2026-09-08 | Plan erstellt; Umsetzung zusammen mit UC-001 und UC-002 abgeschlossen, ausser Datenbankprüfung |
| 2026-09-08 | Migrationen 0008 und 0009 auf das verknüpfte Projekt angewendet und geprüft: Funktionsrechte (`award_points`, `seed_point_rules` und die Vorlagen-Helfer sind für `anon` und `authenticated` gesperrt, die alten Signaturen sind weg), Saisonmonate und Terminlabels je Vereinsart stimmen mit `clubKind.ts` überein, `preview_invite()` liefert für gültig / abgelaufen / ausgeschöpft / zurückgezogen / unbekannt die richtigen Gründe, `redeem_invite()` weist eine abgelaufene Einladung ab und stuft eine bestehende Rolle nicht herab (BR-008). Testdaten wieder entfernt, Datenbank im Ausgangszustand. |
| 2026-09-08 | `types:generate` gegen das Projekt gelaufen; die Übergangs-Überlagerung in `database.types.ts` ist wieder entfernt (NFR-036). Migrationsverlauf auf 0008/0009 abgeglichen. |
| 2026-09-08 | Aufgabe 12 erledigt. Use Case auf «Implemented» gesetzt; offen bleibt nur der Gerätetest des Teilen-Dialogs (Aufgabe 13). |

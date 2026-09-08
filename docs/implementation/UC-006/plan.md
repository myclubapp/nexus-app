# Implementation Plan: UC-006 — Konto löschen

|                   |                                                              |
| ----------------- | ------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                      |
| **Goal**          | Das eigene Konto und die personenbezogenen Daten dauerhaft entfernen |
| **Plan created**  | 2026-09-08                                                    |
| **Status**        | Done                                                          |

## Overview

Die Kontolöschung muss aus der App heraus erreichbar sein – eine Auflage
beider App-Stores (C-023, BR-020). Sie entfernt alles Personenbezogene und
löscht das Anmeldekonto, behält aber die Punktebuchungen als anonyme
Vereinsdaten (BR-021): Sonst kippten Ranglisten vergangener Saisons
rückwirkend. Ein Verein darf dabei nie ohne Vorstand zurückbleiben (BR-023).

## Related Use Cases

- UC-005 Anmelden — die Sitzung, die hier endet
- UC-007 Mitglieder und Teams verwalten — dort wird der zweite Vorstand bestimmt,
  ohne den A1 die Löschung blockiert
- UC-022 Leaderboard einsehen — profitiert davon, dass die Buchungen bleiben

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel         | User Story (Kurz)                        | Status      | Notizen                                             |
| ------ | ------------- | ---------------------------------------- | ----------- | --------------------------------------------------- |
| FR-012 | Konto löschen | Konto in der App löschen (Store-Pflicht) | Implemented | `delete_my_account()`, gegen die Datenbank geprüft  |

### Business Rules

| ID     | Regel                              | Status      | Notizen                                                                       |
| ------ | ---------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| BR-020 | Löschung ist in der App erreichbar  | Implemented | Eintrag im Profil, ohne Umweg über Support oder Website                       |
| BR-021 | Statistik ohne Person               | Implemented | Nachgemessen: Buchung überlebt, `user_id` wird null, Name anonymisiert        |
| BR-022 | Private Inhalte werden gelöscht     | Implemented | Benachrichtigungen und Push-Registrierungen werden gelöscht, nicht anonymisiert |
| BR-023 | Vereinskontinuität                  | Implemented | `clubs_left_without_admin()` blockiert die Löschung; nachgemessen             |

### Non-Functional Requirements

| ID      | Titel                 | Kategorie  | Trifft zu | Notizen                                                            |
| ------- | --------------------- | ---------- | --------- | ------------------------------------------------------------------ |
| NFR-013 | Funktionsrechte       | Security   | Ja        | Die Fassung mit Parameter bleibt intern, damit sie keine fremden Konten ausleuchtet |
| NFR-011 | Mandantentrennung     | Security   | Ja        | Die Löschung wirkt nur auf das eigene Konto                        |
| NFR-022 | Keine Verhaltensdaten | Security   | Ja        | Es bleibt kein Protokoll der gelöschten Person                      |
| NFR-028 | Sprachparität         | Usability  | Ja        | Auch das Bestätigungswort ist je Sprache eigen                     |
| C-023   | Kontolöschung         | Regulatory | Ja        | Der Kern dieses Use Case                                            |

---

## Current State

- `supabase/migrations/0011_account_deletion.sql`:
  `clubs_left_without_admin()` (intern), `my_clubs_left_without_admin()` für
  die aufrufende Person, `delete_my_account()`.
- `app/src/hooks/useAccount.ts`: `useAdminBlockers()`, `useDeleteAccount()`.
- `app/src/components/DeleteAccountModal.tsx`: Erklärung, Sperre für den
  einzigen Vorstand, Bestätigung durch ein getipptes Wort. Der Inhalt liegt als
  `DeleteAccountContent` daneben, weil `IonModal` im Test nichts rendert.
- `app/src/pages/ProfilePage.tsx`: der Einstieg.

---

## Missing Pieces

| #   | Was fehlt                                                                                   | Anforderung | Quelle          |
| --- | ------------------------------------------------------------------------------------------- | ----------- | --------------- |
| ~~1~~ | ~~Es gab keinen Weg, das Konto zu löschen~~ – erledigt                                     | FR-012      | Automated       |
| 2   | Sprachmemos und Check-in-Antworten aus Schritt 4 gibt es noch nicht – die Tabellen entstehen mit UC-029 und UC-032; die Löschung muss dann mitwachsen | FR-012 | Cross-reference |

---

## Implementation Guidelines

- **UI-Komponenten:** `IonModal` mit eigenem Kopf statt `FormModal` – der
  bestätigende Knopf ist zerstörerisch und gehört nicht dorthin, wo sonst
  «Speichern» steht. `ListSection`, `InlineError`, `IonInput` für die
  Bestätigung. Kein neues Bauteil.
- **Styling:** nur Klassen aus `src/theme/variables.css`.
- **Struktur:** Blatt unter `src/components/`, Datenzugriff in
  `src/hooks/useAccount.ts`.

---

## Implementation Tasks

- [x] 1. Migration `0011_account_deletion.sql` mit den drei Funktionen und
      ihren Grants.
- [x] 2. Reihenfolge in `delete_my_account()`: erst `club_members.user_id` auf
      null, dann `auth.users` löschen. Ohne das nimmt der Cascade die
      Mitgliedschaft **und** die daran hängenden Punktebuchungen mit (BR-021).
- [x] 3. `useAccount.ts`: Sperren abfragen, Konto löschen, danach abmelden.
- [x] 4. `DeleteAccountContent`: Erklärung, was gelöscht wird und was bleibt.
- [x] 5. Sperre für den einzigen Vorstand mit Nennung der betroffenen Vereine (A1).
- [x] 6. Bestätigung durch ein getipptes Wort statt eines Taps (Schritt 3).
- [x] 7. Einstieg im Profil (C-023).
- [x] 8. **i18n-Vollständigkeit** — alle Texte in vier Sprachen, inklusive des
      Bestätigungsworts.
- [x] 9. **Verdrahtung und Fehlerrückmeldung** — der Fehlschlag steht im Blatt.
- [x] 10. Vitest für `DeleteAccountContent`.
- [x] 11. **Migration gegen die Datenbank prüfen**, insbesondere BR-021 und A1.
- [x] 12. Manueller Testplan `docs/test-plans/uc-006-konto-loeschen.md`.
- [x] 13. **Statusabgleich** — FR-012 und C-023 auf `Implemented`,
      Use-Case-Status gesetzt.
- [ ] 14. **Plattform-Parität** — Löschweg auf iOS und Android prüfen; die
      Store-Prüfung schaut genau hierauf.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                              | Impact | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | Schritt 4 nennt private Sprachmemos und Check-in-Antworten. Die Tabellen dafür entstehen erst mit UC-029 und UC-032. **Die Löschfunktion muss dann erweitert werden** – sonst bleiben genau die Inhalte liegen, die BR-022 vollständig löschen will. | High | Dev |
| 2   | **Spec-Lücke:** Die Spezifikation nennt keine Form der Bestätigung. Angenommen: ein getipptes Wort statt eines Häkchens, weil Schritt 3 eine **ausdrückliche** Bestätigung verlangt und ein Tap daneben keine ist. Das Wort ist je Sprache eigen. | Low | Stakeholder |
| 3   | A3 (offene anonyme Anliegen bleiben bestehen) ist strukturell erfüllt: Es gibt keine Spalte, die die Autorschaft aufnehmen könnte (NFR-019). Prüfbar wird das erst mit UC-030.                                | Low    | Dev         |
| 4   | Die Mitgliedschaft bleibt als anonyme Hülle bestehen. Ein Verein sieht dort «Ehemaliges Mitglied» mit Status `left` – gewollt, aber der Mitgliederliste (UC-007) muss das bewusst sein.                       | Medium | Dev         |

---

## Progress Log

| Datum      | Update                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-08 | Plan erstellt und umgesetzt: Migration 0011, `useAccount.ts`, `DeleteAccountModal`, Einstieg im Profil.                                     |
| 2026-09-08 | Gegen die Datenbank geprüft mit einem Wegwerf-Verein: Der einzige Vorstand wird blockiert (A1); nach der Löschung ist das Anmeldekonto weg, die Punktebuchung besteht weiter, der Anzeigename ist «Ehemaliges Mitglied», `user_id` ist null, der Status `left` und die Rangliste abgewählt; Benachrichtigungen sind gelöscht. Testdaten entfernt. |
| 2026-09-08 | Beim Testen gemessen: **`IonModal` rendert seinen Inhalt in jsdom gar nicht.** Daraus die Entwurfsregel, den Inhalt eines Blattes als eigene Komponente zu führen (`DeleteAccountContent`); in `docs/TESTING.md` und `docs/guidelines.md` festgehalten. |

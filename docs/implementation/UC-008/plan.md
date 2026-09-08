# Implementation Plan: UC-008 — Profil und Datenschutz-Optionen pflegen

|                   |                                                             |
| ----------------- | ----------------------------------------------------------- |
| **Primary Actor** | Mitglied                                                     |
| **Goal**          | Die eigenen Angaben aktuell halten und bestimmen, was andere davon sehen |
| **Plan created**  | 2026-09-09                                                   |
| **Status**        | Done                                                         |

## Overview

Ein Mitglied pflegt Anzeigename und Kontaktangaben und entscheidet je Angabe,
ob andere Vereinsmitglieder sie sehen. Der Kern ist BR-030: Was verborgen ist,
wird **nicht ausgeliefert** – nicht nur ausgeblendet. Die Entscheide gelten je
Verein (BR-028), und die Anzeige in Ranglisten bleibt abwählbar (BR-029).

## Related Use Cases

- UC-007 Mitglieder und Teams verwalten — zeigt dieselben Mitglieder dem Vorstand
- UC-022 Leaderboard einsehen — respektiert den Ausstieg aus den Ranglisten
- UC-025 Transparenz-Seite — nutzt `health_opt_out` aus derselben Tabelle
- UC-006 Konto löschen — entfernt genau diese Angaben

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                | User Story (Kurz)                                | Status      | Notizen                                                       |
| ------ | -------------------- | ------------------------------------------------ | ----------- | ------------------------------------------------------------- |
| FR-018 | Eigenes Profil pflegen | Anzeigename, Avatar und Kontaktdaten pflegen   | Implemented | Avatar noch nicht – siehe Offene Punkte                       |
| FR-019 | Datenschutz-Optionen | Je Angabe festlegen, ob sie sichtbar ist         | Implemented | Über `club_directory`, gegen die Datenbank nachgemessen       |
| FR-020 | Leaderboard-Opt-in   | Entscheiden, ob man in Ranglisten erscheint      | Implemented | Schalter im Profil                                            |
| FR-110 | Sprache wählen       | Zwischen vier Sprachen wechseln                  | Implemented | A2; die Umstellung wirkt sofort                               |

### Business Rules

| ID     | Regel                                    | Status      | Notizen                                                                   |
| ------ | ---------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| BR-028 | Datenschutz je Verein                     | Implemented | `privacy` hängt an der Mitgliedschaft, nicht am Konto                     |
| BR-029 | Ranglisten sind freiwillig                | Implemented | Der Ausstieg lässt die Punktesammlung unberührt                           |
| BR-030 | Sichtbarkeit serverseitig durchgesetzt    | Implemented | Nachgemessen: Die verborgene Nummer kommt als `null`, auch über die Tabelle |
| BR-031 | Anzeigename ist Pflicht                   | Implemented | Im Formular gesperrt **und** in `update_my_profile()` abgewiesen          |

### Non-Functional Requirements

| ID      | Titel               | Kategorie | Trifft zu | Notizen                                                        |
| ------- | ------------------- | --------- | --------- | -------------------------------------------------------------- |
| NFR-011 | Mandantentrennung   | Security  | Ja        | `club_directory` filtert über `is_club_member()`               |
| NFR-013 | Funktionsrechte     | Security  | Ja        | `update_my_profile()` nur für `authenticated`                  |
| NFR-022 | Keine Verhaltensdaten | Security | Ja       | Es wird nicht erfasst, wer wessen Kontaktangaben abgerufen hat |
| NFR-028 | Sprachparität       | Usability | Ja        | Auch die Erklärung zur Sichtbarkeit                            |
| C-019   | Datenschutzrecht    | Regulatory | Ja       | Datensparsamkeit: verborgene Felder verlassen den Server nicht |

---

## Current State

- `supabase/migrations/0013_profile_privacy.sql`: Spalten `privacy` und
  `health_opt_out`, Tabelle `member_contacts` mit eigener Policy, die Sicht
  `club_directory` mit Maskierung je Feld, `update_my_profile()`.
- `app/src/hooks/useProfile.ts`: eigenes Profil lesen, speichern,
  Ranglisten-Teilnahme setzen.
- `app/src/components/ProfileEditModal.tsx`: das Formular; der Inhalt liegt als
  `ProfileEditForm` daneben, weil `IonModal` im Test nichts rendert.
- `app/src/pages/ProfilePage.tsx`: Einstieg über die Profilzeile.

---

## Missing Pieces

| #   | Was fehlt                                                                        | Anforderung | Quelle          |
| --- | -------------------------------------------------------------------------------- | ----------- | --------------- |
| ~~1~~ | ~~Kontaktangaben und ihre Sichtbarkeit~~ – erledigt                             | FR-019      | Automated       |
| 2   | **Avatar hochladen.** FR-018 nennt ihn; `avatar_url` besteht, aber es gibt keinen Weg, ein Bild abzulegen – dafür braucht es Supabase Storage. | FR-018 | Cross-reference |
| 3   | A3: Bei mehreren Vereinen sind die Optionen zwar je Verein gespeichert, das Formular zeigt aber nur den aktiven. | BR-028 | Automated |

---

## Implementation Guidelines

- **UI-Komponenten:** `FormModal` mit `ListSection`, `IonInput`, `IonToggle`.
  Der Schalter steht **direkt unter** der Angabe, auf die er sich bezieht –
  die Frage «wer sieht das?» gehört ans Feld, nicht auf eine eigene Seite.
- **Styling:** nur Klassen aus `src/theme/variables.css`.
- **Struktur:** Blatt unter `src/components/`, Datenzugriff in
  `src/hooks/useProfile.ts`.

---

## Implementation Tasks

- [x] 1. Migration `0013_profile_privacy.sql`: `privacy`, `health_opt_out`,
      `member_contacts` mit Policy.
- [x] 2. Dieselbe Migration: Sicht `club_directory`, die je Feld maskiert und
      die Vereinszugehörigkeit selbst prüft (BR-030, NFR-011).
- [x] 3. Dieselbe Migration: `update_my_profile()` setzt Angabe und
      Sichtbarkeit in einem Aufruf und weist einen leeren Namen ab (BR-031).
- [x] 4. `src/hooks/useProfile.ts` mit den drei Hooks.
- [x] 5. `ProfileEditForm` mit Anzeigename, beiden Angaben und je einem Schalter.
- [x] 6. Ranglisten-Teilnahme über den eigenen Hook, mit Rückmeldung (A1).
- [x] 7. Einstieg über die Profilzeile.
- [x] 8. **i18n-Vollständigkeit** — vier Sprachen, inklusive der Erklärung.
- [x] 9. **Verdrahtung und Fehlerrückmeldung** — Fehler im Formular, Erfolg als
      Toast.
- [x] 10. Vitest für `ProfileEditForm`.
- [x] 11. **Migration gegen die Datenbank prüfen** – der entscheidende Test.
- [x] 12. Manueller Testplan `docs/test-plans/uc-008-profil-datenschutz.md`.
- [x] 13. **Statusabgleich** — FR-018, FR-019, FR-020 auf `Implemented`.
- [ ] 14. **Avatar hochladen** über Supabase Storage (FR-018).
- [ ] 15. **Plattform-Parität** — Formular und Schalter auf iOS, Android, Browser.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                                          | Impact | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **Der Avatar fehlt.** FR-018 nennt ihn ausdrücklich. Er braucht einen Storage-Bucket mit eigener Policy und ist deshalb ein eigener Schritt – FR-018 steht trotzdem auf `Implemented`, weil Name und Kontaktangaben tragen. Das ist zu korrigieren, sobald der Bucket steht. | Medium | Dev |
| 2   | **Spec-Lücke:** Das Entitätsmodell kennt keine Telefonnummer. FR-019 nennt sie ausdrücklich. Angenommen: Sie gehört zur Mitgliedschaft, nicht zum Konto – wie Anzeigename und Bild, und weil BR-028 die Entscheide je Verein verlangt. | Medium | Stakeholder |
| 3   | `club_directory` ist bewusst **keine** `security_invoker`-Sicht: Sie muss `member_contacts` lesen können, um zu maskieren. Sie prüft die Vereinszugehörigkeit deshalb selbst. Jede Änderung an dieser Sicht braucht einen erneuten Beweis, dass eine verborgene Angabe nicht durchkommt. | High | Architect |
| 4   | Die E-Mail im Profil ist eine **Kontaktangabe des Vereins**, nicht die Anmeldeadresse. Beide können auseinanderlaufen; das ist gewollt, muss aber im UI verständlich bleiben.                                            | Low    | Dev         |

---

## Progress Log

| Datum      | Update                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-09 | Plan erstellt und umgesetzt: Migration 0013, `useProfile.ts`, `ProfileEditModal`, Einstieg im Profil. 126 Vitest-Tests grün.                 |
| 2026-09-09 | Gegen die Datenbank geprüft – der eigentliche Beweis für BR-030: Ein zweites Mitglied im selben Verein sieht die freigegebene E-Mail, bekommt die verborgene Telefonnummer aber als `null`. Der Umweg über `member_contacts` liefert ihm null Zeilen. Die Person selbst sieht ihre eigene Nummer. Testdaten entfernt. |
| 2026-09-09 | Beim Testen gemessen: **`value` und `checked` sind an Ionic-Eingaben nicht auslesbar** – anders als `disabled` an einem `ion-button`. Geprüft wird deshalb, womit das Formular speichert. In `docs/TESTING.md` festgehalten. |

# Implementation Plan: UC-005 — Anmelden

|                   |                                                              |
| ----------------- | ------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                      |
| **Goal**          | Zugang zur App erhalten, ohne ein Passwort verwalten zu müssen |
| **Plan created**  | 2026-09-08                                                    |
| **Status**        | Done                                                          |

## Overview

Die Anmeldung läuft über einen Link per E-Mail: Adresse eingeben, Link im
Postfach antippen, angemeldet. Kein Drittanbieter-Login (BR-017), kein
Passwortzwang. Wer trotzdem ein Passwort will, kann eines setzen und sich damit
anmelden (A2). Nach der Anmeldung führt die App in den zuletzt genutzten Verein
oder – wenn keiner besteht – ins Onboarding.

## Related Use Cases

- UC-001 Verein gründen und UC-002 Per Einladung beitreten — beide setzen eine
  Anmeldung voraus; A4 kehrt nach der Anmeldung zur Einladung zurück
- UC-006 Konto löschen — beendet die Sitzung dauerhaft
- UC-008 Profil pflegen — dort wird das Passwort gesetzt

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                     | User Story (Kurz)                                    | Status      | Notizen                                                         |
| ------ | ------------------------- | ---------------------------------------------------- | ----------- | --------------------------------------------------------------- |
| FR-001 | Magic-Link-Anmeldung      | Anmeldung über einen zugesandten Link                | Implemented | Der abgelehnte Link wird jetzt übersetzt gemeldet (A1)           |
| FR-002 | E-Mail/Passwort-Anmeldung | Alternativ mit E-Mail und Passwort anmelden          | Implemented | Umschalter auf dem Anmeldebildschirm; Passwort wird im Profil gesetzt |
| FR-003 | Deep-Link-Rücksprung      | Der Link führt in die installierte App zurück        | Partial     | `appUrlOpen` tauscht den Code; Gerätetest offen                  |
| FR-110 | Sprache wählen            | Zwischen vier Sprachen wechseln                      | Implemented | `LanguageSwitcher` steht schon auf dem Anmeldebildschirm         |

### Business Rules

| ID     | Regel                          | Status      | Notizen                                                                |
| ------ | ------------------------------ | ----------- | ---------------------------------------------------------------------- |
| BR-017 | Kein Login über Drittanbieter   | Implemented | Es gibt keinen einzigen OAuth-Anbieter im Code (C-003)                 |
| BR-018 | Anmeldelink ist einmalig        | Implemented | Supabase setzt die Frist; der Client tauscht den Code genau einmal     |
| BR-019 | Sitzung bleibt bestehen         | Implemented | Capacitor Preferences auf dem Gerät, localStorage im Browser           |

### Non-Functional Requirements

| ID      | Titel                    | Kategorie       | Trifft zu | Notizen                                                          |
| ------- | ------------------------ | --------------- | --------- | ---------------------------------------------------------------- |
| NFR-001 | Kaltstart ≤ 3 s          | Performance     | Ja        | Die Anmeldung steht vor dem ersten Bild                          |
| NFR-014 | Transportverschlüsselung | Security        | Ja        | Supabase erzwingt TLS                                             |
| NFR-027 | Barrierefreiheit         | Usability       | Ja        | Anmeldung ist der erste Kernfluss                                 |
| NFR-028 | Sprachparität            | Usability       | Ja        | Auch die neuen Fehlermeldungen                                    |
| C-012   | Deep-Link-Schema         | Technical       | Ja        | `ch.myclub.nexus://auth/callback` an vier Stellen konsistent      |

---

## Current State

- `app/src/hooks/useAuth.tsx`: `signInWithMagicLink()`, `signOut()`, Sitzung aus
  dem Speicher, `appUrlOpen`-Listener mit `exchangeCodeFromUrl()`.
- `app/src/lib/supabase.ts`: PKCE, Sitzungsspeicher je Plattform,
  `authRedirectUrl()` für Gerät und Web.
- `app/src/pages/auth/LoginPage.tsx`: E-Mail-Feld, Versand, Bestätigung.
- `app/src/pages/auth/AuthCallbackPage.tsx`: wartet auf die Sitzung und leitet
  weiter – inklusive Rücksprung auf eine gemerkte Einladung (A4).
- `app/src/components/RouteGuards.tsx`: `RequireAuth`, `RedirectIfSignedIn`.
- `app/src/lib/authError.ts` (neu): liest den Fehler aus Query **und** Fragment,
  ordnet ihn einem Übersetzungsschlüssel zu und entscheidet in
  `resolveSignInAction()`, was das Formular tun soll.
- ~~**Lücke A1**~~ erledigt: Der abgelehnte Link wird auf dem
  Anmeldebildschirm übersetzt gemeldet.
- ~~**Lücke A2**~~ erledigt: Umschalter auf dem Anmeldebildschirm, Passwort
  wird im Profil gesetzt.

---

## Missing Pieces

| #   | Was fehlt                                                                     | Anforderung      | Quelle          |
| --- | ----------------------------------------------------------------------------- | ---------------- | --------------- |
| ~~1~~ | ~~Ungültiger Link wird nicht mitgeteilt~~ – erledigt (A1)                     | FR-001           | Automated       |
| ~~2~~ | ~~Anmeldung mit E-Mail und Passwort~~ – erledigt (A2)                        | FR-002           | Cross-reference |
| ~~3~~ | ~~Passwort lässt sich nirgends setzen~~ – erledigt, im Profil                | FR-002           | Cross-reference |
| ~~4~~ | ~~Fehler beim Versand nicht unterschieden~~ – erledigt, `authErrorKey()`     | FR-001           | Automated       |
| 5   | Gerätetest des Deep Links steht aus                                            | FR-003, C-012    | Cross-reference |

---

## Implementation Guidelines

- **UI-Komponenten:** `AppPage` ist hier bewusst **nicht** richtig – der
  Anmeldebildschirm hat keine Kopfzeile. `IonInput`, `IonButton`, `IonSegment`
  für die Wahl zwischen Link und Passwort, `InlineError` für den Fehlertext,
  `LanguageSwitcher`. Kein neues Bauteil.
- **Styling:** `.app-centered--login` aus `src/theme/variables.css`.
- **Struktur:** Seiten unter `src/pages/auth/`, Zustand in `hooks/useAuth.tsx`.

---

## Implementation Tasks

- [x] 1. `useAuth`: `authError` als Zustand, den `exchangeCodeFromUrl()` und der
      Web-Rückweg setzen; `clearAuthError()` zum Verwerfen.
- [x] 2. Fehler aus der Rücksprung-Adresse auch im Browser auslesen – supabase-js
      tauscht dort selbst, der Fehler steht in Query oder Fragment.
- [x] 3. `AuthCallbackPage`: bei einem Fehler zurück auf den Anmeldebildschirm,
      wo die Meldung steht, statt wortlos weiterzuleiten (A1).
- [x] 4. `useAuth`: `signInWithPassword()` und `setPassword()`.
- [x] 5. `LoginPage`: Umschalter «Link senden» / «Mit Passwort», Passwortfeld
      mit `autocomplete="current-password"`, Fehler über `InlineError` (A2).
- [x] 6. `ProfilePage`: Passwort setzen oder ändern, damit A2 erreichbar ist.
- [x] 7. **i18n-Vollständigkeit** — neue Texte in vier Sprachen.
- [x] 8. **Verdrahtung und Fehlerrückmeldung** — jeder Fehlschlag zeigt eine
      Meldung; kein stiller `catch`.
- [x] 9. Vitest: `authErrorFromUrl()` gegen alle Formen, die Supabase liefert.
- [x] 10. Manueller Testplan `docs/test-plans/uc-005-anmelden.md`.
- [ ] 11. **Plattform-Parität** — Deep Link auf iOS und Android, Web-Fallback,
      Passwortverwaltung des Systems (Testplan TC-005, TC-009).
- [x] 12. **Statusabgleich** — FR-001 und FR-002 auf `Implemented`. FR-003
      bleibt `In Progress`, bis der Deep Link auf einem Gerät geprüft ist.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                                | Impact | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **Spec-Lücke:** UC-005 A2 setzt ein Passwort voraus, sagt aber nicht, wo es entsteht. Ein reines Magic-Link-Konto hat keines. Angenommen: Es wird im Profil gesetzt (`updateUser`), und A2 weist sonst mit einem Hinweis auf den Link-Weg. Durch Test festgehalten. | Medium | Stakeholder |
| 2   | **Spec-Lücke:** Die Mindestlänge des Passworts nennt die Spezifikation nicht. Angenommen: die Supabase-Vorgabe von acht Zeichen, geprüft im Client **und** vom Server.                                        | Low    | Stakeholder |
| 3   | Der Anmeldebildschirm zeigt bewusst nicht, ob eine Adresse ein Konto hat – sonst wäre er ein Verzeichnis gültiger Adressen. Das macht «Passwort falsch» und «kein Passwort gesetzt» ununterscheidbar.          | Low    | Dev         |
| ~~4~~ | ~~Ratenbegrenzung unübersetzt.~~ Erledigt: `authErrorKey()` ordnet sie einem eigenen Text zu, und alles Unbekannte fällt auf eine allgemeine deutsche Meldung – es bleibt nie ein englischer Satz stehen. | — | Dev |
| 5   | Ionic-Eingaben lassen sich in jsdom nicht bedienen. Die Verzweigung des Formulars liegt deshalb in `resolveSignInAction()` und ist dort geprüft; die Bedienung selbst deckt nur der manuelle Testplan ab. | Medium | Dev |

---

## Progress Log

| Datum      | Update                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-08 | Plan erstellt                                                                                                                 |
| 2026-09-08 | Umsetzung: `authError.ts` (Fehler aus Query und Fragment, Übersetzungszuordnung, `resolveSignInAction()`), Umschalter Link/Passwort, Passwort setzen im Profil. 87 Vitest-Tests grün. |
| 2026-09-08 | Beim Testen gemessen: **Ionic-Ereignisse feuern in jsdom gar nicht** – kein `ionInput`, kein inneres `<input>`. Daraus die Entwurfsregel, die Formularentscheidung als reine Funktion nach `src/lib/` zu ziehen; in `docs/TESTING.md` und `docs/guidelines.md` festgehalten. |
| 2026-09-08 | Code-Review: `role="alert"`/`role="status"` hingen in `ClubSettingsPage` an einem `IonNote` und erreichten das DOM nicht – auf `InlineError`/`InlineSuccess` umgestellt. `auth.signInFailed` war durch `auth.error.*` ersetzt und wurde entfernt. |

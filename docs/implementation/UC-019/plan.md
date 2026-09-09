# Implementation Plan: UC-019 — Aufgabe bestätigen und Kudos geben

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand (Voraussetzung nennt trainer **oder** admin)               |
| **Goal**          | Eine erledigte Aufgabe bestätigen, die Punkte auslösen und den Beitrag persönlich würdigen |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | Done                                                                |

## Overview

Der Moment, in dem aus Arbeit ein Beitrag wird – und der einzige Ort im
Marktplatz, an dem Punkte entstehen (BR-074). Die Spezifikation dreht die
übliche Reihenfolge um: **Kudos vor Punktzahl** (BR-078). Das Dankeswort ist
nicht die Verpackung der Gutschrift, sondern die Nachricht; die Zahl steht
nachgeordnet.

`confirm_task()` besteht seit `0004` und trägt die Lücke, die
`confirm_shift()` bis `0028` hatte: Sie bucht direkt in den Ledger, **ohne die
Punkteregel zu lesen**. Ein Verein kann Säule 7 abschalten oder eine
Häufigkeitsgrenze setzen – bestätigte Aufgaben buchen weiter. BR-065 verlangt
das Gegenteil: Grenzen gelten in der Buchungsfunktion. Diese Lücke ist seit
UC-013 vorgemerkt und wird hier geschlossen.

Dazu zwei weitere Stellen, an denen die bestehende Fassung der Spezifikation
widerspricht: Sie lässt **die übernehmende Person sich selbst bestätigen**
(BR-080), und sie setzt die Aufgabe auf erledigt, sobald **eine** von mehreren
Übernahmen bestätigt ist.

## Related Use Cases

- UC-018 Aufgabe einreichen — liefert, was hier entgegengenommen wird
- UC-013 Helfer-Schicht bestätigen — dieselbe Prüfung, in `0028` schon gelöst
- UC-016 Punkteregeln — liefert Aktiv-Flag und Häufigkeitsgrenze
- UC-020 Punktestand — dort erscheint, was hier gebucht wird

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                | Status vorher | Ziel        | Notizen                                                     |
| ------ | -------------------- | ------------- | ----------- | ----------------------------------------------------------- |
| FR-054 | Aufgabe bestätigen   | In Progress   | Implemented | Ansicht, Rollenprüfung, Regelprüfung                        |
| FR-055 | Kudos zur Bestätigung | Open         | Implemented | Das Dankeswort steht in der Nachricht **vor** der Zahl       |

### Business Rules

| ID     | Regel                            | Status vorher | Ziel        | Notizen                                                  |
| ------ | -------------------------------- | ------------- | ----------- | -------------------------------------------------------- |
| BR-077 | Aufgaben buchen ihren eigenen Wert | Implemented | Implemented | `v_task.points`, nicht der Regelwert                      |
| BR-078 | Kudos vor Punktzahl              | Missing       | Implemented | Titel der Nachricht ist der Dank, die Zahl steht im Text  |
| BR-079 | Keine Doppelbuchung              | Partial       | Implemented | Dedupe-Index über `(member_id, rule_code, source_id)`; A4 |
| BR-080 | Nur Verantwortliche bestätigen   | **Missing**   | Implemented | Wer selbst übernommen hat, bestätigt nicht sich selbst    |
| BR-065 | Häufigkeitsgrenzen serverseitig  | **Missing**   | Implemented | Die vorgemerkte Lücke aus UC-013                          |

### Non-Functional Requirements

| ID      | Titel                     | Kategorie   | Betroffen | Notizen                                                  |
| ------- | ------------------------- | ----------- | --------- | -------------------------------------------------------- |
| NFR-009 | Zustellung ohne Push      | Reliability | Ja        | Dank und Gutschrift gehen in die Inbox                    |
| C-011   | Regeln in der Datenbank   | Design      | Ja        | Rolle, Regel und Grenze prüft die Buchungsfunktion        |
| NFR-022 | Kein Personenbezug in Kennzahlen | Privacy | Ja      | Kudos steht auf dem eigenen Profil, nicht in einer Liste  |

---

## Current State

- `supabase/migrations/0004_tasks_news.sql`: `confirm_task(p_assignment_id, p_kudos)`
  — deckt Schritt 6 in erster Fassung ab, ohne Regelprüfung, ohne BR-080, und
  setzt die Aufgabe zu früh auf erledigt.
- `supabase/migrations/0035_task_submission.sql`: Schritt 1 – die Meldung an die
  verantwortliche Person steht.
- `app/src/components/TaskDetailModal.tsx`: die Ansicht des Mitglieds; die
  Seite des Vorstands fehlt vollständig.

Schritte 2 bis 8 sowie A1 bis A4 sind nicht abgedeckt.

---

## Missing Pieces

| #   | Was fehlt                                                                | Anforderung     | Quelle          |
| --- | ------------------------------------------------------------------------ | --------------- | --------------- |
| 1   | Keine Ansicht der Einreichung: wer, wann, mit welchem Nachweis            | Schritt 2–3     | Automated       |
| 2   | Kein Feld für das Dankeswort und kein Hinweis, dass es mehr wirkt als die Zahl | FR-055, A2 | Cross-reference |
| 3   | `confirm_task()` liest die Punkteregel nicht                             | BR-065          | Cross-reference |
| 4   | `confirm_task()` lässt die übernehmende Person sich selbst bestätigen    | BR-080          | Cross-reference |
| 5   | Die Aufgabe gilt als erledigt, sobald **eine** Übernahme bestätigt ist   | A2 aus UC-018   | Automated       |
| 6   | Kein «Zurück an die Person»                                              | A1              | Cross-reference |
| 7   | Das Kudos steht nirgends – die Spalte wird geschrieben und nie gelesen   | Schritt 8, FR-055 | Automated     |
| 8   | Nur `admin` darf bestätigen, die Voraussetzung nennt auch `trainer`      | Precondition    | Automated       |

---

## Implementation Guidelines

- **Bauteile:** `FormModal` (Bestätigungs-Blatt), `ListSection`, `AppPage` und
  `ListSection` auf der Profilseite für die Kudos, `useToast()`. Neu entsteht
  genau **eine** Komponente: `TaskConfirmModal`, nach dem Vorbild von
  `ShiftRosterModal`.
- **Stil:** keine Inline-Styles; Zustände über `IonBadge`/`IonNote`.
- **Struktur:** Logik nach `app/src/lib/task.ts`, Datenzugriff in
  `app/src/hooks/useTasks.ts`, Migration `0036_task_confirmation.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0036_task_confirmation.sql`: `confirm_task()` neu
      (Regelprüfung, BR-080, A2-Status, Kudos-Nachricht), `reject_task()`,
      `task_roster()`
- [x] 2. `lib/task.ts`: `kudosReminder()` – A2, einmaliger Hinweis
- [x] 3. `hooks/useTasks.ts`: `useTaskRoster`, `useConfirmTask`, `useRejectTask`,
      `useMyKudos`
- [x] 4. `components/TaskConfirmModal.tsx` – Schritte 2–5, A1, A2
- [x] 5. `MarketplacePage`: Einstieg für Trainer:innen und den Vorstand
- [x] 6. `ProfilePage`: die erhaltenen Kudos (Schritt 8)
- [x] 7. Vier Sprachen, `npm run i18n:check`
- [x] 8. Verhaltensprüfung gegen die laufende Datenbank
- [x] 9. `ai-code-review` und Behebung der Befunde
- [x] 10. Vitest
- [x] 11. Manueller Testplan `docs/test-plans/uc-019-aufgabe-bestaetigen.md`
- [x] 12. Statusabgleich in `requirements.md`, `UC-019`, `use_cases/README.md`

---

## Umsetzung

- `supabase/migrations/0036_task_confirmation.sql`
  - `confirm_task()` neu geschrieben. Der Rückgabetyp wechselt von `int` auf
    `table (points, booked)`; `create or replace` kann das nicht, also erst
    `drop function`.
  - **BR-065 geschlossen** – die seit UC-013 vorgemerkte Lücke: Die Funktion
    liest jetzt `point_rules`, prüft `is_active` und `rule_limit_reached()`.
    Gebucht wird trotzdem der Wert **der Aufgabe** (BR-077); die Regel liefert
    die Säule und die Grenze, nicht die Zahl.
  - **BR-080** – wer selbst übernommen hat, bestätigt sich nicht selbst.
  - **A2 aus UC-018** – erledigt ist die Aufgabe erst, wenn sie voll ist
    **und** alle Übernahmen bestätigt sind. Vorher verlor die zweite Person
    ihre Aufgabe, weil die erste bestätigt wurde.
  - **BR-078** – der Dank ist der **Titel** der Nachricht, die Zahl steht
    nachgeordnet im Text. Ohne Gutschrift steht dort gar keine Zahl: Eine Null
    wäre eine Aussage über den Beitrag, die niemand gemeint hat.
  - `reject_task()` für A1, mit Pflicht-Hinweis; `task_roster()` für Schritt 3.
- `app/src/components/TaskConfirmModal.tsx`, `hooks/useTasks.ts`,
  `pages/MarketplacePage.tsx`, `pages/ProfilePage.tsx` (Schritt 8).

---

## Verhaltensprüfung gegen die laufende Datenbank

34 Prüfungen in einer Transaktion, die sich zum Schluss selbst zurückrollt,
plus eine gezielte Nachprüfung der Nachbesserungs-Nachricht.

| #     | Prüfung                                                    | Ergebnis                     |
| ----- | ---------------------------------------------------------- | ---------------------------- |
| 1     | Die übernehmende Person bestätigt sich selbst               | abgewiesen (BR-080)          |
| 2     | Mitglied ohne Rolle bestätigt                               | abgewiesen                   |
| 3     | `confirm_task` bucht **50** – den Wert der Aufgabe, nicht die 20 der Regel | BR-077 hält |
| 4–7   | Status `done`, `confirmed_by` gesetzt und ≠ `member_id`, Kudos getrimmt gespeichert, 50 im Ledger | |
| 8–9   | Nachrichten-Titel ist das Dankeswort, der Text nennt Aufgabe **und dann** die Zahl | BR-078 hält |
| 10–12 | Zweite Bestätigung: `0 / false`, **eine** Buchung, Kudos unverändert | BR-079, A4        |
| 13–15 | Nur-Dank-Aufgabe (0 Punkte): bestätigt, **keine** Buchung, Nachricht ohne Zahl | A3      |
| 16–18 | **Regel inaktiv**: bestätigt, **keine** Buchung, Aufgabe trotzdem erledigt | **BR-065**    |
| 19–20 | **Häufigkeitsgrenze erreicht**: bestätigt, **keine** Buchung | **BR-065**                  |
| 21–23 | Zwei Übernehmende: nach einer Bestätigung `submitted`, nach beiden `done`, je Person eine Buchung | A2 |
| 24–25 | Nachbesserung nach Bestätigung / ohne Hinweis               | beide abgewiesen             |
| 26–29 | A1: `submitted_at` zurückgesetzt, Status `claimed`, Hinweis zugestellt, Übernahme bleibt bestehen | |
| 30–32 | `task_roster` als Vorstand 2 Zeilen mit Namen, als Mitglied abgewiesen | Schritt 3          |
| 33–34 | `confirm_task` für `anon` / `reject_task` für `authenticated` | nein / ja                  |

Nachgeprüft: Der Hinweis aus A1 kommt als **eigene** Nachricht an, getrimmt,
mit dem Aufgabentitel als Überschrift.

---

## Befunde des Code-Reviews (`ai-code-review`)

| #  | Befund                                                                                                                                  | Schwere | Erledigt in |
| -- | --------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| 1  | **Dankeswort und Mängelhinweis teilten sich denselben Zustand.** Wer zwischen den beiden Wegen wechselte, machte aus seinem Dank einen Mängelhinweis – und umgekehrt. | **Hoch** | `TaskConfirmModal` (eigener Zustand je Weg) |
| 2  | **BR-080 stand nur auf dem Server.** Eine Trainer:in, die selbst übernommen hatte, sah ihre eigene Meldung in der Bestätigungsliste – mit einem Knopf, der jedes Mal eine Fehlermeldung ergeben hätte. Jetzt fällt die eigene Übernahme aus der Liste, und das Blatt sagt auch warum. | Mittel | `TaskConfirmModal`, `MarketplacePage` |
| 3  | `disabled={isBusy \|\| openId === … ? false : false}` – durch die Vorrangregeln immer `false`. Ein Ausdruck, der aussieht wie eine Bedingung und keine ist. | Niedrig | `TaskConfirmModal` |
| 4  | `task_roster()` sortierte nur nach `claimed_at`. Zwei Übernahmen desselben Augenblicks hatten damit keine feste Reihenfolge, und die Liste sprang bei jedem Aufruf. | Niedrig | 0036 (`display_name`, `id` als zweites Merkmal) |

Bestätigt hat der Review: Der Nachweis wird als **Text** gezeigt und nicht als
Verweis – ein Link aus fremder Hand gehört nicht ungeprüft in einen Klick; ein
eigener Test hält das fest. Die Punktzahl steht in der ganzen Ansicht
nirgends als Überschrift (BR-078), auch das mit einem Test festgehalten.

---

## Tests

- `app/src/lib/task.test.ts` – 39 Tests (zwei neu für `needsKudosReminder()`).
- `app/src/components/TaskConfirmModal.test.tsx` – 11 Tests.
- Manueller Testplan: `docs/test-plans/uc-019-aufgabe-bestaetigen.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                    | Impact | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------ | ----------- |
| 1   | **A3 «Nur-Dank-Kategorie» hat im Datenmodell keine Kategorie-Eigenschaft.** Zwei Wege führen dorthin: der Punktwert der Aufgabe ist 0, oder die Regel `task_done` steht auf 0 beziehungsweise inaktiv. Angenommen: beide gelten, und beide führen zu «Dank ohne Zahl». Durch Prüfung gepinnt. | Medium | Stakeholder |
| 2   | BR-080 sagt «Wer eine Aufgabe selbst übernommen hat, kann sie nicht selbst bestätigen». Umgesetzt als: die **bestätigende** Person ist nicht die übernehmende. Ein zweites Vorstandsmitglied darf also bestätigen, auch wenn es selbst eine andere Übernahme derselben Aufgabe hält. | Low | Stakeholder |
| 3   | A2 verlangt einen Hinweis, der «einmalig» erscheint. Umgesetzt als Hinweis im Blatt, der verschwindet, sobald etwas im Feld steht – kein gespeicherter Zustand pro Person. | Low | Stakeholder |
| 4   | Schritt 8 zeigt das Kudos «auf dem Profil des Mitglieds». Umgesetzt als **eigenes** Profil: Eine für andere sichtbare Dankesliste wäre eine Auswertung über Personen (NFR-022). | Medium | Stakeholder |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-09 | Plan erstellt |
| 2026-09-09 | `0036` eingespielt, 34 Prüfungen gegen die laufende Datenbank; BR-065 geschlossen |
| 2026-09-09 | Code-Review: vier Befunde, behoben |
| 2026-09-09 | Tests, manueller Testplan, Statusabgleich – Plan abgeschlossen |

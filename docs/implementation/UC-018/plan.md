# Implementation Plan: UC-018 — Aufgabe übernehmen und einreichen

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                            |
| **Goal**          | Eine Vereinsaufgabe übernehmen, erledigen und zur Bestätigung einreichen |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | Done                                                                |

## Overview

Die Gegenseite von UC-017. Hier entscheidet sich, ob aus einer Ausschreibung
ein Beitrag wird – und die Spezifikation legt Wert darauf, dass das ohne
Nachteil bleibt: Eine Übernahme lässt sich zurückgeben, ohne Punkteabzug und
ohne Vermerk (BR-075), und die Frist verhindert die Einreichung nicht, sie
kommentiert sie nur (A4).

Der Bestand deckt genau einen Schritt ab. `claim_task()` steht seit `0004` und
ist seit `0034` auch am Geltungsbereich geprüft; alles danach fehlt. Es gibt
keinen Weg, eine Aufgabe **anzusehen** (Schritt 3), keinen, sie **einzureichen**
(Schritt 7), und keinen, sie **zurückzugeben** (A3). Wer heute übernimmt, sitzt
in einer Sackgasse: Die Aufgabe steht in seiner Liste und bleibt dort.

## Related Use Cases

- UC-017 Aufgabe ausschreiben — legt an, was hier übernommen wird
- UC-019 Aufgabe bestätigen — nimmt entgegen, was hier eingereicht wird
- UC-012 Schicht übernehmen — dasselbe Muster mit Schichten; `take_shift()` und `release_shift()` sind die Vorlage
- UC-033 Beitrags-Profil — erst damit stehen «persönlich passende» Aufgaben zuoberst (Schritt 2)

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                   | Status vorher | Ziel        | Notizen                                                    |
| ------ | ----------------------- | ------------- | ----------- | ---------------------------------------------------------- |
| FR-052 | Aufgabe übernehmen      | In Progress   | Implemented | `claim_task()` steht; es fehlte die Ansicht, aus der heraus man übernimmt |
| FR-053 | Aufgabe einreichen      | In Progress   | Implemented | `submit_task()` samt optionalem Nachweis                    |
| FR-057 | Verteilungs-Transparenz | Open          | Implemented | Saisonzähler der eigenen Übernahmen, gerechnet wie die Saison überall sonst |

### Business Rules

| ID     | Regel                              | Ziel        | Notizen                                                        |
| ------ | ---------------------------------- | ----------- | -------------------------------------------------------------- |
| BR-073 | Reservation verhindert Doppelarbeit | Implemented | Die Belegung steht an jeder Aufgabe, `claim_task()` sperrt die Zeile |
| BR-074 | Punkte erst nach Bestätigung        | Implemented | Weder `claim_task()` noch `submit_task()` fassen den Ledger an  |
| BR-075 | Rückgabe ohne Nachteil              | Implemented | `release_task()` löscht die Übernahme, ohne Spur am Mitglied    |
| BR-076 | Verteilung ist sichtbar             | Implemented | `my_season_task_count()`                                        |

### Non-Functional Requirements

| ID      | Titel                       | Kategorie   | Betroffen | Notizen                                                    |
| ------- | --------------------------- | ----------- | --------- | ---------------------------------------------------------- |
| NFR-009 | Zustellung ohne Push        | Reliability | Ja        | Schritt 8 geht in die Inbox, nicht nur als Push             |
| C-011   | Regeln in der Datenbank     | Design      | Ja        | Kapazität und Rollen prüft der Server, nicht das Formular   |
| NFR-022 | Kein Personenbezug in Kennzahlen | Privacy | Ja      | Der Saisonzähler zeigt **die eigene** Zahl, keine Rangliste der Faulen |

---

## Current State

- `supabase/migrations/0004_tasks_news.sql`: `claim_task()` — Schritt 4/5.
- `supabase/migrations/0034_task_marketplace_hardening.sql`: Geltungsbereich.
- `supabase/migrations/0006_rls.sql`: `task_assignments_delete_self` und
  `task_assignments_submit_self` — die Rechte für A3 und Schritt 7 bestehen,
  aber niemand nutzt sie, und der Statuswechsel der **Aufgabe** ist damit nicht
  gedeckt.
- `app/src/hooks/useTasks.ts`, `app/src/pages/MarketplacePage.tsx`:
  Übernehmen aus der Liste heraus.

Schritte 3, 6, 7 und 8 sowie A1, A3, A4 und A5 sind nicht abgedeckt.

---

## Missing Pieces

| #   | Was fehlt                                                                | Anforderung    | Quelle          |
| --- | ------------------------------------------------------------------------ | -------------- | --------------- |
| 1   | Keine Detailansicht: Beschreibung und Warum sind nicht vollständig lesbar | Schritt 3      | Automated       |
| 2   | Kein «Erledigt melden», kein Nachweis                                     | FR-053, A5     | Cross-reference |
| 3   | Kein Statuswechsel auf eingereicht und keine Meldung an die verantwortliche Person | Schritt 8 | Cross-reference |
| 4   | Kein «Doch nicht»                                                         | A3, BR-075     | Cross-reference |
| 5   | Keine Warnung an die ausschreibende Person bei Rückgabe kurz vor der Frist | A3, Schritt 2 | Cross-reference |
| 6   | Kein Hinweis auf die abgelaufene Frist bei der Einreichung                | A4             | Cross-reference |
| 7   | Kein Saisonzähler der Übernahmen                                          | FR-057, BR-076 | Cross-reference |

---

## Implementation Guidelines

- **Bauteile:** `FormModal` für die Detailansicht (Blatt über der Seite, bringt
  `presentingElement` mit), `ListSection`, `StatCard` in `.app-stat-row` für den
  Saisonzähler, `useToast()`. Neu entsteht genau **eine** Komponente:
  `TaskDetailModal` – nach dem Vorbild von `ShiftListModal`.
- **Stil:** keine Inline-Styles, keine neue CSS-Datei; Zustände über
  `IonBadge`/`IonNote` mit Ionic-Farben.
- **Struktur:** Logik nach `app/src/lib/task.ts`, Datenzugriff in
  `app/src/hooks/useTasks.ts`, Migration `0035_task_submission.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0035_task_submission.sql`: `submit_task()`, `release_task()`,
      `my_season_task_count()`, Rechte
- [x] 2. `lib/task.ts`: `taskAction()` – welcher Weg einer Person offensteht
- [x] 3. `hooks/useTasks.ts`: `useSubmitTask`, `useReleaseTask`, `useMyTaskCount`
- [x] 4. `components/TaskDetailModal.tsx` – Schritt 3, 7, A3, A4, A5
- [x] 5. `MarketplacePage`: Zeilen öffnen die Aufgabe, Saisonzähler
- [x] 6. Vier Sprachen, `npm run i18n:check`
- [x] 7. Verhaltensprüfung gegen die laufende Datenbank
- [x] 8. `ai-code-review` und Behebung der Befunde
- [x] 9. Vitest für `lib/task.ts` und `TaskDetail`
- [x] 10. Manueller Testplan `docs/test-plans/uc-018-aufgabe-uebernehmen.md`
- [x] 11. Statusabgleich in `requirements.md`, `UC-018`, `use_cases/README.md`

---

## Umsetzung

- `supabase/migrations/0035_task_submission.sql`
  - `submit_task()` – Schritte 7 und 8. Die Frist hält niemanden auf (A4), der
    Nachweis ist freiwillig (A5) und ein Verweis, kein Anhang.
  - `release_task()` – A3. Die Zeile wird **gelöscht** und nicht als
    «zurückgegeben» markiert: Ein solcher Vermerk wäre genau der Nachteil, den
    BR-075 ausschliesst. Gewarnt wird nur, wenn die Frist innerhalb von 48
    Stunden abläuft.
  - `my_season_task_count()` – BR-076, gerechnet mit `season_label()`, also
    derselben Funktion, die den Ledger einordnet.
- `app/src/lib/task.ts`: `taskAction()` entscheidet an **einer** Stelle,
  welcher Weg offensteht; `isProofUsable()` prüft den Verweis.
- `app/src/components/TaskDetailModal.tsx`, `hooks/useTasks.ts`,
  `pages/MarketplacePage.tsx`.

---

## Verhaltensprüfung gegen die laufende Datenbank

30 Prüfungen in einer Transaktion, die sich zum Schluss selbst zurückrollt.
Ein Vorstand, zwei Mitglieder, vier Aufgaben – darunter eine überfällige und
eine mit zwei Plätzen.

| #     | Prüfung                                                | Ergebnis                     |
| ----- | ------------------------------------------------------ | ---------------------------- |
| 1–2   | Übernahme: Status `claimed`, Punktebuchungen            | **0** (BR-074)               |
| 3     | Zweite Übernahme desselben Platzes                      | abgewiesen (A1)              |
| 4–5   | Zwei Plätze: nach 1 von 2 `open`, nach 2 von 2 `claimed` | A2 hält                     |
| 6–9   | `submit_task()` mit Nachweis                            | `submitted`, Verweis getrimmt gespeichert, **0** Punktebuchungen |
| 10–11 | Meldung an die ausschreibende Person                    | 1 – «Allein – Eins» (Schritt 8) |
| 12–14 | Zweimal melden                                          | `false`, keine zweite Meldung, Nachweis unverändert |
| 15–16 | A2: erst wenn **alle** gemeldet haben, gilt die Aufgabe als eingereicht | hält |
| 17    | Einreichung **nach** Fristablauf                        | gelingt (A4)                 |
| 18    | Einreichen ohne Übernahme                               | abgewiesen                   |
| 19–21 | A3: Rückgabe bei Frist in 20 Stunden                    | warnt, Aufgabe wieder `open` |
| 22–23 | Kein Vermerk am Mitglied, keine Punktebuchung           | **0** / **0** (BR-075)       |
| 24    | Rückgabe ohne drängende Frist                           | warnt **nicht**              |
| 25    | Rückgabe nach Bestätigung                               | abgewiesen                   |
| 26–28 | Saisonzähler: 2 / 2, nach Rückdatierung in die Vorsaison **0** | BR-076 hält           |
| 29–30 | `submit_task` für `anon` / `release_task` für `authenticated` | nein / ja              |

---

## Befunde des Code-Reviews (`ai-code-review`)

Vier Befunde, alle in der Oberfläche – die Serverseite hielt der Prüfung stand.

| #  | Befund                                                                                                                               | Schwere | Erledigt in |
| -- | ------------------------------------------------------------------------------------------------------------------------------------ | ------- | ----------- |
| 1  | **Ein gesperrter «Übernehmen»-Knopf über einer vergebenen Aufgabe sagt das Falsche.** Wo es keinen Weg gibt, schliesst der Hauptknopf jetzt – auf iOS ohnehin die Rolle des rechten Knopfs im Blatt. | Mittel | `TaskDetailModal` |
| 2  | **Nach dem Übernehmen blieb das Blatt offen** und bot unvermittelt «Erledigt melden» an. Schritt 5 sagt, wohin der Blick gehört: in die persönliche Liste. | Mittel | `MarketplacePage` |
| 3  | **Toter Zustand:** Die Ansicht behandelte bestätigte Aufgaben, die `useTasks()` gar nicht lädt. Die Anzeige ist entfernt; der Zweig in `taskAction()` bleibt als Wächter – er verhindert, dass eine gebuchte Aufgabe je «Erledigt melden» anbietet. | Niedrig | `TaskDetailModal`, ein i18n-Schlüssel entfernt |
| 4  | `why` kann an einem Entwurf leer sein und ergab dann einen leeren Abschnitt.                                                          | Niedrig | `TaskDetailModal` |

Bestätigt hat der Review: Weder `claim_task()` noch `submit_task()` fassen den
Ledger an (BR-074, nachgemessen), die Rückgabe hinterlässt keine Spur
(BR-075), der Saisonzähler zeigt nur die eigene Zahl (NFR-022), und
`isProofUsable()` lässt `javascript:` nicht durch.

---

## Tests

- `app/src/lib/task.test.ts` – 37 Tests, davon 11 neu für `taskAction()` und
  `isProofUsable()`.
- `app/src/components/TaskDetailModal.test.tsx` – 12 Tests: was die Ansicht
  zeigt und zulässt.
- Manueller Testplan: `docs/test-plans/uc-018-aufgabe-uebernehmen.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                              | Impact | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------ | ------ | ----------- |
| 1   | **Wann gilt eine Aufgabe mit mehreren Übernehmenden als eingereicht?** A2 lässt sie offen, solange Plätze frei sind. Angenommen: `submitted` erst, wenn sie voll ist **und** alle eingereicht haben; vorher bleibt der Status, wo er ist. Durch Prüfung gepinnt. | Medium | Stakeholder |
| 2   | Der Nachweis ist ein **Verweis**, kein Anhang: Datei-Upload verlangt Storage und eine Aufbewahrungsregel, beides steht im MVP-Schnitt nicht. `proof_url` ist im Entitätsmodell genau so vorgesehen. | Medium | Stakeholder |
| 3   | «Persönlich passende Aufgaben stehen zuoberst» (Schritt 2) braucht UC-033. Bis dahin ordnet die Dringlichkeit. | Medium | Stakeholder |
| 4   | A3 warnt die ausschreibende Person, wenn die Frist «innerhalb von 48 Stunden» abläuft. Eine Aufgabe **ohne** Frist löst damit keine Warnung aus – angenommen, weil ohne Frist nichts drängt. | Low | Stakeholder |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-09 | Plan erstellt |
| 2026-09-09 | `0035` eingespielt, 30 Prüfungen gegen die laufende Datenbank |
| 2026-09-09 | Code-Review: vier Befunde in der Oberfläche, behoben |
| 2026-09-09 | Tests, manueller Testplan, Statusabgleich – Plan abgeschlossen |

# Implementation Plan: UC-033 — Beitrags-Profil erfassen

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                            |
| **Goal**          | Angeben, womit man gern beiträgt, damit Verantwortung persönlich angeboten wird |
| **Plan created**  | 2026-09-10                                                          |
| **Status**        | Done                                                                |

## Overview

**BR-142 ist der Satz, um den es geht: «Anfragen statt abfragen.»** Der Verein
fragt nicht mehr nur, wer eine offene Aufgabe übernimmt, sondern was für das
Mitglied ein sinnvoller Beitrag wäre. Das dreht die Richtung um – und es ist
der Grund, warum FR-059 seit UC-017 auf `In Progress` steht: Der Marktplatz
schreibt aus, aber er **bietet niemandem etwas an**.

`suggest_task()` aus `0033` benachrichtigt heute den ganzen Verein. Das ist
eine Ausschreibung mit Zustellung, kein Angebot. Dieser Use Case macht daraus
ein persönliches: Wer ein Profil hat, bekommt, was dazu passt – und **nur**
das.

Die Kehrseite steht in BR-143: Das Profil ist freiwillig, und ohne Profil
bleibt alles wie bisher. Ein fehlendes Profil darf weder auffallen noch
gemeldet werden.

## Related Use Cases

- UC-017 Aufgabe ausschreiben — liefert `suggest_task()`, das hier seinen Sinn
  bekommt; die Kategorienliste ist dieselbe
- UC-018 Aufgabe übernehmen — was übernommen wurde, zählt gegen das Zeitbudget
- UC-031 Ämter — «Aufgaben **und Ämter**» aus dem Ziel; Vakanzen sind der
  zweite Ort, an dem angeboten wird
- UC-023 Fürsorge-Hinweis — BR-145 grenzt genau dagegen ab: Das Profil ist
  **nicht** Teil der Führungssicht

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                    | Status vorher | Ziel        | Notizen                                                       |
| ------ | ------------------------ | ------------- | ----------- | ------------------------------------------------------------- |
| FR-058 | Beitrags-Profil erfassen | Open          | Implemented | Interessen, Stärken, Zeitbudget – alles freiwillig             |
| FR-059 | Beitrags-Matching        | **In Progress** | Implemented | Löst den Rest ein: `suggest_task()` bietet an, statt auszuschreiben |

### Business Rules

| ID     | Regel                                  | Ziel        | Notizen                                                          |
| ------ | -------------------------------------- | ----------- | ---------------------------------------------------------------- |
| BR-142 | Anfragen statt abfragen                | Implemented | Die Frage nach dem sinnvollen Beitrag steht **vor** der Kategorienwahl |
| BR-143 | Das Profil ist freiwillig              | Implemented | Ohne Profil bleibt die Zustellung wie bisher; niemand erfährt, wer keines hat |
| BR-144 | Zeitbudget wird respektiert            | Implemented | A4: ausgeschöpftes Budget stellt **persönliche** Vorschläge zurück |
| BR-145 | Nicht Teil der Führungssicht           | Implemented | Policy: nur die eigene Zeile. Kein Signal, keine Gesundheitsansicht |

### Non-Functional Requirements

| ID      | Titel                      | Kategorie | Betrifft? | Notizen                                        |
| ------- | -------------------------- | --------- | --------- | ---------------------------------------------- |
| NFR-011 | Serverseitige Berechtigung | Security  | Ja        | Das Profil liest nur die Person selbst          |
| NFR-028 | Vier Sprachen              | Usability | Ja        | Auch die Kategorienamen bestehen bereits        |
| NFR-032 | Ein Erscheinungsbild       | Usability | Ja        | `AppPage`, `ListSection`, `FormModal`           |

---

## Current State

- `supabase/migrations/0033_task_marketplace.sql`: `suggest_task()` benachrichtigt
  **jedes** Mitglied des Vereins bzw. Teams. Genau das ist die Lücke hinter
  FR-059.
- `app/src/lib/task.ts`: `TASK_CATEGORIES` – die acht Kategorien stehen bereits
  und sind laut Entitätsmodell **dieselbe Liste**, aus der das Profil wählt.
- `functionary_roles` seit `0049`: die Vakanzen für den zweiten Teil des Ziels.
- **Das Profil gibt es nicht.** Weder Tabelle noch UI.

---

## Missing Pieces

| #   | Was fehlt                                           | Anforderung    | Quelle          |
| --- | --------------------------------------------------- | -------------- | --------------- |
| 1   | Kein Profil                                         | FR-058         | Automated       |
| 2   | `suggest_task()` bietet nicht an, es schreibt aus   | FR-059, BR-142 | Automated       |
| 3   | Kein Zeitbudget, das etwas bewirkt                  | BR-144, A4     | Cross-reference |
| 4   | Keine passende Aufgabe unmittelbar nach dem Speichern | Schritt 7    | Cross-reference |
| 5   | Keine jährliche Nachfrage                           | Schritt 1, A1  | Cross-reference |
| 6   | Vakante Ämter werden niemandem angeboten            | FR-059 (Ziel)  | Cross-reference |

---

## Implementation Guidelines

Verbindlich aus `docs/guidelines.md`:

- **Bauteile:** `AppPage`, `ListSection` mit `footnote`, `FormModal`,
  `SkeletonList`, `EmptyState`/`ErrorState`, `useToast()`. Für die Interessen
  ein `IonSelect multiple` mit `cancelText`/`okText` (§8), für das Zeitbudget
  ein `IonSegment` (§2). **Kein neues Bauteil.**
- **Wiederverwendung:** Die Kategorienliste kommt aus `lib/task.ts`, nicht aus
  einer zweiten Aufzählung – zwei Listen, die auseinanderlaufen, ergeben kein
  Matching.
- **Entscheidungen** als reine Funktionen in `src/lib/contribution.ts` (§9).
- **Struktur:** `src/hooks/useContribution.ts`,
  `src/components/ContributionProfileModal.tsx`,
  Abschnitt auf `MarketplacePage`; Migration `0051_contribution_profile.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0051_contribution_profile.sql`:
      `member_contribution_profiles`, Policy, `save_contribution_profile()`,
      `contribution_budget_left()`, `matching_tasks()`, `matching_vacancies()`,
      `suggest_task()` neu, `ask_contribution_profiles()` + Cron
- [x] 2. `lib/contribution.ts`: Zeitbudget, Prüfregeln, Vollständigkeit
- [x] 3. `hooks/useContribution.ts`: Profil lesen und schreiben, Vorschläge
- [x] 4. `ContributionProfileModal`: die drei Fragen in der Reihenfolge der Spezifikation
- [x] 5. `MarketplacePage`: der Abschnitt «Für dich» und der Weg zum Profil
- [x] 6. Vier Sprachen – `npm run i18n:check`
- [x] 7. Verhaltensprüfung gegen die verknüpfte Datenbank
- [x] 8. `ai-code-review` und Behebung der Befunde
- [x] 9. Vitest, mit einem Test, der **BR-145 festhält**
- [x] 10. Manueller Testplan `docs/test-plans/uc-033-beitrags-profil.md`
- [x] 11. Statusabgleich in `requirements.md`, UC-Dokument, `use_cases/README.md`
      und `entity_model.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                                                                  | Impact   | Owner       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| 1   | **Wer ein Profil hat, bekommt weniger Meldungen als wer keines hat.** Das ist der Zweck (K3b: angeboten statt ausgeschrieben), sieht aber wie eine Benachteiligung aus. Umgesetzt: Ohne Profil bleibt die Zustellung wie bisher; mit Profil kommt, was passt. | **High** | Stakeholder |
| 2   | Das Entitätsmodell nennt die Zeitbudget-Werte auf Deutsch (`einmalig`, `monatlich`, `saisonal`). `CLAUDE.md` verlangt englische Datenbankwerte. Umgesetzt: `once`, `monthly`, `seasonal`; das Modell wird nachgezogen.                             | Medium   | Architect   |
| 3   | «Zeitbudget ausgeschöpft» (A4) ist nicht beziffert. Angenommen: **ein** übernommener Beitrag bei `once`, **einer pro Monat** bei `monthly`, **drei pro Saison** bei `seasonal`.                                                                    | Medium   | Stakeholder |
| 4   | A1 verlangt, dass ohne Profil «erst beim nächsten jährlichen Durchgang» erneut gefragt wird. Umgesetzt als Zeile mit `asked_at` und leeren Interessen – ein Profil, das nur festhält, dass gefragt wurde.                                          | Low      | Dev         |
| 5   | Schritt 3 nennt das Sprachmemo. Die Aufnahme fehlt weiterhin (BR-125, offen seit UC-029); umgesetzt ist der Satz als Text.                                                                                                                        | Low      | Stakeholder |
| 6   | Ämter werden angeboten, aber nicht ausgeschrieben: Eine Vakanz-Anzeige im Marktplatz ist Ausbaustufe 2 (`MVP_Scope` §2). Umgesetzt ist der Vorschlag an passende Profile.                                                                          | Low      | Stakeholder |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-10 | Plan erstellt |
| 2026-09-10 | `0051_contribution_profile.sql` eingespielt; Verhaltensprüfung mit **34 von 34** bestanden. Die drei, auf die es ankommt: Cem («Organisation») bekommt die catering-Aufgabe **nicht**, Ben ohne Profil bekommt sie wie bisher (BR-143), Dana mit erschöpftem Budget bekommt sie nicht (BR-144) |
| 2026-09-10 | Die Probe war einmal selbst falsch: Sie zählte den Rückgabewert von `ask_contribution_profiles()`, der wie jeder Cron über **alle** Vereine läuft. Vereinsbezogen gezählt stimmt er |
| 2026-09-10 | **FR-059 eingelöst.** `suggest_task()` benachrichtigte seit UC-017 den ganzen Verein – eine Ausschreibung mit Zustellung. Jetzt drei Gruppen, drei Behandlungen: passendes Profil → Angebot, kein Profil → wie bisher, unpassendes Profil oder erschöpftes Budget → nichts |
| 2026-09-10 | App-Seite: `ContributionProfileModal` mit der Frage nach dem Menschen **vor** der Kategorienliste, Abschnitt «Für dich» im Marktplatz; vier Sprachen, 1124 Schlüssel |
| 2026-09-10 | Review-Befunde behoben: `budgetCap()` war tot – und die Zahl «drei» stand in vier Übersetzungen als Wort, während die Datenbank sie als Zahl führt; sie kommt jetzt aus einer Quelle. `askedAt` und `dueAt` wurden mitgeführt und nie gelesen. Ein Fehler der Vorschlagsabfrage blendete den Abschnitt still aus – er sah aus wie «nichts passt» |
| 2026-09-10 | Statusabgleich: FR-058 und FR-059 auf `Implemented`; UC-033 auf `Implemented`; Entitätsmodell auf englische Budgetwerte und `asked_at` nachgezogen |

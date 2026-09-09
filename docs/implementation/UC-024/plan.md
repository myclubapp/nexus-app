# Implementation Plan: UC-024 — Eigene Wertdimensionen einsehen

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied (A4: Trainer:in als Gesprächsgrundlage)                    |
| **Goal**          | Das eigene Beitragsprofil über fünf Dimensionen im Vergleich zu Team und Verein sehen |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | Done                                                                |

## Overview

Die Spider-Selbstsicht ist im MVP-Schnitt ausdrücklich als Teil von
«Gamification Basic» genannt – und sie ist der Ort, an dem sich entscheidet, ob
das Punktesystem eine Würdigung oder eine Note ist. Die Spezifikation lässt
daran keinen Zweifel: **Wertschätzung, keine Bewertung** (BR-101), keine
Rangliste des Werts (BR-102), und – die feinste Regel – **nicht erhoben ist
nicht null** (BR-103).

Genau diese Regel wird hier sofort real. Die fünf Dimensionen speisen sich aus
den sieben Säulen, und eine davon – **Finanzen** – hat heute keine Quelle:
Rechnungen kommen erst mit UC-036. Sie als «0 von 100» zu zeichnen, wäre eine
Aussage über die Person, die niemand gemeint hat.

## Related Use Cases

- UC-020 Punktestand — dieselbe Datenquelle, andere Frage
- UC-016 Punkteregeln — die Säulen und ihre Aktivierung (A2)
- UC-022 Leaderboard — der Ort für Vergleich; hier gibt es keinen Rang
- UC-036 Rechnungen — liefert später die fehlende Dimension

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                | Status vorher | Ziel        | Notizen                                          |
| ------ | -------------------- | ------------- | ----------- | ------------------------------------------------ |
| FR-071 | Spider-Selbstsicht   | Open          | Implemented | Fünf Dimensionen, zwei Vergleichslinien           |
| FR-072 | Spider-Führungssicht | Open          | Implemented | A4: dieselbe Ansicht, derselbe Wortlaut, kein Export |

### Business Rules

| ID     | Regel                            | Ziel        | Notizen                                               |
| ------ | -------------------------------- | ----------- | ----------------------------------------------------- |
| BR-100 | Keine neue Datenerhebung         | Implemented | Ausschliesslich aus `point_transactions` und `point_rules` |
| BR-101 | Wertschätzung, keine Bewertung   | Implemented | Keine Gesamtnote, kein Rang – nur die **stärkste** Dimension wird benannt |
| BR-102 | Keine Rangliste des Werts        | Implemented | Es entsteht keine Ansicht, die danach sortiert; A4 bietet weder Sortierung noch Export |
| BR-103 | Nicht erhoben ist nicht null     | Implemented | «Finanzen» ist heute genau dieser Fall               |
| BR-104 | Mindestgruppengrösse beim Vergleich | Implemented | Unter drei Personen keine Vergleichslinie (A3)      |

### Non-Functional Requirements

| ID      | Titel                            | Kategorie | Betroffen | Notizen                                             |
| ------- | -------------------------------- | --------- | --------- | --------------------------------------------------- |
| NFR-022 | Kein Personenbezug in Kennzahlen | Privacy   | Ja        | BR-104 verhindert, dass ein Durchschnitt eine Einzelperson verrät |
| C-003   | Keine fremden Dienste            | Design    | Ja        | Das Netzdiagramm ist ein eigenes SVG, keine Chart-Bibliothek |

---

## Current State

- `supabase/migrations/0002_points.sql`: `point_transactions`, `point_rules`
  mit `pillar` – die einzige Datenquelle, die es braucht.
- `supabase/migrations/0037_points_overview.sql`: der Ledger ist nur für die
  eigene Person und den Vorstand lesbar. Ein Durchschnitt über das Team lässt
  sich im Client deshalb gar nicht mehr rechnen.
- `app/src/lib/pointRule.ts`: die sieben Säulen.

Es gibt weder eine Dimension noch eine Ansicht.

---

## Missing Pieces

| #   | Was fehlt                                                    | Anforderung | Quelle          |
| --- | ------------------------------------------------------------ | ----------- | --------------- |
| 1   | Keine Abbildung der sieben Säulen auf fünf Dimensionen        | FR-071      | Cross-reference |
| 2   | Keine Vergleichswerte für Team und Verein                     | Schritt 3   | Cross-reference |
| 3   | Kein Netzdiagramm                                             | FR-071      | Automated       |
| 4   | Keine Kennzeichnung nicht erhobener Dimensionen               | BR-103, A2  | Cross-reference |
| 5   | Keine Mindestgruppengrösse                                    | BR-104, A3  | Cross-reference |
| 6   | Keine Erklärung, woraus eine Dimension entsteht               | Schritt 6   | Cross-reference |
| 7   | Keine Führungssicht                                           | FR-072, A4  | Cross-reference |

---

## Implementation Guidelines

- **Bauteile:** `AppPage`, `ListSection`, `FormModal` für die Erklärung einer
  Dimension. Neu entsteht **eine** Komponente: `RadarChart` – ein
  eigenes SVG in `src/components/`, weil es dafür keine Ionic-Komponente gibt
  und eine Chart-Bibliothek eine Abhängigkeit wäre, die dieses eine Diagramm
  nicht rechtfertigt (Grundsatz §1, Schritt 3).
- **Stil:** Die Farben kommen aus den bestehenden Ionic-Variablen; die Formen
  bekommen ihre Klassen in `src/theme/variables.css`.
- **Struktur:** Logik nach `app/src/lib/dimensions.ts`, Migration
  `0042_value_dimensions.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0042_value_dimensions.sql`: `value_dimensions()` mit
      eigenen Werten, Team- und Vereinsdurchschnitt, Erhebungs-Kennzeichen
      und Gruppengrössen
- [x] 2. `lib/dimensions.ts`: die Abbildung Säule → Dimension, die stärkste
      Dimension, die Punkte des Netzes
- [x] 3. `hooks/useGamification.ts`: `useValueDimensions`
- [x] 4. `components/RadarChart.tsx` samt Klassen in `variables.css`
- [x] 5. `pages/StrengthsPage.tsx` samt Route und Einstieg; A4 über `?member=`
- [x] 6. Vier Sprachen
- [x] 7. Verhaltensprüfung gegen die laufende Datenbank
- [x] 8. `ai-code-review` und Behebung der Befunde
- [x] 9. Vitest
- [x] 10. Manueller Testplan `docs/test-plans/uc-024-wertdimensionen.md`
- [x] 11. Statusabgleich

---

## Umsetzung

- `supabase/migrations/0042_value_dimensions.sql`
  - `dimension_of_pillar()` – die Abbildung der sieben Säulen auf die fünf
    Dimensionen, **einmal** und im Server. Die App liest sie und rechnet nicht mit.
  - `value_dimensions()` – eigene Werte, Team- und Vereinsdurchschnitt,
    Erhebungs-Kennzeichen und Gruppengrösse in einer Abfrage. Gerechnet wird
    dort, weil seit `0037` niemand mehr fremde Buchungen liest – ein
    Team-Durchschnitt liesse sich im Client gar nicht bilden.
  - Die Skala: hundert ist der höchste Wert, den in dieser Saison jemand im
    Verein in dieser Dimension erreicht hat. So liegen eigene Werte und
    Vergleichslinien auf **derselben** Skala.
- `app/src/lib/dimensions.ts`, `components/RadarChart.tsx` (eigenes SVG),
  `pages/StrengthsPage.tsx`, Klassen in `theme/variables.css`.

---

## Verhaltensprüfung gegen die laufende Datenbank

15 Prüfungen in einer Transaktion, die sich zum Schluss selbst zurückrollt.
Fünf Mitglieder, zwei Teams, eine deaktivierte Säule.

| #     | Prüfung                                                      | Ergebnis                       |
| ----- | ------------------------------------------------------------ | ------------------------------ |
| 1     | Es kommen immer **fünf** Dimensionen zurück                  | 5 – auch die ohne Buchung      |
| 2–3   | «Finanzen»: erhoben / eigener Wert                            | **false** / 0 → die Ansicht zeigt «nicht erhoben» (BR-103) |
| 4     | «Engagement» bei aktiver Säule 1 und inaktiver Säule 2       | erhoben                        |
| 5–6   | Skala: Bester im Engagement / 40 von 80 im Ehrenamt          | 100 / 50                       |
| 7     | Team mit **einer** Person – Team-Linie                        | **ausgeblendet** (BR-104, A3)  |
| 8     | Vereins-Linie für dieselbe Person                             | 46 – bleibt                    |
| 9     | Trainer:in sieht ein Mitglied des eigenen Teams               | ja (A4, FR-072)                |
| 10–11 | Trainer:in eines fremden Teams / ein Mitglied                 | beide abgewiesen (BR-102)      |
| 12–14 | Neumitglied: fünf Dimensionen, eigene Werte null, Vergleichslinien trotzdem da | A1 hält        |
| 15    | `value_dimensions` für `anon`                                 | kein Recht                     |

---

## Befunde des Code-Reviews (`ai-code-review`)

Beide Befunde brechen nichts – sie lassen den Use Case unvollständig.

| #  | Befund                                                                                                            | Schwere | Erledigt in |
| -- | -------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| 1  | **Das Netzdiagramm trug keine Achsenbeschriftungen.** `labels` diente nur dazu, die Zahl der Achsen zu zählen. Ein Netz ohne Beschriftung ist Zierde: Man sieht eine Form und weiss nicht, wovon sie handelt. | Mittel | `RadarChart` |
| 2  | **A4 war gebaut und unerreichbar.** Die Führungssicht hing an `?member=`, und nichts verlinkte darauf. | Mittel | Einstieg im Mitglieds-Blatt |
| 3  | Ein Test von mir prüfte ein leeres Objekt und wäre grün geblieben, ohne etwas zu bedeuten. Ersetzt durch eine Prüfung der **Quelle**: keine Gesamtnote, keine Sortierung (BR-101, BR-102). | Niedrig | `dimensions.test.ts` |

Ausserdem beim ersten Einspielen aufgefallen: Die Spaltennamen aus
`returns table` werden in PL/pgSQL zu Variablen und kollidieren mit den
gleichnamigen Spalten der Abfrage – `#variable_conflict use_column` löst das.

---

## Tests

- `app/src/lib/dimensions.test.ts` – 14 Tests. Der wichtigste unterscheidet
  **null von «nicht erhoben»**: `loyalty` bei null ist eine Aussage,
  `finance` ohne Erhebung ist keine.
- Manueller Testplan: `docs/test-plans/uc-024-wertdimensionen.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                | Impact | Owner       |
| --- | --------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **Die Skala «null bis hundert» ist nicht definiert.** Angenommen: hundert ist der höchste Wert, den in dieser Saison **irgendjemand im Verein** in dieser Dimension erreicht hat. Damit liegen eigene Werte und Vergleichslinien auf derselben Skala. Ein fester Zielwert wäre die Alternative – er müsste aber je Verein gesetzt werden und wäre eine Vorgabe, die die Spezifikation nicht macht. | **High** | Stakeholder |
| 2   | **Die Abbildung Säule → Dimension steht nirgends.** Angenommen: Engagement ← Säulen 1+2, Ehrenamt ← 3+7, Netzwerk ← 4, Treue ← 5+6, Finanzen ← noch keine. Sie steht an **einer** Stelle im Server und wird von der App nur gelesen. | High | Stakeholder |
| 3   | BR-104 nennt keine Zahl. Angenommen: drei Personen mit Buchungen in der Bezugsgruppe. | Medium | Stakeholder |
| 4   | «Finanzen» ist heute nicht erhoben. Das ist kein Mangel dieses Use Case, sondern der Anlass für BR-103 – und ein Beleg dafür, dass die Regel greift, bevor UC-036 kommt. | Low | Dev |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-09 | Plan erstellt |
| 2026-09-09 | `0042` eingespielt, 15 Prüfungen gegen die laufende Datenbank |
| 2026-09-09 | Code-Review: drei Befunde, behoben |
| 2026-09-09 | Tests, manueller Testplan, Statusabgleich – Plan abgeschlossen |

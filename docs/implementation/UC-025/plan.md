# Implementation Plan: UC-025 — Transparenz-Seite einsehen und Health-Opt-out setzen

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                            |
| **Goal**          | Genau wissen, welche Signale zur eigenen Person bestehen und wer sie sieht – und sie abbestellen können |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | Done                                                                |

## Overview

**Bewusst vorgezogen.** Die Reihenfolge wäre UC-024; dieser Use Case kommt
zuerst, weil UC-023 soeben ein System gebaut hat, das Signale über Menschen
speichert – und das Gegengewicht dazu fehlt. Ein Mitglied kann heute weder
sehen, was der Verein über es weiss, noch etwas dagegen tun:
`club_members.health_opt_out` steht seit `0013` in der Datenbank und hat
**keinen Schalter**.

Die Seite ist die Einlösung eines Versprechens, das das ganze Produkt gibt:
Anti-Überwachung by Design. Sie zeigt nicht nur, was erhoben wird, sondern
sagt ausdrücklich, was **nicht** erhoben wird (BR-108) – und das ist der
ungewöhnlichere Teil.

## Related Use Cases

- UC-023 Fürsorge-Hinweis — erzeugt, was hier offengelegt wird
- UC-008 Profil und Datenschutz — dieselbe Haltung für Kontaktangaben
- UC-022 Leaderboard — der andere Opt-out (`leaderboard_opt_in`)

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel               | Status vorher | Ziel        | Notizen                                             |
| ------ | ------------------- | ------------- | ----------- | --------------------------------------------------- |
| FR-073 | Transparenz-Seite   | Open          | Implemented | Signale, Empfänger:innen, Datenarten und die Nicht-Erhebung |
| FR-074 | Health-Opt-out      | Open          | Implemented | Der Schalter, den die Spalte seit `0013` vermisst    |
| FR-075 | Definitionskatalog  | Open          | **Partial** | A3 erklärt jeden Signaltyp samt der im Verein geltenden Schwelle – **lesend**. Das Anpassen durch den Vorstand bleibt offen |

### Business Rules

| ID     | Regel                              | Ziel        | Notizen                                                     |
| ------ | ---------------------------------- | ----------- | ----------------------------------------------------------- |
| BR-105 | Vollständige Auskunft              | Implemented | Alle Signale zur Person, ohne Auswahl – eigene Funktion, weil die Policy aus `0040` dem Mitglied nichts zeigt |
| BR-106 | Opt-out wirkt sofort               | Implemented | Das Setzen **löscht** bestehende Signale in derselben Anweisung |
| BR-107 | Aggregate bleiben anonym           | Implemented | Nachgemessen: Der Punktestand und die Rangliste bleiben unberührt |
| BR-108 | Auch die Nicht-Erhebung wird benannt | Implemented | Ein eigener Abschnitt, und ein Test hält seinen Inhalt fest  |

### Non-Functional Requirements

| ID      | Titel                            | Kategorie | Betroffen | Notizen                                          |
| ------- | -------------------------------- | --------- | --------- | ------------------------------------------------ |
| NFR-022 | Kein Personenbezug in Kennzahlen | Privacy   | **Ja**    | Der Kern dieses Use Case                          |
| C-011   | Regeln in der Datenbank          | Design    | Ja        | Das Löschen beim Opt-out geschieht serverseitig, nicht im Client |

---

## Current State

- `supabase/migrations/0013_profile_privacy.sql`: `health_opt_out` – ohne
  Schalter, ohne Wirkung im UI.
- `supabase/migrations/0040_health_signals.sql`: die Signale und die Policy,
  die dem **Mitglied selbst** nichts zeigt (BR-096 kennt es nicht als
  Empfänger).
- `app/src/pages/ProfilePage.tsx`: Datenschutz-Optionen für Kontaktangaben.

Es gibt weder die Seite noch den Schalter noch eine Auskunft.

---

## Missing Pieces

| #   | Was fehlt                                                     | Anforderung | Quelle          |
| --- | ------------------------------------------------------------- | ----------- | --------------- |
| 1   | Keine Auskunft über die eigenen Signale                        | FR-073, BR-105 | Automated    |
| 2   | Kein Hinweis darauf, **wer** sie sieht                         | Schritt 4   | Cross-reference |
| 3   | Kein Schalter für den Opt-out                                  | FR-074      | Automated       |
| 4   | Kein Löschen beim Opt-out                                      | BR-106      | Cross-reference |
| 5   | Keine Aufzählung der erhobenen **und der nicht erhobenen** Daten | BR-108    | Cross-reference |
| 6   | Keine Erklärung der Signaltypen samt Schwelle                   | A3, FR-075  | Cross-reference |

---

## Implementation Guidelines

- **Bauteile:** `AppPage`, `ListSection`, `IonToggle` für den Opt-out,
  `IonAccordion` wäre neu – stattdessen der bestehende Weg: ein `FormModal`
  für die Erklärung eines Signaltyps (A3). Keine neue Komponente ausser der
  Seite selbst.
- **Sprache:** Dieselbe Regel wie in UC-023 – die Seite erklärt, sie klagt
  nicht an.
- **Struktur:** Ergänzungen in `lib/health.ts` und `hooks/useHealth.ts`,
  Migration `0041_health_transparency.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0041_health_transparency.sql`: `my_health_signals()`,
      `set_health_opt_out()` samt sofortigem Löschen
- [x] 2. `lib/health.ts`: Empfänger-Rollen je Signalart, Datenarten-Katalog
- [x] 3. `hooks/useHealth.ts`: `useMyHealthSignals`, `useSetHealthOptOut`
- [x] 4. `pages/TransparencyPage.tsx` samt Route und Einstieg im Profil
- [x] 5. Vier Sprachen, inklusive der Nicht-Erhebung (BR-108)
- [x] 6. Verhaltensprüfung gegen die laufende Datenbank
- [x] 7. `ai-code-review` und Behebung der Befunde
- [x] 8. Vitest, inklusive eines Tests auf den Inhalt von BR-108
- [x] 9. Manueller Testplan `docs/test-plans/uc-025-transparenz.md`
- [x] 10. Statusabgleich

---

## Umsetzung

- `supabase/migrations/0041_health_transparency.sql`
  - `my_health_signals()` – die vollständige Auskunft (BR-105). Über eine
    **eigene Funktion** und nicht über eine erweiterte Policy: `0040` gibt
    Signale nur den Zuständigen, und eine Policy mit «oder ich bin die
    betroffene Person» wäre der bequeme Weg – sie öffnete diese Zeilen für
    jede beliebige Abfrage, nicht nur für diese Seite.
  - `set_health_opt_out()` – wirkt sofort und **löscht** in derselben
    Anweisung (BR-106). Auch einen Hinweis, an dem gerade jemand arbeitet:
    Das ist die Absicht der Regel, die betroffene Person hat Vorrang.
- `app/src/pages/TransparencyPage.tsx`, Ergänzungen in `lib/health.ts` und
  `hooks/useHealth.ts`, Einstieg im Profil – für **jedes** Mitglied.

---

## Verhaltensprüfung gegen die laufende Datenbank

21 Prüfungen in einer Transaktion, die sich zum Schluss selbst zurückrollt.

| #     | Prüfung                                                        | Ergebnis                   |
| ----- | -------------------------------------------------------------- | -------------------------- |
| 1–2   | Signale erzeugt / davon zur betroffenen Person                 | 3 / 1                      |
| 3     | Die Person liest `health_signals` **direkt**                    | **0** – die Policy aus `0040` kennt sie nicht als Empfängerin |
| 4–5   | Dieselbe Person über `my_health_signals()`                      | 1, mit Typ, Ampel und Status (BR-105) |
| 6     | Sieht sie darüber fremde Signale                               | **0**                      |
| 7–10  | Opt-out: gelöschte Hinweise, Auskunft danach, Flagge, Tabelle  | 1 / 0 / true / 0 (BR-106)  |
| 11–13 | Punktebuchungen, Rangliste, Punktestand danach                 | unverändert (BR-107)       |
| 14    | Neue Signale während des Opt-outs                              | **0**                      |
| 15–17 | Rücknahme: nichts gelöscht, nichts rückwirkend, beim nächsten Lauf wieder eines | A2 hält |
| 18–19 | Eine Trainer:in über dieselbe Funktion / ihr Opt-out           | nur die eigenen / wirkt nur für sie |
| 20–21 | Rechte                                                          | `anon` nein, `authenticated` ja |

---

## Befunde des Code-Reviews (`ai-code-review`)

| #  | Befund                                                                                                                    | Schwere | Erledigt in |
| -- | --------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| 1  | **Die Invalidierung zielte auf einen Query-Key, den es nicht gibt.** `health_opt_out` hängt an der Mitgliedschaft, und die steht unter `['memberships', …]` – nicht unter `['club']`. Der Schalter wäre nach dem Umlegen auf dem alten Stand stehen geblieben, und die Seite hätte das Gegenteil dessen behauptet, was gilt. | **Hoch** | `useHealth.ts` |

Bestätigt hat der Review: Die Auskunft gibt ausschliesslich die eigenen Zeilen
heraus (nachgemessen), der Opt-out lässt Punktestand und Rangliste unberührt
(BR-107, nachgemessen), und die Rücknahme erzeugt nichts rückwirkend (A2).

---

## Tests

- `app/src/lib/health.test.ts` – 23 Tests, davon acht neu. Darunter der
  Gegenstück-Test zu BR-095: **BR-108 in allen vier Sprachen**. Eine Zusage,
  die man streichen kann, ohne dass etwas bricht, ist keine Zusage.
- Manueller Testplan: `docs/test-plans/uc-025-transparenz.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                              | Impact | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **Die Policy aus `0040` zeigt dem Mitglied seine eigenen Signale nicht.** Das ist richtig so – BR-096 kennt nur Trainer:in, Sportchef:in und Vorstand als Empfänger. Die Auskunft läuft deshalb über eine eigene Funktion, die ausschliesslich die **eigenen** Signale herausgibt. Eine Policy-Erweiterung wäre der bequemere und der falsche Weg: Sie öffnete den Weg auch für andere Abfragen. | High | Dev |
| 2   | Schritt 2 nennt den **Zahlungsstatus** als Datenart. Rechnungen gibt es erst mit UC-036; die Seite nennt ihn trotzdem, weil sie beschreibt, was das System erhebt, sobald das Modul steht – und kennzeichnet ihn als noch nicht in Betrieb. | Medium | Stakeholder |
| 3   | A3 zeigt «die im Verein geltende Schwelle». Gelesen wird sie aus denselben Vereinseinstellungen wie in `0040`. Ändern kann sie hier niemand – FR-075 bleibt deshalb `Partial`. | Medium | Stakeholder |
| 4   | BR-106 löscht sofort. Ein Hinweis, an dem gerade jemand arbeitet, verschwindet damit unter den Händen der Trainer:in. Das ist die Absicht der Regel – die betroffene Person hat Vorrang. | Low | Stakeholder |

---

## Progress Log

| Datum      | Eintrag                                                          |
| ---------- | ---------------------------------------------------------------- |
| 2026-09-09 | Plan erstellt; bewusst vor UC-024 gezogen, weil UC-023 ohne diese Seite ein Ungleichgewicht hinterlässt |
| 2026-09-09 | `0041` eingespielt, 21 Prüfungen gegen die laufende Datenbank |
| 2026-09-09 | Code-Review: ein Befund, behoben |
| 2026-09-09 | Tests, manueller Testplan, Statusabgleich – Plan abgeschlossen |

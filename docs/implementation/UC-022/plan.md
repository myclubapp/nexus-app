# Implementation Plan: UC-022 — Leaderboard einsehen

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                            |
| **Goal**          | Sehen, wie sich das Engagement im Team und im Verein verteilt        |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | Done                                                                |

## Overview

Die Rangliste ist die heikelste Ansicht des ganzen Produkts, und die
Spezifikation sagt vor allem, was sie **nicht** tun darf: keine Kennzeichnung
der letzten Plätze (BR-089), keine Sortierung von Menschen nach ihrem Wert
(BR-093), und wer nicht mitmachen will, erscheint nirgends und sammelt trotzdem
weiter Punkte (BR-091).

Die Seite steht – und ihre wichtigste Hälfte funktioniert nicht. `useLeaderboard`
nimmt einen Geltungsbereich **und** eine Team-Id entgegen; die Seite übergibt
nur den Bereich. Die Team-Abfrage bleibt damit dauerhaft abgeschaltet: Wer auf
«Team» wechselt, sieht für immer einen Leer-Zustand. FR-047 steht auf
`In Progress` und ist tatsächlich unerreichbar.

Dazu fehlen die beiden Achsen, die die Rangliste erst brauchbar machen: der
**Zeitraum** (FR-049 – ohne ihn sieht ein Neumitglied nie etwas anderes als die
Jahresbesten) und die **Säule** (FR-048 – die frühere Helfer-Auswertung ohne
eigenes Modul).

## Related Use Cases

- UC-020 Punktestand — der Ort **ohne** Vergleich (BR-084)
- UC-016 Punkteregeln — liefert die Säulen
- UC-008 Profil pflegen — dort wird die Teilnahme abgewählt (BR-091)
- UC-025 Transparenz-Seite — dieselbe Frage aus Sicht der Vereins-Gesundheit

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                          | Status vorher | Ziel        | Notizen                                        |
| ------ | ------------------------------ | ------------- | ----------- | ---------------------------------------------- |
| FR-046 | Vereins-Leaderboard            | In Progress   | Implemented | Steht; die eigene Position wird jetzt auch ausserhalb des Ausschnitts gezeigt |
| FR-047 | Team-Leaderboard               | In Progress   | Implemented | War **unerreichbar** – die Team-Id kam nie an   |
| FR-048 | Leaderboard nach Säule filtern | Open          | Implemented | `leaderboard_rows()` mit Säulen-Argument        |
| FR-049 | Zeitraum wählen                | Open          | Implemented | Woche, Monat, Saison, Gesamt                    |

### Business Rules

| ID     | Regel                                  | Status vorher | Ziel        | Notizen                                     |
| ------ | -------------------------------------- | ------------- | ----------- | ------------------------------------------- |
| BR-089 | Untere Ränge werden nie hervorgehoben  | Implemented   | Implemented | Bestätigt: keine Kennzeichnung, kein Appell |
| BR-090 | Die eigene Position ist immer sichtbar | **Missing**   | Implemented | Die eigene Zeile kommt mit, auch ausserhalb des Ausschnitts |
| BR-091 | Teilnahme ist abwählbar                | Implemented   | Implemented | Nachgemessen: kein Eintrag, Punkte laufen weiter |
| BR-092 | Ranglisten sind höchstens fünf Minuten alt | Partial   | Implemented | Live gerechnet und im Client fünf Minuten gehalten – nie älter |
| BR-093 | Keine Sortierung nach Wert von Menschen | Implemented  | Implemented | Es gibt keine solche Ansicht                 |

### Non-Functional Requirements

| ID      | Titel                            | Kategorie   | Betroffen | Notizen                                       |
| ------- | -------------------------------- | ----------- | --------- | --------------------------------------------- |
| NFR-022 | Kein Personenbezug in Kennzahlen | Privacy     | Ja        | Nur, wer zustimmt – und nur Summen             |
| NFR-001 | Antwortzeit                      | Performance | Ja        | Eine Abfrage statt einer Sicht über den ganzen Ledger |
| NFR-037 | Kein leerer Bildschirm           | Usability   | Ja        | A4 blendet die Team-Ansicht aus, statt sie leer zu zeigen |

---

## Current State

- `app/src/pages/LeaderboardPage.tsx`: Vereins- und Team-Umschalter, eigene
  Zeile hervorgehoben, Hinweis bei abgewählter Teilnahme.
- `app/src/hooks/useGamification.ts`: `useLeaderboard(scope, teamId?)`.
- `supabase/migrations/0037_points_overview.sql`: die Sicht `leaderboard`,
  seit dort mit eigenem Wächter.

---

## Missing Pieces

| #   | Was fehlt                                                        | Anforderung | Quelle    |
| --- | ---------------------------------------------------------------- | ----------- | --------- |
| 1   | Die Team-Rangliste ist unerreichbar: Die Seite übergibt keine Team-Id | FR-047  | Automated |
| 2   | Kein Zeitraum                                                     | FR-049      | Cross-reference |
| 3   | Kein Säulenfilter                                                 | FR-048      | Cross-reference |
| 4   | Die eigene Position fehlt, sobald sie ausserhalb des Ausschnitts liegt | BR-090  | Cross-reference |
| 5   | Keine Begrenzung auf die vorderen Ränge                           | A3          | Cross-reference |
| 6   | Die Team-Ansicht steht auch ohne Team zur Wahl                    | A4          | Automated |

---

## Implementation Guidelines

- **Bauteile:** `AppPage` mit `IonSegment` als `subToolbar`, `ListSection`,
  `SkeletonList`, `EmptyState`/`ErrorState`, `IonSelect` für Zeitraum und
  Säule. **Keine** neue Komponente.
- **Stil:** keine Inline-Styles; die eigene Zeile wird wie bisher über
  `color="light"` hervorgehoben.
- **Struktur:** Logik nach `app/src/lib/leaderboard.ts`, Migration
  `0039_leaderboard.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0039_leaderboard.sql`: `leaderboard_rows()` mit Zeitraum,
      Säule, Team und der eigenen Zeile; die Sicht `leaderboard` weicht
- [x] 2. `lib/leaderboard.ts`: Zeiträume, Aufbereitung der Zeilen
- [x] 3. `hooks/useGamification.ts`: `useLeaderboard` auf die Funktion
- [x] 4. `LeaderboardPage`: Zeitraum, Säule, A3 und A4
- [x] 5. Vier Sprachen
- [x] 6. Verhaltensprüfung gegen die laufende Datenbank
- [x] 7. `ai-code-review` und Behebung der Befunde
- [x] 8. Vitest
- [x] 9. Manueller Testplan `docs/test-plans/uc-022-leaderboard.md`
- [x] 10. Statusabgleich

---

## Umsetzung

- `supabase/migrations/0039_leaderboard.sql`
  - `leaderboard_rows(club, team, period, pillar, limit)` – **eine**
    Beschreibung der Rangfolge. Die Sicht `leaderboard` weicht: Zwei
    Beschreibungen derselben Sache sind in diesem Projekt schon zweimal
    auseinandergelaufen.
  - Zeiträume rollend (7 und 30 Tage), Saison über `season_label()`.
  - Die Säule kommt aus der Buchung, wenn sie eine trägt, sonst aus ihrer
    Regel – dieselbe Reihenfolge wie `bookingPillar()` in der App (UC-021).
  - BR-090: `where rank <= limit or member_id = v_self`. Eine Rangliste, in
    der man sich selbst nicht findet, beantwortet die einzige Frage nicht, die
    man an sie hat.
- `app/src/lib/leaderboard.ts`, `hooks/useGamification.ts`,
  `pages/LeaderboardPage.tsx`.

---

## Verhaltensprüfung gegen die laufende Datenbank

21 Prüfungen in einer Transaktion, die sich zum Schluss selbst zurückrollt.
Vier Mitglieder, ein Team, ein zweiter Verein.

| #     | Prüfung                                                       | Ergebnis                     |
| ----- | ------------------------------------------------------------- | ---------------------------- |
| 1     | Vereinsrangliste                                              | B 90, D 10, A 5 – eigene Zeile markiert |
| 2     | C mit abgewählter Teilnahme                                   | **0** (BR-091)               |
| 3–5   | Team-Rangliste                                                | 2 Zeilen, nur das Team        |
| 6–9   | Saison / Monat / Woche / Gesamt für B                         | 90 / 90 / **50** / **1089**   |
| 10–12 | Säule 3 für B, D nicht dabei, Säule 7 für die Buchung von Hand | 80 / 0 / 5                   |
| 13–14 | Obergrenze 1: zwei Zeilen, davon die eigene                   | **BR-090 hält**              |
| 15–16 | Dasselbe als **letztplatziertes** Mitglied                    | zwei Zeilen, findet sich selbst |
| 17–18 | C sieht die Rangliste, findet sich aber nicht darin           | 3 Zeilen / **0** (BR-091)    |
| 19    | Fremder Verein                                                | abgewiesen                   |
| 20–21 | `leaderboard_rows` für `anon` / Sicht `leaderboard` entfernt  | nein / ja                    |

---

## Befunde des Code-Reviews (`ai-code-review`)

| #  | Befund                                                                                                                              | Schwere | Erledigt in |
| -- | ------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| 1  | **Die Team-Rangliste war unerreichbar.** `useLeaderboard` erwartete eine Team-Id, die Seite übergab nur den Geltungsbereich – die Abfrage blieb dauerhaft abgeschaltet, und «Team» zeigte für immer einen Leer-Zustand. FR-047 stand auf `In Progress` und war tatsächlich unbenutzbar. | **Hoch** | `LeaderboardPage`, `useLeaderboard` |
| 2  | Die Anzeige-Begrenzung war eine feste 20 statt der Vereinseinstellung – A3 gab es damit nicht. | Mittel | `leaderboardLimit()` |
| 3  | Ein Mitglied in mehreren Teams sah immer nur das erste. | Mittel | Team-Auswahl in der Filterzeile |
| 4  | `ownRank()` war exportiert und wurde nirgends gelesen. Jetzt nennt die Fussnote den eigenen Rang – die Angabe, die BR-090 eigentlich meint. | Niedrig | `LeaderboardPage` |
| 5  | Der `TabsPage`-Test kannte den neuen Hook nicht und brach. | Niedrig | Mock nachgezogen |

Bestätigt hat der Review: Es gibt keine Kennzeichnung der letzten Plätze und
keinen Appell an schlecht Platzierte (BR-089), und keine Ansicht sortiert
Menschen nach ihrem Wert (BR-093).

---

## Tests

- `app/src/lib/leaderboard.test.ts` – 10 Tests: die Lücke vor der eigenen
  Zeile, der eigene Rang, die Anzeige-Begrenzung.
- Manueller Testplan: `docs/test-plans/uc-022-leaderboard.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                            | Impact | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------ | ------ | ----------- |
| 1   | **Die Sicht `leaderboard` und die neue Funktion wären zwei Definitionen derselben Rangfolge.** Genau die Art Doppelung, die in diesem Projekt schon zweimal auseinandergelaufen ist. Die Sicht weicht deshalb; die Funktion ist der einzige Weg. | High | Dev |
| 2   | BR-092 nennt «höchstens fünf Minuten alt» und setzt eine periodisch aktualisierte Auswertung voraus. Gerechnet wird live; das ist strenger als die Regel. Sollte die Last wachsen, tritt an dieselbe Stelle eine materialisierte Sicht – der Client merkt davon nichts. | Medium | Dev |
| 3   | A3 ist über `clubs.settings.leaderboard.topOnly` umgesetzt, ohne Angabe 20. Ein eigener Einstellungs-Schalter dafür fehlt weiterhin – wie bei `reminders.autoRemind` aus UC-015. Beide gehören in dieselbe Sammelaufgabe. | Medium | Stakeholder |
| 4   | «Monat» und «Woche» sind rollende Zeiträume (30 beziehungsweise 7 Tage) und keine Kalendermonate. Für «damit auch Neumitglieder sichtbar werden» ist das die nützlichere Lesart. | Low | Stakeholder |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-09 | Plan erstellt |
| 2026-09-09 | `0039` eingespielt, 21 Prüfungen gegen die laufende Datenbank |
| 2026-09-09 | Code-Review: fünf Befunde, behoben |
| 2026-09-09 | Tests, manueller Testplan, Statusabgleich – Plan abgeschlossen |

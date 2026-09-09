# Implementation Plan: UC-020 — Punktestand und «Nächste Punkte» einsehen

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                            |
| **Goal**          | Den eigenen Beitrag einordnen und erkennen, wo man als Nächstes gebraucht wird |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | Done                                                                |

## Overview

Das Dashboard ist die Seite, die ein Mitglied am häufigsten sieht – und die
einzige, die den Beitrag ohne Vergleich zeigt (BR-084). Es steht heute schon,
aber es hält keine seiner vier Zusagen ein: Es zeigt **nur** den Saisonstand
und nicht den Gesamtstand (BR-081), es zeigt **keine** Buchungen (Schritt 3),
und «Nächste Punkte» listet die drei bestbezahlten **Regeln** des Vereins statt
konkreter Beiträge – eine Regel «Training besucht: +10» sagt niemandem, welches
Training gemeint ist und ob es überhaupt eines gibt (Schritt 4, BR-083).

Dazu ein Befund, der nicht im Text der Spezifikation steht, aber ihre Regel
aushöhlt: **Die Punktebuchungen sind heute für jedes Vereinsmitglied lesbar.**
Nachgemessen – Mitglied A liest jede Buchung von B samt Notiztext, auch wenn B
die Rangliste abgewählt hat. BR-084 nennt den Rangvergleich «abwählbar»; solange
der Ledger offen liegt, ist die Abwahl eine Anzeigeeinstellung und kein Schutz.

## Related Use Cases

- UC-016 Punkteregeln — liefert Werte und Säulen
- UC-022 Leaderboard — der Ort, an dem Vergleich hingehört
- UC-017–019 Marktplatz, UC-011–014 Agenda — die Quellen der Vorschläge
- UC-025 Transparenz-Seite — dieselbe Frage aus Sicht der Vereins-Gesundheit
- UC-033 Beitrags-Profil — schärft die Vorschläge (BR-083), noch offen

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                    | Status vorher | Ziel        | Notizen                                              |
| ------ | ------------------------ | ------------- | ----------- | ---------------------------------------------------- |
| FR-041 | Punktehistorie einsehen  | In Progress   | Implemented | Vollständige Historie mit Filter (A2), lesbare Anlässe |
| FR-044 | Dashboard mit Punktestand | In Progress  | Implemented | Saison **und** Gesamt (BR-081)                        |
| FR-045 | «Nächste Punkte»         | In Progress   | Implemented | Konkrete Termine, Schichten und Aufgaben statt Regeln |

### Business Rules

| ID     | Regel                          | Status vorher | Ziel        | Notizen                                          |
| ------ | ------------------------------ | ------------- | ----------- | ------------------------------------------------ |
| BR-081 | Saison und Gesamt getrennt     | **Missing**   | Implemented | `my_points_summary()`                             |
| BR-082 | Saisonlogik ist einheitlich    | Partial       | Implemented | Nachgemessen: `season_label()` und `seasonLabel()` über ein Jahr hinweg gleich |
| BR-083 | Vorschläge sind persönlich     | **Missing**   | Partial     | Team und bereits übernommene Beiträge ja, Beitrags-Profil erst mit UC-033 |
| BR-084 | Keine Vergleichszahl im Dashboard | Partial    | Implemented | Das Dashboard vergleicht nicht – **und** der Ledger ist nicht mehr fremdlesbar |

### Non-Functional Requirements

| ID      | Titel                            | Kategorie   | Betroffen | Notizen                                        |
| ------- | -------------------------------- | ----------- | --------- | ---------------------------------------------- |
| NFR-022 | Kein Personenbezug in Kennzahlen | Privacy     | **Ja**    | Der Befund unten                                |
| NFR-001 | Antwortzeit                      | Performance | Ja        | Zwei Serverfunktionen statt fünf Client-Abfragen |
| NFR-037 | Kein leerer Bildschirm ohne Erklärung | Usability | Ja      | A1 und A4                                       |

---

## Current State

- `app/src/pages/DashboardPage.tsx`: Saisonstand als eine Kennzahl, «Nächste
  Punkte» als Regelliste, kommende Termine, News.
- `app/src/hooks/useGamification.ts`: `useMyPoints()` (nur laufende Saison),
  `usePointRules()`.
- `app/src/pages/ProfilePage.tsx`: die letzten 20 Buchungen – mit dem
  **Regelcode** als Überschrift, nicht mit dem Anlass.
- `supabase/migrations/0006_rls.sql`: `point_tx_read` = `is_club_member()`.

---

## Missing Pieces

| #   | Was fehlt                                                              | Anforderung     | Quelle          |
| --- | ---------------------------------------------------------------------- | --------------- | --------------- |
| 1   | Kein Gesamtstand seit Eintritt                                          | BR-081, FR-044  | Cross-reference |
| 2   | Keine Buchungen auf dem Dashboard                                       | Schritt 3       | Automated       |
| 3   | «Nächste Punkte» zeigt Regeln, keine Beiträge                           | Schritt 4, BR-083 | Automated     |
| 4   | Vorschläge sind nicht antippbar                                         | Schritt 5–6     | Automated       |
| 5   | Kein Willkommenshinweis ohne Buchungen                                  | A1              | Cross-reference |
| 6   | Keine vollständige Historie mit Filter                                  | A2, FR-041      | Cross-reference |
| 7   | Kein Hinweis, wenn nichts ansteht                                       | A4              | Cross-reference |
| 8   | Der Regelcode steht als Überschrift statt des Anlasses                  | FR-041          | Automated       |
| 9   | **Fremde Punktebuchungen sind lesbar**                                  | BR-084, NFR-022 | Automated       |

---

## Implementation Guidelines

- **Bauteile:** `AppPage`, `StatCard` in `.app-stat-row`, `ListSection`,
  `SkeletonStats`/`SkeletonList`, `EmptyState`/`ErrorState`, `IonSegment` als
  `subToolbar` für den Saisonfilter. Neu entsteht **keine** Komponente – nur
  eine Seite (`PointHistoryPage`), wie `InboxPage` gebaut.
- **Stil:** keine Inline-Styles, keine neue CSS-Klasse.
- **Struktur:** Logik nach `app/src/lib/points.ts`, Datenzugriff in
  `useGamification.ts`, Migration `0037_points_overview.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0037_points_overview.sql`: Ledger-Policy, Rangliste
      absichern, `my_points_summary()`, `next_contributions()`
- [x] 2. `lib/points.ts`: Anlass-Beschriftung, Filter nach Saison und Säule
- [x] 3. `hooks/useGamification.ts`: `useMyPointsSummary`, `useNextContributions`,
      `useAllPoints`
- [x] 4. `DashboardPage`: zwei Kennzahlen, echte Vorschläge, letzte Buchungen,
      A1 und A4
- [x] 5. `PointHistoryPage` samt Route und Einstieg (A2)
- [x] 6. Vier Sprachen, `npm run i18n:check`
- [x] 7. Verhaltensprüfung gegen die laufende Datenbank, inklusive BR-082
- [x] 8. `ai-code-review` und Behebung der Befunde
- [x] 9. Vitest
- [x] 10. Manueller Testplan `docs/test-plans/uc-020-punktestand.md`
- [x] 11. Statusabgleich

---

## Umsetzung

- `supabase/migrations/0037_points_overview.sql`
  - **Der Ledger gehört der Person, über die er geführt wird.** `point_tx_read`
    lässt nur noch die eigenen Buchungen und den Vorstand durch – der bucht von
    Hand und korrigiert (UC-021), ohne Einsicht ginge beides nicht.
  - Die **Rangliste** hing daran: Sie war eine `security_invoker`-Sicht und
    wäre mit der engeren Policy für jedes Mitglied verschwunden. Sie läuft
    jetzt mit den Rechten ihres Eigentümers und prüft die Vereinszugehörigkeit
    selbst – dieselbe Bauart wie `club_directory` in `0013`.
  - `my_points_summary()` – Saison **und** Gesamt aus **einer** Abfrage, damit
    die beiden Zahlen nie aus zwei Zeitpunkten stammen (BR-081).
  - `next_contributions()` – drei Quellen, eine Liste: der nächste unbeantwortete
    Termin, Schichten mit Unterdeckung, offene Aufgaben im Geltungsbereich.
    Was die Person schon hat, fällt weg (BR-083).
- `app/src/lib/points.ts` – Beschriftung, Säule, Saisons, Filter, Summe.
- `app/src/pages/DashboardPage.tsx`, `PointHistoryPage.tsx` (neu),
  `ProfilePage.tsx`, `hooks/useGamification.ts`.

---

## Verhaltensprüfung gegen die laufende Datenbank

21 Prüfungen in einer Transaktion, die sich zum Schluss selbst zurückrollt.
Zwei Mitglieder, ein Vorstand, ein Team, ein zweiter Verein.

| #     | Prüfung                                                     | Ergebnis                    |
| ----- | ----------------------------------------------------------- | --------------------------- |
| 1–2   | A liest eigene / **fremde** Buchungen                       | 3 / **0** (BR-084)          |
| 3     | Vorstand liest fremde Buchungen                             | 3 – für UC-021 nötig        |
| 4–6   | Rangliste trotz enger Policy: A sieht sich, Summe stimmt    | ja / 60                     |
| 5     | B mit abgewähltem Leaderboard                               | **0**                       |
| 7     | Rangliste **fremder** Vereine                               | **0**                       |
| 8     | `my_points_summary()`: Saison 60, **Gesamt 70**, 3 Buchungen | BR-081 hält                |
| 9–11  | `season_label()` am 31.5. und am 1.6.                       | Vorsaison / neue Saison      |
| 12    | Vorschläge für A                                            | 4 – Termin, Team-Termin, Aufgabe, Schicht |
| 12b   | Der **Schicht**-Vorschlag verlinkt den Termin               | ja – der Befund unten        |
| 13–14 | Team-Termin bei einem Mitglied ohne Team                    | **0**                        |
| 15–17 | Nach Zusage / volle Schicht / eigene Aufgabe                | jeweils **0** (BR-083)       |
| 18    | Obergrenze                                                  | wirkt                        |
| 19–20 | `my_points_summary` für `anon` / `next_contributions` für `authenticated` | nein / ja      |

---

## Befunde des Code-Reviews (`ai-code-review`)

Fünf Befunde. Der erste stand nicht im Text der Spezifikation, hebelt aber ihre
Regel aus; zwei weitere hätten den Use Case still gebrochen.

| #  | Befund                                                                                                                                             | Schwere | Erledigt in |
| -- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| 1  | **Jedes Mitglied konnte jede fremde Buchung lesen** – samt Notiztext, auch bei abgewähltem Leaderboard. Nachgemessen, bevor der Plan geschrieben war. BR-084 nennt den Rangvergleich «abwählbar»; solange der Ledger offen liegt, ist die Abwahl eine Anzeigeeinstellung. | **Hoch** | 0037 (Policy **und** Rangliste, denn die eine hing an der anderen) |
| 2  | **Der Schicht-Vorschlag verlinkte die Schicht-Id in die Agenda**, die nach Termin-Ids sucht. Der Tipp führte auf eine Seite ohne Treffer. | **Hoch** | 0037 (`e.id` statt `s.id`) |
| 3  | **A3 fand gar nicht statt.** Die App schaltet `refetchOnWindowFocus` global ab, damit sie im Zug bedienbar bleibt – damit aktualisierte sich der Stand nie von selbst. Für den Punktestand ist das jetzt gezielt zurückgenommen. | Mittel | `useMyPointsSummary()` |
| 4  | `usePointRules()` liefert nur **aktive** Regeln. Eine Buchung aus einer abgeschalteten Regel bekam in der Historie den **Regelcode** als Überschrift. | Mittel | `useRuleLabels()` |
| 5  | Ein Helfer-Event wurde zweimal vorgeschlagen: als Termin **ohne Punktwert** und als Schicht. Der Beitrag ist die Schicht. | Niedrig | 0037 |
| 6  | `useMyPoints().total` las niemand mehr – der Stand kommt aus `my_points_summary()`. | Niedrig | entfernt |

Ausserdem in der eigenen Prüfung gefunden: ein Platzhalter-CTE in
`next_contributions()`, der beim ersten Aufruf zur Laufzeit gescheitert wäre –
CTEs überleben ihre Anweisung nicht. Entfernt, bevor die Funktion je lief.

Und noch eine Warnung an die eigene Adresse: Prüfpunkt 16 der
Verhaltensprüfung war nach Befund 2 wirkungslos – er verglich eine Id, die es
dort nicht mehr gibt, und wäre still grün geblieben. Richtiggestellt.

---

## Tests

- `app/src/lib/points.test.ts` – 17 Tests, darunter drei, die `seasonLabel()`
  gegen die **nachgemessenen** Werte von `season_label()` halten (BR-082).
- Manueller Testplan: `docs/test-plans/uc-020-punktestand.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                       | Impact | Owner       |
| --- | ------------------------------------------------------------------------------------------------------ | ------ | ----------- |
| 1   | **Die Rangliste hängt am Ledger.** Sie ist eine `security_invoker`-Sicht; wird die Ledger-Policy enger, verschwindet sie für Mitglieder. Lösung: Die Sicht läuft künftig mit den Rechten ihres Eigentümers und prüft die Vereinszugehörigkeit selbst – dieselbe Bauart wie `club_directory`. | High | Dev |
| 2   | BR-083 nennt das Beitrags-Profil. Ohne UC-033 bleiben Team-Zugehörigkeit und bereits übernommene Beiträge die Kriterien; die Regel bleibt deshalb `Partial`. | Medium | Stakeholder |
| 3   | A3 «aktualisiert sich live» ist als Neuladen beim Zurückkehren in den Vordergrund umgesetzt, nicht als offene Verbindung. Eine Realtime-Verbindung je Mitglied wäre für den Nutzen zu teuer. | Low | Stakeholder |
| 4   | Der Vorschlag «nächster Termin» kennt den Punktwert nur, wenn am Termin eine Regel hinterlegt ist. Ohne Regel steht der Termin ohne Zahl da – bewusst, statt eine Null zu behaupten. | Low | Dev |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-09 | Plan erstellt; Befund 9 vorab gegen die laufende Datenbank belegt |
| 2026-09-09 | `0037` eingespielt, 21 Prüfungen gegen die laufende Datenbank |
| 2026-09-09 | Code-Review: sechs Befunde, behoben |
| 2026-09-09 | Tests, manueller Testplan, Statusabgleich – Plan abgeschlossen |

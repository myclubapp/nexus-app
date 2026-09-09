# Implementation Plan: UC-021 — Punkte manuell buchen oder korrigieren

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand (`admin`)                                                  |
| **Goal**          | Einen Beitrag würdigen, den die Automatik nicht erfasst, oder eine falsche Buchung ausgleichen |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | Done                                                                |

## Overview

Der Ausgleich für alles, was die Automatik nicht sieht – und die einzige Stelle,
an der ein negativer Wert entsteht. Beides verlangt Disziplin, und die
Spezifikation schreibt sie vor: **Der Ledger ist unveränderlich** (BR-085).
Eine falsche Buchung wird nicht korrigiert, sondern durch eine Gegenbuchung
ausgeglichen; die ursprüngliche bleibt stehen. Und jede manuelle Buchung nennt
ihren Anlass (BR-086) – sonst steht in einem Jahr eine Zahl da, die niemand
mehr erklären kann.

Auf der Schreibseite ist das die **letzte offene Lücke** des MVP-Schnitts.
`award_points()` besteht seit `0002`, bucht aber ausschliesslich über eine
Regel; einen Weg, ohne Regel zu buchen, gibt es nicht, und eine Gegenbuchung
kennt das System überhaupt nicht.

## Related Use Cases

- UC-020 Punktestand — zeigt, was hier entsteht; die Historie führt den Filter
- UC-016 Punkteregeln — liefert die Säulen
- UC-007 Mitglieder verwalten — der Ort, an dem gebucht wird
- UC-019 Aufgabe bestätigen — die automatische Gegenwelt: dort bucht eine Regel

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                  | Status vorher | Ziel        | Notizen                                       |
| ------ | ---------------------- | ------------- | ----------- | --------------------------------------------- |
| FR-042 | Manuelle Punktebuchung | Open          | Implemented | Einzeln und für mehrere Mitglieder (A3)        |
| FR-043 | Korrekturbuchung       | Open          | Implemented | Gegenbuchung mit Verweis, Original bleibt      |

### Business Rules

| ID     | Regel                          | Status vorher | Ziel        | Notizen                                         |
| ------ | ------------------------------ | ------------- | ----------- | ----------------------------------------------- |
| BR-085 | Der Ledger ist unveränderlich  | Partial       | Implemented | Kein `update`/`delete` für Clients – nachgemessen |
| BR-086 | Manuelle Buchung braucht Notiz | **Missing**   | Implemented | Als `check`-Constraint **und** in der Funktion   |
| BR-087 | Negative Werte nur als Korrektur | **Missing** | Implemented | `book_points_manually()` weist sie ab            |
| BR-088 | Keine Umgehung der Dedup-Regel | **Missing**   | Implemented | Die Gegenbuchung verweist auf die **Buchung**, nie auf deren Quelle |

### Non-Functional Requirements

| ID      | Titel                     | Kategorie | Betroffen | Notizen                                           |
| ------- | ------------------------- | --------- | --------- | ------------------------------------------------- |
| C-011   | Regeln in der Datenbank   | Design    | Ja        | Rolle, Notizpflicht und Vorzeichen prüft der Server |
| NFR-009 | Zustellung ohne Push      | Reliability | Ja      | Schritt 7 geht in die Inbox                        |
| NFR-022 | Kein Personenbezug in Kennzahlen | Privacy | Ja   | Der Vorstand sieht den Ledger, weil er ihn führt – seit `0037` sonst niemand |

---

## Current State

- `supabase/migrations/0002_points.sql`: `award_points()` – bucht **nur** über
  eine Regel; `point_tx_unique_source_idx` als Dedupe.
- `supabase/migrations/0037_points_overview.sql`: `point_tx_read` – der
  Vorstand sieht den Ledger, sonst nur die Person selbst.
- `app/src/pages/club/MemberPage.tsx`: Mitgliederverwaltung ohne Buchungsweg.
- `app/src/pages/PointHistoryPage.tsx`: die Historie – ohne Korrekturweg.

Kein Schritt des Hauptablaufs ist abgedeckt.

---

## Missing Pieces

| #   | Was fehlt                                                          | Anforderung     | Quelle          |
| --- | ------------------------------------------------------------------ | --------------- | --------------- |
| 1   | Kein Weg, ohne Regel zu buchen                                      | FR-042          | Automated       |
| 2   | Keine Gegenbuchung                                                  | FR-043, BR-085  | Automated       |
| 3   | Die Notizpflicht steht nirgends                                     | BR-086          | Cross-reference |
| 4   | Negative Werte sind ungeprüft                                       | BR-087          | Cross-reference |
| 5   | Die Säule einer manuellen Buchung hat keinen Ort                    | Schritt 2–3     | Cross-reference |
| 6   | Keine Sammelbuchung                                                 | A3              | Cross-reference |
| 7   | Keine Benachrichtigung über eine Gutschrift von Hand                | Schritt 7       | Cross-reference |

---

## Implementation Guidelines

- **Bauteile:** `FormModal` (Buchungsblatt), `ListSection`, `IonSelect` für die
  Säule, `useToast()`. Neu entsteht genau **eine** Komponente:
  `BookPointsModal`. Der Einstieg sitzt in `MemberPage` (einzeln und mehrfach)
  und in `PointHistoryPage` (Korrektur).
- **Stil:** keine Inline-Styles, keine neue CSS-Klasse.
- **Struktur:** Logik nach `app/src/lib/points.ts`, Datenzugriff in
  `useGamification.ts`, Migration `0038_manual_points.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0038_manual_points.sql`: Notiz-Constraint, `pillar`,
      `book_points_manually()`, `reverse_points()`
- [x] 2. `lib/points.ts`: `validateManualBooking()`, `bookingPillar()` erweitern
- [x] 3. `hooks/useGamification.ts`: `useBookPoints`, `useReversePoints`
- [x] 4. `components/BookPointsModal.tsx`
- [x] 5. `MemberPage`: Einstieg einzeln und für mehrere (A3)
- [x] 6. `PointHistoryPage`: Korrekturweg für den Vorstand (A1)
- [x] 7. Vier Sprachen
- [x] 8. Verhaltensprüfung gegen die laufende Datenbank
- [x] 9. `ai-code-review` und Behebung der Befunde
- [x] 10. Vitest
- [x] 11. Manueller Testplan `docs/test-plans/uc-021-punkte-buchen.md`
- [x] 12. Statusabgleich, inklusive `entity_model.md`

---

## Umsetzung

- `supabase/migrations/0038_manual_points.sql`
  - `point_transactions.pillar` – die Säule einer Buchung **ohne** Regel.
    Bei regelbasierten Buchungen bleibt sie leer; zwei Wege zu derselben
    Angabe wären ein Widerspruch in Wartestellung, hier sind es zwei Wege zu
    zwei verschiedenen Fällen.
  - Notizpflicht als `check`-Constraint für `manual` **und** `correction`
    (BR-086, C-011).
  - `book_points_manually()` – Rollenprüfung auf `admin`, positiver Wert
    (BR-087), bis zu 100 Mitglieder je Aufruf (A3), Zustellung mit Anlass.
  - `reverse_points()` – die Gegenbuchung. Das Original bleibt unverändert
    (BR-085); der Verweis zeigt auf die **Buchung**, nie auf deren Quelle
    (BR-088); die Gegenbuchung fällt in die Saison des Originals.
- `app/src/components/BookPointsModal.tsx` – **ein** Blatt für beide Wege: Sie
  teilen die Notizpflicht, und zwei Bauteile hiessen zwei Stellen, an denen
  diese Pflicht steht.
- `app/src/pages/club/MemberPage.tsx` – der Ledger im Mitgliedsblatt, der
  Einstieg einzeln und für mehrere.

---

## Verhaltensprüfung gegen die laufende Datenbank

28 Prüfungen in einer Transaktion, die sich zum Schluss selbst zurückrollt.

| #     | Prüfung                                                | Ergebnis                     |
| ----- | ------------------------------------------------------ | ---------------------------- |
| 1–2   | Trainer:in / Mitglied bucht                            | beide abgewiesen (A4)        |
| 3–6   | Ohne Notiz, negativer Wert, Säule 9, fremdes Mitglied  | alle abgewiesen              |
| 7     | Sammelbuchung                                          | 2 Mitglieder (A3)            |
| 8–12  | Quellentyp `manual`, Notiz getrimmt, buchende Person, Säule, Saison | alle gesetzt    |
| 13–14 | Zustellung mit Anlass an beide                         | ja                           |
| 15–17 | **`update` und `delete` treffen null Zeilen**, die Buchung steht unverändert | BR-085 hält |
| 18    | Korrektur ohne Begründung                              | abgewiesen                   |
| 19–22 | Gegenbuchung: −25, `correction`, Verweis auf die Buchung, Saison des Originals | wie gefordert |
| 21    | Original **unverändert**                               | 25 (BR-085)                  |
| 23    | Stand nach Korrektur                                   | 0                            |
| 24    | Meldung über die Korrektur                             | mit Begründung               |
| 25–26 | Zweite Korrektur derselben Buchung / Korrektur einer Korrektur | beide abgewiesen     |
| 27–28 | `book_points_manually` für `anon` / `reverse_points` für `authenticated` | nein / ja   |

---

## Befunde des Code-Reviews (`ai-code-review`)

Zwei davon fand die eigene Verhaltensprüfung, bevor der Review begann.

| #  | Befund                                                                                                                                        | Schwere | Erledigt in |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| 1  | **Der Dedupe-Index schützt nicht vor zwei Gegenbuchungen zur selben Buchung.** Er steht auf `(member_id, rule_code, source_id)`, und eine manuelle Buchung hat **kein** `rule_code` – in einem gewöhnlichen Unique-Index sind zwei NULL-Werte verschieden. Beide Korrekturen kamen durch. Dieselbe Falle wie bei `attendance` in `0025`. | **Hoch** | 0038 (ausdrückliche Prüfung) |
| 2  | **Die eigene Prüfung las «kein Fehler» als «durchgekommen».** Ein `update` ohne passende Policy trifft null Zeilen und wirft nichts. BR-085 hielt die ganze Zeit – die Prüfung war falsch, nicht der Code. Sie zählt jetzt Zeilen statt Ausnahmen. | Mittel | Prüfung |
| 3  | `useBookPoints()` erneuerte den Punktestand und die Rangliste, aber nicht die Historie-Abfrage. | Niedrig | `useGamification.ts` |

Bestätigt hat der Review: Die Gegenbuchung fällt in die Saison des Originals –
sonst stünde in der laufenden Saison ein Abzug für etwas, das in der letzten
passiert ist, und **beide** Stände wären falsch.

---

## Tests

- `app/src/lib/points.test.ts` – 26 Tests (neun neu für `validateManualBooking()`,
  `canCorrect()` und die Säule einer Buchung von Hand).
- `app/src/components/BookPointsModal.test.tsx` – 9 Tests.
- Manueller Testplan: `docs/test-plans/uc-021-punkte-buchen.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                       | Impact | Owner       |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **Die Säule hat im Ledger keinen Ort.** Das Entitätsmodell leitet sie über `rule_code` ab, eine manuelle Buchung hat aber keine Regel. Angenommen: eine eigene Spalte `pillar`, gefüllt bei manuellen Buchungen und Korrekturen, sonst leer und aus der Regel abgeleitet. Das Modell wird nachgeführt. | Medium | Stakeholder |
| 2   | BR-088 verlangt, dass eine verworfene Doppelbuchung nicht von Hand nachgeholt wird. Umgesetzt als: Die Gegenbuchung verweist auf die **Buchung**, nie auf deren Quelle – damit greift der Dedupe-Index weiterhin, und eine zweite Korrektur derselben Buchung ist ebenfalls ausgeschlossen. | Medium | Dev |
| 3   | Die Voraussetzung nennt ausdrücklich `admin`, nicht `trainer`. Anders als bei UC-017/UC-019 bleibt es deshalb beim Vorstand. | Low | Stakeholder |
| 4   | A3 nennt keine Obergrenze für die Sammelbuchung. Angenommen: 100 Mitglieder je Aufruf – genug für einen ganzen Verein, wenig genug für eine Transaktion. | Low | Dev |
| 5   | **Der Vorstand kann sich selbst Punkte buchen.** Die Spezifikation verbietet es nicht, und ein Verein mit nur einer Vorstandsperson käme sonst nie zu einer Gutschrift. Nachvollziehbar bleibt es über `created_by` und die Pflichtnotiz. Ob das genügt, entscheidet der Verein – nicht die App. | Medium | Stakeholder |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-09 | Plan erstellt |
| 2026-09-09 | `0038` eingespielt, 28 Prüfungen gegen die laufende Datenbank |
| 2026-09-09 | Code-Review: drei Befunde, behoben |
| 2026-09-09 | Tests, manueller Testplan, Statusabgleich – Plan abgeschlossen |

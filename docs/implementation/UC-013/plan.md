# Implementation Plan: UC-013 — Helfer-Schicht bestätigen

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand                                                            |
| **Goal**          | Den tatsächlich geleisteten Einsatz bestätigen und damit die Punkte auslösen |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | Done                                                                |

## Overview

Hier wird aus einer Eintragung ein Beitrag. Die Bestätigung ist der einzige
Weg, auf dem eine Schicht Punkte erzeugt (BR-045 aus UC-012), und sie hängt an
der **Schicht**, nicht am Anlass: Ihr Punktwert wird gebucht, und sie ist die
Quelle, über die der Ledger dedupliziert.

Die Buchungsseite entstand bereits in UC-012: Der Code-Review dort fand
`confirm_shift()` als dritte, übersehene Schreibstelle der Umschlüsselung und
stellte sie in `0026_shift_signup_hardening.sql` richtig. Dieser Use Case
ergänzt, was drumherum fehlte.

## Related Use Cases

- UC-011 Helfer-Event ausschreiben — legt Schichten und Punktwerte an
- UC-012 Helfer-Schicht übernehmen — die Eintragung, die hier bestätigt wird
- UC-021 Punkte manuell buchen — der Weg für die Korrektur (BR-052, A4)

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                       | Status      | Notizen                                                     |
| ------ | --------------------------- | ----------- | ----------------------------------------------------------- |
| FR-032 | Schicht bestätigen          | Implemented | `confirm_shift()`, `set_shift_absence()`, `ShiftRoster`      |
| FR-039 | Punktebuchung bei Teilnahme | In Progress | Für Schichten erfüllt; Termin und Aufgabe folgen             |

### Business Rules

| ID     | Regel                          | Status      | Notizen                                                                    |
| ------ | ------------------------------ | ----------- | -------------------------------------------------------------------------- |
| BR-049 | Ein Ledger für alles           | Implemented | Gebucht wird in `point_transactions`; ein Helferpunkte-Konto gibt es nicht |
| BR-050 | Punkte schreibt nur der Server | Implemented | `confirm_shift()` ist `security definer`; RLS erlaubt dem Client kein Insert |
| BR-051 | Keine Doppelbuchung            | Implemented | `source_id = shift_id` im Dedupe-Index; nachgemessen (A3)                  |
| BR-052 | Korrektur nur als Gegenbuchung | Implemented | Ein bestätigter Einsatz lässt sich weder zurückstufen noch löschen         |
| BR-053 | Nur Verantwortliche bestätigen | Implemented | `is_club_admin()` in **beiden** Funktionen und in `shift_roster()`         |

---

## Umsetzung

- `supabase/migrations/0027_shift_confirmation.sql`
  - `confirm_shift()` benachrichtigt die bestätigte Person (Schritt 5) und
    trägt A2 mit: Wer mitgeholfen hat, ohne eingetragen zu sein, wird
    eingetragen und bestätigt in einem Zug. Die Besetzungsgrenze gilt dort
    bewusst nicht – BR-046 schützt die Planung, nicht die Vergangenheit.
  - `set_shift_absence()` für A1: Status ohne Buchung. Die Funktion nimmt
    ausdrücklich **nur** `excused` und `absent`; `present` bleibt der
    Bestätigung vorbehalten, die dabei bucht.
  - `shift_roster()` für Schritt 2. Als Funktion, weil sie zugleich die Rolle
    prüft: Die Einsatzliste einer Schicht geht den Verein nichts an.
- `app/src/hooks/useShiftRoster.ts`, `app/src/components/ShiftRosterModal.tsx`
  (9 Tests), Einstieg in der Agenda unter «Vergangen».

---

## Verhaltensprüfung gegen die laufende Datenbank

Zwölf Prüfungen, in einer Transaktion, die sich selbst zurückrollt.

| # | Prüfung                                             | Ergebnis                       |
| - | ----------------------------------------------------- | ------------------------------ |
| 1 | Mitglied liest die Einsatzliste                       | abgewiesen                     |
| 2 | Mitglied bestätigt sich selbst                        | abgewiesen (BR-053)            |
| 3 | Einsatzliste für den Vorstand                         | ein Eintrag                    |
| 4 | Bestätigen                                            | **50** Punkte (BR-042)         |
| 5 | Zustellung an die bestätigte Person                   | genau **1** (Schritt 5)        |
| 6 | Status und bestätigende Person                        | `present`, gesetzt             |
| 7 | Zweite Bestätigung                                    | 0 Punkte (BR-051, A3)          |
| 8 | Zustellungen danach                                   | weiterhin 1, keine zweite      |
| 9 | Buchungen zur Schicht                                 | genau 1                        |
| 10| A2: kurzfristig Eingesprungene                        | eingetragen **und** bestätigt  |
| 11| Bestätigten Einsatz auf `absent` setzen               | abgewiesen (BR-052)            |
| 12| Über `set_shift_absence()` auf `present`              | abgewiesen                     |

Nach `0028` elf weitere Prüfungen:

| # | Prüfung                                                    | Ergebnis                     |
| - | ------------------------------------------------------------ | ---------------------------- |
| 1 | Nur-Dank, erste Bestätigung                                  | `points=0`, `booked=true`    |
| 2 | Nur-Dank, zweite Bestätigung                                 | `points=0`, `booked=false`   |
| 3 | Regel deaktiviert                                            | keine Buchung                |
| 4 | Status trotzdem                                              | `present` – die Anerkennung hängt nicht an der Zahl |
| 5 | Buchungen bei deaktivierter Regel                            | 0                            |
| 6 | Regel wieder aktiv                                           | 50 Punkte gebucht            |
| 7 | Zweite Schicht bei Grenze «1 pro Woche»                      | nicht gebucht (BR-065)       |
| 8 | Buchungen mit Punkten insgesamt                              | 1                            |
| 9 | Kandidaten für den Vorstand (A2)                             | vorhanden                    |
| 10| Bereits Eingetragene unter den Kandidaten                    | keine                        |
| 11| Mitglied liest die Kandidaten                                | abgewiesen                   |

---

## Befunde des Code-Reviews (`ai-code-review`)

Sechs Befunde, alle behoben. Drei davon betrafen den Ledger und stammen aus
derselben Wurzel: Weil die Schicht ihren Punktwert selbst trägt, wird direkt
gebucht statt über `award_points()` – und dabei ging verloren, was jene
Funktion nebenbei prüft.

| #  | Befund                                                                                                                                                | Schwere | Erledigt in |
| -- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| B1 | **Die Regel wurde nicht gelesen.** Ein Verein konnte Säule 3 abschalten oder `shift_done` deaktivieren – bestätigte Schichten buchten trotzdem weiter. Der Check-in auf denselben Verein buchte im selben Moment 0. | Mittel | 0028 |
| B2 | **Häufigkeitsgrenzen galten für Schichten gar nicht** (BR-065). Eine im Regel-UI gesetzte Grenze «1 pro Woche» blieb wirkungslos; drei Bestätigungen in einer Woche ergaben drei Buchungen. | Mittel | 0028 |
| B3 | **Der Rückgabewert war mehrdeutig.** `0` hiess «schon gebucht» **und** «mit dem Wert 0 gebucht». Im Nur-Dank-Modus meldete die App «bereits bestätigt», obwohl sie gerade zum ersten Mal bestätigt hatte. | Mittel | 0028 (`points` und `booked` getrennt) |
| B4 | **A2 war über die Oberfläche nicht erreichbar** – nur per HTTP-Aufruf, was der Testplan unfreiwillig selbst verriet. Der Status stand trotzdem auf `Implemented`. | Mittel | `shift_candidates()` + Auswahl im Blatt |
| B5 | **A1 «entschuldigt» war toter Code.** Die Funktion nahm den Status, die Übersetzung stand in allen vier Sprachen, das Blatt schickte immer `absent`. | Niedrig | Auswahl beim Vermerken |
| B6 | Lade- und Fehlerzustand des Blattes waren ungetestet – abgedeckt war nur «leer».                                                                        | Niedrig | zwei Tests  |

Der Review hat zugleich vier gezielt gestellte Fragen nachgeprüft und
bestätigt: die `found`-Semantik nach dem Upsert ist korrekt (jede
schreibende Anweisung setzt `FOUND` neu, die Bedingung und die Zuweisung
dazwischen fassen es nicht an), es entsteht genau **eine** Buchung je
(Mitglied, Schicht), die Rollenprüfung steht in allen drei Funktionen samt
`revoke`/`grant` nach Vorlage 0007, und A2s bewusste Abweichung von BR-046 ist
an drei Stellen begründet.

---

## Missing Pieces

| #   | Was noch fehlt                                                                | Anforderung | Quelle          |
| --- | ------------------------------------------------------------------------------- | ----------- | --------------- |
| 1   | A4 verweist auf die Korrekturbuchung – UC-021 ist noch nicht gebaut             | A4, BR-052  | Cross-reference |
| 2   | Bestätigen im Mehrfachzugriff: heute Person für Person, kein «alle bestätigen»   | Schritt 3   | Automated       |
| 3   | Die Zusammenfassung zählt nur die Buchungen **dieser** Sitzung, nicht die Schicht insgesamt | Schritt 6 | Automated |
| 4   | `confirm_task()` hat dieselbe Lücke wie B1 und B2: Sie bucht direkt und liest die Regel nicht. Gehört zu UC-019. | BR-065 | Cross-reference |

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                           | Impact | Owner |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----- |
| 1   | A2 umgeht die Besetzungsgrenze bewusst. Damit kann eine Schicht mehr bestätigte als benötigte Personen tragen – gewollt, aber ungeprüft im UI. | Low | Dev |
| 2   | Im Nur-Dank-Modus (Punktwert 0) unterbleibt die Zustellung. Der Einsatz gilt als bestätigt, die Person erfährt es aber nicht. Bewusst: Eine Nachricht «0 Punkte gutgeschrieben» wäre die Zahl, die V7 gerade vermeiden will. | Low | Stakeholder |

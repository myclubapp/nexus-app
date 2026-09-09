# Implementation Plan: UC-012 — Helfer-Schicht übernehmen

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                            |
| **Goal**          | Sich für eine konkrete Schicht eines Helfer-Events verbindlich eintragen |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | Done                                                                |

## Overview

Die Gegenseite zu UC-011: Was der Vorstand ausgeschrieben hat, wird hier
übernommen. Der Schritt ist klein, die Regeln sind es nicht — eine Schicht
nimmt nur so viele Personen auf, wie sie braucht (BR-046), das Austragen
bleibt jederzeit folgenlos (BR-047), und **Punkte entstehen hier nicht**
(BR-045). Sie kommen erst mit der Bestätigung in UC-013.

## Related Use Cases

- UC-011 Helfer-Event ausschreiben — die Gegenseite
- UC-013 Helfer-Schicht bestätigen — löst die Punkte aus
- UC-010 Zu- oder absagen — dieselbe Tabelle `attendance`, anderer Anlass

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                | User Story (Kurz)                                | Status      | Notizen                                    |
| ------ | -------------------- | ------------------------------------------------ | ----------- | ------------------------------------------ |
| FR-031 | Schicht übernehmen   | Für eine einzelne Schicht ein- und austragen     | Implemented | `take_shift()`, `release_shift()`, `ShiftList` |
| FR-030 | Helfer-Event         | Schichten mit Zeitfenster und Personalbedarf     | Implemented | UC-011; hier nur die Anzeige der Besetzung |

### Business Rules

| ID     | Regel                          | Status      | Notizen                                                        |
| ------ | ------------------------------ | ----------- | ---------------------------------------------------------------- |
| BR-045 | Punkte erst nach Bestätigung   | Implemented | `take_shift()` schreibt nur `registered`; nachgemessen: 0 Buchungen |
| BR-046 | Besetzung ist begrenzt         | Implemented | `for update` auf der Schicht **vor** der Zählung – die Sperre serialisiert das Wettrennen um den letzten Platz |
| BR-047 | Austragen ist jederzeit möglich| Implemented | Keine Sperrfrist, kein Abzug; Meldung an den Vorstand erst unter 48 Stunden |
| BR-048 | Freiwilligkeit                 | Implemented | `take_shift()` trägt immer nur `current_member_id()` ein – ein Weg, jemanden zuzuweisen, existiert nicht |

### Non-Functional Requirements

| ID      | Titel              | Kategorie | Trifft zu | Notizen                                                    |
| ------- | ------------------ | --------- | --------- | ---------------------------------------------------------- |
| NFR-011 | Mandantentrennung  | Security  | Ja        | Eintrag nur im eigenen Verein                              |
| NFR-034 | Punktequellen      | Maintainability | Ja  | Hier entsteht **keine** Punktequelle (BR-045)              |
| NFR-037 | Kein leerer Bildschirm | Usability | Ja     | Ein Event ohne freie Plätze sagt das, statt nichts zu zeigen |
| NFR-028 | Sprachparität      | Usability | Ja        | Auch Überschneidungs- und Vollmeldung                      |

---

## Current State

- `app/src/lib/shift.ts` liefert bereits `shiftCoverage()` und
  `shiftsOverlap()` — beides für diesen Use Case geschrieben, beides getestet.
- `useAgenda()` lädt Schichten und Anwesenheiten schon mit
  (`select('*, shifts:event_shifts(*), attendance(*)')`).
- `attendance` trägt `shift_id` seit 0003; die Policies erlauben dem Mitglied
  Einträge für sich selbst mit Status `registered`.

---

## Umsetzung

- `supabase/migrations/0025_shift_signup.sql`
  - **Umschlüsselung von `attendance`.** Surrogatschlüssel `id` plus
    eindeutiger Index `(event_id, member_id, shift_id) nulls not distinct`.
    Ohne `nulls not distinct` behandelt Postgres zwei NULL-Werte als
    verschieden – jemand könnte demselben Termin beliebig oft zusagen.
  - `check_in()` und `respond_to_event()` mitgezogen: Beide nannten
    `on conflict (event_id, member_id)` und wären zur Laufzeit gescheitert.
    Beide zielen jetzt auf die Zeile **ohne** Schicht, denn Zusage, Absage und
    Check-in gelten dem Termin als Ganzem.
  - `take_shift(p_shift_id, p_accept_overlap)` – Entwurf, Absage, vergangene
    Schicht und Besetzungsgrenze werden serverseitig geprüft.
  - `release_shift(p_shift_id)` – löscht immer nur die eigene Eintragung und
    meldet dem Vorstand die kurzfristige Unterdeckung.
- `app/src/hooks/useShifts.ts`: `useTakeShift`, `useReleaseShift`.
- `app/src/components/ShiftListModal.tsx`: `ShiftList` mit Warum, Schichten,
  Besetzung und der Rückfrage bei Überschneidung. 9 Tests.
- `app/src/pages/AgendaPage.tsx`: «Schichten ansehen» an jedem Helfer-Event,
  das ausgeschrieben und nicht abgesagt ist.

---

## Verhaltensprüfung gegen die laufende Datenbank

Zwölf Prüfungen über `supabase db query --linked`, in einer Transaktion, die
sich zum Schluss selbst zurückrollt. Zwei Mitglieder auf Zeit, damit sich
Besetzungsgrenze und Wettlauf überhaupt beobachten lassen.

| # | Prüfung                                                           | Ergebnis            |
| - | ------------------------------------------------------------------- | ------------------- |
| 1 | Schicht übernehmen                                                  | 1 von 1             |
| 2 | Überschneidung ohne Bestätigung                                     | abgewiesen (A4)     |
| 3 | Überschneidung mit Bestätigung                                      | eingetragen         |
| 4 | Anschliessende Schicht (Ende = Beginn)                              | ohne Rückfrage      |
| 5 | Zeilen für eine Person an einem Event                               | **3** (A3)          |
| 6 | Punktebuchungen durchs Eintragen                                    | 0 (BR-045)          |
| 7 | Volle Schicht durch eine zweite Person                              | abgewiesen (BR-046) |
| 8 | Freie Schicht durch dieselbe Person                                 | 2 von 2             |
| 9 | Austragen fünf Tage vorher                                          | keine Meldung       |
| 10| Austragen zwanzig Stunden vorher                                    | Meldung an Vorstand |
| 11| Punkteabzug durchs Austragen                                        | 0 (BR-047)          |
| 12| **Regression:** `respond_to_event()` nach dem Schlüsselwechsel       | genau **1** Zeile   |

Nach `0026` ein zweiter Durchgang mit zwölf weiteren Prüfungen, drei Mitgliedern
auf Zeit:

| # | Prüfung                                                              | Ergebnis                 |
| - | ---------------------------------------------------------------------- | ------------------------ |
| 1 | `confirm_shift()` je Schicht (BR-042)                                  | **50** und **100**       |
| 2 | Buchungen für zwei Schichten desselben Anlasses                        | **2**, nicht 1           |
| 3 | Die Termin-Zeile wird nicht mitbestätigt                               | bleibt `registered`      |
| 4 | Zweimal bestätigen                                                     | 0 (Dedupe greift)        |
| 5 | Direkter Insert auf eine Schicht                                       | abgewiesen               |
| 6 | Direkte Zusage zum Termin                                              | geht weiterhin           |
| 7 | Erfundene `shift_id`                                                   | Fremdschlüssel weist ab  |
| 8 | Platz über den Umweg `excused` zurückholen                             | abgewiesen               |
| 9 | Besetzung danach                                                       | 2 von 2, nie 3           |
| 10| `release_shift()` ohne eigene Eintragung                               | keine Meldung            |
| 11| dabei erzeugte Benachrichtigungen                                      | **0**                    |
| 12| Bestätigten Einsatz zurücknehmen                                       | abgewiesen               |

---

## Befunde des Code-Reviews (`ai-code-review`)

Der Plan hatte zwei der **drei** Schreibstellen auf `attendance` erfasst – und
die Anzeigeseite gar nicht. Zwölf Befunde, zehn behoben in
`0026_shift_signup_hardening.sql` und im Frontend.

| #   | Befund                                                                                                                                                        | Schwere | Erledigt in |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| H1  | **`confirm_shift()` war die dritte Schreibstelle.** Sie sucht ihre Zeile über `(event_id, member_id)`; davon gibt es seit 0025 mehrere, und `select … into` nimmt still eine beliebige. Das `update` setzte **alle** Zeilen der Person auf `present`, gebucht wurde mit `source_id = event_id`. | Hoch | 0026 |
| H2  | **BR-046 liess sich an der Funktion vorbei umgehen.** `attendance` ist unter PostgREST eine gewöhnliche Tabelle; die Policies prüften weder die Besetzungsgrenze noch, dass `shift_id` zum `event_id` gehört. Ein direkter POST auf eine volle – oder eine **fremde** – Schicht ging durch. | Hoch | 0026 |
| M2  | Der Teilnehmerstand zählte Schicht-Zeilen als Zusagen: zwei Personen mit je zwei Schichten ergaben «4 Zusagen». UC-015 hätte den Fehler geerbt.                 | Mittel | `AgendaPage.tsx` |
| M3  | «Meine Antwort» griff die erste beliebige Zeile ab – wer eine Schicht übernahm, sah einen gefüllten Zusagen-Knopf, ohne je zugesagt zu haben.                   | Mittel | `AgendaPage.tsx` |
| M4  | Die Ausnahme für Eingetragene prüfte nicht den **Status**: Wer sich auf `excused` setzte, gab den Platz frei, liess zwei nachrücken und holte ihn zurück – drei auf zwei Plätzen. | Mittel | 0026 |
| M5  | `release_shift()` meldete die Unterdeckung, auch wenn gar nichts ausgetragen wurde – in der Schleife aufgerufen ein Benachrichtigungs-Hebel gegen den Vorstand. | Mittel | 0026 |
| M6  | A1 verlangt «weist ab **und zeigt den aktuellen Stand**»; invalidiert wurde nur bei Erfolg.                                                                     | Mittel | `useShifts.ts` (`onSettled`) |
| M7  | 0025 hatte nebenbei das Check-in-Fenster verändert und dabei vier statt der in BR-054 genannten **drei** Stunden Ersatzdauer gesetzt – eine Änderung an UC-014 in einer UC-012-Migration. | Mittel | 0026 |
| M8  | `release_shift()` löschte auch **bestätigte** Zeilen: Die Buchung blieb (richtig, BR-047), der Beleg dazu verschwand.                                           | Mittel | 0026 |
| N1  | `shiftsOverlap()` war tot – A4 entscheidet der Server. Dieselbe Regel zweimal im Repo, eine Kopie ungenutzt.                                                     | Niedrig | entfernt |
| N3  | Vergangene Schichten wurden weiter zur Übernahme angeboten; erst der Server wies sie ab.                                                                        | Niedrig | `ShiftListModal.tsx` |
| N4  | Ein erneutes `take_shift()` stufte eine bereits bestätigte Zeile auf `registered` zurück.                                                                       | Niedrig | 0026 |

Nicht behoben: **N5** (kein `IonSpinner` im auslösenden Knopf) – das ist ein
repoweites Muster und gehört, wenn, in einem Zug geändert.

Der Review hat ausserdem bestätigt, was tragen sollte: BR-045 hält (keine
Punktequelle, kein Trigger auf `attendance`), die Grants sind gesetzt, die
Mandantentrennung greift, und eine **fremde** Eintragung kann niemand löschen.

---

## Missing Pieces

| #   | Was fehlt                                                                                                     | Anforderung | Quelle          |
| --- | ------------------------------------------------------------------------------------------------------------- | ----------- | --------------- |
| #   | Was noch fehlt                                                                                                | Anforderung | Quelle          |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------- | --------------- |
| 1   | Der **Marktplatz** zeigt das Helfer-Event nicht; Schritt 1 nennt beide Wege, umgesetzt ist die Agenda           | Schritt 1   | Cross-reference |
| 2   | Die Schicht erscheint nicht als eigener Eintrag in der **persönlichen Agenda** (Schritt 6, Postcondition)        | Schritt 6   | Automated       |
| 3   | Wer für eine Schicht eingetragen ist, sieht nicht, **wer sonst noch** eingetragen ist                            | —           | Spec-Lücke      |

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                   | Impact | Owner |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------ | ----- |
| 1   | Der Schlüsselwechsel bricht **beide** bestehenden Upserts: `check_in()` (0003) und `respond_to_event()` (0017) nennen `on conflict (event_id, member_id)`. Ohne passenden eindeutigen Index scheitern sie zur Laufzeit mit «no unique or exclusion constraint matching the ON CONFLICT specification». Beide sind in derselben Migration mitzuziehen — und danach gegen die Datenbank nachzumessen. | High | Dev |
| 2   | `confirm_shift()` bucht weiterhin den **Regelwert** statt `event_shifts.points` — offen aus UC-011, fällig in UC-013. | High | Dev |

# Implementation Plan: UC-037 — Beispielinhalte verwalten

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand                                                            |
| **Goal**          | Einen neu gegründeten Verein von Beginn weg mit Inhalten erleben und die Beispiele wieder loswerden, sobald echte Daten da sind |
| **Plan created**  | 2026-09-11                                                          |
| **Status**        | Done                                                                |

## Overview

**BR-165 ist der Satz, um den es geht: «Kein Bildschirm ohne Inhalt oder
Erklärung.»** Ein neu gegründeter Verein sieht heute fünf leere Tabs – und eine
leere Fläche erklärt nichts. Dieser Use Case füllt sie mit Beispielen und sorgt
zugleich dafür, dass niemand sie wieder aufräumen muss.

Die zweite Regel ist die, die das Ganze erträglich macht: **BR-162, «Beispiele
machen keine Arbeit.»** Sie verschwinden mit dem ersten eigenen Inhalt
derselben Art, nach Ablauf einer Frist oder mit **einer** Aktion. Einzeln
aufräumen muss sie niemand.

Und **BR-161, «Beispiele sind folgenlos»**, ist schon halb gebaut: `is_sample`
sperrt seit UC-009/UC-017 Zustellungen, Signale und Punktebuchungen. Was fehlt,
ist die andere Hälfte: Ein Mitglied kann eine Beispielaufgabe heute
**übernehmen** und einem Beispieltermin **zusagen** (A2).

## Related Use Cases

- UC-001 Verein gründen — hier entstehen die Beispiele
- UC-009/UC-017/UC-026 — Termine, Aufgaben und News, die als Beispiel angelegt werden
- UC-034 Vereinsidentität — der Ort, an dem «Beispielinhalte entfernen» steht

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                        | Status vorher | Ziel        | Notizen                                                    |
| ------ | ---------------------------- | ------------- | ----------- | ---------------------------------------------------------- |
| FR-134 | Beispielinhalte bei Gründung | Open          | Implemented | `seed_sample_content()` aus `create_club()`                 |
| FR-135 | Beispielinhalte sind erkennbar | Open        | Implemented | Ein Abzeichen an jeder Zeile und im Blatt (BR-160)          |
| FR-136 | Beispielinhalte entfernen    | Open          | Implemented | Eine Aktion in den Vereinseinstellungen                     |
| FR-137 | Beispielinhalte verfallen    | Open          | Implemented | Erster eigener Inhalt derselben Art **oder** Frist          |
| FR-138 | Beispielinhalte ohne Punkte  | Open          | Implemented | Bestand seit UC-017; hier kommt die Sperre beim Übernehmen dazu |
| FR-139 | Beispiel-Aufgaben            | Open          | Implemented | Drei, passend zur Vereinsart (BR-164)                       |
| FR-140 | Beispiel-Helfer-Event        | Open          | Implemented | Eines mit zwei Schichten                                    |
| FR-141 | Beispiel-Termine             | Open          | Implemented | Zwei in der Agenda                                          |
| FR-142 | Einführungs-News             | Open          | Implemented | Drei Beiträge; sie bleiben länger (A4)                      |
| FR-143 | Beiträge zur Orientierung    | Open          | Implemented | Punkte, Beitragen, Transparenz – die drei Beiträge          |
| FR-144 | Leere Zustände mit Angebot   | Open          | Implemented | `EmptyState` bekommt ein Handlungsangebot                   |
| FR-145 | Demo-Verein zum Ausprobieren | Open          | **Partial** | Mandant, Beitritt und nächtlicher Reset stehen; der öffentliche Weg dorthin ohne Konto nicht |

### Business Rules

| ID     | Regel                                | Ziel        | Notizen                                                      |
| ------ | ------------------------------------ | ----------- | ------------------------------------------------------------ |
| BR-160 | Immer gekennzeichnet                 | Implemented | Abzeichen in Liste **und** Blatt                              |
| BR-161 | Folgenlos                            | Implemented | Halb gebaut; hier kommen Übernehmen und Zusage dazu           |
| BR-162 | Machen keine Arbeit                  | Implemented | Drei Wege, keiner davon einzeln                               |
| BR-163 | Entfernen berührt keine Vereinsdaten | Implemented | Gelöscht wird ausschliesslich, was `is_sample` trägt          |
| BR-164 | Passen zur Vereinsart                | Implemented | Titel und Kategorien folgen `clubs.club_kind`                 |
| BR-165 | Kein Bildschirm ohne Erklärung       | Implemented | `EmptyState` mit Angebot – die Regel wird zur Komponente      |
| BR-166 | Der Demo-Verein ist getrennt         | Implemented | Eigener Mandant, nächtlicher Reset, keine Wirkung nach aussen |

### Non-Functional Requirements

| ID      | Titel                      | Kategorie | Betrifft? | Notizen                                          |
| ------- | -------------------------- | --------- | --------- | ------------------------------------------------ |
| NFR-011 | Serverseitige Berechtigung | Security  | Ja        | Entfernen und Übernehmen nur für den Vorstand     |
| NFR-012 | Punkte nur vom Server      | Security  | Ja        | Aus einem Beispiel entsteht **nie** eine Buchung  |
| NFR-028 | Vier Sprachen              | Usability | Ja        | Auch die Beispielinhalte – sie liegen in der Datenbank |

---

## Current State

- `events.is_sample` und `tasks.is_sample` bestehen seit `0015`/`0033` und
  sperren Zustellung, Erinnerung, Punktebuchung und Verbindungs-Quote.
- **`news` hat kein `is_sample`** – die Einführungs-Beiträge aus FR-142 hätten
  keine Kennzeichnung.
- **Niemand legt Beispiele an.** `create_club()` ruft nur `seed_point_rules()`.
- **Niemand räumt sie weg.** Weder Aktion noch Frist noch Übernahme.
- **A2 ist offen:** `claim_task()` und die Policy `attendance_write_self`
  prüfen `is_sample` nicht – eine Beispielaufgabe lässt sich übernehmen.
- `EmptyState` zeigt einen Satz und **kein** Handlungsangebot (FR-144).

---

## Missing Pieces

| #   | Was fehlt                                    | Anforderung     | Quelle          |
| --- | -------------------------------------------- | --------------- | --------------- |
| 1   | Keine Beispiele bei der Gründung             | FR-134, FR-139 bis FR-142 | Automated |
| 2   | `news` ohne `is_sample`                      | FR-142, A4      | Automated       |
| 3   | Kein Entfernen, kein Verfall, keine Übernahme | FR-136, FR-137, A3 | Automated    |
| 4   | Beispiele lassen sich übernehmen und zusagen | BR-161, A2      | Automated       |
| 5   | Keine Kennzeichnung im Client                | FR-135, BR-160  | Automated       |
| 6   | Leere Zustände ohne Angebot                  | FR-144, BR-165  | Automated       |
| 7   | Kein Demo-Verein                             | FR-145, A5      | Automated       |

---

## Implementation Guidelines

Verbindlich aus `docs/guidelines.md`:

- **Bauteile:** `EmptyState` wird **erweitert**, nicht ersetzt – es ist der Ort,
  an dem BR-165 zur Komponente wird. `IonBadge` für die Kennzeichnung,
  `IonAlert` für die Rückfrage vor dem Entfernen (§2, genau ein
  `role: 'cancel'`, der zweite `role: 'destructive'`).
- **Kein neues Bauteil** für die Kennzeichnung: ein Abzeichen, wie überall.
- **Entscheidungen** als reine Funktionen in `src/lib/sample.ts` (§9).
- **Struktur:** Migration `0053_sample_content.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0053_sample_content.sql`: `news.is_sample`, `clubs.is_demo`,
      `seed_sample_content()`, Aufruf aus `create_club()`, `drop_sample_content()`,
      `adopt_sample()`, `expire_sample_content()` + Cron, A2-Sperren,
      Demo-Verein mit `join_demo_club()` und `reset_demo_club()` + Cron
- [x] 2. `lib/sample.ts`: Kennzeichnung und was an einem Beispiel nicht geht
- [x] 3. `hooks/useSample.ts`: Entfernen und Übernehmen
- [x] 4. `EmptyState` mit Handlungsangebot (FR-144, BR-165)
- [x] 5. Kennzeichnung in Agenda, Marktplatz und Feed (FR-135)
- [x] 6. «Beispielinhalte entfernen» in den Vereinseinstellungen
- [x] 7. Vier Sprachen – `npm run i18n:check`
- [x] 8. Verhaltensprüfung gegen die verknüpfte Datenbank
- [x] 9. `ai-code-review` und Behebung der Befunde
- [x] 10. Vitest, mit einem Test, der **BR-163 festhält**
- [x] 11. Manueller Testplan `docs/test-plans/uc-037-beispielinhalte.md`
- [x] 12. Statusabgleich in `requirements.md`, UC-Dokument, `use_cases/README.md`
      und `entity_model.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                            | Impact   | Owner       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| 1   | **A5 verlangt einen Weg in den Demo-Verein «ohne einen Verein zu gründen».** Mandant, Beitritt und nächtlicher Reset sind gebaut; der Weg dorthin führt weiterhin über ein Konto. Ein wirklich anonymer Zugang wäre eine Anmeldung ohne Anmeldung – das ist eine Produktentscheidung, keine Implementierung. FR-145 bleibt deshalb `Partial`. | **High** | Stakeholder |
| 2   | Die Verfallsfrist ist nicht beziffert (offener Punkt 5 in `requirements.md`). Angenommen: **30 Tage**, in `clubs.settings.sample.days`.                                                                      | Medium   | Stakeholder |
| 3   | Der Wortlaut der Beispiele liegt in der **Datenbank**, nicht in den Sprachdateien – wie bei den Check-in-Fragen (UC-032). Er ist deutsch; ein Verein, der anders spricht, übernimmt oder löscht sie.        | Medium   | Stakeholder |
| 4   | A3 («als eigenen Inhalt übernehmen») macht aus einem Beispiel einen wirksamen Inhalt. Umgesetzt: `is_sample` fällt weg – Zustellung, Punkte und Quote gelten ab dann. Ausgeschrieben wird dabei **nicht** erneut. | Low      | Dev         |
| 5   | Der nächtliche Reset des Demo-Vereins löscht alles, was Besucher:innen angelegt haben. Das ist BR-166; es heisst aber auch, dass zwei Personen gleichzeitig einander die Daten ändern.                       | Low      | Stakeholder |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-11 | Plan erstellt |
| 2026-09-11 | `0053_sample_content.sql` eingespielt; Verhaltensprüfung mit **36 von 36** bestanden |
| 2026-09-11 | **Die Probe fand einen echten Defekt:** `claim_task()` prüfte `is_sample` nicht – eine Beispielaufgabe liess sich übernehmen (A2, BR-161). Dieselbe Sperre fehlte in `take_shift()`. Beide Rümpfe wortgleich übernommen, die Sperre davorgesetzt; danach 36 von 36 ohne Fehlschlag |
| 2026-09-11 | Die Erstbefüllung hängt in `create_club()` in einem eigenen Block: «Der Verein startet ohne Beispielinhalte; die Gründung selbst gilt trotzdem als erfolgreich» ist eine Failure Postcondition, keine Ausrede |
| 2026-09-11 | App-Seite: Abzeichen in Agenda, Marktplatz und Feed; `EmptyState` mit Handlungsangebot (BR-165 wird zur Komponente); Abschnitt «Beispielinhalte» in den Vereinseinstellungen; vier Sprachen, 1181 Schlüssel |
| 2026-09-11 | **Review-Befund:** `useAdoptSample()` stand exportiert da und wurde von nichts aufgerufen – A3 war unerreichbar. Ergänzt als Zeilenaktion in der Liste der verbliebenen Beispiele, wo alle drei Arten beisammenstehen |
| 2026-09-11 | Zweiter Befund: Das Blatt einer Beispielaufgabe bot weiterhin «Übernehmen» an und wäre in die Fehlermeldung des Servers gelaufen. Jetzt steht dort der Satz, warum es nicht geht |
| 2026-09-11 | Statusabgleich: FR-134 bis FR-144 auf `Implemented`, FR-145 auf `Partial`; UC-037 auf `Implemented` |

# Implementation Plan: UC-027 — Vereins-Puls freigeben

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand                                                            |
| **Goal**          | Den Mitgliedern regelmässig mitteilen, was passiert, woran gearbeitet wird und wo sie dabei sein können |
| **Plan created**  | 2026-09-10                                                          |
| **Status**        | Done                                                                |

## Overview

Der Puls ist der Gegenpol zu allem, was diese Sitzung an Aufrufen gebaut hat.
Helfergesuche, Aufgaben-Vorschläge, Erinnerungen – jede dieser Funktionen
bittet. Der Puls ist die Routine, die **erzählt**, und ohne ihn kippt die
Verbindungs-Quote (BR-116, K1).

Die entscheidende Regel ist BR-115: **Freigabe in zwei Minuten.** Der Entwurf
ist vollständig vorkomponiert; die Freigabe verlangt keine Texterstellung. Ein
Vorstand, der jede Woche einen Text schreiben müsste, schriebe ihn nach vier
Wochen nicht mehr – und genau das will K2 verhindern.

Dazu die zweite Hälfte von FR-070: Die Verbindungs-Quote wird seit `0018`
gezählt und **nirgends gezeigt**. Der Vorstand sieht bis heute nicht, ob sein
Verein nur bittet.

## Related Use Cases

- UC-011 Helfer-Event — dort bremst die Quote, die der Puls hebt
- UC-026 News — die andere Verbindungs-Nachricht
- UC-023 Fürsorge-Hinweis — dort entstehen die Symmetrie-Hinweise (FR-084)
- UC-030 Anliegen beantworten — liefert die dokumentierten Antworten (seit dem Nachtrag)
- UC-031 Sitzungs-Input — dieselbe Antwort, aus dem Gremium
- UC-034 Vereinsidentität — der Puls ist ein Modul; der Server muss das auch wissen
- UC-020 Punktestand — was im Puls **nachgeordnet** steht (BR-114)

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                    | Status vorher | Ziel        | Notizen                                              |
| ------ | ------------------------ | ------------- | ----------- | ---------------------------------------------------- |
| FR-082 | Vereins-Puls komponieren | Open          | Implemented | Drei Abschnitte aus Agenda, laufenden Aufgaben und Offenem. Die «dokumentierten Vorstandsantworten» kommen mit dem Nachtrag vom 2026-09-11 dazu – UC-030 und UC-031 stehen inzwischen |
| FR-083 | Vereins-Puls freigeben   | Open          | Implemented | Streichen, Einleitung, Freigeben – ohne Texterstellung |
| FR-084 | Symmetrie-Hinweis        | Open          | Implemented | Besteht seit UC-023 als Signal `connection_ratio` und `comms_pause`; hier kommt die **Zahl** dazu |
| FR-070 | Verbindungs-Quote        | In Progress   | Implemented | `connection_ratio()` – gezählt seit `0018`, ab jetzt auch sichtbar |

### Business Rules

| ID     | Regel                          | Ziel        | Notizen                                                   |
| ------ | ------------------------------ | ----------- | --------------------------------------------------------- |
| BR-113 | Drei Fragen, feste Reihenfolge | Implemented | Die Reihenfolge steht im Datenmodell, nicht in der Ansicht  |
| BR-114 | Punkte stehen nachgeordnet     | Implemented | Die Leseansicht zeigt sie **nach** den drei Abschnitten     |
| BR-115 | Freigabe in zwei Minuten       | Implemented | Vorkomponiert; die Einleitung ist freiwillig                |
| BR-116 | Verbindung vor Aufruf          | Implemented | Der Versand zählt als Verbindung und setzt den Zeitpunkt    |

---

## Current State

- `supabase/migrations/0018_helper_events.sql`: `club_message_log`,
  `last_connection_at()`, `call_is_muted()` – gezählt wird, gezeigt nichts.
- `supabase/migrations/0040_health_signals.sql`: die Symmetrie-Hinweise als
  Signal.
- `supabase/migrations/0043_publish_news.sql`: die andere Verbindungs-Nachricht.

Es gibt weder einen Puls noch eine Anzeige der Quote.

---

## Missing Pieces

| #   | Was fehlt                                                | Anforderung | Quelle          |
| --- | -------------------------------------------------------- | ----------- | --------------- |
| 1   | Kein Puls-Entwurf, keine Komposition                      | FR-082      | Automated       |
| 2   | Keine Freigabe, kein Streichen, keine Einleitung          | FR-083      | Automated       |
| 3   | Kein automatischer Versand nach 48 Stunden                | A1          | Cross-reference |
| 4   | Keine Leseansicht für Mitglieder                          | A4, BR-114  | Cross-reference |
| 5   | Die Verbindungs-Quote wird nirgends gezeigt               | FR-070      | Automated       |

---

## Implementation Guidelines

- **Bauteile:** `AppPage`, `ListSection`, `IonCheckbox` zum Streichen,
  `IonTextarea` für die Einleitung, `StatCard` für die Quote. Neu entstehen
  **zwei Seiten** (`PulsePage` für den Vorstand, `PulseReadPage` für
  Mitglieder), keine neue Komponente.
- **Struktur:** Logik nach `app/src/lib/pulse.ts`, Datenzugriff in
  `app/src/hooks/usePulse.ts`, Migration `0044_club_pulse.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0044_club_pulse.sql`: `club_pulses`, `compose_club_pulse()`,
      `release_pulse()`, `discard_pulse()`, `connection_ratio()`, Cron
- [x] 2. `lib/pulse.ts`: Abschnitte, Auswahl, Quote
- [x] 3. `hooks/usePulse.ts`
- [x] 4. `pages/PulsePage.tsx` (Vorstand) und `pages/PulseReadPage.tsx` (alle)
- [x] 5. Einstieg in `ClubAdminLinks`, Quote sichtbar machen
- [x] 6. Vier Sprachen
- [x] 7. Verhaltensprüfung gegen die laufende Datenbank
- [x] 8. `ai-code-review` und Behebung der Befunde
- [x] 9. Vitest
- [x] 10. Manueller Testplan `docs/test-plans/uc-027-vereins-puls.md`
- [x] 11. Statusabgleich, inklusive `entity_model.md`

### Nachtrag vom 2026-09-11

Drei Befunde aus der Durchsicht, bevor der Use Case geschlossen wird:

- [x] 12. **Der Modul-Riegel fehlt am Server.** UC-034 macht den Puls schaltbar,
      `ClubAdminLinks` blendet den Weg aus – aber `compose_club_pulse()` legt
      auch für einen Verein mit abgeschaltetem Modul jede Woche einen Entwurf an
      und benachrichtigt den ganzen Vorstand darüber. Dasselbe gilt für
      `auto_release_pulses()`, das einen offenen Entwurf auch dann versendet,
      wenn das Modul inzwischen aus ist. Guard wie in `0052`.
- [x] 13. **Schritt 1 nennt drei Quellen, gebaut sind zwei.** Die
      «dokumentierten Vorstandsantworten der letzten zwei Wochen» fehlten,
      weil es sie beim Bau nicht gab. Inzwischen gibt es sie – zweimal:
      `answer_voice_note()` (UC-030) und `answer_meeting_input()` (UC-031).
      **Was in den Puls darf, ist nur die Antwort, die der Vorstand selbst
      veröffentlicht hat** (FR-100): Ein eingereichtes Anliegen gehört der
      Person, die es geschrieben hat, und niemals in eine Wochennachricht an
      alle. Erkennbar wird das am `news.source = 'board'`.
- [x] 14. **FR-100 ist nur halb gebaut.** Für Sprachmemos publiziert der Client
      die News in einem zweiten Aufruf – schlägt die Antwort danach fehl, steht
      die News trotzdem im Feed. Für Sitzungs-Inputs gibt es die Möglichkeit gar
      nicht; `meeting_inputs.published_news_id` steht seit `0049` da und wird
      von niemandem geschrieben. Beides wird eine serverseitige Option der
      Antwort.
- [x] 15. **Leere Zustände ohne Angebot.** Seit UC-037 verlangt BR-165 zu jedem
      leeren Zustand einen nächsten Schritt; `pulse.noDraft` und `pulse.gone`
      haben keinen.
- [x] 16. Verhaltensprüfung, `ai-code-review`, Vitest, Testplan und
      Statusabgleich für den Nachtrag

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                               | Impact | Owner       |
| --- | -------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | ~~**«Woran wir arbeiten» hat noch keine echte Quelle.**~~ **Erledigt am 2026-09-11.** Die Quelle gibt es jetzt: eine vom Vorstand publizierte Antwort (FR-100, `news.source = 'board'`). Die laufenden Aufgaben bleiben daneben stehen. **Nicht** in den Puls kommt das eingereichte Anliegen – es gehört der Person, die es geschrieben hat. | **High** | Stakeholder |
| 2   | A2 sagt: Der Zeitpunkt des letzten Pulses bleibt beim Verwerfen unverändert «und fliesst in die Symmetrie-Prüfung ein». Umgesetzt: Verwerfen ändert weder `club_message_log` noch den Zeitpunkt – die Quote kippt also, wenn ein Verein jede Woche verwirft. Das ist die Absicht. | Medium | Stakeholder |
| 3   | A1 verlangt automatischen Versand nach 48 Stunden. Angenommen: `clubs.settings.pulse.autoRelease`; ohne Angabe **aus**. Ein Verein, der nichts einstellt, versendet nichts von selbst. | Medium | Stakeholder |
| 5   | Der News-Titel «Aus dem Vorstand» kommt vom Client, also in der Sprache der publizierenden Person. So ist es bei jeder News, die jemand schreibt; ein serverseitig übersetzter Titel wäre der einzige Text dieser App, der nicht über i18next liefe. | Low | Stakeholder |
| 6   | `supabase.rpc()` prüft in diesem Projekt die Parameternamen **nicht** – ein Tippfehler fällt erst in der Verhaltensprüfung auf. `database.generated.ts` wird vom parallelen Strang gepflegt und hier bewusst nicht neu erzeugt. | Medium | Dev |
| 4   | BR-115 nennt zwei Minuten. Nicht messbar in einem Test – geprüft wird stattdessen, dass der Entwurf **vollständig vorkomponiert** ankommt und die Freigabe ohne jede Eingabe möglich ist. | Low | Dev |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-10 | Plan erstellt |
| 2026-09-10 | Migration `0044_club_pulse.sql`, `lib/pulse.ts`, `hooks/usePulse.ts`, `PulsePage`, `PulseReadPage`, Einstieg in `ClubAdminLinks`, vier Sprachen, Vitest und Testplan – die Abschlussschritte blieben offen |
| 2026-09-11 | Durchsicht vor dem Abschluss: drei Befunde (Modul-Riegel fehlt am Server, dritte Quelle aus Schritt 1 fehlt, FR-100 nur halb gebaut) plus zwei leere Zustände ohne Angebot und `PulseItem.kind` ohne Verwendung |
| 2026-09-11 | Migration `0055_pulse_sources.sql`: Modul-Riegel in `compose_club_pulse()` und `auto_release_pulses()`, `news.source = 'board'`, `publish_news()` kennt die Herkunft, `answer_voice_note()` und `answer_meeting_input()` publizieren die Antwort **in derselben Transaktion** und schreiben `published_news_id`, «Woran wir arbeiten» nimmt die publizierten Antworten der letzten vierzehn Tage auf |
| 2026-09-11 | Verhaltensprüfung gegen die verknüpfte Datenbank: **36 von 36 Prüfungen bestanden**. Darunter: Der eingereichte Text steht nirgends im Puls, eine Ablehnung wird nie publiziert, und ohne Modul entsteht weder Entwurf noch Meldung |
| 2026-09-11 | App: `publishedTitle()` in `lib/news.ts` als gemeinsame Regel beider Blätter, «Entscheid als News publizieren» im Sitzungs-Input, der zweistufige Publikationsweg im Anliegen entfernt, die Art eines Eintrags im Puls sichtbar, beide leeren Zustände mit Angebot (BR-165) |
| 2026-09-11 | `typecheck`, `lint` (0 Fehler), `i18n:check` (4 Sprachen, 1203 Schlüssel) und die Testsuite (64 Dateien, 769 Tests) grün; Testplan um TC-008 bis TC-010 ergänzt; Statusabgleich: FR-070/082/083/084 `Implemented`, UC-027 `Implemented`, `CLUB_PULSE` ins Entitätsmodell aufgenommen |

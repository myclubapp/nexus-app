# Implementation Plan: UC-027 — Vereins-Puls freigeben

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand                                                            |
| **Goal**          | Den Mitgliedern regelmässig mitteilen, was passiert, woran gearbeitet wird und wo sie dabei sein können |
| **Plan created**  | 2026-09-10                                                          |
| **Status**        | In Progress                                                         |

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
- UC-030 Anliegen beantworten — liefert später die dokumentierten Antworten
- UC-020 Punktestand — was im Puls **nachgeordnet** steht (BR-114)

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                    | Status vorher | Ziel        | Notizen                                              |
| ------ | ------------------------ | ------------- | ----------- | ---------------------------------------------------- |
| FR-082 | Vereins-Puls komponieren | Open          | **Partial** | Drei Abschnitte aus Agenda, laufenden Aufgaben und Offenem. «Dokumentierte Vorstandsantworten» brauchen UC-030 |
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

- [ ] 1. Migration `0044_club_pulse.sql`: `club_pulses`, `compose_club_pulse()`,
      `release_pulse()`, `discard_pulse()`, `connection_ratio()`, Cron
- [ ] 2. `lib/pulse.ts`: Abschnitte, Auswahl, Quote
- [ ] 3. `hooks/usePulse.ts`
- [ ] 4. `pages/PulsePage.tsx` (Vorstand) und `pages/PulseReadPage.tsx` (alle)
- [ ] 5. Einstieg in `ClubAdminLinks`, Quote sichtbar machen
- [ ] 6. Vier Sprachen
- [ ] 7. Verhaltensprüfung gegen die laufende Datenbank
- [ ] 8. `ai-code-review` und Behebung der Befunde
- [ ] 9. Vitest
- [ ] 10. Manueller Testplan `docs/test-plans/uc-027-vereins-puls.md`
- [ ] 11. Statusabgleich, inklusive `entity_model.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                               | Impact | Owner       |
| --- | -------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **«Woran wir arbeiten» hat noch keine echte Quelle.** Die Spezifikation nennt dokumentierte Vorstandsantworten (UC-030). Angenommen: bis dahin die **laufenden** Aufgaben – übernommen oder eingereicht, also das, woran gerade jemand arbeitet. Das ist inhaltlich nah und ehrlich; FR-082 bleibt `Partial`. | **High** | Stakeholder |
| 2   | A2 sagt: Der Zeitpunkt des letzten Pulses bleibt beim Verwerfen unverändert «und fliesst in die Symmetrie-Prüfung ein». Umgesetzt: Verwerfen ändert weder `club_message_log` noch den Zeitpunkt – die Quote kippt also, wenn ein Verein jede Woche verwirft. Das ist die Absicht. | Medium | Stakeholder |
| 3   | A1 verlangt automatischen Versand nach 48 Stunden. Angenommen: `clubs.settings.pulse.autoRelease`; ohne Angabe **aus**. Ein Verein, der nichts einstellt, versendet nichts von selbst. | Medium | Stakeholder |
| 4   | BR-115 nennt zwei Minuten. Nicht messbar in einem Test – geprüft wird stattdessen, dass der Entwurf **vollständig vorkomponiert** ankommt und die Freigabe ohne jede Eingabe möglich ist. | Low | Dev |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-10 | Plan erstellt |

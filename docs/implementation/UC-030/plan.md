# Implementation Plan: UC-030 — Anliegen beantworten

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand (und jede adressierte Empfänger:in)                        |
| **Goal**          | Auf ein eingegangenes Anliegen sichtbar reagieren, auch wenn es anonym eingereicht wurde |
| **Plan created**  | 2026-09-10                                                          |
| **Status**        | Done                                                                |

## Overview

**BR-128 ist der Satz, um den es geht: «Speak-up braucht Listen-up.»** Ein
Anliegen kann abgelehnt werden, aber nicht versanden. UC-029 hat die eine
Hälfte gebaut – ohne diese hier wäre sie ein Briefkasten ohne Leerung.

Der schwierigste Teil ist BR-129: **Antwort trotz Anonymität.** Der Rückkanal
darf nie über die Identität laufen, sondern ausschliesslich über das lokale
Ticket. Das Schema aus `0046` hält dafür bereits den Prüfwert bereit; hier
kommt der Weg dazu, auf dem eine Person ihre Antwort mit dem Ticket abholt –
ohne sich dabei zu erkennen zu geben.

## Related Use Cases

- UC-029 Anliegen erfassen — liefert, was hier beantwortet wird
- UC-017 Aufgabe ausschreiben — A3 wandelt ein Anliegen in eine Aufgabe
- UC-026 News — A2 macht die Antwort öffentlich
- UC-023 Fürsorge-Hinweis — A5 erzeugt das Vorstands-Signal

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                            | Status vorher | Ziel        | Notizen                                          |
| ------ | -------------------------------- | ------------- | ----------- | ------------------------------------------------ |
| FR-091 | Anonymer Zwei-Weg-Faden          | Open          | Implemented | Abholen und Nachfassen über das Ticket            |
| FR-092 | Anliegen triagieren              | Open          | Implemented | Ein Tipp je Statuswechsel                        |
| FR-093 | Anliegen in Aufgabe wandeln      | Open          | Implemented | A3, mit Verknüpfung zurück                        |
| FR-094 | Anmahnung unbeantworteter Anliegen | Open        | Implemented | A5 als Signal `inputs_unanswered` – der vierte Typ aus `0040`, der bisher keine Datenquelle hatte |
| FR-099 | Dokumentierte Antwort            | Open          | Implemented | Antwort, Datum und antwortende Person             |
| FR-100 | «Aus dem Vorstand»               | Open          | Implemented | A2 über `publish_news()` aus UC-026               |

### Business Rules

| ID     | Regel                            | Ziel        | Notizen                                                       |
| ------ | -------------------------------- | ----------- | ------------------------------------------------------------- |
| BR-128 | Speak-up braucht Listen-up       | Implemented | Jeder Endstatus verlangt eine Antwort – auch die Ablehnung      |
| BR-129 | Antwort trotz Anonymität         | Implemented | Der Rückkanal läuft über den Prüfwert des Tickets, nie über eine Person |
| BR-130 | Genau zwei Folge-Artefakte       | **Partial** | Die Aufgabe ist gebaut; die Ämter-Aktion hat kein Modul (nach dem MVP) |
| BR-131 | Unbeantwortetes wird sichtbar    | Implemented | Dasselbe Signal-Verfahren wie jedes andere (UC-023)             |

---

## Current State

- `supabase/migrations/0046_voice_notes.sql`: `voice_notes` mit `status`,
  `response`, `anon_token_hash`, `converted_task_id` – alle Felder stehen,
  **keines wird geschrieben**.
- `supabase/migrations/0040_health_signals.sql`: der Signaltyp
  `inputs_unanswered` steht im Constraint und hatte bisher keine Quelle.
- `app/src/pages/VoicePage.tsx`: die Leseseite.

---

## Missing Pieces

| #   | Was fehlt                                        | Anforderung | Quelle          |
| --- | ------------------------------------------------ | ----------- | --------------- |
| 1   | Keine Antwort, kein Statuswechsel                 | FR-092, FR-099 | Automated    |
| 2   | Kein Rückkanal für anonyme Anliegen               | FR-091, BR-129 | Cross-reference |
| 3   | Kein Nachfassen                                   | FR-091      | Cross-reference |
| 4   | Keine Umwandlung in eine Aufgabe                  | FR-093, A3  | Cross-reference |
| 5   | Kein «Als News publizieren»                       | FR-100, A2  | Cross-reference |
| 6   | Keine Anmahnung                                   | FR-094, A5  | Cross-reference |
| 7   | Kein Weg für A6 (Missbrauch melden)               | A6          | Cross-reference |

---

## Implementation Guidelines

- **Bauteile:** `FormModal` für die Antwort, `ListSection`, `IonSegment` für
  den Status. **Keine** neue Komponente – die `VoicePage` bekommt die
  Antwortseite.
- **Struktur:** Ergänzungen in `lib/voice.ts` und `hooks/useVoice.ts`,
  Migration `0047_answer_voice_notes.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0047_answer_voice_notes.sql`: `answer_voice_note()`,
      `set_note_status()`, `claim_anon_thread()`, `follow_up_anon()`,
      `convert_note_to_task()`, `flag_note()`, Anmahnung
- [x] 2. `lib/voice.ts`: Endstatus, Antwortpflicht
- [x] 3. `hooks/useVoice.ts`: Antworten, Status, Rückkanal
- [x] 4. `VoicePage`: die Empfängerseite und der anonyme Faden
- [x] 5. Vier Sprachen
- [x] 6. Verhaltensprüfung gegen die laufende Datenbank
- [x] 7. `ai-code-review` und Behebung der Befunde
- [x] 8. Vitest
- [x] 9. Manueller Testplan `docs/test-plans/uc-030-anliegen-beantworten.md`
- [x] 10. Statusabgleich

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                            | Impact | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------ | ------ | ----------- |
| 1   | **Der anonyme Rückkanal darf nicht über die Anmeldung laufen.** Umgesetzt: Die Abholung nimmt **nur** das Ticket entgegen und prüft dessen Wert – wer angemeldet ist, spielt keine Rolle. Damit taucht die Identität an keiner Stelle auf. | **High** | Dev |
| 2   | A5 nennt «die im Verein gesetzte Frist» ohne Zahl. Angenommen: 14 Tage, in `clubs.settings.voice.answerDays`. | Medium | Stakeholder |
| 3   | A6 «legt es einer im Verein bestimmten Stelle vor» – eine solche Stelle gibt es im Datenmodell nicht. Umgesetzt: Das Anliegen wird als gemeldet gekennzeichnet und verschwindet aus der Inbox; sichtbar bleibt es dem Vorstand. | Medium | Stakeholder |
| 4   | BR-130 nennt zwei Folge-Artefakte. Die Ämter-Aktion hat kein Modul (nach dem MVP), die Aufgabe ist gebaut – die Regel bleibt deshalb `Partial`. | Low | Stakeholder |
| 5   | Beim Nachfassen im anonymen Faden entsteht **kein** neues Anliegen, sondern der Text wird angehängt. Sonst zählte jede Rückfrage gegen das Kontingent und der Faden zerfiele in Einzelstücke. | Low | Dev |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-10 | Plan erstellt |
| 2026-09-10 | `0047_answer_voice_notes.sql` eingespielt; Verhaltensprüfung gegen die verknüpfte Datenbank mit 27 von 27 Prüfungen bestanden – darunter die beiden, auf die es ankommt: Zum anonymen Anliegen wird **niemand** benachrichtigt, und der Faden lässt sich mit dem Ticket von **jeder** angemeldeten Person abholen (BR-129) |
| 2026-09-10 | App-Seite: `NoteAnswerModal` als Antwortblatt, `VoicePage` in Eingang / eigene / gemeldete / anonyme Fäden geteilt; vier Sprachen, 921 Schlüssel |
| 2026-09-10 | Review-Befunde behoben: (a) veralteter Abzug des Anliegens im Seitenzustand – das Segment sprang nach dem Statuswechsel zurück, jetzt hält die Seite nur die Kennung; (b) Wiederholung nach einem Teilfehler hätte eine zweite News erzeugt und die Umwandlung gegen BR-130 laufen lassen – zwei Merker verhindern das; (c) «Als News publizieren» stand jeder Empfänger:in offen, A2 nennt den Vorstand; (d) ein gesperrter Schalter ohne Grund ersetzt durch den Satz, der ihn erklärt |
| 2026-09-10 | Statusabgleich: FR-091 bis FR-094, FR-099 und FR-100 auf `Implemented`; UC-030 auf `Implemented`; `VOICE_NOTE_MESSAGE` im Entitätsmodell |

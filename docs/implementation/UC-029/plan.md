# Implementation Plan: UC-029 — Sprachmemo aufnehmen und adressieren

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                            |
| **Goal**          | Ein Anliegen sprechen statt tippen und es an die richtige Stelle bringen – oder für sich behalten |
| **Plan created**  | 2026-09-10                                                          |
| **Status**        | Done (FR-085 bleibt bewusst offen)                                  |

## Overview

Der Kern dieses Use Case ist nicht das Mikrofon, sondern **BR-122**:
«Anonymität ist eine Eigenschaft des Schemas.» Für ein anonymes Anliegen darf
keine Spalte existieren, die die Autorschaft aufnehmen **könnte** – nicht eine
Berechtigungsregel, die sie verbirgt. Das ist eine Zusage, die man in der
Tabellendefinition sehen muss, und sie ist vollständig baubar.

Ebenso baubar: die strikte Privatheit von Selbstreflexion und Trainer-Logbuch
(BR-123), die Adressierung an Person, Rolle oder Vorstand, das Kontingent und
die Zustellung.

**Nicht** baubar ist der Weg vom Mikrofon zum Text. Eine Transkription auf dem
Gerät verlangt ein Modell im Paket; die Browser-Schnittstelle `SpeechRecognition`
schickt das Audio zu Google und ist damit durch BR-125 ausdrücklich
ausgeschlossen. Dieselbe Art Grenze wie bei Push in UC-028.

Die Spezifikation nimmt das vorweg: **A4 nennt den Textweg als regulären
Ablauf** – «System bietet an, den Text selbst zu schreiben». Damit ist dieser
Use Case ohne Mikrofon nicht halb, sondern vollständig bis auf die Aufnahme.

## Related Use Cases

- UC-030 Anliegen beantworten — nimmt entgegen, was hier entsteht
- UC-031 Sitzungs-Input — der zweite Weg derselben Idee
- UC-025 Transparenz — dieselbe Haltung, andere Daten
- UC-028 Benachrichtigungen — dieselbe Art Infrastruktur-Grenze

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                 | Status vorher | Ziel        | Notizen                                                    |
| ------ | --------------------- | ------------- | ----------- | ---------------------------------------------------------- |
| FR-085 | Sprachmemo aufnehmen  | Open          | **Open**    | Aufnahme und Transkription bleiben offen (BR-125)           |
| FR-086 | Transkript prüfen     | Open          | Implemented | Der Text wird vor dem Senden gezeigt und ist änderbar – ob er gesprochen oder getippt entstand, ändert daran nichts (BR-121) |
| FR-087 | Privates Sprachjournal | Open         | Implemented | `self_reflection`, ausschliesslich für die verfassende Person |
| FR-088 | Trainer-Logbuch       | Open          | Implemented | `coach_log`, dieselbe Strenge                               |
| FR-089 | Gerichtetes Feedback  | Open          | Implemented | An Person, Rolle oder Team                                  |
| FR-090 | Anonymer Kanal        | Open          | Implemented | Anonymität im Schema, nicht in einer Policy                 |

### Business Rules

| ID     | Regel                              | Ziel        | Notizen                                                     |
| ------ | ---------------------------------- | ----------- | ----------------------------------------------------------- |
| BR-121 | Nichts geht ungesehen raus         | Implemented | Der Text entsteht in der Hand der absendenden Person          |
| BR-122 | Anonymität ist eine Eigenschaft des Schemas | Implemented | `check`-Constraint; nachgemessen, dass ein Einfügen mit Autor scheitert |
| BR-123 | Privates bleibt privat             | Implemented | Policy: `self_reflection` und `coach_log` nur für Verfasser:innen – auch nicht für den Vorstand |
| BR-124 | Audio wird standardmässig gelöscht | **Partial** | `audio_url` bleibt leer, solange es keine Aufnahme gibt      |
| BR-125 | Souveräne Transkription            | **Offen**   | Der Grund, warum FR-085 offen bleibt                         |
| BR-126 | Keine Auswertung der Inhalte       | Implemented | Kein Export, keine Volltextsuche, kein Schlagwort-Scan – nachgemessen |
| BR-127 | Höchstdauer                        | **Partial** | Die Textlänge ist begrenzt; die Dauer betrifft die Aufnahme  |

---

## Current State

Nichts davon existiert: weder Tabelle noch Ansicht noch Adressierung.

---

## Missing Pieces

| #   | Was fehlt                                        | Anforderung | Quelle          |
| --- | ------------------------------------------------ | ----------- | --------------- |
| 1   | Keine Tabelle für Anliegen                        | FR-085–090  | Automated       |
| 2   | Keine Adressierung                                 | FR-089      | Cross-reference |
| 3   | Kein anonymer Kanal                                | FR-090, BR-122 | Cross-reference |
| 4   | Keine Privatheit für Journal und Logbuch          | BR-123      | Cross-reference |
| 5   | Kein Kontingent                                    | A5          | Cross-reference |
| 6   | Aufnahme und Transkription                         | FR-085      | Cross-reference |

---

## Implementation Guidelines

- **Bauteile:** `AppPage`, `ListSection`, `FormModal` zum Erfassen,
  `IonSegment` für die Adressierung, `IonTextarea`. **Keine** neue Komponente.
- **Struktur:** Logik nach `app/src/lib/voice.ts`, Datenzugriff in
  `hooks/useVoice.ts`, Migration `0046_voice_notes.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0046_voice_notes.sql`: `voice_notes` mit dem
      Anonymitäts-Constraint, Policies, `submit_voice_note()`, Kontingent
- [x] 2. `lib/voice.ts`: Arten, Adressierung, Prüfung
- [x] 3. `hooks/useVoice.ts`
- [x] 4. `pages/VoicePage.tsx` samt Route und Einstieg
- [x] 5. Vier Sprachen
- [x] 6. Verhaltensprüfung gegen die laufende Datenbank
- [x] 7. `ai-code-review` und Behebung der Befunde
- [x] 8. Vitest
- [x] 9. Manueller Testplan `docs/test-plans/uc-029-stimme.md`
- [x] 10. Statusabgleich

---

## Umsetzung

- `supabase/migrations/0046_voice_notes.sql`
  - `voice_notes` nach dem Entitätsmodell – und der **wichtigste Teil dieser
    Migration ist ein Constraint**: Für `kind = anonymous` sind Autor und
    Zeitstempel leer, das Ticket gefüllt. Ohne ihn wäre BR-122 eine
    Absichtserklärung.
  - Ein zweiter Constraint: Ein privates Anliegen richtet sich an niemanden.
  - Policy mit vier Fällen; der strengste zuerst (BR-123).
  - `voice_quota_left()` und `submit_voice_note()`.
- `app/src/lib/voice.ts` – darin das Ticket: Es entsteht **auf dem Gerät**, der
  Server bekommt nur den SHA-256-Prüfwert.
- `app/src/hooks/useVoice.ts`, `pages/VoicePage.tsx`.

---

## Verhaltensprüfung gegen die laufende Datenbank

26 Prüfungen in einer Transaktion, die sich zum Schluss selbst zurückrollt.

| #     | Prüfung                                                     | Ergebnis                     |
| ----- | ----------------------------------------------------------- | ---------------------------- |
| 1–3   | Anonym **mit** Autor / **mit** Zeitstempel / **ohne** Ticket | alle drei abgewiesen (BR-122) |
| 4     | Nicht-anonym **ohne** Autor                                 | abgewiesen                   |
| 5     | Privates Anliegen **mit** Adressat                          | abgewiesen                   |
| 6–9   | Drei Anliegen; anonym ohne Autor und Zeitstempel, nur Kalenderwoche | wie gefordert         |
| 10    | **Vorstand liest die Selbstreflexion**                      | **0** (BR-123)               |
| 11–12 | Vorstand liest anonym / an Trainer:innen gerichtet          | 1 / **0**                    |
| 13–15 | Trainer:in liest an sie gerichtet / privat / anonym         | 1 / **0** / **0**            |
| 16–17 | Verfasserin liest ihr eigenes / Unbeteiligte:r irgendetwas  | 1 / **0**                    |
| 18–21 | Zustellung an Vorstand und Trainer:in; **kein** Text im Rumpf | 1 / 1 / leer               |
| 20    | Zustellung wegen einer Selbstreflexion                      | **0**                        |
| 22–24 | Kontingent: 8 übrig, mit Grenze 2 auf 0, darüber abgewiesen | A5 hält                      |
| 25    | Volltext-Index auf `transcript`                             | **0** (BR-126)               |
| 26    | `submit_voice_note` für `anon`                              | kein Recht                   |

---

## Befunde des Code-Reviews (`ai-code-review`)

| #  | Befund                                                                                                      | Schwere | Erledigt in |
| -- | -------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| 1  | **Policy und Zustellung waren sich uneinig.** `is_club_trainer()` schliesst den Vorstand ein, die Benachrichtigung prüfte aber strikt `role = 'trainer'`: Der Vorstand bekam keine Meldung, **konnte aber mitlesen**. Bei einem Feedback-Kanal ist genau dieser Unterschied der ganze Punkt – wer sein Anliegen an Trainer:innen richtet, hat Trainer:innen gemeint. | **Hoch** | 0046 (Policy prüft die Rolle jetzt genau) |

Bestätigt hat der Review: Der Text steht **nicht** im Rumpf der
Benachrichtigung (er gehört in die App, nicht auf einen Sperrbildschirm), es
gibt keinen Index über `transcript` (BR-126), und private Anliegen erreichen
niemanden.

---

## Tests

- `app/src/lib/voice.test.ts` – 10 Tests, darunter der Fall, den man leicht
  falsch macht: Ein **anonymes** Anliegen verlangt keine Adressierung, ein
  gerichtetes schon.
- Manueller Testplan: `docs/test-plans/uc-029-stimme.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                            | Impact | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------ | ------ | ----------- |
| 1   | **FR-085 bleibt offen, und BR-125 ist der Grund.** `SpeechRecognition` im Browser schickt das Audio zu Google – ausdrücklich ausgeschlossen. Ein Modell auf dem Gerät wäre ein Paket von zig Megabyte. Diese Umsetzung baut alles ausser der Aufnahme; A4 nennt den Textweg ohnehin als regulären Ablauf. | **High** | Stakeholder |
| 2   | **Die Rolle «sportchef» gibt es nicht** (offener Punkt 1 des Katalogs). Sie steht im Constraint, weil das Entitätsmodell sie nennt – zugestellt werden kann an sie nicht. | Medium | Stakeholder |
| 3   | Der Katalog lässt die **Aufbewahrungsdauer** offen (offener Punkt 4). Angenommen: keine automatische Löschung; ein Anliegen verschwindet, wenn es gelöst und von der verfassenden Person entfernt wird. | Medium | Stakeholder |
| 4   | A5 nennt ein Monatskontingent ohne Zahl. Angenommen: zehn Anliegen je Person und Monat, in `clubs.settings.voice.monthlyQuota`. | Low | Stakeholder |
| 5   | A2 verlangt ein **Ticket-Token auf dem Gerät**. Umgesetzt: Der Client erzeugt es, schickt nur den Prüfwert, und bewahrt das Token lokal auf. Wer den Speicher löscht, verliert den Rückkanal – das ist der Preis echter Anonymität. | Medium | Stakeholder |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-10 | Plan erstellt |
| 2026-09-10 | `0046` eingespielt, 26 Prüfungen gegen die laufende Datenbank |
| 2026-09-10 | Code-Review: ein Befund, behoben |
| 2026-09-10 | Tests, manueller Testplan, Statusabgleich – FR-085 bleibt offen |

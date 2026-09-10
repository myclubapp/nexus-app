# Implementation Plan: UC-032 — Kontext-Check-in beantworten

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                            |
| **Goal**          | Nach einer Teilnahme in wenigen Sekunden mitteilen, wie es einem damit ging |
| **Plan created**  | 2026-09-10                                                          |
| **Status**        | Done                                                                |

## Overview

Dieser Use Case ist der heikelste des Moduls, und zwar nicht technisch: Er
sammelt **Befinden**. Vier der sechs Regeln sind deshalb Verzichte, keine
Funktionen – die App fragt nie, was sie schon weiss (BR-136), fragt nie nach
dem Grund einer Abwesenheit (BR-137), zahlt dafür keine Punkte (BR-138) und
behält die Antwort für sich, bis das Mitglied sie ausdrücklich teilt (BR-139).

**BR-138 ist die Regel, die den Rest trägt:** Belohntes Befinden wäre
verzerrtes Befinden. Wer für ein Lächeln Punkte bekommt, lächelt – und die
Zahl misst dann die Belohnung statt die Stimmung.

BR-140 ist die zweite Sperre: Ein Team-Wert erscheint erst ab fünf Antworten.
Darunter gar nicht – nicht «zu wenige Daten» mit einer Zahl daneben.

## Related Use Cases

- UC-013 QR-Check-in — **anderer Begriff, andere Sache.** Dort wird Anwesenheit
  erfasst (`check_in()`), hier Befinden. Die Namensnähe ist eine Falle.
- UC-023 Fürsorge-Hinweis — teilt sich die Zurückhaltung, aber **nicht** die
  Daten: Aus einem Check-in entsteht nie ein Signal an Dritte (BR-139)
- UC-031 Sitzungs-Input — liefert mit `functionary_roles` die Grundlage für
  FR-109
- UC-021 Punkte — hier ausdrücklich **nicht** beteiligt (BR-138)

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                    | Status vorher | Ziel        | Notizen                                                     |
| ------ | ------------------------ | ------------- | ----------- | ----------------------------------------------------------- |
| FR-102 | Kontextabhängige Frage   | Open          | Implemented | Vier Kontexte aus der Teilnahme abgeleitet, nie erfragt      |
| FR-103 | Check-in überspringen    | Open          | Implemented | A1 – und der Termin fragt nicht erneut                       |
| FR-104 | Sichtbarkeit wählen      | Open          | Implemented | Sie steht **vor** der Antwort, nicht danach                  |
| FR-105 | Eigener Verlauf          | Open          | Implemented | Nur die eigene Kurve, für niemanden sonst lesbar             |
| FR-106 | Team-Stimmung aggregiert | Open          | Implemented | Erst ab fünf Antworten, sonst gar nichts (BR-140)            |
| FR-107 | Einsatz-Feedback         | Open          | Implemented | A4, Freitext an die organisierende Person, auf Wunsch anonym |
| FR-108 | Selbst-Nudge             | Open          | Implemented | A6 – die Meldung geht **nur** an das Mitglied selbst         |
| FR-109 | Entlastungs-Index        | Open          | **Partial** | Fünfter Kontext `office_load`, quartalsweise; der Aggregatwert bleibt bei kleinen Vorständen unter der Mindestgruppengrösse verborgen |

### Business Rules

| ID     | Regel                                | Ziel        | Notizen                                                      |
| ------ | ------------------------------------ | ----------- | ------------------------------------------------------------ |
| BR-136 | Die App fragt nie, was sie schon weiss | Implemented | Der Kontext wird **abgeleitet**; es gibt kein Feld dafür     |
| BR-137 | Kein Check-in bei Abwesenheit        | Implemented | Als Schema umgesetzt: für Abwesenheit existiert kein Kontext |
| BR-138 | Check-ins geben keine Punkte         | Implemented | Keine Regel, keine Buchung – und ein Test, der es festhält   |
| BR-139 | Befinden ist privat                  | Implemented | Vorgabe `private`; `shared_trainer` nur über einen eigenen Aufruf |
| BR-140 | Mindestgruppengrösse                 | Implemented | `team_mood()` gibt unter fünf Antworten **nichts** zurück     |
| BR-141 | Höchstens ein Check-in pro Tag       | Implemented | Unique-Index auf `(member_id, asked_on)`                      |

### Non-Functional Requirements

| ID      | Titel                      | Kategorie   | Betrifft? | Notizen                                              |
| ------- | -------------------------- | ----------- | --------- | ---------------------------------------------------- |
| NFR-011 | Serverseitige Berechtigung | Security    | Ja        | Eine fremde Antwort ist per Policy nicht lesbar       |
| NFR-012 | Punkte nur vom Server      | Security    | Ja        | Hier: **gar keine** Punkte (BR-138)                   |
| NFR-025 | Zurückhaltung              | Usability   | Ja        | Eine Frage, eine Skala, ein Tipp                      |
| NFR-028 | Vier Sprachen              | Usability   | Ja        | Auch die Fragetexte der Erstbefüllung                 |

---

## Current State

- `supabase/migrations/0029_qr_check_in.sql` / `0030_check_in_hardening.sql`:
  `check_in()` erfasst **Anwesenheit** über QR. Gleicher Wortstamm, andere
  Sache – die Verwechslung ist das erste Risiko dieses Use Cases.
- `attendance.status` kennt `present` und `substitute` – die Rolle im Ereignis
  ist damit bereits erfasst und muss nicht erfragt werden (BR-136).
- `functionary_roles` seit `0049` – die Grundlage für FR-109.
- **Kontext-Check-ins gibt es nicht.** Weder `checkin_prompts` noch
  `checkin_responses`.

---

## Missing Pieces

| #   | Was fehlt                                          | Anforderung    | Quelle          |
| --- | -------------------------------------------------- | -------------- | --------------- |
| 1   | Keine Fragen, keine Antworten                      | FR-102         | Automated       |
| 2   | Keine Auslösung nach dem Termin                    | FR-102, BR-141 | Cross-reference |
| 3   | Kein Überspringen, das sich merkt                  | FR-103, A1     | Cross-reference |
| 4   | Keine Sichtbarkeitswahl                            | FR-104, BR-139 | Cross-reference |
| 5   | Kein eigener Verlauf                               | FR-105         | Cross-reference |
| 6   | Keine Team-Stimmung mit Mindestgruppengrösse       | FR-106, BR-140 | Cross-reference |
| 7   | Kein Einsatz-Feedback                              | FR-107, A4     | Cross-reference |
| 8   | Kein Selbst-Nudge                                  | FR-108, A6     | Cross-reference |
| 9   | Kein Entlastungs-Index                             | FR-109         | Cross-reference |

---

## Implementation Guidelines

Verbindlich aus `docs/guidelines.md`:

- **Bauteile:** `AppPage`, `ListSection` mit `footnote`, `FormModal` für das
  Check-in, `SkeletonList`, `EmptyState`/`ErrorState`, `useToast()`.
  Für die Skala **`IonSegment`** (§2) – kein nachgebauter Sternebalken (§11.6).
- **Auswahl:** jedes `IonSelect` mit `cancelText`/`okText` (§8).
- **Kein Inline-Style** für den Verlauf; die Kurve entsteht als SVG mit Klassen
  aus `variables.css`, wie `RadarChart` in UC-024 (§1, §6).
- **Entscheidungen** als reine Funktionen in `src/lib/contextCheckin.ts` (§9).
- **Benennung:** `contextCheckin` trennt es vom QR-`checkIn` (§7-Glossar).
- **Struktur:** `src/hooks/useContextCheckin.ts`,
  `src/components/CheckinPromptModal.tsx`, `src/pages/MoodPage.tsx`;
  Migration `0050_context_checkins.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0050_context_checkins.sql`: `checkin_prompts`,
      `checkin_invitations`, `checkin_responses`, Policies,
      `checkin_context()`, `detect_checkins()` + Cron, `submit_checkin()`,
      `skip_checkin()`, `share_checkin()`, `my_checkin_trend()`,
      `team_mood()`, `nudge_low_checkins()` + Cron, `seed_checkin_prompts()`
- [x] 2. `lib/contextCheckin.ts`: Kontexte, Skalen, Sichtbarkeit, Prüfregeln
- [x] 3. `hooks/useContextCheckin.ts`: offene Check-ins, Antworten, Verlauf, Team-Wert
- [x] 4. `CheckinPromptModal`: die Frage, die Skala und die Sichtbarkeit (Schritte 3–7)
- [x] 5. `MoodPage`: offene Check-ins, eigener Verlauf, Team-Wert für Trainer:innen
- [x] 6. Erstbefüllung der Fragen in vier Sprachen
- [x] 7. Vier Sprachen – `npm run i18n:check`
- [x] 8. Verhaltensprüfung gegen die verknüpfte Datenbank
- [x] 9. `ai-code-review` und Behebung der Befunde
- [x] 10. Vitest, mit einem Test, der **festhält, dass keine Punkte entstehen**
- [x] 11. Manueller Testplan `docs/test-plans/uc-032-kontext-check-in.md`
- [x] 12. Statusabgleich in `requirements.md`, UC-Dokument, `use_cases/README.md`
      und `entity_model.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                                                      | Impact   | Owner       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| 1   | **«Check-in» heisst in dieser App zweierlei.** UC-013 erfasst Anwesenheit, UC-032 Befinden. Umgesetzt: `contextCheckin` im Client, `checkin_*` in der Datenbank, `check_in()` bleibt die Anwesenheit. Der Glossar-Eintrag hält es fest. | **High** | Dev         |
| 2   | Das Entitätsmodell kennt keine Einladung, A1 verlangt aber, dass ein Überspringen **erinnert** wird, und BR-141 einen Tagesnachweis. Umgesetzt als `checkin_invitations`; die Entität wird im Modell nachgetragen.                     | Medium   | Architect   |
| 3   | FR-109 verlangt einen fünften Kontext (`office_load`), den der Constraint des Entitätsmodells nicht kennt. Umgesetzt und nachgetragen. Der Aggregatwert bleibt bei weniger als fünf Amtsinhaber:innen verborgen – bei kleinen Vereinen also immer. Deshalb `Partial`. | Medium   | Stakeholder |
| 4   | A4 nennt «Freitext oder Sprachmemo». Die Aufnahme fehlt weiterhin (BR-125, offen seit UC-029); umgesetzt ist der Freitext.                                                                                                            | Low      | Stakeholder |
| 5   | Das Zeitfenster für den Team-Wert ist nirgends beziffert. Angenommen: **28 Tage**, in `clubs.settings.checkin.windowDays`.                                                                                                            | Low      | Stakeholder |
| 6   | «Anhaltend tiefe Werte» (A6) ist nicht beziffert. Angenommen: **drei** Antworten in Folge mit Wert ≤ 2 innerhalb des Zeitfensters.                                                                                                     | Low      | Stakeholder |
| 7   | Das Modul ist im Verein abschaltbar (`clubs.settings.checkin.enabled`); die Vorgabe ist **an**, weil eine Frage, die niemand stellt, auch niemanden stört – abschalten kann der Vorstand.                                              | Low      | Stakeholder |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-10 | Plan erstellt |
| 2026-09-10 | `0050_context_checkins.sql` eingespielt; Verhaltensprüfung gegen die verknüpfte Datenbank mit **45 von 45** bestanden – auf Anhieb. Die vier Verzichte sind darin einzeln belegt: kein Kontext für Abwesenheit (5–8), **null** Punktebuchungen im ganzen Ablauf (20, 41, 42), privat als Vorgabe (21, 26), und unter fünf Antworten gar keine Zeile statt einer Zahl mit Hinweis (32) |
| 2026-09-10 | App-Seite: `MoodPage`, `CheckinPromptModal`, `TrendChart` mit zentralem CSS; vier Sprachen, 1087 Schlüssel |
| 2026-09-10 | **Review-Befund, der ein fehlender Ablauf war:** A5 («eine private Antwort nachträglich der Trainer:in zeigen») war unerreichbar – `useShareCheckin()` stand exportiert da und wurde von nichts aufgerufen, weil die Sichtbarkeit nur **vor** dem Antworten wählbar war. Ergänzt: `useMyCheckinResponses()` und der Abschnitt «Deine Antworten» mit einer Zeilenaktion |
| 2026-09-10 | Weitere Befunde behoben: `isGroupBigEnough()` war tot – jetzt als zweite Sperre in `useTeamMood()`, wo die Zahl aus BR-140 auch im Client lesbar steht; `CheckinInvitation.eventId` und `CheckinPrompt.context` wurden mitgeführt und nirgends gelesen; ein Fehler der Verlaufsabfrage fiel bisher stumm auf den Leerzustand zurück |
| 2026-09-10 | Glossar um die **Verwechslungsfalle** ergänzt: `check_in()` ist die Anwesenheit (UC-013), `checkin_*` das Befinden (UC-032) |
| 2026-09-10 | Statusabgleich: FR-102 bis FR-108 auf `Implemented`, FR-109 auf `Partial`; UC-032 auf `Implemented`; `CHECKIN_INVITATION` im Entitätsmodell nachgetragen |

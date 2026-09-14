# Implementation Plan: UC-026 — Vereins-News publizieren

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand (Voraussetzung nennt trainer **oder** admin)               |
| **Goal**          | Den Verein oder ein Team über etwas informieren, das nicht in die Agenda gehört |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | In Progress                                                         |

## Overview

News sind im Modell dieses Produkts nicht Beiwerk, sondern die **Gegenseite
der Aufrufe**: Sie zählen in der Verbindungs-Quote als Verbindung (BR-111), und
genau diese Quote entscheidet, ob ein Verein gebremst wird, wenn er das nächste
Mal um Hilfe bittet (K1, UC-011). Ohne einen Weg, News zu schreiben, kann ein
Verein die Sperre gar nicht lösen – er kann nur bitten.

Der Bestand ist wieder eine halbe Sache. `news` steht seit `0004`, der
Dashboard-Feed liest sie, und eine Parallel-Sitzung hat mit `0022` den Import
von der Vereins-Website gebaut (UC-038). Was fehlt, ist die **eigene** News:
kein Formular, keine Zustellung in die Inbox, kein Eintrag in der
Verbindungs-Quote – und der Geltungsbereich ist wirkungslos.

## Related Use Cases

- UC-038 News von der Website übernehmen — dieselbe Tabelle, anderer Ursprung
- UC-011 Helfer-Event — dort bremst die Quote, die hier steigt
- UC-027 Vereins-Puls — die andere Verbindungs-Nachricht
- UC-015 Inbox — der Weg, der alle erreicht
- UC-030 Anliegen beantworten — Quelle für A2

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                | Status vorher | Ziel        | Notizen                                             |
| ------ | -------------------- | ------------- | ----------- | --------------------------------------------------- |
| FR-076 | News publizieren     | Open          | Implemented | Formular, Geltungsbereich, Zustellung                |
| FR-077 | News bearbeiten und zurückziehen | Open | Implemented | A3 ohne zweite Zustellung, A4 lässt die Inbox stehen |
| FR-078 | In-App-Inbox         | Implemented   | Implemented | Besteht seit UC-015; hier kommt eine Quelle dazu     |
| FR-070 | Verbindungs-Quote    | Open          | Implemented | Die News **zählt** als Verbindung; die Anzeige kam mit UC-027 dazu |

### Business Rules

| ID     | Regel                              | Ziel        | Notizen                                                   |
| ------ | ---------------------------------- | ----------- | --------------------------------------------------------- |
| BR-109 | Geltungsbereich bestimmt die Reichweite | Implemented | **War wirkungslos**: `news_read` liess jedes Vereinsmitglied jede Team-News lesen |
| BR-110 | Die Inbox erreicht alle            | Implemented | Unabhängig von Push                                        |
| BR-111 | News zählen als Verbindung         | Implemented | `log_club_message(…, 'connection', …)`                     |
| BR-112 | Keine Lesebestätigung pro Person   | Implemented | `read_at` liegt in der eigenen Inbox und ist für den Verein nicht lesbar – nachgemessen |

### Non-Functional Requirements

| ID      | Titel                     | Kategorie   | Betroffen | Notizen                                        |
| ------- | ------------------------- | ----------- | --------- | ---------------------------------------------- |
| NFR-009 | Zustellung ohne Push      | Reliability | Ja        | BR-110 ist dieselbe Regel                       |
| NFR-022 | Kein Personenbezug        | Privacy     | Ja        | BR-112: keine Lesebestätigung                   |
| C-011   | Regeln in der Datenbank   | Design      | Ja        | Reichweite in der Policy, nicht in der Abfrage  |

---

## Current State

- `supabase/migrations/0004_tasks_news.sql`: `news`, `notifications`.
- `supabase/migrations/0006_rls.sql`: `news_read` = `is_club_member()` – der
  Geltungsbereich ist wirkungslos; `news_admin_write` – nur der Vorstand,
  obwohl die Voraussetzung auch Trainer:innen nennt.
- `supabase/migrations/0022_news_sources.sql`: der Import von der Website.
- `app/src/hooks/useNews.ts`, `DashboardPage`: der Lesepfad.

---

## Missing Pieces

| #   | Was fehlt                                                    | Anforderung | Quelle          |
| --- | ------------------------------------------------------------ | ----------- | --------------- |
| 1   | Kein Weg, eine News zu schreiben                              | FR-076      | Automated       |
| 2   | Keine Zustellung in die Inbox                                 | BR-110      | Cross-reference |
| 3   | Kein Eintrag in der Verbindungs-Quote                         | BR-111      | Cross-reference |
| 4   | Der Geltungsbereich ist wirkungslos                           | BR-109      | Automated       |
| 5   | Trainer:innen dürfen nicht schreiben                          | Precondition | Automated      |
| 6   | Kein Bearbeiten, kein Zurückziehen                            | A3, A4      | Cross-reference |

---

## Implementation Guidelines

- **Bauteile:** `FormModal`, `ListSection`, `AppPage`. Neu entsteht **eine**
  Komponente: `NewsFormModal`. Der Feed steht bereits auf dem Dashboard.
- **Struktur:** Logik nach `app/src/lib/news.ts`, Datenzugriff in
  `hooks/useNews.ts`, Migration `0043_publish_news.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0043_publish_news.sql`: Geltungsbereich in der Policy,
      Schreibrecht für Trainer:innen, `publish_news()`, `retract_news()`
- [x] 2. `lib/news.ts`: `validateNews()`
- [x] 3. `hooks/useNews.ts`: `usePublishNews`, `useUpdateNews`, `useRetractNews`
- [x] 4. `components/NewsFormModal.tsx`
- [x] 5. Einstieg und Verwaltung – **im Feed auf dem Dashboard** statt auf
      einer eigenen Seite: Die News steht dort, wo sie gelesen wird, und eine
      zweite Liste derselben Beiträge wäre eine zweite Wahrheit
- [x] 6. Vier Sprachen
- [x] 7. Verhaltensprüfung gegen die laufende Datenbank
- [x] 8. `ai-code-review` und Behebung der Befunde
- [x] 9. Vitest
- [x] 10. Manueller Testplan `docs/test-plans/uc-026-news.md`
- [x] 11. Statusabgleich

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                 | Impact | Owner       |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **A1 verlangt einen Vereinsspeicher, den es nicht gibt.** Es besteht kein Storage-Bucket – auch `club_members.avatar_url` wird heute nur als Verweis geführt. Umgesetzt ist deshalb das Bild als **Link**, wie `proof_url` in UC-018. Der Upload gehört mit dem Avatar-Upload in eine gemeinsame Aufgabe. | **High** | Stakeholder |
| 2   | A4 sagt: «der Eintrag in der Inbox bleibt als Verlauf bestehen». Umgesetzt, indem `notifications` keinen Fremdschlüssel auf `news` hat – der Verlauf bleibt, der Link führt danach ins Leere. Das ist gewollt: Eine Nachricht, die rückwirkend verschwindet, wäre schlimmer. | Medium | Stakeholder |
| 3   | A2 (News aus einer Vorstandsantwort) verlangt UC-030. Die Funktion nimmt die Quelle bereits entgegen, damit UC-030 nur noch aufrufen muss. | Low | Dev |
| 4   | ~~FR-070 verlangt die **Anzeige** der Verbindungs-Quote~~ – **erledigt in UC-027** am 2026-09-10: Die Quote steht auf der Puls-Seite. | Medium | Dev |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-13 | Bearbeiten und Zurückziehen vom Dreipunkt in der Kopfzeile in den Abschnitt «Verwalten» unter der Karte verlegt (`ManageSection`, guidelines §2); Zurückziehen fragt jetzt über ein `IonAlert` nach |
| 2026-09-11 | Nachtrag: Der Plan war nie abgeschlossen worden, obwohl `0043`, `lib/news.ts`, `hooks/useNews.ts` und `NewsFormModal` seit dem 10.09. stehen und A3 wie A4 im Feed erreichbar sind. Aufgaben abgehakt, FR-076 und FR-077 auf `Implemented`, Use Case geschlossen |
| 2026-09-11 | A2 («News aus einer Vorstandsantwort») ist seit `0055` wirklich gebaut: `answer_voice_note()` und `answer_meeting_input()` publizieren mit `news.source = 'board'` |
| 2026-09-09 | Plan erstellt |
| 2026-09-11 | News-Darstellung auf den Schnitt der bestehenden myclub-App (`news.page.html`, `news-detail.page.html`) gebracht: `NewsCard` mit Bild, Datum, Titel, Anriss (drei Zeilen), Autoren-Chip und Teilen, im `IonGrid` 12 / 6 / 6 / 4; `NewsDetailModal` mit Volltext, Bearbeiten und Zurückziehen (A3, A4) hinter dem Dreipunkt als Action Sheet; `SkeletonNewsCards` in derselben Form. |

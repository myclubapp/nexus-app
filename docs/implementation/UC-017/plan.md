# Implementation Plan: UC-017 — Aufgabe im Marktplatz ausschreiben

|                   |                                                                        |
| ----------------- | ---------------------------------------------------------------------- |
| **Primary Actor** | Vorstand (Voraussetzung nennt trainer **oder** admin)                   |
| **Goal**          | Eine Vereinsaufgabe so ausschreiben, dass Mitglieder sie freiwillig übernehmen |
| **Plan created**  | 2026-09-09                                                              |
| **Status**        | Done                                                                    |

## Overview

Der Marktplatz ist die zweite Hälfte des Punktesystems: Bis hierher entstehen
Punkte aus Terminen, die ohnehin stattfinden. Eine Aufgabe entsteht dagegen
nur, weil jemand sie ausschreibt – und wird nur übernommen, wenn jemand ihren
Sinn erkennt. Deshalb ist das Warum hier nicht Beiwerk, sondern
Publikationsvoraussetzung (BR-069), und deshalb kann eine Aufgabe niemandem
zugewiesen werden (BR-071).

Der Bestand ist eine halbe Sache: `tasks` und `task_assignments` stehen seit
`0004`, `claim_task()` und `confirm_task()` ebenso, und die `MarketplacePage`
zeigt sie. Es fehlt genau das, was UC-017 ausmacht – **die Schreibseite**. Es
gibt keinen Weg, eine Aufgabe anzulegen; der Marktplatz eines frisch
gegründeten Vereins bleibt darum für immer leer. Dazu fehlen im Schema drei
Dinge, die die Spezifikation verlangt: das Warum, der Entwurf und die Angabe,
in welchem Rhythmus sich eine Aufgabe wiederholt.

## Related Use Cases

- UC-018 Aufgabe übernehmen — die Gegenseite; sie liest, was hier entsteht
- UC-019 Aufgabe bestätigen — schliesst die Runde und löst A2 aus
- UC-011 Helfer-Event ausschreiben — derselbe Ablauf mit Schichten statt Aufgabe; Entwurf, Warum und sanfte Sperre werden von dort übernommen
- UC-033 Beitrags-Profil erfassen — liefert erst die Grundlage für Schritt 7 (FR-059)
- UC-016 Punkteregeln — der Nur-Dank-Modus (Punktwert 0) gilt hier genauso

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                    | Status vorher | Ziel        | Notizen                                                            |
| ------ | ------------------------ | ------------- | ----------- | ------------------------------------------------------------------ |
| FR-050 | Aufgabe ausschreiben     | In Progress   | Implemented | Formular, Serverfunktion, Geltungsbereich                          |
| FR-051 | Warum-Pflichtfeld        | In Progress   | Implemented | Als `check`-Constraint **und** in `publish_task()` – nicht nur im Formular (C-011) |
| FR-056 | Wiederkehrende Aufgaben  | Open          | Implemented | A2; ausgelöst am Abschluss der Runde, nicht per Zeitplan            |
| FR-059 | Beitrags-Matching        | Open          | **In Progress** | Ohne `member_contribution_profile` (UC-033) gibt es nichts zu matchen; der Empfängerkreis ist vorerst der Geltungsbereich. `suggest_task()` ist die Stelle, an der das Matching einsetzt |

### Business Rules

| ID     | Regel                                | Ziel        | Notizen                                                            |
| ------ | ------------------------------------ | ----------- | ------------------------------------------------------------------ |
| BR-068 | Aufgabe trägt ihren Punktwert selbst | Implemented | `tasks.points`; die Regel `task_done` liefert nur die Säule         |
| BR-069 | Warum ist Publikationsvoraussetzung  | Implemented | Constraint greift am publizierten Datensatz, nicht am Entwurf (Lehre aus `0020`) |
| BR-070 | Anfrage statt Abfrage                | **Partial** | Zustellung ja, persönliche Auswahl erst mit UC-033                  |
| BR-071 | Freiwilligkeit                       | Implemented | Es gibt keinen Schreibweg, der `task_assignments` fremdbestimmt füllt – `claim_task()` nimmt keine Mitglieds-Id entgegen |
| BR-072 | Dringlichkeit ist sichtbar           | Implemented | `taskUrgency()` in `lib/task.ts`, eigener Abschnitt im Marktplatz    |

### Non-Functional Requirements

| ID      | Titel                     | Kategorie   | Betroffen | Notizen                                                        |
| ------- | ------------------------- | ----------- | --------- | -------------------------------------------------------------- |
| NFR-009 | Zustellung ohne Push      | Reliability | Ja        | Die Inbox aus UC-015 trägt den Vorschlag vollständig            |
| NFR-022 | Kein Personenbezug in Kennzahlen | Privacy | Ja    | `club_message_log` bekommt `task`, ohne zu vermerken, wer schrieb |
| NFR-001 | Antwortzeit               | Performance | Ja        | Der Marktplatz lädt eine Abfrage mit eingebetteten Übernahmen   |
| C-011   | Regeln in der Datenbank   | Design      | Ja        | Warum und Personenzahl als Constraint, nicht als Formularprüfung |
| C-031   | Beispielinhalte folgenlos | Business    | Ja        | `is_sample` unterdrückt die Zustellung, wie bei `announce_event()` |

---

## Current State

- `supabase/migrations/0004_tasks_news.sql`: `tasks`, `task_assignments`,
  `claim_task()`, `confirm_task()` — deckt UC-018 Schritt 4 und UC-019 Schritt 6
  in erster Fassung ab, **nicht** UC-017.
- `supabase/migrations/0006_rls.sql`: `tasks_admin_write` — nur der Vorstand,
  die Voraussetzung von UC-017 nennt aber auch Trainer:innen.
- `app/src/hooks/useGamification.ts`: `useTasks()`, `useClaimTask()` — Lesepfad
  und Übernahme.
- `app/src/pages/MarketplacePage.tsx`: die Liste, ohne Gruppierung, ohne Warum,
  ohne Dringlichkeit und ohne Einstieg zum Ausschreiben.

Kein Schritt des Hauptablaufs ist heute vollständig abgedeckt. Schritt 6
(«zeigt sie im Marktplatz») existiert für Aufgaben, die es nicht geben kann.

---

## Missing Pieces

| #   | Was fehlt                                                                    | Anforderung        | Quelle          |
| --- | ---------------------------------------------------------------------------- | ------------------ | --------------- |
| 1   | `tasks.why` — die Spalte gibt es nicht, das Pflichtfeld hat keinen Ort        | FR-051, BR-069     | Cross-reference |
| 2   | Kein Entwurfszustand: `status` kennt `draft` nicht                            | A3                 | Cross-reference |
| 3   | Kein Schreibweg: weder Formular noch Serverfunktion                           | FR-050, Schritt 1–6 | Automated      |
| 4   | Trainer:innen dürfen nicht schreiben, obwohl die Voraussetzung sie nennt      | Precondition       | Automated       |
| 5   | Keine Zustellung an Mitglieder — eine Aufgabe entsteht lautlos                | Schritt 7, BR-070  | Automated       |
| 6   | Kein Rhythmus und keine Neuausschreibung                                      | A2, FR-056         | Cross-reference |
| 7   | Keine Frist-Behandlung: nichts läuft ab, nichts wird hervorgehoben            | A4, BR-072         | Cross-reference |
| 8   | `category` ist frei und namenlos; Matching und Filter brauchen eine Liste     | FR-059             | Cross-reference |
| 9   | `is_sample` fehlt an `tasks`, obwohl das Entitätsmodell es führt              | C-031, BR-161      | Cross-reference |

---

## Implementation Guidelines

Bindend aus `docs/guidelines.md`:

- **Bauteile:** `AppPage` (Seitengerüst mit grossem Titel), `FormModal`
  (Erfassungsblatt, bringt `presentingElement` schon mit), `ListSection`
  (gruppierte Abschnitte), `SkeletonList`, `EmptyState`/`ErrorState`,
  `useToast()`. Neu entsteht genau **eine** Komponente: `TaskFormModal` –
  nach dem Vorbild von `HelperEventModal`, weil `IonModal` seinen Inhalt im
  Test nicht rendert (TESTING.md).
- **Stil:** keine Inline-Styles, keine neue CSS-Datei. Für die Dringlichkeit
  reichen `color="warning"`/`color="danger"` an `IonBadge` und `IonNote` –
  Ionic-Standard statt eigener Klasse.
- **Struktur:** reine Logik nach `app/src/lib/task.ts` (mit Test), Datenzugriff
  nach `app/src/hooks/useTasks.ts`, Migration als `0033_task_marketplace.sql`.
- **Sprache:** Bezeichner englisch, alle Texte über `react-i18next` in vier
  Sprachen.

---

## Implementation Tasks

- [x] 1. Migration `0033_task_marketplace.sql`: `why`, `is_sample`,
      `recurrence_days`, Status `draft`, Kategorien-Constraint,
      Warum-Constraint am publizierten Datensatz
- [x] 2. Schreibrecht auf `is_club_trainer()` erweitern, `created_by` in der
      Policy an `current_member_id()` binden
- [x] 3. `create_task()` und `publish_task()` — Rollenprüfung, Warum-Prüfung,
      Zustellung über `notify()`, Eintrag in `club_message_log` als `call`,
      sanfte Sperre über `call_is_muted()` (K1)
- [x] 4. A2: Trigger `reissue_recurring_task()` beim Übergang nach `done`
- [x] 5. A4: `expire_tasks()` samt Cron-Auftrag; nur Aufgaben **ohne**
      Übernahme laufen ab, sonst verlöre UC-018 A4 seine Grundlage
- [x] 6. `app/src/lib/task.ts`: `TASK_CATEGORIES`, `validateTask()`,
      `taskUrgency()`, `groupTasks()` — mit Tests
- [x] 7. `app/src/hooks/useTasks.ts`: Lese- und Schreibpfade an einem Ort
- [x] 8. `app/src/components/TaskFormModal.tsx` — Formular inkl. A1 und A3
- [x] 9. `MarketplacePage` neu: Abschnitte «Dringend», «Offen», «Meine
      Aufgaben», «Entwürfe» (nur Vorstand), Einstieg zum Ausschreiben
- [x] 10. Vier Sprachen, `npm run i18n:check`
- [x] 11. Verhaltensprüfung gegen die laufende Datenbank
- [x] 12. `ai-code-review` und Behebung der Befunde
- [x] 13. Vitest für `lib/task.ts` und `TaskForm`
- [x] 14. Manueller Testplan `docs/test-plans/uc-017-aufgabe-ausschreiben.md`
- [x] 15. Statusabgleich in `requirements.md`, `UC-017`, `use_cases/README.md`,
      `entity_model.md`

---

## Umsetzung

- `supabase/migrations/0033_task_marketplace.sql`
  - `why`, `is_sample`, `recurrence_days`, Status `draft`, feste Kategorienliste.
  - Der Warum-Constraint greift am **publizierten** Datensatz. 0020 hat gelehrt,
    warum: Am Entwurf stünde A3 im Widerspruch zum Schema.
  - `create_task()` legt immer einen Entwurf an, `publish_task()` schreibt aus.
    A3 ist damit kein Sonderweg, sondern der Normalfall ohne zweiten Schritt.
  - `suggest_task()` und `announce_task()` – Zustellung, sanfte Sperre (K1) und
    der Zähler der Verbindungs-Quote, gemeinsam genutzt von Publikation und
    Neuausschreibung.
  - A2 als **Trigger** auf dem Übergang nach `done`, nicht in `confirm_task()`:
    Wer diese Funktion später umbaut (UC-019), kann A2 damit nicht verlieren.
  - A4 als `expire_tasks()` samt stündlichem Cron-Auftrag.
- `supabase/migrations/0034_task_marketplace_hardening.sql` – die Befunde des
  Reviews, siehe unten.
- `app/src/lib/task.ts`, `hooks/useTasks.ts`, `components/TaskFormModal.tsx`,
  `pages/MarketplacePage.tsx`.

---

## Verhaltensprüfung gegen die laufende Datenbank

63 Prüfungen in vier Durchgängen, jeder in einer Transaktion, die sich zum
Schluss selbst zurückrollt. Vier Mitglieder auf Zeit, ein Team.

### A – Anlegen, Ausschreiben, Zustellen (25 Prüfungen)

| #    | Prüfung                                            | Ergebnis                    |
| ---- | -------------------------------------------------- | --------------------------- |
| 1–2  | `create_task()` legt einen **Entwurf** an, `created_by` ist die schreibende Person | draft / ja |
| 3–4  | Entwurf für Mitglied / für Trainer:in sichtbar      | **0** / 1 (A3)              |
| 5–6  | `publish_task()`                                    | 3 zugestellt, nicht gesperrt, Status `open` |
| 7    | Zustellung an die ausschreibende Person             | **0**                       |
| 8–9  | Zustellung an Trainer:in / Mitglied                 | 1 / 1                       |
| 10–11| Link und Text der Zustellung                        | `/tabs/marketplace?task=…`, das **Warum** im Text |
| 12–13| `club_message_log`                                  | 1 × `call`, `task:catering` (K1) |
| 14–16| Zweite Publikation                                  | 0 zugestellt, kein weiterer Eintrag |
| 17   | Publizierte Aufgabe für Mitglied sichtbar           | 1                           |
| 18   | Mitglied schreibt aus                               | abgewiesen                  |
| 19–21| Team-Aufgabe: Zustellung nur ans Team               | 1 – nur das Team            |
| 22–23| Publikation ohne Warum                              | abgewiesen, bleibt Entwurf (A1) |
| 24   | Team eines fremden Vereins                          | abgewiesen                  |
| 25   | Gefälschtes `created_by`                            | abgewiesen                  |

### B – Constraints, Wiederholung, Fristablauf (27 Prüfungen)

| #     | Prüfung                                           | Ergebnis                    |
| ----- | ------------------------------------------------- | --------------------------- |
| 1–2   | Unbekannte Kategorie / publiziert ohne Warum      | abgewiesen                  |
| 3     | Entwurf ohne Warum                                | angelegt (A3)               |
| 4–7   | `max_assignees = 0`, negative Punkte, `recurring` ohne Rhythmus, Rhythmus ohne `recurring` | alle abgewiesen |
| 8–13  | A2: neue Runde nach `done`                        | `open`, Frist **+14 Tage**, Rhythmus und Warum vererbt |
| 14–15 | Zustellung zur neuen Runde / kein Sturzflug       | 1 / genau 2 Aufgaben        |
| 16    | Einmalige Aufgabe wiederholt sich                 | nein                        |
| 17–19 | A4: `expire_tasks()`                              | 1; ohne Übernahme `expired`, **mit** Übernahme unverändert |
| 20–21 | Meldung an die ausschreibende Person / zweiter Lauf | 1 / 0                     |
| 22–24 | `suggest_task`, `announce_task`, `expire_tasks` für `authenticated` | **kein Recht** |
| 25–26 | `create_task` für `authenticated` / `publish_task` für `anon` | ja / nein     |
| 27    | Cron-Auftrag                                      | `23 * * * *`                |

### C – der Befund (2 Prüfungen)

| # | Prüfung                                              | Ergebnis vor 0034           |
| - | ---------------------------------------------------- | --------------------------- |
| 1 | Team-Aufgabe für Mitglied **ausserhalb** des Teams sichtbar | **1 – sie war es**    |
| 2 | Dasselbe Mitglied übernimmt sie                      | **gelingt**                 |

### D – nach der Behebung (11 Prüfungen)

| #    | Prüfung                                            | Ergebnis                    |
| ---- | -------------------------------------------------- | --------------------------- |
| 1–3  | Team-Aufgabe / Vereinsaufgabe / Abgelaufene für Aussenstehende | **0** / 1 / **0** |
| 4    | Aussenstehende:r übernimmt Team-Aufgabe            | abgewiesen                  |
| 5–6  | Teammitglied sieht und übernimmt                   | ja / ja                     |
| 7    | Übernahme für Aussenstehende lesbar                | **0**                       |
| 8–10 | Vorstand sieht Team-Aufgabe, Abgelaufene, Entwürfe | ja                          |
| 11   | `task_in_scope` für `anon`                         | kein Recht                  |

---

## Befunde des Code-Reviews (`ai-code-review`)

Sechs Befunde. Der erste ist der schwerste – er machte Schritt 4 wirkungslos.

| #  | Befund                                                                                                                                             | Schwere | Erledigt in |
| -- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| 1  | **Der Geltungsbereich war eine Anzeige ohne Wirkung.** Die Zustellung achtete aufs Team, die Sichtbarkeit nicht: `tasks_read` liess jedes Vereinsmitglied jede Team-Aufgabe lesen, `claim_task()` liess sie jeden übernehmen. Nachgemessen (Durchgang C): beides gelang. Die Postcondition war nicht erfüllt. | **Hoch** | 0034 – `task_in_scope()`, **einmal** definiert und von Policy **und** Funktion gelesen |
| 2  | **Die Ablauf-Meldung führte ins Leere.** `expire_tasks()` verlinkt die Aufgabe – aber eine abgelaufene stand in keiner Ansicht. Die ausschreibende Person landete auf einem Marktplatz ohne ihre Aufgabe. | Mittel | 0034 (Policy) + Abschnitt «Abgelaufen» |
| 3  | **Ein `check`, der `null` liefert, lässt die Zeile durch.** `task_type = 'recurring'` ohne Rhythmus kam als `null or false` = `null` durch die Prüfung. Aufgefallen in der eigenen Verhaltensprüfung, nicht im Lesen. | Mittel | 0033 (`case` statt `or`-Kette) |
| 4  | **Der Punktwert war eine feste 20.** Der Verein konfiguriert `task_done` in UC-016 – und die Aufgabe ignorierte das. Die Punkteregel wäre eine Angabe ohne Wirkung gewesen. | Mittel | `suggestedTaskPoints()`, überschreibbar wie in UC-011 |
| 5  | Der «+»-Knopf trug `aria-hidden` statt `aria-label` und hatte damit **keinen Namen**. Jede andere Seite macht es umgekehrt. | Niedrig | `MarketplacePage` |
| 6  | Drei tote i18n-Schlüssel (`marketplace.filterAll`, `filterTeam`, `submit`) – Reste einer nie gebauten Filterleiste. | Niedrig | entfernt |

Nicht behoben, bewusst: `events_read` hat dieselbe Lücke wie Befund 1 – ein
Team-Termin ist im ganzen Verein sichtbar. Das gehört zu UC-009 und ist unten
unter «Offene Fragen» vermerkt.

Bestätigt hat der Review: `revoke` deckt alle vier internen Funktionen ab, die
Zustellung erreicht die ausschreibende Person nicht, die zweite Publikation ist
folgenlos, der Cron-Lauf isoliert Fehler je Aufgabe, und A2 löst keinen
Sturzflug aus.

---

## Tests

- `app/src/lib/task.test.ts` – 25 Tests: Entwurf gegen Publikation,
  Nur-Dank-Modus, Dringlichkeitsstufen, Kapazität, die vier Abschnitte.
- `app/src/components/TaskFormModal.test.tsx` – 9 Tests: was das Formular
  **sagt und sperrt**. Die Zusicherung auf den Punktvorschlag prüft die
  Quelle, nicht das DOM – `value` kommt an einem `ion-input` in jsdom nicht an
  (TESTING.md §6).
- Manueller Testplan: `docs/test-plans/uc-017-aufgabe-ausschreiben.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                 | Impact | Owner       |
| --- | -------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **Schritt 7 lässt sich nicht erfüllen.** Ohne Beitrags-Profil (UC-033) gibt es kein Kriterium für «passend». Angenommen: der Vorschlag geht an den Geltungsbereich, wie bei `announce_event()`. FR-059 und BR-070 bleiben deshalb `Partial`. | Medium | Stakeholder |
| 2   | Die Kategorien sind eine feste Liste im Code, kein Vereinsfeld. UC-033 Schritt 2 verlangt dieselbe Liste — sie muss geteilt werden, sonst matcht nichts. | Medium | Dev |
| 3   | A2 nennt «nach jeder abgeschlossenen Runde», nicht wann genau. Angenommen: beim Übergang auf `done`; die neue Runde erbt Frist + Rhythmus. Durch Test gepinnt. | Low | Stakeholder |
| 4   | A4 sagt nicht, was mit einer **übernommenen**, aber überfälligen Aufgabe geschieht. UC-018 A4 lässt die Einreichung ausdrücklich zu — daraus folgt: nur unübernommene Aufgaben laufen ab. Durch Prüfung belegt. | Low | Stakeholder |
| 5   | Die Voraussetzung nennt trainer **oder** admin, der Primärakteur nur den Vorstand. Umgesetzt wird die Voraussetzung, wie in UC-011. | Low | Stakeholder |
| 6   | **`events_read` hat dieselbe Lücke, die Befund 1 an `tasks` schloss:** Ein Termin für ein Team ist im ganzen Verein sichtbar. Gehört zu UC-009, nicht hierher – aber es ist dieselbe Klasse Fehler. | Medium | Dev |
| 7   | Eine abgelaufene Aufgabe lässt sich nicht erneut ausschreiben; die ausschreibende Person legt eine neue an. A4 verlangt nur die Meldung, nicht die Erneuerung. | Low | Stakeholder |

---

## Progress Log

| Datum      | Eintrag      |
| ---------- | ------------ |
| 2026-09-09 | Plan erstellt |
| 2026-09-09 | `0033` eingespielt, 52 Prüfungen gegen die laufende Datenbank |
| 2026-09-09 | Code-Review: sechs Befunde, behoben in `0034` und in der App; 11 weitere Prüfungen |
| 2026-09-09 | Tests, manueller Testplan, Statusabgleich – Plan abgeschlossen |

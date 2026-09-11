# Implementation Plan: UC-023 — Fürsorge-Hinweis triagieren

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Trainer:in (Vereinssignale: Vorstand)                               |
| **Goal**          | Auf ein Frühwarnsignal reagieren, ohne dass sich mehrere Verantwortliche doppelt melden |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | Done (Triage am 2026-09-09, Kennzahlen im Nachtrag vom 2026-09-11)   |

## Overview

Die Vereins-Gesundheit ist nach dem Punktesystem die zweite Hälfte des
Produkts – und die gefährlichste. Ein Frühwarnsystem über Menschen kann
Fürsorge sein oder Überwachung, und die Spezifikation zieht die Grenze mit
sechs Regeln, von denen fünf **Verbote** sind: nur Teilnahmedaten (BR-094),
Signal statt Urteil (BR-095), strikte Rollen-Reichweite (BR-096), Verfall
statt Akte (BR-097), keine automatischen Konsequenzen (BR-098).

Nichts davon existiert heute. `club_members.health_opt_out` steht seit `0013`
und wird **von niemandem gelesen**; im Übersetzungskatalog liegt ein Block
`health` mit Ampelstufen und Knopfbeschriftungen, den keine Ansicht verwendet.
Beides sind Vorbereitungen, die nie eingelöst wurden.

Dieser Use Case liefert die Erzeugung der Signale, ihre Zustellung an die
richtige Rolle, die Triage in drei Tippern und den Verfall. Die Übersichten
(FR-060, FR-061, FR-068, FR-069) blieben zunächst aussen vor: Sie sind laut
`use_cases/README.md` Anzeigeflächen derselben Signale und haben keine eigene
Spezifikation. **Der Nachtrag vom 2026-09-11 holt sie nach** – siehe unten.

## Related Use Cases

- UC-025 Transparenz-Seite — die Gegenseite: was der Verein über mich weiss
- UC-027 Vereins-Puls — das Gegenmittel zum Signal «Kommunikationspause»
- UC-011 Helfer-Event — dort entsteht `club_message_log`, die Grundlage der Verbindungs-Quote
- UC-010 Zu- oder absagen — die Antwortdaten, aus denen Signale entstehen

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                          | Status vorher | Ziel        | Notizen                                                         |
| ------ | ------------------------------ | ------------- | ----------- | --------------------------------------------------------------- |
| FR-062 | Frühwarn-Signale               | Open          | **Partial** | Fünf Signaltypen aus vorhandenen Daten; vier weitere brauchen Module, die es noch nicht gibt |
| FR-063 | Rollenbasiertes Routing        | Open          | **Partial** | Über `trainer`/`admin`; die Bereichsrolle «Sportchef:in» fehlt der Datenbank (offener Punkt 1 des Katalogs) |
| FR-064 | Hinweis triagieren             | Open          | Implemented | Ein Tipp je Statuswechsel                                        |
| FR-065 | Gesprächsimpulse (Playbooks)   | Open          | Implemented | Zwei bis drei je Signaltyp, in vier Sprachen                     |
| FR-066 | Handlungsfragen an den Verein  | Open          | Implemented | Bei Vereinssignalen statt eines Gesprächsvorschlags              |
| FR-067 | Vorstands-Signale              | Open          | **Partial** | Kommunikationspause und gekippte Verbindungs-Quote; unbeantwortete Inputs (UC-031) und fehlende Nachfolge (Ämter) haben keine Datenbasis |

### Business Rules

| ID     | Regel                            | Ziel        | Notizen                                                              |
| ------ | -------------------------------- | ----------- | -------------------------------------------------------------------- |
| BR-094 | Nur Teilnahmedaten               | Implemented | Die Erzeugung liest `attendance`, `events`, `club_message_log` – sonst nichts |
| BR-095 | Signal, kein Urteil              | Implemented | Kein Text nennt «inaktiv» oder «säumig»; ein Test hält die verbotenen Wörter fest |
| BR-096 | Strikte Rollen-Reichweite        | Implemented | In der **Policy**, nicht in der Abfrage                              |
| BR-097 | Verfall statt Akte               | Implemented | Gelöst heisst gelöscht; ein Cron-Lauf räumt Abgelaufenes weg          |
| BR-098 | Keine automatischen Konsequenzen | Implemented | Kein Signal löst eine Buchung, eine Statusänderung oder eine Nachricht an das Mitglied aus |
| BR-099 | Triage in unter zehn Sekunden    | Implemented | Ein Tipp; Deckel je Team                                             |

### Non-Functional Requirements

| ID      | Titel                            | Kategorie | Betroffen | Notizen                                          |
| ------- | -------------------------------- | --------- | --------- | ------------------------------------------------ |
| NFR-022 | Kein Personenbezug in Kennzahlen | Privacy   | **Ja**    | Wer abbestellt, fliesst nur anonym in Aggregate   |
| NFR-025 | Deckel offener Hinweise          | Usability | Ja        | Die konkrete Zahl ist im Katalog offen – Vorgabe 5 |
| C-011   | Regeln in der Datenbank          | Design    | Ja        | Reichweite, Deckel und Opt-out prüft der Server   |

---

## Current State

- `supabase/migrations/0013_profile_privacy.sql`: `club_members.health_opt_out`
  – gesetzt, aber **von niemandem gelesen**.
- `app/src/i18n/locales/*.json`: ein Block `health` mit Ampelstufen und
  Knopfbeschriftungen – **von keiner Ansicht verwendet**.
- `supabase/migrations/0018_helper_events.sql`: `club_message_log` – die
  Grundlage der Verbindungs-Quote steht.

Es gibt weder eine Tabelle für Signale noch eine Ansicht noch eine Erzeugung.

---

## Missing Pieces

| #   | Was fehlt                                                       | Anforderung | Quelle          |
| --- | --------------------------------------------------------------- | ----------- | --------------- |
| 1   | Keine Tabelle für Hinweise                                       | FR-062      | Automated       |
| 2   | Keine Erzeugung aus Teilnahmedaten                               | FR-062      | Cross-reference |
| 3   | Kein Routing je Signaltyp                                        | FR-063      | Cross-reference |
| 4   | Keine Liste, keine Triage                                        | FR-064      | Automated       |
| 5   | Keine Gesprächsimpulse, keine Handlungsfragen                    | FR-065, FR-066 | Cross-reference |
| 6   | Keine Vorstands-Signale                                          | FR-067      | Cross-reference |
| 7   | `health_opt_out` wird nicht gelesen                              | A5, NFR-022 | Automated       |
| 8   | Kein Deckel, kein Verfall                                        | A2, A4, BR-097 | Cross-reference |

---

## Implementation Guidelines

- **Bauteile:** `AppPage`, `ListSection`, `FormModal` für den geöffneten
  Hinweis, `SkeletonList`, `EmptyState`/`ErrorState`, `IonBadge` für die Ampel.
  Neu entsteht eine Seite (`HealthPage`) und **eine** Komponente
  (`HealthSignalModal`).
- **Stil:** Die Ampel über Ionic-Farben (`success`/`warning`/`danger`), keine
  eigene CSS-Klasse.
- **Sprache:** BR-095 ist eine Sprachregel. Die Texte gehören in die
  Übersetzungen, nicht in die Datenbank – und ein Test hält fest, dass die
  verbotenen Wörter nicht vorkommen.
- **Struktur:** Logik nach `app/src/lib/health.ts`, Datenzugriff in
  `app/src/hooks/useHealth.ts`, Migration `0040_health_signals.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0040_health_signals.sql`: Tabelle, Policies (BR-096),
      `detect_health_signals()`, `set_signal_status()`,
      `expire_health_signals()`, Cron
- [x] 2. `lib/health.ts`: Signaltypen, Ampel, Sortierung, Playbook-Schlüssel
- [x] 3. `hooks/useHealth.ts`: Liste und Statuswechsel
- [x] 4. `pages/HealthPage.tsx` samt Route und Einstieg
- [x] 5. `components/HealthSignalModal.tsx` – Schritte 4–8
- [x] 6. Vier Sprachen inklusive Gesprächsimpulse und Handlungsfragen
- [x] 7. Verhaltensprüfung gegen die laufende Datenbank
- [x] 8. `ai-code-review` und Behebung der Befunde
- [x] 9. Vitest, inklusive eines Tests auf die verbotenen Wörter (BR-095)
- [x] 10. Manueller Testplan `docs/test-plans/uc-023-fuersorge-hinweis.md`
- [x] 11. Statusabgleich, inklusive `entity_model.md`

---

## Umsetzung

- `supabase/migrations/0040_health_signals.sql`
  - `health_signals` – die Tabelle aus dem Entitätsmodell, mit einer
    Abweichung: statt `suggestion` (ein deutscher Ratschlag in der Datenbank,
    der in drei von vier Sprachen falsch wäre) steht dort `detail`, der
    **konkrete** Anlass wie «3/3». Die Worte stehen in den Übersetzungen.
  - `health_signal_in_reach()` – BR-096 an **einer** Stelle, gelesen von der
    Policy **und** von `set_signal_status()`.
  - `health_threshold()` – die Schwellen stehen in den Vereinseinstellungen und
    nicht als Zahl im Code, weil der Katalog sie ausdrücklich offen lässt.
  - `detect_health_signals()` – fünf Typen aus `attendance`, `events` und
    `club_message_log`. Sonst nichts (BR-094).
  - `notify_signal_owners()` – Schritt 1. Der Text nennt **keinen Namen**:
    Eine Push landet auf einem Sperrbildschirm, den auch andere sehen.
  - `set_signal_status()` – «gelöst» löscht (BR-097).
  - Zwei Cron-Aufträge, täglich früh: Frühwarnung, keine Live-Überwachung.
- `app/src/lib/health.ts`, `hooks/useHealth.ts`, `pages/HealthPage.tsx`,
  `components/HealthSignalModal.tsx`, Einstieg in `ClubAdminLinks` – der
  jetzt auch Trainer:innen etwas zeigt.

---

## Verhaltensprüfung gegen die laufende Datenbank

31 Prüfungen im ersten Durchgang, neun im zweiten (Zustellung und die
eingebettete Abfrage der App).

| #     | Prüfung                                               | Ergebnis                    |
| ----- | ----------------------------------------------------- | --------------------------- |
| 1–3   | Erzeugung, Typen, Hinweis zur stillen Person          | 5 / `no_response` / 1        |
| 4     | Hinweis zu einer Person mit Opt-out                   | **0** (A5, NFR-022)          |
| 5–6   | Anlass am Hinweis, keine deutschen Sätze in der Datenbank | «3/3» / ja (BR-095)      |
| 7     | Zweiter Lauf                                          | **0** neue                   |
| 8–9   | Punktebuchungen und Nachrichten ans Mitglied          | **0** / **0** (BR-098)       |
| 10–14 | Reichweite: Trainer:in eigenes Team 1, fremdes Team **0**, Mitglied **0**, Vorstand alle | BR-096 hält |
| 15    | Trainer:in triagiert fremdes Team                     | abgewiesen                   |
| 16–17 | Übernahme, `owned_by` gesetzt                         | `in_contact` / ja            |
| 18–19 | Vorstand übernimmt / löst                             | `taken` (A1) / `deleted`     |
| 20    | Hinweis physisch weg                                  | ja (BR-097)                  |
| 20b–21| Deckel wirklich gesetzt / Hinweise im Team            | 1 / **1** (A4)               |
| 22–23 | Verfall                                               | 5 gelöscht, Rest 0 (A2)      |
| 24–25 | Vereinssignale                                        | `comms_pause`, `connection_ratio`; Quote «1:3» |
| 26–27 | Trainer:in sieht Vereinssignale / Vorstand            | **0** / 2 (A3)               |
| 28–30 | Rechte und Cron-Aufträge                              | intern / nein / 2            |

Zweiter Durchgang:

| # | Prüfung                                                | Ergebnis                |
| - | ------------------------------------------------------ | ----------------------- |
| 1 | Erzeugung                                              | 4                       |
| 2 | Meldung an die Trainer:in des Teams                    | 1 (Schritt 1)           |
| 3 | Meldung an eine Trainer:in eines **fremden** Teams     | **0** (BR-096)          |
| 4 | Meldung an den Vorstand                                | 3                       |
| 5 | Meldung an das **betroffene Mitglied**                 | **0** (BR-098)          |
| 6 | Text der Meldung nennt keinen Namen                    | ja (NFR-022)            |
| 7 | Link                                                   | `/tabs/profile/health`  |
| 8 | Die eingebettete Abfrage der App mit Namen             | liefert Zeilen          |
| 9 | Die Fremdschlüsselnamen, auf die sie sich stützt       | wie erwartet            |

---

## Befunde des Code-Reviews (`ai-code-review`)

| #  | Befund                                                                                                                     | Schwere | Erledigt in |
| -- | ---------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| 1  | **Schritt 1 des Hauptablaufs fehlte ganz.** «System benachrichtigt die zuständigen Personen» – es benachrichtigte niemanden. Ein Frühwarnsystem, das niemanden warnt, ist eine Liste, die man von selbst besuchen müsste. | **Hoch** | 0040 (`notify_signal_owners()`) |
| 2  | Der Abschnitt «Gesprächsimpulse» erschien auch dann mit Überschrift, wenn ein Signaltyp keine mitbringt – ein leerer Kasten mit Titel. | Niedrig | `HealthSignalModal` |
| 3  | `health.team` lag seit einer früheren Vorbereitung im Katalog und wird von nichts gelesen: `detect_health_signals()` erzeugt kein Signal auf Team-Ebene ohne Person. | Niedrig | entfernt |
| 4  | `ClubAdminLinks` gab für Trainer:innen `null` zurück – der Einstieg zur Vereins-Gesundheit wäre für die Hauptakteurin dieses Use Case unerreichbar gewesen. | Mittel | `ClubAdminLinks` |

In der eigenen Prüfung gefunden, bevor der Review begann: `jsonb_set` legt
**keine Zwischenebene** an. Der Deckel-Test setzte `{health,maxOpenPerTeam}` auf
ein `settings`, das kein `health` hatte – die Anweisung gab das Original
unverändert zurück, und die Prüfung mass eine Einstellung, die nie ankam.
Zusammenführen statt setzen.

Bestätigt hat der Review: Die Erzeugung liest ausschliesslich `attendance`,
`events` und `club_message_log` (BR-094); ein Signal löst keine Buchung, keine
Statusänderung und keine Nachricht an die betroffene Person aus (BR-098); und
gelöste Hinweise sind physisch weg (BR-097).

---

## Tests

- `app/src/lib/health.test.ts` – 15 Tests. Darunter fünf, die **BR-095 als
  Sprachregel** prüfen: Sie lesen alle vier Sprachdateien und halten fest, dass
  kein Urteil darin steht und jeder Signaltyp seine zwei bis drei
  Gesprächsimpulse hat. Sprachregeln zerfallen beim Übersetzen; deshalb prüft
  der Test die Übersetzungen und nicht den Code.
- Manueller Testplan: `docs/test-plans/uc-023-fuersorge-hinweis.md`

---

## Open Questions & Risks

Vier davon sind **Spec Gaps**: Die Spezifikation lässt sie offen, die Umsetzung
muss sich entscheiden. Jede Annahme ist unten benannt, im Code begründet und
durch eine Prüfung festgehalten.

| #   | Frage / Risiko                                                                                                 | Impact | Owner       |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **Die Schwellen sind unbeziffert** (offener Punkt 2 des Katalogs, FR-075). Angenommen: «keine Reaktion» nach 3 unbeantworteten Terminen, «Beteiligungsrückgang» bei unter 50 % in 60 Tagen bei zuvor über 70 %, «Silent Churn» nach 60 Tagen ohne jede Regung. Sie stehen in `clubs.settings.health.thresholds` und sind damit je Verein änderbar, bevor FR-075 die Oberfläche dazu liefert. | **High** | Stakeholder |
| 2   | **«Sportchef:in» gibt es als Rolle nicht** (offener Punkt 1 des Katalogs). Das Routing kennt deshalb nur `trainer` und `admin`; FR-063 bleibt `Partial`. | High | Stakeholder |
| 3   | Vier Signaltypen des Entitätsmodells haben **keine Datenbasis**: `invoice_overdue` (UC-036), `inputs_unanswered` (UC-031), `succession_gap` (Ämter, nach dem MVP) und `streak_broken` (verlangt eine Streak-Definition, die FR-075 noch nicht liefert). Sie stehen im Constraint, werden aber nicht erzeugt. | Medium | Dev |
| 4   | NFR-025 lässt den Deckel offen. Angenommen: fünf offene Hinweise je Team, in `clubs.settings.health.maxOpenPerTeam`. | Medium | Stakeholder |
| 5   | A1 sagt «bietet keine erneute Übernahme an». Umgesetzt als: Wer sich kümmert, steht am Hinweis; die Übernahme ist für andere gesperrt, das **Lösen** aber nicht – sonst bliebe ein Hinweis liegen, wenn die zuständige Person ausfällt. | Low | Stakeholder |

---

## Nachtrag vom 2026-09-11: die Kennzahlen

Vier Anforderungen standen seit Beginn auf `Open` und hatten keinen Ort:
FR-060, FR-061, FR-068 und FR-069. `use_cases/README.md` verweist sie
ausdrücklich hierher – «Anzeigeflächen der in UC-023 beschriebenen Signale».
Mit ihnen kommen zwei Signaltypen zu ihrer Datengrundlage.

**Der Massstab ist derselbe wie oben, nur schärfer: BR-095.** Eine Kennzahl
ist gefährlicher als ein Hinweis, weil sie eine Zahl an eine Gruppe oder an
eine Person heftet. Jede der vier wurde daran gemessen, ob sie einen Anlass
zum Handeln **des Vereins** benennt oder ein Zeugnis über Mitglieder
ausstellt. Deshalb gibt keine von ihnen Namen zurück: Die Versuchung bei
FR-068 wäre eine Liste derer, die alles tragen – und sie wäre die Liste derer,
die nichts tragen, gleich mit.

### Statusänderungen

| ID     | Titel                    | Status vorher | Ziel        | Notizen                                                            |
| ------ | ------------------------ | ------------- | ----------- | ------------------------------------------------------------------ |
| FR-060 | Vereins-Health-Übersicht | Open          | Implemented | Mitglieder, Angekommene, Aktive und der Trend zur Vorsaison         |
| FR-061 | Team-Health              | Open          | Implemented | Antwortquote und Beteiligung je Team – **keine Zeile** unter der Mindestgrösse |
| FR-068 | Verantwortungsverteilung | Open          | Implemented | Wie viele tragen vier Fünftel der Einsätze (Säulen 3 und 7)          |
| FR-069 | Nachfolge-Vorlauf        | Open          | Implemented | Vakante und lange gehaltene Ämter                                   |
| FR-062 | Frühwarn-Signale         | **Partial**   | Implemented | `succession_gap` bekommt mit den Ämtern aus UC-031 seine Grundlage   |
| FR-067 | Vorstands-Signale        | **Partial**   | Implemented | Derselbe Typ war der letzte fehlende dieser Anforderung              |
| FR-075 | Definitionskatalog       | In Progress   | Implemented | Die Schwellen aus `0040` werden **lesbar**                          |
| FR-063 | Rollenbasiertes Routing  | **Partial**   | *unverändert* | «Sportchef:in» fehlt dem Datenmodell weiterhin (offener Punkt 1)    |

### Aufgaben des Nachtrags

- [x] 12. Migration `0056_health_metrics.sql`: `health_definitions()`,
      `club_health()`, `team_health()`, `responsibility_concentration()`,
      `succession_lead()`, `detect_succession_gaps()` samt Auftrag
- [x] 13. `lib/health.ts`: die Deutungen als reine Funktionen
- [x] 14. `hooks/useHealth.ts`: fünf Abfragen, Reichweite am Hook
- [x] 15. `HealthPage`: vier Abschnitte **unter** den offenen Hinweisen (BR-099)
- [x] 16. Der Definitionskatalog wird lesbar (FR-075)
- [x] 17. Vier Sprachen, inklusive der Impulse zu `succession_gap`
- [x] 18. Verhaltensprüfung, Durchsicht, Vitest, Testplan, Statusabgleich

### Verhaltensprüfung

**37 von 37 Prüfungen bestanden.** Die drei, auf die es ankommt:

| #     | Prüfung                                                     | Ergebnis                        |
| ----- | ----------------------------------------------------------- | ------------------------------- |
| 4–8   | Mitglied und Trainer:in rufen die Vereinszahlen auf          | abgewiesen (BR-096)              |
| 11–12 | Team mit drei Personen                                       | **keine Zeile** – auch für den Vorstand |
| 19–21 | Rückgabe der Verteilung und der Übersicht                    | ohne jeden Personenbezug (NFR-013) |
| 26–31 | `succession_gap`: Signal, Schwere, Empfänger, zweiter Lauf, Modul | 1 / `info` / nur Vorstand / 0 / 0 |

### Befunde der Durchsicht

| # | Befund                                                                          | Behoben durch |
| - | ------------------------------------------------------------------------------- | ------------- |
| 1 | `open_signals` doppelte die Überschrift der Hinweisliste – ein Feld, das niemand las | aus der Rückgabe von `club_health()` entfernt |
| 2 | `held_since` wurde nirgends angezeigt; `years` ist daraus gerechnet               | aus der Rückgabe von `succession_lead()` entfernt |
| 3 | Der leere Zustand «Keine Hinweise» hatte kein Angebot (BR-165)                    | führt in die Agenda |
| 4 | Drei Kennzahlen nebeneinander schrumpften auf 320 px auf je 90 px                 | `.app-stat-row` bricht um, `.app-stat` bekommt eine Mindestbreite – zentral im CSS |

### Annahmen des Nachtrags

Vier weitere Spec Gaps, alle in `health_threshold()` und damit je Verein
änderbar:

| #   | Frage                                                                                                                | Annahme                                        | Owner       |
| --- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------- |
| 6   | **Was heisst «aktiv»?** (offener Punkt 2)                                                                            | Eine Spur in 60 Tagen: Teilnahme, Antwort oder Buchung. Eine **Absage zählt dazu** – wer absagt, ist da. | Stakeholder |
| 7   | **Was heisst «Aktivierung»?**                                                                                        | Mindestens eine Buchung in der Saison: die Frage ist, wer angekommen ist, nicht wer fleissig war. | Stakeholder |
| 8   | **Ab wann ist Verantwortung konzentriert?**                                                                          | Wenn weniger als ein Fünftel der Mitglieder vier Fünftel der Einsätze trägt. | Stakeholder |
| 9   | **Ab wann wird ein Amt «lange» gehalten?**                                                                           | Nach drei Jahren. Ein vakantes Amt ist unabhängig davon immer ein Fall. | Stakeholder |
| 10  | **Ab welcher Gruppengrösse gibt es eine Teamzahl?**                                                                  | Ab fünf – dieselbe Schwelle wie `team_mood()` in UC-032, und wie dort **keine Zeile** statt einer Null. | Stakeholder |

Offen bleibt ausserdem: Die Schwellen sind **lesbar**, aber nur über die
Datenbank änderbar. Eine Oberfläche dafür wäre die Einstellung, die laut K7
kein Verein beim Start braucht.

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-09 | Plan erstellt |
| 2026-09-09 | `0040` eingespielt, 40 Prüfungen gegen die laufende Datenbank |
| 2026-09-09 | Code-Review: vier Befunde, behoben – darunter der fehlende Schritt 1 |
| 2026-09-09 | Tests, manueller Testplan, Statusabgleich – Plan abgeschlossen |
| 2026-09-11 | Nachtrag begonnen: die vier Kennzahlen aus FR-060, FR-061, FR-068 und FR-069 hatten bis heute keinen Ort |
| 2026-09-11 | Migration `0056_health_metrics.sql` eingespielt; Verhaltensprüfung: **37 von 37 Prüfungen bestanden** |
| 2026-09-11 | App: sechs reine Funktionen, fünf Abfragen, vier Abschnitte auf der `HealthPage`; `succession_gap` in `LIVE_SIGNAL_TYPES` samt Impulsen in vier Sprachen |
| 2026-09-11 | Durchsicht: zwei Felder ohne Verwendung entfernt, ein leerer Zustand mit Angebot versehen, `.app-stat-row` bricht um |
| 2026-09-11 | Testsuite 777 Tests grün, Testplan um TC-008 bis TC-012 ergänzt, Statusabgleich – Nachtrag abgeschlossen |

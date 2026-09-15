# Implementation Plan: UC-031 — Sitzungs-Input einreichen und zuordnen

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied (einreichend) und Vorstand (zuordnend)                     |
| **Goal**          | Einen Vorschlag an ein Gremium bringen und erfahren, was damit geschieht |
| **Plan created**  | 2026-09-10                                                          |
| **Status**        | Done                                                                |

## Overview

UC-029 hat das Anliegen gebaut, UC-030 seine Antwort. Hier kommt die **dritte
Adresse** dazu: das Gremium. Der Unterschied zu UC-030 ist nicht die Technik,
sondern der Empfänger – ein Anliegen geht an eine Person oder eine Rolle, ein
Input an ein **Amt**, und Ämter überdauern die Personen, die sie halten
(BR-133).

Der Leitsatz des Moduls steht in `MVP_Scope_nexus.md` §13: **«Die App
verwaltet nicht die Sitzung, sondern den Dialog um die Sitzung.»** Daraus folgt,
was hier **nicht** entsteht: keine Traktanden, keine Protokolle, keine
Beschlussverwaltung, keine freien Aufgabenlisten (BR-132).

BR-134 ist der Satz, der den Aufwand rechtfertigt: **Der Status ist schon eine
Antwort.** «Eingeplant für die Vorstandssitzung vom 14.3.» ist gelebtes
Listen-up, lange bevor der Entscheid fällt.

## Related Use Cases

- UC-029 Anliegen erfassen — Schritt 3 nimmt ein Anliegen als Quelle auf
- UC-030 Anliegen beantworten — Schritt 9 beantwortet den Input nach denselben Regeln
- UC-009 Termin erfassen — die Sitzung **ist** ein Termin vom Typ `meeting`
- UC-017 Aufgabe ausschreiben — das erste der zwei Folge-Artefakte (BR-130/§13.4)
- UC-023 Fürsorge-Hinweis — die Anmahnung unbeantworteter Inputs folgt derselben Mechanik

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                     | Status vorher | Ziel        | Notizen                                                       |
| ------ | ------------------------- | ------------- | ----------- | ------------------------------------------------------------- |
| FR-095 | Sitzung als Termin        | Open          | Implemented | `events.type = 'meeting'` besteht seit `0015`; im Client fehlt die Terminart |
| FR-096 | Einladung über Ämter      | Open          | Implemented | `events.audience_role_ids` besteht seit `0015` und ist bisher tot |
| FR-097 | Input einreichen          | Open          | Implemented | Text oder ein bestehendes Anliegen als Quelle                  |
| FR-098 | Input zuordnen            | Open          | Implemented | Laufend bearbeiten **oder** einer Sitzung zuordnen             |
| FR-101 | Sitzungs-Sammelansicht    | Open          | Implemented | Zugeordnete Inputs plus die zwei Dauerthemen (BR-135)          |

FR-099 (dokumentierte Antwort) und FR-100 («Aus dem Vorstand») sind seit UC-030
`Implemented`; Schritt 9 verwendet sie hier wieder, statt sie zu verdoppeln.

### Business Rules

| ID     | Regel                                   | Ziel        | Notizen                                                              |
| ------ | --------------------------------------- | ----------- | -------------------------------------------------------------------- |
| BR-132 | Die App verwaltet den Dialog, nicht die Sitzung | Implemented | Als **Verzicht** umgesetzt und als Test festgehalten: kein Traktandum, kein Protokoll |
| BR-133 | Teilnehmerkreis über Ämter              | Implemented | `functionary_roles`; der Verteiler wird **zum Zustellzeitpunkt** aufgelöst |
| BR-134 | Status ist schon eine Antwort           | Implemented | Jeder Statuswechsel benachrichtigt die einreichende Person            |
| BR-135 | Zwei Dauerthemen                        | Implemented | `meeting_agenda()` liefert genau: Inputs, vakante Ämter, offene Helfereinsätze |

### Non-Functional Requirements

| ID      | Titel                     | Kategorie   | Betrifft? | Notizen                                                |
| ------- | ------------------------- | ----------- | --------- | ------------------------------------------------------ |
| NFR-011 | Serverseitige Berechtigung | Security   | Ja        | Wer einen Input sieht, entscheidet die Policy über das Amt |
| NFR-028 | Vier Sprachen             | Usability   | Ja        | Alle neuen Texte in `de`, `fr`, `it`, `en`              |
| NFR-032 | Ein Erscheinungsbild      | Usability   | Ja        | iOS-Modus, `AppPage`/`ListSection`/`FormModal`          |
| NFR-036 | Generierte Typen getrennt | Maintainability | Ja    | `meeting` gehört als `EventType` nach `database.types.ts` |

---

## Current State

- `supabase/migrations/0015_events.sql`: `events.type` kennt **`meeting`**, und
  `events.audience_role_ids` steht als Spalte da – **beide werden von nichts
  benutzt.** Der Kommentar in der Migration nennt ausdrücklich UC-031.
- `supabase/migrations/0003_agenda.sql`: `event_shifts` – die offenen
  Helfereinsätze für BR-135 sind bereits Daten.
- `supabase/migrations/0047_answer_voice_notes.sql`: das Muster für Antwort,
  Endstatus und anonymen Rückkanal steht; es wird hier wiederverwendet, nicht
  nachgebaut.
- `app/src/lib/database.types.ts`: `EventType` **ohne** `meeting` – die
  Terminart lässt sich im Client nicht wählen.
- `app/src/lib/notifications.ts`: `PUSH_CATEGORIES` **ohne** `input`, obwohl
  `0047` bereits unter dieser Kategorie zustellt. Die Kategorie ist damit in
  den Einstellungen nicht abschaltbar.
- **Ämter gibt es nicht.** Weder Tabelle noch UI.

---

## Missing Pieces

| #   | Was fehlt                                              | Anforderung     | Quelle          |
| --- | ------------------------------------------------------ | --------------- | --------------- |
| 1   | Kein Amt, also kein Gremium                            | FR-096, BR-133  | Automated       |
| 2   | Kein Eingangskorb – `meeting_inputs` fehlt vollständig | FR-097          | Automated       |
| 3   | Keine Zuordnung zu einer Sitzung                       | FR-098, BR-134  | Cross-reference |
| 4   | Keine Sammelansicht                                    | FR-101, BR-135  | Cross-reference |
| 5   | `meeting` fehlt als wählbare Terminart im Client       | FR-095          | Automated       |
| 6   | Kein Weiterleiten an ein anderes Gremium               | A4              | Cross-reference |
| 7   | Kategorie `input` fehlt in den Benachrichtigungs-Einstellungen | FR-080 (UC-028) | Automated |
| 8   | Keine Anmahnung unbeantworteter Inputs                 | §13.3           | Cross-reference |

---

## Implementation Guidelines

Verbindlich aus `docs/guidelines.md`:

- **Bauteile:** `AppPage` (§2), `ListSection` mit `footnote` (§2), `FormModal`
  für das Einreichen und für die Zuordnung (§2), `SkeletonList` beim Laden (§4),
  `EmptyState`/`ErrorState` (§3), `useToast()` für jede Rückmeldung (§5).
  **Kein neues Bauteil**, ausser dem Blatt-Inhalt, den §9 ohnehin als eigene
  Komponente verlangt.
- **Auswahl:** Jedes `IonSelect` trägt `cancelText={t('common.cancel')}` und
  `okText={t('common.ok')}` (§8, `overlayLabels.test.ts`).
- **Blätter:** über `FormModal`, das `presentingElement` selbst besorgt (§2).
- **Rückfrage vor einer Aktion:** `IonAlert`/`IonActionSheet` mit genau einem
  `role: 'cancel'` und **ohne** `color` (§2, `overlayRoles.test.ts`).
- **Entscheidungen** als reine Funktionen in `src/lib/meeting.ts` (§9), nicht im
  Ereignis-Handler – Ionic-Eingaben lassen sich in jsdom nicht bedienen.
- **Struktur:** `src/lib/meeting.ts`, `src/hooks/useMeeting.ts`,
  `src/components/MeetingInputModal.tsx`, `src/pages/MeetingPage.tsx`,
  `src/pages/club/OfficePage.tsx`; Migration `0048_meeting_inputs.sql`.
- **Typen:** `meeting` kommt nach `database.types.ts`, nie in
  `database.generated.ts` (§12, NFR-036).

---

## Implementation Tasks

- [x] 1. Migration `0048_meeting_inputs.sql`: `functionary_roles`,
      `meeting_inputs`, Policies, `committee_members()`,
      `submit_meeting_input()`, `assign_input()`, `forward_input()`,
      `answer_meeting_input()`, `meeting_agenda()`, `anon_input_thread()`,
      `flag_unanswered_inputs()` + Cron
- [x] 2. `lib/meeting.ts`: Status, Zuordnung, Prüfregeln als reine Funktionen
- [x] 3. `hooks/useMeeting.ts` und `hooks/useOffices.ts`: Lesen und Schreiben
- [x] 4. `MeetingInputModal`: einreichen (Schritte 1–5) und zuordnen (Schritt 7)
- [x] 5. `MeetingPage`: Eingangskorb und Sammelansicht (BR-135)
- [x] 6. `OfficePage`: Ämter anlegen und besetzen (das Minimum für BR-133)
- [x] 7. `meeting` als Terminart im Client (FR-095) und `input` als
      Benachrichtigungs-Kategorie (Lücke aus UC-030)
- [x] 8. Vier Sprachen (`de`, `fr`, `it`, `en`) – `npm run i18n:check`
- [x] 9. Verhaltensprüfung gegen die verknüpfte Datenbank
- [x] 10. `ai-code-review` und Behebung der Befunde
- [x] 11. Vitest für `lib/meeting.ts` und die neuen Blatt-Inhalte
- [x] 12. Manueller Testplan `docs/test-plans/uc-031-sitzungs-input.md`
- [x] 13. Statusabgleich in `requirements.md`, UC-Dokument, `use_cases/README.md`
      und `entity_model.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                                                                                                                                 | Impact   | Owner       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| 1   | **Ämter stehen in `MVP_Scope` §2 als «Funktionärsämter mit Factsheets & Vakanz-Anzeige – Ausbaustufe 2».** §13.1 verlangt sie aber im Kern als Verteiler. Umgesetzt wird deshalb genau der Verteiler: Titel, Inhaber:in, «Inhaber:in seit». **Nicht** gebaut: Factsheets, Vakanz-Ausschreibung im Marktplatz, Nachfolgeplanung (K4). | **High** | Stakeholder |
| 2   | «Gremium» ist im Datenmodell kein Objekt – `committee_role_ids` ist eine Liste von Ämtern. Ein Input geht deshalb an **eine Menge Ämter**, nicht an ein benanntes Gremium. Das entspricht BR-133 und erspart eine zweite Verwaltung.                                                                              | Medium   | Dev         |
| 3   | BR-135 nennt «vakante Ämter». Ohne Vakanz-Ausschreibung (Risiko 1) heisst vakant hier schlicht: **kein Inhaber**. Mehr sagt das Datenmodell nicht, und mehr braucht die Sammelansicht nicht.                                                                                                                     | Medium   | Stakeholder |
| 4   | A1 verlangt einen anonymen Statusverlauf über ein Ticket. Umgesetzt mit **demselben** Verfahren wie `0046`/`0047`: Der Server sieht nur den Prüfwert. Zwei Verfahren für dieselbe Zusage wären zwei Angriffsflächen.                                                                                              | Medium   | Dev         |
| 5   | Die Frist für die Anmahnung ist nirgends beziffert. Angenommen: **21 Tage**, in `clubs.settings.meeting.answerDays` – länger als die 14 Tage eines Anliegens, weil ein Input auf eine Sitzung warten darf.                                                                                                        | Low      | Stakeholder |
| 6   | Schritt 3 nennt das Sprachmemo als Eingabeweg. Aufnahme und Transkription fehlen weiterhin (BR-125, offen seit UC-029). Umgesetzt: ein bestehendes **Anliegen** lässt sich als Quelle wählen – der Weg über UC-029, ohne Mikrofon.                                                                                | Low      | Stakeholder |
| 7a  | **Geschlossen am 2026-09-15 (`0095`).** Risiko 2 hatte einen blinden Fleck: Das Gremium war zwar modelliert, aber kein Client schrieb `events.audience_role_ids`. Eine Sitzung ging damit an den ganzen Verein, und ihre Sammelansicht sah nur admin/superadmin. Der Empfängerkreis steht jetzt im Terminformular und ist Pflicht. | **High** | Dev |
| 7b  | **Geschlossen am 2026-09-15 (`0095`).** Risiko 7 ist seit `0070` überholt: Ein Amt hat mehrere Sitze. `committee_members()` und `holds_committee_role()` lasen aber weiter nur die Spiegel-Spalte `holder_member_id` – ein Co-Präsidium bekam eine Einladung statt zwei. Beide lösen jetzt über `functionary_holders` auf. | Medium | Dev |
| 7   | Ein Amt kennt keine zweite Person. Ein Co-Präsidium bräuchte zwei Ämter gleichen Titels; das ist bewusst so, statt eine Inhaber-Liste einzuführen, die niemand pflegt.                                                                                                                                            | Low      | Stakeholder |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-10 | Plan erstellt |
| 2026-09-10 | Migration als `0049` statt `0048` eingespielt: Die parallele Arbeit an UC-038 hatte `0048_news_source_settings.sql` bereits belegt und remote angewandt – zwei Dateien mit derselben Nummer bringen `db push` durcheinander |
| 2026-09-10 | Verhaltensprüfung gegen die verknüpfte Datenbank: 44 von 44 Prüfungen bestanden. Darunter die drei, auf die es ankommt: nach einem Amtswechsel erreicht die Einladung die **neue** Person (BR-133), das Weiterleiten verschiebt die Zuständigkeit wirklich (A4 – die alte Empfängerin sieht den Vorschlag danach nicht mehr), und `meeting_agenda()` kennt genau `input, shift, vacancy` und sonst nichts (BR-135) |
| 2026-09-10 | Die Probe war zweimal selbst falsch: Sie zählte Benachrichtigungen unter RLS – also nur die eigenen – und las den Zustand nach dem Weiterleiten mit einer Identität, die ihn nicht mehr sehen darf. Beide Male bestand sie, ohne etwas zu messen. Die Fallen stehen jetzt in `docs/TESTING.md` §3 |
| 2026-09-10 | `flag_unanswered_notes()` aus `0047` umgeschrieben: Der Signaltyp `inputs_unanswered` ist über den Unique-Index **einer je Verein**; zwei Quellen, die getrennt zählen, hätten sich das Signal gegenseitig weggenommen. Die Probe belegt, dass Anliegen **und** Inputs zusammen gezählt werden |
| 2026-09-10 | App-Seite: `MeetingPage`, `OfficePage`, drei Blätter, `lib/tickets.ts` als gemeinsames Ticket-Verfahren mit UC-029/030; vier Sprachen, 1034 Schlüssel |
| 2026-09-10 | Review-Befunde behoben: (a) `OfficeProblem.sinceWithoutHolder` war ein toter Typ samt vier Übersetzungen; (b) `AnonInput.tokenHash` wurde mitgeführt und nirgends gelesen; (c) `committeeRoleIds` stand im Modell, ohne dass die antwortende Person je sah, an welches Gremium der Vorschlag ging – ohne das lässt sich A4 gar nicht beurteilen; (d) das Auflösen eines Amtes fragte nicht nach (guidelines §2) |
| 2026-09-10 | Nebenbefund aus UC-030 geschlossen: `notify()` stellt seit `0047` unter der Kategorie `input` zu, die in `PUSH_CATEGORIES` fehlte – sie war in den Einstellungen nicht abschaltbar |
| 2026-09-10 | Glossar in `docs/guidelines.md` um Anliegen, Amt, Gremium, Sitzung und Sitzungs-Input ergänzt; `docs/TESTING.md` §3 auf das tatsächlich verwendete Probe-Verfahren umgestellt |
| 2026-09-15 | Entscheid Sandro: **Sitzungen sind für Gremien, nicht für Teams.** Eine Teambesprechung ist ein Termin ihres Teams. `0095_board_meetings.sql`: `functionary_roles.is_board` als Verteiler «Vorstand»; `events` verlangt bei `type = meeting` ein Gremium und kein Team; `event_audience()` als **einzige** Definition des Termin-Kreises für Ankündigung, Absage, Erinnerung und Nachfrage; `event_in_scope()` gibt einen Gremiumstermin nur seinem Gremium frei. Vier Funktionen hatten den Kreis vorher je eigen ausgeschrieben – drei davon ohne Gremium (FR-095, FR-096, FR-179 bis FR-181, BR-237, BR-238) |
| 2026-09-15 | Verhaltensprobe gegen die verknüpfte Datenbank, 10 von 10: Sitzung ohne Gremium und Sitzung mit Team werden abgewiesen; ohne Amt und mit fremdem Amt bleibt sie unsichtbar; mit dem Amt des Gremiums sichtbar – **auch über eine blosse Sitzzeile**, also ohne die Spiegel-Spalte; Kreis der Sitzung 1 von 1, Kreis des Vereinstermins 1 von 1, Kreis des Teamtermins ohne Teammitglied 0 |
| 2026-09-15 | App-Seite: Gremiums-Auswahl im Terminformular (voreingestellt Vorstand), Schalter «Gehört zum Vorstand» am Amt, Vorschläge in der Sammelansicht antippbar (A5); vier Sprachen, 1766 Schlüssel |

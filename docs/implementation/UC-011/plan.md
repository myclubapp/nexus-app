# Implementation Plan: UC-011 — Helfer-Event mit Schichten ausschreiben

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand                                                            |
| **Goal**          | Einen Anlass mit mehreren Schichten so ausschreiben, dass sich Mitglieder gezielt eintragen können |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | Done                                                                |

## Overview

Ein Helfer-Event ist ein Termin mit Schichten: Jede trägt Zeitfenster,
Personalbedarf und ihren eigenen Punktwert, weil ein halber Tag anders zählt
als ein ganzer (BR-042). Publiziert wird nur mit ausgefülltem Warum (BR-043);
bis dahin bleibt das Event ein Entwurf, der weder sichtbar ist noch jemanden
benachrichtigt (A2).

Dazu kommt die leiseste Regel des ganzen Projekts: Wenn ein Verein seit vier
Wochen nur noch um Hilfe bittet und nichts erzählt hat, unterbleibt der
Aufruf-Push, bis wieder eine Verbindungs-Nachricht ausging (BR-044, K1).

## Related Use Cases

- UC-009 Termin erstellen — A3 dort führt hierher
- UC-012 Helfer-Schicht übernehmen — die Gegenseite
- UC-013 Helfer-Schicht bestätigen — löst die Punkte je Schicht aus
- UC-026 News publizieren und UC-027 Vereins-Puls — füllen den Zähler, aus dem
  sich die sanfte Sperre speist

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                      | User Story (Kurz)                              | Status      | Notizen                                                    |
| ------ | -------------------------- | ---------------------------------------------- | ----------- | ---------------------------------------------------------- |
| FR-030 | Helfer-Event mit Schichten | Anlass mit Zeitfenstern und Personalbedarf     | Implemented | `HelperEventForm`; Schichten mit eigenem Punktwert          |
| FR-051 | Warum-Pflichtfeld          | Zu jedem Aufruf lesen, wozu er dient           | In Progress | Für das Helfer-Event erfüllt; Aufgabe und Amt folgen in UC-014 |
| FR-084 | Symmetrie-Hinweis          | Warnen, wenn nur Aufrufe ausgingen             | Partial     | Die sanfte Sperre steht; der Hinweis im Vorstand ist UC-027 |

### Business Rules

| ID     | Regel                                | Status      | Notizen                                                                 |
| ------ | ------------------------------------ | ----------- | ----------------------------------------------------------------------- |
| BR-041 | Jede Schicht trägt ihren Personalbedarf | Implemented | `needed >= 1` als Constraint; `shiftCoverage()` zeigt die Unterdeckung – seit dem Review auch **angeschlossen** |
| BR-042 | Punktwert je Schicht                  | Partial     | Der Wert wird erfasst und gespeichert, aber **nicht gebucht**: `confirm_shift()` nimmt weiter den Regelwert. Fällig in UC-013, siehe Risiko 7 |
| BR-043 | Warum ist Publikationsvoraussetzung   | Implemented | Zweifach: Constraint am publizierten Event, Prüfung in `publish_event()` |
| BR-044 | Verbindung vor Aufruf                 | Partial     | Die Mechanik steht und ist nachgemessen; `kind = 'connection'` schreibt aber erst UC-027, und der Schalter fehlt (Lücke 3) |

### Non-Functional Requirements

| ID      | Titel                 | Kategorie    | Trifft zu | Notizen                                                         |
| ------- | --------------------- | ------------ | --------- | --------------------------------------------------------------- |
| NFR-013 | Funktionsrechte       | Security     | Ja        | `log_club_message()` bleibt intern                              |
| NFR-011 | Mandantentrennung     | Security     | Ja        | Policy **und** Funktionsrecht: `last_connection_at()` und `call_is_muted()` sind seit 0021 für `authenticated` gesperrt |
| NFR-022 | Keine Verhaltensdaten | Security     | Ja        | Der Zähler trägt nie einen Personenbezug                        |
| NFR-009 | Push-Fallback         | Availability | Ja        | Auch der gedrosselte Aufruf bleibt in Agenda und Marktplatz      |
| NFR-028 | Sprachparität         | Usability    | Ja        | Auch der Hinweis auf die sanfte Sperre                          |

---

## Current State

- `supabase/migrations/0020_event_draft_defaults.sql`: Vorgabewert `now()` für
  `published_at`; der Warum-Constraint greift am publizierten Event statt schon
  beim Anlegen. Beim Selbst-Review aufgefallen, siehe Fund 1 und 2.
- `supabase/migrations/0019_shift_points.sql`: `event_shifts.points` – die
  Schicht trägt ihren Wert selbst (BR-042), wie eine Aufgabe.
- `supabase/migrations/0018_helper_events.sql`: `events.published_at` (A2),
  verbindliche Schichtfelder mit Zeit- und Bedarfs-Constraint,
  `club_message_log` samt `log_club_message()`, `last_connection_at()`,
  `call_is_muted()`, `publish_event()`; Lese-Policies verbergen Entwürfe.
- `app/src/lib/shift.ts`: Punktvorschlag nach Dauer, Schichtprüfung,
  Besetzung und Überschneidung – reine Logik, 19 Tests.
- `app/src/hooks/useHelperEvents.ts`: anlegen und ausschreiben.
- `app/src/components/HelperEventModal.tsx`: Formular mit wachsender
  Schichtenliste, Entwurf und Publikation.
- `app/src/pages/AgendaPage.tsx`: zweiter Knopf in der Kopfzeile; der Entwurf
  trägt ein Merkmal und lässt sich von der Liste aus ausschreiben (A2).

---

## Missing Pieces

| #   | Was fehlt                                                                  | Anforderung | Quelle          |
| --- | -------------------------------------------------------------------------- | ----------- | --------------- |
| 1   | Das Event erscheint noch nicht im **Marktplatz** – nur in der Agenda        | Postcondition | Automated     |
| 2   | A4: Ein bestehender Termin lässt sich nicht in ein Helfer-Event umwandeln    | FR-030      | Cross-reference |
| 3   | Die Einstellung «sanfte Sperre» hat keinen Schalter in den Vereinseinstellungen | BR-044   | Automated       |
| 4   | Ein Entwurf lässt sich ausschreiben, aber nicht mehr **bearbeiten**          | A2          | Automated       |

---

## Implementation Guidelines

- **UI-Komponenten:** `FormModal`, `ListSection`, `IonItemSliding` für das
  Entfernen einer Schicht, `InlineError`, `useToast()`. Kein neues Bauteil.
- **Styling:** nur Klassen aus `src/theme/variables.css`.
- **Struktur:** Blatt unter `src/components/`, Logik in `src/lib/shift.ts`,
  Datenzugriff in `src/hooks/useHelperEvents.ts`.

---

## Implementation Tasks

- [x] 1. Migration `0018_helper_events.sql`: `published_at`, verbindliche
      Schichtfelder, Constraints für Zeit und Bedarf.
- [x] 2. Lese-Policies auf `events` und `event_shifts`, die Entwürfe verbergen –
      in der Policy und nicht in der Abfrage (A2).
- [x] 3. `club_message_log` mit `log_club_message()` als interner Routine.
- [x] 4. `last_connection_at()` und `call_is_muted()` für die sanfte Sperre.
- [x] 5. `publish_event()`: Warum-Prüfung, mindestens eine Schicht,
      Zustellung, Eintrag in den Zähler.
- [x] 6. `src/lib/shift.ts` mit Punktvorschlag, Prüfung, Besetzung.
- [x] 7. `useHelperEvents.ts` mit Anlegen und Ausschreiben.
- [x] 8. `HelperEventForm` mit wachsender Schichtenliste und Entwurf.
- [x] 9. Einstieg in der Agenda, nur für Trainer:innen und Vorstand.
- [x] 10. **i18n-Vollständigkeit** — vier Sprachen, mit Plural für Schichten
      und Personenzahl.
- [x] 11. **Verdrahtung und Fehlerrückmeldung** — Entwurf, Publikation und
      gedrosselter Aufruf melden sich jeweils eigen zurück.
- [x] 12. Vitest für `shift.ts` (19 Tests).
- [x] 13. Migration `0019_shift_points.sql`: `event_shifts.points`. Beim
      Selbst-Review aufgefallen – das Formular erhob einen Punktwert je
      Schicht, den nichts speicherte, und BR-042 wäre damit unerfüllt geblieben.
- [x] 14. Beide Migrationen über `supabase db push` deployt (statt über MCP –
      so entsteht keine Versionsdrift).
- [x] 15. Manueller Testplan `docs/test-plans/uc-011-helfer-event.md`.
- [x] 16. **Statusabgleich** — FR-030 und FR-051 auf `Implemented`.
- [x] 17. Migration `0020_event_draft_defaults.sql`: Vorgabewert für
      `published_at` und der Warum-Constraint am publizierten Event. Zwei Fehler
      aus 0018/0015, die der Selbst-Review zutage förderte — siehe Fund 1 und 2.
- [x] 18. **Entwurf ausschreiben** aus der Agenda heraus, mit Merkmal am Eintrag;
      erst damit ist A2 keine Sackgasse.
- [x] 19. **Verhaltensprüfung gegen die laufende Datenbank** — zwölf Prüfungen
      über `supabase db query --linked`, in einer zurückgerollten Transaktion.
- [ ] 20. **Marktplatz-Anzeige** des Helfer-Events (Postcondition).
- [ ] 21. **Plattform-Parität** — Schichtenliste und Wischgeste auf iOS,
      Android und im Browser.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                                                    | Impact | Owner       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | ~~Die Verhaltensprüfung fehlt.~~ **Erledigt.** Der Weg führt ohne MCP und ohne Docker über `supabase db query --linked`: Die Prüfungen laufen in einem `do`-Block, der zum Schluss eine Exception wirft und damit alles zurückrollt. Zwölf Prüfungen, alle wie erwartet. | — | Dev |
| 2   | **Spec-Lücke:** Das Entitätsmodell kennt für EVENT keinen Entwurfszustand, A2 verlangt ihn. Angenommen: `published_at is null` heisst Entwurf. Der Zeitstempel beantwortet zugleich, *wann* ausgeschrieben wurde – das braucht die Verbindungs-Quote. | Medium | Stakeholder |
| 3   | **Spec-Lücke:** Schritt 5 nennt «eine Punkteregel passend zur Dauer», aber keine Stufen. Angenommen: bis 2 h 25 Punkte, bis 5 h 50, darüber 100. Bewusst grob – es ist ein Vorschlag, den der Vorstand überschreibt. Durch Test festgehalten. | Medium | Stakeholder |
| 4   | **Spec-Lücke:** BR-044 nennt «kürzlich versendeter Vereins-Puls» ohne Frist. Angenommen: vier Wochen, passend zu A3. Ein Verein, der **noch nie** eine Verbindungs-Nachricht versendet hat, wird **nicht** gebremst – sonst käme ein neuer Verein nie zu seinem ersten Helferaufruf. | Medium | Stakeholder |
| 7   | `confirm_shift()` aus 0003 bucht noch den **Regelwert** statt `event_shifts.points`. Damit zählt jede Schicht gleich viel, entgegen BR-042. Der Code-Review hat eine zweite Ebene gefunden: Der Ledger dedupliziert über `(member_id, rule_code, source_id)` mit `source_id = event_id`, und `attendance` hat den Primärschlüssel `(event_id, member_id)` – zwei Schichten desselben Events wären also **gar nicht getrennt buchbar**. Der Umbau braucht `source_id = shift_id` und den erweiterten Schlüssel aus UC-012. **Fällig in UC-013.** | High | Dev |
| 8   | `event_shifts.point_rule_code` ist jetzt `not null`; bestehende Zeilen wurden auf `shift_done` gesetzt. Ein Verein, der diese Regel gelöscht hat, hat damit Schichten mit einem Code ohne Regel – `award_points()` bucht dann still nichts. | Low | Dev |

---

## Befunde des Code-Reviews (`ai-code-review`)

Dreizehn Befunde, davon acht behoben, drei als Lücke oder Folge-Use-Case
eingeordnet, zwei als Statuskorrektur an diesem Dokument selbst.

| #   | Befund                                                                                                                                                             | Schwere | Erledigt in                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------- |
| S2  | `last_connection_at()` und `call_is_muted()` waren `security definer` **ohne Rollenprüfung** und für `authenticated` ausführbar – jedes Konto las über `/rest/v1/rpc` mit fremder `club_id` genau das, was `club_message_log_read` dem Vorstand vorbehält. | Hoch | 0021 (`revoke`), nachgemessen |
| S3  | 0018 macht Constraints scharf, ohne die Daten dafür zu bereinigen: eine einzige Zeile mit `needed = 0` oder `ends_at <= starts_at` – unter 0003 beides erlaubt – hätte die ganze Migration zum Scheitern gebracht. | Mittel | 0018 (Backfill ergänzt)      |
| S4  | Über das gewöhnliche Terminformular entstand ein sofort ausgeschriebenes Helfer-Event **ohne Schichten**; die Postcondition war am geprüften Weg vorbei verletzt. | Mittel | `EventFormModal` (Typ entfernt) + `create_helper_event()` |
| S6  | Die Unterdeckung zählte `shift_id` ohne Statusfilter – eine Schicht galt als besetzt, aus der sich längst jemand abgemeldet hatte. `shiftCoverage()` war geschrieben, getestet und **nirgends importiert**. | Mittel | `AgendaPage.tsx`             |
| S8  | `0` diente als Sentinel für «noch nichts gewählt» – damit liess sich der Punktwert **0** nicht eingeben, obwohl Schema und Nur-Dank-Modus ihn vorsehen. | Mittel | `HelperEventModal` (eigener Zustand) |
| S9  | `publish_event()` war nicht idempotent: Ein zweiter Tipp schickte allen Mitgliedern eine **zweite** Nachricht. Ein abgesagter Termin liess sich ausschreiben. | Mittel | 0021, nachgemessen           |
| S10 | A1 verlangt, die Publikation zu verweigern **und zu erklären**; erklärt wurde nur die fehlende Schicht, nicht das fehlende Warum. | Niedrig | `HelperEventModal`          |
| S11 | `mutateAsync` ohne `catch` → offene Rejection. Schwerer: Scheiterte der Schicht-Insert nach dem Event-Insert, blieb ein Entwurf ohne Schichten zurück, den niemand mehr erreicht. | Niedrig | `create_helper_event()` – eine Funktion, eine Transaktion |
| S12 | Ausschreiben stand Trainer:innen offen, obwohl die Precondition admin nennt und ein Helferaufruf **den ganzen Verein** erreicht. | Niedrig | 0021 + `AgendaPage.tsx`      |
| S13 | Die `attendance`-Policies kannten den Entwurf nicht – wer seine UUID kannte, konnte sich eintragen. | Niedrig | 0021, nachgemessen           |
| S1  | BR-042 wirkt nicht: `confirm_shift()` bucht den Regelwert. Zusätzlich dedupliziert der Ledger über `source_id = event_id`, weshalb zwei Schichten desselben Events gar nicht getrennt buchbar wären. | Hoch | **Offen** – UC-013, Risiko 7 |
| S5  | A4 (bestehenden Termin umwandeln) fehlt; ein Entwurf lässt sich weder bearbeiten noch löschen. | Mittel | **Offen** – Lücke 2 und 4    |
| S7  | BR-044 ist unerreichbar, weil `kind = 'connection'` niemand schreibt, und nicht konfigurierbar. | Mittel | **Offen** – Lücke 3, UC-027  |

Zwei Nebenbefunde: `HelperEventModal` hatte keinen Vitest-Test (nachgeholt),
und der gedrosselte Aufruf meldete sich über `toast.failure`, obwohl die
Schreibaktion durchging (guidelines §5, korrigiert).

---

## Befunde des Selbst-Reviews

| #   | Fund                                                                                                                                                                                                                                                                                          | Behoben in |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | **0018 machte jeden neuen Termin unsichtbar.** `published_at` bekam keinen Vorgabewert, und der gewöhnliche Weg aus UC-009 setzt die Spalte nicht – seit 0018 entstand jeder erfasste Termin als Entwurf, den die Lese-Policy vor den Mitgliedern verbirgt. FR-021, FR-022 und FR-024 waren gebrochen, ohne eine einzige Fehlermeldung. | 0020 |
| 2   | **A2 stand im Widerspruch zum Schema.** Der Warum-Constraint aus 0015 verlangte das Warum schon beim Anlegen; «Entwurf sichern» ohne Warum endete in einer Constraint-Verletzung statt in einem Entwurf. BR-043 heisst *Publikations*voraussetzung – der Constraint greift jetzt am publizierten Event. | 0020 |
| 3   | **Der Entwurf war eine Sackgasse.** Er liess sich sichern, aber nirgends wieder ausschreiben. Jetzt trägt er in der Agenda ein Merkmal und einen Knopf. | `AgendaPage.tsx` |

---

## Progress Log

| Datum      | Update                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-09 | Plan erstellt und umgesetzt: Migration 0018, `shift.ts`, `useHelperEvents.ts`, `HelperEventModal`, Einstieg in der Agenda. 233 Vitest-Tests grün. |
| 2026-09-09 | Migration über `supabase db push` deployt – der Weg, der keine Versionsdrift erzeugt. Die **Verhaltensprüfung gegen die Datenbank steht aus**: Der Supabase-MCP verlangt seit dieser Sitzung eine Anmeldung, Docker läuft nicht. Als Risiko 1 vermerkt. |
| 2026-09-09 | Selbst-Review: drei Fehler gefunden, davon zwei schwerwiegend (Fund 1 und 2). Migration `0020_event_draft_defaults.sql` geschrieben und deployt, Entwurf in der Agenda ausschreibbar gemacht. |
| 2026-09-09 | Risiko 1 aufgelöst: `supabase db query --linked` ersetzt den MCP. Zwölf Prüfungen gegen die laufende Datenbank – Entwurf, Warum an beiden Stellen, alle drei Schicht-Constraints, Punktwert je Schicht, `publish_event()` und alle vier Fälle der sanften Sperre. Alles wie erwartet, ohne Rückstände. |
| 2026-09-09 | Testplan `docs/test-plans/uc-011-helfer-event.md` (elf Testfälle), FR-030 auf `Implemented`, FR-051 auf `In Progress`. 233 Vitest-Tests, i18n 403 Schlüssel, typecheck sauber. |
| 2026-09-09 | `ai-code-review`: dreizehn Befunde. Acht behoben (Migration `0021_helper_event_hardening.sql`, Backfill in 0018, vier Stellen im Frontend), drei als Folge-Use-Case eingeordnet, zwei Statusangaben in diesem Dokument korrigiert – BR-042 und BR-044 standen zu Unrecht auf «Implemented». |
| 2026-09-09 | Nachmessung von 0021 gegen die laufende Datenbank: zehn Prüfungen als Vorstand, acht als eigens angelegtes gewöhnliches Mitglied (Funktionsrechte, Entwurfs-Sichtbarkeit, Eintragssperre, Rollengrenze). Alles wie erwartet. |

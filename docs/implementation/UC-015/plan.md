# Implementation Plan: UC-015 — Unentschlossene erinnern

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Trainer:in                                                          |
| **Goal**          | Vor einem Termin eine belastbare Teilnehmerzahl erhalten             |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | Done                                                                |

## Overview

Der leiseste Eingriff im ganzen System und der am leichtesten zu
missbrauchende: Ein Knopf, der jedem Mitglied eine Nachricht schickt, wird
ohne Grenze zum Ärgernis. Deshalb steht die Frist in der Datenbank und nicht
im Knopf (BR-060), und der Empfängerkreis ergibt sich aus der Antwortlage –
nicht aus einer Auswahl, die jemand trifft (BR-059).

Die dritte Regel ist die feinste: Eine Erinnerung zählt in der
Verbindungs-Quote **weder** als Verbindung **noch** als Aufruf (BR-061). Ein
Verein, der nur noch erinnert, hat weder etwas erzählt noch um Hilfe gebeten –
die sanfte Sperre aus UC-011 soll das weder belohnen noch bestrafen.

## Related Use Cases

- UC-010 Zu- oder absagen — die Antwort, um die hier gebeten wird
- UC-009 Termin erstellen — `announce_event()` folgt demselben Empfängerkreis
- UC-011 Helfer-Event — dort zählt `club_message_log`, hier ausdrücklich nicht
- UC-027 Vereins-Puls — die andere Seite der Verbindungs-Quote

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                    | Status      | Notizen                                              |
| ------ | ------------------------ | ----------- | ---------------------------------------------------- |
| FR-028 | Unentschlossene erinnern | Implemented | `remind_undecided()`, Rückfrage mit Anzahl            |
| FR-078 | In-App-Inbox             | Implemented | Nachgezogen: Ohne sie wäre die Erinnerung nicht abholbar gewesen |
| FR-027 | Teilnehmerstand sehen    | Implemented | `tallyAttendance()` und `count_undecided()` verwenden **dieselbe** Grundgesamtheit – seit 0032 auch wirklich |

### Business Rules

| ID     | Regel                                | Status      | Notizen                                                            |
| ------ | ------------------------------------ | ----------- | ------------------------------------------------------------------ |
| BR-059 | Nur Unentschlossene                  | Implemented | Nachgemessen: null Zustellungen an Zu- und Absagende                |
| BR-060 | Höchstens eine Erinnerung pro Tag    | Implemented | `reminded_at`; ein Aufruf ohne Empfänger verbraucht die Frist nicht |
| BR-061 | Erinnerung ist eine Verbindung, kein Aufruf | Implemented | Kein `log_club_message()`; nachgemessen: null Einträge        |
| BR-062 | Antwort direkt aus der Benachrichtigung | Implemented | Die Inbox führt den Link aus, die Agenda hebt den Termin hervor und scrollt hin |

---

## Umsetzung

- `supabase/migrations/0031_remind_undecided.sql`
  - `events.reminded_at` – Schritt 7 und die Grundlage von A1.
  - `count_undecided()` für Schritt 4: Die Zahl steht in der Frage, nicht erst
    in der Antwort.
  - `remind_undecided()` mit Rollenprüfung, Frist und Empfängerkreis.
  - `send_due_reminders()` samt stündlichem Cron-Auftrag für A3 – nur für
    Vereine, die es ausdrücklich aktiviert haben.
- `app/src/hooks/useReminders.ts`, Rückfrage und Einstieg in `AgendaPage`.

---

## Verhaltensprüfung gegen die laufende Datenbank

Neunzehn Prüfungen, in einer Transaktion, die sich zum Schluss selbst
zurückrollt. Drei Mitglieder auf Zeit, davon eines zusagend, eines absagend.

| #  | Prüfung                                           | Ergebnis                    |
| -- | --------------------------------------------------- | --------------------------- |
| 1  | `count_undecided()`                                 | 2                           |
| 2  | Erinnert                                            | 2 (BR-059)                  |
| 3  | Zustellung an Zusagende                             | **0**                       |
| 4  | Zustellung an Absagende                             | **0**                       |
| 5  | Zustellung an Unentschlossene                       | 1                           |
| 6  | Link führt zum Termin                               | ja (BR-062)                 |
| 7  | `reminded_at` vermerkt                              | ja (Schritt 7)              |
| 8  | Eintrag in `club_message_log`                       | **0** (BR-061)              |
| 9  | Zweite Erinnerung sofort                            | 0 (BR-060)                  |
| 10 | Zeitpunkt der letzten Erinnerung zurückgegeben      | ja (A1)                     |
| 11 | Nach 25 Stunden                                     | 2                           |
| 12 | `count_undecided()` nach allen Antworten            | 0                           |
| 13 | Erinnern ohne Offene                                | 0 (A2)                      |
| 14 | `reminded_at` bleibt dabei leer                     | ja – die Frist wird nicht verbraucht |
| 15 | Team-Termin                                         | 1 – nur das Team            |
| 16 | Mitglied erinnert                                   | abgewiesen                  |
| 17 | `remind_undecided_internal` für `authenticated`     | kein Recht                  |
| 18 | Cron-Auftrag angelegt                               | 1                           |
| 19 | Zeitplan                                            | `7 * * * *`                 |

---

## Befunde des Code-Reviews (`ai-code-review`)

Elf Befunde. Die Serverseite hielt der Prüfung stand, bis auf drei Stellen –
und zwei Befunde deckten auf, dass die App an anderer Stelle rechnete als die
Datenbank.

| #  | Befund                                                                                                                                                     | Schwere | Erledigt in |
| -- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| 1  | **Die Zahl in der Rückfrage kam aus einer Subtraktion, nicht aus dem Empfängerkreis.** `count_undecided()` war geschrieben, geprüft – und wurde nie gerufen. Ein Mitglied ohne Anmeldekonto zählte die App mit, der Server nicht; ein als abwesend Vermerkter galt der App als offen, dem Server als beantwortet. Die Rückfrage nannte damit eine Zahl, die niemand erhielt. | Hoch | `attendance.ts`, `AgendaPage.tsx` |
| 2  | **Jede Rückgabe `0` erzeugte die A1-Meldung** – auch wenn nie erinnert worden war. Der Toast behauptete dann grün «wurde am ␣ bereits erinnert», mit leerem Datum. | Mittel | `reminder.ts` (`noneLeft`) |
| 3  | **BR-060 hielt bei Nebenläufigkeit nicht.** Zwei Trainer:innen – oder eine und der Cron-Lauf – lasen beide `reminded_at is null` und schickten beide. | Mittel | 0032 (`for update`) |
| 4  | **Die interne Fassung trug den Kreis, aber keinen Wächter.** Sie verliess sich vollständig auf die `where`-Klausel ihres einen Aufrufers. | Mittel | 0032 – Wächter und Kreis nach innen, `remind_undecided()` wird die Hülle mit der Rollenprüfung |
| 5  | **`count_undecided()` war ein offener Endpunkt**: `security definer`, ohne Mitgliedschaftsprüfung. Mit einer fremden Termin-Id liess sich die Antwortlage eines fremden Vereins abfragen. | Mittel | 0032 |
| 7  | `send_due_reminders()` ohne Fehlerisolation und ohne Obergrenze: Ein klemmender Termin riss den ganzen Lauf mit, dauerhaft. Zudem feuerte A3 zweimal – bei T−48h und nochmals bei T−24h. | Niedrig–Mittel | 0032 |
| 8  | Fiel die Mitgliederabfrage aus, verschwand der Einstieg **lautlos** – ununterscheidbar von A2. | Niedrig–Mittel | `canRemind()` lässt ihn bei unbekannter Zahl stehen |
| 9  | Keine Zeile Test, und beide Entscheidungen lagen im Ereignis-Handler – entgegen TESTING.md §4. Genau dort sass Befund 2. | Mittel | `reminder.ts`, 8 Tests |
| 10 | Wer eine Schicht übernommen hat, gilt als unentschlossen. **Bewusst so:** Eine Schicht sagt, dass jemand hilft, nicht, dass er kommt. Jetzt im Code begründet. | Niedrig | dokumentiert |
| 6  | **Die Erinnerung war am anderen Ende nicht abholbar** – `notify()` schrieb die Zeile, aber keine Ansicht zeigte sie. Eine Erinnerung, die niemand sehen kann, ist keine. | Hoch | `InboxPage` (FR-078); Push bleibt offen (FR-079) |
| 11 | `announce_event()` kennt keine Frequenzsperre; wer erinnern will, kann stattdessen beliebig oft ankündigen. Gehört zu UC-009. | Niedrig | **Offen** |

Bestätigt hat der Review: A2 verbraucht die Frist nicht, der Empfängerkreis
deckt sich mit `announce_event()`, BR-061 hält (kein `log_club_message()` in
irgendeinem Pfad), die `revoke`-Zeilen sind vollständig, und der Cron-Auftrag
ist über seinen Namen idempotent.

---

## Missing Pieces

| #   | Was noch fehlt                                                                          | Anforderung | Quelle          |
| --- | ----------------------------------------------------------------------------------------- | ----------- | --------------- |
| 1   | `settings.reminders.autoRemind` hat **keinen Schalter** in den Vereinseinstellungen; A3 lässt sich nur über SQL aktivieren | A3 | Automated |
| 2   | Der **Push** fehlt weiterhin (FR-079). Die Inbox trägt jede Zustellung vollständig (NFR-009), erreicht aber nur, wer die App öffnet. | Schritt 6 | Cross-reference |
| 3   | Die Erinnerung hebt den Termin hervor, öffnet die Antwort aber nicht von selbst            | BR-062      | Automated       |
| 4   | Der Link trägt nur die Termin-Id, nicht den Verein. Wer in zwei Vereinen ist und den falschen aktiv hat, landet in einer Agenda ohne diesen Termin. | BR-062 | Automated |

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                          | Impact | Owner |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| 1   | ~~Zwei Kopien des Empfängerkreises.~~ **Erledigt in 0032:** Kreis und Wächter stehen in der internen Fassung, `remind_undecided()` ist die Hülle, die die Rolle prüft. Die Rollenprüfung sitzt damit weiterhin genau dort, wo sie war. | — | Dev |
| 2   | A3 löst jetzt **einmal** aus (`reminded_at is null`). Die Spezifikation liest sich so («der Termin beginnt in 48 Stunden»), sagt es aber nicht ausdrücklich. | Low | Stakeholder |
| 3   | Eine übernommene Schicht gilt nicht als Antwort auf den Termin. Vertretbar – aber BR-059 sagt «Mitglieder ohne Antwort», und ob eine Schicht eine Antwort ist, sollte die Regel entscheiden. | Low | Stakeholder |

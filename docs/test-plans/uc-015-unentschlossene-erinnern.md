# Manual Test Plan: UC-015 — Unentschlossene erinnern

**Use Case:** [UC-015](../use_cases/UC-015-unentschlossene-erinnern.md)
**Geltungsbereich:** Empfängerkreis, 24-Stunden-Frist, Rückfrage, automatische Erinnerung
**Anforderungen:** FR-027, FR-028
**Regeln:** BR-059 bis BR-062
**Erstellt:** 2026-09-09

## Vorbereitung

- **T** — Trainer:in, **M1** bis **M4** — Mitglieder des Teams «Aktive».
- **E1** Team-Termin «Aktive», Beginn **in 40 Stunden**.
  - **M1** hat zugesagt, **M2** abgesagt, **M3** und **M4** haben nicht geantwortet.
- **E2** Vereinstermin, Beginn in 40 Stunden, niemand hat geantwortet.
- **E3** Termin, der **bereits begonnen** hat.
- Migrationen `0031_remind_undecided.sql` und `0032_reminder_hardening.sql`
  sind eingespielt.

---

## TC-001: Erinnern (Hauptablauf)

**Priority:** High
**Preconditions:** Als **T** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Agenda öffnen, **E1** ansehen | Der Teilnehmerstand nennt Zusagen, Absagen und Offene getrennt (Schritt 2) | | |
| 2 | Nach «Erinnern» suchen | Der Knopf ist da | | |
| 3 | Ihn antippen | Eine Rückfrage nennt, **wie viele** erinnert werden – hier zwei (Schritt 4) | | |
| 4 | «Abbrechen» wählen | Nichts wird versendet | | |
| 5 | Erneut antippen und bestätigen | Toast «2 Personen wurden erinnert.» | | |
| 6 | Als **M3** Profil → «Nachrichten» öffnen | Eine Nachricht «Kommst du?» mit Titel und Zeitpunkt, als **Neu** gekennzeichnet | | |
| 7 | Die Nachricht antippen | Sie führt in die Agenda, **E1** ist hervorgehoben und sichtbar gescrollt (BR-062) | | |
| 7a | Zurück zu «Nachrichten» | Die Nachricht trägt kein «Neu» mehr | | |
| 8 | Direkt dort zusagen | Geht ohne Suchen | | |
| 9 | Als **M4** ebenso prüfen | Auch **M4** wurde erinnert | | |

---

## TC-002: Nur Unentschlossene (BR-059)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** (hat zugesagt) die Inbox prüfen | **Keine** Erinnerung | | |
| 2 | Als **M2** (hat abgesagt) die Inbox prüfen | **Keine** Erinnerung | | |
| 3 | Ein Mitglied **ohne Anmeldekonto** anlegen | Es wird **weder** in der Rückfrage **noch** im Teilnehmerstand als offen gezählt – niemand könnte es erreichen | | |
| 3a | Ein Mitglied über die Teilnehmerliste als **abwesend** vermerken | Es gilt als beantwortet, nicht als offen | | |
| 4 | Ein **ausgetretenes** Mitglied prüfen | Nicht erinnert | | |
| 5 | Bei **E1** (Team-Termin) die Zahl prüfen | Nur das Team «Aktive», nicht der ganze Verein | | |
| 6 | Bei **E2** (Vereinstermin) die Zahl prüfen | Der ganze Verein | | |
| 7 | Die Zahl in der Rückfrage mit dem Teilnehmerstand vergleichen | Beide nennen dieselbe Zahl Offener | | |

---

## TC-003: Die 24-Stunden-Frist (A1, BR-060)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Bei **E1** erinnern | 2 Personen | | |
| 2 | **Sofort** erneut erinnern | Toast nennt den **Zeitpunkt** der letzten Erinnerung und dass es höchstens einmal pro Tag geht | | |
| 3 | Die Inbox von **M3** zählen | **Eine** Nachricht, nicht zwei | | |
| 4 | Mit einem HTTP-Aufruf `remind_undecided` wiederholen | Rückgabe `notified = 0`; keine zweite Zustellung | | |
| 5 | Den Vermerk 25 Stunden zurückdatieren und erneut erinnern | Geht wieder | | |
| 6 | Zwei Geräte **gleichzeitig** erinnern lassen | Höchstens **eine** Zustellung je Person – die Sperre auf dem Termin serialisiert die Prüfung | | |
| 7 | Von Hand erinnern, während der Cron-Lauf denselben Termin bearbeitet | Ebenfalls nur eine Zustellung | | |

---

## TC-004: Niemand offen (A2)

**Priority:** High
**Preconditions:** Alle Betroffenen von **E2** haben geantwortet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **E2** in der Agenda ansehen | Der Knopf «Erinnern» **fehlt** | | |
| 2 | Mit einem HTTP-Aufruf `remind_undecided` auf **E2** | `notified = 0` | | |
| 3 | `reminded_at` von **E2** prüfen | Weiterhin **leer** – ein wirkungsloser Aufruf verbraucht die Frist nicht | | |
| 4 | Eine Person zieht ihre Antwort zurück, dann erinnern | Geht sofort, ohne Wartezeit | | |
| 5 | Die Agenda offen lassen, während die letzte offene Person zusagt, dann «Erinnern» | Meldung «Niemand ist mehr offen» – **nicht** «wurde bereits erinnert» mit leerem Datum | | |

---

## TC-005: Was nicht geht

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M3** (Mitglied) die Agenda ansehen | **Kein** Knopf «Erinnern» | | |
| 2 | Als **M3** mit einem HTTP-Aufruf `remind_undecided` | «Nur Trainer:innen und der Vorstand erinnern» | | |
| 3 | Bei **E3** (bereits begonnen) erinnern | Abgewiesen – der Termin hat begonnen | | |
| 4 | Einen abgesagten Termin erinnern | Abgewiesen | | |
| 5 | Einen Entwurf erinnern | Abgewiesen | | |
| 6 | Als **T** eines **anderen** Vereins | Abgewiesen (NFR-011) | | |
| 7 | Mit einem HTTP-Aufruf `remind_undecided_internal` | Kein Ausführungsrecht – interne Routine | | |
| 8 | Mit einem HTTP-Aufruf `send_due_reminders` | Ebenfalls kein Ausführungsrecht | | |
| 9 | Als Mitglied eines **fremden** Vereins `count_undecided` mit einer fremden Termin-Id | «Kein Mitglied dieses Vereins» – die Antwortlage bleibt verborgen (NFR-011) | | |

---

## TC-006: Die Erinnerung zählt nicht als Aufruf (BR-061)

**Priority:** High
**Preconditions:** Als **V** angemeldet, Zugriff auf `club_message_log`.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Stand von `club_message_log` notieren | — | | |
| 2 | Zehnmal an verschiedenen Terminen erinnern | — | | |
| 3 | `club_message_log` erneut ansehen | **Unverändert** – weder `call` noch `connection` | | |
| 4 | Die sanfte Sperre aus UC-011 prüfen | Ein Verein, der nur erinnert hat, gilt weiterhin als «lange nichts erzählt» | | |
| 5 | Ein Helfer-Event ausschreiben | Jetzt entsteht ein `call`-Eintrag – der Unterschied ist sichtbar | | |

---

## TC-007: Automatische Erinnerung (A3)

**Priority:** Medium
**Preconditions:** In `clubs.settings` steht `{"reminders": {"autoRemind": true}}`.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Einen Termin mit Beginn in **47 Stunden** und offenen Antworten anlegen | — | | |
| 2 | Den Cron-Auftrag `event-auto-reminders` laufen lassen | Die Offenen werden erinnert | | |
| 3 | Den Lauf in derselben Stunde wiederholen | Keine zweite Zustellung (BR-060) | | |
| 4 | Einen Termin in **60 Stunden** prüfen | **Nicht** erinnert – zu früh | | |
| 4a | Denselben Termin am Folgetag (T−24h) nochmals prüfen | **Nicht** erneut automatisch erinnert – A3 löst einmal aus | | |
| 5 | In einem Verein **ohne** die Einstellung | **Nicht** erinnert | | |
| 6 | Einen abgesagten und einen Entwurfs-Termin prüfen | Beide nicht erinnert | | |
| 7 | Einen Beispielinhalt prüfen | Nicht erinnert (BR-161) | | |

---

## TC-008: Vier Sprachen (C-007, NFR-028)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf Französisch die Rückfrage öffnen | Titel, Text und beide Knöpfe französisch | | |
| 2 | Bei **einer** offenen Person | Singular, nicht «1 personnes» | | |
| 3 | Bei mehreren | Plural | | |
| 4 | Die Erfolgsmeldung lesen | Französisch, mit der richtigen Zahlform | | |
| 5 | Die Frist-Meldung auslösen | Französisch, mit Datum in lokaler Schreibweise | | |
| 6 | Auf Italienisch und Englisch wiederholen | Wie oben | | |

---

## TC-009: Die Inbox trägt die Erinnerung (FR-078, NFR-009)

**Priority:** High
**Preconditions:** Als **M3** angemeldet, eine Erinnerung wurde versendet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Profil öffnen | Der Eintrag «Nachrichten» steht da | | |
| 2 | Ihn antippen | Die Liste zeigt die Erinnerung mit Titel, Text und Zeitpunkt | | |
| 3 | Die Überschrift lesen | «1 ungelesen» | | |
| 4 | Die Fussnote lesen | Sie erklärt, dass hier jede Benachrichtigung steht, auch ohne Push | | |
| 5 | Die Nachricht antippen | Führt zum Termin **und** markiert sie als gelesen | | |
| 6 | Zurückkehren | Kein «Neu» mehr; die Überschrift lautet «Alle Nachrichten» | | |
| 7 | Ohne Nachrichten | «Keine Nachrichten» statt einer leeren Fläche (NFR-037) | | |
| 8 | Auf Französisch prüfen | Titel, Kennzeichnung und Fussnote übersetzt | | |
| 9 | Mit Bedienhilfen durch die Liste gehen | Titel, Text und Kennzeichnung werden vorgelesen (NFR-027) | | |

---

## Test Matrix

| Device / Browser | OS / Version | Screen Size | Status |
| ---------------- | ------------ | ----------- | ------ |
| Chrome (latest) | macOS / Windows | Desktop | |
| Safari (latest) | macOS | Desktop | |
| Firefox (latest) | macOS / Windows | Desktop | |
| Safari | iOS 17+ | iPhone SE (klein) | |
| Safari | iOS 17+ | iPhone 15 | |
| Chrome | Android 14+ | Pixel 7 | |
| Safari | iPadOS 17+ | iPad Gen 11 | |

---

## Summary

| Test Case | Titel | Priority | Result |
| --------- | ----- | -------- | ------ |
| TC-001 | Erinnern | High | |
| TC-002 | Nur Unentschlossene | High | |
| TC-003 | Die 24-Stunden-Frist | High | |
| TC-004 | Niemand offen | High | |
| TC-005 | Was nicht geht | High | |
| TC-006 | Die Erinnerung zählt nicht als Aufruf | High | |
| TC-007 | Automatische Erinnerung | Medium | |
| TC-008 | Vier Sprachen | High | |
| TC-009 | Die Inbox trägt die Erinnerung | High | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

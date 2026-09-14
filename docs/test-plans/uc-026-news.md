# Manual Test Plan: UC-026 — Vereins-News publizieren

**Use Case:** [UC-026](../use_cases/UC-026-news-publizieren.md)
**Geltungsbereich:** Schreiben, Geltungsbereich, Inbox, Verbindungs-Quote, Korrigieren, Zurückziehen
**Anforderungen:** FR-076, FR-077, FR-078, FR-070 (teilweise)
**Regeln:** BR-109 bis BR-112
**Erstellt:** 2026-09-09

## Vorbereitung

- **V** — Vorstand, **TR** — Trainer:in von Team «Aktive».
- **M1** — Mitglied in «Aktive», **M2** — Mitglied ohne Team.
- Migration `0043_publish_news.sql` ist eingespielt.
- Für TC-005 ist eine News von der Vereins-Website übernommen (UC-038).

---

## TC-001: Vereins-News schreiben (Hauptablauf)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **TR** das Dashboard öffnen | Unten rechts steht das Plus «News schreiben» | | |
| 2 | Antippen | Das Blatt zeigt Titel, Text, Bild und Geltungsbereich (Schritt 2) | | |
| 3 | Ohne Titel publizieren wollen | Gesperrt, der Grund steht da | | |
| 4 | Titel und Text erfassen, «Ganzer Verein» lassen, publizieren | Toast «Publiziert. Alle Betroffenen haben sie in der Inbox.» | | |
| 5 | Den Feed auf dem Dashboard ansehen | Die News steht zuoberst als Karte: Bild (falls Link), Datum, Titel, Anriss auf drei Zeilen, unten der Chip mit dem Vereinsnamen; auf dem Tablet zwei, auf dem Laptop drei Karten nebeneinander | | |
| 5a | Die Karte antippen | Das Detail öffnet sich als Karte über der Seite mit dem ganzen Text; «Schliessen» links | | |
| 6 | Als **M2** die Inbox öffnen | Die News ist da (BR-110) | | |
| 7 | Als **M1** ebenso | Auch da | | |

---

## TC-002: Geltungsbereich (BR-109)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** eine News für Team «Aktive» publizieren | Sie entsteht | | |
| 2 | Als **M1** (im Team) Feed und Inbox prüfen | Beide zeigen sie | | |
| 3 | Als **M2** (ohne Team) Feed und Inbox prüfen | **Keines von beiden** | | |
| 4 | Als **M2** die News-Id direkt abfragen | Leer – die Policy hält, nicht nur die Abfrage | | |
| 5 | Als **TR** prüfen | Trainer:innen sehen alles – sie verantworten, was steht | | |

---

## TC-003: Verbindungs-Quote (BR-111)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `club_message_log` vor dem Publizieren zählen | — | | |
| 2 | Eine News publizieren | Ein Eintrag `connection` mit Referenz `news:club` kommt dazu | | |
| 3 | `clubs.settings.connection.muteCallsWithoutPulse` einschalten und die letzte Verbindung über 28 Tage zurücklegen | Ein Helferaufruf wird gebremst (UC-011 A3) | | |
| 4 | Eine News publizieren und den Helferaufruf wiederholen | Er geht wieder raus – die News hat die Sperre gelöst | | |

---

## TC-004: Korrigieren und Zurückziehen (A3, A4)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** die News-Karte antippen, im Detail unter «Verwalten» die Zeile «Bearbeiten» wählen | Das Detail schliesst, das Formular öffnet sich mit den bestehenden Werten | | |
| 2 | Den Hinweis im Blatt lesen | Er sagt, dass beim Speichern niemand erneut benachrichtigt wird | | |
| 3 | Speichern | Der Feed zeigt den neuen Text | | |
| 4 | Die Inbox eines Mitglieds prüfen | **Keine** zweite Nachricht (A3) | | |
| 5 | `club_message_log` prüfen | **Kein** zweiter Eintrag – eine Korrektur ist keine neue Verbindung | | |
| 6 | Die Karte antippen, unter «Verwalten» die rote letzte Zeile «Zurückziehen» wählen | Rückfrage «Bist du sicher» mit dem Titel; «Zurückziehen» rot, «Abbrechen» in der Vereinsfarbe | | |
| 6b | «Zurückziehen» bestätigen | Das Detail schliesst, Toast oben, die News verschwindet aus dem Feed | | |
| 7 | Die Inbox eines Mitglieds prüfen | Der Eintrag **bleibt** als Verlauf (A4) | | |
| 8 | Ihn antippen | Er führt ins Dashboard; die News ist dort nicht mehr | | |

---

## TC-005: Übernommene News der Website (UC-038)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine übernommene News antippen und zu «Verwalten» scrollen | «Bearbeiten» wird **nicht** angeboten | | |
| 2 | «Zurückziehen» ist verfügbar | Ja – sie lässt sich entfernen | | |
| 4 | Auf der Karte das Teilen-Symbol antippen | Auf dem Gerät öffnet sich das Teilen-Blatt mit dem Link zur Quelle; im Browser Toast «Link kopiert» | | |
| 3 | Den Grund verstehen | Eine Änderung ginge beim nächsten Abgleich verloren | | |

---

## TC-006: Rollen und Lesebestätigung (BR-112)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** das Dashboard öffnen und eine News antippen | **Kein** Plus unten rechts, **kein** Abschnitt «Verwalten» im Detail | | |
| 2 | Als **M1** `publish_news` direkt aufrufen | Abgewiesen | | |
| 3 | Als **V** nach einer Auswertung suchen, wer eine News gelesen hat | Es gibt keine (BR-112) | | |
| 4 | Als **V** fremde `notifications` abfragen | Leer | | |

---

## Vier Sprachen

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch, Italienisch und Englisch stellen | Formular, Hinweise und Meldungen sind übersetzt | | |

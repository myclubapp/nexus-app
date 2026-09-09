# Manual Test Plan: UC-017 — Aufgabe im Marktplatz ausschreiben

**Use Case:** [UC-017](../use_cases/UC-017-aufgabe-ausschreiben.md)
**Geltungsbereich:** Formular, Warum-Pflicht, Entwurf, Geltungsbereich, Dringlichkeit, Wiederholung, Fristablauf
**Anforderungen:** FR-050, FR-051, FR-056, FR-059 (teilweise)
**Regeln:** BR-068 bis BR-072
**Erstellt:** 2026-09-09

## Vorbereitung

- **V** — Vorstand (`admin`), **TR** — Trainer:in, **M1** — Mitglied im Team
  «Aktive», **M2** — Mitglied **ohne** Team.
- Team «Aktive» besteht, **TR** und **M1** gehören dazu.
- Migrationen `0033_task_marketplace.sql` und
  `0034_task_marketplace_hardening.sql` sind eingespielt.
- In den Punkteregeln ist `task_done` konfiguriert (UC-016).

---

## TC-001: Aufgabe ausschreiben (Hauptablauf)

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Marktplatz» öffnen | Grosser Titel, der «+»-Knopf oben rechts ist da (Schritt 1) | | |
| 2 | «+» antippen | Das Blatt öffnet sich als Karte über der Seite, nicht als Vollbild | | |
| 3 | Die Felder ansehen | Titel, Beschreibung, Kategorie, Warum, Punkte, Frist, Anzahl Übernehmende, Geltungsbereich, Wiederholung (Schritt 2) | | |
| 4 | Punktwert prüfen, **ohne** ihn anzufassen | Er entspricht der Vereinsregel `task_done` | | |
| 5 | Titel, Kategorie «Verpflegung», Warum, Frist in 10 Tagen erfassen | «Ausschreiben» wird bedienbar | | |
| 6 | «Ausschreiben» antippen | Toast «Aufgabe ausgeschrieben», das Blatt schliesst (Schritt 6) | | |
| 7 | Die Liste ansehen | Die Aufgabe steht unter «Offen», mit Warum, Kategorie, Frist und Punktzahl | | |
| 8 | Als **M1** die Inbox öffnen | Eine Nachricht mit dem Titel der Aufgabe, im Text das **Warum** (Schritt 7) | | |
| 9 | Die Nachricht antippen | Sie führt in den Marktplatz, die Aufgabe ist hervorgehoben und sichtbar gescrollt | | |
| 10 | Als **V** die Inbox öffnen | **Keine** Nachricht – wer ausschreibt, bekommt keinen Vorschlag | | |

---

## TC-002: Ohne Warum keine Publikation (A1, BR-069)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** ein neues Blatt öffnen und nur den Titel erfassen | «Ausschreiben» bleibt gesperrt | | |
| 2 | Den Text unter den Feldern lesen | Er **erklärt**, dass zu jeder Aufgabe gehört, wozu sie dient – nicht nur ein grauer Knopf | | |
| 3 | Das Warum ergänzen | Die Erklärung verschwindet, «Ausschreiben» wird bedienbar | | |
| 4 | Das Warum wieder leeren, «Als Entwurf sichern» wählen | Der Entwurf entsteht trotzdem (A3 verlangt kein Warum) | | |

---

## TC-003: Entwurf (A3)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** eine Aufgabe erfassen und «Als Entwurf sichern» wählen | Toast «Entwurf gesichert» | | |
| 2 | Die Liste ansehen | Der Entwurf steht unter «Entwürfe», mit der Fussnote, dass er niemanden benachrichtigt | | |
| 3 | Als **M1** den Marktplatz öffnen | Der Entwurf ist **nicht** zu sehen | | |
| 4 | Als **M1** die Inbox prüfen | **Keine** Nachricht zum Entwurf | | |
| 5 | Als **V** beim Entwurf «Ausschreiben» antippen | Er wandert nach «Offen», die Zustellung geht raus | | |
| 6 | Denselben Knopf ein zweites Mal auslösen (Liste neu laden, erneut versuchen) | Keine zweite Zustellung, keine Fehlermeldung | | |

---

## TC-004: Geltungsbereich (Schritt 4, Postcondition)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** eine Aufgabe für das Team «Aktive» ausschreiben | Die Aufgabe entsteht | | |
| 2 | Als **M1** (im Team) den Marktplatz öffnen | Die Aufgabe ist da und übernehmbar | | |
| 3 | Als **M2** (ohne Team) den Marktplatz öffnen | Die Aufgabe ist **nicht** da | | |
| 4 | Als **M2** die Inbox prüfen | **Keine** Nachricht | | |
| 5 | Als **TR** (Trainer:in) den Marktplatz öffnen | Die Aufgabe ist sichtbar – die ausschreibende Seite behält ihre Aufgaben im Blick | | |
| 6 | Eine Aufgabe **ohne** Team ausschreiben | **M1** und **M2** sehen sie beide | | |

---

## TC-005: Dringlichkeit (BR-072)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Aufgabe mit Frist in **10 Tagen** ausschreiben | Sie steht unter «Offen», ohne Hervorhebung | | |
| 2 | Eine Aufgabe mit Frist in **24 Stunden** ausschreiben | Sie steht unter «Drängt», mit gelbem Hinweis «Frist läuft ab» | | |
| 3 | Eine Aufgabe **ohne** Frist ausschreiben | Sie steht unter «Offen» und wird nie hervorgehoben | | |
| 4 | Die Abschnitte vergleichen | «Drängt» steht über «Offen» | | |

---

## TC-006: Punktwert und Nur-Dank (BR-068, FR-040)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den vorgeschlagenen Punktwert auf **50** ändern und ausschreiben | Die Liste zeigt «+50» – der Wert der Aufgabe, nicht der Regelwert | | |
| 2 | Das Punktefeld leeren | Der Vorschlag aus der Vereinsregel steht wieder da | | |
| 3 | Den Punktwert auf **0** setzen und ausschreiben | Die Liste zeigt «Nur Dank» statt «+0» | | |
| 4 | Den Punktwert auf **-5** setzen | «Ausschreiben» ist gesperrt und der Grund steht da | | |

---

## TC-007: Wiederkehrende Aufgabe (A2, FR-056)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Ein Blatt öffnen und den Abschnitt «Wiederholung» ansehen | Der Rhythmus ist **nicht** sichtbar, bevor «Wiederkehrend» eingeschaltet ist | | |
| 2 | «Wiederkehrend» einschalten | Das Feld «Alle wie viele Tage?» erscheint, vorbelegt mit 14 | | |
| 3 | Rhythmus 7, Frist in 3 Tagen, ausschreiben | Die Aufgabe entsteht | | |
| 4 | Als **M1** übernehmen, als **V** bestätigen (UC-019) | Die Aufgabe gilt als erledigt | | |
| 5 | Den Marktplatz neu laden | Eine **neue** Runde derselben Aufgabe steht offen, Frist um 7 Tage später | | |
| 6 | Als **M1** die Inbox prüfen | Auch die neue Runde wurde vorgeschlagen | | |
| 7 | Rhythmus 0 oder 1000 eingeben | «Ausschreiben» ist gesperrt und der Grund steht da | | |

---

## TC-008: Fristablauf (A4)

**Priority:** Medium
**Hinweis:** Der Lauf `task-expiry` läuft stündlich zur Minute 23; für den Test
lässt er sich mit `select public.expire_tasks();` auslösen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Aufgabe mit Frist **in der Vergangenheit** anlegen (über SQL) und ausschreiben, niemand übernimmt sie | Sie steht mit rotem «Frist abgelaufen» unter «Drängt» | | |
| 2 | `expire_tasks()` auslösen | Die Aufgabe wechselt nach «Abgelaufen» | | |
| 3 | Als **M1** den Marktplatz öffnen | Die abgelaufene Aufgabe ist **nicht** zu sehen | | |
| 4 | Als **V** die Inbox öffnen | Nachricht «Frist abgelaufen» mit dem Titel der Aufgabe | | |
| 5 | Die Nachricht antippen | Sie führt in den Marktplatz, die Aufgabe ist im Abschnitt «Abgelaufen» hervorgehoben – **kein** Leerlauf | | |
| 6 | Eine überfällige Aufgabe, die **übernommen** wurde, prüfen | Sie läuft **nicht** ab – wer angefangen hat, verliert sie nicht (UC-018 A4) | | |
| 7 | `expire_tasks()` erneut auslösen | Keine zweite Nachricht | | |

---

## TC-009: Rollen (Precondition, BR-071)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** den Marktplatz öffnen | **Kein** «+»-Knopf | | |
| 2 | Als **TR** den Marktplatz öffnen | Der «+»-Knopf ist da, das Ausschreiben gelingt | | |
| 3 | Als **M1** `create_task` direkt aufrufen (REST) | Abgewiesen: «Nur Trainer:innen und der Vorstand schreiben Aufgaben aus» | | |
| 4 | Prüfen, ob sich einem Mitglied eine Aufgabe **zuweisen** lässt | Es gibt keinen solchen Weg – eine Aufgabe ist immer ein Angebot | | |

---

## TC-010: Sanfte Sperre (K1, BR-044)

**Priority:** Low

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `clubs.settings.connection.muteCallsWithoutPulse` auf `true` setzen und die letzte Verbindungs-Nachricht älter als 28 Tage machen | — | | |
| 2 | Eine Aufgabe ausschreiben | Toast erklärt: ausgeschrieben, aber ohne Push, zuerst einen Vereins-Puls senden | | |
| 3 | Den Marktplatz als **M1** ansehen | Die Aufgabe ist **sichtbar** – die Sperre unterdrückt die Zustellung, nicht die Sichtbarkeit | | |
| 4 | `club_message_log` prüfen | Der Eintrag `task:<Kategorie>` als `call` ist da, auch bei stiller Zustellung | | |

---

## Vier Sprachen

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch, Italienisch und Englisch stellen | Formular, Kategorien, Abschnitte und Meldungen sind übersetzt, kein Schlüssel steht im Klartext | | |

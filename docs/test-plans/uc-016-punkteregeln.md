# Manual Test Plan: UC-016 — Punkteregeln konfigurieren

**Use Case:** [UC-016](../use_cases/UC-016-punkteregeln-konfigurieren.md)
**Geltungsbereich:** Regeln je Säule, Punktwerte, Aktivierung, Nur-Dank, Häufigkeitsgrenzen, eigene Regeln
**Anforderungen:** FR-035 bis FR-038, FR-040
**Regeln:** BR-063 bis BR-067
**Erstellt:** 2026-09-09

## Vorbereitung

- Ein Verein mit dem bei der Gründung gesäten Satz Regeln (UC-001).
- **V** — Vorstandskonto, **M** — einfaches Mitglied.
- Ein Mitglied mit **bestehenden Punktebuchungen**, für TC-002.
- Ein Weg, eine Buchung auszulösen: ein Termin mit Check-in (UC-014) oder eine
  manuelle Buchung (UC-021).
- Migration `0014_point_rules.sql` ist eingespielt.

---

## TC-001: Regeln nach Säulen (Schritt 1–2)

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Profil → «Punkteregeln» | Die Seite öffnet sich | | |
| 2 | Die Gliederung ansehen | Abschnitte je Säule, in fester Reihenfolge von 1 bis 7 | | |
| 3 | Die Säulennamen lesen | Trainingsengagement, Wettkampf, Freiwilliges Engagement, Vereinsleben, Wachstum & Treue, Verlässlichkeit, Marktplatz | | |
| 4 | Eine Zeile ablesen | Bezeichnung, technischer Code und der Punktwert | | |
| 5 | Eine Säule ohne Regeln suchen | Sie erscheint **gar nicht**, statt leer dazustehen | | |
| 6 | Während des Ladens hinsehen | Ein **Skelett** in Listenform, kein Spinner | | |

---

## TC-002: Punktwert ändern wirkt nur nach vorne (Schritt 3–6, BR-063)

**Priority:** High
**Preconditions:** Als **V** angemeldet. Ein Mitglied hat eine Buchung über «Training besucht» mit 10 Punkten.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Punktestand des Mitglieds notieren | — | | |
| 2 | «Training besucht» öffnen | Blatt mit Bezeichnung, Wert, Aktivierung und Grenze | | |
| 3 | Die Fussnote lesen | Sie sagt, dass Änderungen nur für neue Buchungen gelten | | |
| 4 | Wert von 10 auf 25 ändern, speichern | Toast **oben** «Gespeichert – gilt für neue Buchungen» | | |
| 5 | Punktestand des Mitglieds erneut ansehen | **Unverändert** – die alte Buchung trägt weiter 10 (BR-063) | | |
| 6 | Eine neue Buchung derselben Art auslösen | Sie trägt **25** | | |
| 7 | Die Punktehistorie ansehen | Beide Buchungen stehen nebeneinander, mit ihren jeweiligen Werten | | |

---

## TC-003: Negative Werte sind ausgeschlossen (BR-066)

**Priority:** High
**Preconditions:** Als **V** angemeldet, ein Regel-Blatt offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Im Punktfeld «-5» eingeben und speichern | Der Wert wird **nicht** negativ gespeichert (0 oder abgewiesen) | | |
| 2 | Die Zeile in der Liste ansehen | Kein negativer Wert | | |
| 3 | Mit einem HTTP-Aufruf als **V** `PATCH /rest/v1/point_rules` mit `points: -5` | Abgewiesen – der Constraint hängt an der Tabelle | | |
| 4 | Beim Anlegen einer eigenen Regel «-10» eingeben | Ebenfalls nicht negativ | | |

---

## TC-004: Regel und ganze Säule schalten (A1, A2, FR-037, BR-067)

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Regel öffnen, den Schalter «Regel ist aktiv» **aus**, speichern | Die Zeile trägt das Kennzeichen «Aus» | | |
| 2 | Eine Buchung dieser Art auslösen | **Keine** Punkte, **kein** Fehler | | |
| 3 | Dashboard «Nächste Punkte» ansehen | Die stillgelegte Regel erscheint dort nicht mehr | | |
| 4 | Die Regel wieder **ein**schalten | Sie zählt wieder – sie wurde nicht gelöscht (BR-067) | | |
| 5 | Bei einer Säule «Alle aus» antippen | Alle Regeln dieser Säule tragen «Aus»; Toast erscheint | | |
| 6 | Die Regeln zählen | Sie sind **alle noch da**, nur stillgelegt | | |
| 7 | «Alle ein» antippen | Alle wieder aktiv | | |
| 8 | Als **M** eine Buchung der abgeschalteten Säule auslösen | Keine Punkte | | |

---

## TC-005: Nur-Dank-Modus (A4, FR-040)

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine **aktive** Regel auf den Wert **0** setzen, speichern | Die Zeile zeigt das Kennzeichen «Nur Dank» statt einer Zahl | | |
| 2 | Den Unterschied zu «Aus» prüfen | Eine ausgeschaltete Regel trägt «Aus», eine Nur-Dank-Regel «Nur Dank» – **zwei verschiedene Zustände** | | |
| 3 | Die Fussnote im Blatt lesen | Sie erklärt beide Zustände | | |
| 4 | Eine Buchung dieser Art auslösen | Keine Punktzahl; der Beitrag zählt trotzdem als Anlass | | |
| 5 | Wert wieder auf 10 setzen | Das Kennzeichen verschwindet, die Zahl erscheint | | |

---

## TC-006: Häufigkeitsgrenze (A5, BR-065)

**Priority:** High
**Preconditions:** Als **V** angemeldet. «Training besucht» hat aus der Vorlage `max_per_week: 4`.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Regel öffnen | Der Abschnitt «Häufigkeitsgrenze» zeigt **4** und «Woche» | | |
| 2 | Die Zeile in der Liste ansehen | Sie nennt «höchstens 4 je Woche» | | |
| 3 | Grenze auf **2 je Woche** setzen, speichern | Übernommen | | |
| 4 | Drei Buchungen derselben Art in derselben Woche auslösen | Nur die **ersten zwei** ergeben Punkte, die dritte nicht | | |
| 5 | Die Grenze auf «Monat» umstellen | Die Zeile nennt jetzt den Monat | | |
| 6 | Das Feld leeren und speichern | Die Zeile nennt keine Grenze mehr; Buchungen zählen unbegrenzt | | |
| 7 | Mit einem HTTP-Aufruf mehr Buchungen erzwingen als erlaubt | Die Grenze greift trotzdem – sie hängt am Server (BR-065) | | |

---

## TC-007: Eigene Regel anlegen (A3, FR-038, BR-064)

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Das Pluszeichen antippen | Blatt «Eigene Regel» | | |
| 2 | Nur eine Bezeichnung eingeben | «Speichern» bleibt ausgegraut – der Code fehlt | | |
| 3 | Als Code «task_done» eingeben (bereits vergeben) | Hinweis «Diesen Code gibt es bereits», Speichern gesperrt (BR-064) | | |
| 4 | Code «Kuchen Gebacken» eingeben | Wird zu `kuchen_gebacken` vereinheitlicht und angenommen | | |
| 5 | Säule «Vereinsleben» und Wert 15 wählen, speichern | Toast «Regel angelegt» | | |
| 6 | Die Liste ansehen | Die Regel steht im Abschnitt «Vereinsleben» | | |
| 7 | Dieselbe Regel nochmals anlegen wollen | Abgewiesen – der Code ist nun vergeben | | |
| 8 | Die neue Regel öffnen | Wert und Grenze lassen sich wie bei jeder anderen ändern | | |

---

## TC-008: Nur der Vorstand konfiguriert

**Priority:** High
**Preconditions:** Konto **M**.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** das Profil öffnen | **Kein** Eintrag «Punkteregeln» | | |
| 2 | `/tabs/profile/rules` direkt aufrufen | Hinweis, dass das dem Vorstand vorbehalten ist | | |
| 3 | Mit dem Token von **M** `PATCH /rest/v1/point_rules` | Abgewiesen von der Policy | | |
| 4 | Mit dem Token von **M** `POST /rest/v1/rpc/set_pillar_active` | Fehler «Nur der Vorstand ändert Punkteregeln» | | |
| 5 | Mit dem Token von **M** `POST /rest/v1/rpc/award_points` | Abgewiesen – die Buchungsroutine ist intern (NFR-013) | | |

---

## TC-009: Vier Sprachen

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf Französisch die Seite öffnen | Alle sieben Säulennamen französisch | | |
| 2 | Eine Regel mit Grenze ansehen | «au plus 4 par semaine» – Zahl und Zeitraum im Satz | | |
| 3 | Die vier Zeiträume in der Auswahl | Tag, Woche, Monat, Saison – alle übersetzt | | |
| 4 | Die Kennzeichen «Aus» und «Nur Dank» | Übersetzt | | |
| 5 | Auf Italienisch und Englisch wiederholen | Wie oben (C-007) | | |

---

## TC-010: Darstellung und Netz

**Priority:** Medium
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Durch alle sieben Säulen scrollen | Der grosse Titel klappt zusammen; die Abschnitte bleiben lesbar | | |
| 2 | Der Säulenschalter neben der Überschrift | Gut erreichbar, aber nicht versehentlich zu treffen | | |
| 3 | Auf dem kleinsten Gerät ein Blatt öffnen | Wert, Schalter und Grenze ohne Scrollen erreichbar | | |
| 4 | Ins Punktfeld tippen | Die Tastatur zeigt das **Zifferblatt** | | |
| 5 | Im Dunkelmodus | Kennzeichen «Aus» und «Nur Dank» unterscheidbar | | |
| 6 | Flugmodus ein, eine Regel speichern | Toast **oben** mit Fehlermeldung; der Wert bleibt im Blatt | | |
| 7 | Flugmodus aus, erneut speichern | Geht durch; der Wert ist **einmal** angekommen | | |

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
| TC-001 | Regeln nach Säulen | High | |
| TC-002 | Punktwert ändern wirkt nur nach vorne | High | |
| TC-003 | Negative Werte sind ausgeschlossen | High | |
| TC-004 | Regel und ganze Säule schalten | High | |
| TC-005 | Nur-Dank-Modus | High | |
| TC-006 | Häufigkeitsgrenze | High | |
| TC-007 | Eigene Regel anlegen | High | |
| TC-008 | Nur der Vorstand konfiguriert | High | |
| TC-009 | Vier Sprachen | High | |
| TC-010 | Darstellung und Netz | Medium | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

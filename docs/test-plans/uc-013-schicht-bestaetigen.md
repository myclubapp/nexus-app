# Manual Test Plan: UC-013 — Helfer-Schicht bestätigen

**Use Case:** [UC-013](../use_cases/UC-013-schicht-bestaetigen.md)
**Geltungsbereich:** Einsatzliste, Bestätigung, Punktebuchung je Schicht, Abwesenheit
**Anforderungen:** FR-032, FR-039
**Regeln:** BR-049 bis BR-053
**Erstellt:** 2026-09-09

## Vorbereitung

- **V** — Vorstand, **T** — Trainer:in, **M1**, **M2**, **M3** — Mitglieder.
- Ein Helfer-Event «Waldfest», dessen Schichten **in der Vergangenheit** liegen:
  - **S1** Aufbau, 2 Personen, **50** Punkte — **M1** und **M2** eingetragen
  - **S2** Abbau, 2 Personen, **100** Punkte — **M1** eingetragen
- **M3** hat mitgeholfen, ist aber **nicht** eingetragen (für A2).
- Die Regel `shift_done` ist aktiv.
- Migrationen `0027_shift_confirmation.sql` und
  `0028_shift_confirmation_rules.sql` sind eingespielt.

---

## TC-001: Einsätze bestätigen (Hauptablauf)

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Agenda öffnen, auf «Vergangen» umschalten | «Waldfest» steht da | | |
| 2 | Nach «Einsätze bestätigen» suchen | Der Knopf ist da – im Bereich «Kommend» **nicht** | | |
| 3 | Den Knopf antippen | Ein Blatt öffnet sich, **S1** ist vorgewählt | | |
| 4 | Den Kopf der Schicht lesen | Bezeichnung, Zeitfenster und **+50** – der Punktwert steht vor der Bestätigung da | | |
| 5 | Die Fussnote lesen | Sie erklärt, dass nur bestätigt wird, wer tatsächlich im Einsatz war | | |
| 6 | Die Liste ansehen | **M1** und **M2** mit dem Status «Eingetragen» | | |
| 7 | Bei **M1** «Bestätigen» antippen | Toast nennt den Namen und **50 Punkte** | | |
| 8 | Die Zeile von **M1** erneut ansehen | Status «Anwesend», Merkmal «Bestätigt», **kein** Knopf mehr (BR-052) | | |
| 9 | Die Zusammenfassung unten lesen | «50 Punkte in dieser Sitzung gebucht» (Schritt 6) | | |
| 10 | **M2** bestätigen | Die Zusammenfassung steht auf 100 | | |
| 11 | Als **M1** das Dashboard öffnen | Der Punktestand ist um 50 gestiegen | | |
| 12 | Als **M1** die Inbox öffnen | Eine Nachricht «Einsatz bestätigt» mit der Punktzahl (Schritt 5) | | |
| 13 | Als **M1** die Punktehistorie ansehen | Ein Eintrag mit der **Bezeichnung der Schicht** | | |

---

## TC-002: Der Punktwert gehört der Schicht (BR-042, BR-049)

**Priority:** High
**Preconditions:** Als **V** angemeldet, **M1** ist für **S1** (50) und **S2** (100) eingetragen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **S1** für **M1** bestätigen | **50** Punkte | | |
| 2 | Auf **S2** umschalten | Der Kopf zeigt **+100** | | |
| 3 | **S2** für **M1** bestätigen | **100** Punkte – nicht nochmals 50 | | |
| 4 | Die Punktehistorie von **M1** ansehen | **Zwei** Einträge, je mit der richtigen Schichtbezeichnung | | |
| 5 | Nach einem separaten Helferpunkte-Konto suchen | Es gibt keines – alles steht im einen Ledger (BR-049) | | |
| 6 | Den Punktwert einer dritten Schicht auf **0** setzen und bestätigen | Der Einsatz gilt als bestätigt; **keine** Nachricht über eine Gutschrift | | |

---

## TC-003: Keine Doppelbuchung (A3, BR-051)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **M1** für **S1** bestätigen | 50 Punkte | | |
| 2 | Mit einem HTTP-Aufruf `confirm_shift` dieselbe Kombination erneut | Rückgabe **0**; kein Fehler, stilles Verwerfen | | |
| 3 | Die Punktehistorie zählen | **Ein** Eintrag, nicht zwei | | |
| 4 | Die Inbox von **M1** zählen | **Eine** Nachricht – die zweite Bestätigung meldet nichts | | |
| 5 | Den Punktestand prüfen | Um genau 50 gestiegen | | |

---

## TC-004: Nicht erschienen (A1)

**Priority:** High
**Preconditions:** **M2** ist für **S1** eingetragen, aber nicht gekommen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Bei **M2** «Nicht im Einsatz» antippen | Eine Auswahl: «Entschuldigt» oder «Nicht da» (A1) | | |
| 1a | «Entschuldigt» wählen | Status «Entschuldigt»; Toast ohne Punkteangabe | | |
| 2 | Denselben Weg mit «Nicht da» | Status «Nicht da» | | |
| 3 | Punktestand von **M2** prüfen | Unverändert; **kein** Abzug | | |
| 4 | Die Inbox von **M2** prüfen | Keine Nachricht über eine Gutschrift | | |
| 5 | **M2** anschliessend doch bestätigen | Geht – die Abwesenheit ist keine Sperre | | |
| 6 | Bei einer **bereits bestätigten** Person «War nicht da» versuchen | Der Knopf fehlt; über HTTP: Fehler mit Verweis auf die Gegenbuchung (BR-052) | | |

---

## TC-005: Kurzfristig eingesprungen (A2)

**Priority:** High
**Preconditions:** **M3** hat mitgeholfen, ist nicht eingetragen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Einsatzliste von **S1** ansehen | **M3** steht **nicht** darin | | |
| 2 | «Person hinzufügen» antippen | Eine Auswahl mit den Mitgliedern, die **noch nicht** auf der Liste stehen | | |
| 2a | Prüfen, ob **M1** in der Auswahl steht | Nein – wer eingetragen ist, steht nicht nochmals zur Wahl | | |
| 2b | **M3** wählen und bestätigen | **M3** ist eingetragen **und** bestätigt in einem Schritt | | |
| 3 | Die Liste neu laden | **M3** steht mit «Anwesend» darin | | |
| 4 | Punktestand von **M3** prüfen | Um den Wert der Schicht gestiegen | | |
| 5 | Eine bereits **volle** Schicht so ergänzen | Geht ebenfalls – wer da war, war da; die Grenze schützt die Planung, nicht die Vergangenheit | | |
| 6 | `confirm_shift` mit der `member_id` eines **fremden** Vereins | Fehler «Kein Mitglied dieses Vereins» | | |

---

## TC-005a: Die Regel entscheidet, ob gebucht wird (Befunde B1, B2, B3)

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Punkteregeln öffnen, «Helfereinsatz» **deaktivieren** | — | | |
| 2 | Eine Schicht für **M1** bestätigen | Der Einsatz gilt als bestätigt; Toast ohne Punkteangabe | | |
| 3 | Punktestand und Historie von **M1** prüfen | **Keine** Buchung | | |
| 4 | Die ganze Säule «Vereinsarbeit» abschalten und erneut bestätigen | Ebenfalls keine Buchung | | |
| 5 | Regel wieder aktivieren, andere Schicht bestätigen | Punkte werden gebucht | | |
| 6 | An der Regel eine Grenze «höchstens 1 pro Woche» setzen | — | | |
| 7 | In derselben Woche eine **zweite** Schicht für **M1** bestätigen | Der Einsatz gilt als bestätigt, es wird **nicht** gebucht (BR-065) | | |
| 8 | Die Historie zählen | Genau **eine** Buchung in dieser Woche | | |
| 9 | Eine Schicht mit Punktwert **0** erstmals bestätigen | Toast «bestätigt – diese Schicht vergibt keine Punkte», **nicht** «bereits bestätigt» | | |
| 10 | Dieselbe Schicht ein zweites Mal bestätigen | Jetzt «Bereits bestätigt» | | |

---

## TC-006: Nur der Vorstand (BR-053, NFR-013)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **T** (Trainer:in) die vergangene Agenda ansehen | **Kein** Knopf «Einsätze bestätigen» | | |
| 2 | Als **M1** ebenso | Ebenfalls nicht | | |
| 3 | Als **M1** mit einem HTTP-Aufruf `shift_roster` | Fehler «Nur der Vorstand sieht die Einsatzliste» | | |
| 3a | Als **M1** mit einem HTTP-Aufruf `shift_candidates` | Derselbe Fehler | | |
| 4 | Als **M1** mit einem HTTP-Aufruf `confirm_shift` auf sich selbst | Fehler «Nur der Vorstand kann Schichten bestätigen» | | |
| 5 | Als **T** mit einem HTTP-Aufruf `set_shift_absence` | Derselbe Fehler | | |
| 6 | Als **M1** direkt in `point_transactions` einfügen | Die Policy weist ab (BR-050, C-010) | | |

---

## TC-007: Vier Sprachen (C-007, NFR-028)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf Französisch das Blatt öffnen | Titel, Knöpfe, Fussnote französisch | | |
| 2 | Die Statusangaben lesen | «Inscrit·e», «Présent·e», «Absent·e» – nicht deutsch stehengeblieben | | |
| 2a | Die Auswahl «Nicht im Einsatz» und «Person hinzufügen» öffnen | Beide vollständig übersetzt | | |
| 3 | Eine Bestätigung auslösen | Der Toast nennt Name und Punkte auf Französisch | | |
| 4 | Die Anzahl Eingetragener lesen | Singular bei einer, Plural ab zwei | | |
| 5 | Die Zusammenfassung lesen | Französisch | | |
| 6 | Auf Italienisch und Englisch wiederholen | Wie oben | | |

---

## TC-008: Darstellung und Netz

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Ein Event mit **einer** Schicht öffnen | **Keine** Schichtauswahl – sie wäre Zierde | | |
| 2 | Ein Event mit vier Schichten öffnen | Die Auswahl steht oben und lässt sich wischen | | |
| 3 | Auf dem kleinsten Gerät | Name, Status und beide Knöpfe ohne Abschneiden | | |
| 4 | Eine Schicht mit 30 Eingetragenen | Die Liste scrollt, die Kopfzeile bleibt stehen | | |
| 5 | Im Dunkelmodus | «Bestätigt» bleibt als Zustand erkennbar | | |
| 6 | Flugmodus ein, bestätigen | Toast mit Fehler; die Liste bleibt unverändert | | |
| 7 | Flugmodus aus, erneut bestätigen | Geht durch; **eine** Buchung | | |
| 8 | Mit Bedienhilfen durch die Liste gehen | Name, Status und Knöpfe werden vorgelesen (NFR-027) | | |

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
| TC-001 | Einsätze bestätigen | High | |
| TC-002 | Der Punktwert gehört der Schicht | High | |
| TC-003 | Keine Doppelbuchung | High | |
| TC-004 | Nicht erschienen | High | |
| TC-005 | Kurzfristig eingesprungen | High | |
| TC-005a | Die Regel entscheidet, ob gebucht wird | High | |
| TC-006 | Nur der Vorstand | High | |
| TC-007 | Vier Sprachen | High | |
| TC-008 | Darstellung und Netz | Medium | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

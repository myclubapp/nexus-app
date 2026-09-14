# Manual Test Plan: UC-012 — Helfer-Schicht übernehmen

**Use Case:** [UC-012](../use_cases/UC-012-schicht-uebernehmen.md)
**Geltungsbereich:** Eintragen, Austragen, Besetzungsgrenze, Überschneidung, mehrere Schichten
**Anforderungen:** FR-031, FR-156
**Regeln:** BR-045 bis BR-048, BR-187
**Erstellt:** 2026-09-09

## Vorbereitung

- **V** — Vorstand, **M1** und **M2** — Mitglieder ohne Funktion.
- **V** hat mit UC-011 das Helfer-Event «Waldfest» ausgeschrieben, mit vier Schichten:
  - **S1** Aufbau, morgen 08:00–12:00, **1** Person, 50 Punkte
  - **S2** Festwirtschaft, morgen 10:00–14:00, 2 Personen, 50 Punkte — **überschneidet S1**
  - **S3** Abend, morgen 14:00–18:00, 2 Personen, 50 Punkte — **schliesst an S2 an**
  - **S4** Abbau, in **20 Stunden**, 2 Personen, 100 Punkte
- Ein zweites Helfer-Event liegt als **Entwurf** vor (nicht ausgeschrieben).
- Migrationen `0025_shift_signup.sql` und `0026_shift_signup_hardening.sql`
  sind eingespielt.

---

## TC-001: Eine Schicht übernehmen (Hauptablauf)

**Priority:** High
**Preconditions:** Als **M1** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Agenda» öffnen | «Waldfest» steht da mit «0 von 7 besetzt» | | |
| 2 | «Schichten ansehen» antippen | Ein Blatt öffnet sich | | |
| 3 | Den obersten Abschnitt lesen | **Zuerst das Warum**, dann erst die Schichten (Schritt 2) | | |
| 4 | Die Schichtenliste ansehen | Je Schicht: Zeitfenster, Punktwert, «0 von n besetzt» | | |
| 5 | Die Fussnote lesen | Sie sagt, dass die Punkte erst mit der Bestätigung kommen (BR-045) | | |
| 6 | Bei **S1** «Ich übernehme das» antippen | Toast **oben**; er nennt die Bestätigung durch die Organisation | | |
| 7 | Die Schicht erneut ansehen | «1 von 1 besetzt»; der Knopf heisst jetzt «Doch nicht» | | |
| 8 | Das Blatt schliessen, die Agenda ansehen | Der Gesamtstand ist um eins gestiegen | | |
| 9 | Dashboard öffnen, Punktestand prüfen | **Unverändert** – die Eintragung erzeugt keine Punkte (BR-045) | | |
| 10 | Punktehistorie prüfen | **Kein** Eintrag zur Schicht | | |
| 11 | Als **V** dieselbe Schicht ansehen | **M1** ist als besetzt gezählt | | |

---

## TC-002: Die Schicht ist voll (A1, BR-046)

**Priority:** High
**Preconditions:** **M1** hat **S1** (1 Person) übernommen. Als **M2** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Das Blatt öffnen und **S1** ansehen | «1 von 1 besetzt»; der Knopf heisst «Voll» und ist ausgegraut | | |
| 2 | Die Farbe des Merkmals vergleichen | Volle und offene Schichten sind unterscheidbar | | |
| 3 | Mit einem HTTP-Aufruf `take_shift` auf **S1** | Fehler «Diese Schicht ist bereits voll» | | |
| 4 | Auf zwei Geräten gleichzeitig den letzten Platz von **S3** nehmen | Genau **eine** Person kommt durch, die andere sieht den Fehler | | |
| 5 | Den Stand nach dem Wettlauf ablesen | Nie mehr Eingetragene als benötigt | | |
| 6 | **M1** trägt sich aus **S1** aus, **M2** versucht es erneut | Jetzt geht es | | |

---

## TC-003: Mehrere Schichten und Überschneidung (A3, A4)

**Priority:** High
**Preconditions:** Als **M1** angemeldet, noch ohne Eintragung.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **S1** (08:00–12:00) übernehmen | Eingetragen | | |
| 2 | **S2** (10:00–14:00) übernehmen | Eine **Rückfrage** erscheint, kein Fehler und keine stille Ablehnung | | |
| 3 | Den Text der Rückfrage lesen | Er nennt die Überschneidung und fragt, ob trotzdem | | |
| 4 | «Abbrechen» wählen | **Keine** Eintragung; **S2** bleibt bei «0 von 2» | | |
| 5 | **S2** erneut wählen und «Trotzdem übernehmen» | Jetzt eingetragen (A4) | | |
| 6 | **S3** (14:00–18:00) übernehmen | **Ohne Rückfrage** – anschliessend ist nicht überschneidend | | |
| 6a | Bei einem mehrtägigen Aufruf eine **vergangene** Schicht ansehen | Der Knopf heisst «Vorbei» und ist ausgegraut | | |
| 7 | Die Liste ansehen | Alle drei Schichten zeigen «Doch nicht» | | |
| 8 | Als **V** die Eintragungen prüfen | **M1** steht **drei** Mal, einmal je Schicht (A3) | | |
| 9 | Punktestand von **M1** prüfen | Weiterhin unverändert (BR-045) | | |

---

## TC-004: Austragen (A2, BR-047)

**Priority:** High
**Preconditions:** **M1** ist für **S3** (morgen) und **S4** (in 20 Stunden) eingetragen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Bei **S3** «Doch nicht» antippen | Toast «Ausgetragen. Der Platz ist wieder frei.» | | |
| 2 | Den Stand ablesen | Um eins gesunken; der Knopf heisst wieder «Ich übernehme das» | | |
| 3 | Nach einer Sperrfrist oder Nachfrage suchen | **Keine** – Austragen ist jederzeit möglich | | |
| 4 | Punktestand prüfen | Unverändert; **kein Abzug** (BR-047) | | |
| 5 | Als **V** die Inbox prüfen | **Keine** Meldung – bis zum Beginn sind mehr als 48 Stunden | | |
| 6 | Bei **S4** (in 20 Stunden) austragen | Der Toast sagt, dass die Organisation informiert wurde | | |
| 7 | Als **V** die Inbox prüfen | Eine Meldung mit Schichtbezeichnung und Besetzungsstand | | |
| 8 | Als **M2** (nicht Vorstand) die Inbox prüfen | **Keine** Meldung – sie geht nur an den Vorstand | | |
| 9 | Sich erneut für **S4** eintragen und wieder austragen | Geht; keine Häufung von Meldungen zum selben Vorgang stört den Vorstand | | |

---

## TC-005: Was nicht geht

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** die Agenda ansehen | Beim **Entwurf** fehlt «Schichten ansehen» – er ist gar nicht sichtbar | | |
| 2 | Als **V** beim Entwurf nach dem Knopf suchen | Fehlt ebenfalls – in einen Entwurf trägt sich niemand ein | | |
| 3 | Mit einem HTTP-Aufruf `take_shift` auf eine Schicht des Entwurfs | Fehler «Dieser Aufruf ist noch nicht ausgeschrieben» | | |
| 4 | **V** sagt «Waldfest» ab; als **M1** nachsehen | «Schichten ansehen» ist weg | | |
| 5 | Mit einem HTTP-Aufruf `take_shift` auf die abgesagte Schicht | Fehler «Dieser Termin wurde abgesagt» | | |
| 6 | Mit einem HTTP-Aufruf `take_shift` auf eine **vergangene** Schicht | Fehler «Diese Schicht ist vorbei» | | |
| 7 | Als Mitglied eines **anderen** Vereins `take_shift` aufrufen | Kein Zugriff (NFR-011) | | |
| 8 | Mit einem HTTP-Aufruf `release_shift` auf die Eintragung einer **anderen** Person | Die eigene Eintragung wird gelöscht, nie eine fremde | | |
| 9 | Direkt in `attendance` eine Zeile mit `status = 'present'` einfügen | Die Policy weist ab – `present` ist Check-in und Bestätigung vorbehalten | | |

---

## TC-006: Zu- und Absage funktionieren weiter (Regression zu 0025)

**Priority:** High
**Preconditions:** Ein gewöhnlicher Termin **E1** in 48 Stunden.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 0 | Als **M1** zwei Schichten eines Helferaufrufs übernehmen, dem Termin aber **nicht** zusagen | Der Teilnehmerstand zeigt **0 Zusagen**, nicht 2; der Zusagen-Knopf ist nicht gefüllt | | |
| 1 | Als **M1** bei **E1** zusagen | Der Stand zeigt eine Zusage | | |
| 2 | Absagen mit Grund «Arbeit» | Der Stand zeigt eine Absage, die Prämie wird gebucht | | |
| 3 | Wieder zusagen, wieder absagen | Der Stand zählt **M1** genau **einmal** – nicht vier Mal | | |
| 4 | Die Punktehistorie zählen | **Ein** Eintrag «Rechtzeitig abgemeldet» | | |
| 5 | Am Termin einchecken (QR) | Der Check-in geht durch, der Status wird `present` | | |
| 5a | 40 Minuten **vor** Beginn einchecken | Abgewiesen – das Fenster öffnet 30 Minuten vorher (BR-054) | | |
| 5b | Bei einem Termin **ohne** Endzeit vier Stunden nach Beginn einchecken | Abgewiesen – die Standarddauer sind drei Stunden (BR-054) | | |
| 6 | Zweimal einchecken | Der zweite Versuch meldet «bereits eingecheckt», bucht nichts nach | | |
| 7 | An einem Helfer-Event mit übernommener Schicht **zusätzlich** zusagen | Zusage und Schichteintrag stehen nebeneinander, ohne einander zu überschreiben | | |

---

## TC-006a: Was der Server nicht durchlässt (Befunde H2, M4, M5, M8)

**Priority:** High
**Preconditions:** Zugriff auf die REST-Schnittstelle als angemeldetes Mitglied.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `POST /rest/v1/attendance` mit eigener `member_id` und einer **vollen** `shift_id` | Die Policy weist ab – Schichten schreibt nur `take_shift()` | | |
| 2 | Derselbe Aufruf **ohne** `shift_id` (Zusage zum Termin) | Geht durch – dort gibt es keine Grenze zu wahren | | |
| 3 | `POST` mit eigener `event_id` und einer **erfundenen** `shift_id` | Der Fremdschlüssel weist ab | | |
| 4 | `PATCH` der eigenen Zusage-Zeile auf eine `shift_id` | Die Policy weist ab | | |
| 5 | Eigene Schicht-Zeile per `PATCH` auf `excused` setzen, zwei andere nachrücken lassen, dann `take_shift` | «Diese Schicht ist bereits voll» – der Platz ist weg | | |
| 6 | Die Besetzung danach zählen | Nie mehr als benötigt | | |
| 7 | `release_shift` auf eine Schicht aufrufen, in der man **nie** eingetragen war | Keine Meldung an den Vorstand; die Inbox bleibt leer | | |
| 8 | Denselben Aufruf zehnmal wiederholen | Weiterhin **null** Benachrichtigungen | | |
| 9 | Nach der Bestätigung durch den Vorstand `release_shift` aufrufen | «Ein bestätigter Einsatz lässt sich nicht zurücknehmen» | | |
| 10 | Nach der Bestätigung `take_shift` erneut aufrufen | Der Status bleibt `present`, wird nicht zurückgestuft | | |

---

## TC-006b: Punkte je Schicht (BR-042, Befund H1)

**Priority:** High
**Preconditions:** Als **V** angemeldet. **M1** hat zwei Schichten desselben Anlasses übernommen: «Halbtag» (50 Punkte) und «Ganztag» (100 Punkte).

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Halbtag für **M1** bestätigen | **50** Punkte | | |
| 2 | Den Ganztag für **M1** bestätigen | **100** Punkte – nicht nochmals 50 | | |
| 3 | Die Punktehistorie von **M1** ansehen | **Zwei** Einträge, mit der Bezeichnung der jeweiligen Schicht | | |
| 4 | Den Halbtag ein zweites Mal bestätigen | 0 Punkte; **keine** dritte Buchung (NFR-017) | | |
| 5 | Die Zusage von **M1** zum Termin ansehen | Steht weiterhin auf «zugesagt», nicht auf «anwesend» | | |
| 6 | Den Punktwert einer Schicht vor der Bestätigung auf 0 setzen | Die Bestätigung bucht 0 – Nur-Dank ist möglich | | |

---

## TC-007: Vier Sprachen (C-007, NFR-028)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf Französisch das Blatt öffnen | Titel, Knöpfe und Fussnote französisch | | |
| 2 | Die Überschrift der Schichtenliste lesen | Singular bei einer, Plural ab zwei Schichten | | |
| 3 | Die Überschneidungs-Rückfrage auslösen | Titel, Text und beide Knöpfe französisch | | |
| 4 | Ein- und austragen | Beide Toasts französisch, auch die Fassung mit der Meldung an die Organisation | | |
| 5 | Auf Italienisch und Englisch wiederholen | Wie oben | | |

---

## TC-008: Darstellung und Netz

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Das Blatt auf dem kleinsten Gerät | Bezeichnung, Zeit, Punktwert und Stand ohne Abschneiden lesbar | | |
| 2 | Die Aktionsknöpfe antippen | Trefferfläche mindestens 44 × 44 px | | |
| 3 | Ein Event mit zehn Schichten öffnen | Die Liste scrollt, die Kopfzeile bleibt stehen | | |
| 4 | Im Dunkelmodus | Voll und offen bleiben unterscheidbar, nicht nur über die Farbe | | |
| 5 | Flugmodus ein, eine Schicht übernehmen | Fehler **im Blatt**; der Stand bleibt unverändert | | |
| 6 | Flugmodus aus, erneut übernehmen | Geht durch; **eine** Eintragung, nicht zwei | | |
| 7 | Mit Bedienhilfen durch die Liste gehen | Stand und Knopfbeschriftung werden vorgelesen (NFR-027) | | |

---

## TC-009: Kalendereintrag auf dem Gerät (FR-156, BR-187)

**Priority:** High
**Preconditions:** Als **M** angemeldet; ein Helfer-Event mit Ort, Warum und zwei Schichten zu verschiedenen Zeiten. Auf iOS, Android **und** im Browser durchspielen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Bei der ersten Schicht «Ich übernehme das» | Toast; **iOS/Android:** das Systemblatt «Neuer Termin» öffnet sich mit «‹Schicht› – ‹Anlass›» als Titel, dem Ort, dem **Zeitfenster der Schicht** (nicht des Anlasses) in Ortszeit, Anlass und Warum in den Notizen. **Browser:** `.ics`-Download | | |
| 2 | Im Systemblatt **Abbrechen** | Die Schicht bleibt übernommen («Doch nicht» steht da) | | |
| 3 | Das Kalender-Symbol neben «Doch nicht» antippen und **Sichern** | Der Eintrag steht im Gerätekalender zur Stunde der Schicht | | |
| 4 | Die zweite Schicht so wählen, dass sie sich überschneidet, und «Trotzdem übernehmen» (A4) | Auch nach der Rückfrage öffnet sich das Kalenderblatt | | |
| 5 | Bei einer Schicht «Doch nicht» | Kein Kalenderblatt; der Eintrag im Gerätekalender bleibt und wird von Hand gelöscht (BR-187) | | |
| 6 | Eine **vergangene** Schicht ansehen, für die man eingetragen war | Kein Kalender-Symbol an der Zeile | | |

---

## TC-010: Keine Zusage zum Anlass (BR-196)

**Priority:** High
**Preconditions:** Ein publiziertes Helfer-Event ohne Team, dessen Schichten **alle voll** sind (z. B. 7 von 7). Als **M2** angemeldet, ohne eigene Schicht; **M1** hält eine Schicht.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M2** die Agenda-Zeile ansehen | Links kein gelbes «noch offen», sondern ein neutrales Platzhalter-Symbol; rechts «7/7» | | |
| 2 | Die Zeile nach rechts wischen | Kein grüner Haken und kein rotes Kreuz erscheinen | | |
| 3 | Das Detail öffnen | Kein «Mein Status», keine Listen «Zugesagt / Abgesagt / Keine Antwort»; die Zeile «Schichten · 7 von 7 besetzt» führt zum Schichtblatt | | |
| 4 | Als **Trainer:in** oder Vorstand das Detail öffnen | Unter «Verwalten» steht kein «Erinnern» | | |
| 5 | Als **M1** die Agenda-Zeile ansehen | Links der grüne Haken, weil **M1** eine Schicht hält | | |
| 6 | Ein gewöhnliches Training daneben öffnen | «Mein Status» und die Listen stehen wie gehabt (TC-006) | | |

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
| TC-001 | Eine Schicht übernehmen | High | |
| TC-002 | Die Schicht ist voll | High | |
| TC-003 | Mehrere Schichten und Überschneidung | High | |
| TC-004 | Austragen | High | |
| TC-005 | Was nicht geht | High | |
| TC-006 | Zu- und Absage funktionieren weiter | High | |
| TC-006a | Was der Server nicht durchlässt | High | |
| TC-006b | Punkte je Schicht | High | |
| TC-007 | Vier Sprachen | High | |
| TC-008 | Darstellung und Netz | Medium | |
| TC-009 | Kalendereintrag auf dem Gerät | High | |
| TC-010 | Keine Zusage zum Anlass | High | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

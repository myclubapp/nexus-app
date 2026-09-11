# Manual Test Plan: UC-009 — Termin erstellen

**Use Case:** [UC-009](../use_cases/UC-009-termin-erstellen.md)
**Geltungsbereich:** Terminformular, Termintypen, Punkteregel, Serie, Absage
**Anforderungen:** FR-021, FR-022, FR-023
**Regeln:** BR-032 bis BR-036
**Erstellt:** 2026-09-09

## Vorbereitung

- Ein **Sport**verein mit zwei Teams («Aktive», «Junioren») und dem gesäten
  Satz Punkteregeln.
- Ein **Musik**verein für TC-002 (dort heisst «Training» «Probe»).
- **T** — Trainer:in, **V** — Vorstand, **M** — einfaches Mitglied.
- **M** gehört dem Team «Aktive» an.
- Migration `0015_events.sql` ist eingespielt.

---

## TC-001: Termin erfassen (Hauptablauf)

**Priority:** High
**Preconditions:** Als **T** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Agenda» öffnen | Oben rechts ein Pluszeichen | | |
| 2 | Pluszeichen antippen | Das Blatt «Termin erstellen» öffnet sich | | |
| 3 | Die Termintypen öffnen | Sieben Typen **in der Sprache des Vereins** (BR-032) | | |
| 4 | «Training» wählen | — | | |
| 5 | Die Punkteregel ablesen | **«Training besucht»** ist bereits vorgeschlagen (Schritt 6) | | |
| 6 | Auf «Spiel» wechseln | Der Vorschlag wechselt auf «Spiel bestritten» | | |
| 7 | Zurück auf «Training», Titel, Beginn und Ende eingeben | — | | |
| 8 | Ort «Turnhalle Nord» eingeben | — | | |
| 9 | Team «Aktive» wählen | — | | |
| 10 | «Erstellen» antippen | Blatt schliesst sich, Toast **oben** «Termin erstellt» | | |
| 11 | Die Agenda ansehen | Der Termin steht da, mit Typ-Label, Zeit und Ort | | |
| 12 | Als **M** (Team «Aktive») die Agenda öffnen | Der Termin ist sichtbar | | |
| 13 | Als **M** die Inbox/Nachrichten prüfen | Eine Nachricht über den neuen Termin (Schritt 10) | | |
| 14 | Als Mitglied eines **anderen** Teams | Der Termin ist **nicht** sichtbar | | |

---

## TC-002: Die Vereinssprache schlägt durch (BR-032, C-009)

**Priority:** High
**Preconditions:** Als Vorstand im **Musik**verein angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Terminformular öffnen, Typen ansehen | «Probe» statt «Training», «Konzert» statt «Spiel» | | |
| 2 | Eine Probe anlegen | Die Agenda zeigt «Probe» | | |
| 3 | In den Vereinseinstellungen «Probe» in «Übung» ändern | — | | |
| 4 | Terminformular erneut öffnen | Jetzt steht dort «Übung» – ohne Neustart | | |
| 5 | Die Datenbank ansehen | `events.type` ist unverändert `training` | | |

---

## TC-003: Unplausible Zeiten (A5)

**Priority:** High
**Preconditions:** Als **T** angemeldet, Formular offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Beginn 20:00, Ende 19:00 eingeben | Ein Hinweis «Das Ende muss nach dem Beginn liegen» erscheint | | |
| 2 | «Erstellen» antippen | Ausgegraut – es entsteht kein Termin | | |
| 3 | Ende auf 21:30 ändern | Der Hinweis verschwindet, «Erstellen» wird aktiv | | |
| 4 | Beginn gleich Ende setzen | Ebenfalls abgewiesen | | |
| 5 | Das Ende ganz leeren | Erlaubt – ein Termin ohne Endzeit ist zulässig | | |
| 6 | Mit einem HTTP-Aufruf einen Termin mit Ende vor Beginn anlegen | Abgewiesen vom Constraint (C-011) | | |

---

## TC-004: Warum-Pflicht bei Aufrufen (BR-036)

**Priority:** High
**Preconditions:** Als **V** angemeldet, Formular offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Typ «Training» wählen | **Kein** Warum-Feld | | |
| 2 | Typ «Helfer-Event» wählen | Ein Feld «Wozu dient das? Wem hilft es?» erscheint | | |
| 3 | Titel und Zeiten ausfüllen, Warum leer lassen | «Erstellen» bleibt ausgegraut | | |
| 4 | Das Warum ausfüllen | «Erstellen» wird aktiv | | |
| 5 | Typ «Generalversammlung» und «Vereinsanlass» prüfen | Beide verlangen ebenfalls ein Warum | | |
| 6 | Mit einem HTTP-Aufruf ein Helfer-Event ohne Warum anlegen | Abgewiesen vom Constraint | | |

---

## TC-005: Terminserie mit Vorschau (A1, FR-022)

**Priority:** High
**Preconditions:** Als **T** angemeldet, Formular offen, Beginn Montag 19:00 gesetzt.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Schalter «Wiederholt sich» einschalten | Rhythmus und Enddatum erscheinen | | |
| 2 | Die Rhythmen ansehen | Wöchentlich, alle zwei Wochen, monatlich | | |
| 3 | «Wöchentlich» und ein Enddatum in vier Wochen wählen | Eine **Vorschau** erscheint mit der Anzahl Termine | | |
| 4 | Die Vorschau prüfen | Die ersten fünf Termine mit Datum; danach «und N weitere» | | |
| 5 | Die Wochentage prüfen | Alle fallen auf **Montag**, jeweils 19:00 | | |
| 6 | Auf «alle zwei Wochen» wechseln | Die Vorschau halbiert sich | | |
| 7 | Ein Enddatum **zehn Jahre** in der Zukunft wählen | Die Vorschau zeigt höchstens 60 Termine und einen Hinweis darauf | | |
| 8 | Ein Enddatum **vor** dem Beginn wählen | Keine Vorschau, «Erstellen» ausgegraut | | |
| 9 | Enddatum auf vier Wochen zurück, «Erstellen» | Alle Termine erscheinen in der Agenda | | |
| 10 | Die Termine zählen | Genau so viele wie in der Vorschau angekündigt | | |
| 11 | Als **M** die Inbox prüfen | **Eine** Nachricht für die Serie, nicht fünf | | |
| 12 | In der Datenbank `series_id` prüfen | Alle Termine tragen dieselbe Serie | | |

---

## TC-006: Termin absagen (A4, BR-035)

**Priority:** High
**Preconditions:** Ein künftiger Termin mit Zusagen von **M**.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **T** den Termin öffnen und «Absagen» wählen | Ein Grund wird verlangt | | |
| 2 | Ohne Grund bestätigen | Abgewiesen | | |
| 3 | «Die Halle ist gesperrt» eingeben und bestätigen | Der Termin ist als abgesagt gekennzeichnet | | |
| 4 | Als **M** die Agenda öffnen | Die Absage **samt Grund** ist sichtbar | | |
| 5 | Als **M** zu- oder absagen wollen | Nicht möglich – gesperrt | | |
| 6 | Als **M** den Check-in versuchen | Nicht möglich | | |
| 7 | Als **M** die Inbox prüfen | Eine Nachricht mit dem Grund | | |
| 8 | Als **T** denselben Termin nochmals absagen | Nichts ändert sich, **keine** zweite Nachricht | | |
| 9 | Mit einem HTTP-Aufruf `cancel_event` mit leerem Grund | Fehler «Eine Absage braucht einen Grund» | | |

---

## TC-007: Nur Trainer:innen und Vorstand (BR-033)

**Priority:** High
**Preconditions:** Konto **M**.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** die Agenda öffnen | **Kein** Pluszeichen | | |
| 2 | Als **T** die Agenda öffnen | Das Pluszeichen ist da – auch ohne Vorstandsrolle | | |
| 3 | Mit dem Token von **M** `POST /rest/v1/events` | Abgewiesen von der Policy | | |
| 4 | Mit dem Token von **T** `POST /rest/v1/events` | Geht durch (BR-033) | | |
| 5 | Mit dem Token von **M** `POST /rest/v1/rpc/cancel_event` | Fehler «Nur Trainer:innen und der Vorstand sagen Termine ab» | | |
| 6 | Mit dem Token von **T** einen Termin eines **fremden** Vereins anlegen | Abgewiesen (NFR-011) | | |

---

## TC-008: Punkteregel am Termin (BR-034)

**Priority:** High
**Preconditions:** Als **T** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Einen Termin mit der Regel «Training besucht» (10 Punkte) anlegen | — | | |
| 2 | Als **M** einchecken (UC-014) | **10** Punkte werden gutgeschrieben | | |
| 3 | Die Regel auf 25 Punkte ändern (UC-016) | — | | |
| 4 | Einen **neuen** Termin anlegen und einchecken | **25** Punkte | | |
| 5 | Den alten Termin ansehen | Er trägt weiterhin seine Regel; die alte Buchung bleibt bei 10 | | |
| 6 | Einen Termin mit «Keine Punkte» anlegen | Ein Check-in erzeugt keine Buchung, **keinen** Fehler | | |

---

## TC-009: Vier Sprachen

**Priority:** High
**Preconditions:** Als **T** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf Französisch das Formular öffnen | Alle Beschriftungen französisch | | |
| 2 | Die Termintypen ansehen | Die **Vereinslabels** erscheinen unverändert – sie gehören dem Verein, nicht der Sprache | | |
| 3 | Eine Serie mit **einem** Termin | «Aperçu: 1 rendez-vous» – Einzahl | | |
| 4 | Eine Serie mit mehreren | Mehrzahl | | |
| 5 | Die drei Rhythmen ansehen | Alle übersetzt | | |
| 6 | Auf Italienisch und Englisch wiederholen | Wie oben (C-007) | | |

---

## TC-010: Datum und Zeit auf dem Gerät

**Priority:** High
**Preconditions:** Als **T** angemeldet, auf jedem Gerät der Matrix.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf **iOS** das Beginn-Feld antippen | Das System-Rad für Datum und Zeit erscheint | | |
| 2 | Auf **Android** dasselbe | Der System-Dialog erscheint | | |
| 3 | Im **Desktop-Browser** dasselbe | Der Browser-eigene Wähler erscheint | | |
| 4 | Auf jedem einen Termin anlegen | Die Zeit in der Agenda stimmt mit der Eingabe überein | | |
| 5 | Einen Termin um **00:30** anlegen | Er erscheint am **richtigen Tag**, nicht am Vortag | | |
| 6 | Einen Termin über die Sommerzeitumstellung hinweg als Serie | Alle Termine liegen zur gleichen Ortszeit | | |
| 7 | Auf dem kleinsten Gerät das Blatt öffnen | Alle Felder erreichbar; die Vorschau lässt sich scrollen | | |
| 8 | Im Dunkelmodus | Der Hinweis auf unplausible Zeiten bleibt erkennbar | | |

---

## TC-011: Ohne Netz

**Priority:** Medium
**Preconditions:** Als **T** angemeldet, Formular ausgefüllt.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Flugmodus ein, «Erstellen» | Fehlermeldung **im Blatt**; die Eingaben bleiben stehen | | |
| 2 | Flugmodus aus, erneut «Erstellen» | Der Termin entsteht | | |
| 3 | Die Agenda zählen | **Ein** Termin, nicht zwei | | |
| 4 | Eine Serie ohne Netz anlegen | Kein halb angelegter Satz – entweder alle oder keiner | | |

---

## TC-012: Teilnehmerbedarf und Unterdeckung (FR-029)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Einen Termin **ohne** Teilnehmerbedarf anlegen | Er wird angelegt; in der Agenda steht keine Unterdeckung | | |
| 2 | Einen Termin mit Bedarf 12 anlegen und zwei Zusagen erfassen | «Noch 10 Zusagen fehlen» | | |
| 3 | Bis auf eine Zusage auffüllen | Die Zahl zählt herunter, der Singular stimmt | | |
| 4 | Den Bedarf erreichen | Der Hinweis verschwindet | | |
| 5 | Jemanden einchecken lassen, der nie zugesagt hat | Zählt mit – wer da ist, ist da | | |
| 6 | «0», «-3» und «viele» eingeben | Gilt als kein Bedarf; keine Unterdeckung, keine Fehlermeldung | | |
| 7 | Als Mitglied ohne Rolle hinsehen | Die Unterdeckung steht auch dort – gerade dort zählt die eigene Zusage | | |
| 8 | Einen abgesagten und einen begonnenen Termin prüfen | Keine Unterdeckung mehr | | |
| 9 | Die vier Sprachen prüfen | Feld, Fusstext und Unterdeckung sind übersetzt | | |

---

## TC-013: Geltungsbereich nach Team (C-032)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Je einen Termin für Team A, Team B und den ganzen Verein anlegen | Vorbereitung | | |
| 2 | Als Mitglied von Team B die Agenda öffnen | Nur der eigene und der Vereinstermin | | |
| 3 | Als Mitglied von Team B `events` direkt abfragen | Dasselbe – die Abgrenzung liegt in der Policy, nicht im Client | | |
| 4 | Die Teilnehmerliste des fremden Termins abfragen | Leer | | |
| 5 | Mit der Id des fremden Termins zusagen | Abgewiesen | | |
| 6 | Eine Schicht des fremden Team-Termins übernehmen | Abgewiesen, mit Begründung | | |
| 7 | Eine Schicht des **Vereinstermins** übernehmen | Geht durch | | |
| 8 | Als Trainer:in hinsehen | Alle Teams – sie plant für sie | | |
| 9 | Als Vorstand hinsehen | Alle Teams und Entwürfe | | |
| 10 | Die Terminserie eines fremden Teams abfragen | Leer | | |
| 11 | Den Vereins-Puls auslösen und lesen | Er nennt **keinen** Team-Termin, wohl aber die Vereinstermine | | |
| 12 | Prüfen, ob eine Tabelle mit `team_id` noch vereinsweit liest | Keine | | |

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

Die Datums- und Zeitauswahl ist der Grund, warum alle drei Plattformen in der
Matrix stehen: `datetime-local` sieht auf jeder anders aus.

---

## Summary

| Test Case | Titel | Priority | Result |
| --------- | ----- | -------- | ------ |
| TC-001 | Termin erfassen | High | |
| TC-002 | Die Vereinssprache schlägt durch | High | |
| TC-003 | Unplausible Zeiten | High | |
| TC-004 | Warum-Pflicht bei Aufrufen | High | |
| TC-005 | Terminserie mit Vorschau | High | |
| TC-006 | Termin absagen | High | |
| TC-007 | Nur Trainer:innen und Vorstand | High | |
| TC-008 | Punkteregel am Termin | High | |
| TC-009 | Vier Sprachen | High | |
| TC-010 | Datum und Zeit auf dem Gerät | High | |
| TC-011 | Ohne Netz | Medium | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

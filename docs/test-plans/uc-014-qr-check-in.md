# Manual Test Plan: UC-014 — QR-Check-in am Termin

**Use Case:** [UC-014](../use_cases/UC-014-qr-check-in.md)
**Geltungsbereich:** Code anzeigen, scannen, Zeitfenster, Offline-Puffer, Erfassung von Hand
**Anforderungen:** FR-033, FR-034, NFR-010, NFR-016
**Regeln:** BR-054 bis BR-058
**Erstellt:** 2026-09-09

## Vorbereitung

- **T** — Trainer:in, **M1**, **M2** — Mitglieder, **F** — Mitglied eines **anderen** Vereins.
- Termine im Verein von **T**:
  - **E1** Training, Beginn **in 10 Minuten**, Ende in 2 Stunden, Regel «Training besucht» (10 Punkte)
  - **E2** Training, Beginn **in 3 Stunden**
  - **E3** Training **ohne Endzeit**, Beginn vor 3½ Stunden
  - **E4** abgesagtes Training
- Zwei Geräte: eines zeigt den Code, eines scannt.
- Migrationen `0029_qr_check_in.sql` und `0030_check_in_hardening.sql` sind
  eingespielt.

---

## TC-001: Code zeigen und scannen (Hauptablauf)

**Priority:** High
**Preconditions:** **T** auf Gerät A, **M1** auf Gerät B.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **T** die Agenda öffnen, bei **E1** «QR-Code zeigen» antippen | Ein Blatt mit dem Code öffnet sich | | |
| 2 | Den Code betrachten | Gross genug, um aus einem Meter Entfernung gescannt zu werden | | |
| 3 | Die Fussnote lesen | Sie nennt das Zeitfenster: ab 30 Minuten vor Beginn bis zum Ende | | |
| 4 | Als **M1** bei **E1** «Einchecken» antippen | Der Scanner öffnet sich, die Kamera fragt um Erlaubnis | | |
| 5 | Den Code auf Gerät A scannen | Bestätigung «Eingecheckt – 10 Punkte gutgeschrieben» (Schritt 7) | | |
| 6 | Das Blatt schliessen, Dashboard öffnen | Der Punktestand ist **unmittelbar** um 10 gestiegen (Schritt 8) | | |
| 7 | Die Punktehistorie ansehen | Ein Eintrag mit Bezug zu **E1** | | |
| 8 | Als **T** die Teilnehmerliste im QR-Blatt ansehen | **M1** steht auf «Anwesend» | | |
| 9 | Die Agenda von **M1** ansehen | Das Merkmal «Eingecheckt» steht am Termin | | |

---

## TC-002: Das Zeitfenster (A1, BR-054, NFR-016)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** den Code von **E2** (in 3 Stunden) scannen | «Der Code gilt erst ab 30 Minuten vor Beginn …» – **kein** roher Datenbanktext | | |
| 2 | Punktestand prüfen | Unverändert | | |
| 3 | Genau 25 Minuten vor Beginn scannen | Geht durch | | |
| 3a | **Während** des Termins (5 Minuten nach Beginn) in der Agenda nachsehen | Der Termin steht unter «Vergangen», der Knopf «Einchecken» ist **trotzdem da** | | |
| 3b | Dort einchecken | Geht durch – das Fenster reicht bis zum Ende, nicht bis zum Beginn | | |
| 3c | Nach Terminende nachsehen | Der Knopf ist weg, ebenso «QR-Code zeigen» | | |
| 4 | Genau 35 Minuten vor Beginn scannen | Abgewiesen | | |
| 5 | Nach Terminende scannen | Abgewiesen | | |
| 6 | Bei **E3** (ohne Endzeit, Beginn vor 3½ Stunden) scannen | Abgewiesen – ohne Endzeit gelten drei Stunden (BR-054) | | |
| 7 | Bei einem Termin ohne Endzeit 2 Stunden nach Beginn scannen | Geht durch | | |
| 8 | Bei **E4** (abgesagt) scannen | «Dieser Termin wurde abgesagt.» | | |

---

## TC-003: Der Code ist ein Geheimnis (BR-055, BR-056)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** die Agenda ansehen | **Kein** Knopf «QR-Code zeigen» – den zeigt, wer den Termin leitet | | |
| 2 | Als **M1** mit einem HTTP-Aufruf `/rest/v1/events?select=*` | Die Antwort enthält **keine** Spalte `qr_token` | | |
| 3 | Als **M1** mit einem HTTP-Aufruf `/rest/v1/event_qr_tokens?select=*` | **0 Zeilen** – die Policy behält sie den Verantwortlichen vor | | |
| 4 | Als **T** denselben Aufruf | Die Token der eigenen Vereinstermine | | |
| 5 | Als **T** eines anderen Vereins | Keine fremden Token (NFR-011) | | |
| 6 | Den Code von **E1** bei **E2** scannen | «Dieser Code gehört zu einem anderen Termin.» (A2) | | |
| 7 | Einen neuen Termin anlegen und sein Token prüfen | Vorhanden und **verschieden** vom Token aller anderen Termine (BR-055) | | |
| 8 | Ein Helfer-Event über «Helfer-Event ausschreiben» anlegen | Auch dieses hat ein Token | | |
| 9 | Eine Terminserie anlegen | Jeder Termin der Serie hat sein eigenes Token | | |

---

## TC-004: Zweiter Scan und fremder Verein (A3, A4, BR-057)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** bei **E1** ein zweites Mal scannen | «Du warst hier schon eingecheckt. Es wird nichts doppelt gebucht.» | | |
| 2 | Punktestand prüfen | Unverändert – genau eine Buchung | | |
| 3 | Die Punktehistorie zählen | **Ein** Eintrag zu **E1** | | |
| 4 | Als **F** (anderer Verein) den Code von **E1** scannen | «Du gehörst diesem Verein nicht an.» (A3) | | |
| 5 | Prüfen, ob dabei eine Anwesenheit entstand | Keine | | |

---

## TC-005: Ohne Netz (A5, NFR-010)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** den Flugmodus einschalten | — | | |
| 2 | Bei **E1** den Code scannen | «Kein Netz – der Check-in ist gespeichert und wird nachgesendet …» | | |
| 3 | Punktestand prüfen | Noch unverändert | | |
| 4 | Die App schliessen und neu öffnen (weiterhin Flugmodus) | Der gepufferte Scan ist **nicht** verloren | | |
| 5 | Flugmodus ausschalten | Der Check-in wird von selbst nachgesendet | | |
| 6 | Punktestand prüfen | Um 10 gestiegen | | |
| 7 | Die Punktehistorie zählen | **Ein** Eintrag, nicht zwei | | |
| 8 | Im Flugmodus **dreimal** denselben Termin scannen, dann verbinden | Genau **eine** Buchung | | |
| 9 | Im Flugmodus scannen, dann **26 Stunden** warten und verbinden | Der Eintrag wird **nicht** mehr gesendet (NFR-010) | | |
| 10 | Im Flugmodus scannen, warten bis das Fenster zu ist, dann verbinden | Ein Hinweis sagt, dass der gespeicherte Check-in nicht mehr gebucht werden konnte – er verschwindet **nicht** stumm | | |
| 11 | **Auf einem iPhone** wiederholen (Schritte 1–6) | Der Puffer greift dort genauso – WebKit meldet den Netzfehler anders als Chrome | | |
| 12 | Im Flugmodus scannen, App in den Hintergrund, Netz zurück, App wieder öffnen | Der Check-in wird nachgesendet, auch ohne `online`-Ereignis | | |
| 13 | Während des Nachsendens einen **zweiten** Termin scannen (kurz Netz, dann weg) | Beide Einträge überleben; keiner geht verloren | | |

---

## TC-006: Erfassung durch die Trainer:in (A6)

**Priority:** High
**Preconditions:** **M2** ist ohne Smartphone am Termin.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **T** das QR-Blatt von **E1** öffnen | Unter dem Code steht die Teilnehmerliste | | |
| 2 | Die Liste ansehen | Alle des betroffenen Kreises mit ihrem Stand: zugesagt, abgesagt, noch offen | | |
| 3 | Bei einem Team-Termin die Liste ansehen | Nur das Team, nicht der ganze Verein | | |
| 4 | Bei **M2** «Anwesend» antippen | Toast nennt Name und Punkte | | |
| 4a | Die Beschriftung danach lesen | Der Knopf heisst jetzt «Zurücknehmen», nicht wieder «Anwesend» | | |
| 5 | Als **M2** den Punktestand prüfen | Um 10 gestiegen | | |
| 6 | Nochmals «Anwesend» antippen | Der Vermerk wird zurückgenommen; die **Buchung bleibt** (BR-052) | | |
| 7 | Erneut «Anwesend» antippen | Kein zweiter Punktezuwachs (BR-057) | | |
| 8 | **M1** hat gescannt, danach **T** markiert ihn zusätzlich | Keine zweite Buchung | | |
| 9 | Als **M1** die Liste über einen HTTP-Aufruf `event_roster` lesen | «Nur Trainer:innen und der Vorstand sehen die Teilnehmerliste» | | |
| 10 | Als **M1** `mark_attendance` aufrufen | Abgewiesen (BR-033) | | |
| 11 | Den Termin absagen, dann `mark_attendance` über HTTP aufrufen | «Dieser Termin wurde abgesagt» – keine Punkte für einen Anlass, der nicht stattfand | | |
| 12 | Bei einem **Team**-Termin ein Mitglied ausserhalb des Teams erfassen | Abgewiesen | | |
| 13 | Als Trainer:in mit französischer App eine abgewiesene Erfassung auslösen | Die Meldung ist **französisch**, kein deutscher Datenbanktext | | |

---

## TC-007: Vier Sprachen (C-007, NFR-028)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf Französisch das QR-Blatt öffnen | Titel, Fussnoten und Knöpfe französisch | | |
| 2 | Die Statusangaben der Liste lesen | «Oui», «Non», «Sans réponse» – nicht deutsch stehengeblieben | | |
| 3 | Ausserhalb des Zeitfensters scannen | Die Begründung ist **französisch**, nicht der deutsche Datenbanktext (A1) | | |
| 4 | Mit falschem Code scannen | Ebenfalls französisch (A2) | | |
| 5 | Im Flugmodus scannen | Die Puffer-Meldung französisch (A5) | | |
| 6 | Die Anzahl in der Teilnehmerliste lesen | Singular bei einer, Plural ab zwei Personen | | |
| 7 | Auf Italienisch und Englisch wiederholen | Wie oben | | |

---

## TC-008: Darstellung, Kamera und Bedienhilfen

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Scanner ohne Kameraerlaubnis öffnen | «Die Kamera lässt sich nicht öffnen. Prüfe die Kamera-Erlaubnis …» – **nicht** «Der Check-in hat nicht geklappt» | | |
| 2 | Die Erlaubnis erteilen und erneut öffnen | Die Kamera startet | | |
| 3 | Das Blatt schliessen, während die Kamera läuft | Die Kamera schaltet ab (Kontrollleuchte erlischt) | | |
| 3a | Den Scanner öffnen und **sofort** wieder schliessen, bevor das Bild erscheint | Die Kamera schaltet ebenfalls ab – die Anzeige darf nicht anbleiben | | |
| 3b | Einen **falschen** Code scannen, dann den richtigen | Nach der Fehlermeldung erkennt der Scanner weiter; der zweite Code geht durch (A2) | | |
| 4 | Den Code auf dem kleinsten Gerät zeigen | Vollständig sichtbar, ohne Scrollen | | |
| 5 | Im Dunkelmodus | Der Code bleibt scanbar – heller Grund unter dem Muster | | |
| 6 | Bei starker Helligkeit draussen scannen | Erkennung innerhalb weniger Sekunden | | |
| 7 | Mit Bedienhilfen über den Code gehen | Die Beschreibung «Check-in-Code dieses Termins» wird vorgelesen (NFR-027) | | |
| 8 | Mit Bedienhilfen durch die Teilnehmerliste gehen | Name, Stand und Knopf werden vorgelesen | | |

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
| TC-001 | Code zeigen und scannen | High | |
| TC-002 | Das Zeitfenster | High | |
| TC-003 | Der Code ist ein Geheimnis | High | |
| TC-004 | Zweiter Scan und fremder Verein | High | |
| TC-005 | Ohne Netz | High | |
| TC-006 | Erfassung durch die Trainer:in | High | |
| TC-007 | Vier Sprachen | High | |
| TC-008 | Darstellung, Kamera und Bedienhilfen | Medium | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

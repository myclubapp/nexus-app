# Manual Test Plan: UC-037 — Beispielinhalte verwalten

**Use Case:** [UC-037](../use_cases/UC-037-beispielinhalte-verwalten.md)
**Geltungsbereich:** Erstbefüllung, Kennzeichnung, Folgenlosigkeit, Entfernen, Verfall, Demo-Verein
**Anforderungen:** FR-134 bis FR-145
**Regeln:** BR-160 bis BR-166
**Erstellt:** 2026-09-11

## Vorbereitung

- **V** — Vorstand des neu gegründeten Vereins, **M** — Mitglied darin.
- Migration `0053_sample_content.sql` ist eingespielt.

---

## TC-001: Die Gründung füllt alle fünf Tabs (FR-134, BR-165)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** einen neuen Sportverein gründen | Die Gründung gelingt | | |
| 2 | Den Tab «Agenda» öffnen | Zwei Termine und ein Helfer-Event – keine leere Fläche (FR-141) | | |
| 3 | Das Helfer-Event öffnen | Zwei Schichten (FR-140) | | |
| 4 | Den Tab «Marktplatz» öffnen | Drei Aufgaben mit Titel, Warum und Punktwert (FR-139) | | |
| 5 | Den Feed öffnen | Drei Einführungs-Beiträge (FR-142) | | |
| 6 | Die drei Beiträge lesen | Punkte, Beitragen, Transparenz – die drei Dinge, die ein Mitglied zuerst wissen will (FR-143) | | |
| 7 | Dashboard und Rangliste öffnen | Kein Bildschirm ohne Inhalt oder Erklärung (BR-165) | | |
| 8 | Einen **Musikverein** gründen | «Probe», «Konzert», «Helfende fürs Konzert» statt Training und Spiel (BR-164) | | |
| 9 | Einen Quartierverein gründen | «Quartiertreff», «Frühlingsputz» | | |

---

## TC-002: Beispiele sind erkennbar (FR-135, BR-160)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Beispielaufgabe im Marktplatz ansehen | Ein Abzeichen «Beispiel» in der Zeile | | |
| 2 | Einen Beispieltermin in der Agenda ansehen | Ebenso | | |
| 3 | Einen Einführungs-Beitrag ansehen | Das Abzeichen neben dem Datum | | |
| 4 | Die Beispielaufgabe antippen | Auch im Blatt steht die Kennzeichnung, samt einem Satz, was sie bedeutet | | |
| 5 | In einer anderen Sprache prüfen | «Exemple», «Esempio», «Example» | | |
| 6 | Einen echten Vereinsinhalt daneben ansehen | **Kein** Abzeichen – ein falsch gekennzeichneter Inhalt wäre schlimmer als andersherum | | |

---

## TC-003: Beispiele sind folgenlos (BR-161, FR-138, A2)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Nach der Gründung die Inbox von **V** prüfen | **Keine** Meldung aus einem Beispielinhalt | | |
| 2 | Den Punktestand von **V** prüfen | Null – aus Beispielen entsteht keine Buchung | | |
| 3 | `point_transactions` des Vereins abfragen | Leer | | |
| 4 | Die Verbindungs-Quote prüfen | Kein Eintrag aus einem Beispiel | | |
| 5 | Als **M** eine Beispielaufgabe öffnen | Kein «Übernehmen», stattdessen der Satz «Das ist ein Beispiel …» | | |
| 6 | Per SQL `claim_task()` auf eine Beispielaufgabe aufrufen | Abgewiesen (C-011 – die Sperre liegt am Server) | | |
| 7 | Als **M** einem Beispieltermin zusagen | Kein Weg dazu; per SQL abgewiesen | | |
| 8 | Per SQL `take_shift()` auf eine Beispielschicht aufrufen | Abgewiesen | | |
| 9 | Eine Erinnerung für Unentschiedene auslösen | Beispieltermine lösen keine aus | | |

---

## TC-004: Eigene Inhalte verdrängen die Beispiele (FR-137, Schritt 6)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** einen eigenen Termin erfassen | Er erscheint in der Agenda | | |
| 2 | `select expire_sample_content();` aufrufen | Die Beispieltermine sind weg | | |
| 3 | Marktplatz und Feed prüfen | Beispielaufgaben und Einführungs-Beiträge stehen noch da | | |
| 4 | Eine eigene Aufgabe ausschreiben und den Aufruf wiederholen | Die Beispielaufgaben verschwinden, die Beiträge bleiben (A4) | | |
| 5 | Eine eigene News publizieren und den Aufruf wiederholen | Erst jetzt verschwinden die Einführungs-Beiträge | | |
| 6 | Prüfen, ob dabei ein eigener Inhalt verloren ging | Keiner (BR-163) | | |

---

## TC-005: Entfernen in einem Schritt (FR-136, BR-162, BR-163)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** die Vereinseinstellungen öffnen | Abschnitt «Beispielinhalte» mit der Liste der verbliebenen | | |
| 2 | Die Fussnote lesen | Sie sagt, dass sie von selbst verschwinden – niemand muss aufräumen | | |
| 3 | «Beispielinhalte entfernen» tippen | Eine Rückfrage **vor** der Aktion | | |
| 4 | Die Knopffarben ansehen | «Entfernen» rot über die Rolle, «Abbrechen» in Vereinsfarbe – kein `color` von Hand | | |
| 5 | Abbrechen | Nichts wurde gelöscht | | |
| 6 | Bestätigen | Toast nennt die Anzahl **und** sagt, dass keine Vereinsdaten betroffen waren | | |
| 7 | Agenda, Marktplatz und Feed prüfen | Kein Beispiel mehr; die eigenen Inhalte stehen unverändert da | | |
| 8 | Die Schichten des Beispiel-Helfer-Events prüfen | Sie sind mit ihrem Termin verschwunden | | |
| 9 | Als **M** die Aktion versuchen | Kein Weg dorthin; per SQL abgewiesen | | |
| 10 | Den Knopf bei leerer Liste ansehen | Gesperrt – nichts zu entfernen ist kein Fehler | | |

---

## TC-006: Einen Beispielinhalt behalten (A3)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Im Abschnitt «Beispielinhalte» eine Zeile nach links wischen | «Als eigenen Inhalt übernehmen» erscheint | | |
| 2 | Die Aktion wählen | Toast bestätigt | | |
| 3 | Den Inhalt im Marktplatz ansehen | **Kein** Abzeichen mehr | | |
| 4 | Als **M** ihn öffnen | Jetzt lässt er sich übernehmen | | |
| 5 | Die übrigen Beispiele entfernen | Der übernommene bleibt (BR-163) | | |
| 6 | Als **M** die Übernahme versuchen | Abgewiesen – nur der Vorstand übernimmt | | |
| 7 | Einen übernommenen Termin prüfen | Zusage möglich; Erinnerungen greifen wieder | | |

---

## TC-007: Ablauf der Frist (A1, FR-137)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `clubs.created_at` um 40 Tage zurückdatieren | Vorbereitung | | |
| 2 | `select expire_sample_content();` aufrufen | Alle Beispiele sind weg | | |
| 3 | Die Inbox von **V** prüfen | **Eine** Meldung darüber | | |
| 4 | Den Aufruf wiederholen | Keine zweite Meldung | | |
| 5 | `clubs.settings.sample.days` auf 60 setzen und einen 40 Tage alten Verein prüfen | Die Beispiele bleiben | | |
| 6 | `select * from cron.job where jobname = 'sample-expire';` | Der Auftrag ist eingerichtet | | |

---

## TC-008: Leere Zustände mit Angebot (FR-144, BR-165)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Alle Beispiele entfernen und die Agenda öffnen | Eine Erklärung – keine leere Fläche | | |
| 2 | Prüfen, ob ein nächster Schritt angeboten wird | Ja, als Knopf unter der Erklärung | | |
| 3 | Dasselbe im Marktplatz und im Feed | Ebenso | | |
| 4 | Den Knopf antippen | Er führt dorthin, wo der Schritt geschieht | | |
| 4a | Als Trainer:in die leere Agenda und den leeren Marktplatz prüfen | Der Knopf öffnet das Formular; als Mitglied führt er zum Marktplatz bzw. zur Agenda | | |
| 4b | Mitglieder so filtern, dass niemand passt | «Filter zurücksetzen» stellt die Liste wieder her | | |
| 4c | Als Mitglied eine Vorstandsseite öffnen (Einladungen, Regeln, Anfragen) | «Nur der Vorstand …» mit dem Knopf «Profil» | | |
| 4d | Vorschläge, Anliegen und Ämter ohne Inhalt öffnen | Der Block-Knopf fehlt; das Angebot steht im Leerzustand | | |
| 5 | Mit einer Sprachausgabe prüfen | Erklärung und Knopf sind erreichbar | | |
| 6 | In allen vier Sprachen prüfen | Kein abgeschnittener Text | | |

---

## TC-009: Der Demo-Verein (FR-145, A5, BR-166)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `select join_demo_club();` als angemeldete Person aufrufen | Beitritt gelingt | | |
| 2 | Die eigene Rolle dort prüfen | `member` – ein Gast baut die App nicht um | | |
| 3 | Den Demo-Verein wechseln und die Tabs ansehen | Befüllt: Termine, Aufgaben, Beiträge, Mitglieder | | |
| 4 | Dort etwas anlegen | Es erscheint | | |
| 5 | `select reset_demo_club();` aufrufen | Die Gäste und ihre Daten sind weg, die Beispiele wieder da | | |
| 6 | Den **eigenen** Verein prüfen | Unverändert – der Reset berührt ihn nicht (BR-166) | | |
| 7 | `select count(*) from clubs where is_demo;` | Genau 1 – ein eindeutiger Index hält es so | | |
| 8 | `select * from cron.job where jobname = 'demo-reset';` | Der Auftrag ist eingerichtet | | |

---

## TC-010: iOS-Erscheinung

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Abzeichen im Dunkelmodus prüfen | Lesbar, nicht aufdringlich | | |
| 2 | Die Zeilenaktion «Übernehmen» mit dem Daumen wischen | Erreichbar ohne Zielen | | |
| 3 | Auf 320 px prüfen | Kein waagerechtes Scrollen | | |
| 4 | Die Rückfrage vor dem Entfernen ansehen | Als Systemdialog, nicht als eigener Dialog | | |
| 5 | Während des Ladens hinsehen | Ein Skelett, kein Spinner | | |

---

## Offen

- **FR-145 bleibt `Partial`.** Mandant, Beitritt und nächtlicher Reset stehen;
  der Weg in den Demo-Verein führt weiterhin über ein Konto. Ein wirklich
  anonymer Zugang wäre eine Anmeldung ohne Anmeldung – das ist eine
  Produktentscheidung, keine Implementierung.
- **Die Verfallsfrist von 30 Tagen** ist eine Annahme; `requirements.md` führt
  sie als offenen Punkt 5.
- **Der Wortlaut der Beispiele ist deutsch** und liegt in der Datenbank, nicht
  in den Sprachdateien – wie die Check-in-Fragen aus UC-032. Ein Verein, der
  anders spricht, übernimmt oder löscht sie.
- **Der nächtliche Reset** löscht alles, was Gäste im Demo-Verein angelegt
  haben. Zwei Personen gleichzeitig ändern einander die Daten.

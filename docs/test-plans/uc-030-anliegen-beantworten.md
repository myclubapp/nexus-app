# Manual Test Plan: UC-030 — Anliegen beantworten

**Use Case:** [UC-030](../use_cases/UC-030-anliegen-beantworten.md)
**Geltungsbereich:** Eingang, Statuswechsel, Antwort, anonymer Rückkanal, Folge-Artefakte, Anmahnung
**Anforderungen:** FR-091, FR-092, FR-093, FR-094, FR-099, FR-100
**Regeln:** BR-128 bis BR-131
**Erstellt:** 2026-09-10

## Vorbereitung

- **V** — Vorstand, **TR** — Trainer:in von Team «Aktive».
- **A** — Mitglied in «Aktive», **B** — unbeteiligtes Mitglied.
- Migrationen `0046_voice_notes.sql` und `0047_answer_voice_notes.sql` sind
  eingespielt.
- Für TC-007 wird `clubs.settings.voice.answerDays` benötigt (Vorgabe 14).

---

## TC-001: Der Eingang zeigt, was zu tun ist (FR-092, Schritte 1–3)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **A** ein Anliegen «An den Vorstand» senden | Es entsteht | | |
| 2 | Als **V** die Inbox prüfen | Meldung «Ein Anliegen ist eingegangen», ohne den Text | | |
| 3 | Als **V** Profil → «Stimme» öffnen | Abschnitt «Eingang» steht **zuoberst**, vor «Deine Anliegen» | | |
| 4 | Die Zeile ansehen | Art, Transkript, Eingangswoche und das Abzeichen «Offen» | | |
| 5 | Als **TR** dieselbe Seite öffnen | Das Anliegen steht **nicht** im Eingang – gemeint war der Vorstand | | |
| 6 | Als **A** dieselbe Seite öffnen | Das eigene Anliegen steht unter «Deine Anliegen», **nicht** im Eingang | | |
| 7 | Als **A** prüfen, ob die Zeile antippbar ist | Nein – niemand beantwortet sein eigenes Anliegen | | |

---

## TC-002: Ein Tipp setzt den Status (FR-092, Schritt 4)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** das Anliegen antippen | Das Blatt öffnet sich; das Transkript steht **ungekürzt** da | | |
| 2 | Das Segment ansehen | Genau zwei Felder: «Offen» und «In Arbeit» | | |
| 3 | «In Arbeit» tippen | Kein weiterer Dialog; die Liste zeigt danach «In Arbeit» | | |
| 4 | Per SQL `set_note_status(id, 'answered')` aufrufen | Abgewiesen – ein Endstatus entsteht nur mit einer Antwort (BR-128) | | |
| 5 | Als **A** die eigene Zeile ansehen | Sie zeigt «In Arbeit» – die einreichende Person sieht, dass jemand hinschaut | | |
| 6 | Als **B** `set_note_status` auf dasselbe Anliegen versuchen | Abgewiesen – «nicht an dich gerichtet» | | |

---

## TC-003: Ohne Antwort kein Endstatus (FR-099, BR-128, Schritte 5–7)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Im Blatt den Antworttext leer lassen | Der Hauptknopf ist gesperrt, darunter steht «Schreibe zuerst deine Antwort.» | | |
| 2 | Den Knopf «Ablehnen» ansehen | Ebenfalls gesperrt – die Ablehnung ist eine Antwort, kein Ausbleiben | | |
| 3 | Nur Leerzeichen eingeben | Beide bleiben gesperrt | | |
| 4 | Eine Antwort schreiben und senden | Toast «Antwort zugestellt.»; das Blatt schliesst | | |
| 5 | Als **A** die Inbox prüfen | Meldung über die Antwort | | |
| 6 | Als **A** die eigene Zeile ansehen | Status «Beantwortet», die Antwort steht in Anführungszeichen darunter | | |
| 7 | In der Datenbank die Zeile prüfen | `response`, `answered_at` und `answered_by` sind gesetzt (FR-099) | | |
| 8 | Als **V** das beantwortete Anliegen erneut öffnen | Nur noch Lesestück: kein Segment, kein «Ablehnen», kein «Melden» | | |
| 9 | Per SQL `response` auf leer setzen | Vom Constraint abgewiesen, solange der Status ein Endstatus ist | | |

---

## TC-004: Antwort trotz Anonymität (FR-091, BR-129, A1)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **A** ein **anonymes** Anliegen senden | Der Hinweis nennt das Ticket auf dem Gerät | | |
| 2 | Als **V** den Eingang prüfen | Das Anliegen steht da, ohne jede Angabe zur Person | | |
| 3 | Als **V** antworten | Toast bestätigt | | |
| 4 | Prüfen, wer benachrichtigt wurde | **Niemand** – zum anonymen Anliegen gibt es keine Adresse (BR-129) | | |
| 5 | Als **A** die Seite neu laden | Abschnitt «Anonymer Faden» steht unten, mit der Antwort des Vorstands | | |
| 6 | Als **B** auf demselben Gerät anmelden und die Seite öffnen | Der Faden ist **trotzdem** da – er hängt am Ticket, nicht am Konto | | |
| 7 | Als **A** auf einem **anderen** Gerät anmelden | Der Faden fehlt – dort liegt kein Ticket | | |
| 8 | Im Faden nachfassen und senden | Toast «Im Faden abgelegt.»; die Rückfrage steht im Verlauf | | |
| 9 | Prüfen, ob dabei ein neues Anliegen entstand | Nein – der Text hängt am selben Faden, das Kontingent bleibt unberührt | | |
| 10 | Als **V** das Anliegen erneut öffnen | Der Verlauf zeigt beide Seiten; der Status steht wieder auf «In Arbeit» | | |
| 11 | Im Browser-Speicher das Ticket löschen und neu laden | Der Faden ist weg – das ist der Preis echter Anonymität | | |
| 12 | Per SQL `anon_thread('')` und `anon_thread('falsch')` aufrufen | Beide liefern nichts | | |

---

## TC-005: Aus dem Wort eine Handlung (FR-093, BR-130, A3)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Ein offenes Anliegen öffnen und «In Aufgabe umwandeln» einschalten | Titel, Warum, Kategorie und Punktwert erscheinen | | |
| 2 | Den Titelvorschlag ansehen | Er ist die erste Zeile des Transkripts, gekürzt auf 60 Zeichen | | |
| 3 | Den Punktvorschlag ansehen | Er folgt der Vereinsregel `task_done`, nicht einer festen Zahl | | |
| 4 | Das Warum leer lassen | «Die Aufgabe braucht ihr Warum.», Hauptknopf gesperrt | | |
| 5 | Warum ergänzen und senden | Toast bestätigt | | |
| 6 | Den Marktplatz öffnen | Die Aufgabe steht dort; die Beschreibung ist das Transkript | | |
| 7 | In der Datenbank `voice_notes.converted_task_id` prüfen | Verweist auf die Aufgabe | | |
| 8 | Dasselbe Anliegen erneut öffnen | Statt des Schalters steht «Aus diesem Anliegen ist bereits eine Aufgabe entstanden.» (BR-130) | | |
| 9 | Per SQL `convert_note_to_task` ein zweites Mal aufrufen | Abgewiesen | | |

---

## TC-006: Antwort öffentlich machen (FR-100, A2)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** ein Anliegen öffnen | Der Schalter «Als News publizieren» ist da | | |
| 2 | Als **TR** ein an Trainer:innen gerichtetes Anliegen öffnen | Der Schalter fehlt – eine Antwort an alle ist eine Vereinsmitteilung | | |
| 3 | Als **V** den Schalter einschalten, antworten und senden | Toast bestätigt | | |
| 4 | Den News-Feed öffnen | Eintrag «Aus dem Vorstand» mit dem Antworttext | | |
| 5 | Die Inbox eines beliebigen Mitglieds prüfen | Die News ist zugestellt (UC-026) | | |
| 6 | Prüfen, ob die News das Anliegen zitiert | Nein – nur die Antwort steht drin | | |

---

## TC-007: Unbeantwortetes wird sichtbar (FR-094, BR-131, A5)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Ein Anliegen anlegen und sein `created_at` 20 Tage zurückdatieren | Vorbereitung | | |
| 2 | `select flag_unanswered_notes();` aufrufen | Gibt 1 zurück | | |
| 3 | Die Vereins-Gesundheit als **V** öffnen | Hinweis `inputs_unanswered` mit der Anzahl offener Anliegen | | |
| 4 | Die Inbox von **V** prüfen | Meldung zum Signal (UC-023) | | |
| 5 | Denselben Aufruf ein zweites Mal | Gibt 0 zurück – ein Signal je Anlass, keine tägliche Wiederholung | | |
| 6 | `clubs.settings.voice.answerDays` auf 30 setzen und ein neues Signal erzwingen | Das 20 Tage alte Anliegen zählt nicht mehr | | |
| 7 | Als **TR** die Vereins-Gesundheit öffnen | Das Vereinssignal ist dort nicht sichtbar (BR-096) | | |
| 8 | Ein anonymes, altes Anliegen prüfen | Es wird mitgezählt – die Kalenderwoche genügt als Alter (BR-122 bleibt) | | |
| 9 | `select * from cron.job where jobname = 'voice-unanswered';` | Der Auftrag ist eingerichtet | | |

---

## TC-008: Missbrauch melden (A6)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** ein Anliegen öffnen und «Anliegen melden» tippen | Toast «Gemeldet. Das Anliegen ist aus deinem Eingang verschwunden.» | | |
| 2 | Die Seite ansehen | Das Anliegen steht unter «Gemeldet», nicht mehr im Eingang | | |
| 3 | Die Datenbank prüfen | Die Zeile besteht weiter, `flagged_at` ist gesetzt – gelöscht wird nichts | | |
| 4 | Versuchen, das gemeldete Anliegen zu beantworten | Kein Weg dazu im UI | | |
| 5 | Als **B** `flag_note` auf ein fremdes Anliegen aufrufen | Abgewiesen | | |
| 6 | `flag_unanswered_notes()` aufrufen | Das gemeldete Anliegen wird nicht angemahnt | | |

---

## TC-009: Vier Sprachen

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch stellen und das Blatt öffnen | Alle Texte übersetzt, keine Schlüssel sichtbar | | |
| 2 | Dasselbe auf Italienisch | Ebenso | | |
| 3 | Dasselbe auf Englisch | Ebenso | | |
| 4 | Die Abschnittstitel «Eingang», «Gemeldet», «Anonymer Faden» prüfen | Übersetzt | | |
| 5 | Eine Antwort ohne Text versuchen | Die Fehlermeldung erscheint in der gewählten Sprache | | |

---

## TC-010: iOS-Erscheinung und Bedienung

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Seite im iOS-Modus öffnen | Gruppierte Listen mit abgerundeten Ecken; Kopfzeile fährt beim Scrollen zusammen | | |
| 2 | Ein Anliegen antippen | Das Blatt fährt über die Seite und lässt die Seite darunter stehen | | |
| 3 | Das Blatt nach unten wischen | Es schliesst; nichts wurde gesendet | | |
| 4 | Im Material-Modus dasselbe prüfen | Bedienbar, keine kaputte Darstellung | | |
| 5 | Auf einem schmalen Gerät (320 px) prüfen | Kein waagerechtes Scrollen, Texte brechen um | | |
| 6 | Die Seite nach unten ziehen | Aktualisierung lädt Anliegen **und** Kontingent neu | | |

---

## Offen

- **Der Rückweg hängt am Gerät.** Wer den Browserspeicher löscht, verliert den
  anonymen Faden. Das ist gewollt (BR-129) und in Schritt 11 von TC-004
  festgehalten – ein Wiederherstellungsweg wäre eine Hintertür zur Identität.
- **Die «im Verein bestimmte Stelle»** aus A6 gibt es im Datenmodell nicht. Ein
  gemeldetes Anliegen verschwindet aus dem Eingang und bleibt dem Vorstand
  sichtbar. Zu klären mit den Stakeholdern.
- **Die Ämter-Aktion aus BR-130** hat kein Modul; von den zwei Folge-Artefakten
  ist nur die Aufgabe gebaut.

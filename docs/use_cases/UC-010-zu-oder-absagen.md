# Use Case: Auf einen Termin zu- oder absagen

## Overview

**Use Case ID:** UC-010
**Use Case Name:** Auf einen Termin zu- oder absagen
**Primary Actor:** Mitglied
**Goal:** Der Organisation rechtzeitig mitteilen, ob man an einem Termin teilnimmt
**Status:** Implemented

## Preconditions

- Das Mitglied ist angemeldet und einem Team zugeordnet, für das der Termin gilt.
- Der Termin liegt in der Zukunft und ist nicht abgesagt.

## Main Success Scenario

1. Mitglied öffnet die Agenda und wählt einen Termin.
2. System zeigt Titel, Zeit, Ort, das Warum sofern hinterlegt und den aktuellen Teilnehmerstand.
3. Mitglied wählt «Zusagen».
4. System speichert die Zusage und zeigt sie im Teilnehmerstand an.
5. System zeigt an, wie viele Punkte die Teilnahme bringt.
6. System bietet den Termin dem Kalender des Geräts an – mit Titel, Ort, Zeitfenster, Terminart und Warum. Das Mitglied sichert ihn dort oder verwirft ihn; die Zusage bleibt in beiden Fällen bestehen (BR-187).

## Alternative Flows

### A1: Absagen mit Grund

**Trigger:** Mitglied wählt «Absagen» (Schritt 3)
**Flow:**

1. System bietet vorformulierte Gründe und ein Freitextfeld an.
2. Mitglied wählt oder schreibt einen Grund und bestätigt.
3. System speichert die Absage mit dem Grund.
4. Erfolgt die Absage mehr als 24 Stunden vor Terminbeginn, bucht das System Punkte für die rechtzeitige Abmeldung, sofern die zugehörige Regel aktiv ist.
5. Use case ends.

### A2: Antwort ändern

**Trigger:** Mitglied hat bereits geantwortet und wählt die andere Option (Schritt 3)
**Flow:**

1. System ersetzt die bisherige Antwort.
2. Bereits gebuchte Punkte für eine rechtzeitige Abmeldung bleiben bestehen; eine erneute Buchung findet nicht statt.
3. Use case continues at step 4.

### A3: Termin abgesagt

**Trigger:** Der Termin wurde inzwischen abgesagt (Schritt 2)
**Flow:**

1. System zeigt die Absage samt Grund und sperrt die Antwortmöglichkeiten.
2. Use case ends.

### A4: Helfer-Event mit Schichten

**Trigger:** Der Termin ist ein Helfer-Event (Schritt 2)
**Flow:**

1. System zeigt statt einer einfachen Zusage die Liste der Schichten.
2. Use case continues at UC-012.

## Postconditions

### Success Postconditions

- Die Antwort des Mitglieds ist am Termin vermerkt.
- Der Teilnehmerstand ist für die Verantwortlichen aktuell.
- Bei rechtzeitiger Absage sind allfällige Punkte gebucht.
- Bei einer Zusage ist der Termin dem Kalender des Geräts angeboten worden; ob er dort steht, entscheidet das Mitglied.

### Failure Postconditions

- Die bisherige Antwort bleibt unverändert.
- Das System zeigt eine Fehlermeldung.

## Business Rules

### BR-037: Eine Antwort pro Mitglied und Termin

Ein Mitglied hat je Termin genau eine Antwort. Eine neue Antwort ersetzt die alte.

### BR-038: Antwort ist bis Terminbeginn änderbar

Bis zum Terminbeginn kann die Antwort geändert werden; danach zählt die tatsächliche Anwesenheit.

### BR-039: Absage ohne Punkteabzug

Eine Absage führt nie zu einem Punkteabzug. Es gibt keine Bestrafung für Nichtteilnahme.

### BR-040: Frist für die Abmeldeprämie

Punkte für eine rechtzeitige Abmeldung entstehen nur bei einer Absage mehr als 24 Stunden vor Terminbeginn und nur einmal je Termin.

### BR-187: Der Kalendereintrag ist ein Angebot, kein Abbild

Der Eintrag im Kalender des Geräts ist eine Kopie zum Zeitpunkt der Zusage. Er wird über das Blatt des Systems angeboten – auf dem Gerät ohne Kalender-Berechtigung, im Browser als ICS-Datei – und das Mitglied kann ihn verwerfen, ohne dass die Zusage davon berührt wird. Änderungen und Absagen des Termins ziehen nicht in den Gerätekalender nach; ein abonnierbarer Feed bleibt FR-133. Ein Termin ohne Ende dauert im Eintrag eine Stunde. Ein Eintrag entsteht nie ohne Zusage. Dieselbe Regel gilt für übernommene Schichten (UC-012), dort mit dem Zeitfenster der Schicht.

### BR-196 (UC-012): Die Schicht ist die Antwort

Bei einem Termin mit Schichten gibt es keine Zusage zum Anlass – kein «Mein Status», kein Wischen, keine Listen, keine Erinnerung. Wer helfen will, übernimmt eine Schicht (UC-012).

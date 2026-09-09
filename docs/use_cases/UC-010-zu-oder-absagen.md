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

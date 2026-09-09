# Use Case: Aufgabe bestätigen und Kudos geben

## Overview

**Use Case ID:** UC-019
**Use Case Name:** Aufgabe bestätigen und Kudos geben
**Primary Actor:** Vorstand
**Goal:** Eine erledigte Aufgabe bestätigen, die Punkte auslösen und den Beitrag persönlich würdigen
**Status:** Implemented

## Preconditions

- Eine Aufgabe trägt den Status eingereicht.
- Die bestätigende Person hat im Verein die Rolle trainer oder admin.

## Main Success Scenario

1. System benachrichtigt die verantwortliche Person über die Einreichung.
2. Vorstand öffnet die eingereichte Aufgabe.
3. System zeigt Aufgabe, übernehmende Person, Einreichungszeitpunkt und allfälligen Nachweis.
4. Vorstand schreibt ein kurzes Dankeswort.
5. Vorstand wählt «Bestätigen».
6. System setzt die Aufgabe auf erledigt, vermerkt die bestätigende Person und bucht den an der Aufgabe hinterlegten Punktwert in den Ledger.
7. System benachrichtigt das Mitglied mit dem Dankeswort; die Punktzahl steht nachgeordnet.
8. System zeigt das Dankeswort auf dem Profil des Mitglieds als Kudos an.

## Alternative Flows

### A1: Nachbesserung nötig

**Trigger:** Vorstand hält die Erledigung für unvollständig (Schritt 5)
**Flow:**

1. Vorstand wählt «Zurück an die Person» und schreibt einen Hinweis in wertschätzendem Ton.
2. System setzt die Aufgabe zurück auf übernommen und benachrichtigt das Mitglied.
3. Use case ends.

### A2: Dankeswort weggelassen

**Trigger:** Vorstand bestätigt ohne Text (Schritt 4)
**Flow:**

1. System weist einmalig darauf hin, dass ein Dankeswort mehr wirkt als die Zahl.
2. Vorstand bestätigt trotzdem.
3. Use case continues at step 6.

### A3: Nur-Dank-Kategorie

**Trigger:** Die Kategorie der Aufgabe ist auf «nur Dank» gestellt (Schritt 6)
**Flow:**

1. System bucht keine Punkte und zeigt dem Mitglied ausschliesslich das Dankeswort.
2. Use case continues at step 8.

### A4: Bereits bestätigt

**Trigger:** Die Aufgabe wurde zwischenzeitlich bestätigt (Schritt 6)
**Flow:**

1. System verwirft die zweite Buchung still.
2. Use case ends.

## Postconditions

### Success Postconditions

- Die Aufgabe trägt den Status erledigt mit Angabe der bestätigenden Person.
- Genau eine Punktebuchung mit Bezug zur Aufgabe existiert, sofern die Kategorie Punkte vorsieht.
- Das Kudos ist am Profil des Mitglieds sichtbar.

### Failure Postconditions

- Die Aufgabe bleibt eingereicht.
- Es entsteht keine Punktebuchung und kein Kudos.

## Business Rules

### BR-077: Aufgaben buchen ihren eigenen Wert

Die Bestätigung bucht den Punktwert der Aufgabe direkt, nicht den Wert einer Punkteregel.

### BR-078: Kudos vor Punktzahl

In jeder Rückmeldung an das Mitglied steht die Anerkennung vor der Zahl.

### BR-079: Keine Doppelbuchung

Zu einer Aufgabe und einem Mitglied entsteht höchstens eine Buchung.

### BR-080: Nur Verantwortliche bestätigen

Wer eine Aufgabe selbst übernommen hat, kann sie nicht selbst bestätigen.

# Use Case: Termin erstellen

## Overview

**Use Case ID:** UC-009
**Use Case Name:** Termin erstellen
**Primary Actor:** Trainer:in
**Goal:** Einen einzelnen Termin oder eine Terminserie erfassen, damit das Team Bescheid weiss
**Status:** Implemented

## Preconditions

- Der Verein existiert und hat mindestens ein Team.
- Die Person hat im Verein die Rolle trainer oder admin.

## Main Success Scenario

1. Trainer:in wählt in der Agenda «Termin erstellen».
2. System zeigt das Terminformular mit den Termintypen in der Sprache des Vereins.
3. Trainer:in wählt den Termintyp.
4. Trainer:in gibt Titel, Beginn, Ende und Ort ein.
5. Trainer:in wählt das Team oder markiert den Termin als Vereinstermin.
6. System schlägt die zum Termintyp passende Punkteregel vor.
7. Trainer:in bestätigt die Punkteregel oder wählt eine andere.
8. Trainer:in speichert.
9. System legt den Termin an, erzeugt ein Check-in-Token und zeigt ihn in der Agenda aller betroffenen Mitglieder an.
10. System benachrichtigt die betroffenen Mitglieder über den neuen Termin.

## Alternative Flows

### A1: Terminserie

**Trigger:** Trainer:in aktiviert «wiederholt sich» (Schritt 4)
**Flow:**

1. Trainer:in wählt Rhythmus, Wochentag und Enddatum der Serie.
2. System zeigt eine Vorschau der zu erzeugenden Termine.
3. Trainer:in bestätigt.
4. System legt alle Termine der Serie an und verknüpft sie miteinander.
5. Use case continues at step 10.

### A2: Einzeltermin einer Serie ändern

**Trigger:** Trainer:in bearbeitet einen Termin, der zu einer Serie gehört
**Flow:**

1. System fragt, ob nur dieser Termin oder die gesamte Serie geändert werden soll.
2. Trainer:in entscheidet.
3. System wendet die Änderung entsprechend an.
4. Use case ends.

### A3: Helfer-Event

**Trigger:** Trainer:in wählt in Schritt 3 den Typ Helfer-Event
**Flow:**

1. System verlangt zusätzlich das Warum-Feld.
2. Use case continues at UC-011.

### A4: Termin absagen

**Trigger:** Trainer:in wählt bei einem bestehenden Termin «Absagen»
**Flow:**

1. System verlangt einen Absagegrund.
2. Trainer:in gibt den Grund ein und bestätigt.
3. System markiert den Termin als abgesagt, sperrt Zu- und Absagen sowie Check-in und benachrichtigt alle Betroffenen mit dem Grund.
4. Use case ends.

### A5: Zeitangaben unplausibel

**Trigger:** Das Ende liegt vor dem Beginn (Schritt 8)
**Flow:**

1. System weist das Speichern zurück und markiert das betroffene Feld.
2. Use case continues at step 4.

## Postconditions

### Success Postconditions

- Der Termin existiert mit Typ, Zeit, Ort, Zuständigkeit und Punkteregel.
- Ein Check-in-Token ist erzeugt.
- Die betroffenen Mitglieder sehen den Termin und wurden benachrichtigt.

### Failure Postconditions

- Es entsteht kein Termin.
- Es wird niemand benachrichtigt.

## Business Rules

### BR-032: Termintypen sind neutral, Labels sind vereinsspezifisch

Die Datenbank kennt technische Termintypen. Wie sie heissen – «Training», «Probe», «Anlass» – bestimmt der Verein.

### BR-033: Nur Trainer:innen und Vorstand erfassen Termine

Die Berechtigung wird serverseitig geprüft. Trainer:innen erfassen Termine für ihre Teams.

### BR-034: Punkteregel ist am Termin verankert

Der Punktwert einer Teilnahme ergibt sich aus der am Termin hinterlegten Regel, nicht aus einer Eingabe beim Check-in.

### BR-035: Absage braucht einen Grund

Ein Termin kann nur mit angegebenem Grund abgesagt werden; der Grund erreicht alle Betroffenen.

### BR-036: Warum-Pflicht bei Aufrufen

Helfer-Events, Vereinsanlässe und Generalversammlungen tragen ein ausgefülltes Warum-Feld, bevor sie publiziert werden.

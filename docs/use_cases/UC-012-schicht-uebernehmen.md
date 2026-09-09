# Use Case: Helfer-Schicht übernehmen

## Overview

**Use Case ID:** UC-012
**Use Case Name:** Helfer-Schicht übernehmen
**Primary Actor:** Mitglied
**Goal:** Sich für eine konkrete Schicht eines Helfer-Events verbindlich eintragen
**Status:** Implemented

## Preconditions

- Ein publiziertes Helfer-Event mit mindestens einer Schicht existiert.
- Das Mitglied gehört dem Verein an.

## Main Success Scenario

1. Mitglied öffnet das Helfer-Event in Agenda oder Marktplatz.
2. System zeigt das Warum des Events und alle Schichten mit Zeitfenster, Punktwert und dem Verhältnis von besetzten zu benötigten Plätzen.
3. Mitglied wählt eine Schicht mit freien Plätzen.
4. Mitglied bestätigt «Ich übernehme das».
5. System trägt das Mitglied für die Schicht ein und erhöht die Besetzung.
6. System zeigt die Schicht in der persönlichen Agenda des Mitglieds und weist darauf hin, dass die Punkte nach der Bestätigung durch die Organisation gutgeschrieben werden.

## Alternative Flows

### A1: Schicht bereits voll

**Trigger:** Die Schicht wurde zwischenzeitlich vollständig besetzt (Schritt 5)
**Flow:**

1. System weist den Eintrag ab und zeigt den aktuellen Stand.
2. Use case continues at step 3.

### A2: Austragen

**Trigger:** Mitglied wählt bei einer übernommenen Schicht «Doch nicht»
**Flow:**

1. System entfernt den Eintrag und gibt den Platz frei.
2. System informiert die Organisation, wenn die Schicht dadurch unterbesetzt ist und weniger als 48 Stunden bis zum Beginn verbleiben.
3. Use case ends.

### A3: Mehrere Schichten

**Trigger:** Mitglied möchte weitere Schichten übernehmen (Schritt 6)
**Flow:**

1. System erlaubt die Übernahme weiterer Schichten, sofern sie sich zeitlich nicht überschneiden.
2. Use case continues at step 3.

### A4: Zeitliche Überschneidung

**Trigger:** Die gewählte Schicht überschneidet sich mit einer bereits übernommenen (Schritt 4)
**Flow:**

1. System weist auf die Überschneidung hin und fragt nach ausdrücklicher Bestätigung.
2. Mitglied bestätigt oder wählt eine andere Schicht.
3. Use case continues at step 5.

## Postconditions

### Success Postconditions

- Das Mitglied ist für die Schicht eingetragen und die Besetzung ist aktualisiert.
- Die Schicht erscheint in der persönlichen Agenda.
- Es sind noch keine Punkte gebucht.

### Failure Postconditions

- Es besteht kein Eintrag für die Schicht.
- Die Besetzung bleibt unverändert.

## Business Rules

### BR-045: Punkte erst nach Bestätigung

Die Eintragung allein erzeugt keine Punkte. Punkte entstehen ausschliesslich durch die Bestätigung des tatsächlichen Einsatzes (UC-013).

### BR-046: Besetzung ist begrenzt

Eine Schicht nimmt höchstens so viele Personen auf, wie sie benötigt.

### BR-047: Austragen ist jederzeit möglich

Es gibt keine Sperrfrist und keinen Punkteabzug für ein Austragen. Bei kurzfristiger Unterdeckung wird die Organisation informiert.

### BR-048: Freiwilligkeit

Schichten sind Angebote. Niemand wird einer Schicht zugewiesen.

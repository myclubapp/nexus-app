# Use Case: Verband verbinden

## Overview

**Use Case ID:** UC-035
**Use Case Name:** Verband verbinden
**Primary Actor:** Vorstand
**Goal:** Spielpläne, Resultate und Verbandsnews automatisch in die App holen
**Status:** Implemented

## Preconditions

- Der Verein existiert.
- Die Person hat im Verein die Rolle admin.
- Der Verein besitzt einen gültigen API-Schlüssel seines Verbands.

## Main Success Scenario

1. Vorstand öffnet in den Vereinseinstellungen «Verband verbinden».
2. System zeigt die unterstützten Verbände und je Verband eine Anleitung, wo der Schlüssel zu beziehen ist.
3. Vorstand wählt seinen Verband.
4. Vorstand fügt den API-Schlüssel ein.
5. System führt einen Testaufruf gegen die Verbandsschnittstelle durch.
6. System speichert den Schlüssel verschlüsselt, setzt die Verbindung auf aktiv und startet den ersten Abgleich.
7. System fragt, ob auch die Beiträge des Verbands im News-Feed erscheinen sollen, und schaltet sie auf Wunsch ein; voreingestellt sind sie aus (FR-197, BR-260). Liefert der gewählte Verband keine Beiträge, steht dort der Grund statt eines Schalters.
8. System führt den Vorstand weiter zu den Teams: Spiele entstehen erst, wenn ein Team mit einem Verbands-Team verknüpft ist (UC-039).

## Alternative Flows

### A1: Schlüssel ungültig

**Trigger:** Der Testaufruf schlägt fehl (Schritt 5)
**Flow:**

1. System speichert nichts und zeigt die Fehlermeldung der Verbandsschnittstelle.
2. Use case continues at step 4.

### A2: Verband ohne Schlüsselpflicht

**Trigger:** Der gewählte Verband verlangt keinen Schlüssel (Schritt 4)
**Flow:**

1. System lässt das Feld leer und führt den Testaufruf ohne Schlüssel durch.
2. Use case continues at step 5.

### A3: Verbindung schlägt später fehl

**Trigger:** Ein turnusgemässer Abgleich scheitert wiederholt
**Flow:**

1. System setzt die Verbindung auf Fehler und benachrichtigt den Vorstand.
2. Die App bleibt vollständig nutzbar; nur die Verbandsdaten veralten.
3. Use case ends.

### A4: Verbindung trennen

**Trigger:** Vorstand wählt «Verbindung trennen»
**Flow:**

1. System löscht den Schlüssel und beendet den Abgleich.
2. Bereits importierte Termine bleiben bestehen.
3. Use case ends.

## Postconditions

### Success Postconditions

- Die Verbindung besteht mit dem Status aktiv und einem verschlüsselt abgelegten Schlüssel.
- Verbandsnews erscheinen im Feed, **sofern der Verein sie zugeschaltet hat** (BR-260); Spiele folgen den Verknüpfungen der Teams (UC-039).

### Failure Postconditions

- Es besteht keine Verbindung.
- Es ist kein Schlüssel gespeichert.

## Business Rules

### BR-151: Der Schlüssel ist die Verifikation

Wer den Schlüssel des Vereins besitzt, ist berechtigt. Es gibt kein Vereinsverzeichnis und keinen Zuordnungsprozess über Kontaktadressen.

### BR-152: Nur verbundene Vereine und verknüpfte Teams werden abgeglichen

Es findet kein globaler Vorabgleich aller Verbandsvereine statt. Innerhalb eines verbundenen Vereins holt der Abgleich Spiele ausschliesslich für Teams, die mit einem Verbands-Team verknüpft sind (BR-175).

### BR-153: Schlüssel liegen im Tresor

API-Schlüssel werden verschlüsselt abgelegt und nie an den Client ausgeliefert.

### BR-154: Kein Schreibzugriff auf Verbandssysteme

Der Abgleich liest ausschliesslich. Es werden keine Daten an den Verband zurückgeschrieben.

### BR-155: Verbandsausfall stört die App nicht

Fällt die Verbandsschnittstelle aus, bleiben alle Kernfunktionen unverändert nutzbar. Das gilt auch innerhalb des Abgleichs: Ein Newsraum, der nicht antwortet, setzt die Verbindung **nicht** auf Fehler – der Spielplan ist ihr Zweck, die Beiträge sind die Zugabe.

### BR-260: Verbandsnews sind zugeschaltet, nicht voreingestellt

Die Beiträge des Verbands stehen nur im Feed, wenn der Verein sie eingeschaltet hat. Die Einstellung sitzt an der Verbindung, nicht am Verein – ein Verein kann an zwei Verbänden hängen. Die Regel steht vollständig in UC-051.

# Use Case: Anliegen beantworten

## Overview

**Use Case ID:** UC-030
**Use Case Name:** Anliegen beantworten
**Primary Actor:** Vorstand
**Goal:** Auf ein eingegangenes Anliegen sichtbar reagieren, auch wenn es anonym eingereicht wurde
**Status:** Draft

## Preconditions

- Ein Anliegen liegt mit Status offen beim Vorstand oder bei einer adressierten Person.
- Die antwortende Person ist Empfängerin dieses Anliegens.

## Main Success Scenario

1. System benachrichtigt die Empfänger:innen über das neue Anliegen.
2. Vorstand öffnet die Anliegen-Inbox.
3. System zeigt alle Anliegen mit Transkript, Eingangswoche und Status.
4. Vorstand öffnet ein Anliegen und setzt es mit einem Tap auf «in Arbeit».
5. Vorstand schreibt eine Antwort.
6. Vorstand sendet die Antwort.
7. System stellt die Antwort der einreichenden Person zu und setzt das Anliegen auf beantwortet.

## Alternative Flows

### A1: Anonymes Anliegen

**Trigger:** Das Anliegen wurde anonym eingereicht (Schritt 7)
**Flow:**

1. System legt die Antwort im anonymen Faden ab; die einreichende Person holt sie über ihr lokales Ticket-Token ab.
2. Die einreichende Person kann im selben Faden nachfassen, ohne ihre Identität preiszugeben.
3. Use case ends.

### A2: Antwort öffentlich machen

**Trigger:** Vorstand aktiviert «Als News publizieren» (Schritt 6)
**Flow:**

1. System erzeugt eine News «Aus dem Vorstand» mit der Antwort.
2. Use case continues at UC-026.

### A3: In eine Aufgabe umwandeln

**Trigger:** Aus dem Anliegen folgt eine konkrete Arbeit (Schritt 5)
**Flow:**

1. Vorstand wählt «In Aufgabe umwandeln»; das System übernimmt das Transkript als Beschreibung.
2. Vorstand ergänzt Warum, Punktwert und Frist und publiziert.
3. Das Anliegen bleibt mit der Aufgabe verknüpft.
4. Use case continues at step 6.

### A4: Anliegen ablehnen

**Trigger:** Der Vorstand entscheidet gegen den Vorschlag (Schritt 5)
**Flow:**

1. Vorstand begründet den Entscheid in der Antwort und setzt das Anliegen auf abgelehnt.
2. System stellt die Begründung zu.
3. Use case ends.

### A5: Anmahnung

**Trigger:** Ein Anliegen bleibt über die im Verein gesetzte Frist hinaus unbeantwortet
**Flow:**

1. System erzeugt ein Vorstands-Signal, das die unbeantworteten Anliegen benennt.
2. Use case ends.

### A6: Missbrauch melden

**Trigger:** Ein Anliegen enthält eine Beleidigung
**Flow:**

1. Empfänger:in meldet das Anliegen.
2. System entzieht es der Inbox und legt es einer im Verein bestimmten Stelle vor.
3. Use case ends.

## Postconditions

### Success Postconditions

- Das Anliegen trägt einen Endstatus mit dokumentierter Antwort.
- Die einreichende Person hat die Antwort erhalten, auch im anonymen Fall.
- Allfällige Folge-Artefakte sind mit dem Anliegen verknüpft.

### Failure Postconditions

- Das Anliegen bleibt offen.
- Die einreichende Person hat keine Antwort erhalten.

## Business Rules

### BR-128: Speak-up braucht Listen-up

Jedes Anliegen trägt einen Status. Ein Anliegen kann abgelehnt werden, aber nicht versanden.

### BR-129: Antwort trotz Anonymität

Auch anonyme Anliegen erhalten eine Antwort. Der Rückkanal läuft über ein lokales Token, nie über die Identität.

### BR-130: Genau zwei Folge-Artefakte

Aus einem Anliegen entstehen höchstens eine Aufgabe im Marktplatz und eine Ämter-Aktion. Es gibt keine freien Aufgabenlisten und keine Protokollverwaltung.

### BR-131: Unbeantwortetes wird sichtbar

Überfällige Anliegen erzeugen ein Vorstands-Signal nach denselben Regeln wie jedes andere Signal.

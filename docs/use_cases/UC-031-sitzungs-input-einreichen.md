# Use Case: Sitzungs-Input einreichen und zuordnen

## Overview

**Use Case ID:** UC-031
**Use Case Name:** Sitzungs-Input einreichen und zuordnen
**Primary Actor:** Mitglied
**Goal:** Einen Vorschlag an ein Gremium bringen und erfahren, was damit geschieht
**Status:** Draft

## Preconditions

- Der Verein hat mindestens ein Gremium über Ämter definiert.
- Das Modul Sitzungs-Anbindung ist im Verein aktiviert.

## Main Success Scenario

1. Mitglied wählt «Vorschlag einreichen».
2. System zeigt das Eingabefeld und die Wahl des Zielgremiums.
3. Mitglied schreibt seinen Vorschlag oder nimmt ihn als Sprachmemo auf (UC-029).
4. Mitglied wählt das Zielgremium und entscheidet, ob es persönlich oder anonym einreicht.
5. Mitglied reicht ein.
6. System legt den Input im Eingangskorb des Gremiums ab und benachrichtigt dessen Amtsinhaber:innen.
7. Vorstand öffnet den Eingangskorb und entscheidet je Input: laufend bearbeiten oder der nächsten Sitzung zuordnen.
8. System setzt den Status entsprechend und zeigt ihn der einreichenden Person an.
9. Vorstand beantwortet den Input in der Sitzung oder laufend (UC-030).

## Alternative Flows

### A1: Anonym eingereicht

**Trigger:** Mitglied wählt in Schritt 4 «anonym»
**Flow:**

1. System speichert den Input ohne Angabe zur Autorschaft und vergibt ein Ticket-Token an das Gerät.
2. Der Statusverlauf und die spätere Antwort sind über dieses Token abrufbar.
3. Use case continues at step 6.

### A2: Sammelansicht in der Sitzung

**Trigger:** Die Sitzung beginnt (Schritt 9)
**Flow:**

1. System zeigt die dieser Sitzung zugeordneten offenen Inputs sowie die zwei Dauerthemen: vakante Ämter und offene Helfereinsätze.
2. System bietet keine Traktandenverwaltung und kein Protokollwerkzeug an.
3. Use case continues at step 9.

### A3: Verteiler über Ämter

**Trigger:** Ein Amt wechselt zwischen Einreichung und Sitzung die Person
**Flow:**

1. System löst den Empfängerkreis zum Zeitpunkt der Zustellung über die aktuellen Amtsinhaber:innen auf.
2. Use case continues at step 6.

### A4: Falsches Gremium

**Trigger:** Der Input gehört an eine andere Stelle (Schritt 7)
**Flow:**

1. Vorstand leitet den Input an das zuständige Gremium weiter; der Statusverlauf bleibt erhalten.
2. Use case continues at step 7.

## Postconditions

### Success Postconditions

- Der Input liegt beim Zielgremium und trägt einen sichtbaren Status.
- Die einreichende Person kennt den Stand, persönlich oder über ihr Token.

### Failure Postconditions

- Es entsteht kein Input.
- Es wird niemand benachrichtigt.

## Business Rules

### BR-132: Die App verwaltet den Dialog, nicht die Sitzung

Es gibt keine Traktanden, keine Protokolle, keine Beschlussverwaltung und keine freien Aufgabenlisten.

### BR-133: Teilnehmerkreis über Ämter

Gremien werden über Ämter definiert, nicht über Namenslisten. Bei einem Amtswechsel stimmt der Verteiler automatisch.

### BR-134: Status ist schon eine Antwort

Bereits die Zuordnung zu einer Sitzung ist eine sichtbare Reaktion für die einreichende Person.

### BR-135: Zwei Dauerthemen

Die Sitzungsansicht zeigt neben den Inputs ausschliesslich vakante Ämter und offene Helfereinsätze.

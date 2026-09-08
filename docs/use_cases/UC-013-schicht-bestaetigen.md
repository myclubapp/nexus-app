# Use Case: Helfer-Schicht bestätigen

## Overview

**Use Case ID:** UC-013
**Use Case Name:** Helfer-Schicht bestätigen
**Primary Actor:** Vorstand
**Goal:** Den tatsächlich geleisteten Einsatz bestätigen und damit die Punkte auslösen
**Status:** Draft

## Preconditions

- Ein Helfer-Event mit Schichten hat stattgefunden.
- Mindestens ein Mitglied ist für eine Schicht eingetragen.
- Die bestätigende Person hat im Verein die Rolle admin.

## Main Success Scenario

1. Vorstand öffnet das vergangene Helfer-Event.
2. System zeigt je Schicht die eingetragenen Mitglieder mit ihrem aktuellen Status.
3. Vorstand bestätigt die Anwesenheit der Mitglieder, die tatsächlich im Einsatz waren.
4. System setzt den Status auf anwesend, vermerkt die bestätigende Person und bucht für jedes bestätigte Mitglied den Punktwert der Schicht in den Ledger.
5. System benachrichtigt die bestätigten Mitglieder über die Gutschrift.
6. System zeigt dem Vorstand die Zusammenfassung der gebuchten Punkte.

## Alternative Flows

### A1: Mitglied war nicht da

**Trigger:** Ein eingetragenes Mitglied ist nicht erschienen (Schritt 3)
**Flow:**

1. Vorstand lässt die Bestätigung aus oder markiert das Mitglied als entschuldigt.
2. System bucht keine Punkte für dieses Mitglied.
3. Use case continues at step 4.

### A2: Kurzfristig eingesprungen

**Trigger:** Eine Person hat mitgeholfen, ohne eingetragen zu sein (Schritt 3)
**Flow:**

1. Vorstand fügt das Mitglied der Schicht hinzu.
2. System trägt es ein und bestätigt es in einem Schritt.
3. Use case continues at step 4.

### A3: Bereits bestätigt

**Trigger:** Für ein Mitglied wurde die Schicht bereits bestätigt (Schritt 4)
**Flow:**

1. System verwirft die zweite Buchung still, da zu derselben Quelle nur einmal gebucht wird.
2. Use case continues at step 5.

### A4: Bestätigung war falsch

**Trigger:** Vorstand stellt nach der Bestätigung fest, dass sie unzutreffend war
**Flow:**

1. Vorstand erfasst eine Korrekturbuchung (UC-021).
2. Use case ends.

## Postconditions

### Success Postconditions

- Die bestätigten Mitglieder tragen den Status anwesend mit Angabe der bestätigenden Person.
- Für jede Bestätigung existiert genau eine Punktebuchung der Säule 3 mit Bezug zur Schicht.
- Die bestätigten Mitglieder sind informiert.

### Failure Postconditions

- Der Status der Einträge bleibt unverändert.
- Es entstehen keine Punktebuchungen.

## Business Rules

### BR-049: Ein Ledger für alles

Bestätigte Schichten buchen direkt in den gemeinsamen Punkte-Ledger. Ein separates Helferpunkte-Konto existiert nicht.

### BR-050: Punkte schreibt nur der Server

Die Buchung erfolgt ausschliesslich über eine Datenbankfunktion. Der Client kann keine Punkte schreiben.

### BR-051: Keine Doppelbuchung

Zur Kombination aus Mitglied, Regel und Quelle entsteht höchstens eine Buchung. Eine zweite wird still verworfen.

### BR-052: Korrektur nur als Gegenbuchung

Eine falsche Buchung wird nie gelöscht oder überschrieben, sondern durch eine Gegenbuchung ausgeglichen.

### BR-053: Nur Verantwortliche bestätigen

Die Bestätigung ist dem Vorstand vorbehalten; die Prüfung erfolgt in der Datenbankfunktion.

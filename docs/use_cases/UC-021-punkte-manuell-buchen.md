# Use Case: Punkte manuell buchen oder korrigieren

## Overview

**Use Case ID:** UC-021
**Use Case Name:** Punkte manuell buchen oder korrigieren
**Primary Actor:** Vorstand
**Goal:** Einen Beitrag würdigen, den die Automatik nicht erfasst, oder eine falsche Buchung ausgleichen
**Status:** Implemented

## Preconditions

- Der Verein existiert und hat Mitglieder.
- Die Person hat im Verein die Rolle admin.

## Main Success Scenario

1. Vorstand öffnet ein Mitglied in der Mitgliederverwaltung und wählt «Punkte buchen».
2. System zeigt das Buchungsformular mit Mitglied, Säule, Punktwert und Notiz.
3. Vorstand wählt die Säule und gibt den Punktwert ein.
4. Vorstand schreibt eine Notiz, die den Anlass benennt.
5. Vorstand bestätigt.
6. System bucht die Punkte mit dem Quellentyp «manuell», vermerkt die buchende Person und die Notiz.
7. System benachrichtigt das Mitglied über die Gutschrift samt Notiz.

## Alternative Flows

### A1: Korrekturbuchung

**Trigger:** Vorstand öffnet eine bestehende Buchung und wählt «Korrigieren» (Schritt 1)
**Flow:**

1. System zeigt die zu korrigierende Buchung und schlägt eine Gegenbuchung mit umgekehrtem Vorzeichen vor.
2. Vorstand ergänzt eine Begründung und bestätigt.
3. System erzeugt eine neue Buchung mit negativem Wert und Verweis auf die ursprüngliche Buchung. Die ursprüngliche Buchung bleibt unverändert bestehen.
4. Use case ends.

### A2: Notiz fehlt

**Trigger:** Die Notiz ist leer (Schritt 5)
**Flow:**

1. System weist die Buchung zurück und erklärt, dass jede manuelle Buchung ihren Anlass trägt.
2. Use case continues at step 4.

### A3: Buchung für mehrere Mitglieder

**Trigger:** Vorstand wählt in der Mitgliederliste mehrere Personen aus (Schritt 1)
**Flow:**

1. System bucht denselben Wert mit derselben Notiz für alle gewählten Mitglieder.
2. Use case continues at step 7.

### A4: Fehlende Berechtigung

**Trigger:** Die Person hat die Rolle admin nicht (Schritt 1)
**Flow:**

1. System weist die Buchung serverseitig ab.
2. Use case ends.

## Postconditions

### Success Postconditions

- Für jedes betroffene Mitglied existiert eine Buchung mit Quellentyp «manuell», Notiz und buchender Person.
- Die betroffenen Mitglieder sind informiert.

### Failure Postconditions

- Es entsteht keine Buchung.
- Der Punktestand bleibt unverändert.

## Business Rules

### BR-085: Der Ledger ist unveränderlich

Buchungen werden nie geändert oder gelöscht. Jede Korrektur ist eine zusätzliche Gegenbuchung.

### BR-086: Manuelle Buchung braucht eine Notiz

Jede manuelle Buchung nennt ihren Anlass, damit sie nachvollziehbar bleibt.

### BR-087: Negative Werte nur als Korrektur

Ein negativer Wert ist ausschliesslich als Gegenbuchung zu einer bestehenden Buchung zulässig.

### BR-088: Keine Umgehung der Dedup-Regel

Eine bereits verworfene Doppelbuchung wird nicht über eine manuelle Buchung auf derselben Quelle nachgeholt.

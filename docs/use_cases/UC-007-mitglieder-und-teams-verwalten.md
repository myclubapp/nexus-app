# Use Case: Mitglieder, Rollen und Teams verwalten

## Overview

**Use Case ID:** UC-007
**Use Case Name:** Mitglieder, Rollen und Teams verwalten
**Primary Actor:** Vorstand
**Goal:** Die Vereinsstruktur abbilden, indem Mitglieder Rollen und Teams zugeordnet werden
**Status:** Implemented

## Preconditions

- Der Verein existiert und hat mindestens ein Mitglied.
- Die Person hat im Verein die Rolle admin.

## Main Success Scenario

1. Vorstand öffnet die Mitgliederverwaltung.
2. System zeigt alle Mitglieder mit Anzeigename, Rolle, Teams und Status, sortiert nach Name.
3. Vorstand wählt ein Mitglied aus.
4. System zeigt die Mitgliedsdetails mit Rolle, Teams, Status und Eintrittsdatum.
5. Vorstand ändert die Rolle des Mitglieds.
6. Vorstand ordnet das Mitglied einem oder mehreren Teams zu oder entfernt eine Zuordnung.
7. Vorstand speichert.
8. System übernimmt die Änderungen und zeigt sie in der Liste an.

## Alternative Flows

### A1: Team anlegen

**Trigger:** Das gewünschte Team existiert noch nicht (Schritt 6)
**Flow:**

1. Vorstand wählt «Team anlegen» und gibt einen Namen ein.
2. System legt das Team im Verein an.
3. Use case continues at step 6.

### A2: Letzten Vorstand herabstufen

**Trigger:** Die Änderung würde den einzigen Vorstand des Vereins zum Mitglied machen (Schritt 7)
**Flow:**

1. System weist die Änderung ab und erklärt, dass ein Verein mindestens einen Vorstand braucht.
2. Use case continues at step 5.

### A3: Mitglied als ausgetreten markieren

**Trigger:** Vorstand setzt den Status auf «ausgetreten» (Schritt 7)
**Flow:**

1. System entfernt das Mitglied aus allen aktiven Auswertungen und Ranglisten.
2. System behält Punktehistorie und Team-Zuordnungen für Rückblicke bestehen.
3. Use case continues at step 8.

### A4: Mitgliederliste durchsuchen

**Trigger:** Der Verein hat viele Mitglieder (Schritt 2)
**Flow:**

1. Vorstand gibt einen Suchbegriff ein oder filtert nach Team, Rolle oder Status.
2. System zeigt die gefilterte Liste.
3. Use case continues at step 3.

## Postconditions

### Success Postconditions

- Rolle, Teams und Status des Mitglieds entsprechen den Eingaben.
- Die Änderungen wirken sich unmittelbar auf Sichtbarkeiten und Berechtigungen aus.

### Failure Postconditions

- Rolle, Teams und Status bleiben unverändert.
- Das System zeigt den Grund der Ablehnung.

## Business Rules

### BR-024: Vier Rollen

Der Verein kennt die Rollen member, trainer, admin und superadmin. Trainer:innen erhalten ihre Team-Reichweite über die Team-Zuordnung, nicht über die Rolle allein.

### BR-025: Mehrfachzuordnung

Ein Mitglied kann mehreren Teams gleichzeitig angehören.

### BR-026: Mindestens ein Vorstand

Ein Verein hat zu jedem Zeitpunkt mindestens ein Mitglied mit der Rolle admin.

### BR-027: Rollenprüfung serverseitig

Die Berechtigung zur Änderung wird in der Datenbank geprüft, nicht durch das Ausblenden von Schaltflächen.

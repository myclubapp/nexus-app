# Use Case: Vereinsidentität, Begriffe und Module konfigurieren

## Overview

**Use Case ID:** UC-034
**Use Case Name:** Vereinsidentität, Begriffe und Module konfigurieren
**Primary Actor:** Vorstand
**Goal:** Die App die Sprache und das Erscheinungsbild des eigenen Vereins sprechen lassen
**Status:** Draft

## Preconditions

- Der Verein existiert.
- Die Person hat im Verein die Rolle admin.

## Main Success Scenario

1. Vorstand öffnet die Vereinseinstellungen.
2. System zeigt vier Bereiche: Erscheinungsbild, Begriffe, Module und Vereins-DNA.
3. Vorstand hinterlegt im Erscheinungsbild die Vereinsfarben und lädt das Logo hoch.
4. System wendet Farben und Logo unmittelbar auf die gesamte App an, ohne dass ein neuer App-Build nötig ist.
5. Vorstand passt unter Begriffe die Bezeichnungen der Termintypen an, etwa «Training» zu «Probe».
6. System verwendet die neuen Begriffe ab sofort in allen vier Sprachen an jeder Stelle der App.
7. Vorstand speichert.

## Alternative Flows

### A1: Modul aktivieren

**Trigger:** Vorstand öffnet den Bereich Module (Schritt 2)
**Flow:**

1. System zeigt die verfügbaren Module mit ihrem Zweck und dem, was sie dem Vorstand an Zeit sparen.
2. Vorstand aktiviert ein Modul.
3. System blendet die zugehörigen Funktionen ein.
4. Use case continues at step 7.

### A2: Modul wird vorgeschlagen

**Trigger:** Der Verein erreicht eine Schwelle, etwa vierzig aktive Mitglieder
**Flow:**

1. System schlägt dem Vorstand ein passendes Modul vor und begründet den Vorschlag.
2. Vorstand aktiviert oder verschiebt es.
3. Use case ends.

### A3: Vereins-DNA erfassen

**Trigger:** Vorstand öffnet den Bereich Vereins-DNA (Schritt 2)
**Flow:**

1. Vorstand hinterlegt das Warum des Vereins, seine Werte, die Anrede und Tonalität sowie Traditionen und eigene Begriffe.
2. System verwendet diese Angaben in allen textunterstützenden Funktionen.
3. Use case continues at step 7.

### A4: Saisonbeginn ändern

**Trigger:** Vorstand ändert den Saisonbeginn
**Flow:**

1. System weist darauf hin, dass sich dadurch die Saisonzuordnung künftiger Buchungen ändert.
2. Bereits gebuchte Punkte behalten ihre Saison.
3. Use case continues at step 7.

### A5: Kontrast zu gering

**Trigger:** Die gewählten Vereinsfarben ergeben zu wenig Kontrast (Schritt 4)
**Flow:**

1. System weist darauf hin und schlägt eine kontrastreichere Abstufung vor.
2. Use case continues at step 3.

## Postconditions

### Success Postconditions

- Erscheinungsbild, Begriffe, aktive Module und Vereins-DNA entsprechen den Eingaben.
- Alle Mitglieder sehen die Änderungen beim nächsten Aufruf, ohne die App zu aktualisieren.

### Failure Postconditions

- Die bisherigen Einstellungen bleiben aktiv.

## Business Rules

### BR-146: Theming zur Laufzeit

Vereinsspezifisches Erscheinungsbild entsteht aus den Vereinseinstellungen. Es gibt keine vereinsspezifischen App-Builds.

### BR-147: Begriffe sind Labels, keine Typen

Die Datenbank kennt nur technische Termintypen. Die Bezeichnung ist eine Einstellung des Vereins.

### BR-148: Vier Sprachen

Jeder Text existiert in Deutsch, Französisch, Italienisch und Englisch. Vereinsspezifische Begriffe werden je Sprache hinterlegt.

### BR-149: Konfiguration ist Kür

Alle Einstellungen haben Standardwerte. Ein Verein muss nichts konfigurieren, um die App zu nutzen.

### BR-150: Module im Tempo des Vereins

Weitere Module werden vorgeschlagen, nie automatisch aktiviert.

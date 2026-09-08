# Use Case: Einladung erstellen

## Overview

**Use Case ID:** UC-003
**Use Case Name:** Einladung erstellen
**Primary Actor:** Vorstand
**Goal:** Einen Einladungslink mit Geltungsbereich, Rolle und Ablauf erzeugen und verteilen
**Status:** Implemented

## Preconditions

- Der Verein existiert.
- Die Person hat im Verein die Rolle admin.

## Main Success Scenario

1. Vorstand wählt «Mitglieder einladen».
2. System zeigt das Einladungsformular mit Vorbelegung: Geltungsbereich Verein, Rolle member, Ablauf in 14 Tagen, unbegrenzte Einlösungen.
3. Vorstand wählt optional ein Team als Geltungsbereich.
4. Vorstand wählt die Rolle, die eingeladene Personen erhalten sollen.
5. Vorstand passt Ablaufdatum und maximale Anzahl Einlösungen an.
6. Vorstand bestätigt.
7. System erzeugt die Einladung mit einem nicht erratbaren Code und zeigt Link und QR-Code an.
8. Vorstand teilt den Link über das Teilen-Menü des Geräts oder zeigt den QR-Code vor.

## Alternative Flows

### A1: Einladung widerrufen

**Trigger:** Vorstand öffnet eine bestehende Einladung und wählt «Widerrufen»
**Flow:**

1. System setzt die Einladung auf ungültig.
2. Bereits eingelöste Mitgliedschaften bleiben bestehen.
3. Use case ends.

### A2: Rolle admin einladen

**Trigger:** Vorstand wählt in Schritt 4 die Rolle admin
**Flow:**

1. System weist darauf hin, dass eingeladene Personen volle Vereinsrechte erhalten.
2. Vorstand bestätigt ausdrücklich.
3. Use case continues at step 5.

### A3: Fehlende Berechtigung

**Trigger:** Die Person besitzt die Rolle admin nicht (Schritt 1)
**Flow:**

1. System blendet die Funktion nicht ein und weist einen direkten Aufruf ab.
2. Use case ends.

## Postconditions

### Success Postconditions

- Die Einladung existiert mit Code, Geltungsbereich, Rolle, Ablaufdatum und Einlösungsgrenze.
- Link und QR-Code sind zum Teilen verfügbar.

### Failure Postconditions

- Es existiert keine Einladung.
- Bestehende Einladungen bleiben unverändert.

## Business Rules

### BR-009: Nur Vorstand lädt ein

Einladungen erstellt ausschliesslich, wer im Verein die Rolle admin trägt. Die Prüfung erfolgt serverseitig.

### BR-010: Einladungscode ist nicht erratbar

Der Code wird zufällig erzeugt und ist lang genug, dass er nicht durch Ausprobieren gefunden werden kann.

### BR-011: Einladung überträgt nie mehr als die eigene Rolle

Ein Vorstand kann keine Rolle einladen, die über seine eigene hinausgeht.

### BR-012: Widerruf wirkt nur nach vorne

Ein Widerruf verhindert weitere Einlösungen, entzieht aber keine bereits erteilte Mitgliedschaft.

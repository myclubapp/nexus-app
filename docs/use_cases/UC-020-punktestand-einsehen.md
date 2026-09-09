# Use Case: Punktestand und «Nächste Punkte» einsehen

## Overview

**Use Case ID:** UC-020
**Use Case Name:** Punktestand und «Nächste Punkte» einsehen
**Primary Actor:** Mitglied
**Goal:** Den eigenen Beitrag einordnen und erkennen, wo man als Nächstes gebraucht wird
**Status:** Implemented

## Preconditions

- Das Mitglied ist angemeldet und gehört einem Verein an.

## Main Success Scenario

1. Mitglied öffnet das Dashboard.
2. System zeigt den Punktestand der laufenden Saison und den Gesamtstand seit Vereinseintritt.
3. System zeigt die letzten Punktebuchungen mit Datum, Anlass und Wert.
4. System zeigt unter «Nächste Punkte» konkrete Vorschläge: der nächste Termin mit seinem Punktwert, offene Schichten mit Unterdeckung und Aufgaben, die zum Beitrags-Profil passen.
5. Mitglied tippt einen Vorschlag an.
6. System öffnet den zugehörigen Termin oder die zugehörige Aufgabe.

## Alternative Flows

### A1: Noch keine Punkte

**Trigger:** Das Mitglied hat noch keine Buchung (Schritt 2)
**Flow:**

1. System zeigt statt eines leeren Stands einen Willkommenshinweis und den nächsten erreichbaren Beitrag.
2. Use case continues at step 4.

### A2: Vollständige Historie

**Trigger:** Mitglied wählt «Alle Buchungen anzeigen» (Schritt 3)
**Flow:**

1. System zeigt die vollständige Punktehistorie mit Filter nach Saison und Säule.
2. Use case ends.

### A3: Punktestand aktualisiert sich live

**Trigger:** Während das Dashboard offen ist, wird eine Buchung erzeugt
**Flow:**

1. System aktualisiert den angezeigten Stand ohne Zutun des Mitglieds.
2. Use case continues at step 3.

### A4: Keine passenden Vorschläge

**Trigger:** Es bestehen keine offenen Termine, Schichten oder Aufgaben (Schritt 4)
**Flow:**

1. System zeigt an, dass gerade nichts ansteht, statt einen leeren Bereich.
2. Use case ends.

## Postconditions

### Success Postconditions

- Das Mitglied kennt seinen Saison- und Gesamtstand.
- Das Mitglied sieht mindestens einen konkreten nächsten Beitrag, sofern einer existiert.

### Failure Postconditions

- Das Dashboard zeigt einen Ladefehler mit Wiederholungsmöglichkeit.
- Der zuletzt bekannte Stand bleibt aus dem Lesecache sichtbar.

## Business Rules

### BR-081: Saison und Gesamt getrennt

Der Punktestand wird immer für die laufende Saison und kumuliert seit Eintritt geführt.

### BR-082: Saisonlogik ist einheitlich

Die Saisonzuordnung einer Buchung folgt derselben Berechnung in Datenbank und App. Eine Abweichung ist ein Fehler.

### BR-083: Vorschläge sind persönlich

«Nächste Punkte» berücksichtigt Team-Zugehörigkeit, Beitrags-Profil und bereits übernommene Beiträge.

### BR-084: Keine Vergleichszahl im Dashboard

Das Dashboard zeigt den eigenen Beitrag. Ein Rangvergleich gehört in die Rangliste und ist abwählbar.

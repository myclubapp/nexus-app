# Use Case: Vereins-Puls freigeben

## Overview

**Use Case ID:** UC-027
**Use Case Name:** Vereins-Puls freigeben
**Primary Actor:** Vorstand
**Goal:** Den Mitgliedern regelmässig mitteilen, was passiert, woran gearbeitet wird und wo sie dabei sein können
**Status:** Implemented

## Preconditions

- Der Verein existiert und hat aktive Mitglieder.
- Der Vereins-Puls ist im Verein aktiviert.

## Main Success Scenario

1. System komponiert wöchentlich einen Puls-Entwurf aus drei Quellen: den Terminen der kommenden vierzehn Tage, den dokumentierten Vorstandsantworten der letzten zwei Wochen und den offenen Aufgaben und Schichten.
2. System benachrichtigt den Vorstand über den bereitliegenden Entwurf.
3. Vorstand öffnet den Entwurf.
4. System zeigt ihn in drei Abschnitten: «Was passiert», «Woran wir arbeiten», «Wo du dabei sein kannst».
5. Vorstand streicht oder ergänzt einzelne Punkte und kann einen persönlichen Einleitungssatz schreiben.
6. Vorstand gibt frei.
7. System stellt den Puls allen Mitgliedern in die Inbox und, wo erlaubt, als Push zu.
8. System zählt den Versand als Verbindungs-Nachricht und vermerkt den Zeitpunkt des letzten Pulses.

## Alternative Flows

### A1: Automatischer Versand

**Trigger:** Der Verein hat den automatischen Versand aktiviert und der Entwurf ist nach 48 Stunden nicht freigegeben
**Flow:**

1. System versendet den Entwurf unverändert.
2. Use case continues at step 8.

### A2: Puls verwerfen

**Trigger:** Vorstand wählt «Diese Woche nicht» (Schritt 6)
**Flow:**

1. System verwirft den Entwurf ohne Versand.
2. Der Zeitpunkt des letzten Pulses bleibt unverändert und fliesst in die Symmetrie-Prüfung ein.
3. Use case ends.

### A3: Nichts zu berichten

**Trigger:** Alle drei Abschnitte wären leer (Schritt 1)
**Flow:**

1. System erzeugt keinen Entwurf und weist den Vorstand darauf hin, dass diese Woche nichts vorliegt.
2. Use case ends.

### A4: Persönliche Punkte im Puls

**Trigger:** Das Mitglied öffnet den zugestellten Puls (Schritt 7)
**Flow:**

1. System zeigt die drei Abschnitte zuoberst und den persönlichen Punktestand nachgeordnet.
2. Use case ends.

## Postconditions

### Success Postconditions

- Alle Mitglieder haben den Puls in ihrer Inbox.
- Der Zeitpunkt des letzten Pulses ist aktualisiert.
- Der Versand ist als Verbindung gezählt.

### Failure Postconditions

- Der Puls ist nicht versendet.
- Der Zeitpunkt des letzten Pulses bleibt unverändert.

## Business Rules

### BR-113: Drei Fragen, feste Reihenfolge

Der Puls beantwortet immer dieselben drei Fragen in derselben Reihenfolge: was passiert, woran wir arbeiten, wo du dabei sein kannst.

### BR-114: Punkte stehen nachgeordnet

Der persönliche Punktestand erscheint im Puls nach den drei Abschnitten, nie als Aufmacher.

### BR-115: Freigabe in zwei Minuten

Der Entwurf ist vollständig vorkomponiert. Die Freigabe verlangt keine Texterstellung.

### BR-116: Verbindung vor Aufruf

Der Puls ist die Verbindungs-Routine des Vereins. Ohne ihn kippt die Verbindungs-Quote und der Vorstand erhält einen Symmetrie-Hinweis.

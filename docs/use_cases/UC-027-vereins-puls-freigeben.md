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

### A5: Entwurf von Hand anstossen

**Trigger:** Der Vorstand öffnet den Puls, und es liegt kein Entwurf vor (Schritt 3)
**Flow:**

1. System erklärt, dass kein Entwurf vorliegt, und bietet an, einen zusammenzustellen.
2. Vorstand stösst die Zusammenstellung an.
3. System komponiert den Entwurf aus denselben drei Quellen wie in Schritt 1 und benachrichtigt die übrigen Vorstandsmitglieder; wer angestossen hat, bekommt keine Meldung über die eigene Handlung.
4. Use case continues at step 4.
5. Wäre der Entwurf leer, bleibt es bei der Erklärung (A3).

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

Der Entwurf ist vollständig vorkomponiert. Die Freigabe verlangt keine Texterstellung. Das gilt auch für den Anstoss von Hand (A5): Er löst dieselbe Zusammenstellung aus, die sonst der wöchentliche Lauf auslöst – geschrieben wird der Puls nie.

### BR-116: Verbindung vor Aufruf

Der Puls ist die Verbindungs-Routine des Vereins. Ohne ihn kippt die Verbindungs-Quote und der Vorstand erhält einen Symmetrie-Hinweis.

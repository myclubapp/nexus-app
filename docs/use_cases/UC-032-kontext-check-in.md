# Use Case: Kontext-Check-in beantworten

## Overview

**Use Case ID:** UC-032
**Use Case Name:** Kontext-Check-in beantworten
**Primary Actor:** Mitglied
**Goal:** Nach einer Teilnahme in wenigen Sekunden mitteilen, wie es einem damit ging
**Status:** Implemented

## Preconditions

- Das Mitglied hat an einem Termin teilgenommen.
- Kontext-Check-ins sind im Verein aktiviert.
- Für das Mitglied wurde heute noch keine Check-in-Serie ausgelöst.

## Main Success Scenario

1. System erkennt nach dem Terminende die Teilnahme und die Rolle des Mitglieds dabei.
2. System stellt eine Benachrichtigung mit der zum Kontext passenden Frage zu.
3. Mitglied öffnet das Check-in.
4. System zeigt eine oder zwei kurze Fragen mit einer Skala und macht sichtbar, wer die Antwort sehen wird.
5. Mitglied antwortet.
6. System speichert die Antwort mit der angezeigten Sichtbarkeit.
7. System bedankt sich und weist ausdrücklich darauf hin, dass es dafür keine Punkte gibt.

## Alternative Flows

### A1: Überspringen

**Trigger:** Mitglied schliesst das Check-in ohne Antwort (Schritt 5)
**Flow:**

1. System speichert nichts und fragt zu diesem Termin nicht erneut.
2. Use case ends.

### A2: Nicht teilgenommen

**Trigger:** Das Mitglied war nicht anwesend (Schritt 1)
**Flow:**

1. System stellt keine Frage. Es existiert kein Kontext für Abwesenheit.
2. Use case ends.

### A3: Auf der Bank

**Trigger:** Das Mitglied war als Ersatz dabei (Schritt 1)
**Flow:**

1. System stellt die eigens dafür vorgesehene Frage nach dem Erleben des Tages.
2. Use case continues at step 4.

### A4: Nach einem Helfereinsatz

**Trigger:** Der Termin war ein Helfer-Event (Schritt 1)
**Flow:**

1. System fragt, was gut und was nicht gut lief, mit Freitext oder Sprachmemo.
2. Die Antwort geht an die organisierende Person, auf Wunsch anonym.
3. Use case continues at step 6.

### A5: Antwort teilen

**Trigger:** Mitglied möchte eine private Antwort der Trainer:in zeigen (Schritt 6)
**Flow:**

1. Mitglied wählt ausdrücklich «Mit Trainer:in teilen».
2. System gibt genau diese Antwort frei.
3. Use case ends.

### A6: Anhaltend tiefe Werte

**Trigger:** Die eigenen Werte sind über mehrere Termine hinweg tief
**Flow:**

1. System benachrichtigt ausschliesslich das Mitglied selbst und fragt, ob es das teilen mag.
2. Ohne aktives Teilen erfährt niemand davon.
3. Use case ends.

## Postconditions

### Success Postconditions

- Die Antwort ist mit der gewählten Sichtbarkeit gespeichert.
- Der eigene Verlauf ist um einen Punkt ergänzt.
- Es ist keine Punktebuchung entstanden.

### Failure Postconditions

- Es ist keine Antwort gespeichert.
- Der Termin gilt als beantwortet und löst kein erneutes Check-in aus.

## Business Rules

### BR-136: Die App fragt nie, was sie schon weiss

Gefragt wird nur das Subjektive: Befinden, Zufriedenheit, Erleben. Teilnahme, Aufgebot und Resultat sind bereits bekannt.

### BR-137: Kein Check-in bei Abwesenheit

Es existiert kein Kontext für Nichtteilnahme. Nach dem Grund einer Abwesenheit wird nie gefragt.

### BR-138: Check-ins geben keine Punkte

Belohntes Befinden wäre verzerrtes Befinden. Die Teilnahme selbst hat die Punkte bereits gegeben.

### BR-139: Befinden ist privat, Teilen ist ein Entscheid

Antworten zu Befinden und Zufriedenheit sind standardmässig privat. Weitergabe erfolgt nur durch aktives Teilen des Mitglieds.

### BR-140: Mindestgruppengrösse

Team-Stimmungswerte werden erst ab fünf Antworten im Zeitfenster angezeigt, darunter gar nicht.

### BR-141: Höchstens ein Check-in pro Tag

Je Mitglied wird höchstens eine Check-in-Serie pro Tag ausgelöst.

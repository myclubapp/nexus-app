# Use Case: Leaderboard einsehen

## Overview

**Use Case ID:** UC-022
**Use Case Name:** Leaderboard einsehen
**Primary Actor:** Mitglied
**Goal:** Sehen, wie sich das Engagement im Team und im Verein verteilt
**Status:** Draft

## Preconditions

- Das Mitglied ist angemeldet und gehört einem Verein an.

## Main Success Scenario

1. Mitglied öffnet die Ranglisten.
2. System zeigt die Vereinsrangliste der laufenden Saison mit Rang, Anzeigename und Punktzahl.
3. System hebt die eigene Position hervor, auch wenn sie ausserhalb des angezeigten Ausschnitts liegt.
4. Mitglied wechselt auf die Rangliste seines Teams.
5. System zeigt die Team-Rangliste mit denselben Angaben.
6. Mitglied wechselt den Zeitraum auf Monat.
7. System berechnet die Rangliste für den gewählten Zeitraum neu und zeigt sie an.

## Alternative Flows

### A1: Filter nach Säule

**Trigger:** Vorstand wählt die Ansicht nach Säule, etwa Helferpunkte (Schritt 2)
**Flow:**

1. System zeigt die Rangliste nur mit den Punkten der gewählten Säule.
2. Damit steht dem Vorstand die frühere Helfer-Auswertung ohne eigenes Modul zur Verfügung.
3. Use case ends.

### A2: Mitglied ohne Ranglisten-Teilnahme

**Trigger:** Ein Mitglied hat die Anzeige in Ranglisten abgewählt (Schritt 2)
**Flow:**

1. System zeigt dieses Mitglied in keiner Rangliste an.
2. Das Mitglied sieht seinen eigenen Stand weiterhin im Dashboard.
3. Use case continues at step 3.

### A3: Nur die vorderen Ränge

**Trigger:** Der Verein hat die Anzeige auf die vorderen Ränge begrenzt (Schritt 2)
**Flow:**

1. System zeigt nur die vorderen Ränge sowie die eigene Position.
2. Use case continues at step 4.

### A4: Kein Team

**Trigger:** Das Mitglied gehört keinem Team an (Schritt 4)
**Flow:**

1. System blendet die Team-Ansicht aus.
2. Use case continues at step 6.

## Postconditions

### Success Postconditions

- Das Mitglied sieht die gewählte Rangliste im gewählten Zeitraum.
- Die eigene Position ist erkennbar.

### Failure Postconditions

- Die Rangliste bleibt leer und zeigt einen Ladehinweis.
- Der zuletzt bekannte Stand bleibt aus dem Lesecache sichtbar.

## Business Rules

### BR-089: Untere Ränge werden nie hervorgehoben

Die Darstellung kennt keine Kennzeichnung der letzten Plätze und keine Aufforderung an schlecht platzierte Mitglieder.

### BR-090: Die eigene Position ist immer sichtbar

Auch bei begrenzter Anzeige sieht ein Mitglied seinen eigenen Rang.

### BR-091: Teilnahme ist abwählbar

Wer die Anzeige in Ranglisten abwählt, erscheint in keiner Rangliste, sammelt aber weiter Punkte.

### BR-092: Ranglisten sind höchstens fünf Minuten alt

Die Rangliste wird aus einer periodisch aktualisierten Auswertung gelesen.

### BR-093: Keine Sortierung nach Wert von Menschen

Es existiert keine Ansicht, die Mitglieder nach ihrem Mitgliederwert oder ihrem Gesundheitsstatus sortiert.

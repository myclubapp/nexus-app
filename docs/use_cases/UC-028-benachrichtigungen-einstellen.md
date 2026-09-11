# Use Case: Benachrichtigungen einstellen

## Overview

**Use Case ID:** UC-028
**Use Case Name:** Benachrichtigungen einstellen
**Primary Actor:** Mitglied
**Goal:** Selbst bestimmen, was einen auf welchem Kanal erreicht
**Status:** Implemented

## Preconditions

- Das Mitglied ist angemeldet.

## Main Success Scenario

1. Mitglied öffnet die Benachrichtigungseinstellungen.
2. System zeigt eine Matrix aus Kategorien – Termine, Punkte, Aufgaben und Aufrufe, News und Puls, Anliegen, Hinweise – und Kanälen: Inbox und Push.
3. System zeigt, dass die Inbox nicht abschaltbar ist, und begründet es.
4. Mitglied deaktiviert Push für einzelne Kategorien.
5. Mitglied speichert.
6. System übernimmt die Einstellungen und wendet sie ab der nächsten Zustellung an.

## Alternative Flows

### A1: Push erstmals erlauben

**Trigger:** Push ist auf dem Gerät noch nicht erlaubt (Schritt 4)
**Flow:**

1. System erklärt, wofür Push genutzt wird, und fordert die Systemberechtigung an.
2. Bei Zustimmung registriert das System das Gerät für den zur Plattform passenden Push-Kanal.
3. Use case continues at step 5.

### A2: Push abgelehnt

**Trigger:** Die Systemberechtigung wird verweigert (A1, Schritt 2)
**Flow:**

1. System deaktiviert alle Push-Kanäle und weist darauf hin, dass die Inbox weiterhin alles enthält.
2. Use case continues at step 5.

### A3: Stille Zeiten

**Trigger:** Mitglied aktiviert stille Zeiten (Schritt 4)
**Flow:**

1. Mitglied legt ein tägliches Zeitfenster fest.
2. System stellt in diesem Fenster kein Push zu und holt es danach nach.
3. Use case continues at step 5.

### A4: Gerät abmelden

**Trigger:** Mitglied wählt bei einem registrierten Gerät «Abmelden»
**Flow:**

1. System entfernt die Push-Registrierung dieses Geräts.
2. Use case ends.

## Postconditions

### Success Postconditions

- Die Zustellregeln entsprechen den Eingaben.
- Die Inbox enthält weiterhin sämtliche Benachrichtigungen.

### Failure Postconditions

- Die bisherigen Einstellungen bleiben aktiv.

## Business Rules

### BR-117: Die Inbox ist nicht abschaltbar

Jede Benachrichtigung landet in der Inbox. Nur die Zustellung als Push ist abwählbar.

### BR-118: Einstellungen gelten pro Kategorie und Kanal

Ein Mitglied entscheidet je Kategorie getrennt, ob es dafür Push erhält.

### BR-119: Push ohne fremde Infrastruktur

Push läuft je nach Plattform über den selbst betriebenen Dienst, über Apples Dienst oder über den Webstandard. Ein Dienst von Google wird nicht verwendet.

### BR-120: Sicherheitsrelevante Zustellungen

Anmeldelinks und Hinweise zur Kontolöschung laufen über E-Mail und sind von den Kategorieeinstellungen unberührt.

# Use Case: QR-Check-in am Termin

## Overview

**Use Case ID:** UC-014
**Use Case Name:** QR-Check-in am Termin
**Primary Actor:** Mitglied
**Goal:** Die eigene Anwesenheit am Termin erfassen und die zugehörigen Punkte erhalten
**Status:** Draft

## Preconditions

- Der Termin existiert und ist nicht abgesagt.
- Das Mitglied gehört dem Verein des Termins an.
- Die verantwortliche Person zeigt den QR-Code des Termins an.

## Main Success Scenario

1. Trainer:in öffnet den Termin und wählt «QR-Code anzeigen».
2. System zeigt den QR-Code des Termins gross auf dem Bildschirm.
3. Mitglied öffnet in seiner App den Scanner.
4. Mitglied scannt den QR-Code.
5. System prüft das Token, das Zeitfenster und die Vereinszugehörigkeit.
6. System vermerkt die Anwesenheit und bucht die am Termin hinterlegte Punkteregel in den Ledger.
7. System zeigt dem Mitglied die Bestätigung mit der Anzahl gutgeschriebener Punkte.
8. System aktualisiert den Punktestand auf dem Dashboard des Mitglieds unmittelbar.

## Alternative Flows

### A1: Check-in-Fenster geschlossen

**Trigger:** Der Scan erfolgt früher als 30 Minuten vor Beginn oder nach dem Ende des Termins (Schritt 5)
**Flow:**

1. System weist den Check-in ab und nennt das gültige Zeitfenster.
2. Use case ends.

### A2: Ungültiger Code

**Trigger:** Das gescannte Token gehört zu keinem Termin (Schritt 5)
**Flow:**

1. System zeigt an, dass der Code nicht gültig ist.
2. Use case continues at step 4.

### A3: Kein Mitglied dieses Vereins

**Trigger:** Die scannende Person gehört dem Verein des Termins nicht an (Schritt 5)
**Flow:**

1. System weist den Check-in ab.
2. Use case ends.

### A4: Bereits eingecheckt

**Trigger:** Für das Mitglied besteht bereits eine Anwesenheit an diesem Termin (Schritt 6)
**Flow:**

1. System bestätigt die bestehende Anwesenheit, bucht aber keine weiteren Punkte.
2. Use case continues at step 7.

### A5: Ohne Netzverbindung

**Trigger:** Das Gerät ist beim Scan offline (Schritt 5)
**Flow:**

1. System puffert den Check-in lokal und zeigt an, dass er nachgesendet wird.
2. Beim nächsten Verbindungsaufbau sendet das System den Check-in und lässt ihn serverseitig vollständig prüfen.
3. Use case continues at step 6.

### A6: Erfassung durch die Trainer:in

**Trigger:** Ein Mitglied kann nicht scannen, etwa ohne Smartphone (Schritt 4)
**Flow:**

1. Trainer:in öffnet die Teilnehmerliste des Termins und markiert das Mitglied als anwesend.
2. System bucht die Punkte wie bei einem Check-in.
3. Use case ends.

## Postconditions

### Success Postconditions

- Die Anwesenheit des Mitglieds am Termin ist erfasst.
- Genau eine Punktebuchung mit Bezug zu diesem Termin existiert.
- Der Punktestand des Mitglieds ist aktualisiert.

### Failure Postconditions

- Es ist keine Anwesenheit erfasst.
- Es entsteht keine Punktebuchung.
- Das Mitglied erhält eine verständliche Begründung.

## Business Rules

### BR-054: Zeitfenster des Check-ins

Ein Check-in ist von 30 Minuten vor Terminbeginn bis zum Terminende möglich. Fehlt eine Endzeit, gilt eine Standarddauer von drei Stunden.

### BR-055: Token je Termin

Jeder Termin trägt ein eigenes, zufällig erzeugtes Check-in-Token.

### BR-056: Serverseitige Prüfung

Token, Zeitfenster und Vereinszugehörigkeit werden in der Datenbankfunktion geprüft, nie im Client.

### BR-057: Eine Anwesenheit pro Termin

Ein Mitglied ist je Termin höchstens einmal anwesend; ein zweiter Scan erzeugt keine weiteren Punkte.

### BR-058: QR-Scan ohne fremde SDKs

Der Scan läuft im WebView über eine quelloffene Bibliothek, ohne native Google-Komponente.

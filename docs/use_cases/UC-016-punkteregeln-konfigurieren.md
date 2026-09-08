# Use Case: Punkteregeln konfigurieren

## Overview

**Use Case ID:** UC-016
**Use Case Name:** Punkteregeln konfigurieren
**Primary Actor:** Vorstand
**Goal:** Das Punktesystem an die Kultur des eigenen Vereins anpassen
**Status:** Implemented

## Preconditions

- Der Verein existiert und trägt den bei der Gründung erzeugten Satz Standardregeln.
- Die Person hat im Verein die Rolle admin.

## Main Success Scenario

1. Vorstand öffnet die Punkteregeln in den Vereinseinstellungen.
2. System zeigt alle Regeln gruppiert nach den sieben Säulen, je mit Bezeichnung, Punktwert und Aktivierungsstatus.
3. Vorstand öffnet eine Regel.
4. Vorstand ändert den Punktwert.
5. Vorstand speichert.
6. System übernimmt den neuen Wert und weist darauf hin, dass er ab sofort für neue Buchungen gilt.

## Alternative Flows

### A1: Regel deaktivieren

**Trigger:** Vorstand schaltet eine Regel aus (Schritt 4)
**Flow:**

1. System deaktiviert die Regel; künftige Ereignisse dieser Art erzeugen keine Punkte mehr.
2. Bereits gebuchte Punkte bleiben unverändert bestehen.
3. Use case continues at step 6.

### A2: Ganze Säule deaktivieren

**Trigger:** Der Verein kennt eine Säule nicht, etwa Wettkampf (Schritt 2)
**Flow:**

1. Vorstand deaktiviert alle Regeln der Säule mit einer Aktion.
2. System blendet die Säule aus Dashboard, Ranglisten und Wertdimensionen aus.
3. Use case continues at step 6.

### A3: Eigene Regel anlegen

**Trigger:** Vorstand wählt «Eigene Regel» (Schritt 2)
**Flow:**

1. Vorstand gibt Bezeichnung, Säule, Punktwert und einen technischen Code ein.
2. System prüft, ob der Code im Verein eindeutig ist, und legt die Regel an.
3. Use case continues at step 6.

### A4: Nur-Dank-Modus

**Trigger:** Vorstand aktiviert für eine Kategorie «nur Dank» (Schritt 4)
**Flow:**

1. System setzt den Punktwert auf null und zeigt Beiträge dieser Kategorie künftig als Dank ohne Zahl an.
2. Use case continues at step 6.

### A5: Häufigkeitsgrenze setzen

**Trigger:** Vorstand will eine Regel begrenzen, etwa dreimal pro Woche (Schritt 4)
**Flow:**

1. Vorstand hinterlegt die Höchstzahl je Zeitraum.
2. System prüft die Grenze künftig bei jeder Buchung serverseitig.
3. Use case continues at step 6.

## Postconditions

### Success Postconditions

- Die Regeln des Vereins entsprechen den Eingaben.
- Neue Buchungen verwenden die geänderten Werte.
- Bestehende Buchungen bleiben unverändert.

### Failure Postconditions

- Die Regeln bleiben unverändert.
- Das System zeigt den Grund der Ablehnung.

## Business Rules

### BR-063: Änderungen wirken nur nach vorne

Eine Änderung des Punktwerts verändert keine bereits erfolgte Buchung. Der Ledger bleibt unverändert.

### BR-064: Regelcode ist im Verein eindeutig

Ein technischer Regelcode existiert je Verein höchstens einmal.

### BR-065: Häufigkeitsgrenzen gelten serverseitig

Grenzen werden in der Buchungsfunktion geprüft; das Frontend kann sie nicht umgehen.

### BR-066: Kein Punkteabzug als Regel

Regeln tragen keine negativen Werte. Negative Buchungen entstehen ausschliesslich als Korrektur.

### BR-067: Standardregeln bleiben verfügbar

Deaktivierte Standardregeln werden nicht gelöscht und lassen sich jederzeit wieder aktivieren.

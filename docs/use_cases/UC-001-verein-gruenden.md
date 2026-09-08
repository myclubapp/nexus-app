# Use Case: Verein gründen

## Overview

**Use Case ID:** UC-001
**Use Case Name:** Verein gründen
**Primary Actor:** Vorstand
**Goal:** Einen Vereins-Workspace anlegen, der sofort ohne weitere Konfiguration nutzbar ist
**Status:** Draft

## Preconditions

- Die Person ist angemeldet (UC-005).
- Die Person gehört noch keinem Verein an oder möchte einen weiteren gründen.

## Main Success Scenario

1. Vorstand wählt «Verein gründen».
2. System fragt nach dem Vereinsnamen.
3. Vorstand gibt den Namen ein.
4. System fragt neutral: «Was für ein Verein seid ihr?» und bietet Sport, Musik, Kultur, Jugend, Quartier und Anderes an.
5. Vorstand wählt eine Vereinsart; bei «Anderes» gibt er eine eigene Bezeichnung ein.
6. System fragt nach dem Saisonbeginn und schlägt einen zur Vereinsart passenden Monat vor.
7. Vorstand bestätigt oder ändert den Saisonbeginn.
8. System legt den Verein an, erzeugt einen eindeutigen Kurznamen aus dem Vereinsnamen, macht die gründende Person zum Vorstand und legt den zur Vereinsart passenden Satz Standard-Punkteregeln sowie die Standard-Terminlabels an.
9. System legt zur Vereinsart passende, als Beispiel gekennzeichnete Inhalte an, damit kein Bildschirm leer bleibt (UC-037).
10. System zeigt den Startbildschirm mit genau drei Handlungsangeboten: ersten Termin erfassen, Mitglieder einladen, Punkteregeln ansehen.

## Alternative Flows

### A1: Kurzname bereits vergeben

**Trigger:** Der aus dem Namen erzeugte Kurzname existiert bereits (Schritt 8)
**Flow:**

1. System hängt eine Unterscheidung an den Kurznamen an.
2. Use case continues at step 9.

### A2: Gründung abgebrochen

**Trigger:** Vorstand verlässt den Wizard vor Schritt 8
**Flow:**

1. System verwirft alle Eingaben.
2. Use case ends.

### A3: Weiterer Verein

**Trigger:** Die Person gehört bereits einem Verein an (Schritt 1)
**Flow:**

1. System legt den neuen Verein zusätzlich an.
2. System stellt einen Vereinswechsler bereit.
3. Use case continues at step 9.

## Postconditions

### Success Postconditions

- Der Verein existiert mit Name, Kurzname, Vereinsart und Saisonbeginn.
- Die gründende Person ist Mitglied dieses Vereins mit der Rolle admin.
- Ein vollständiger, aktiver Satz Punkteregeln liegt vor.
- Die Terminlabels des Vereins sind gesetzt und änderbar.
- Agenda, Marktplatz und News-Feed zeigen gekennzeichnete Beispielinhalte; kein Tab ist leer.

### Failure Postconditions

- Es entsteht kein Verein und keine Mitgliedschaft.
- Das System zeigt eine Fehlermeldung und behält die Eingaben im Formular.

## Business Rules

### BR-001: Vereinsart steuert nur Vorlagen

Die Vereinsart bestimmt ausschliesslich Punkteregel-Vorlagen und Standardbegriffe. Sie schränkt keine Funktion ein und ist jederzeit änderbar.

### BR-002: Zero-Config-Start

Nach der Gründung ist kein Konfigurationsschritt nötig. Agenda, Einladung und Punkte funktionieren mit Standardwerten (K7), und kein Bildschirm steht leer da (UC-037).

### BR-003: Gründer wird Vorstand

Die gründende Person erhält die Rolle admin. Ein Verein hat zu jedem Zeitpunkt mindestens einen Vorstand.

### BR-004: Gründungsdauer

Der Wizard umfasst höchstens drei Eingabeschritte, damit die Gründung in unter drei Minuten abgeschlossen ist.

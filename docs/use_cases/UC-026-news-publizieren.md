# Use Case: Vereins-News publizieren

## Overview

**Use Case ID:** UC-026
**Use Case Name:** Vereins-News publizieren
**Primary Actor:** Vorstand
**Goal:** Den Verein oder ein Team über etwas informieren, das nicht in die Agenda gehört
**Status:** Implemented

## Preconditions

- Der Verein existiert.
- Die Person hat im Verein die Rolle trainer oder admin.

## Main Success Scenario

1. Vorstand wählt «News schreiben».
2. System zeigt das Formular mit Titel, Text, optionalem Bild und dem Geltungsbereich.
3. Vorstand schreibt Titel und Text.
4. Vorstand wählt, ob die News dem ganzen Verein oder einem Team gilt.
5. Vorstand publiziert.
6. System legt die News an, zeigt sie im Feed der betroffenen Mitglieder und legt sie in deren Inbox ab.
7. System stellt eine Push-Benachrichtigung zu, sofern die Empfänger:innen sie zugelassen haben.
8. System zählt die Publikation als Verbindungs-Nachricht.

## Alternative Flows

### A1: Bild hinzufügen

**Trigger:** Vorstand fügt ein Bild an (Schritt 3)
**Flow:**

1. System lädt das Bild in den Vereinsspeicher und bindet es in die News ein.
2. Use case continues at step 4.

### A2: News aus einer Vorstandsantwort

**Trigger:** Die News entsteht aus der Beantwortung eines Mitglieder-Inputs (UC-030)
**Flow:**

1. System übernimmt die dokumentierte Antwort als Text und kennzeichnet die News als «Aus dem Vorstand».
2. Use case continues at step 6.

### A3: News korrigieren

**Trigger:** Vorstand bearbeitet eine publizierte News
**Flow:**

1. System aktualisiert den Inhalt im Feed.
2. System stellt keine erneute Benachrichtigung zu.
3. Use case ends.

### A4: News zurückziehen

**Trigger:** Vorstand löscht eine publizierte News
**Flow:**

1. System entfernt sie aus dem Feed; der Eintrag in der Inbox bleibt als Verlauf bestehen.
2. Use case ends.

## Postconditions

### Success Postconditions

- Die News ist im Feed des gewählten Geltungsbereichs sichtbar.
- Alle Betroffenen haben sie in ihrer Inbox.
- Die Publikation ist als Verbindungs-Nachricht gezählt.

### Failure Postconditions

- Es entsteht keine News.
- Es wird niemand benachrichtigt.

## Business Rules

### BR-109: Geltungsbereich bestimmt die Reichweite

Eine Team-News erreicht ausschliesslich die Mitglieder dieses Teams.

### BR-110: Die Inbox erreicht alle

Jede News landet in der Inbox, unabhängig davon, ob Push erlaubt ist.

### BR-111: News zählen als Verbindung

News, Kudos, Dank und der Vereins-Puls zählen in der Verbindungs-Quote als Verbindung, Aufrufe zählen dagegen.

### BR-112: Keine Lesebestätigung pro Person

Es wird nicht erfasst, wer eine News gelesen hat.

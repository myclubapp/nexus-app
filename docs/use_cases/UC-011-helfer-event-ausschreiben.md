# Use Case: Helfer-Event mit Schichten ausschreiben

## Overview

**Use Case ID:** UC-011
**Use Case Name:** Helfer-Event mit Schichten ausschreiben
**Primary Actor:** Vorstand
**Goal:** Einen Anlass mit mehreren Schichten so ausschreiben, dass sich Mitglieder gezielt eintragen können
**Status:** Implemented

## Preconditions

- Der Verein existiert.
- Die Person hat im Verein die Rolle admin.

## Main Success Scenario

1. Vorstand wählt «Helfer-Event erstellen».
2. System zeigt das Formular mit Titel, Datum, Ort und dem Pflichtfeld «Wozu dient das? Wem hilft es?».
3. Vorstand füllt die Angaben aus, einschliesslich des Warum.
4. Vorstand legt die erste Schicht an: Bezeichnung, Beginn, Ende und benötigte Anzahl Helfer:innen.
5. System schlägt für die Schicht eine Punkteregel passend zur Dauer vor.
6. Vorstand bestätigt oder ändert den Punktwert der Schicht.
7. Vorstand legt weitere Schichten an und wiederholt die Schritte 4 bis 6.
8. Vorstand publiziert das Helfer-Event.
9. System legt das Event mit allen Schichten an und zeigt es in Agenda und Marktplatz an.
10. System benachrichtigt die Mitglieder über den Aufruf.

## Alternative Flows

### A1: Warum fehlt

**Trigger:** Das Warum-Feld ist leer (Schritt 8)
**Flow:**

1. System verweigert die Publikation und erklärt, dass jeder Aufruf seinen Sinnzusammenhang trägt.
2. Use case continues at step 3.

### A2: Als Entwurf sichern

**Trigger:** Vorstand wählt «Entwurf sichern» (Schritt 8)
**Flow:**

1. System speichert das Event als Entwurf, ohne es sichtbar zu machen und ohne zu benachrichtigen.
2. Use case ends.

### A3: Aufruf ohne vorangegangene Verbindung

**Trigger:** Seit mehr als vier Wochen ging keine Verbindungs-Nachricht an den Verein (Schritt 10)
**Flow:**

1. System weist den Vorstand darauf hin und schlägt vor, zuerst einen Vereins-Puls zu versenden.
2. Ist die sanfte Sperre im Verein aktiviert, unterbleibt der Aufruf-Push, bis ein Puls versendet wurde; das Event bleibt in Agenda und Marktplatz sichtbar.
3. Use case ends.

### A4: Bestehendes Event in ein Helfer-Event umwandeln

**Trigger:** Vorstand wählt bei einem bestehenden Termin «Schichten hinzufügen»
**Flow:**

1. System ergänzt den Termin um die Schichten-Struktur und verlangt das Warum.
2. Use case continues at step 4.

## Postconditions

### Success Postconditions

- Das Helfer-Event existiert mit mindestens einer Schicht, ausgefülltem Warum und Punktwerten je Schicht.
- Das Event erscheint in Agenda und Marktplatz.
- Die Mitglieder sind über den Aufruf informiert, sofern keine sanfte Sperre greift.

### Failure Postconditions

- Es entsteht kein sichtbares Event.
- Es wird niemand benachrichtigt.

## Business Rules

### BR-041: Jede Schicht trägt ihren Personalbedarf

Eine Schicht nennt die benötigte Anzahl Helfer:innen. Die App zeigt jederzeit die Unterdeckung.

### BR-042: Punktwert je Schicht

Der Punktwert wird pro Schicht festgelegt, weil ein halber Tag und ein ganzer Tag unterschiedlich zählen.

### BR-043: Warum ist Publikationsvoraussetzung

Ein Aufruf ohne Sinnzusammenhang kann nicht publiziert werden.

### BR-044: Verbindung vor Aufruf

Der Verein kann konfigurieren, dass Aufruf-Benachrichtigungen erst nach einem kürzlich versendeten Vereins-Puls zugestellt werden.

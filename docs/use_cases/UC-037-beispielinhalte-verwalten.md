# Use Case: Beispielinhalte verwalten

## Overview

**Use Case ID:** UC-037
**Use Case Name:** Beispielinhalte verwalten
**Primary Actor:** Vorstand
**Goal:** Einen neu gegründeten Verein von Beginn weg mit Inhalten erleben und die Beispiele wieder loswerden, sobald echte Daten da sind
**Status:** Implemented

## Preconditions

- Der Verein wurde soeben gegründet (UC-001).
- Die Person hat im Verein die Rolle admin.

## Main Success Scenario

1. System legt bei der Gründung zur Vereinsart passende Beispielinhalte an: zwei Termine in der Agenda, ein Helfer-Event mit zwei Schichten, drei Aufgaben im Marktplatz und drei Einführungs-Beiträge im News-Feed.
2. System kennzeichnet jeden dieser Inhalte sichtbar als Beispiel und erklärt in einem Satz, wozu er dient.
3. Vorstand öffnet nacheinander die fünf Tabs.
4. System zeigt auf jedem Tab Inhalte statt einer leeren Fläche: gefüllte Agenda, gefüllter Marktplatz, gefüllter Feed, ein erklärter Punktestand auf dem Wirkungs-Tab und eine Rangliste mit Hinweis auf ihren Zweck.
5. Vorstand erfasst seinen ersten eigenen Termin.
6. System entfernt daraufhin die Beispieltermine, weil der Verein nun eigene Inhalte dieser Art hat.
7. Vorstand wählt in den Vereinseinstellungen «Beispielinhalte entfernen».
8. System löscht alle verbliebenen Beispielinhalte in einem Schritt und bestätigt, dass keine Vereinsdaten betroffen waren.

## Alternative Flows

### A1: Beispielinhalte laufen ab

**Trigger:** Die im Verein geltende Frist seit der Gründung ist verstrichen (Schritt 7)
**Flow:**

1. System entfernt alle verbliebenen Beispielinhalte selbsttätig.
2. System informiert den Vorstand einmalig darüber.
3. Use case ends.

### A2: Mitglied trifft auf ein Beispiel

**Trigger:** Ein Mitglied öffnet eine Beispielaufgabe oder einen Beispieltermin (Schritt 4)
**Flow:**

1. System zeigt die Kennzeichnung als Beispiel und bietet keine Übernahme, keine Zusage und keinen Check-in an.
2. Use case ends.

### A3: Beispielinhalte behalten

**Trigger:** Vorstand möchte einen Beispielinhalt als Vorlage weiterverwenden (Schritt 7)
**Flow:**

1. Vorstand wählt bei diesem Inhalt «Als eigenen Inhalt übernehmen».
2. System entfernt die Kennzeichnung, übergibt den Inhalt in die Verantwortung des Vereins und macht ihn damit für Mitglieder wirksam.
3. Use case continues at step 7.

### A4: Einführungs-Beiträge bleiben länger

**Trigger:** Alle übrigen Beispielinhalte werden entfernt (Schritt 8)
**Flow:**

1. System behält die Einführungs-Beiträge im Feed, bis der Verein seine erste eigene News publiziert.
2. Use case ends.

### A5: Demo-Verein betreten

**Trigger:** Eine Person möchte die App beurteilen, ohne einen Verein zu gründen
**Flow:**

1. System stellt einen gemeinsam genutzten Demo-Verein mit erfundenen Mitgliedern, Terminen, Aufgaben und Punkteständen bereit.
2. Änderungen in diesem Verein werden nachts zurückgesetzt und wirken sich auf keinen echten Verein aus.
3. Use case ends.

## Postconditions

### Success Postconditions

- Der neu gegründete Verein zeigt auf allen fünf Tabs Inhalte, ohne dass der Vorstand etwas erfasst hat.
- Jeder Beispielinhalt ist als solcher gekennzeichnet.
- Nach dem Entfernen oder dem Ablauf existiert kein Beispielinhalt mehr, und es sind keine Vereinsdaten verloren gegangen.
- Der Punkte-Ledger enthält keine Buchung aus einem Beispielinhalt.

### Failure Postconditions

- Der Verein startet ohne Beispielinhalte; alle Bildschirme zeigen ihren erklärenden leeren Zustand.
- Die Gründung selbst gilt trotzdem als erfolgreich.

## Business Rules

### BR-160: Beispielinhalte sind immer gekennzeichnet

Jeder Beispielinhalt trägt eine sichtbare Kennzeichnung und ist dadurch von echten Vereinsdaten unterscheidbar.

### BR-161: Beispielinhalte sind folgenlos

Ein Beispielinhalt erzeugt keine Punktebuchung, kein Gesundheitssignal, keine Benachrichtigung und keinen Eintrag in der Verbindungs-Quote.

### BR-162: Beispielinhalte machen keine Arbeit

Beispielinhalte verschwinden entweder mit dem ersten eigenen Inhalt derselben Art, nach Ablauf der Frist oder mit einer einzigen Aktion. Ein Verein muss sie nie einzeln aufräumen.

### BR-163: Entfernen berührt keine Vereinsdaten

Das Entfernen der Beispielinhalte löscht ausschliesslich gekennzeichnete Beispiele. Selbst erfasste Inhalte bleiben unangetastet, auch wenn sie aus einem Beispiel hervorgegangen sind.

### BR-164: Beispiele passen zur Vereinsart

Die Auswahl der Beispielinhalte folgt der bei der Gründung gewählten Vereinsart und verwendet deren Begriffe.

### BR-165: Kein Bildschirm ohne Inhalt oder Erklärung

Zeigt eine Ansicht keine Daten, erklärt sie ihren Zweck und bietet mindestens einen nächsten Schritt an. Eine leere Fläche ohne Text ist kein zulässiger Zustand.

### BR-166: Der Demo-Verein ist getrennt

Der Demo-Verein ist ein eigener Mandant. Aus ihm entstehen keine Daten in einem echten Verein, und er wird periodisch zurückgesetzt.

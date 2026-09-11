# Use Case: Fürsorge-Hinweis triagieren

## Overview

**Use Case ID:** UC-023
**Use Case Name:** Fürsorge-Hinweis triagieren
**Primary Actor:** Trainer:in
**Goal:** Auf ein Frühwarnsignal reagieren, ohne dass sich mehrere Verantwortliche doppelt melden
**Status:** Implemented

## Preconditions

- Das System hat aus Teilnahmedaten ein Signal erzeugt.
- Die Person ist gemäss Routing des Vereins Empfängerin dieses Signaltyps.
- Das betroffene Mitglied hat die individuellen Hinweise nicht abbestellt.

## Main Success Scenario

1. System benachrichtigt die zuständigen Personen über den neuen Hinweis.
2. Trainer:in öffnet die Liste der offenen Hinweise ihres Teams.
3. System zeigt je Hinweis das Mitglied, das Signal in fürsorglicher Sprache, den Schweregrad als Ampel, einen Handlungsvorschlag und den aktuellen Status.
4. Trainer:in öffnet einen Hinweis.
5. System zeigt zusätzlich zwei bis drei anpassbare Gesprächsimpulse und die Handlungsfrage an den Verein.
6. Trainer:in setzt den Status mit einem Tap auf «in Kontakt».
7. System macht den neuen Status allen anderen Empfänger:innen desselben Hinweises sichtbar.
8. Trainer:in führt das Gespräch ausserhalb der App und setzt den Hinweis danach auf «gelöst».
9. System entfernt den Hinweis aus allen Listen.

## Alternative Flows

### A1: Bereits in Bearbeitung

**Trigger:** Eine andere zuständige Person hat den Hinweis bereits auf «in Kontakt» gesetzt (Schritt 4)
**Flow:**

1. System zeigt, wer sich kümmert, und bietet keine erneute Übernahme an.
2. Use case ends.

### A2: Hinweis verfällt

**Trigger:** Das Verfallsdatum des Hinweises ist erreicht, ohne dass er gelöst wurde
**Flow:**

1. System löscht den Hinweis endgültig; es entsteht keine Historie.
2. Use case ends.

### A3: Vereinsebenen-Signal

**Trigger:** Das Signal betrifft nicht eine Person, sondern den Verein, etwa eine Kommunikationspause
**Flow:**

1. System richtet den Hinweis an den Vorstand und zeigt statt eines Gesprächsvorschlags eine Handlungsfrage an den Verein.
2. Use case continues at step 6.

### A4: Deckel erreicht

**Trigger:** Für das Team bestehen bereits so viele offene Hinweise wie erlaubt (Schritt 1)
**Flow:**

1. System erzeugt keinen weiteren Hinweis, bis ein bestehender triagiert ist.
2. Use case ends.

### A5: Signal betrifft eine Person mit Opt-out

**Trigger:** Das Mitglied hat individuelle Hinweise abbestellt (Schritt 1)
**Flow:**

1. System erzeugt keinen personenbezogenen Hinweis; das Mitglied fliesst nur anonym in Team- und Vereinswerte ein.
2. Use case ends.

## Postconditions

### Success Postconditions

- Der Hinweis trägt den Status «in Kontakt» oder ist gelöscht.
- Alle zuständigen Personen sehen denselben Stand.
- Es ist keine Akte über das Mitglied entstanden.

### Failure Postconditions

- Der Hinweis bleibt offen.
- Der bisherige Status bleibt für alle sichtbar.

## Business Rules

### BR-094: Nur Teilnahmedaten

Signale entstehen ausschliesslich aus Anwesenheiten, Zu- und Absagen sowie dem Zahlungsstatus. Es gibt keine Nutzungs-, Lese- oder Standortdaten.

### BR-095: Signal, kein Urteil

Hinweise formulieren einen Anlass für Kontakt, nie einen Vorwurf. Begriffe wie «inaktiv» oder «säumig» kommen nicht vor.

### BR-096: Strikte Rollen-Reichweite

Trainer:innen sehen nur ihr Team, Sportchef:innen ihren Bereich, der Vorstand den Verein. Die Reichweite wird in der Datenbank durchgesetzt.

### BR-097: Verfall statt Akte

Gelöste und abgelaufene Hinweise werden physisch gelöscht. Es gibt keine Historie über die Saison hinaus.

### BR-098: Keine automatischen Konsequenzen

An ein Signal ist keine automatische Folge gekoppelt. Es entscheidet immer ein Mensch.

### BR-099: Triage in unter zehn Sekunden

Ein Statuswechsel ist mit einem Tap möglich; die Zahl gleichzeitig offener Hinweise pro Team ist begrenzt.

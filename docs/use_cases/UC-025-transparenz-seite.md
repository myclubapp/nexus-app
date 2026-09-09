# Use Case: Transparenz-Seite einsehen und Health-Opt-out setzen

## Overview

**Use Case ID:** UC-025
**Use Case Name:** Transparenz-Seite einsehen und Health-Opt-out setzen
**Primary Actor:** Mitglied
**Goal:** Genau wissen, welche Signale zur eigenen Person bestehen und wer sie sieht – und sie abbestellen können
**Status:** Implemented

## Preconditions

- Das Mitglied gehört einem Verein an.

## Main Success Scenario

1. Mitglied öffnet im Profil «Was sieht mein Verein?».
2. System listet alle Datenarten auf, aus denen Signale entstehen: Anwesenheiten, Zu- und Absagen, Zahlungsstatus – und benennt ausdrücklich, was nicht erhoben wird.
3. System zeigt die aktuell zur Person bestehenden Signale mit Signaltyp, Schweregrad und Status.
4. System nennt zu jedem Signal die Rollen, die es sehen.
5. Mitglied liest die Angaben.
6. Mitglied aktiviert den Opt-out für individuelle Hinweise.
7. System löscht die bestehenden personenbezogenen Signale und erzeugt künftig keine neuen für dieses Mitglied.
8. System bestätigt, dass das Mitglied weiterhin anonym in Team- und Vereinswerte einfliesst.

## Alternative Flows

### A1: Keine Signale vorhanden

**Trigger:** Zur Person besteht kein Signal (Schritt 3)
**Flow:**

1. System zeigt an, dass derzeit kein Hinweis besteht.
2. Use case continues at step 4.

### A2: Opt-out zurücknehmen

**Trigger:** Mitglied deaktiviert den Opt-out wieder
**Flow:**

1. System erzeugt ab dem nächsten Durchlauf wieder Signale.
2. Rückwirkend entstehen keine Signale.
3. Use case ends.

### A3: Erklärung eines Signaltyps

**Trigger:** Mitglied tippt einen Signaltyp an (Schritt 3)
**Flow:**

1. System erklärt die Definition und die im Verein geltende Schwelle.
2. Use case continues at step 5.

## Postconditions

### Success Postconditions

- Das Mitglied kennt alle zu ihm bestehenden Signale und deren Empfänger:innen.
- Bei aktiviertem Opt-out bestehen keine personenbezogenen Signale mehr zu dieser Person.
- Aggregierte Team- und Vereinswerte enthalten das Mitglied weiterhin anonym.

### Failure Postconditions

- Der Opt-out ist nicht gesetzt.
- Bestehende Signale bleiben unverändert.

## Business Rules

### BR-105: Vollständige Auskunft

Die Seite zeigt alle bestehenden Signale zur Person, ohne Auswahl oder Verkürzung.

### BR-106: Opt-out wirkt sofort

Das Setzen des Opt-out löscht bestehende personenbezogene Signale unmittelbar.

### BR-107: Aggregate bleiben anonym

Ein Opt-out entzieht das Mitglied den individuellen Hinweisen, nicht den anonymen Team- und Vereinswerten.

### BR-108: Auch die Nicht-Erhebung wird benannt

Die Seite sagt ausdrücklich, dass keine App-Nutzung, keine Lesebestätigungen und keine Standortdaten erhoben werden.

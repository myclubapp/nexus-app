# Use Case: Eigene Wertdimensionen einsehen

## Overview

**Use Case ID:** UC-024
**Use Case Name:** Eigene Wertdimensionen einsehen
**Primary Actor:** Mitglied
**Goal:** Das eigene Beitragsprofil über fünf Dimensionen im Vergleich zu Team und Verein sehen
**Status:** Draft

## Preconditions

- Das Mitglied gehört einem Verein an.
- Für die laufende Saison bestehen Punktebuchungen im Verein.

## Main Success Scenario

1. Mitglied öffnet im Profil «Meine Stärken».
2. System zeigt ein Netzdiagramm mit den fünf Dimensionen Engagement, Ehrenamt, Finanzen, Netzwerk und Treue, jeweils auf einer Skala von null bis hundert.
3. System legt den Team-Durchschnitt und den Vereins-Durchschnitt als Vergleichslinien darüber.
4. System benennt die stärkste Dimension in positiver Formulierung.
5. Mitglied tippt eine Dimension an.
6. System erklärt, aus welchen Säulen die Dimension entsteht und welche Beiträge sie erhöhen.

## Alternative Flows

### A1: Zu wenig Daten

**Trigger:** Das Mitglied hat in der laufenden Saison zu wenige Buchungen (Schritt 2)
**Flow:**

1. System zeigt das Diagramm mit dem Hinweis, dass es sich nach den ersten Beiträgen füllt.
2. Use case continues at step 6.

### A2: Dimension ohne Erhebung

**Trigger:** Eine Dimension speist sich aus einer im Verein deaktivierten Säule (Schritt 2)
**Flow:**

1. System zeigt die Dimension als «nicht erhoben» an, nicht als Wert null.
2. Use case continues at step 3.

### A3: Kleines Team

**Trigger:** Das Team hat zu wenige Mitglieder für einen aussagekräftigen Durchschnitt (Schritt 3)
**Flow:**

1. System blendet die Team-Vergleichslinie aus und zeigt nur den Vereins-Durchschnitt.
2. Use case continues at step 4.

### A4: Führungssicht

**Trigger:** Eine Trainer:in öffnet dasselbe Diagramm für ein Mitglied ihres Teams
**Flow:**

1. System zeigt das Diagramm als Gesprächsgrundlage mit demselben positiven Wortlaut.
2. System bietet keine Sortierung und keinen Export an.
3. Use case ends.

## Postconditions

### Success Postconditions

- Das Mitglied sieht sein Profil über die fünf Dimensionen im Vergleich zu Team und Verein.
- Die Darstellung benennt eine Stärke, keine Lücke.

### Failure Postconditions

- Das Diagramm bleibt leer und zeigt einen Ladehinweis.

## Business Rules

### BR-100: Keine neue Datenerhebung

Die Dimensionen entstehen ausschliesslich aus dem bestehenden Punkte-Ledger, der Agenda und dem Zahlungsstatus.

### BR-101: Wertschätzung, keine Bewertung

Die Selbstsicht benennt Stärken. Sie enthält keine Gesamtnote und keinen Rang.

### BR-102: Keine Rangliste des Werts

Es existiert keine Ansicht, die Mitglieder nach ihren Wertdimensionen sortiert – weder für Trainer:innen noch für den Vorstand.

### BR-103: Nicht erhoben ist nicht null

Fehlende Erhebung wird als solche gekennzeichnet und nie als Wert null dargestellt.

### BR-104: Mindestgruppengrösse beim Vergleich

Vergleichswerte werden nur angezeigt, wenn die Bezugsgruppe gross genug ist, um keine Einzelperson erkennbar zu machen.

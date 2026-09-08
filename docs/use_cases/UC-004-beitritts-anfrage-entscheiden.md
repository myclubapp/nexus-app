# Use Case: Beitritts-Anfrage entscheiden

## Overview

**Use Case ID:** UC-004
**Use Case Name:** Beitritts-Anfrage entscheiden
**Primary Actor:** Vorstand
**Goal:** Über eine offene Beitritts-Anfrage entscheiden und die Person aufnehmen oder ablehnen
**Status:** Implemented

## Preconditions

- Ein Gast hat eine Beitritts-Anfrage an den Verein gestellt.
- Die entscheidende Person hat im Verein die Rolle admin.

## Main Success Scenario

1. System benachrichtigt den Vorstand über die neue Anfrage.
2. Vorstand öffnet die Liste der offenen Anfragen.
3. System zeigt je Anfrage den Namen, das gewünschte Team und den Zeitpunkt der Anfrage.
4. Vorstand öffnet eine Anfrage.
5. Vorstand wählt «Aufnehmen» und bestimmt die Rolle sowie optional das Team.
6. System setzt die Anfrage auf genehmigt, vermerkt Entscheider:in und Zeitpunkt und legt die Mitgliedschaft an.
7. System benachrichtigt die anfragende Person über die Aufnahme.

## Alternative Flows

### A1: Anfrage ablehnen

**Trigger:** Vorstand wählt «Ablehnen» (Schritt 5)
**Flow:**

1. System setzt die Anfrage auf abgelehnt und vermerkt Entscheider:in und Zeitpunkt.
2. System benachrichtigt die anfragende Person neutral formuliert über den Entscheid.
3. Use case ends.

### A2: Person ist bereits Mitglied

**Trigger:** Zwischen Anfrage und Entscheid ist die Person über eine Einladung beigetreten (Schritt 6)
**Flow:**

1. System setzt die Anfrage ohne weitere Wirkung auf genehmigt.
2. Use case ends.

### A3: Anfrage zurückgezogen

**Trigger:** Die anfragende Person zieht ihre Anfrage vor dem Entscheid zurück
**Flow:**

1. System entfernt die Anfrage aus der Liste der offenen Anfragen.
2. Use case ends.

## Postconditions

### Success Postconditions

- Die Anfrage trägt einen Endstatus mit Entscheider:in und Zeitpunkt.
- Bei Genehmigung existiert die Mitgliedschaft mit der zugewiesenen Rolle.
- Die anfragende Person ist über den Entscheid informiert.

### Failure Postconditions

- Die Anfrage bleibt offen.
- Es entsteht keine Mitgliedschaft.

## Business Rules

### BR-013: Entscheid nur durch den Vorstand

Über Beitritts-Anfragen entscheidet ausschliesslich, wer im Verein die Rolle admin trägt.

### BR-014: Entscheid ist nachvollziehbar

Jeder Entscheid hält fest, wer wann entschieden hat.

### BR-015: Standardrolle bei Aufnahme

Ohne abweichende Wahl erhält die aufgenommene Person die Rolle member.

### BR-016: Ablehnung ohne Begründungszwang

Eine Ablehnung wird der anfragenden Person neutral mitgeteilt; eine Begründung ist nicht verpflichtend und wird nicht gespeichert.

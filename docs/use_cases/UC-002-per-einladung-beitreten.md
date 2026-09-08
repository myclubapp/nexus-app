# Use Case: Per Einladung beitreten

## Overview

**Use Case ID:** UC-002
**Use Case Name:** Per Einladung beitreten
**Primary Actor:** Gast
**Goal:** Über einen Einladungslink oder QR-Code Mitglied eines Vereins werden
**Status:** Draft

## Preconditions

- Der Verein existiert (UC-001).
- Ein Vorstand hat eine gültige Einladung erstellt (UC-003).

## Main Success Scenario

1. Gast öffnet den Einladungslink oder scannt den Einladungs-QR-Code.
2. System öffnet die App und zeigt Verein, Team und die vorgesehene Rolle der Einladung an.
3. Gast bestätigt, dass er beitreten möchte.
4. System prüft, ob der Gast angemeldet ist; ist er es nicht, führt es die Anmeldung durch (UC-005) und kehrt anschliessend hierher zurück.
5. Gast gibt seinen Anzeigenamen ein.
6. System löst die Einladung ein: es legt die Mitgliedschaft mit der hinterlegten Rolle an, ordnet das hinterlegte Team zu und erhöht den Verbrauchszähler der Einladung.
7. System zeigt den Startbildschirm des Vereins mit den nächsten Terminen.

## Alternative Flows

### A1: Einladung abgelaufen

**Trigger:** Das Ablaufdatum der Einladung liegt in der Vergangenheit (Schritt 2)
**Flow:**

1. System zeigt an, dass die Einladung abgelaufen ist, und nennt den Verein.
2. System bietet an, eine Beitritts-Anfrage zu stellen (UC-004).
3. Use case ends.

### A2: Einladung ausgeschöpft

**Trigger:** Die maximale Anzahl Einlösungen ist erreicht (Schritt 6)
**Flow:**

1. System zeigt an, dass die Einladung bereits vollständig genutzt wurde.
2. System bietet an, eine Beitritts-Anfrage zu stellen (UC-004).
3. Use case ends.

### A3: Bereits Mitglied

**Trigger:** Der Gast ist bereits Mitglied dieses Vereins (Schritt 6)
**Flow:**

1. System verändert die bestehende Mitgliedschaft nicht.
2. System wechselt in den Verein und zeigt einen Hinweis, dass die Mitgliedschaft bereits besteht.
3. Use case continues at step 7.

### A4: Einladung mit Team-Bezug, Mitgliedschaft besteht

**Trigger:** Der Gast ist Vereinsmitglied, aber noch nicht im eingeladenen Team (Schritt 6)
**Flow:**

1. System ergänzt die Team-Zuordnung.
2. Use case continues at step 7.

## Postconditions

### Success Postconditions

- Der Gast ist Mitglied des Vereins mit der in der Einladung hinterlegten Rolle.
- Bei einer Team-Einladung ist die Team-Zuordnung angelegt.
- Der Verbrauchszähler der Einladung ist erhöht.

### Failure Postconditions

- Es entsteht keine Mitgliedschaft und keine Team-Zuordnung.
- Der Verbrauchszähler der Einladung bleibt unverändert.

## Business Rules

### BR-005: Einladung trägt ihren Geltungsbereich

Eine Einladung trägt Verein, optional ein Team, die vorgesehene Rolle, ein Ablaufdatum und eine maximale Anzahl Einlösungen. Diese Angaben sind zum Zeitpunkt der Einlösung bindend.

### BR-006: Einladung ist die Berechtigung

Wer eine gültige Einladung besitzt, wird ohne weitere Freigabe Mitglied. Eine zusätzliche Genehmigung findet nicht statt.

### BR-007: Beitrittsdauer

Der Beitritt umfasst nach der Anmeldung höchstens zwei Eingabeschritte, damit er in unter 60 Sekunden abgeschlossen ist.

### BR-008: Keine Rollenerhöhung durch Wiedereinlösung

Eine erneut eingelöste Einladung verändert eine bestehende Rolle nicht.

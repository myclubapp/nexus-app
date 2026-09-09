# Use Case: Aufgabe übernehmen und einreichen

## Overview

**Use Case ID:** UC-018
**Use Case Name:** Aufgabe übernehmen und einreichen
**Primary Actor:** Mitglied
**Goal:** Eine Vereinsaufgabe übernehmen, erledigen und zur Bestätigung einreichen
**Status:** Implemented

## Preconditions

- Eine offene Aufgabe existiert im Geltungsbereich des Mitglieds.
- Das Mitglied gehört dem Verein an.

## Main Success Scenario

1. Mitglied öffnet den Marktplatz.
2. System zeigt die offenen Aufgaben mit Titel, Warum, Kategorie, Frist und Punktwert; persönlich passende Aufgaben stehen zuoberst.
3. Mitglied öffnet eine Aufgabe und liest Beschreibung und Warum.
4. Mitglied wählt «Ich übernehme das».
5. System reserviert die Aufgabe für das Mitglied, setzt sie auf übernommen und zeigt sie in der persönlichen Aufgabenliste.
6. Mitglied erledigt die Aufgabe ausserhalb der App.
7. Mitglied wählt «Erledigt melden» und hängt optional einen Nachweis an.
8. System setzt die Aufgabe auf eingereicht und benachrichtigt die verantwortliche Person.

## Alternative Flows

### A1: Aufgabe bereits vergeben

**Trigger:** Die Aufgabe ist zwischenzeitlich vollständig übernommen worden (Schritt 5)
**Flow:**

1. System weist die Übernahme ab und zeigt den aktuellen Stand.
2. Use case continues at step 2.

### A2: Mehrere Übernehmende

**Trigger:** Die Aufgabe erlaubt mehr als eine Person (Schritt 5)
**Flow:**

1. System nimmt das Mitglied auf, solange freie Plätze bestehen, und lässt die Aufgabe offen.
2. Use case continues at step 6.

### A3: Übernahme zurückgeben

**Trigger:** Mitglied wählt bei einer übernommenen Aufgabe «Doch nicht»
**Flow:**

1. System entfernt die Reservation und setzt die Aufgabe zurück auf offen.
2. System informiert die ausschreibende Person, wenn die Frist innerhalb von 48 Stunden abläuft.
3. Use case ends.

### A4: Frist abgelaufen

**Trigger:** Die Frist verstreicht vor der Einreichung (Schritt 7)
**Flow:**

1. System weist auf die abgelaufene Frist hin, lässt die Einreichung aber weiterhin zu.
2. Use case continues at step 8.

### A5: Kein Nachweis nötig

**Trigger:** Die Aufgabe verlangt keinen Nachweis (Schritt 7)
**Flow:**

1. Mitglied reicht ohne Anhang ein.
2. Use case continues at step 8.

## Postconditions

### Success Postconditions

- Die Aufgabe ist dem Mitglied zugeordnet und trägt den Status eingereicht.
- Ein allfälliger Nachweis ist gespeichert.
- Die verantwortliche Person ist zur Bestätigung aufgefordert.

### Failure Postconditions

- Die Aufgabe bleibt im vorherigen Status.
- Es sind noch keine Punkte gebucht.

## Business Rules

### BR-073: Reservation verhindert Doppelarbeit

Eine übernommene Aufgabe ist für andere sichtbar vergeben, solange sie nicht zurückgegeben wird.

### BR-074: Punkte erst nach Bestätigung

Weder Übernahme noch Einreichung erzeugen Punkte. Punkte entstehen ausschliesslich durch die Bestätigung (UC-019).

### BR-075: Rückgabe ohne Nachteil

Eine zurückgegebene Aufgabe führt zu keinem Punkteabzug und zu keinem Vermerk am Mitglied.

### BR-076: Verteilung ist sichtbar

Der Marktplatz zeigt, wie viele Aufgaben ein Mitglied in der laufenden Saison bereits übernommen hat.

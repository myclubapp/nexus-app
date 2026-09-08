# Use Case: Sprachmemo aufnehmen und adressieren

## Overview

**Use Case ID:** UC-029
**Use Case Name:** Sprachmemo aufnehmen und adressieren
**Primary Actor:** Mitglied
**Goal:** Ein Anliegen sprechen statt tippen und es an die richtige Stelle bringen – oder für sich behalten
**Status:** Draft

## Preconditions

- Das Mitglied gehört einem Verein an.
- Das Modul «Stimme» ist im Verein aktiviert.

## Main Success Scenario

1. Mitglied wählt «Stimme» und tippt auf Aufnehmen.
2. System nimmt auf und zeigt die verstreichende Zeit sowie die verbleibende Restdauer.
3. Mitglied beendet die Aufnahme.
4. System transkribiert die Aufnahme und zeigt das Transkript zur Prüfung an.
5. Mitglied liest das Transkript und korrigiert es bei Bedarf.
6. Mitglied wählt die Adressierung: an sich selbst, an eine Person, an eine Rolle oder anonym an den Vorstand.
7. Mitglied entscheidet, ob die Audiodatei beigelegt wird; die Voreinstellung ist verwerfen.
8. Mitglied sendet.
9. System legt das Anliegen mit Status offen bei den Empfänger:innen ab und benachrichtigt sie.

## Alternative Flows

### A1: An sich selbst

**Trigger:** Mitglied wählt in Schritt 6 «an mich» (Selbstreflexion oder Trainer-Logbuch)
**Flow:**

1. System speichert das Memo strikt privat; auch der Vorstand kann es nicht lesen.
2. Die Transkription erfolgt, wo möglich, auf dem Gerät; die Audiodatei verlässt es nicht.
3. Use case ends.

### A2: Anonym an den Vorstand

**Trigger:** Mitglied wählt in Schritt 6 «anonym»
**Flow:**

1. System speichert das Anliegen ohne jede Angabe zur Autorschaft und vergröbert den Zeitstempel auf die Kalenderwoche.
2. System hinterlegt auf dem Gerät des Mitglieds ein Ticket-Token, mit dem es die Antwort abholen kann.
3. Use case continues at UC-030.

### A3: Aufnahme verwerfen

**Trigger:** Mitglied verwirft Aufnahme oder Transkript (Schritt 5)
**Flow:**

1. System löscht Aufnahme und Transkript vollständig.
2. Use case ends.

### A4: Transkription schlägt fehl

**Trigger:** Das Transkript kann nicht erzeugt werden (Schritt 4)
**Flow:**

1. System bietet an, den Text selbst zu schreiben oder es später erneut zu versuchen.
2. Use case continues at step 5.

### A5: Fair-Use erreicht

**Trigger:** Das Mitglied hat sein Monatskontingent ausgeschöpft (Schritt 1)
**Flow:**

1. System weist auf das Kontingent hin und bietet die Texteingabe an.
2. Use case ends.

## Postconditions

### Success Postconditions

- Das Anliegen liegt mit geprüftem Transkript bei den vorgesehenen Empfänger:innen.
- Die Audiodatei ist gelöscht, sofern sie nicht ausdrücklich beigelegt wurde.
- Bei anonymer Adressierung besteht keine Verbindung zur Person.

### Failure Postconditions

- Es entsteht kein Anliegen.
- Aufnahme und Transkript sind gelöscht.

## Business Rules

### BR-121: Nichts geht ungesehen raus

Ein Transkript wird immer von der absendenden Person geprüft, bevor es jemanden erreicht.

### BR-122: Anonymität ist eine Eigenschaft des Schemas

Für anonyme Anliegen existiert keine Spalte, die die Autorschaft aufnehmen könnte. Der Zeitstempel wird auf die Kalenderwoche vergröbert.

### BR-123: Privates bleibt privat

Selbstreflexionen und Trainer-Logbücher sind ausschliesslich für ihre Autor:innen lesbar – auch nicht für den Vorstand.

### BR-124: Audio wird standardmässig gelöscht

Nach der Transkription wird die Audiodatei verworfen, sofern sie nicht ausdrücklich beigelegt wurde.

### BR-125: Souveräne Transkription

Die Transkription läuft auf dem Gerät oder auf einer selbst betriebenen Instanz. Externe Transkriptionsdienste werden nicht verwendet.

### BR-126: Keine Auswertung der Inhalte

Es findet kein Schlagwort-Scan statt, es gibt keinen Export und keine Volltextsuche über fremde Memos.

### BR-127: Höchstdauer

Ein Memo dauert höchstens drei Minuten.

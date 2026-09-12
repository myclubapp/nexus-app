# Use Case: Funktionärsamt mit Factsheet hinterlegen und im Marktplatz anbieten

## Overview

**Use Case ID:** UC-041
**Use Case Name:** Funktionärsamt mit Factsheet hinterlegen und im Marktplatz anbieten
**Primary Actor:** Vorstand
**Goal:** Die Ämter des Vereins mit Pflichtenheft, Aufwand, Punktwert, Ansprechperson und Factsheet-PDF so hinterlegen, dass Interessierte wissen, worauf sie sich einlassen – und dass vakante Ämter im Marktplatz sichtbar sind
**Status:** Implemented

## Preconditions

- Der Verein existiert.
- Die Person hat im Verein die Rolle admin.
- Für das Ansehen (Schritte 8–10) genügt die Mitgliedschaft.

## Main Success Scenario

1. Vorstand öffnet die Ämterliste und wählt «Amt anlegen».
2. System zeigt das Formular: Bezeichnung, Warum, Pflichtenheft, Aufwand pro Saison, Helferpunkte, Anzahl Sitze, Besetzung, Ansprechperson und Factsheet-PDF.
3. Vorstand füllt die Angaben aus und trägt die Personen ein, die das Amt tragen – mit Namen; ein Mitglied wählt er, sobald die Person ein Konto hat.
4. Vorstand wählt ein PDF als Factsheet.
5. Vorstand speichert.
6. System legt das Amt samt Besetzung an, lädt das PDF in den Vereinsspeicher und zeigt das Amt in der Ämterliste.
7. System rechnet die Vakanz: Sitze minus Personen, die das Amt ordentlich tragen.
8. Mitglied öffnet den Marktplatz und sieht im Abschnitt «Ämter zu vergeben» jedes Amt mit freien Sitzen, die grösste Lücke zuoberst.
9. Mitglied tippt ein Amt an und liest Pflichten, Eckdaten, Besetzung und Ansprechperson.
10. Mitglied öffnet das Factsheet-PDF.

## Alternative Flows

### A1: Inhaber:in ad interim

**Trigger:** Eine Person trägt das Amt nur vorübergehend (Schritt 3)
**Flow:**

1. Vorstand markiert die Person als «ad interim».
2. System zeigt die Person in der Besetzung, zählt den Sitz aber weiterhin als frei.
3. Use case continues at step 5.

### A2: Amt ohne Factsheet

**Trigger:** Es gibt noch kein PDF (Schritt 4)
**Flow:**

1. Vorstand speichert ohne Datei.
2. System zeigt das Amt ohne den Knopf «Factsheet öffnen»; die Angaben aus Schritt 3 stehen trotzdem.
3. Use case continues at step 7.

### A3: Factsheet ersetzen oder entfernen

**Trigger:** Vorstand öffnet ein bestehendes Amt zum Bearbeiten (Schritt 1)
**Flow:**

1. System zeigt das Formular mit dem gespeicherten Stand und dem Hinweis, dass ein Factsheet hinterlegt ist.
2. Vorstand wählt ein neues PDF oder entfernt das bestehende.
3. System überschreibt beziehungsweise löscht die Datei im Vereinsspeicher und passt das Amt an.
4. Use case continues at step 7.

### A4: Mitglied tritt aus

**Trigger:** Eine Person, die ein Amt als Mitglied trägt, verlässt den Verein
**Flow:**

1. System löst die Verknüpfung zum Konto; der Name bleibt in der Besetzung stehen.
2. Der Verteiler für Sitzungs-Inputs (UC-031) erreicht die nächste verknüpfte Inhaber:in – oder niemanden, bis der Vorstand die Nachfolge einträgt.
3. Use case ends.

### A5: Passende Vakanz

**Trigger:** Das Beitrags-Profil des Mitglieds nennt Organisation oder Finanzen (UC-033)
**Flow:**

1. System markiert das Amt im Marktplatz zusätzlich mit «Passt zu dir».
2. Use case continues at step 9.

### A6: Datei nicht zulässig

**Trigger:** Die gewählte Datei ist kein PDF oder grösser als 10 MB (Schritt 4)
**Flow:**

1. System nennt den Grund und behält die vorherige Wahl.
2. Use case continues at step 4.

## Postconditions

### Success Postconditions

- Das Amt existiert mit Bezeichnung, Pflichten, Aufwand, Punktwert, Sitzen, Besetzung und Ansprechperson.
- Das Factsheet liegt im Vereinsspeicher unter dem Ordner des Vereins; Mitglieder öffnen es über eine signierte Adresse.
- Hat das Amt freie Sitze, steht es im Marktplatz unter «Ämter zu vergeben», in der Sitzungsagenda unter den Dauerthemen (UC-031) und im Nachfolge-Vorlauf des Vorstands (UC-024).

### Failure Postconditions

- Es entsteht kein halbes Amt: Amt und Besetzung werden in einer Transaktion gespeichert.
- Schlägt der Upload fehl, bleibt das Amt ohne Factsheet und das Formular nennt den Fehler.

## Business Rules

### BR-183: Vakanz ist eine Sitzrechnung

Ein Amt ist vakant, wenn es mehr Sitze hat als Personen, die es ordentlich tragen. «Ad interim» zählt nicht als besetzt. Die Rechnung steht einmal (`office_open_seats()`), und jede Anzeige – Marktplatz, Sitzungsagenda, Beitrags-Matching, Nachfolge-Vorlauf, Reaktionszeiten des Vorstands – verwendet sie.

### BR-184: Eine Inhaber:in braucht kein Konto

Die Besetzung führt Personen mit Namen. Ein Konto ist nicht Voraussetzung; die Verknüpfung kommt, wenn die Person beitritt. Sonst liesse sich ein Verein, dessen Vorstand als Erster beitritt, nicht abbilden.

### BR-185: Der Verteiler folgt der Besetzung

Der Verteiler für Sitzungs-Inputs (BR-133) wird aus der Besetzung abgeleitet – die erste verknüpfte Inhaber:in, ordentliche vor «ad interim». Er ist nicht direkt schreibbar, damit es keine zwei Wahrheiten über dieselbe Person gibt.

### BR-186: Das Factsheet gehört dem Verein

Das PDF liegt im Vereinsspeicher unter dem Ordner des Vereins. Lesen dürfen Mitglieder, schreiben der Vorstand – geprüft in den Storage-Policies über den Ordner im Pfad, nicht im Client.

## Notes

- Gezogen aus `MVP_Scope` §2.3 («Ausbaustufe 2 des Marktplatzes») am 12.09.2026 auf Sandros Auftrag: Die Factsheets seines Vereins liegen unter `docs/marktplatz/97_Funktionäre/`; `build_factsheets.py` erzeugt daraus die fehlenden PDFs und das Import-SQL.
- Der Punktwert steht als Beschriftung («4 + Lohn»), nicht als Zahl. Eine Gutschrift in App-Punkten am Saisonende (Konzept §4.3) ist eine eigene Punktequelle und nicht Teil dieses Use Cases.
- Offen: ein Verteiler an **alle** verknüpften Inhaber:innen eines Amtes (heute: eine Person je Amt, wie seit UC-031).

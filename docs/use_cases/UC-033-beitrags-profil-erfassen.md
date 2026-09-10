# Use Case: Beitrags-Profil erfassen

## Overview

**Use Case ID:** UC-033
**Use Case Name:** Beitrags-Profil erfassen
**Primary Actor:** Mitglied
**Goal:** Angeben, womit man gern beiträgt, damit Verantwortung persönlich angeboten wird
**Status:** Implemented

## Preconditions

- Das Mitglied gehört einem Verein an.

## Main Success Scenario

1. System fragt das Mitglied beim Onboarding und danach jährlich: «Womit trägst du gern bei? Was wäre für dich ein sinnvoller Beitrag?»
2. Mitglied wählt Interessengebiete aus einer Liste von Kategorien.
3. Mitglied beschreibt in einem Satz oder per Sprachmemo, was für es ein sinnvoller Beitrag wäre.
4. Mitglied gibt sein Zeitbudget an: einmalig, monatlich oder saisonal.
5. Mitglied speichert.
6. System übernimmt das Profil und schlägt ab sofort passende Aufgaben und Ämter persönlich vor.
7. System zeigt unmittelbar die erste passende offene Aufgabe an, sofern eine existiert.

## Alternative Flows

### A1: Später ausfüllen

**Trigger:** Mitglied überspringt die Frage (Schritt 2)
**Flow:**

1. System zeigt allgemeine Vorschläge statt persönlicher.
2. System fragt erst beim nächsten jährlichen Durchgang erneut.
3. Use case ends.

### A2: Profil ändern

**Trigger:** Mitglied öffnet das Beitrags-Profil im eigenen Profil
**Flow:**

1. Mitglied ändert Interessen, Beschreibung oder Zeitbudget.
2. System aktualisiert die Vorschläge unmittelbar.
3. Use case ends.

### A3: Keine passenden Beiträge

**Trigger:** Zum Profil existiert derzeit keine offene Aufgabe (Schritt 7)
**Flow:**

1. System vermerkt das Profil und meldet sich, sobald eine passende Aufgabe entsteht.
2. Use case ends.

### A4: Zeitbudget ausgeschöpft

**Trigger:** Das Mitglied hat im gewählten Zeitraum bereits Beiträge übernommen (Schritt 6)
**Flow:**

1. System stellt die persönlichen Vorschläge zurück, bis der Zeitraum erneuert ist.
2. Use case ends.

## Postconditions

### Success Postconditions

- Das Beitrags-Profil des Mitglieds ist gespeichert.
- Marktplatz und Vakanz-Anzeige berücksichtigen das Profil bei Vorschlägen.

### Failure Postconditions

- Es besteht kein Profil.
- Das Mitglied erhält allgemeine statt persönlicher Vorschläge.

## Business Rules

### BR-142: Anfragen statt abfragen

Der Verein fragt, was für das Mitglied ein sinnvoller Beitrag wäre, statt nur zu fragen, wer eine offene Aufgabe übernimmt.

### BR-143: Das Profil ist freiwillig

Ohne Profil bleibt die App vollständig nutzbar. Ein fehlendes Profil erzeugt keinen Nachteil und keinen Hinweis an Verantwortliche.

### BR-144: Zeitbudget wird respektiert

Persönliche Vorschläge berücksichtigen das angegebene Zeitbudget und die bereits übernommenen Beiträge.

### BR-145: Das Profil ist nicht Teil der Führungssicht

Interessen und Stärken erscheinen nicht in Gesundheitsansichten und lösen keine Signale aus.

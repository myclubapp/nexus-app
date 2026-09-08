# Use Case: Aufgabe im Marktplatz ausschreiben

## Overview

**Use Case ID:** UC-017
**Use Case Name:** Aufgabe im Marktplatz ausschreiben
**Primary Actor:** Vorstand
**Goal:** Eine Vereinsaufgabe so ausschreiben, dass Mitglieder sie freiwillig übernehmen
**Status:** Draft

## Preconditions

- Der Verein existiert.
- Die Person hat im Verein die Rolle trainer oder admin.

## Main Success Scenario

1. Vorstand wählt im Marktplatz «Aufgabe ausschreiben».
2. System zeigt das Formular mit Titel, Beschreibung, Kategorie, Frist, Punktwert, Anzahl Übernehmender und dem Pflichtfeld «Wozu dient das? Wem hilft es?».
3. Vorstand füllt die Angaben aus, einschliesslich des Warum.
4. Vorstand wählt, ob die Aufgabe für den ganzen Verein oder ein bestimmtes Team gilt.
5. Vorstand publiziert die Aufgabe.
6. System legt die Aufgabe mit dem Status offen an und zeigt sie im Marktplatz.
7. System schlägt die Aufgabe jenen Mitgliedern persönlich vor, deren Beitrags-Profil zur Kategorie passt.

## Alternative Flows

### A1: Warum fehlt

**Trigger:** Das Warum-Feld ist leer (Schritt 5)
**Flow:**

1. System verweigert die Publikation und erklärt die Regel.
2. Use case continues at step 3.

### A2: Wiederkehrende Aufgabe

**Trigger:** Vorstand markiert die Aufgabe als wiederkehrend (Schritt 3)
**Flow:**

1. Vorstand gibt den Rhythmus an.
2. System schreibt die Aufgabe nach jeder abgeschlossenen Runde automatisch neu aus.
3. Use case continues at step 6.

### A3: Als Entwurf sichern

**Trigger:** Vorstand wählt «Entwurf sichern» (Schritt 5)
**Flow:**

1. System speichert die Aufgabe als Entwurf, ohne sie sichtbar zu machen.
2. Use case ends.

### A4: Frist läuft ab

**Trigger:** Die Frist verstreicht, ohne dass die Aufgabe übernommen wurde
**Flow:**

1. System hebt die Aufgabe im Marktplatz als dringend hervor, solange sie offen ist.
2. Nach Ablauf setzt das System die Aufgabe auf abgelaufen und informiert die ausschreibende Person.
3. Use case ends.

## Postconditions

### Success Postconditions

- Die Aufgabe existiert mit Titel, Warum, Kategorie, Frist, Punktwert und Status offen.
- Die Aufgabe erscheint im Marktplatz im gewählten Geltungsbereich.
- Passende Mitglieder haben einen persönlichen Vorschlag erhalten.

### Failure Postconditions

- Es entsteht keine sichtbare Aufgabe.
- Es erhält niemand einen Vorschlag.

## Business Rules

### BR-068: Aufgabe trägt ihren Punktwert selbst

Der Punktwert steht an der Aufgabe, nicht an einer Regel. Die Bestätigung bucht diesen Wert direkt.

### BR-069: Warum ist Publikationsvoraussetzung

Eine Aufgabe ohne Sinnzusammenhang kann nicht publiziert werden.

### BR-070: Anfrage statt Abfrage

Aufgaben werden passenden Mitgliedern persönlich vorgeschlagen, statt nur ausgeschrieben zu werden.

### BR-071: Freiwilligkeit

Eine Aufgabe kann niemandem zugewiesen werden. Sie ist immer ein Angebot.

### BR-072: Dringlichkeit ist sichtbar

Aufgaben mit bald ablaufender Frist werden im Marktplatz hervorgehoben.

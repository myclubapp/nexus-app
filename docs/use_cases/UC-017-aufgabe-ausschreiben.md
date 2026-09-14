# Use Case: Aufgabe im Marktplatz ausschreiben

## Overview

**Use Case ID:** UC-017
**Use Case Name:** Aufgabe im Marktplatz ausschreiben
**Primary Actor:** Vorstand
**Goal:** Eine Vereinsaufgabe so ausschreiben, dass Mitglieder sie freiwillig übernehmen
**Status:** Implemented

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
2. System zeigt den Entwurf im Marktplatz im Abschnitt «Entwürfe», den nur Trainer:innen und Vorstand sehen.
3. Vorstand publiziert den Entwurf später direkt aus diesem Abschnitt, oder bearbeitet ihn zuvor (A5).
4. Use case continues at step 6.

### A4: Frist läuft ab

**Trigger:** Die Frist verstreicht, ohne dass die Aufgabe übernommen wurde
**Flow:**

1. System hebt die Aufgabe im Marktplatz als dringend hervor, solange sie offen ist.
2. Nach Ablauf setzt das System die Aufgabe auf abgelaufen und informiert die ausschreibende Person.
3. Use case ends.

### A5: Entwurf bearbeiten

**Trigger:** Vorstand öffnet einen Entwurf im Abschnitt «Entwürfe» (A3, Schritt 3)
**Flow:**

1. System zeigt das Formular aus Schritt 2 mit den gespeicherten Angaben.
2. Vorstand ändert die Angaben.
3. Vorstand sichert erneut als Entwurf oder publiziert.
4. Use case continues at A3 (Schritt 1) oder at step 6.

**Stand (11.09.2026):** Umgesetzt. Bis dahin war ein Entwurf im Marktplatz nicht antippbar; das einzige Bedienelement daran war «Publizieren», und das Formular kannte nur das Anlegen. Das Bearbeiten war nie gebaut – anders als bei Terminen (UC-009) und News (UC-026). Jetzt öffnet Antippen denselben Bogen wie beim Ausschreiben, mit dem gesicherten Stand als Anfangswert; «Publizieren» daneben schreibt aus, ohne zu öffnen. Die Änderung schreibt die App direkt über die bestehende Policy für Trainer:innen und Vorstand, begrenzt auf den Status Entwurf (BR-182).

### A6: Entwurf löschen

**Trigger:** Vorstand will einen Entwurf nicht mehr (A3, Schritt 2)
**Flow:**

1. Vorstand wischt den Entwurf nach links und wählt «Entwurf löschen» – oder wählt dieselbe Zeile unter «Verwalten» im Bearbeiten-Blatt (A5).
2. System fragt nach; der Entwurf war für Mitglieder nie sichtbar.
3. Vorstand bestätigt.
4. System löscht den Entwurf. Ist er inzwischen ausgeschrieben, lehnt das System ab und sagt es (BR-182).
5. Use case ends.

**Stand (12.09.2026):** Umgesetzt. Bis dahin liess sich ein Entwurf nur ausschreiben oder ändern, nicht loswerden – die Policy `tasks_trainer_delete` (0033) erlaubte das Löschen, die App bot keinen Weg.

## Postconditions

### Success Postconditions

- Die Aufgabe existiert mit Titel, Warum, Kategorie, Frist, Punktwert und Status offen.
- Die Aufgabe erscheint im Marktplatz im gewählten Geltungsbereich.
- Passende Mitglieder haben einen persönlichen Vorschlag erhalten.

### Failure Postconditions

- Es entsteht keine sichtbare Aufgabe.
- Es erhält niemand einen Vorschlag.
- Ein bereits gesicherter Entwurf bleibt unverändert erhalten.

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

### BR-182: Ein Entwurf bleibt formbar

Ein Entwurf ist eine noch nicht abgeschickte Aufgabe. Er lässt sich bis zur Publikation vollständig ändern, von derselben Person oder einer anderen mit Trainer- oder Vorstandsrolle. Was publiziert ist, ändert sich nicht mehr still, weil Mitglieder sich darauf verlassen.

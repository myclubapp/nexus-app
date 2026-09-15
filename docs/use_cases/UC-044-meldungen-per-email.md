# Use Case: Meldungen per E-Mail erhalten

## Overview

**Use Case ID:** UC-044
**Use Case Name:** Meldungen per E-Mail erhalten
**Primary Actor:** Mitglied
**Secondary Actor:** System
**Goal:** Meldungen aus dem Verein auch im Postfach haben – gebündelt oder sofort, in der eigenen Sprache, ohne dass die Inbox der App etwas verliert
**Status:** Implemented

## Preconditions

- Das Mitglied ist angemeldet, und das Konto trägt eine E-Mail-Adresse.
- Der Versanddienst ist eingerichtet: SMTP-Zugang und Absender liegen als Secrets der Edge Function vor (BR-212).

## Main Success Scenario

1. Mitglied öffnet die Benachrichtigungseinstellungen.
2. System zeigt unter «E-Mail» die Zustellung – sofort, täglich um 18:00 gebündelt, wöchentlich am Sonntag um 18:00, keine E-Mail – und darunter dieselben Kategorien wie bei Push, ohne «Hinweise» und «Befinden».
3. Mitglied wählt die Zustellung, wählt Kategorien ab und speichert.
4. System hält die Wahl und die Sprache der App am Konto fest.
5. Eine Meldung entsteht. System vermerkt an der Zeile, ob sie per E-Mail hinausgeht und ab wann – sofort oder zum Ende des Tages beziehungsweise der Woche.
6. Alle fünf Minuten sammelt System die fälligen Zeilen je Konto ein, setzt daraus eine Mail in der Sprache der Person im Auftritt des Vereins zusammen – Logo, Farbe, Name und je Zeile das Warum (UC-048) – und verschickt sie über den Vereins-SMTP.
7. System quittiert die verschickten Zeilen. Die Inbox der App bleibt unverändert.

## Alternative Flows

### A1: Dringende Meldung

**Trigger:** Ein Termin wird abgesagt, über eine Beitritts-Anfrage wird entschieden oder der Vereins-Puls wird freigegeben (Schritt 5)
**Flow:**

1. System vermerkt die Zeile als sofort fällig, unabhängig von der gewählten Zustellung.
2. Use case continues at step 6.

### A2: Versand scheitert

**Trigger:** Der SMTP-Server lehnt die Mail ab oder ist nicht erreichbar (Schritt 6)
**Flow:**

1. System hält den Fehler an den Zeilen fest und gibt die Sperre frei.
2. Beim nächsten Lauf versucht es System erneut, höchstens fünf Mal.
3. Die Inbox der App enthält die Meldung unverändert.

### A3: Konto ohne Adresse

**Trigger:** Das Konto hat keine E-Mail-Adresse (Schritt 6)
**Flow:**

1. System trägt die Zeile aus dem Versand aus und vermerkt den Grund.
2. Use case ends.

### A4: Sprache wechseln

**Trigger:** Mitglied stellt die App auf eine andere Sprache
**Flow:**

1. System meldet die Sprache an das Konto.
2. Die nächste Mail ist in der neuen Sprache geschrieben.

### A5: Keine E-Mail

**Trigger:** Mitglied wählt «Keine E-Mail» (Schritt 3)
**Flow:**

1. System blendet die Kategorien aus und sagt, dass die Inbox weiterhin alles enthält.
2. Ab der nächsten Meldung entsteht kein E-Mail-Vermerk mehr, auch nicht für Dringendes.

## Postconditions

### Success Postconditions

- Fällige Meldungen sind als eine Mail je Konto und Lauf verschickt und an der Zeile quittiert.
- Die Inbox der App enthält weiterhin sämtliche Meldungen.

### Failure Postconditions

- Nicht verschickte Zeilen tragen den Fehler und bleiben für den nächsten Lauf offen.

## Business Rules

### BR-210: Fürsorge und Befinden gehen nie per E-Mail

Fürsorge-Hinweise («Hinweise») und die Frage nach dem Befinden («Befinden») werden nie per E-Mail zugestellt, auch nicht auf ausdrücklichen Wunsch. Ein Postfach lesen auch andere; die Regel steht über jeder Einstellung.

### BR-211: Die Zustellung bündelt, die Dringlichkeit bricht

Die gewählte Zustellung bestimmt, wann eine Meldung per E-Mail hinausgeht: sofort, am Ende des Tages um 18:00 oder am Sonntag um 18:00. Absagen, der Beitritts-Entscheid und der Vereins-Puls gehen unabhängig davon sofort. «Keine E-Mail» gilt für alles.

### BR-212: Der Mail-Zugang liegt nie im Repository

SMTP-Server, Benutzer, Kennwort und Absender stehen ausschliesslich als Secrets der Edge Function. Fehlt einer, sagt der Versanddienst, welcher – ein Lauf, der still nichts tut, wäre nach zwei Wochen unbemerkt.

### BR-213: Eine Mail je Konto und Lauf

Ein Lauf nimmt ganze Konten: erst die Konten mit fälligen Zeilen, dann alle fälligen Zeilen dieser Konten. Eine Zusammenfassung wird nie über zwei Läufe zerschnitten. Anmeldelinks und Hinweise zur Kontolöschung bleiben davon unberührt (BR-120).

**Ausnahme seit UC-048:** Eine Zeile mit eigenem Blatt (`mail_template`, heute die Willkommensmail) ist kein Eintrag in einer Liste, sondern ein eigenes Schreiben. Sie bekommt ihre eigene Mail, auch wenn im selben Lauf weitere Zeilen desselben Kontos fällig sind.

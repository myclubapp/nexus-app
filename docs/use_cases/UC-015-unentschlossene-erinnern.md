# Use Case: Unentschlossene erinnern

## Overview

**Use Case ID:** UC-015
**Use Case Name:** Unentschlossene erinnern
**Primary Actor:** Trainer:in
**Goal:** Vor einem Termin eine belastbare Teilnehmerzahl erhalten
**Status:** Draft

## Preconditions

- Ein Termin in der Zukunft existiert.
- Mindestens ein betroffenes Mitglied hat weder zu- noch abgesagt.
- Die Person hat im Verein die Rolle trainer oder admin.

## Main Success Scenario

1. Trainer:in öffnet den Termin.
2. System zeigt Zusagen, Absagen und Unentschlossene getrennt an.
3. Trainer:in wählt «Unentschlossene erinnern».
4. System zeigt an, wie viele Personen erinnert werden.
5. Trainer:in bestätigt.
6. System stellt allen Unentschlossenen eine Benachrichtigung mit dem Termin und einer direkten Antwortmöglichkeit zu und legt sie zusätzlich in deren Inbox ab.
7. System vermerkt den Zeitpunkt der Erinnerung am Termin.

## Alternative Flows

### A1: Erinnerung bereits versendet

**Trigger:** Für diesen Termin wurde in den letzten 24 Stunden bereits erinnert (Schritt 3)
**Flow:**

1. System zeigt den Zeitpunkt der letzten Erinnerung und weist die erneute Zustellung ab.
2. Use case ends.

### A2: Niemand unentschlossen

**Trigger:** Alle betroffenen Mitglieder haben geantwortet (Schritt 2)
**Flow:**

1. System blendet die Schaltfläche aus.
2. Use case ends.

### A3: Automatische Erinnerung

**Trigger:** Der Termin beginnt in 48 Stunden und es bestehen offene Antworten
**Flow:**

1. System versendet die Erinnerung automatisch, sofern der Verein dies aktiviert hat.
2. Use case continues at step 7.

## Postconditions

### Success Postconditions

- Alle Unentschlossenen haben eine Erinnerung in der Inbox und, sofern erlaubt, als Push erhalten.
- Der Zeitpunkt der Erinnerung ist am Termin vermerkt.

### Failure Postconditions

- Es wurde niemand erinnert.
- Der Termin bleibt unverändert.

## Business Rules

### BR-059: Nur Unentschlossene

Die Erinnerung erreicht ausschliesslich Mitglieder ohne Antwort. Wer zu- oder abgesagt hat, wird nicht erneut angesprochen.

### BR-060: Höchstens eine Erinnerung pro Tag

Je Termin wird höchstens alle 24 Stunden erinnert.

### BR-061: Erinnerung ist eine Verbindung, kein Aufruf

Eine Terminerinnerung zählt in der Verbindungs-Quote weder als Verbindung noch als Aufruf.

### BR-062: Antwort direkt aus der Benachrichtigung

Die Erinnerung führt direkt zur Antwortmöglichkeit, ohne dass das Mitglied den Termin suchen muss.

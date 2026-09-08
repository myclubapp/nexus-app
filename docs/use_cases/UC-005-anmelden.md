# Use Case: Anmelden

## Overview

**Use Case ID:** UC-005
**Use Case Name:** Anmelden
**Primary Actor:** Mitglied
**Goal:** Zugang zur App erhalten, ohne ein Passwort verwalten zu müssen
**Status:** Implemented

## Preconditions

- Die Person hat Zugriff auf das E-Mail-Postfach der angegebenen Adresse.

## Main Success Scenario

1. Mitglied öffnet die App und sieht den Anmeldebildschirm.
2. Mitglied gibt seine E-Mail-Adresse ein und wählt «Link senden».
3. System versendet eine E-Mail mit einem einmalig gültigen Anmeldelink und zeigt einen Hinweis, dass die E-Mail unterwegs ist.
4. Mitglied öffnet die E-Mail und tippt den Link an.
5. System öffnet die App über den Deep Link, tauscht den Link gegen eine Sitzung und meldet das Mitglied an.
6. System leitet auf den zuletzt genutzten Verein weiter oder, falls keiner besteht, auf das Onboarding.

## Alternative Flows

### A1: Link abgelaufen oder bereits verwendet

**Trigger:** Der Anmeldelink ist ungültig (Schritt 5)
**Flow:**

1. System zeigt an, dass der Link nicht mehr gültig ist.
2. System bietet an, einen neuen Link zu senden.
3. Use case continues at step 2.

### A2: Anmeldung mit E-Mail und Passwort

**Trigger:** Mitglied wählt auf dem Anmeldebildschirm «Mit Passwort anmelden»
**Flow:**

1. Mitglied gibt E-Mail und Passwort ein.
2. System prüft die Angaben und meldet das Mitglied an.
3. Use case continues at step 6.

### A3: App nicht installiert

**Trigger:** Der Link wird auf einem Gerät ohne installierte App geöffnet (Schritt 4)
**Flow:**

1. System öffnet die Web-App im Browser und meldet dort an.
2. Use case continues at step 6.

### A4: Anmeldung während eines Einladungsflusses

**Trigger:** Die Anmeldung wurde aus UC-002 heraus gestartet
**Flow:**

1. System kehrt nach der Anmeldung zur Einladung zurück.
2. Use case ends.

## Postconditions

### Success Postconditions

- Eine gültige Sitzung besteht und wird auf dem Gerät persistiert.
- Das Mitglied befindet sich im Kontext eines Vereins oder im Onboarding.

### Failure Postconditions

- Es besteht keine Sitzung.
- Der Anmeldebildschirm bleibt mit einer Fehlermeldung stehen.

## Business Rules

### BR-017: Kein Login über Drittanbieter

Es gibt weder Google- noch Facebook- noch Apple-Login. Die Anmeldung erfolgt ausschliesslich über E-Mail-Verfahren.

### BR-018: Anmeldelink ist einmalig

Ein Anmeldelink ist genau einmal einlösbar und läuft nach der vom Backend gesetzten Frist ab.

### BR-019: Sitzung bleibt bestehen

Eine erfolgreiche Anmeldung bleibt über App-Neustarts hinweg gültig, bis sich das Mitglied abmeldet oder das Konto löscht.

# Use Case: Profil und Datenschutz-Optionen pflegen

## Overview

**Use Case ID:** UC-008
**Use Case Name:** Profil und Datenschutz-Optionen pflegen
**Primary Actor:** Mitglied
**Goal:** Die eigenen Angaben aktuell halten und bestimmen, was andere davon sehen
**Status:** Implemented

## Preconditions

- Das Mitglied ist angemeldet und gehört mindestens einem Verein an.

## Main Success Scenario

1. Mitglied öffnet sein Profil.
2. System zeigt Anzeigename, Avatar, Kontaktdaten, Sprache und die Datenschutz-Optionen.
3. Mitglied ändert Anzeigename oder lädt ein Profilbild hoch.
4. Mitglied legt je Kontaktangabe fest, ob sie für andere Vereinsmitglieder sichtbar ist.
5. Mitglied legt fest, ob es in Ranglisten erscheint.
6. Mitglied speichert.
7. System übernimmt die Änderungen und wendet die Sichtbarkeitsregeln unmittelbar an.

## Alternative Flows

### A1: Aus Ranglisten austreten

**Trigger:** Mitglied deaktiviert die Anzeige in Ranglisten (Schritt 5)
**Flow:**

1. System entfernt das Mitglied aus allen Ranglisten.
2. Punkte werden weiterhin gebucht und im eigenen Dashboard angezeigt.
3. Use case continues at step 6.

### A2: Sprache wechseln

**Trigger:** Mitglied wählt eine andere Sprache (Schritt 2)
**Flow:**

1. System stellt die Oberfläche unmittelbar auf die gewählte Sprache um.
2. Use case continues at step 3.

### A3: Profil in mehreren Vereinen

**Trigger:** Das Mitglied gehört mehreren Vereinen an (Schritt 2)
**Flow:**

1. System zeigt die Datenschutz-Optionen je Verein getrennt an.
2. Use case continues at step 4.

## Postconditions

### Success Postconditions

- Die Profilangaben entsprechen den Eingaben.
- Die Sichtbarkeitsregeln werden bei jeder Anzeige durch andere Mitglieder durchgesetzt.

### Failure Postconditions

- Die Profilangaben bleiben unverändert.
- Das System zeigt eine Fehlermeldung.

## Business Rules

### BR-028: Datenschutz je Verein

Sichtbarkeitsentscheide gelten pro Vereinsmitgliedschaft, nicht global für das Konto.

### BR-029: Ranglisten sind freiwillig

Die Anzeige in Ranglisten ist abwählbar. Der Ausstieg beeinflusst die eigene Punktesammlung nicht.

### BR-030: Sichtbarkeit wird serverseitig durchgesetzt

Als verborgen markierte Kontaktangaben werden anderen Mitgliedern nicht ausgeliefert, nicht nur ausgeblendet.

### BR-031: Anzeigename ist Pflicht

Ein Mitglied trägt immer einen Anzeigenamen; er darf nicht leer sein.

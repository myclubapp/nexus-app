# Use Case: Konto löschen

## Overview

**Use Case ID:** UC-006
**Use Case Name:** Konto löschen
**Primary Actor:** Mitglied
**Goal:** Das eigene Konto und die personenbezogenen Daten dauerhaft entfernen
**Status:** Draft

## Preconditions

- Das Mitglied ist angemeldet.

## Main Success Scenario

1. Mitglied öffnet die Profileinstellungen und wählt «Konto löschen».
2. System erklärt in klarer Sprache, was gelöscht wird, was anonymisiert erhalten bleibt und dass der Vorgang nicht rückgängig gemacht werden kann.
3. Mitglied bestätigt die Löschung ausdrücklich.
4. System entfernt die personenbezogenen Daten aus allen Mitgliedschaften, anonymisiert den Anzeigenamen, entfernt Avatar und Kontaktdaten, löscht Push-Registrierungen, Benachrichtigungen, private Sprachmemos und Check-in-Antworten.
5. System entkoppelt die Punktebuchungen von der Person, behält sie aber anonym als Bestandteil der Vereinsstatistik.
6. System löscht das Anmeldekonto.
7. System meldet das Gerät ab und zeigt eine Bestätigung.

## Alternative Flows

### A1: Letzter Vorstand eines Vereins

**Trigger:** Das Mitglied ist im Verein die einzige Person mit der Rolle admin (Schritt 3)
**Flow:**

1. System weist darauf hin, dass der Verein ohne Vorstand zurückbliebe.
2. System fordert auf, zuerst eine andere Person zum Vorstand zu machen oder den Verein zu löschen.
3. Use case ends.

### A2: Abbruch

**Trigger:** Mitglied bestätigt in Schritt 3 nicht
**Flow:**

1. System verwirft den Vorgang.
2. Use case ends.

### A3: Offene anonyme Anliegen

**Trigger:** Es bestehen anonyme Anliegen des Mitglieds (Schritt 4)
**Flow:**

1. System lässt die anonymen Anliegen unverändert bestehen, da sie keine Verbindung zur Person tragen.
2. Use case continues at step 5.

## Postconditions

### Success Postconditions

- Das Anmeldekonto existiert nicht mehr.
- In keinem Verein sind personenbezogene Daten der Person mehr auffindbar.
- Punktebuchungen bleiben anonymisiert erhalten, damit Vereinsauswertungen konsistent bleiben.

### Failure Postconditions

- Das Konto und alle Daten bleiben unverändert bestehen.
- Das System zeigt eine Fehlermeldung.

## Business Rules

### BR-020: Löschung ist in der App erreichbar

Die Kontolöschung ist ohne Umweg über Support oder Website aus der App heraus möglich. Dies ist eine Auflage der App-Stores.

### BR-021: Statistik ohne Person

Punktebuchungen bleiben als anonyme Vereinsdaten erhalten. Sie tragen nach der Löschung keinen Bezug zu einer natürlichen Person mehr.

### BR-022: Private Inhalte werden gelöscht

Selbstreflexionen, Trainer-Logbücher und Check-in-Antworten werden vollständig gelöscht, nicht anonymisiert.

### BR-023: Vereinskontinuität

Ein Verein darf durch eine Kontolöschung nicht ohne Vorstand zurückbleiben.

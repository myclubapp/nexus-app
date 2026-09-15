# Use Case: Profil einrichten

## Overview

**Use Case ID:** UC-053
**Use Case Name:** Profil einrichten
**Primary Actor:** Mitglied
**Goal:** Nach dem Beitritt einmal durch Bild, Name, Erreichbarkeit und Meldungen geführt werden – überspringbar, jeder Schritt sofort wirksam
**Status:** Partial – vollständig gebaut und geprüft, aber `0105` ist nicht eingespielt

## Preconditions

- Die Person ist Mitglied eines Vereins (UC-002, UC-003 oder UC-004).
- Die Frage wurde für diese Mitgliedschaft noch nicht beantwortet (`club_members.profile_setup_at` ist leer).

## Main Success Scenario

1. System führt die Person beim ersten Blick auf das Dashboard einmalig in den Assistenten und nennt die Zahl der Schritte.
2. System fragt nach einem Bild und sagt, wo es erscheint. Mitglied wählt eines oder geht weiter; ein gewähltes Bild ist sofort gespeichert (UC-045).
3. System fragt nach dem Namen und zeigt, was heute dasteht – beim Beitritt ist das der Teil vor dem @ der Adresse (`0010`).
4. Mitglied trägt Vor- und Nachnamen oder einen Anzeigenamen ein; ohne Anzeigenamen setzen Vor- und Nachname ihn (BR-208).
5. System fragt nach der Telefonnummer und wer sie sehen darf, und nennt die Adresse, mit der die Person angemeldet ist.
6. System fragt nach den Meldungen: Es sagt, dass die Inbox alles enthält und die E-Mail bereits läuft (täglich um 18:00), und bietet an, dieses Gerät für Push anzumelden.
7. Mitglied meldet das Gerät an; System holt die Erlaubnis des Betriebssystems und speichert die Anmeldung (UC-028 A1).
8. Mitglied wählt «Fertig».
9. System hält fest, dass gefragt wurde, und zeigt das Dashboard.

## Alternative Flows

### A1: Später

**Trigger:** Mitglied wählt «Später» (in jedem Schritt)
**Flow:**

1. System hält fest, dass gefragt wurde – der Assistent geht nicht wieder von selbst auf (BR-270).
2. Alles Erledigte bleibt erledigt; es gibt keinen gemeinsamen Speichern-Knopf am Ende.
3. Solange das Profil unangetastet ist – kein Bild und kein selbst gewählter Name –, führt eine Zeile auf dem Dashboard zurück.
4. Use case ends.

### A2: Push wird abgelehnt

**Trigger:** Mitglied lehnt die Erlaubnis des Betriebssystems ab (Schritt 7)
**Flow:**

1. System sagt, dass die Inbox weiterhin alles enthält (BR-117) – keine Fehlermeldung.
2. Der Schritt bleibt abschliessbar.
3. Use case continues at step 8.

### A3: Das Gerät kann kein Push

**Trigger:** Die Android-App oder ein Browser ohne Push-Schnittstelle (Schritt 6)
**Flow:**

1. System zeigt keinen Knopf, der nichts bewirkt, sondern den Satz, warum es hier nicht geht.
2. Use case continues at step 8.

### A4: Noch einmal hinein

**Trigger:** Mitglied öffnet den Assistenten später über das Profil oder die Dashboard-Zeile
**Flow:**

1. System zeigt dieselben vier Schritte mit dem heutigen Stand.
2. Der festgehaltene Zeitpunkt bleibt, wie er war – er sagt, wann gefragt wurde.
3. Use case ends.

### A5: Zweiter Verein

**Trigger:** Die Person tritt einem zweiten Verein bei
**Flow:**

1. Der Assistent geht dort erneut auf: Profil, Bild und Sichtbarkeit gelten je Verein (`club_members`).
2. Use case continues at step 2.

## Postconditions

- **Success:** Die Mitgliedschaft trägt `profile_setup_at`; was eingetragen wurde, steht in `club_members` bzw. `member_contacts`, das Gerät in `push_tokens`.
- **Failure:** Nichts – jeder Schritt steht für sich, und was gespeichert wurde, bleibt gespeichert.

## Business Rules

- **BR-028** Die Entscheide über das eigene Profil gehören der Person.
- **BR-031** Ein Mitglied trägt immer einen Anzeigenamen.
- **BR-208** Ohne eigenen Anzeigenamen tragen Vor- und Nachname ihn.
- **BR-214** An der eigenen Mitgliedschaftszeile ändert ein Mitglied direkt nur die Teilnahme an Ranglisten; alles andere läuft über eine Funktion mit eigener Prüfung.
- **BR-270** Der Assistent ist ein Angebot: Übersprungen **ist** eine Antwort, und er geht danach nicht mehr ungefragt auf.
- **BR-117** Die Inbox bleibt der vollständige Rückfall, unabhängig von jeder Antwort in Schritt 6.

## Related

- **UC-051** Verein einrichten – das Gegenstück für den Verein; beide nutzen dieselbe Schrittführung (`Wizard`)
- **UC-008** Profil pflegen – dieselben Felder, anderer Weg; der Assistent ersetzt ihn nicht
- **UC-045** Bilder – das Profilbild samt Upload
- **UC-028** Benachrichtigungen einstellen – die volle Matrix hinter Schritt 6
- **UC-052** Push-Meldungen zustellen – erst damit hat die Anmeldung in Schritt 7 eine Wirkung

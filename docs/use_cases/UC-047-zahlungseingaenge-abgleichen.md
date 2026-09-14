# Use Case: Zahlungseingänge aus der Bankdatei abgleichen

## Overview

**Use Case ID:** UC-047
**Use Case Name:** Zahlungseingänge aus der Bankdatei abgleichen
**Primary Actor:** Kassier:in (Vorstandsrolle)
**Goal:** Die bezahlten Rechnungen aus dem Kontoauszug der Bank verbuchen, ohne jede Zahlung von Hand zu suchen
**Status:** Implemented

> Der Gegenpart zu [UC-046](UC-046-rechnung-stellen-und-versenden.md): Dort geht
> die Forderung hinaus, hier kommt das Geld an. Erst dieser Ablauf schliesst den
> Kreis zu [UC-036](UC-036-rechnungen-einsehen.md) – die Punkte der Säule 6
> entstehen aus dem Zahlungseingang, den er verbucht (BR-157).

## Preconditions

- Der Verein hat das Modul «Rechnungen» eingeschaltet.
- Die handelnde Person gehört dem Vorstand an.
- Mindestens eine Rechnung dieses Vereins ist versendet und noch nicht bezahlt.
- Die Kassier:in hat den Kontoauszug als camt-Datei aus dem E-Banking geladen.

## Main Success Scenario

1. Kassier:in öffnet die Abrechnungsperiode und wählt «Bankdatei wählen».
2. Kassier:in wählt die camt-Datei ihres Kontos.
3. System liest die Datei auf dem Server und zeigt, welche Zahlungen darin stehen – noch ohne etwas zu verbuchen.
4. Kassier:in prüft die Liste und bestätigt das Verbuchen.
5. System ordnet jede Zahlung über ihre Zahlungsreferenz einer Rechnung **dieses Vereins** zu.
6. System setzt die zugeordneten Rechnungen auf bezahlt und hält Zahlungszeitpunkt und Einzahler fest.
7. System bucht für jede Zahlung innerhalb der Frist die Punkte der Säule 6 und benachrichtigt das Mitglied.
8. System meldet der Kassier:in, wie viele Zahlungen zugeordnet wurden, wie viele schon verbucht waren und welche Referenzen zu keiner Rechnung passen.
9. System hält den Lauf mit Dateiname und Ergebnis fest.

## Alternative Flows

### A1: Die Datei ist keine camt-Datei

**Trigger:** Der Inhalt lässt sich nicht als camt.053 oder camt.054 lesen (Schritt 3)
**Flow:**

1. System verbucht nichts und sagt, dass die Datei nicht lesbar ist.
2. Use case ends.

### A2: Eine Referenz gehört zu keiner Rechnung

**Trigger:** Eine Zahlung trägt eine Referenz, zu der dieser Verein keine Rechnung hat (Schritt 5)
**Flow:**

1. System lässt diese Zahlung unverbucht und führt sie in der Rückmeldung einzeln auf.
2. Der Lauf geht für die übrigen Zahlungen weiter; use case continues at step 6.

### A3: Die Rechnung ist bereits bezahlt

**Trigger:** Dieselbe Datei wird ein zweites Mal verbucht, oder die Bank liefert dieselbe Zahlung erneut (Schritt 6)
**Flow:**

1. System lässt die Rechnung unverändert und zählt sie als «war schon bezahlt».
2. Es entstehen keine zweiten Punkte.
3. Use case continues at step 8.

### A4: Die Datei enthält Belastungen

**Trigger:** Der Auszug führt auch Zahlungen des Vereins an Dritte (Schritt 3)
**Flow:**

1. System lässt Belastungen aus und liest nur Gutschriften.
2. Use case continues at step 4.

### A5: Zahlung nach der Frist

**Trigger:** Der Zahlungszeitpunkt liegt nach dem Fälligkeitsdatum (Schritt 7)
**Flow:**

1. System setzt die Rechnung auf bezahlt und bucht keine Punkte.
2. Es erfolgt kein Abzug und kein Vermerk am Mitglied (BR-158).
3. Use case continues at step 8.

## Postconditions

### Success Postconditions

- Jede zugeordnete Rechnung steht auf bezahlt, mit Zahlungszeitpunkt und Einzahler.
- Der Spiegel aus UC-036 zeigt dem Mitglied seine Rechnung als bezahlt.
- Zu jeder fristgerechten Zahlung existiert genau eine Punktebuchung der Säule 6.
- Der Lauf ist mit Dateiname, Trefferzahl und den nicht zugeordneten Referenzen festgehalten.

### Failure Postconditions

- Keine Rechnung wechselt ihren Stand, keine Punkte entstehen.
- Die Rückmeldung nennt den Grund.

## Business Rules

### BR-230: Die Bankdatei liest der Server

Die Datei wird serverseitig gelesen und zugeordnet. Welche Rechnung als bezahlt gilt, entscheidet nicht der Client – es ist dieselbe Klasse Entscheidung wie eine Punktebuchung.

### BR-231: Der Abgleich endet an der Vereinsgrenze

Eine Zahlungsreferenz wird ausschliesslich gegen die Rechnungen des Vereins geprüft, für den die aufrufende Person Vorstand ist. Eine Referenz eines anderen Vereins bleibt unzugeordnet.

### BR-232: Nur Gutschriften

Belastungen im Auszug sind Zahlungen des Vereins, nicht an ihn. Sie werden nicht als Zahlungseingang gelesen.

### BR-233: Erst zeigen, dann buchen

Zwischen «Datei gewählt» und «verbucht» steht ein Probelauf, der zeigt, was die Datei enthält, ohne einen Stand zu ändern.

### BR-234: Ein zweiter Lauf bucht nicht nochmals

Eine bereits bezahlte Rechnung bleibt unverändert, und es entstehen keine zweiten Punkte – auch wenn dieselbe Datei mehrmals verbucht wird.

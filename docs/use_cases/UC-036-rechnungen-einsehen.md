# Use Case: Rechnungen einsehen und Punkte bei pünktlicher Zahlung

## Overview

**Use Case ID:** UC-036
**Use Case Name:** Rechnungen einsehen und Punkte bei pünktlicher Zahlung
**Primary Actor:** Mitglied
**Goal:** Den eigenen Rechnungsstand in der App sehen und für pünktliche Zahlung gewürdigt werden
**Status:** Implemented

## Preconditions

- Der Verein hat den Rechnungsdienst aktiviert.
- Für das Mitglied besteht mindestens eine Rechnung.

## Main Success Scenario

1. Mitglied öffnet im Profil «Meine Rechnungen».
2. System zeigt je Rechnung Betrag, Fälligkeit und Status.
3. Mitglied öffnet eine offene Rechnung.
4. System öffnet die eingebettete Detailansicht des Rechnungsdienstes über eine signierte Verbindung, sodass keine erneute Anmeldung nötig ist.
5. Mitglied bezahlt die Rechnung ausserhalb der App.
6. Der Rechnungsdienst meldet der App die erfolgte Zahlung.
7. System aktualisiert den Status und bucht bei Zahlung innerhalb der Frist die Punkte der Säule 6.
8. System benachrichtigt das Mitglied über die Gutschrift.

## Alternative Flows

### A1: Erinnerung vor Fälligkeit

**Trigger:** Die Fälligkeit liegt sieben Tage in der Zukunft und die Rechnung ist offen
**Flow:**

1. System erinnert das Mitglied und nennt die Punkte, die eine fristgerechte Zahlung bringt.
2. Use case ends.

### A2: Zahlung nach Frist

**Trigger:** Die Zahlung erfolgt nach dem Fälligkeitsdatum (Schritt 7)
**Flow:**

1. System setzt den Status auf bezahlt und bucht keine Punkte.
2. Es erfolgt kein Punkteabzug und kein Vermerk am Mitglied.
3. Use case ends.

### A3: Rechnung überfällig

**Trigger:** Der Rechnungsdienst meldet Überfälligkeit
**Flow:**

1. System aktualisiert den Status auf überfällig.
2. Das Signal fliesst als Spätindikator in die Gesundheitsbetrachtung ein, sofern das Mitglied dem nicht widersprochen hat.
3. Use case ends.

### A4: Rechnungsdienst nicht aktiviert

**Trigger:** Der Verein nutzt den Rechnungsdienst nicht (Schritt 1)
**Flow:**

1. System blendet den Bereich vollständig aus.
2. Use case ends.

## Postconditions

### Success Postconditions

- Der Rechnungsstand in der App entspricht dem des Rechnungsdienstes.
- Bei fristgerechter Zahlung existiert genau eine Punktebuchung der Säule 6.

### Failure Postconditions

- Der Rechnungsstand bleibt unverändert.
- Es entsteht keine Punktebuchung.

## Business Rules

### BR-156: Die App kennt nur den Spiegel

Zu einer Rechnung kennt die App Betrag, Fälligkeit, Status und einen Link. Positionen, Referenzen und Bankdaten bleiben im Rechnungsdienst.

### BR-157: Punkte nur bei Zahlung innerhalb der Frist

Die Punkte der Säule 6 entstehen, wenn der Zahlungszeitpunkt nicht nach dem Fälligkeitsdatum liegt.

### BR-158: Keine Sanktion bei Verzug

Verzug führt weder zu Punkteabzug noch zu einer automatischen Massnahme. Er ist ein Anlass für Kontakt, mehr nicht.

### BR-159: Ein Login für beides

Der Übergang in die eingebettete Ansicht erfolgt ohne erneute Anmeldung über ein signiertes Token.

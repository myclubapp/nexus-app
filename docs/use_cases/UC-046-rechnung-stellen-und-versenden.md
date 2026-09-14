# Use Case: Rechnung stellen und mit QR-Einzahlungsschein versenden

## Overview

**Use Case ID:** UC-046
**Use Case Name:** Rechnung stellen und mit QR-Einzahlungsschein versenden
**Primary Actor:** Kassier:in (Vorstandsrolle)
**Goal:** Für die Mitglieder einer Abrechnungsperiode Rechnungen mit Schweizer QR-Einzahlungsschein erzeugen und zustellen, ohne die App zu verlassen
**Status:** Implemented

> **Abgrenzung zum MVP-Schnitt:** `MVP_Scope_myclub.md` §3 lagerte die
> Rechnungsstellung in einen eigenständigen Dienst («myclub Billing») aus.
> Am 14.09.2026 ist anders entschieden worden: Der Dienst läuft **in nexus**,
> die Rechnungslogik der bisherigen myclub-App wird hier nachgebaut. UC-036
> bleibt unverändert die Sicht des Mitglieds – neu ist nexus zugleich die
> Quelle, die den Spiegel füllt.

## Preconditions

- Der Verein hat das Modul «Rechnungen» eingeschaltet.
- Die handelnde Person gehört dem Vorstand an.
- Die Gläubigerangaben des Vereins sind vollständig hinterlegt: QR-IBAN, Name und Adresse.
- Für die zu verrechnenden Mitglieder ist ein Beitrag hinterlegt – am Team oder als Position des Vereins.

## Main Success Scenario

1. Kassier:in öffnet in der Verwaltung «Rechnungen».
2. System zeigt die Abrechnungsperioden des Vereins, je Periode die Zahl der Entwürfe, versendeten und bezahlten Rechnungen.
3. Kassier:in legt eine Abrechnungsperiode an und benennt sie, setzt das Fälligkeitsdatum und den Zweck, der auf der Rechnung erscheint.
4. Kassier:in wählt die Mitglieder, für die in dieser Periode Rechnungen entstehen sollen.
5. System schlägt je Mitglied die Positionen vor: den Beitrag des Teams, dem es angehört, und die Zuschläge und Abzüge des Vereins.
6. Kassier:in passt die Positionen an und bestätigt die Auswahl.
7. System erzeugt je Mitglied einen Rechnungsentwurf mit Positionen, Betrag, Währung und einer einmaligen Zahlungsreferenz samt Prüfziffer.
8. Kassier:in prüft die Entwürfe und löst den Versand aus.
9. System erzeugt je Rechnung ein PDF mit Schweizer QR-Einzahlungsschein, Vereinslogo, beiden Adressen und der Aufstellung der Positionen und legt es im Vereinsspeicher ab.
10. System stellt jedem Mitglied die Rechnung per E-Mail mit dem PDF im Anhang zu und meldet sie ihm zusätzlich in der App.
11. System setzt den Stand der Rechnung auf versendet und schreibt Betrag, Fälligkeit, Stand und den Link in den Rechnungsspiegel, aus dem das Mitglied sie sieht (UC-036).
12. System zeigt der Kassier:in den Stand der Periode: wie viele Rechnungen versendet sind und welcher Betrag offen ist.

> Die Rechnung – Blatt wie Begleitmail – erscheint in der Sprache der Person, nicht in der des Vereins.

## Alternative Flows

### A1: Gläubigerangaben fehlen oder die QR-IBAN ist ungültig

**Trigger:** Beim Auslösen des Versands sind QR-IBAN, Name oder Adresse des Vereins unvollständig oder die Prüfung der QR-IBAN schlägt fehl (Schritt 8)
**Flow:**

1. System versendet nichts und nennt das fehlende oder fehlerhafte Feld.
2. System führt die Kassier:in zu den Gläubigerangaben des Vereins.
3. Die Entwürfe bleiben unverändert bestehen; use case continues at step 8.

### A2: Adresse des Mitglieds unvollständig

**Trigger:** Beim Erzeugen des PDF fehlen Strasse, Ort oder Postleitzahl des Mitglieds (Schritt 9)
**Flow:**

1. System erzeugt die Rechnung trotzdem und vermerkt auf dem PDF und in der E-Mail, dass die Adresse zu ergänzen ist.
2. System weist die Kassier:in nach dem Lauf auf die betroffenen Mitglieder hin.
3. Use case continues at step 10.

### A3: Zustellung misslingt

**Trigger:** Das Mitglied hat keine hinterlegte E-Mail-Adresse oder der Versand scheitert (Schritt 10)
**Flow:**

1. System hält die Rechnung im Stand versendet und vermerkt die misslungene Zustellung.
2. System stellt der Kassier:in das PDF zum Herunterladen bereit, damit sie die Rechnung auf Papier zustellen kann.
3. Die Meldung in der App erfolgt unverändert; use case continues at step 11.

### A4: Entwurf verwerfen

**Trigger:** Ein Entwurf ist falsch oder überflüssig (Schritt 8)
**Flow:**

1. Kassier:in verwirft den Entwurf.
2. System entfernt ihn; seine Zahlungsreferenz wird kein zweites Mal vergeben.
3. Use case continues at step 8.

### A5: Versendete Rechnung stornieren

**Trigger:** Eine bereits versendete, noch nicht bezahlte Rechnung ist falsch (nach Schritt 11)
**Flow:**

1. Kassier:in storniert die Rechnung und gibt den Grund an.
2. System setzt den Stand auf storniert, nimmt sie aus dem offenen Betrag und meldet die Stornierung dem Mitglied.
3. Eine Korrektur entsteht als neue Rechnung mit eigener Zahlungsreferenz; use case ends.

### A6: Kein Beitrag hinterlegt

**Trigger:** Für ein gewähltes Mitglied schlägt das System keine einzige Position vor (Schritt 5)
**Flow:**

1. System überspringt dieses Mitglied und nennt es der Kassier:in.
2. Der Lauf geht für die übrigen Mitglieder weiter; use case continues at step 6.

### A8: An eine offene Rechnung erinnern

**Trigger:** Eine versendete Rechnung ist über ihre Fälligkeit hinaus offen (nach Schritt 12)
**Flow:**

1. Kassier:in erinnert an eine einzelne Rechnung oder an alle überfälligen der Periode.
2. System benachrichtigt die betroffenen Mitglieder mit Betrag und Fälligkeit und hält fest, wann und wie oft erinnert wurde.
3. An eine Rechnung, an die diese Woche schon erinnert wurde, geht keine zweite Erinnerung; System nennt die Zahl der tatsächlich verschickten.
4. Use case ends.

### A7: Modul nicht eingeschaltet

**Trigger:** Der Verein nutzt das Modul «Rechnungen» nicht (Schritt 1)
**Flow:**

1. System blendet den Bereich vollständig aus.
2. Use case ends.

## Postconditions

### Success Postconditions

- Zu jedem gewählten Mitglied besteht in dieser Periode genau eine Rechnung im Stand versendet, mit einmaliger Zahlungsreferenz.
- Das PDF mit QR-Einzahlungsschein liegt im Vereinsspeicher und ist über einen befristeten Link erreichbar.
- Das Mitglied hat die Rechnung per E-Mail erhalten und sieht sie in «Meine Rechnungen» (UC-036).
- Der offene Betrag der Periode entspricht der Summe der versendeten, noch nicht bezahlten Rechnungen.
- Es entsteht keine Punktebuchung.

### Failure Postconditions

- Kein Entwurf wird zur Rechnung, keine Zahlungsreferenz ist vergeben, kein PDF liegt im Speicher, keine E-Mail ist unterwegs.
- Bricht der Lauf mitten im Versand ab, bleibt je Rechnung erkennbar, ob sie versendet ist; keine Rechnung wird zweimal versendet.
- Die Abrechnungsperiode bleibt im bisherigen Stand.

## Business Rules

### BR-220: Die Rechnung entsteht auf dem Server

Rechnung, Zahlungsreferenz und PDF erzeugt eine Serverfunktion. Der Client löst den Lauf aus und zeigt sein Ergebnis; er berechnet weder Beträge noch Referenzen.

### BR-221: Die Zahlungsreferenz trägt ihre Prüfziffer

Die QR-Referenz besteht aus 26 Stellen und einer Prüfziffer nach Modulo 10 rekursiv. Sie ist je Rechnung einmalig, wird nach dem Verwerfen einer Rechnung nicht wiederverwendet und ändert sich nie.

### BR-222: Ohne gültige Gläubigerangaben kein Versand

Eine Rechnung verlässt den Verein nur mit geprüfter QR-IBAN sowie Name und Adresse des Vereins. Fehlt etwas, bleibt der Lauf im Entwurf – ein Einzahlungsschein, den keine Bank annimmt, ist schlimmer als keiner.

### BR-223: Eine unvollständige Schuldneradresse hält den Versand nicht auf

Fehlen Angaben zur Person, wird die Rechnung dennoch gestellt und trägt den Hinweis, das Profil zu ergänzen. Der Beitrag ist geschuldet, auch wenn die Adresse lückenhaft ist.

### BR-224: Entwurf und Versand sind zwei Schritte

Erzeugte Rechnungen sind zuerst Entwürfe: änderbar und verwerfbar. Mit dem Versand werden sie unveränderlich; eine Korrektur entsteht als Stornierung und neue Rechnung, nie als Änderung am Versendeten.

### BR-225: Das PDF liegt im Vereinsspeicher

Die Rechnung wird einmal erzeugt und abgelegt, nicht bei jedem Öffnen neu gerechnet. Der Zugriff läuft über eine befristete Adresse; das Dokument ist nicht öffentlich lesbar.

### BR-226: Der Spiegel bleibt der Weg zum Mitglied

Auch wenn der Rechnungsdienst in nexus läuft, sieht das Mitglied seine Rechnung über den Spiegel aus UC-036 – Betrag, Fälligkeit, Stand und Link. Ein Entwurf erscheint dort nicht; sichtbar wird eine Rechnung mit dem Versand.

### BR-227: Das Stellen einer Rechnung bucht keine Punkte

Punkte der Säule 6 entstehen ausschliesslich bei Zahlung innerhalb der Frist (BR-157). Weder der Versand noch eine Erinnerung verändern den Punktestand.

### BR-228: Der Betrag ist die Summe seiner Positionen

Jede Rechnung führt ihre Positionen mit Bezeichnung und Betrag. Der Rechnungsbetrag ist deren Summe in einer Währung; ein frei gesetzter Gesamtbetrag ohne Positionen entsteht nicht.

### BR-236: Eine Erinnerung je Woche und Rechnung

Eine Erinnerung ist ein Hinweis, kein Mahnlauf. Zur selben Rechnung geht höchstens eine je Woche hinaus – auch wenn zwei Vorstandsmitglieder gleichzeitig nachfassen. Sie nennt Betrag und Fälligkeit, keine Gebühr und keine Folge (BR-158).

### BR-235: Eine bezahlte Rechnung wird nicht storniert

Ist das Geld eingegangen, ist der Vorgang abgeschlossen: Die Rechnung bleibt bezahlt, die Punkte bleiben gebucht, und das Mitglied behält sie in seiner Übersicht. Eine Rückerstattung ist ein Zahlungsvorgang und findet ausserhalb der App statt.

### BR-229: Rechnungen stellt nur der Vorstand

Die Berechtigung wird serverseitig geprüft. Trainer:innen stellen keine Rechnungen, auch nicht für das eigene Team – der Beitrag ist Sache des Vereins, nicht der Mannschaft.

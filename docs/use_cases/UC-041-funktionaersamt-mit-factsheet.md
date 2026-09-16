# Use Case: Funktionärsamt mit Factsheet hinterlegen und im Marktplatz anbieten

## Overview

**Use Case ID:** UC-041
**Use Case Name:** Funktionärsamt mit Factsheet hinterlegen und im Marktplatz anbieten
**Primary Actor:** Vorstand
**Goal:** Die Ämter des Vereins mit Pflichtenheft, Aufwand, Punktwert, Ansprechperson und Factsheet-PDF so hinterlegen, dass Interessierte wissen, worauf sie sich einlassen – und dass vakante Ämter im Marktplatz sichtbar sind
**Status:** Implemented

## Preconditions

- Der Verein existiert.
- Die Person hat im Verein die Rolle admin.
- Für das Ansehen (Schritte 8–10) genügt die Mitgliedschaft.
- Ausgeben und Einlesen der Beschreibung (A7, A8) setzen die Rolle admin voraus.

## Main Success Scenario

1. Vorstand öffnet die Ämterliste und wählt «Amt anlegen».
2. System zeigt das Formular: Bezeichnung, Warum, Pflichtenheft, Aufwand pro Saison, Helferpunkte, Anzahl Sitze, Besetzung, Ansprechperson und Factsheet-PDF.
3. Vorstand füllt die Angaben aus und trägt die Personen ein, die das Amt tragen – mit Namen; ein Mitglied wählt er, sobald die Person ein Konto hat.
4. Vorstand wählt ein PDF als Factsheet.
5. Vorstand speichert.
6. System legt das Amt samt Besetzung an, lädt das PDF in den Vereinsspeicher und zeigt das Amt in der Ämterliste.
7. System rechnet die Vakanz: Sitze minus Personen, die das Amt ordentlich tragen.
8. Mitglied öffnet den Marktplatz und sieht im Abschnitt «Ämter zu vergeben» jedes Amt mit freien Sitzen, die grösste Lücke zuoberst.
9. Mitglied tippt ein Amt an und liest Pflichten, Eckdaten, Besetzung und Ansprechperson.
10. Mitglied öffnet das Factsheet-PDF.

## Alternative Flows

### A1: Inhaber:in ad interim

**Trigger:** Eine Person trägt das Amt nur vorübergehend (Schritt 3)
**Flow:**

1. Vorstand markiert die Person als «ad interim».
2. System zeigt die Person in der Besetzung, zählt den Sitz aber weiterhin als frei.
3. Use case continues at step 5.

### A2: Amt ohne Factsheet

**Trigger:** Es gibt noch kein PDF (Schritt 4)
**Flow:**

1. Vorstand speichert ohne Datei.
2. System zeigt das Amt ohne den Knopf «Factsheet öffnen»; die Angaben aus Schritt 3 stehen trotzdem.
3. Use case continues at step 7.

### A3: Factsheet ersetzen oder entfernen

**Trigger:** Vorstand öffnet ein bestehendes Amt zum Bearbeiten (Schritt 1)
**Flow:**

1. System zeigt das Formular mit dem gespeicherten Stand und dem Hinweis, dass ein Factsheet hinterlegt ist.
2. Vorstand wählt ein neues PDF oder entfernt das bestehende.
3. System überschreibt beziehungsweise löscht die Datei im Vereinsspeicher und passt das Amt an.
4. Use case continues at step 7.

### A4: Mitglied tritt aus

**Trigger:** Eine Person, die ein Amt als Mitglied trägt, verlässt den Verein
**Flow:**

1. System löst die Verknüpfung zum Konto; der Name bleibt in der Besetzung stehen.
2. Der Verteiler für Sitzungs-Inputs (UC-031) erreicht die nächste verknüpfte Inhaber:in – oder niemanden, bis der Vorstand die Nachfolge einträgt.
3. Use case ends.

### A5: Passende Vakanz

**Trigger:** Das Beitrags-Profil des Mitglieds nennt Organisation oder Finanzen (UC-033)
**Flow:**

1. System markiert das Amt im Marktplatz zusätzlich mit «Passt zu dir».
2. Use case continues at step 9.

### A6: Datei nicht zulässig

**Trigger:** Die gewählte Datei ist kein PDF oder grösser als 10 MB (Schritt 4)
**Flow:**

1. System nennt den Grund und behält die vorherige Wahl.
2. Use case continues at step 4.

### A7: Beschreibung als Datei in die Vereinsablage

**Trigger:** Die Beschreibung soll auch ausserhalb der App liegen – auf Drive, in SharePoint, im Ordner des Präsidiums (nach Schritt 6)
**Flow:**

1. Vorstand wählt am Amt «Beschreibung exportieren» – oder in der Ämterliste «Alle Beschreibungen exportieren».
2. System schreibt Warum, Pflichten, Eckdaten und Besetzung als Markdown-Datei und gibt sie heraus: auf dem Gerät ins Teilen-Blatt, im Browser als Download.
3. Vorstand legt die Datei in der Ablage des Vereins ab.
4. Use case ends.

### A8: Beschreibung aus einer Datei einlesen

**Trigger:** Eine Beschreibung ist ausserhalb der App entstanden oder dort geändert worden (statt Schritt 1)
**Flow:**

1. Vorstand lädt bei Bedarf die leere Vorlage herunter und füllt sie aus.
2. Vorstand wählt «Beschreibungen einlesen» und die Datei.
3. System ordnet jedes Amt der Datei zu – über die Kennung in der Datei, sonst über die Bezeichnung – und zeigt je Amt, ob es angelegt oder geändert wird und welche Angaben sich ändern.
4. Vorstand wählt ab, was nicht mitgehen soll, und bestätigt.
5. System speichert jedes gewählte Amt auf demselben Weg wie das Formular (`save_office()`).
6. Use case continues at step 7.

### A8a: Die Datei meint kein bestimmtes Amt

**Trigger:** Die Datei trägt keine Kennung, und zwei Ämter heissen gleich – ein Co-Präsidium ist genau das (Schritt 3 von A8)
**Flow:**

1. System markiert den Eintrag, nennt den Grund und lässt ihn liegen; die übrigen Einträge bleiben wählbar.
2. Use case continues at step 4 von A8.

### A8b: Die Datei enthält keine Beschreibung

**Trigger:** Die gewählte Datei ist etwas anderes – eine Notiz, ein leeres Blatt (Schritt 2 von A8)
**Flow:**

1. System sagt, dass keine Ämterbeschreibung darin steht, und nennt den Anfang einer solchen («# Bezeichnung des Amtes»).
2. Es wird nichts gespeichert. Use case ends.

### A9: Punkte fürs Amt gutschreiben

**Trigger:** Ein Quartal der Saison ist angebrochen, oder der Vorstand hat gerade einen Punktwert gesetzt oder eine Inhaber:in verknüpft
**Flow:**

1. System schreibt jeder Inhaber:in mit verknüpftem Konto ein Viertel des Saisonwerts ihres Amtes gut – für jedes fällige Quartal der laufenden Saison, das noch offen ist.
2. Die Buchung geht über die Regel «Amt ausgeübt» (Säule 7) und trägt die Amtszeit als Quelle; das Mitglied bekommt eine Meldung.
3. Das geschieht jede Nacht von selbst. Der Vorstand kann es auf der Ämterseite sofort auslösen, ohne bis zum nächsten Lauf zu warten.
4. Ein zweiter Lauf bucht nichts nach; die Antwort lautet dann «war schon gutgeschrieben».

## Postconditions

### Success Postconditions

- Das Amt existiert mit Bezeichnung, Pflichten, Aufwand, Punktwert, Sitzen, Besetzung und Ansprechperson.
- Das Factsheet liegt im Vereinsspeicher unter dem Ordner des Vereins; Mitglieder öffnen es über eine signierte Adresse.
- Hat das Amt freie Sitze, steht es im Marktplatz unter «Ämter zu vergeben», in der Sitzungsagenda unter den Dauerthemen (UC-031) und im Nachfolge-Vorlauf des Vorstands (UC-024).
- Die Beschreibung lässt sich als Markdown-Datei ablegen und unverändert wieder einlesen: Was herausgeht, kommt als dasselbe Amt zurück.

### Failure Postconditions

- Es entsteht kein halbes Amt: Amt und Besetzung werden in einer Transaktion gespeichert.
- Schlägt der Upload fehl, bleibt das Amt ohne Factsheet und das Formular nennt den Fehler.
- Bricht das Einlesen mitten in einer Reihe von Ämtern ab, bleibt stehen, was schon gespeichert ist; das Blatt sagt, wie weit es kam, statt einen Erfolg zu behaupten.

## Business Rules

### BR-183: Vakanz ist eine Sitzrechnung

Ein Amt ist vakant, wenn es mehr Sitze hat als Personen, die es ordentlich tragen. «Ad interim» zählt nicht als besetzt. Die Rechnung steht einmal (`office_open_seats()`), und jede Anzeige – Marktplatz, Sitzungsagenda, Beitrags-Matching, Nachfolge-Vorlauf, Reaktionszeiten des Vorstands – verwendet sie.

### BR-184: Eine Inhaber:in braucht kein Konto

Die Besetzung führt Personen mit Namen. Ein Konto ist nicht Voraussetzung; die Verknüpfung kommt, wenn die Person beitritt. Sonst liesse sich ein Verein, dessen Vorstand als Erster beitritt, nicht abbilden.

### BR-185: Der Verteiler folgt der Besetzung

Der Verteiler für Sitzungs-Inputs (BR-133) wird aus der Besetzung abgeleitet – die erste verknüpfte Inhaber:in, ordentliche vor «ad interim». Er ist nicht direkt schreibbar, damit es keine zwei Wahrheiten über dieselbe Person gibt.

### BR-186: Das Factsheet gehört dem Verein

Das PDF liegt im Vereinsspeicher unter dem Ordner des Vereins. Lesen dürfen Mitglieder, schreiben der Vorstand – geprüft in den Storage-Policies über den Ordner im Pfad, nicht im Client.

### BR-255: Die Beschreibung ist lesbar, die Kennung unsichtbar

Die Datei ist gewöhnliches Markdown: Überschriften für Warum, Pflichten,
Eckdaten und Besetzung, die Eckdaten als Aufzählung. Kein YAML-Kopf – er
stünde in der Vorschau von Drive als Rohtext über dem Blatt. Die einzige
Maschinenangabe ist die Kennung des Amtes in einem HTML-Kommentar; sie ordnet
eine zurückkommende Datei dem Amt zu, auch wenn es inzwischen anders heisst,
und keine Ansicht zeigt sie. Geschrieben wird in der Sprache der App, gelesen
werden alle vier – sonst liesse ein Verein, der auf Französisch umstellt, seine
Ablage hinter sich. Fehlt die Kennung und tragen zwei Ämter dieselbe
Bezeichnung, wird nicht geraten (A8a).

### BR-256: Einlesen ergänzt und ändert, es leert nie

Ein Abschnitt, der in der Datei fehlt oder leer bleibt, ist keine Aussage: Was
er beschreibt, bleibt unverändert. Ein Amt, das die Datei nicht nennt, bleibt
unberührt. Gelöscht wird nur in der App. Ohne diese Regel nähme ein Auszug aus
der Vereinsablage – etwa nur das überarbeitete Pflichtenheft – die Besetzung
mit, die gar nicht darin steht.

### BR-264: Die Amtsgutschrift läuft von selbst, quartalsweise

Eine Mechanik ohne Auslöser ist keine Mechanik: `0091` hat die Gutschrift gebaut, und bis zum 15.09.2026 stand keine einzige Buchung im Ledger, weil niemand sie rief. Sie hängt deshalb an einem nächtlichen Lauf und zusätzlich an einem Knopf für den Vorstand.

Gebucht wird **quartalsweise**, nicht am Saisonende – sonst stünde eine Juniorentrainerin acht Monate lang auf null, die Ampel löge und das Säumnis-Signal zählte sie mit. Der Lauf zieht alle fälligen Quartale der laufenden Saison nach: Ein ausgefallener Cron darf keinen dauerhaften Verlust bedeuten, und der erste Lauf trifft eine Saison, die schon läuft. Ab wann gebucht wird, entscheidet das «seit»-Datum am Sitz; ohne Datum gilt die ganze Saison.

Eine Gutschrift setzt beides voraus: einen Punktwert am Amt (BR-206) **und** ein verknüpftes Konto am Sitz (BR-184). Fehlt eines, passiert nichts – das ist kein Fehler, sondern der Normalfall für ein Amt, über das der Vorstand noch nicht entschieden hat. Der Knopf nennt darum die Zahl der buchbaren Sitze, damit «0 gutgeschrieben» nicht wie ein Fehlschlag aussieht.

## Notes

- Gezogen aus `MVP_Scope` §2.3 («Ausbaustufe 2 des Marktplatzes») am 12.09.2026 auf Sandros Auftrag: Die Factsheets seines Vereins liegen unter `docs/marktplatz/97_Funktionäre/`; `build_factsheets.py` erzeugt daraus die fehlenden PDFs und das Import-SQL.
- Der Punktwert steht als Beschriftung («4 + Lohn»), nicht als Zahl. Eine Gutschrift in App-Punkten am Saisonende (Konzept §4.3) ist eine eigene Punktequelle und nicht Teil dieses Use Cases.
- A7/A8 kamen am 15.09.2026 auf Sandros Auftrag dazu: Die Ämterbeschreibungen sollen nicht nur in der App liegen, sondern auch in der Vereinsverwaltung auf Drive. Das Format steht in `app/src/lib/officeMarkdown.ts`, der Weg der Datei in `app/src/lib/fileExport.ts` – derselbe wie beim CSV-Export (UC-042, UC-043).
- Kein zusätzlicher Schreibweg in der Datenbank: Das Einlesen geht durch `save_office()` und `set_office_points()` wie das Formular. Eine Datei ist damit kein Weg an der Rollenprüfung vorbei.
- Das Factsheet-PDF bleibt aussen vor – es ist eine Binärdatei und liegt ohnehin schon als Datei vor. Ebenso die Zuordnung zu Konten: Die Datei führt Namen, die Verknüpfung entsteht beim Einlesen über den Namen, wenn genau ein Mitglied so heisst.
- Offen: ein Verteiler an **alle** verknüpften Inhaber:innen eines Amtes (heute: eine Person je Amt, wie seit UC-031).

# Use Case: Verbands-Team verknüpfen oder importieren

## Overview

**Use Case ID:** UC-039
**Use Case Name:** Verbands-Team verknüpfen oder importieren
**Primary Actor:** Vorstand
**Goal:** Die Teams des Vereins mit den Teams des verbundenen Verbands zusammenführen, damit Spielpläne und Verbandsangaben von selbst am richtigen Team landen
**Status:** Implemented

## Preconditions

- Der Verein existiert (UC-001).
- Die Person hat im Verein die Rolle admin.
- Der Verein hat seinen Verband verbunden und die Verbindung steht auf aktiv (UC-035).

## Main Success Scenario

1. Vorstand öffnet in der Mitgliederverwaltung «Team anlegen» oder ein bestehendes Team zum Bearbeiten.
2. System zeigt das Teamformular. Weil eine aktive Verbandsverbindung besteht, enthält es zusätzlich den Abschnitt «Verbands-Team».
3. Vorstand wählt «Teams des Verbands laden».
4. System holt über den hinterlegten Schlüssel die Teams des Vereins beim Verband und zeigt sie als Auswahlliste mit Name und Liga. Bereits verknüpfte Verbands-Teams sind als solche gekennzeichnet und nicht erneut wählbar.
5. Vorstand wählt das passende Verbands-Team.
6. System übernimmt Grundname und Liga in das Formular und stellt ein Feld für den vereinseigenen Zusatz bereit.
7. Vorstand ergänzt den Zusatz, wenn das Team bei ihm anders heisst, und speichert.
8. System legt das Team an oder aktualisiert es, hält Verband, Verbands-Kennung des Teams und den Zeitpunkt der Verknüpfung fest und meldet, welches Verbands-Team nun am Team hängt.
9. System holt sofort die Spiele dieses Verbands-Teams beim Verband und legt sie als Termine vom Typ «Spiel» in der Agenda an, dem verknüpften Team zugeordnet, und meldet, wie viele Spiele in der Agenda stehen. Der turnusgemässe Abgleich führt sie danach nach.

## Alternative Flows

### A1: Mehrere Teams auf einmal übernehmen

**Trigger:** Vorstand wählt in der Vereinsverwaltung «Teams aus dem Verband übernehmen» (statt Schritt 1)
**Flow:**

1. System holt die Teams des Vereins beim Verband und zeigt sie mit dem, was es vorschlägt: bereits verknüpft, neu anzulegen, oder Vorschlag zur Zuordnung zu einem gleichnamigen bestehenden Team.
2. Vorstand wählt aus, welche Teams übernommen werden, und bestätigt.
3. System legt die fehlenden Teams an, verknüpft die ausgewählten und meldet, wie viele angelegt und wie viele verknüpft wurden.
4. Use case continues at step 9.

### A2: Kein Verband verbunden

**Trigger:** Es besteht keine aktive Verbandsverbindung (Schritt 2)
**Flow:**

1. System zeigt den Abschnitt «Verbands-Team» nicht, sondern einen Hinweis mit dem Weg zu «Verband verbinden» (UC-035).
2. Vorstand legt das Team mit Namen an; es bleibt ein Team ohne Verbandsbezug.
3. Use case ends.

### A3: Verbands-Team schon vergeben

**Trigger:** Das gewählte Verbands-Team hängt bereits an einem anderen Team des Vereins (Schritt 5)
**Flow:**

1. System speichert die Verknüpfung nicht und nennt das Team, an dem sie hängt.
2. Use case continues at step 5.

### A4: Verband antwortet nicht

**Trigger:** Der Abruf der Teamliste schlägt fehl oder der Schlüssel wird abgewiesen (Schritt 4)
**Flow:**

1. System zeigt die Fehlermeldung der Verbandsschnittstelle und den Weg zur Verbindung.
2. Das Teamformular bleibt bedienbar; der Vorstand kann das Team ohne Verknüpfung speichern und sie später nachtragen.
3. Use case ends.

### A5: Verknüpfung lösen

**Trigger:** Vorstand wählt am Team «Verknüpfung lösen»
**Flow:**

1. System entfernt Verband und Verbands-Kennung am Team; der zuletzt bekannte Name bleibt als Teamname stehen.
2. Bereits importierte Termine bleiben bestehen und werden nicht mehr abgeglichen.
3. Use case ends.

### A6: Verbands-Team fällt weg

**Trigger:** Ein verknüpftes Team taucht beim Abgleich nicht mehr in der Verbandsliste auf, etwa nach einem Saisonwechsel
**Flow:**

1. System behält Team und Verknüpfung, vermerkt sie als veraltet und benachrichtigt den Vorstand.
2. Es werden keine Termine mehr für dieses Team importiert; bestehende bleiben.
3. Vorstand verknüpft das Team mit dem Team der neuen Saison oder löst die Verknüpfung (A5).
4. Use case ends.

### A7: Spielplan nach dem Verknüpfen nicht abrufbar

**Trigger:** Der Abruf der Spiele schlägt unmittelbar nach dem Verknüpfen fehl, etwa weil der Verband nicht antwortet (Schritt 9)
**Flow:**

1. System behält die Verknüpfung – sie ist gespeichert, nur die Spiele fehlen noch.
2. System meldet, dass die Spiele mit dem nächsten Abgleich kommen, und nennt die Meldung des Verbands. Am Team steht bis dahin «Noch kein Abgleich».
3. Der turnusgemässe Abgleich holt die Spiele nach.
4. Use case ends.

## Postconditions

### Success Postconditions

- Das Team trägt Verband und Verbands-Kennung; ein Verbands-Team ist im Verein höchstens einem Team zugeordnet.
- Der Teamname besteht aus dem Grundnamen des Verbands und dem Zusatz des Vereins.
- Die Spiele dieses Teams stehen in der Agenda; der turnusgemässe Abgleich führt sie nach. Der Zeitpunkt «Letzter Abgleich» am Team stammt vom Abruf der Spiele, nicht vom Verknüpfen.

### Failure Postconditions

- Am Team ist keine Verknüpfung gespeichert.
- Es wurde kein Termin importiert; ein ohne Verknüpfung angelegtes Team bleibt unverändert bestehen.

## Business Rules

### BR-175: Eine Verknüpfung, ein Team

Ein Verbands-Team ist innerhalb eines Vereins höchstens einem Team zugeordnet, ein Team höchstens einem Verbands-Team. Die Zuordnung ist jederzeit lösbar (A5).

### BR-176: Der Verband pflegt den Grundnamen, der Verein den Zusatz

Der Abgleich überschreibt ausschliesslich den Grundnamen und die Verbandsangaben wie Liga. Der Zusatz des Vereins überlebt jeden Abgleich; angezeigt wird die Verbindung aus beidem.

### BR-177: Ohne aktive Verbindung keine Auswahl

Die Auswahlliste entsteht aus dem Schlüssel des Vereins (BR-151). Es gibt kein Verzeichnis fremder Vereine und keine Suche über Vereinsgrenzen hinweg.

### BR-178: Der Schlüssel bleibt auf dem Server

Die Teamliste holt eine Serverfunktion mit dem im Tresor abgelegten Schlüssel. Der Client erhält Namen und Kennungen, nie den Schlüssel (BR-153).

### BR-179: Die Verknüpfung berührt Mitglieder und Punkte nicht

Team-Zuordnungen, Rollen und der Punkte-Ledger bleiben unverändert. An den Verband geht nichts zurück (BR-154).

### BR-180: Importierte Termine gehören dem Verband, Ergänzungen dem Verein

Zeit, Ort, Gegner und Resultat eines importierten Termins kommen vom Verband und werden bei jedem Abgleich überschrieben. Nennt der Verband zum Ort auch die Lage (swiss unihockey: Koordinaten der Halle), gehört sie ebenso ihm: Das Termin-Detail zeigt sie als Karte auf swisstopo-Kacheln (C-006) und bietet die Route in der Navigation des Geräts an; ein Termin ohne Lage hat keine Karte. Das Detail nennt den Verband beim Namen («Spiel · Swiss Unihockey»), nicht als «vom Verband» – ein Verein kann an zwei Verbänden hängen. Was der Verein ergänzt – Treffpunkt, Abfahrt, Hinweis – bleibt erhalten. In allem anderen ist ein importierter Termin ein Termin wie jeder andere: Zu- und Absage, Erinnerung und Check-in gelten unverändert.

### BR-181: Ein gelöster Verband löscht nichts

Weder das Lösen einer Verknüpfung noch das Trennen der Vereinsverbindung entfernt bereits importierte Teams oder Termine. Sie veralten, sie verschwinden nicht.

## Abgrenzung

Nicht Teil dieses Anwendungsfalls: die Meisterschafts-Sicht je Team mit Spielplan, Resultaten und
Tabelle. Sie bleibt FR-128 (`Deferred`). Entschieden ist ihre Form: importierte Spiele stehen wie
alle Termine in der Agenda, die Tabellen- und Resultatsicht entsteht zusätzlich am Team.

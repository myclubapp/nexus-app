# Use Case: News von der Vereins-Website übernehmen

## Overview

**Use Case ID:** UC-038
**Use Case Name:** News von der Vereins-Website übernehmen
**Primary Actor:** Vorstand
**Goal:** Die bestehenden Beiträge der Vereins-Website in den Feed holen und dort aktuell halten
**Status:** In Progress

## Preconditions

- Der Verein existiert (UC-001).
- Die Person hat im Verein die Rolle admin.
- Der Verein betreibt eine Website mit WordPress.

## Main Success Scenario

1. Vorstand wählt auf dem Startbildschirm «News von eurer Website holen» oder öffnet die Ansicht aus der Vereinsverwaltung.
2. System fragt nach der Adresse der Website, nennt WordPress als Voraussetzung und erklärt, was übernommen wird.
3. Vorstand gibt die Adresse ein; die Eingabe des blossen Domainnamens genügt.
4. System zeigt die geprüfte Adresse an, mit der es die Website abfragen wird.
5. Vorstand wählt «Website prüfen».
6. System ruft die Schnittstelle der Website ab und meldet, was es gefunden hat: den Namen der Website, die Zahl der veröffentlichten Beiträge und die vorhandenen Kategorien.
7. Vorstand stellt ein, wie viele Beiträge übernommen werden, und wählt bei Bedarf einzelne Kategorien; ohne Auswahl kommen die Beiträge aller Kategorien.
8. Vorstand bestätigt mit «Beiträge holen».
9. System ruft die WordPress-Schnittstelle im eingestellten Umfang ab und übernimmt die Beiträge mit Titel, Anrisstext, Volltext, Beitragsbild, Autorin oder Autor und Datum.
10. System speichert die Website samt Einstellungen als Quelle des Vereins und meldet, wie viele Beiträge übernommen wurden.
11. System zeigt die Beiträge im News-Feed mit dem Anriss; das Detail zeigt den ganzen Artikel mit Absätzen und Bildern, und jeder Beitrag verlinkt zusätzlich auf die Website.
12. System gleicht die Quelle ab jetzt jede Nacht selbsttätig im selben Umfang ab.

## Alternative Flows

### A1: Adresse ohne WordPress-Schnittstelle

**Trigger:** Unter der Adresse antwortet keine WordPress-Schnittstelle (Schritt 6)
**Flow:**

1. System meldet, dass unter dieser Adresse keine WordPress-Schnittstelle antwortet, und nennt, was die Website stattdessen zurückgegeben hat.
2. System speichert keine Quelle und übernimmt keinen Beitrag.
3. Use case continues at step 3.

### A2: Website antwortet nicht

**Trigger:** Der Abruf läuft in ein Zeitlimit oder wird abgewiesen (Schritt 9 oder nächtlicher Abgleich)
**Flow:**

1. System hält den Fehler an der Quelle fest und zeigt ihn in der Ansicht.
2. Die App bleibt vollständig nutzbar; nur die Website-Beiträge fehlen oder veralten.
3. Use case ends.

### A3: Erneuter Abgleich

**Trigger:** Vorstand wählt «Jetzt aktualisieren», oder der nächtliche Zeitplan läuft
**Flow:**

1. System ruft die Beiträge im gespeicherten Umfang erneut ab.
2. Bereits übernommene Beiträge werden aktualisiert, nicht ein zweites Mal angelegt.
3. Use case ends.

### A4: Verbindung trennen

**Trigger:** Vorstand wählt «Verbindung trennen»
**Flow:**

1. System entfernt die Quelle und beendet den nächtlichen Abgleich.
2. Bereits übernommene Beiträge bleiben im Feed bestehen.
3. Use case ends.

### A5: Kein Vorstand

**Trigger:** Eine Person ohne Rolle admin öffnet die Ansicht
**Flow:**

1. System zeigt den Hinweis, dass nur der Vorstand die Website verbinden kann.
2. Use case ends.

### A6: Umfang oder Kategorien ändern

**Trigger:** Vorstand ändert bei verbundener Website die Zahl der Beiträge oder die Auswahl der Kategorien
**Flow:**

1. System prüft die Website erneut und zeigt die aktuellen Kategorien.
2. Vorstand ändert die Einstellungen und bestätigt.
3. System speichert die Einstellungen und gleicht sofort in diesem Umfang ab.
4. Beiträge, die durch eine engere Auswahl herausfallen, bleiben im Feed (BR-170).
5. Use case ends.

## Postconditions

### Success Postconditions

- Die Website ist als aktive Quelle des Vereins gespeichert.
- Die übernommenen Beiträge stehen im News-Feed und tragen die Herkunft «Website».
- Der Zeitpunkt und das Ergebnis des letzten Abgleichs sind sichtbar.

### Failure Postconditions

- Es ist keine Quelle gespeichert.
- Es entsteht kein Beitrag.
- Der Grund des Fehlschlags steht in der Ansicht.

## Business Rules

### BR-167: Der Abruf gehört auf den Server

Die Website wird nie aus der App heraus abgefragt, sondern ausschliesslich serverseitig. Vereinswebsites antworten langsam, stehen hinter Firewalls und weisen Aufrufe ohne browserähnlichen User-Agent ab; der nächtliche Abgleich findet zudem ohne angemeldete Person statt.

### BR-168: Ein Beitrag, eine Zeile

Ein Beitrag der Website erscheint höchstens einmal im Feed. Der Schlüssel ist die Beitrags-ID der Website; ein zweiter Abgleich aktualisiert denselben Beitrag.

### BR-169: Der Volltext kommt mit – entschärft

Übernommen werden Titel, Anrisstext, Volltext, Bild, Autorin oder Autor und das Datum. Die Liste zeigt den Anriss, das Detail den ganzen Artikel mit Absätzen und den Bildern im Text – wie in der bestehenden myclub-App, deren Mitglieder das so kennen. Fremdes HTML ist ein Einfallstor; deshalb erreicht der Volltext die Ansicht nur durch einen Filter mit fester Liste erlaubter Elemente (Text, Listen, Verweise, Bilder, Tabellen). Skripte, Rahmen, Formulare und Stile der Website fallen weg. Bearbeitet wird der Text weiterhin nur auf der Website; die App zeigt, sie kopiert nicht zum Ändern (A3 in UC-026). Ein Beitrag, dessen Volltext noch fehlt, zeigt den Anriss und einen Verweis auf die Website.

### BR-170: Trennen löscht nichts

Das Trennen der Verbindung beendet die Zufuhr, entfernt aber keine bereits übernommenen Beiträge. Sie sind im Feed verlinkt und teilweise gelesen.

### BR-171: Der Import ist ein einmaliges Angebot

Der Startbildschirm bietet den Import nur an, solange keine Website verbunden ist. Danach steht er in der Vereinsverwaltung – die «Erste Schritte»-Karte bleibt bei drei Angeboten (BR-002).

### BR-172: Ein Import ist keine Verbindungs-Nachricht

Übernommene Website-Beiträge zählen **nicht** in die Verbindungs-Quote (BR-111, K1). Gemeint ist dort etwas, das der Vorstand seinem Verein selbst erzählt; ein Feed-Abruf ist keine Zuwendung. Sonst erfüllte ein Verein die Quote allein dadurch, dass er eine Website betreibt, und die sanfte Sperre aus BR-044 liefe leer.

### BR-173: Geprüft, bevor gespeichert wird

Eine Quelle entsteht erst, wenn unter der Adresse eine WordPress-Schnittstelle geantwortet hat. Eine gespeicherte Adresse, aus der nie ein Beitrag kam, wäre eine Einstellung, die etwas verspricht und nichts hält; der Vorstand suchte den Fehler danach im Feed statt in der Adresse.

### BR-174: Der Verein bestimmt den Umfang

Wie viele Beiträge übernommen werden, entscheidet der Verein: mindestens einer, höchstens hundert, in der Vorgabe zwanzig. Die Obergrenze ist die der WordPress-Schnittstelle, die pro Abruf nicht mehr als hundert Beiträge liefert. Ohne Auswahl von Kategorien kommen die Beiträge aller Kategorien — eine leere Auswahl bedeutet «alles», nicht «nichts».

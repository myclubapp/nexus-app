# Use Case: Termine aus der bisherigen myclub-App übernehmen

## Overview

**Use Case ID:** UC-040
**Use Case Name:** Termine aus der bisherigen myclub-App übernehmen
**Primary Actor:** Vorstand
**Goal:** Die aktuellen Anlässe und Helfer-Events samt Schichten aus der bisherigen myclub-App (Firebase) in die Agenda holen und dort täglich aktuell halten, damit der Verein während der Umstellung nichts zweimal erfasst
**Status:** Implemented

## Preconditions

- Der Verein existiert (UC-001).
- Die Person hat im Verein die Rolle admin.
- Der Verein führt die bisherige myclub-App noch und kennt seine Vereinskennung dort (sie steht in der Adresse der Vereinsseite, z. B. `su-452800`).
- Betrieb: Das Service-Konto des bisherigen Backends ist als Secret der Edge Function hinterlegt (BR-185).

## Main Success Scenario

1. Vorstand öffnet «Bisherige myclub-App» in der Vereinsverwaltung.
2. System erklärt, was übernommen wird – die aktuellen Anlässe und Helfer-Events mit ihren Schichten – und dass der Abgleich danach jede Nacht läuft.
3. Vorstand gibt die Vereinskennung der bisherigen App ein; das Einfügen der ganzen Adresse genügt.
4. Vorstand wählt «Prüfen und verbinden». System liest den Verein in der bisherigen App und zeigt dessen Namen sowie die Zahl der aktuellen Anlässe, Helfer-Events und Schichten. **Nichts wird gespeichert.**
5. System speichert die Kennung als Quelle des Vereins.
6. System übernimmt sofort: Anlässe als Vereinsanlässe, Helfer-Events als Helfer-Events mit ihren Schichten (Bezeichnung, Zeitfenster, Personalbedarf, Punktwert) und meldet, wie viele Termine übernommen wurden.
7. System zeigt die Termine in der Agenda wie eigene: Zu- und Absage, Schicht-Eintrag, Erinnerung und Check-in gelten unverändert.
8. System gleicht die Quelle ab jetzt jede Nacht selbsttätig ab: Neue Termine kommen dazu, geänderte werden nachgeführt, Absagen übernommen.

## Alternative Flows

### A1: Kennung unbekannt

**Trigger:** Unter der Kennung findet die bisherige App keinen Verein (Schritt 4)
**Flow:**

1. System meldet, dass die bisherige App diese Vereinskennung nicht kennt.
2. System speichert keine Quelle und übernimmt keinen Termin.
3. Use case continues at step 3.

### A2: Dienst antwortet nicht

**Trigger:** Der Abruf läuft in ein Zeitlimit oder wird abgewiesen (Schritt 6 oder nächtlicher Abgleich)
**Flow:**

1. System hält die Meldung an der Quelle fest und zeigt sie in der Ansicht.
2. Ein einzelner Fehlschlag ändert den Zustand nicht; erst nach drei Tagen ohne gelungenen Lauf steht die Quelle auf «Fehler», und der Vorstand wird einmal benachrichtigt.
3. Die App bleibt vollständig nutzbar; nur die Termine aus der bisherigen App veralten.
4. Use case ends.

### A3: Jetzt übernehmen

**Trigger:** Vorstand wählt «Jetzt übernehmen», oder der nächtliche Zeitplan läuft
**Flow:**

1. System liest die aktuellen Termine erneut.
2. Bereits übernommene Termine und Schichten werden nachgeführt, nicht ein zweites Mal angelegt (BR-187).
3. Use case ends.

### A4: Verbindung trennen

**Trigger:** Vorstand wählt «Verbindung trennen»
**Flow:**

1. System entfernt die Quelle und beendet den nächtlichen Abgleich.
2. Bereits übernommene Termine und Schichten bleiben bestehen (BR-184).
3. Use case ends.

### A5: Kein Vorstand

**Trigger:** Eine Person ohne Rolle admin öffnet die Ansicht oder ruft den Dienst auf
**Flow:**

1. System weist den Aufruf ab; die Berechtigung prüft die Datenbank, nicht die Ansicht.
2. Use case ends.

### A6: Termin in der bisherigen App gelöscht

**Trigger:** Ein übernommener Termin ist beim nächsten Lauf in der Quelle nicht mehr vorhanden
**Flow:**

1. Der Termin bleibt hier stehen (BR-184); der Vorstand sagt ihn bei Bedarf hier ab.
2. Use case ends.

### A7: Schicht in der bisherigen App entfernt

**Trigger:** Eine übernommene Schicht fehlt beim nächsten Lauf in der Quelle
**Flow:**

1. Ist niemand eingetragen, entfernt das System die Schicht.
2. Ist jemand eingetragen, bleibt die Schicht samt Einträgen bestehen.
3. Use case ends.

### A8: Kennung schon vergeben

**Trigger:** Die Kennung ist bereits mit einem anderen Verein verbunden (Schritt 5)
**Flow:**

1. System meldet, dass diese Kennung schon mit einem anderen Verein verbunden ist.
2. Use case continues at step 3.

## Postconditions

### Success Postconditions

- Die Kennung der bisherigen App ist als aktive Quelle des Vereins gespeichert.
- Die aktuellen Anlässe und Helfer-Events stehen mit ihren Schichten in der Agenda und tragen ihre Herkunft in `external_id`.
- Der Zeitpunkt, das Ergebnis und die Zahl der übernommenen Termine des letzten Laufs sind sichtbar.

### Failure Postconditions

- Es ist keine Quelle gespeichert.
- Es entsteht kein Termin.
- Der Grund des Fehlschlags steht in der Ansicht.

## Business Rules

### BR-183: Die bisherige App bleibt bis zum Wechsel die Quelle

Titel, Beschreibung, Zeit, Ort, Personalbedarf und Absage eines übernommenen Termins sowie Bezeichnung, Zeiten, Bedarf und Punktwert seiner Schichten überschreibt jeder Lauf. Was hier entsteht – Zusagen, Schicht-Einträge, Check-ins, Punkte, Erinnerungen –, gehört diesem System und bleibt unberührt. Wer einen übernommenen Termin hier ändert, verliert die Änderung mit dem nächsten Lauf; bis zum Wechsel wird in der bisherigen App gepflegt.

### BR-184: Der Abgleich löscht nichts

Ein Termin, der in der bisherigen App verschwindet, bleibt hier stehen; das Trennen der Verbindung entfernt keinen Termin. Eine Schicht verschwindet nur, solange niemand eingetragen ist – sonst bliebe ein Eintrag ohne Schicht zurück.

### BR-185: Das Service-Konto bleibt auf dem Server

Der Zugang zum bisherigen Backend liegt als Secret der Edge Function. Er steht in keiner Tabelle, verlässt den Server nie und wird nicht aus der App heraus verwendet. Die App kennt nur die Vereinskennung.

### BR-186: Übernommen wird, was aktuell ist

Ein Termin gilt als aktuell, solange sein Beginn nicht länger als zwei Stunden zurückliegt – dieselbe Grenze, mit der die bisherige App ihre Liste zeigt. Vergangene Anlässe und Einsätze bleiben dort: Die Punkte dafür sind dort gebucht, und eine Agenda voller alter Einsätze hilft niemandem.

### BR-187: Ein Termin, eine Zeile

Ein Termin der bisherigen App erscheint höchstens einmal. Der Schlüssel ist `legacy:event:<id>` für Anlässe und `legacy:helper:<id>` für Helfer-Events in `events.external_id`; eine Schicht erkennt sich über `(event_id, external_id)` wieder. Ein zweiter Lauf aktualisiert dieselbe Zeile.

### BR-188: Ohne Beschreibung ein Satz zur Herkunft

BR-036 verlangt für Helfer-Events und Anlässe ein Warum. Die bisherige App kennt nur eine Beschreibung; fehlt sie, steht «Aus der bisherigen myclub-App übernommen». Das ist ehrlicher als ein erfundener Sinn, und der Vorstand kann den Satz nach dem Wechsel ersetzen.

### BR-189: Schichtzeiten sind Uhrzeiten am Tag des Termins

Die bisherige App speichert Schichtzeiten als Uhrzeit («17:15») ohne Datum, in Zürcher Ortszeit. Das Datum ist das des Termins. Endet eine Schicht vor ihrem Beginn, sind die Felder vertauscht und werden getauscht; fehlt das Ende, dauert die Schicht zwei Stunden. Ein Personalbedarf unter eins wird eins, ein negativer Punktwert null.

### BR-190: Übernommene Termine gelten dem ganzen Verein

Anlässe und Helfer-Events der bisherigen App tragen kein Team. Sie entstehen hier ohne `team_id` und sind damit für alle Mitglieder sichtbar (C-032). Eine Zuordnung zu einem Team nimmt der Vorstand nach dem Wechsel vor.

### BR-191: Nur lesen

Es gibt keinen Weg, der an das bisherige Backend schreibt. Jeder Aufruf nach aussen ist ein Lesezugriff.

## Notes

- **Gegenstück in der bisherigen App:** `club/<id>/events` (Modell `Veranstaltung`) und `club/<id>/helferEvents` mit der Untersammlung `schichten` (Modell `Schicht`), aus `app/src/app/models/event.ts` des Repos `myclubapp/app`. Die Grenze «aktuell» stammt aus `event.service.ts` (`getClubEventsRef`).
- **Was nicht übernommen wird:** Teilnehmende und Schicht-Einträge der bisherigen App (sie hängen an Firebase-Konten, die es hier nicht gibt), Helferpunkte (das Punktesystem hier ist ein eigenes), `closedEvent` (Anmeldeschluss – hier ohne Entsprechung), `link_web` und `link_poll`. Verbandsspiele kommen über UC-039, nicht über diesen Weg.
- **Typen:** Anlässe werden `social`, Helfer-Events `helper`. Ob ein Anlass ein Turnier oder eine GV ist, weiss die bisherige App nicht; der Vorstand kann den Typ hier nicht ändern, solange die Quelle verbunden ist (BR-183).
- **Betrieb:** Die Edge Function `sync-legacy` liest Firestore über die REST-Schnittstelle mit einem selbst signierten Service-Konto-Token – ohne Firebase-SDK, damit nach dem Wechsel keine Google-Abhängigkeit zurückbleibt (CLAUDE.md, «Kein Google»).

# Use Case: Termine aus der bisherigen myclub-App übernehmen

## Overview

**Use Case ID:** UC-040
**Use Case Name:** Termine aus der bisherigen myclub-App übernehmen
**Primary Actor:** Vorstand
**Goal:** Mitglieder, Teams, Trainings, Anlässe und Helfer-Events samt Schichten und die Zu- und Absagen dazu aus der bisherigen myclub-App (Firebase) übernehmen und täglich aktuell halten, damit der Verein während der Umstellung nichts zweimal erfasst
**Status:** Implemented

## Preconditions

- Der Verein existiert (UC-001).
- Die Person hat im Verein die Rolle admin.
- Der Verein führt die bisherige myclub-App noch und kennt seine Vereinskennung dort (sie steht in der Adresse der Vereinsseite, z. B. `su-452800`).
- Betrieb: Das Service-Konto des bisherigen Backends ist als Secret der Edge Function hinterlegt (BR-185).

## Main Success Scenario

1. Vorstand öffnet «Bisherige myclub-App» in der Vereinsverwaltung.
2. System erklärt, was übernommen wird – Mitglieder, Teams, die aktuellen Trainings, Anlässe und Helfer-Events mit ihren Schichten sowie die Zu- und Absagen dazu – und dass der Abgleich danach jede Nacht läuft.
3. Vorstand gibt die Vereinskennung der bisherigen App ein; das Einfügen der ganzen Adresse genügt.
4. Vorstand wählt «Prüfen und verbinden». System liest den Verein in der bisherigen App und zeigt dessen Namen sowie die Zahl der Mitglieder, Teams, aktuellen Anlässe, Helfer-Events, Schichten, Trainings, Spiele und Antworten. **Nichts wird gespeichert.**
5. System speichert die Kennung als Quelle des Vereins.
6. System übernimmt sofort, in dieser Reihenfolge:
   - die Mitglieder als Mitglieder ohne Konto mit Name, Kontaktadresse und Rolle (BR-192);
   - die Teams mit ihrer Zugehörigkeit – Teams mit Verbandskennung als verknüpfte Teams (UC-039, BR-194);
   - Anlässe als Vereinsanlässe, Helfer-Events mit ihren Schichten (Bezeichnung, Zeitfenster, Personalbedarf, Punktwert), Trainings als Team-Termine;
   - die Zu- und Absagen zu Anlässen, Schichten, Trainings und Spielen als Antworten der jeweiligen Person (BR-193).
   System meldet, wie viele Termine und Antworten übernommen wurden.
7. System zeigt die Termine in der Agenda wie eigene: Zu- und Absage, Schicht-Eintrag, Erinnerung und Check-in gelten unverändert; die übernommenen Antworten stehen bereits an den Terminen.
8. System gleicht die Quelle ab jetzt jede Nacht selbsttätig ab: Neue Mitglieder, Teams und Termine kommen dazu, geänderte werden nachgeführt, Absagen und Antworten übernommen. Die Spiele der verknüpften Teams bringt der Verbandsabgleich (04:25), die Antworten dazu dieser Lauf (04:50).
9. Tritt eine Person später mit der E-Mail-Adresse aus der bisherigen App bei (UC-002), übernimmt sie ihr Mitglied ohne Konto samt Team, Rolle und Antworten, statt ein zweites Mitglied zu werden.

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

### A9: Antwort ohne Ziel

**Trigger:** Eine Antwort der bisherigen App gehört zu einem Spiel, das der Verband nicht im Spielplan des Teams führt, oder zu einer Person, die dort kein Mitglied ist
**Flow:**

1. System lässt die Antwort aus und zählt sie als nicht zuordenbar; der Lauf gilt trotzdem als gelungen.
2. Bringt der Verbandsabgleich das Spiel später, kommt die Antwort mit dem nächsten Lauf.
3. Use case ends.

### A8: Kennung schon vergeben

**Trigger:** Die Kennung ist bereits mit einem anderen Verein verbunden (Schritt 5)
**Flow:**

1. System meldet, dass diese Kennung schon mit einem anderen Verein verbunden ist.
2. Use case continues at step 3.

## Postconditions

### Success Postconditions

- Die Kennung der bisherigen App ist als aktive Quelle des Vereins gespeichert.
- Die Mitglieder der bisherigen App sind Mitglieder ohne Konto mit `legacy_user_id`; die Teams tragen `legacy_team_id`.
- Die aktuellen Anlässe, Helfer-Events (mit Schichten) und Trainings stehen in der Agenda und tragen ihre Herkunft in `external_id`; die Zu- und Absagen stehen als Antworten daran.
- Der Zeitpunkt, das Ergebnis und die Zahl der übernommenen Termine, Mitglieder und Antworten des letzten Laufs sind sichtbar.

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

BR-036 verlangt für Helfer-Events und Anlässe ein Warum. Die bisherige App kennt nur eine Beschreibung; fehlt sie, steht «Aus der bisherigen myclub-App übernommen». Das ist ehrlicher als ein erfundener Sinn, und der Vorstand kann den Satz nach dem Wechsel ersetzen. **Trainings bekommen keinen Ersatzsatz:** Für sie verlangt BR-036 kein Warum, und ohne Beschreibung bleibt das Feld leer – die App zeigt den Abschnitt dann nicht (Entscheid 2026-09-13, `0075`).

### BR-189: Schichtzeiten sind Uhrzeiten am Tag des Termins

Die bisherige App speichert Schichtzeiten als Uhrzeit («17:15») ohne Datum, in Zürcher Ortszeit. Das Datum ist das des Termins. Endet eine Schicht vor ihrem Beginn, sind die Felder vertauscht und werden getauscht; fehlt das Ende, dauert die Schicht zwei Stunden. Ein Personalbedarf unter eins wird eins, ein negativer Punktwert null.

### BR-190: Übernommene Termine gelten dem ganzen Verein

Anlässe und Helfer-Events der bisherigen App tragen kein Team. Sie entstehen hier ohne `team_id` und sind damit für alle Mitglieder sichtbar (C-032). Eine Zuordnung zu einem Team nimmt der Vorstand nach dem Wechsel vor.

### BR-191: Nur lesen

Es gibt keinen Weg, der an das bisherige Backend schreibt. Jeder Aufruf nach aussen ist ein Lesezugriff.

### BR-192: Ein Mitglied der bisherigen App wird ein Mitglied ohne Konto

Jedes Mitglied der bisherigen App entsteht hier als Mitglied ohne Konto: `user_id` bleibt leer, `legacy_user_id` trägt die Firebase-Kennung, die Kontaktadresse die E-Mail. Zuordnung in dieser Reihenfolge: dieselbe Firebase-Kennung, ein Konto mit derselben Adresse, ein Mitglied ohne Konto mit derselben Kontaktadresse, sonst neu. Die Rolle beim Anlegen folgt der alten App («Vorstand» → admin, «Trainer/in» → trainer, sonst member); Name und Rolle eines Mitglieds **mit** Konto ändert der Abgleich nicht. Wer per Einladung mit derselben Adresse beitritt, übernimmt sein Mitglied ohne Konto samt Team, Rolle und Antworten.

### BR-193: Antworten der Quelle überschreiben nur Antworten

Eine Zusage der bisherigen App wird `registered`, eine Absage `excused`, mit dem Zeitpunkt der Antwort. Was hier entstand – `present`, `absent`, `substitute`, ein Check-in – bleibt unberührt. Der Personalbedarf einer Schicht wird beim Übernehmen nicht geprüft: Die alte App hat die Einträge zugelassen, und ein Eintrag, der hier fehlt, wäre eine Person, die nicht weiss, dass sie fehlt.

### BR-194: Spiele kommen vom Verband, ihre Antworten aus der bisherigen App

Ein Team der bisherigen App mit Verbandskennung wird hier ein mit dem Verband verknüpftes Team (UC-039), sofern der Verein den Verband verbunden hat (UC-035); der Verbandsabgleich bringt seine Spiele. Dieser Lauf legt keine Spiele an – er hängt die Antworten an das Verbandsspiel mit derselben Kennung (`swissunihockey:<Spiel>`). Ein Spiel, das der Verband nicht im Spielplan führt (Cup, Freundschaftsspiel), bekommt keine Antworten (A9).

### BR-195: Trainings tragen den Tag des Termins und die Zeit der Serie

Die bisherige App speichert je Training den Tag als Zeitpunkt (`date`) und die Uhrzeiten als Vorlagen der Serie von einem anderen Tag (`timeFrom`, `timeTo`). Übernommen wird der Zürcher Tag von `date` mit der Zürcher Uhrzeit der Vorlage – genau das, was die alte App anzeigt. Ein Training gehört seinem Team; ein Training, dessen Team hier fehlt, wird nicht übernommen.

### BR-263: Ein übernommener Termin trägt die Punkteregel seines Typs

Ein Termin ohne Punkteregel ist für das Punktesystem unsichtbar: Wer daran einscannt, bekommt nichts, und erfährt nicht, warum. Bis zum 15.09.2026 legten die Übernahme und der Verbandsabgleich genau solche Termine an – 330 von 336 im ersten Verein, darunter jedes der 124 Spiele.

Beide setzen die Regel jetzt nach demselben Schlüssel, den das Formular vorschlägt (`RULE_BY_TYPE`): Training, Spiel, Versammlung und Anlass bekommen ihre Regel, sofern der Verein sie führt und eingeschaltet hat. Ein Verein, der eine Regel gelöscht hat, bekommt keine untergeschoben.

Zwei Termintypen bleiben bewusst leer. Beim **Helferanlass** ist der Beitrag die Schicht: Die Regel am Termin und die Regel an der Schicht tragen verschiedene Quellen, der Dedupe-Index hält sie nicht auseinander, und wer scannt *und* eine bestätigte Schicht hat, bekäme den Einsatz zweimal. Die **Sitzung** ist Arbeit des Gremiums, kein Beitrag mit Punktwert.

Beim wiederholten Abgleich gilt die Regel des Vereins vor der des Schlüssels: Was von Hand gesetzt wurde, bleibt stehen. Ein nächtlicher Abgleich ist keine Gelegenheit, eine Entscheidung zu überschreiben.

## Notes

- **Gegenstück in der bisherigen App:** `club/<id>/events` (Modell `Veranstaltung`) und `club/<id>/helferEvents` mit der Untersammlung `schichten` (Modell `Schicht`), aus `app/src/app/models/event.ts` des Repos `myclubapp/app`. Die Grenze «aktuell» stammt aus `event.service.ts` (`getClubEventsRef`).
- **Was nicht übernommen wird:** Helferpunkte (das Punktesystem hier ist ein eigenes), Profilbilder, `closedEvent` (Anmeldeschluss – hier ohne Entsprechung), `link_web` und `link_poll`, vergangene Termine und ihre Antworten. Spiele selbst kommen über UC-039 (BR-194).
- **Weitere Quellen:** `club/<id>/members/<uid>` mit `userProfile/<uid>` (E-Mail), `club/<id>/teams` mit `teams/<id>` (Name, `externalId`) und `teams/<id>/members`, `teams/<id>/trainings` (Modell `Training`), `teams/<id>/games` (Modell `Game`, `externalId` = Spielkennung des Verbands). Antworten liegen als `…/attendees/<uid>` mit `{ status: boolean, changedAt }`.
- **Typen:** Anlässe werden `social`, Helfer-Events `helper`. Ob ein Anlass ein Turnier oder eine GV ist, weiss die bisherige App nicht; der Vorstand kann den Typ hier nicht ändern, solange die Quelle verbunden ist (BR-183).
- **Betrieb:** Die Edge Function `sync-legacy` liest Firestore über die REST-Schnittstelle mit einem selbst signierten Service-Konto-Token – ohne Firebase-SDK, damit nach dem Wechsel keine Google-Abhängigkeit zurückbleibt (CLAUDE.md, «Kein Google»).

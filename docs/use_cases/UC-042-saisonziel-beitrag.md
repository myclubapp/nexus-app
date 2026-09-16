# Use Case: Saisonziel für den Beitrag setzen und verfolgen

## Overview

**Use Case ID:** UC-042
**Use Case Name:** Saisonziel für den Beitrag setzen und verfolgen
**Primary Actor:** Vorstand
**Secondary Actor:** Mitglied
**Goal:** Ein Saisonziel in Punkten festlegen, an dem der Verein sieht, wer seinen Beitrag geleistet hat – und das dem Mitglied als Fortschritt mit passenden Angeboten erscheint, nicht als Forderung
**Status:** Implemented

## Preconditions

- Der Verein existiert und das Modul «Saisonziel» ist eingeschaltet.
- Für Schritte 1–6 hat die Person im Verein die Rolle admin oder sportchef.
- Für Schritte 7–9 genügt die Mitgliedschaft.
- Es gibt aktive Punkteregeln der Säulen 3 und 7.

## Main Success Scenario

1. Vorstand öffnet die Vereinseinstellungen und schaltet «Saisonziel» ein.
2. System zeigt das Ziel in Punkten mit einem Vorschlag aus den aktiven Regeln der Säulen 3 und 7 und nennt den Vorschlag in Einsätzen («entspricht etwa vier halben Tagen»).
3. Vorstand bestätigt oder ändert die Zahl und speichert.
4. System hält das Ziel am Verein fest; es gilt ab sofort für die laufende Saison.
5. Vorstand öffnet «Saisonziel je Mitglied» und sieht jedes aktive Mitglied mit Ist, Eingeplantem, Soll, Rest und einer Ampel: erreicht, auf dem Weg, offen.
6. Vorstand teilt die Liste als CSV – auf dem Gerät über das Teilen-Blatt, im Browser als Datei.
7. Mitglied öffnet seinen Punktestand und sieht eine Fortschrittskarte: geleistete Beitragspunkte, bereits **eingeplante** Punkte aus Zusagen, Ziel und wie viel noch fehlt.
8. System nennt unter der Karte die nächsten passenden Beiträge – offene Schichten, Aufgaben und vakante Ämter aus dem Marktplatz.
9. Mitglied übernimmt einen Beitrag; nach der Bestätigung wächst der Fortschritt mit der Buchung im Ledger.

## Alternative Flows

### A1: Einzelnes Mitglied abweichend

**Trigger:** Für eine Person gilt ein anderes Soll – Ehrenmitglied, Passivmitglied, Vorstandsamt (Schritt 5)
**Flow:**

1. Vorstand öffnet die Zeile und trägt ein eigenes Ziel ein; null bedeutet «befreit».
2. System merkt sich das Ziel an der Mitgliedschaft und rechnet die Zeile neu.
3. Use case continues at step 5.

### A2: Ziel ohne Zahl

**Trigger:** Der Verein will den Fortschritt sehen, aber keine Zahl setzen (Schritt 3)
**Flow:**

1. Vorstand lässt das Ziel leer.
2. System zeigt in der Übersicht nur das Ist und verzichtet auf Ampel, Rest und Fortschrittskarte.
3. Use case ends.

### A3: Mitglied ohne Ziel

**Trigger:** Für das Mitglied gilt das Ziel null (A1) (Schritt 7)
**Flow:**

1. System zeigt keine Fortschrittskarte; der Punktestand bleibt, wie er ohne das Modul wäre.
2. Use case ends.

### A4: Saisonwechsel

**Trigger:** Die Saison des Vereins beginnt neu (Schritt 4)
**Flow:**

1. System rechnet Ist und Rest ab dem ersten Tag der neuen Saison wieder von null.
2. Das Ziel bleibt stehen, bis der Vorstand es ändert; die Werte der Vorsaison bleiben im Ledger lesbar.
3. Use case continues at step 5.

### A5: Ziel erreicht

**Trigger:** Ein Mitglied erreicht oder überschreitet sein Ziel (Schritt 9)
**Flow:**

1. System schreibt dem Mitglied eine Nachricht, die den Beitrag benennt und dankt – ohne Rangvergleich.
2. Die Fortschrittskarte zeigt «erreicht»; weitere Beiträge zählen weiter, werden aber nicht mehr angemahnt.
3. Use case ends.

### A6: Hinweis an den Vorstand

**Trigger:** Weniger als acht Wochen bis zum Saisonende und Mitglieder ohne jeden Beitrag (Schritt 5)
**Flow:**

1. System legt dem Vorstand ein Vereinssignal an: wie viele Mitglieder noch keinen Beitrag haben.
2. Das Signal trägt eine Handlungsfrage an den Verein, keine Namensliste. Wie viel Zeit bleibt, steht im Text – das Signal entsteht ohnehin nur im Fenster vor dem Saisonende.
3. Use case continues at step 5.

### A7: Modul aus

**Trigger:** Das Modul «Saisonziel» ist ausgeschaltet (Schritt 1)
**Flow:**

1. System zeigt weder die Übersicht noch die Fortschrittskarte noch das Signal.
2. Punkte, Rangliste und Marktplatz verhalten sich unverändert.
3. Use case ends.

## Postconditions

### Success Postconditions

- Das Saisonziel steht am Verein, abweichende Ziele stehen an der Mitgliedschaft.
- Ist, Soll und Rest jedes Mitglieds sind für den Vorstand einsehbar und als CSV exportierbar.
- Das Mitglied sieht seinen eigenen Fortschritt und keinen fremden.
- Es entsteht keine zweite Punktequelle: Ist ist die Summe bestehender Buchungen der Säulen 3 und 7 in der laufenden Saison.

### Failure Postconditions

- Ohne Ziel bleibt die Übersicht eine reine Ist-Liste; es entsteht keine Ampel ohne Massstab.
- Schlägt das Speichern fehl, bleibt das bisherige Ziel stehen und das Formular nennt den Grund.

## Business Rules

### BR-197: Ein Ledger, eine Skala

Das Ist ist die Summe der Punktebuchungen der laufenden Saison in den Säulen 3 und 7. Es gibt kein zweites Konto und keine zweite Zählweise. Das Ziel steht in derselben Einheit wie die Regeln und die Schichten.

### BR-198: Beitrag ist Säule 3 und 7

Was als Beitrag zählt, steht einmal (`contribution_points()`) und gilt für die Übersicht, die Fortschrittskarte, das Signal und die Verantwortungsverteilung (BR-100). Läuft die Definition auseinander, rechnet der Vorstand anders als das Mitglied.

### BR-199: Das Ziel ist Kür

Ohne eingeschaltetes Modul gibt es kein Saisonziel. Die Voreinstellung ist aus, wie bei jedem Modul (BR-150). Ein Verein, der nach dem MVP-Schnitt arbeitet, merkt von diesem Use Case nichts.

### BR-200: Das Soll steht zweistufig

Es gilt das Ziel der Mitgliedschaft; fehlt es, das Ziel des Vereins. Null ist ein gültiges Ziel und bedeutet «befreit» – nicht «nicht gesetzt».

### BR-201: Der Rückstand ist keine Rangliste

Ist, Soll und Ampel sieht der Vorstand, das Mitglied sieht nur sich selbst. Es gibt keine Liste der Säumigen für die Mitgliedschaft, keinen Aushang und keine Nachricht an Dritte. Wer zurückliegt, bekommt Angebote, keine Mahnung (V7, K3).

### BR-202: Das Signal nennt keine Namen

Das Vorstands-Signal aus A6 zählt und fragt; es führt keine Personen auf. Die Namen stehen in der Übersicht, die ohnehin nur der Vorstand sieht – das Signal ist kein zweiter Weg zu derselben Person.

### BR-203: Kein Strafweg in der App

Bussen, Depot-Rückerstattungen und Sperren entstehen nicht in der App. Der Export nach Schritt 6 ist die Schnittstelle zum Kassier; was danach geschieht, ist Vereinssache.

### BR-204: Der Wert der Schicht ist die Dauer

Ein übernommener Wert aus einer Vorgängerapp ist keine Punktzahl dieser Skala. Beim Übernehmen wird der Punktwert einer Schicht aus ihrer Dauer abgeleitet, so wie ihn das Formular vorschlägt; der fremde Wert wird nur als Reihenfolge-Hinweis gelesen, nicht als Punkte.

### BR-265: Eingeplant ist zugesagt, nicht geleistet

Eingeplant sind Punkte, für die eine Zusage vorliegt und noch keine Buchung: angemeldete Schichten, übernommene Aufgaben, die Quartale eines gehaltenen Amtes, die diese Saison noch fällig werden. Sie stehen **neben** dem Geleisteten und gehen nicht in Abzeichen, Rest oder Ampel ein – eine Zusage darf nicht grün färben.

Gezählt wird allein, was auf das Ziel einzahlt: die Säulen 3 und 7 (BR-198). Ein angemeldetes Training bringt Punkte für die Rangliste und ist trotzdem nicht eingeplant im Sinne dieser Regel – sonst zeigte die Karte neben einem Ziel eine Zahl, die nie dorthin führt. Aus demselben Grund sind die Vorschläge unter der Karte auf dieselben Säulen eingeschränkt.

Ein vergangener Termin ohne Buchung zählt nicht mehr mit: Das Zeitfenster für den Check-in ist zu (BR-054). Eine vergangene Schicht dagegen schon – ihre Bestätigung kennt kein Zeitfenster und kommt oft Tage später.

### BR-266: Wer eingeplant ist, ist nicht säumig

Das Signal aus A6 zählt nur Mitglieder ohne Buchung **und** ohne Zusage. Wer für März eingeteilt ist, fehlt im Januar nicht – ihn zu zählen, machte aus der Planung einen Vorwurf und aus dem Signal eine Zahl, auf die der Vorstand nicht handeln kann.

## Notes

- Gezogen aus `MVP_Scope` §4 am 14.09.2026 auf Sandros Auftrag. Der MVP-Schnitt streicht Soll und Reporting ausdrücklich (§2.1, Zeile 106) und nennt das Saisonziel auf dem Ledger als Ausbaustufe – genau diese Ausbaustufe ist hier beschrieben, als Modul und nicht als Grundfunktion.
- Die alte App führte zwei Konten: `helferPunkte` am Mitglied war das **Soll** (Vereinswert, pro Mitglied übersteuerbar), `totalPoints` das Ist, eine Schicht zählte meist 1, das Ziel 4, die Ampel stand bei 100 % und 50 %, der Zeitraum kam aus zwei Datumsfeldern am Verein. Daneben lief ein zweites Punktesystem. Dieser Use Case bildet dieselbe Information mit einem Konto und einer Skala ab; die Ampelschwellen sind übernommen.
- Der Zeitraum ist die Saison des Vereins (`season_label()`), nicht ein eigenes Datumspaar. Zwei Zeiträume nebeneinander waren in der alten App eine der Quellen der Verwirrung.
- Die Gutschrift für Ämter ist seit dem 15.09.2026 Teil des Ledgers (UC-041 A9, BR-264): quartalsweise statt am Saisonende, damit niemand acht Monate auf null steht. Offen und bewusst nicht Teil dieses Use Cases bleiben Team-Challenges (Konzept §8).
- **Nachtrag vom 15.09.2026 (FR-198, BR-265/BR-266).** Die Prüfung an der laufenden Datenbank zeigte einen Verein mit 177 zielpflichtigen Mitgliedern, die alle auf null standen – und eine Karte, die unter «zählt aufs Ziel» Trainings vorschlug, die gar nicht aufs Ziel zählen. Die dritte Zahl schliesst die Lücke zwischen dem Geleisteten und dem, was man noch tun könnte: dem, was schon zugesagt ist.

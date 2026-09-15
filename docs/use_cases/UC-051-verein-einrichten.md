# Use Case: Verein einrichten

## Overview

**Use Case ID:** UC-051
**Use Case Name:** Verein einrichten
**Primary Actor:** Vorstand
**Goal:** Nach der Gründung Schritt für Schritt die Entscheide treffen, die ein neuer Verein wirklich zu treffen hat – ohne dass einer davon nötig wäre
**Status:** Implemented

## Preconditions

- Der Verein wurde gegründet (UC-001) und ist vollständig nutzbar (BR-002).
- Die Person hat im Verein die Rolle admin.

## Main Success Scenario

1. System führt den Vorstand unmittelbar nach der Gründung in den Einrichtungs-Assistenten und nennt die Zahl der Schritte.
2. System fragt: «Hängt euer Verein an einem Verband?» und zeigt das Formular aus UC-035 – Verband wählen, Vereinskennung eintragen, prüfen, verbinden.
3. Vorstand verbindet den Verband oder geht weiter.
4. System fragt – **nur wenn eine Verbindung besteht** – ob auch die Beiträge des Verbands im News-Feed erscheinen sollen, und schaltet sie auf Wunsch ein (FR-197).
5. System fragt nach den Teams, zeigt die bestehenden und bietet zwei Wege: ein Team von Hand anlegen oder, bei verbundenem Verband, die Teams aus der Verbandsliste übernehmen (UC-039 A1).
6. System zeigt die Beispielinhalte, erklärt sie in einem Satz und bietet an, sie in einem Schritt zu entfernen (UC-037).
7. System fragt, wie die Mitglieder hereinkommen: ein Einladungslink mit den Vorgaben – und der Schalter, ob offene Beitritts-Anfragen zugelassen sind (FR-196).
8. Vorstand wählt «Fertig».
9. System zeigt den Startbildschirm. Solange der Verein neu ist, führt die «Erste Schritte»-Karte zurück in den Assistenten.

## Alternative Flows

### A1: Einrichtung überspringen

**Trigger:** Vorstand wählt «Später einrichten» (in jedem Schritt)
**Flow:**

1. System zeigt den Startbildschirm.
2. Alles Erledigte bleibt erledigt: Jeder Schritt wirkt sofort, es gibt keinen gemeinsamen Speichern-Knopf am Ende.
3. Use case ends.

### A2: Kein Verband

**Trigger:** Vorstand verbindet in Schritt 3 keinen Verband
**Flow:**

1. System lässt die Frage nach den Verbandsnews weg – es gibt niemanden zu fragen.
2. Der Assistent hat vier Schritte statt fünf.
3. Use case continues at step 5.

### A3: Verband ohne Beiträge

**Trigger:** Der verbundene Verband liefert keine Beiträge (Schritt 4)
**Flow:**

1. System zeigt keinen Schalter, sondern den Satz, dass dieser Verband keine Beiträge liefert.
2. Use case continues at step 5.

### A4: Später wieder hinein

**Trigger:** Vorstand öffnet den Assistenten erneut, Wochen nach der Gründung
**Flow:**

1. System zeigt jeden Schritt mit dem Stand, den er hat: verbundene Verbände, bestehende Teams, verbliebene Beispielinhalte, der Stand des Anfragen-Schalters.
2. Der Assistent ist keine Einbahn – er ist die Übersicht über diese fünf Entscheide.
3. Use case ends.

### A5: Keine Vorstandsrolle

**Trigger:** Eine Person ohne Rolle admin öffnet den Assistenten
**Flow:**

1. System zeigt den Hinweis, dass nur der Vorstand den Verein einrichtet, und den Weg zurück.
2. Use case ends.

## Postconditions

### Success Postconditions

- Jeder im Assistenten getroffene Entscheid ist gespeichert, unabhängig davon, ob der Assistent zu Ende gelaufen ist.
- Der Verein ist nicht mehr oder weniger nutzbar als unmittelbar nach der Gründung – der Assistent fügt nichts hinzu, was ohne ihn fehlte.

### Failure Postconditions

- Ein einzelner Schritt, der fehlschlägt, nennt die Meldung des Servers und lässt die übrigen unberührt.
- Der Verein bleibt vollständig nutzbar.

## Business Rules

### BR-258: Ohne Freigabe keine Anfrage

Der Weg in einen Verein ist die Einladung (BR-006). Eine offene Beitritts-Anfrage ist der zweite Weg, und ihn öffnet der Vorstand in den Vereinseinstellungen. Voreingestellt ist er **zu** – auch für alle Vereine, die vor dieser Regel entstanden sind. Durchgesetzt wird sie in `request_join()`; das Ausblenden des Formulars ist Bequemlichkeit, nicht der Schutz (C-011).

### BR-259: Der Assistent ist ein Angebot

Kein Schritt ist Pflicht, und der Ausstieg steht in jedem Schritt. Die Gründung bleibt bei drei Eingabeschritten (BR-004) und der Zero-Config-Start gilt unverändert (BR-002): Wer den Assistenten nie öffnet, hat einen vollständigen Verein. Jeder Schritt wirkt sofort – es gibt keinen Speichern-Knopf am Ende, der alles oder nichts festschreibt.

### BR-260: Verbandsnews sind zugeschaltet, nicht voreingestellt

Ein Verein verbindet den Verband wegen des Spielplans. Ob auch dessen Beiträge in seinem Feed stehen, ist eine zweite Frage; sie wird beim Verbinden gestellt und ist voreingestellt aus. Die Einstellung sitzt an der **Verbindung**, nicht am Verein – ein Verein kann an zwei Verbänden hängen. Wo ein Verband keine Beiträge liefert, steht kein Schalter, sondern der Grund.

### BR-261: Ein Verbandsbeitrag ist keine Zuwendung

Wie die übernommenen Website-Beiträge (BR-172) zählen Verbandsbeiträge **nicht** in die Verbindungs-Quote. Sonst erfüllte ein Verein sie, indem er einen Schalter umlegt, und die sanfte Sperre aus BR-044 liefe leer.

### BR-262: Der Kurzname ist kein Geheimnis, aber auch kein Schlüssel

Wer einen gültigen Kurznamen eingibt, erfährt weiterhin, dass es diesen Verein gibt – das wusste er schon, sonst hätte er den Kurznamen nicht. Er erfährt zusätzlich, **ob** der Verein Anfragen annimmt. Ein «nicht gefunden» wäre an dieser Stelle unwahr und liesse die Person den Fehler im Kurznamen suchen.

## Abgrenzung

Nicht Teil dieses Anwendungsfalls: die Vereinseinstellungen selbst (UC-034) und die
Einladungsverwaltung mit Geltungsbereich, Rolle und Ablauf (UC-003). Der Assistent führt zu ihnen,
er ersetzt sie nicht – er stellt die fünf Fragen, die ein neuer Verein hat, und überlässt den
Feinschliff den Seiten, die dafür gebaut sind.

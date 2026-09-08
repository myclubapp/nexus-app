# Requirements: myclub nexus

Anforderungskatalog der Engagement-Plattform **myclub nexus**.

**Grundlage:** `vision.md` – Purpose, Zielgruppen, Umfang, Nicht-Ziele und Erfolgsdefinition.

**Quellen der Vision (in dieser Rangfolge):**

1. `MVP_Scope_myclub.md` – der massgebende Leistungsschnitt, übersteuert die anderen Dokumente
2. `Technische_Architektur_TeamSpirit.md` – Stack, Schema, Flows
3. `Konzept_Vereinsapp_Gamification.md` – die sieben Punkte-Säulen
4. `Abgleich_Voicible_Manifest.md` – Purpose-Prüfung und die Korrekturen K1–K7

**Leitsatz:** Die Verwaltung ist das Substrat, das Punktesystem ist das Produkt.
Jede Anforderung muss sich ihren Platz im MVP-Schnitt (`MVP_Scope_myclub.md` §2.1) verdienen.

**Hinweis zur Nummerierung:** Dieser Katalog ist neu durchnummeriert. Die im MVP-Scope §9 zitierten
alten IDs (FR-057–062 Helfer, FR-063–070 Beiträge, FR-071 J+S, FR-016/017 Eltern) stammen aus dem
Vorgänger-Katalog «Abgleich Vorgaben» und gelten hier als ersetzt.

**Rollen:** Mitglied · Trainer:in · Sportchef:in · Vorstand (Admin) · Kassier:in · Gast · System

---

## 1. Funktionale Anforderungen

### 1.1 Auth & Onboarding

| ID     | Titel                        | User Story                                                                                                                                                     | Priority | Status      |
| ------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| FR-001 | Magic-Link-Anmeldung         | Als Mitglied möchte ich mich mit einem per E-Mail zugesandten Link anmelden, damit ich kein Passwort verwalten muss.                                            | High     | Implemented |
| FR-002 | E-Mail/Passwort-Anmeldung    | Als Mitglied möchte ich mich alternativ mit E-Mail und Passwort anmelden, damit ich auch ohne E-Mail-Zugriff auf dem Gerät in die App komme.                    | Medium   | Implemented        |
| FR-003 | Deep-Link-Rücksprung         | Als Mitglied möchte ich, dass mich der Anmeldelink direkt in die installierte App zurückführt, damit ich die Sitzung nicht im Browser fortsetzen muss.          | High     | In Progress |
| FR-004 | Verein gründen               | Als Vorstand möchte ich einen Vereins-Workspace in unter drei Minuten anlegen, damit wir ohne Vorlaufzeit starten können.                                       | High     | In Progress |
| FR-005 | Vereinsart wählen            | Als Vorstand möchte ich beim Gründen die Vereinsart (Sport, Musik, Kultur, Jugend, Quartier, Anderes) angeben, damit die App passende Vorlagen vorschlägt.      | High     | In Progress |
| FR-006 | Zero-Config-Start            | Als Vorstand möchte ich nach der Gründung sofort Agenda, Einladung und Standard-Punkteregeln nutzen können, damit ich nichts konfigurieren muss (K7).           | High     | In Progress |
| FR-007 | Einladung erstellen          | Als Vorstand möchte ich Einladungslinks und QR-Codes mit Geltungsbereich, Rolle und Ablaufdatum erzeugen, damit ich Mitglieder gezielt aufnehmen kann.          | High     | Implemented |
| FR-008 | Einladung einlösen           | Als Gast möchte ich über einen Einladungslink in unter 60 Sekunden Mitglied werden, damit der Beitritt keine Hürde ist.                                         | High     | Implemented |
| FR-009 | Beitritts-Anfrage stellen    | Als Gast möchte ich ohne Einladung eine Beitritts-Anfrage an einen Verein stellen, damit ich auch ohne Link dazustossen kann.                                   | Medium   | Implemented |
| FR-010 | Beitritts-Anfrage entscheiden| Als Vorstand möchte ich Beitritts-Anfragen genehmigen oder ablehnen, damit nur berechtigte Personen Zugang zum Verein erhalten.                                 | High     | Implemented |
| FR-011 | Mehrere Vereine              | Als Mitglied möchte ich mehreren Vereinen angehören und zwischen ihnen wechseln, damit ich nur ein Konto brauche.                                               | Medium   | Open        |
| FR-012 | Konto löschen                | Als Mitglied möchte ich mein Konto in der App löschen, damit ich die Kontrolle über meine Daten behalte (Store-Pflicht).                                        | High     | Open        |

### 1.2 Mitglieder & Teams

| ID     | Titel                     | User Story                                                                                                                                                    | Priority | Status      |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| FR-013 | Mitgliederliste           | Als Vorstand möchte ich alle Mitglieder des Vereins mit Rolle, Team und Status sehen, damit ich den Überblick behalte.                                         | High     | In Progress |
| FR-014 | Rolle zuweisen            | Als Vorstand möchte ich einem Mitglied die Rolle member, trainer oder admin zuweisen, damit Berechtigungen der Vereinsstruktur entsprechen.                    | High     | In Progress |
| FR-015 | Team anlegen              | Als Vorstand möchte ich Teams anlegen und benennen, damit Termine und Ranglisten pro Team geführt werden können.                                               | High     | In Progress |
| FR-016 | Team-Zuordnung            | Als Vorstand möchte ich Mitglieder einem oder mehreren Teams zuordnen, damit sie die für sie relevanten Termine sehen.                                         | High     | In Progress |
| FR-017 | Mitgliedsstatus pflegen   | Als Vorstand möchte ich den Status eines Mitglieds (aktiv, passiv, Ehrenmitglied, ausgetreten) pflegen, damit Auswertungen die richtige Grundgesamtheit haben. | Medium   | Open        |
| FR-018 | Eigenes Profil pflegen    | Als Mitglied möchte ich Anzeigename, Avatar und Kontaktdaten selbst pflegen, damit meine Angaben aktuell bleiben.                                              | High     | In Progress |
| FR-019 | Datenschutz-Optionen      | Als Mitglied möchte ich einzeln festlegen, ob E-Mail und Telefonnummer für andere Mitglieder sichtbar sind, damit ich meine Daten kontrolliere.                | High     | Open        |
| FR-020 | Leaderboard-Opt-in        | Als Mitglied möchte ich entscheiden, ob ich in Ranglisten erscheine, damit die Teilnahme freiwillig bleibt.                                                    | High     | Open        |

### 1.3 Agenda

| ID     | Titel                        | User Story                                                                                                                                                    | Priority | Status      |
| ------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| FR-021 | Termin erstellen             | Als Trainer:in möchte ich einen Termin mit Titel, Typ, Zeit und Ort erstellen, damit das Team weiss, wann etwas stattfindet.                                   | High     | In Progress |
| FR-022 | Terminserie erstellen        | Als Trainer:in möchte ich wiederkehrende Termine als Serie anlegen, damit ich das Wochentraining nicht einzeln erfassen muss.                                   | High     | Open        |
| FR-023 | Termin absagen               | Als Trainer:in möchte ich einen Termin mit Begründung absagen, damit alle Betroffenen den Grund kennen.                                                         | High     | Open        |
| FR-024 | Agenda ansehen               | Als Mitglied möchte ich meine kommenden Termine gefiltert nach meinen Teams sehen, damit ich nur Relevantes vor mir habe.                                       | High     | In Progress |
| FR-025 | Zusage erteilen              | Als Mitglied möchte ich einem Termin zusagen, damit die Organisation planen kann.                                                                               | High     | In Progress |
| FR-026 | Absage mit Grund             | Als Mitglied möchte ich mit einem Grund absagen, damit Trainer:innen die Abwesenheit einordnen können.                                                          | High     | In Progress |
| FR-027 | Teilnehmerstand sehen        | Als Trainer:in möchte ich Zusagen, Absagen und Unentschlossene eines Termins sehen, damit ich die Durchführung planen kann.                                     | High     | In Progress |
| FR-028 | Unentschlossene erinnern     | Als Trainer:in möchte ich Unentschlossene mit einem Tap erinnern, damit ich vor dem Termin eine belastbare Zahl habe.                                           | Medium   | Open        |
| FR-029 | Teilnehmerbedarf             | Als Trainer:in möchte ich den benötigten Teilnehmerbedarf eines Termins hinterlegen, damit die App Unterdeckung anzeigt.                                        | Low      | Open        |
| FR-030 | Helfer-Event mit Schichten   | Als Vorstand möchte ich ein Helfer-Event mit mehreren Schichten (Zeitfenster, Personalbedarf) ausschreiben, damit sich Mitglieder gezielt eintragen können.     | High     | In Progress |
| FR-031 | Schicht übernehmen           | Als Mitglied möchte ich mich für eine einzelne Schicht eintragen und wieder austragen, damit ich meinen Beitrag selbst wählen kann.                             | High     | In Progress |
| FR-032 | Schicht bestätigen           | Als Vorstand möchte ich die tatsächliche Anwesenheit pro Schicht bestätigen, damit die Punkte auf realem Einsatz beruhen.                                       | High     | In Progress |
| FR-033 | QR-Check-in                  | Als Mitglied möchte ich am Termin einen QR-Code scannen und damit meine Anwesenheit erfassen, damit die Punkte ohne Papierliste entstehen.                      | High     | In Progress |
| FR-034 | QR-Code anzeigen             | Als Trainer:in möchte ich den QR-Code eines Termins auf meinem Gerät anzeigen, damit die Anwesenden ihn scannen können.                                         | High     | In Progress |

### 1.4 Gamification (Punkte-Ledger)

| ID     | Titel                          | User Story                                                                                                                                                        | Priority | Status      |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| FR-035 | Standard-Punkteregeln          | Als Vorstand möchte ich beim Gründen einen vollständigen Satz Punkteregeln passend zur Vereinsart erhalten, damit das Punktesystem ohne Konfiguration funktioniert. | High     | In Progress |
| FR-036 | Punktwerte anpassen            | Als Vorstand möchte ich Punktwerte pro Regel anpassen, damit das System zur Kultur unseres Vereins passt.                                                           | High     | In Progress |
| FR-037 | Regel aktivieren/deaktivieren  | Als Vorstand möchte ich einzelne Regeln und ganze Säulen deaktivieren, damit wir nur abbilden, was es bei uns gibt.                                                 | High     | In Progress |
| FR-038 | Eigene Regel anlegen           | Als Vorstand möchte ich eigene Punkteregeln mit Code, Bezeichnung und Wert anlegen, damit vereinsspezifische Beiträge zählen.                                       | Medium   | Open        |
| FR-039 | Punktebuchung bei Teilnahme    | Als Mitglied möchte ich für eine bestätigte Teilnahme automatisch Punkte erhalten, damit mein Einsatz ohne Zutun sichtbar wird.                                     | High     | In Progress |
| FR-040 | Nur-Dank-Modus                 | Als Vorstand möchte ich pro Kategorie festlegen können, dass nur gedankt und nicht gepunktet wird, damit Sinn nicht von Zahlen verdrängt wird (V7).                 | Medium   | Open        |
| FR-041 | Punktehistorie einsehen        | Als Mitglied möchte ich jede meiner Punktebuchungen mit Datum, Quelle und Regel nachvollziehen, damit das System transparent ist.                                   | High     | In Progress |
| FR-042 | Manuelle Punktebuchung         | Als Vorstand möchte ich einem Mitglied manuell Punkte mit Notiz buchen, damit auch Beiträge ausserhalb der Automatik gewürdigt werden.                              | High     | Open        |
| FR-043 | Korrekturbuchung               | Als Vorstand möchte ich eine falsche Buchung durch eine Gegenbuchung korrigieren, damit der Ledger nachvollziehbar bleibt.                                          | High     | Open        |
| FR-044 | Dashboard mit Punktestand      | Als Mitglied möchte ich meinen Saison- und Karriere-Punktestand auf einen Blick sehen, damit ich meinen Beitrag einordnen kann.                                     | High     | In Progress |
| FR-045 | «Nächste Punkte»               | Als Mitglied möchte ich konkrete Vorschläge sehen, wie ich als Nächstes Punkte sammeln kann, damit ich weiss, wo ich gebraucht werde.                               | High     | In Progress |
| FR-046 | Vereins-Leaderboard            | Als Mitglied möchte ich die Vereins-Rangliste mit meiner eigenen Position sehen, damit der Wettbewerb spielerisch bleibt.                                           | High     | In Progress |
| FR-047 | Team-Leaderboard               | Als Mitglied möchte ich die Rangliste meines Teams sehen, damit der Vergleich im vertrauten Kreis stattfindet.                                                      | High     | In Progress |
| FR-048 | Leaderboard nach Säule filtern | Als Vorstand möchte ich die Rangliste nach Säule filtern (z.B. Helferpunkte Säule 3), damit ich das frühere Helfer-Reporting ohne eigenes Modul erhalte.            | High     | Open        |
| FR-049 | Zeitraum wählen                | Als Mitglied möchte ich zwischen Woche, Monat, Saison und Gesamt wechseln, damit auch Neumitglieder sichtbar werden.                                                | Medium   | Open        |
| FR-050 | Aufgabe ausschreiben           | Als Vorstand möchte ich eine Aufgabe mit Beschreibung, Kategorie, Frist und Punktwert ausschreiben, damit Vereinsarbeit verteilt wird.                              | High     | In Progress |
| FR-051 | Warum-Pflichtfeld              | Als Mitglied möchte ich zu jeder Aufgabe, jedem Amt und jedem Helfer-Event lesen, wozu es dient und wem es hilft, damit ich den Sinn kenne (K3a).                   | High     | Open        |
| FR-052 | Aufgabe übernehmen             | Als Mitglied möchte ich eine Aufgabe reservieren, damit klar ist, dass ich sie übernehme.                                                                           | High     | In Progress |
| FR-053 | Aufgabe einreichen             | Als Mitglied möchte ich eine erledigte Aufgabe mit optionalem Nachweis einreichen, damit sie bestätigt werden kann.                                                 | High     | In Progress |
| FR-054 | Aufgabe bestätigen             | Als Vorstand möchte ich eine eingereichte Aufgabe bestätigen und Punkte auslösen, damit der Beitrag gewürdigt wird.                                                 | High     | In Progress |
| FR-055 | Kudos zur Bestätigung          | Als Vorstand möchte ich der Bestätigung ein kurzes Dankeswort beilegen, damit Wertschätzung vor der Punktzahl steht (V7).                                           | High     | Open        |
| FR-056 | Wiederkehrende Aufgaben        | Als Vorstand möchte ich Aufgaben als wiederkehrend anlegen, damit ich sie nicht jede Runde neu erfassen muss.                                                       | Medium   | Open        |
| FR-057 | Verteilungs-Transparenz        | Als Mitglied möchte ich sehen, wie viele Aufgaben bereits übernommen wurden, damit die Verteilung fair sichtbar ist.                                                | Medium   | Open        |
| FR-058 | Beitrags-Profil erfassen       | Als Mitglied möchte ich angeben, womit ich gern beitrage (Interessen, Stärken, Zeitbudget), damit mir passende Beiträge angeboten werden (K3b).                     | High     | Open        |
| FR-059 | Beitrags-Matching              | Als Mitglied möchte ich Aufgaben und Ämter vorgeschlagen bekommen, die zu meinem Beitrags-Profil passen, damit Verantwortung angeboten statt ausgeschrieben wird.   | High     | Open        |

### 1.5 Vereins-Gesundheit & Frühwarnung

| ID     | Titel                          | User Story                                                                                                                                                     | Priority | Status |
| ------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| FR-060 | Vereins-Health-Übersicht       | Als Vorstand möchte ich Aktivierungsquote, Anteil aktiver Mitglieder, offene Hinweise und den Trend zur Vorsaison sehen, damit ich den Verein führen kann.       | High     | Open   |
| FR-061 | Team-Health                    | Als Trainer:in möchte ich Beteiligung und Antwortquote meines Teams sehen, damit ich früh reagieren kann.                                                        | High     | Open   |
| FR-062 | Frühwarn-Signale               | Als System möchte ich aus Teilnahmedaten Signale erzeugen (Beteiligungsrückgang, Streak-Abbruch, Silent Churn, keine Reaktion, Zahlungsverzug), damit Verantwortliche früh Bescheid wissen. | High     | Open   |
| FR-063 | Rollenbasiertes Routing        | Als Vorstand möchte ich pro Signaltyp konfigurieren, welche Rolle den Hinweis erhält, damit derselbe Hinweis alle Verantwortlichen seiner Ebene erreicht.        | High     | Open   |
| FR-064 | Hinweis triagieren             | Als Trainer:in möchte ich einen Hinweis mit einem Tap auf offen, in Kontakt oder gelöst setzen, damit sich niemand doppelt meldet.                               | High     | Open   |
| FR-065 | Gesprächsimpulse (Playbooks)   | Als Trainer:in möchte ich zu jedem Hinweis 2–3 anpassbare Gesprächsimpulse erhalten, damit ich weiss, wie ich das Gespräch beginne (V2).                         | Medium   | Open   |
| FR-066 | Handlungsfragen an den Verein  | Als Vorstand möchte ich zu jedem Team-/Vereinssignal eine Frage nach dem, was wir ändern können, erhalten, damit kein Schuldnarrativ entsteht (K5).              | High     | Open   |
| FR-067 | Vorstands-Signale              | Als Vorstand möchte ich eigene Signale erhalten (Kommunikationspause, gekippte Verbindungs-Quote, unbeantwortete Inputs, fehlende Nachfolge), damit Symmetrie herrscht (V5, K5). | High | Open |
| FR-068 | Verantwortungsverteilung       | Als Vorstand möchte ich den Anteil der Mitglieder sehen, die 80% der Einsätze tragen, damit ich die Konzentration von Verantwortung erkenne (K4).                | High     | Open   |
| FR-069 | Nachfolge-Vorlauf              | Als Vorstand möchte ich Ämter ohne geplante Nachfolge und mit langer Amtsdauer sehen, damit Nachfolge geplant wird, bevor sie dringend ist (K4).                 | High     | Open   |
| FR-070 | Verbindungs-Quote              | Als Vorstand möchte ich das Verhältnis von Verbindungs-Nachrichten zu Aufrufen sehen, damit wir nicht nur um Hilfe bitten (K1).                                  | High     | Open   |
| FR-071 | Spider-Selbstsicht             | Als Mitglied möchte ich meine fünf Wertdimensionen im Vergleich zu Team und Verein sehen, damit ich meine Stärke erkenne.                                        | High     | Open   |
| FR-072 | Spider-Führungssicht           | Als Trainer:in möchte ich dasselbe Diagramm für Mitglieder meines Teams als Gesprächsgrundlage sehen, damit ich individuell begleiten kann.                      | Medium   | Open   |
| FR-073 | Transparenz-Seite              | Als Mitglied möchte ich sehen, welche Signale zu mir existieren und wer sie sieht, damit ich weiss, was mein Verein weiss.                                       | High     | Open   |
| FR-074 | Health-Opt-out                 | Als Mitglied möchte ich individuelle Fürsorge-Hinweise abbestellen, damit ich nur anonym in Aggregate einfliesse.                                                | High     | Open   |
| FR-075 | Definitionskatalog             | Als Vorstand möchte ich die Definitionen von «aktiv», «Aktivierung» und den Silent-Churn-Schwellen einsehen und anpassen, damit jede Kennzahl erklärt ist (V1).  | Medium   | Open   |

### 1.6 News & Benachrichtigungen

| ID     | Titel                     | User Story                                                                                                                                            | Priority | Status      |
| ------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| FR-076 | News publizieren          | Als Vorstand möchte ich eine Vereins- oder Team-News mit Titel, Text und Bild publizieren, damit Mitglieder erfahren, was läuft.                       | High     | In Progress |
| FR-077 | News-Feed lesen           | Als Mitglied möchte ich die News meines Vereins und meiner Teams chronologisch lesen, damit ich auf dem Laufenden bin.                                 | High     | In Progress |
| FR-078 | In-App-Inbox              | Als Mitglied möchte ich jede Benachrichtigung in einer Inbox nachlesen und als gelesen markieren, damit mich nichts erreicht nur über Push.            | High     | In Progress |
| FR-079 | Push-Benachrichtigung     | Als Mitglied möchte ich Push-Benachrichtigungen auf iOS, Android und im Browser erhalten, damit ich Wichtiges rechtzeitig sehe.                        | High     | Open        |
| FR-080 | Granulare Einstellungen   | Als Mitglied möchte ich pro Kanal und Kategorie festlegen, was mich erreicht, damit die App nicht lästig wird.                                         | High     | Open        |
| FR-081 | Stille Zeiten             | Als Mitglied möchte ich Zeitfenster definieren, in denen mich kein Push erreicht, damit meine Ruhezeiten respektiert werden.                           | Low      | Open        |
| FR-082 | Vereins-Puls komponieren  | Als System möchte ich wöchentlich einen Entwurf mit «Was passiert · Woran arbeiten wir · Wo kannst du dabei sein» erzeugen, damit Verbindung Routine wird (K2). | High | Open   |
| FR-083 | Vereins-Puls freigeben    | Als Vorstand möchte ich den Puls-Entwurf in zwei Minuten prüfen und freigeben, damit der Versand wenig Zeit kostet.                                    | High     | Open        |
| FR-084 | Symmetrie-Hinweis         | Als Vorstand möchte ich gewarnt werden, wenn seit Wochen nur Aufrufe und keine Verbindungs-Nachrichten ausgingen, damit wir das Muster korrigieren (K1). | High   | Open        |

### 1.7 «Stimme»: Sprachmemos & Feedback

| ID     | Titel                     | User Story                                                                                                                                                    | Priority | Status |
| ------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| FR-085 | Sprachmemo aufnehmen      | Als Mitglied möchte ich ein Sprachmemo von maximal drei Minuten aufnehmen, damit ich sprechen statt tippen kann.                                               | High     | Open   |
| FR-086 | Transkript prüfen         | Als Mitglied möchte ich das Transkript vor dem Absenden lesen und korrigieren, damit nichts ungesehen den Verein erreicht.                                     | High     | Open   |
| FR-087 | Privates Sprachjournal    | Als Mitglied möchte ich ein Memo strikt an mich selbst richten, damit ich meine Reflexion für mich behalte.                                                    | High     | Open   |
| FR-088 | Trainer-Logbuch           | Als Trainer:in möchte ich nach dem Training ein privates Logbuch-Memo aufnehmen, damit ich meinen Saisonverlauf reflektieren kann.                             | Medium   | Open   |
| FR-089 | Gerichtetes Feedback      | Als Mitglied möchte ich ein Memo an eine Person oder eine Rolle richten, damit mein Anliegen bei der richtigen Stelle landet.                                  | High     | Open   |
| FR-090 | Anonymer Kanal            | Als Mitglied möchte ich ein Anliegen anonym an den Vorstand richten, damit ich auch Heikles ansprechen kann.                                                   | High     | Open   |
| FR-091 | Anonymer Zwei-Weg-Faden   | Als anonyme:r Einreicher:in möchte ich die Antwort des Vorstands lesen und nachfassen, ohne meine Identität preiszugeben, damit Speak-up eine Antwort bekommt. | High     | Open   |
| FR-092 | Anliegen triagieren       | Als Empfänger:in möchte ich ein Anliegen mit einem Tap auf offen, in Arbeit oder beantwortet setzen, damit nichts liegen bleibt.                               | High     | Open   |
| FR-093 | Anliegen in Aufgabe wandeln | Als Empfänger:in möchte ich aus einem Anliegen eine Aufgabe im Marktplatz erzeugen, damit aus dem Wort eine Handlung wird.                                   | Medium   | Open   |
| FR-094 | Anmahnung unbeantworteter Anliegen | Als System möchte ich unbeantwortete anonyme Anliegen beim Vorstand anmahnen, damit Listen-up verbindlich ist.                                       | High     | Open   |

### 1.8 Sitzungs-Anbindung

| ID     | Titel                     | User Story                                                                                                                                                 | Priority | Status |
| ------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| FR-095 | Sitzung als Termin        | Als Vorstand möchte ich eine Sitzung als Termin vom Typ meeting anlegen, damit Einladung, Zu-/Absage und Erinnerung wie bei jedem Termin funktionieren.      | Medium   | Open   |
| FR-096 | Einladung über Ämter      | Als Vorstand möchte ich den Teilnehmerkreis über Ämter statt Namenslisten definieren, damit der Verteiler bei Amtswechsel automatisch stimmt.                | Medium   | Open   |
| FR-097 | Input einreichen          | Als Mitglied möchte ich einen Vorschlag als Text oder Sprachmemo an ein Gremium einreichen, damit meine Idee gehört wird.                                    | High     | Open   |
| FR-098 | Input zuordnen            | Als Vorstand möchte ich einen Input laufend bearbeiten oder einer Sitzung zuordnen, damit die Einreicher:in den Stand kennt.                                 | High     | Open   |
| FR-099 | Dokumentierte Antwort     | Als Vorstand möchte ich jeden behandelten Input mit einer Antwort in 2–3 Sätzen, Datum und Gremium abschliessen, damit nichts versandet.                     | High     | Open   |
| FR-100 | «Aus dem Vorstand»        | Als Vorstand möchte ich eine Antwort optional als News publizieren, damit der Verein sieht, was aus Vorschlägen wurde.                                       | Medium   | Open   |
| FR-101 | Sitzungs-Sammelansicht    | Als Vorstand möchte ich in der Sitzung die zugeordneten offenen Anliegen plus vakante Ämter und offene Helfereinsätze sehen, damit ich keine Traktandenliste pflegen muss. | Medium | Open |

### 1.9 Kontext-Check-ins

| ID     | Titel                       | User Story                                                                                                                                                   | Priority | Status |
| ------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| FR-102 | Kontextabhängige Frage      | Als Mitglied möchte ich nach einer Teilnahme genau die Frage erhalten, die zu meiner Rolle im Ereignis passt, damit sie in unter zehn Sekunden zu beantworten ist. | High | Open |
| FR-103 | Check-in überspringen       | Als Mitglied möchte ich ein Check-in überspringen, damit die Teilnahme freiwillig bleibt.                                                                     | High     | Open   |
| FR-104 | Sichtbarkeit wählen         | Als Mitglied möchte ich pro Antwort sehen und bestimmen, wer sie sieht, damit Befinden standardmässig privat bleibt.                                          | High     | Open   |
| FR-105 | Eigener Verlauf             | Als Mitglied möchte ich meinen Zufriedenheitsverlauf über die Saison sehen, damit ich mein eigenes Erleben einordnen kann.                                    | Medium   | Open   |
| FR-106 | Team-Stimmung aggregiert    | Als Trainer:in möchte ich die Team-Stimmung nur als anonymen Aggregatwert sehen, damit keine einzelne Person rückschliessbar ist.                             | Medium   | Open   |
| FR-107 | Einsatz-Feedback            | Als Mitglied möchte ich nach einem Helfereinsatz rückmelden, was gut und was nicht lief, damit der nächste Einsatz besser wird.                               | Medium   | Open   |
| FR-108 | Selbst-Nudge                | Als Mitglied möchte ich bei anhaltend tiefen eigenen Werten gefragt werden, ob ich das teilen mag, damit Teilen mein Entscheid bleibt.                        | Medium   | Open   |
| FR-109 | Entlastungs-Index           | Als Funktionär:in möchte ich quartalsweise freiwillig angeben, wie tragfähig sich mein Amt anfühlt, damit Überlastung sichtbar wird, ohne überwacht zu werden. | Medium  | Open   |

### 1.10 Konfiguration, i18n & Theming

| ID     | Titel                       | User Story                                                                                                                                                | Priority | Status      |
| ------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| FR-110 | Sprache wählen              | Als Mitglied möchte ich zwischen Deutsch, Französisch, Italienisch und Englisch wechseln, damit ich die App in meiner Sprache nutze.                       | High     | In Progress |
| FR-111 | Vereinsfarben und Logo      | Als Vorstand möchte ich Farben und Logo des Vereins hinterlegen, damit die App zur Laufzeit im Vereins-Erscheinungsbild erscheint.                         | High     | In Progress |
| FR-112 | Begriffe konfigurieren      | Als Vorstand möchte ich die Bezeichnungen für Termintypen festlegen («Training», «Probe», «Anlass»), damit die App unsere Sprache spricht.                  | High     | In Progress |
| FR-113 | Saisonbeginn festlegen      | Als Vorstand möchte ich den Saisonbeginn setzen, damit Punkte und Ranglisten auf unsere Saison zugeschnitten sind.                                          | High     | In Progress |
| FR-114 | Vereins-DNA erfassen        | Als Vorstand möchte ich Warum, Werte, Tonalität und Traditionen hinterlegen, damit alle unterstützenden Textfunktionen unsere Sprache verwenden (K6c).      | Medium   | Open        |
| FR-115 | Progressive Aktivierung     | Als Vorstand möchte ich weitere Module erst vorgeschlagen bekommen, wenn der Verein bereit ist, damit uns die App nicht überfordert (K7).                   | High     | Open        |

### 1.11 Anschlüsse

| ID     | Titel                       | User Story                                                                                                                                                     | Priority | Status |
| ------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| FR-116 | Billing aktivieren          | Als Kassier:in möchte ich den Rechnungsdienst aus den Vereinseinstellungen aktivieren, damit wir Rechnungen stellen können, ohne die App zu wechseln.            | Medium   | Open   |
| FR-117 | Mitglieder-Sync ans Billing | Als System möchte ich Änderungen an Mitgliederstammdaten an den Rechnungsdienst übermitteln, damit dessen Debitoren-Spiegel aktuell bleibt.                      | Medium   | Open   |
| FR-118 | «Meine Rechnungen»          | Als Mitglied möchte ich meine offenen und bezahlten Rechnungen eingebettet in der App sehen, damit ich die App nicht verlassen muss.                             | Medium   | Open   |
| FR-119 | Punkte bei pünktlicher Zahlung | Als System möchte ich bei einer fristgerecht bezahlten Rechnung Punkte der Säule 6 buchen, damit Verlässlichkeit gewürdigt wird.                              | Medium   | Open   |
| FR-120 | Verband verbinden           | Als Vorstand möchte ich unseren Verband über einen API-Key verbinden, damit Spielpläne und Resultate automatisch erscheinen.                                     | Low      | Open   |
| FR-121 | API-Key validieren          | Als System möchte ich den eingegebenen API-Key mit einem Testaufruf prüfen, bevor die Verbindung aktiv wird, damit Fehler sofort sichtbar sind.                  | Low      | Open   |

### 1.12 Erstbefüllung, leere Zustände & Einführung

| ID     | Titel                          | User Story                                                                                                                                                          | Priority | Status |
| ------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| FR-134 | Beispielinhalte bei Gründung   | Als Vorstand möchte ich, dass mein neu gegründeter Verein mit Beispielinhalten startet, damit ich die App nicht leer vor mir habe und sofort sehe, wie sie gemeint ist. | High     | Open   |
| FR-135 | Beispielinhalte sind erkennbar | Als Vorstand möchte ich Beispielinhalte auf jedem Bildschirm eindeutig als solche erkennen, damit ich sie nie mit echten Vereinsdaten verwechsle.                      | High     | Open   |
| FR-136 | Beispielinhalte entfernen      | Als Vorstand möchte ich alle Beispielinhalte mit einer Aktion entfernen, damit der Verein sauber startet, sobald echte Daten vorliegen.                                | High     | Open   |
| FR-137 | Beispielinhalte verfallen      | Als System möchte ich Beispielinhalte selbsttätig entfernen, sobald der Verein eigene Inhalte derselben Art hat oder eine Frist abgelaufen ist, damit niemand aufräumen muss. | High | Open   |
| FR-138 | Beispielinhalte ohne Punkte    | Als Mitglied möchte ich, dass Beispielinhalte keine Punkte erzeugen, damit der Ledger ausschliesslich echte Beiträge enthält.                                          | High     | Open   |
| FR-139 | Beispiel-Aufgaben              | Als Vorstand möchte ich im Marktplatz Beispielaufgaben passend zu unserer Vereinsart vorfinden, damit ich sehe, wie eine gute Ausschreibung aussieht.                  | High     | Open   |
| FR-140 | Beispiel-Helfer-Event          | Als Vorstand möchte ich ein Beispiel-Helfer-Event mit Schichten vorfinden, damit ich das Schichtmodell verstehe, bevor ich unseren ersten Anlass ausschreibe.          | Medium   | Open   |
| FR-141 | Beispiel-Termine               | Als Vorstand möchte ich Beispieltermine in der Agenda vorfinden, damit Agenda, Zu-/Absage und Check-in nicht ohne Inhalt dastehen.                                     | Medium   | Open   |
| FR-142 | Einführungs-News               | Als Mitglied möchte ich beim ersten Öffnen erklärende Beiträge darüber vorfinden, wie myclub nexus funktioniert, damit ich die App ohne Schulung verstehe.             | High     | Open   |
| FR-143 | Beiträge zur Orientierung      | Als Mitglied möchte ich lesen, was Punkte bedeuten, wo ich beitragen kann und was mein Verein über mich sieht, damit ich das System einordnen kann.                    | High     | Open   |
| FR-144 | Leere Zustände mit Angebot     | Als Mitglied möchte ich auf jedem Bildschirm ohne Inhalte eine Erklärung und mindestens ein Handlungsangebot sehen, damit ich nie vor einer leeren Fläche stehe.       | High     | Open   |
| FR-145 | Demo-Verein zum Ausprobieren   | Als Interessent möchte ich einen vollständig befüllten Demo-Verein betreten, damit ich die App beurteilen kann, ohne einen echten Verein anzulegen.                    | Medium   | Open   |

### 1.13 Bewusst verschoben (Post-MVP)

| ID     | Titel                        | User Story                                                                                                                                        | Priority | Status   |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| FR-122 | Badges                       | Als Mitglied möchte ich Badges für besondere Leistungen sammeln, damit meine Erfolge sichtbar werden.                                              | Low      | Deferred |
| FR-123 | Level-System                 | Als Mitglied möchte ich ein Level mit Fortschrittsbalken sehen, damit langfristiger Einsatz sichtbar wird.                                         | Low      | Deferred |
| FR-124 | Challenges                   | Als Trainer:in möchte ich zeitgebundene Team-Challenges ausschreiben, damit das Team gemeinsam ein Ziel verfolgt.                                  | Low      | Deferred |
| FR-125 | Rewards-Shop                 | Als Mitglied möchte ich Punkte gegen Belohnungen einlösen, damit sich Einsatz zusätzlich lohnt.                                                    | Low      | Deferred |
| FR-126 | Funktionärsämter mit Factsheet | Als Vorstand möchte ich Ämter mit Pflichtenheft, Aufwand und Punktwert hinterlegen, damit Interessierte wissen, worauf sie sich einlassen.        | Low      | Deferred |
| FR-127 | Vakanz-Anzeige               | Als Mitglied möchte ich vakante Ämter im Marktplatz sehen, damit ich eine Lücke füllen kann.                                                       | Low      | Deferred |
| FR-128 | Meisterschaft                | Als Mitglied möchte ich Spielpläne, Resultate und Tabellen sehen, damit ich den Meisterschaftsverlauf verfolge.                                    | Low      | Deferred |
| FR-129 | Eltern und Kinder            | Als Elternteil möchte ich mit dem Konto meines Kindes verknüpft sein und stellvertretend antworten, damit Juniorenvereine die App nutzen können.   | Low      | Deferred |
| FR-130 | Mitglieder-Export            | Als Vorstand möchte ich Mitgliederdaten mit wählbaren Feldern exportieren, damit ich sie extern weiterverwenden kann.                              | Low      | Deferred |
| FR-131 | J+S-Export                   | Als Vorstand möchte ich Anwesenheiten im AWK-Format exportieren, damit die J+S-Abrechnung ohne Doppelerfassung läuft.                              | Low      | Deferred |
| FR-132 | Bulk-Import                  | Als Vorstand möchte ich Mitglieder per CSV importieren und personalisiert einladen, damit die Migration eines Bestandsvereins gelingt.             | Low      | Deferred |
| FR-133 | Kalender-Publishing          | Als Vorstand möchte ich ausgewählte Termintypen als ICS-Feed und Website-Widget publizieren, damit die Vereinswebsite aktuell bleibt.              | Low      | Deferred |

---

## 2. Nicht-funktionale Anforderungen

| ID      | Titel                          | Anforderung                                                                                                                                        | Category        | Priority | Status |
| ------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------- | ------ |
| NFR-001 | Kaltstart                      | Der Kaltstart der App bis zum interaktiven Dashboard dauert höchstens 3 Sekunden.                                                                   | Performance     | High     | Open   |
| NFR-002 | Listenaufbau                   | Listenansichten mit 500 Mitgliedern werden in höchstens 2 Sekunden vollständig dargestellt.                                                          | Performance     | High     | Open   |
| NFR-003 | Push-Latenz                    | Eine ausgelöste Benachrichtigung erreicht das Endgerät in höchstens 60 Sekunden.                                                                     | Performance     | High     | Open   |
| NFR-004 | Punktebuchung                  | Eine Punktebuchung über eine Datenbankfunktion wird in höchstens 500 Millisekunden quittiert.                                                        | Performance     | Medium   | Open   |
| NFR-005 | Leaderboard-Aktualität         | Die Rangliste ist höchstens 5 Minuten alt (Refresh-Intervall der materialisierten Sicht).                                                            | Performance     | Medium   | Open   |
| NFR-006 | Vereinsgrösse                  | Ein Verein mit 500 Mitgliedern und 30 Teams wird ohne Antwortzeitverschlechterung gegenüber NFR-001 bis NFR-003 unterstützt.                          | Scalability     | High     | Open   |
| NFR-007 | Mandantenanzahl                | Die Plattform trägt 1'000 Vereine ohne Architekturwechsel.                                                                                          | Scalability     | Medium   | Open   |
| NFR-008 | Verfügbarkeit                  | Die Verfügbarkeit entspricht dem Uptime-SLA der Supabase-Plattform (99.9% monatlich, supabase.com/sla); eigene Zusagen darüber hinaus bestehen nicht. | Availability    | High     | Open   |
| NFR-009 | Push-Fallback                  | 100% der Mitglieder erreichen alle Benachrichtigungen über die In-App-Inbox, auch ohne erteilte Push-Berechtigung.                                   | Availability    | High     | Open   |
| NFR-010 | Offline-Check-in               | Check-ins ohne Netzverbindung werden bis zu 24 Stunden gepuffert und beim nächsten Verbindungsaufbau serverseitig validiert nachgesendet.             | Availability    | Medium   | Open   |
| NFR-011 | Mandantentrennung              | 100% der Tabellen mit Vereinsbezug erzwingen die Trennung über Row Level Security; kein Zugriff über Vereinsgrenzen ist möglich.                      | Security        | High     | Open   |
| NFR-012 | Schreibpfad Punkte             | `point_transactions` besitzt keine insert-, update- oder delete-Policy; der einzige Schreibpfad sind `security definer`-Funktionen.                   | Security        | High     | In Progress |
| NFR-013 | Funktionsrechte                | Interne Datenbankfunktionen entziehen `public`, `anon` und `authenticated` das Ausführungsrecht; nur bewusst freigegebene RPCs bleiben erreichbar.    | Security        | High     | In Progress |
| NFR-014 | Transportverschlüsselung       | Sämtlicher Datenverkehr zwischen Client und Backend nutzt TLS 1.2 oder höher.                                                                        | Security        | High     | Open   |
| NFR-015 | Secrets                        | API-Keys, APNs-Schlüssel und VAPID-Schlüssel liegen ausschliesslich im Vault bzw. in Function-Secrets, nie in der Datenbank im Klartext oder im Repo. | Security        | High     | Open   |
| NFR-016 | QR-Token-Gültigkeit            | Ein Check-in-QR-Code ist nur von 30 Minuten vor Terminbeginn bis Terminende gültig.                                                                  | Security        | High     | In Progress |
| NFR-017 | Dedup des Ledgers              | Eine zweite Buchung zur Kombination aus Mitglied, Regel und Quelle wird verworfen; Doppelbuchungen sind ausgeschlossen.                              | Security        | High     | In Progress |
| NFR-018 | Rollenreichweite Health        | Trainer:innen lesen Gesundheitssignale ausschliesslich für ihre eigenen Teams, Sportchef:innen für ihren Bereich, der Vorstand vereinsweit.           | Security        | High     | Open   |
| NFR-019 | Anonymität ohne Autorschaft    | Bei anonymen Beiträgen existiert keine Spalte, die die Autorschaft aufnehmen könnte; der Zeitstempel wird auf die Kalenderwoche vergröbert.           | Security        | High     | Open   |
| NFR-020 | Mindestgruppengrösse           | Stimmungs-Aggregate werden erst ab 5 Antworten im Zeitfenster angezeigt, darunter gar nicht.                                                          | Security        | High     | Open   |
| NFR-021 | Verfall statt Akte             | Gelöste und abgelaufene Gesundheitssignale werden physisch gelöscht; es entsteht keine Historie über die Saison hinaus.                              | Security        | High     | Open   |
| NFR-022 | Keine Verhaltensdaten          | Es existieren keine Tabellen für App-Nutzung, Lesebestätigungen pro Person oder Standortdaten.                                                        | Security        | High     | Open   |
| NFR-023 | Datenlokation                  | Sämtliche Personendaten liegen in der Region Zürich; Audio verlässt für private Memos das Endgerät nicht.                                            | Security        | High     | Open   |
| NFR-024 | Gründungsdauer                 | Ein Verein ist in höchstens 3 Minuten gegründet, ein Mitglied tritt in höchstens 60 Sekunden bei.                                                     | Usability       | High     | Open   |
| NFR-025 | Triage-Aufwand                 | Ein Fürsorge-Hinweis ist in weniger als 10 Sekunden triagierbar; gleichzeitig offene Hinweise pro Team sind gedeckelt.                                | Usability       | High     | Open   |
| NFR-026 | Check-in-Dauer                 | Ein Kontext-Check-in ist in weniger als 10 Sekunden beantwortbar; höchstens eine Check-in-Serie pro Mitglied und Tag wird ausgelöst.                  | Usability       | High     | Open   |
| NFR-027 | Barrierefreiheit               | Die App erfüllt WCAG 2.1 Stufe AA für alle Kernflüsse (Anmeldung, Agenda, Check-in, Dashboard).                                                       | Usability       | Medium   | Open   |
| NFR-028 | Sprachparität                  | Alle vier Sprachdateien enthalten dieselben Schlüssel; `npm run i18n:check` läuft ohne Abweichung durch.                                              | Usability       | High     | In Progress |
| NFR-029 | Sprachmemo-Länge               | Ein Sprachmemo dauert höchstens 3 Minuten; das Transkript liegt in höchstens 60 Sekunden vor.                                                         | Performance     | Medium   | Open   |
| NFR-030 | Fair-Use Transkription         | Im Basis-Abo sind 20 Memos pro Mitglied und Monat inbegriffen; das Limit wird serverseitig geprüft.                                                   | Performance     | Low      | Open   |
| NFR-031 | Exit-Fähigkeit                 | Der gesamte Stack ist ohne Codeänderung auf eine selbst gehostete Supabase-Instanz umziehbar; es wird kein proprietärer Dienst verwendet.             | Portability     | High     | Open   |
| NFR-032 | Eine Codebasis                 | iOS, Android und PWA werden aus einer Codebasis erzeugt; es gibt keine plattformspezifischen Feature-Zweige.                                          | Portability     | High     | In Progress |
| NFR-033 | Typsicherheit                  | `npm run build` (tsc -b) und `npm run typecheck` laufen ohne Fehler durch.                                                                            | Maintainability | High     | In Progress |
| NFR-034 | Punktequellen als Funktion     | 100% der Punktequellen sind als Datenbankfunktion implementiert; keine Punktelogik liegt im Frontend.                                                 | Maintainability | High     | In Progress |
| NFR-035 | Saisonlogik konsistent         | `season_label()` in SQL und `seasonLabel()` in TypeScript liefern für jedes Datum dasselbe Ergebnis; eine Abweichung ist ein Fehler.                   | Maintainability | High     | In Progress |
| NFR-036 | Generierte Typen getrennt      | Handgepflegte Typen liegen ausserhalb der generierten Datei; ein Lauf von `types:generate` verändert keine handgepflegte Deklaration.                  | Maintainability | High     | In Progress |
| NFR-037 | Kein leerer Bildschirm         | Jede Listen- und Übersichtsansicht zeigt bei fehlenden Daten einen erklärenden Zustand mit mindestens einem Handlungsangebot; die Zahl der Ansichten ohne solchen Zustand ist null. | Usability       | High     | Open   |
| NFR-038 | Erstbefüllung ohne Aufwand     | Ein neu gegründeter Verein zeigt auf allen fünf Tabs Inhalte, ohne dass der Vorstand etwas erfasst; das Entfernen aller Beispielinhalte kostet höchstens eine Aktion.              | Usability       | High     | Open   |

---

## 3. Rahmenbedingungen (Constraints)

| ID    | Titel                          | Constraint                                                                                                                                             | Category    | Priority | Status      |
| ----- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | -------- | ----------- |
| C-001 | Frontend-Stack                 | Die App wird mit Ionic React 9 und Capacitor 8 gebaut; Routing über React Router 6.                                                                     | Technical   | High     | In Progress |
| C-002 | Backend-Plattform              | Das gesamte Backend läuft auf Supabase (PostgreSQL, Edge Functions in Deno, pg_cron, Storage, Realtime); es gibt keinen zusätzlichen Applikationsserver. | Technical   | High     | In Progress |
| C-003 | Keine Google-Abhängigkeit      | Firebase, FCM, Google Maps, Google ML Kit und Google-Login sind ausgeschlossen; auch «Sign in with Apple» entfällt dadurch.                              | Technical   | High     | In Progress |
| C-004 | Push-Kanäle                    | Push läuft über ntfy/UnifiedPush (Android), APNs (iOS) und Web Push VAPID (PWA), mit der In-App-Inbox als vollständigem Fallback.                        | Technical   | High     | Open        |
| C-005 | QR-Scan ohne Google            | QR-Codes werden mit `html5-qrcode` im WebView gescannt, nicht mit einem nativen Google-SDK.                                                              | Technical   | High     | In Progress |
| C-006 | Karten                         | Kartendarstellungen nutzen MapLibre GL mit swisstopo- oder OpenStreetMap-Kacheln.                                                                        | Technical   | Low      | Open        |
| C-007 | Vier Sprachen ab Commit eins   | Jeder neue Benutzertext existiert in Deutsch, Französisch, Italienisch und Englisch; `npm run i18n:check` erzwingt die Parität.                          | Technical   | High     | In Progress |
| C-008 | Sprachtrennung im Code         | Bezeichner im Code sind englisch, Benutzertexte laufen über react-i18next, Kommentare und Dokumentation sind deutsch.                                    | Technical   | High     | In Progress |
| C-009 | Kein Sport-Vokabular im Kern   | «Training», «Spiel» und «Probe» sind konfigurierbare Vereinslabels; die Datenbank kennt nur `events.type`.                                               | Technical   | High     | In Progress |
| C-010 | Schreibpfad Punkte             | Punkte gelangen ausschliesslich über `security definer`-Funktionen in den Ledger; Clients erhalten keine insert-Berechtigung.                            | Technical   | High     | In Progress |
| C-011 | Rollenprüfung serverseitig     | Berechtigungen werden in RLS-Policies oder Datenbankfunktionen geprüft, nie ausschliesslich im Frontend.                                                 | Technical   | High     | In Progress |
| C-012 | Deep-Link-Schema               | Das Schema `ch.myclub.nexus` ist in `capacitor.config.ts`, `Info.plist`, `AndroidManifest.xml` und den Supabase-Auth-Redirect-URLs konsistent zu halten. | Technical   | High     | In Progress |
| C-013 | Laufzeit-Theming               | Vereinsspezifisches Erscheinungsbild entsteht zur Laufzeit aus `clubs.settings`; es gibt keine vereinsspezifischen Build-Konfigurationen.                | Technical   | High     | In Progress |
| C-014 | Billing ausgelagert            | Rechnungsstellung, QR-Rechnung, Perioden, Positionen, Mahnwesen und Zahlungsabgleich liegen im eigenständigen Dienst «myclub Billing», nicht in der App. | Technical   | High     | Open        |
| C-015 | Rechnungs-Spiegel              | Die App kennt zu einer Rechnung nur Betrag, Fälligkeit, Status und Link; alle weiteren Rechnungsdaten bleiben im Billing-Dienst.                         | Technical   | High     | Open        |
| C-016 | Verbands-Anbindung             | Verbandsdaten werden ausschliesslich über einen API-Key pro Verein bezogen; ein globaler Presync und ein Vereinsverzeichnis existieren nicht.            | Technical   | Medium   | Open        |
| C-017 | Ein Punkte-Ledger              | Es gibt genau einen Punkte-Ledger; ein separates Helferpunkte-Konto mit Soll- und Schwellwerten wird nicht gebaut.                                       | Technical   | High     | In Progress |
| C-018 | Souveräne Transkription        | Sprachmemos werden auf dem Gerät oder auf einer selbst betriebenen Whisper-Instanz transkribiert; US-Transkriptions-APIs sind ausgeschlossen.            | Technical   | High     | Open        |
| C-019 | Datenschutzrecht               | Die Plattform erfüllt das revidierte Schweizer Datenschutzgesetz; Vereine sind Verantwortliche ihrer Mitgliederdaten.                                    | Regulatory  | High     | Open        |
| C-020 | Datenschutz-Folgenabschätzung  | Für das Gesundheits-Profiling liegt vor dem Launch eine Datenschutz-Folgenabschätzung vor; ein KI-Register wird ab Tag eins geführt (V6).                | Regulatory  | High     | Open        |
| C-021 | Zweckbindung Health            | Gesundheitsdaten bezahlter Funktionär:innen dürfen nicht für Anstellungsentscheide verwendet werden; automatische Konsequenzen sind ausgeschlossen (V6). | Regulatory  | High     | Open        |
| C-022 | Jugendschutz                   | Für Mitglieder unter 16 Jahren ist die Einwilligung der Erziehungsberechtigten erforderlich; öffentliche Profile existieren nicht.                       | Regulatory  | High     | Open        |
| C-023 | Kontolöschung                  | Die Kontolöschung ist in der App erreichbar (Auflage von App Store und Play Store); die Punktehistorie bleibt anonymisiert erhalten.                     | Regulatory  | High     | Open        |
| C-024 | Lizenz                         | Der Quellcode steht unter der EUPL v1.2.                                                                                                                | Regulatory  | Medium   | Open        |
| C-025 | Hosting                        | Betrieb startet auf Managed Supabase in der Region Zürich; der Wechsel auf Schweizer Self-Hosting bleibt jederzeit möglich.                              | Operational | High     | Open        |
| C-026 | Anti-Überwachung by Design     | Signale entstehen nur aus Teilnahmedaten; Export individueller Gesundheitsdaten, Sortierung nach Gesundheit und Volltextsuche über fremde Memos fehlen.  | Operational | High     | Open        |
| C-027 | Entlastungs-Test               | Jede neue Funktion weist aus, welche Vorstandszeit sie spart und welche sie kostet; netto negative Funktionen werden nicht gebaut (K6b).                 | Business    | High     | Open        |
| C-028 | Abgrenzung nach aussen         | Kein Chat, kein öffentlicher Bereich (Ausnahme: opt-in publizierte Termine), keine Buchhaltung, kein Schreibzugriff auf Verbandssysteme.                 | Business    | High     | Open        |
| C-029 | Inkrement-Reihenfolge          | Die Umsetzung folgt den Inkrementen M1 Fundament, M2 Agenda-Loop, M3 Gemeinschaft, M4 Anschlüsse; Anschlüsse werden nicht vorgezogen.                    | Schedule    | High     | In Progress |
| C-030 | Sichtbarkeit nach Struktur     | Kalender-Publishing und Grafik-Partner werden erst freigeschaltet, wenn die innere Struktur des Vereins steht, und nie einzeln verkauft (K6a).            | Business    | Medium   | Open        |
| C-031 | Beispielinhalte sind folgenlos | Beispielinhalte erzeugen keine Punktebuchung, kein Gesundheitssignal und keine Benachrichtigung und hinterlassen dem Vorstand keine Aufräumarbeit (Entlastungs-Test K6b).             | Business    | High     | Open        |

---

## 4. Offene Punkte

| # | Thema | Frage | Betrifft |
|---|---|---|---|
| 1 | Sportchef:in als Rolle | `club_members.role` kennt heute member, trainer, admin, superadmin. Das rollenbasierte Hinweis-Routing verlangt zusätzlich eine Bereichsrolle. Eigene Rolle oder Konfiguration über Teams? | FR-063, NFR-018 |
| 2 | Definition «aktiv» | Die Standardschwellen des Definitionskatalogs (aktiv, Aktivierung, Silent Churn) sind noch nicht beziffert. | FR-075, FR-062 |
| 3 | Deckel offener Hinweise | Die konkrete Obergrenze gleichzeitig offener Fürsorge-Hinweise pro Team ist offen. | NFR-025 |
| 4 | Aufbewahrung Sprachmemos | Für nicht-anonyme Memos ist die Aufbewahrungsdauer des Transkripts noch nicht festgelegt. | FR-085, C-019 |
| 5 | Verfallsfrist Beispielinhalte | Nach welcher Frist Beispielinhalte spätestens verschwinden, ist noch nicht festgelegt (Vorschlag: 30 Tage oder erster eigener Inhalt derselben Art). | FR-137 |

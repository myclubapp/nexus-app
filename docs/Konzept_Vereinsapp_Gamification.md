# Konzept: Vereins-App mit Gamification
## «TeamSpirit» – Engagement sichtbar machen, Wertschätzung erlebbar machen

---

## 1. Vision & Leitgedanke

Schweizer Vereine leben vom freiwilligen Engagement ihrer Mitglieder – doch dieses Engagement bleibt oft unsichtbar. **TeamSpirit** macht den Einsatz jedes einzelnen Mitglieds sichtbar, würdigt ihn spielerisch und stärkt so den Zusammenhalt im Verein.

**Kernprinzipien:**

- **Verbindung vor Aufruf** – Mitglieder erfahren regelmässig, was passiert, woran gearbeitet wird und wo sie dabei sein können, bevor sie um Hilfe gebeten werden. Jeder Aufruf trägt sein Warum. (Voicible-Manifest, Korrekturen K1–K3)
- **Spass vor Druck** – Die Gamification soll motivieren, nie unter Druck setzen. Es geht um positive Verstärkung, nicht um Bestrafung bei Inaktivität.
- **Sinn ist der Motor, Punkte machen ihn sichtbar** – Wertschätzung verstärkt intrinsische Motivation, sie ersetzt sie nicht (V7).
- **Wertschätzung im Zentrum** – Jeder Beitrag zählt: ob Torschützin, Helfer am Grillstand oder treues Mitglied seit 20 Jahren.
- **Gemeinschaft stärken** – Team- und Vereins-Leaderboards fördern das Wir-Gefühl, nicht den Einzelkampf.
- **Schweizer Vereinskultur respektieren** – Die App berücksichtigt die Eigenheiten des Schweizer Vereinswesens (Milizprinzip, GV-Pflicht, J+S-Strukturen, Mehrsprachigkeit).

---

## 2. Zielgruppen

### Phase 1: Schweizer Sportvereine
- Fussball-, Unihockey-, Handball-, Volleyball-, Turnvereine etc.
- Vereine mit 30–500 Mitgliedern (Breitensport-Fokus)
- Vereinsvorstände, Trainer:innen, Mitglieder aller Altersgruppen

### Phase 2: Erweiterung auf Nicht-Sportvereine
- Musikvereine, Kulturvereine, Schützenvereine, Samaritervereine
- Jugendorganisationen (Pfadi, Jungwacht/Blauring, Cevi)
- Quartiervereine, Dorfvereine

### Rollen im System
| Rolle | Beschreibung |
|---|---|
| **Mitglied** | Sieht eigenes Dashboard, sammelt Punkte, nimmt an Challenges teil |
| **Trainer:in / Leiter:in** | Kann Anwesenheiten erfassen, Punkte manuell vergeben |
| **Vorstand / Admin** | Konfiguriert Punktesystem, verwaltet Mitglieder, sieht Statistiken |
| **Vereins-Superadmin** | Verwaltet den gesamten Verein, Teams und Einstellungen |

---

## 3. Funktionsübersicht

### 3.1 Klassische Vereinsverwaltung (Basis)
- Mitgliederverwaltung (Stammdaten, Kontakte, Notfallkontakte)
- Teamzuordnung (Mitglieder können mehreren Teams angehören)
- Anwesenheitserfassung (Training, Spiele, Events)
- Eventkalender mit Anmeldung
- Kommunikation (Push-Nachrichten, Vereins-News)
- Dokumentenablage (Statuten, Protokolle, Reglemente)

### 3.2 Gamification-System (Kernmodul)
- Punktesammeln über diverse Aktivitäten
- Persönliches Dashboard mit Punktestand und Fortschritt
- Badges & Auszeichnungen
- Level-System
- Team- und Vereins-Leaderboards
- Challenges & Saisonziele
- Belohnungssystem (Rewards)

### 3.3 Aufgaben-Marktplatz
- Verantwortliche erstellen Vereinsaufgaben (Matchberichte, Trikotwäsche, Fotos etc.)
- Mitglieder wählen Aufgaben freiwillig aus und erledigen sie
- Bestätigung durch Verantwortliche → Punkte werden gutgeschrieben
- Einmalige, wiederkehrende und saisonale Aufgaben
- **Funktionärsämter mit digitalem Factsheet** (Pflichtenheft, Aufwand, Punktwert, Ansprechperson)
- **Vakanz-Anzeige**: Unbesetzte Ämter werden aktiv beworben
- Transparente Verteilung: Wer hat wie viel übernommen?

---

## 4. Das Punktesystem im Detail

### 4.1 Punktekategorien

Das Punktesystem basiert auf sieben Säulen, die gemeinsam das volle Vereinsengagement abbilden:

**Säule 1 – Trainingsengagement**

| Aktion | Punkte | Hinweise |
|---|---|---|
| Trainingsteilnahme | 10 | Pro Einheit |
| Trainingsserie (4 Wochen ohne Ausfall) | 25 Bonus | Streak-Belohnung |
| Trainingsserie (8 Wochen) | 60 Bonus | Grösserer Streak |
| Pünktlichkeit (vor Trainingsbeginn da) | 2 | Optional aktivierbar |

**Säule 2 – Wettkampf & Meisterschaft**

| Aktion | Punkte | Hinweise |
|---|---|---|
| Meisterschaftsspiel (Teilnahme) | 20 | Spieler:in auf dem Feld |
| Cupspiel (Teilnahme) | 20 | — |
| Turnierteilnahme | 25 | Ganzer Turniertag |
| Auswärtsspiel (extra Einsatz) | 5 Bonus | Zusätzlich zur Spielprämie |
| Als Ersatzspieler:in dabei | 15 | Bereitschaft wird belohnt |

**Säule 3 – Freiwilliges Engagement & Helfereinsätze**

| Aktion | Punkte | Hinweise |
|---|---|---|
| Helfereinsatz (halber Tag) | 30 | z.B. Festwirtschaft, Aufbau |
| Helfereinsatz (ganzer Tag) | 50 | — |
| Schiedsrichter-/Kampfrichtereinsatz | 35 | — |
| Kuchen backen / Verpflegung | 15 | — |
| Fahrdienst (Jugendliche zu Spielen) | 20 | Pro Einsatz |
| Vorstandsarbeit (pro Quartal) | 40 | Ehrenamt |
| Organisationsleitung Event | 50 | Hauptverantwortung |

**Säule 4 – Vereinsleben & Teilnahme**

| Aktion | Punkte | Hinweise |
|---|---|---|
| Generalversammlung (Teilnahme) | 30 | Wichtig für Vereinskultur |
| Vereinsanlass (z.B. Vereinsreise, Bankett) | 20 | — |
| Sponsorenlauf / Charity-Event | 25 | — |
| Vereinsfoto-Termin | 10 | — |
| Social Media: Vereinsbeitrag teilen | 5 | Max. 3x pro Woche |

**Säule 5 – Wachstum & Treue**

| Aktion | Punkte | Hinweise |
|---|---|---|
| Neues Mitglied geworben | 50 | Nach 3 Monaten Mitgliedschaft bestätigt |
| Vereinstreue: 1 Jahr | 20 | Automatisch |
| Vereinstreue: 5 Jahre | 50 | Automatisch |
| Vereinstreue: 10 Jahre | 100 | Automatisch + Badge |
| Vereinstreue: 20 Jahre | 200 | Automatisch + Spezialbadge |
| Gotti/Götti für Neumitglied | 30 | Mentoring-Programm |

**Säule 6 – Verlässlichkeit & Administration**

Diese Säule belohnt Mitglieder, die ihre administrativen Pflichten zuverlässig und pünktlich erledigen – das Rückgrat jedes funktionierenden Vereins.

| Aktion | Punkte | Hinweise |
|---|---|---|
| Vereinsrechnung pünktlich bezahlt | 30 | Innerhalb der Zahlungsfrist |
| Vereinsrechnung per Lastschrift/eBill | 10 Bonus | Einmalig bei Einrichtung, entlastet Kassier:in |
| Profil vollständig ausgefüllt | 15 | Einmalig (Notfallkontakt, Adresse, Foto) |
| Saisonanmeldung fristgerecht | 15 | Vor dem gesetzten Stichtag |
| Abwesenheitsmeldung rechtzeitig | 5 | Abmeldung >24h vor Training/Spiel |
| Formulare/Dokumente eingereicht | 10 | z.B. J+S-Formulare, Arztzeugnis, Lizenzantrag |
| Umfrage/Abstimmung beantwortet | 5 | z.B. Doodle, Vereinsumfrage |

**Säule 7 – Aufgaben-Marktplatz (Vereins-Tasks)**

Der Aufgaben-Marktplatz ist ein zentrales neues Modul: Trainer:innen, Vorstände oder Teamverantwortliche können Aufgaben ausschreiben, die von Mitgliedern freiwillig übernommen und erledigt werden. So werden wichtige Vereinsarbeiten verteilt, sichtbar gemacht und belohnt.

*Funktionsweise:*
1. Ein:e Verantwortliche:r erstellt eine Aufgabe mit Beschreibung, Frist und Punktwert.
2. Die Aufgabe erscheint im «Aufgaben-Marktplatz» der App (filterbar nach Team/Verein/Kategorie).
3. Ein Mitglied wählt eine Aufgabe aus und reserviert sie («Ich übernehme das»).
4. Nach Erledigung markiert das Mitglied die Aufgabe als erledigt und reicht ggf. einen Nachweis ein (z.B. Link zum Matchbericht).
5. Ein:e Verantwortliche:r bestätigt die Erledigung → Punkte werden gutgeschrieben.

*Beispiel-Aufgaben und Punktwerte:*

| Aufgabe | Punkte | Kategorie |
|---|---|---|
| Matchbericht schreiben (Vereinszeitung) | 25 | Kommunikation |
| Matchbericht schreiben (Webseite/Blog) | 20 | Kommunikation |
| Social-Media-Post erstellen (mit Foto/Video) | 15 | Kommunikation |
| Fotos/Videos am Spieltag machen | 15 | Kommunikation |
| Sponsorenlogo-Pflege auf Webseite | 10 | Administration |
| Trainingsmaterial inventarisieren | 15 | Materialwart |
| Trikots waschen | 15 | Materialwart |
| Garderobe/Vereinslokal aufräumen | 15 | Infrastruktur |
| Platz herrichten / Linien ziehen | 20 | Infrastruktur |
| Neue Mitglieder am ersten Training begleiten | 15 | Betreuung |
| Getränke/Snacks für Teamanlass organisieren | 15 | Verpflegung |
| Vereinsevent-Deko aufbauen/abbauen | 15 | Helfereinsatz |
| Übersetzung eines Vereinstexts (FR/IT/EN) | 20 | Kommunikation |
| Statistik führen am Spieltag | 15 | Spielbetrieb |
| GV-Protokoll schreiben | 30 | Administration |
| Vereinsarchiv pflegen (Fotos, Ergebnisse) | 15 | Archiv |

*Aufgaben-Typen:*
- **Einmalige Aufgaben**: z.B. «Matchbericht Spiel vs. FC Beispiel am 15.3.» – wird einmal erledigt und ist dann geschlossen.
- **Wiederkehrende Aufgaben**: z.B. «Trikots waschen nach jedem Heimspiel» – wird jede Runde neu ausgeschrieben.
- **Daueraufgaben / Saisonrollen**: z.B. «Social-Media-Verantwortliche:r für die Rückrunde» – grösserer Punktebonus für langfristiges Commitment (z.B. 100 Punkte bei Saisonende).
- **Funktionärsämter**: Offizielle Vereinsämter mit Pflichtenheft, die über eine ganze Saison (oder länger) besetzt werden – siehe nachfolgender Abschnitt.

*Funktionärsämter (Saisonrollen mit Pflichtenheft)*

Funktionärsämter sind das Rückgrat des Vereins. In der App werden sie als besondere Form der Saisonrolle abgebildet – mit hinterlegtem **Factsheet** (Pflichtenheft), geschätztem **Stundenaufwand pro Saison**, **Ansprechperson** und **Punktwert**. Die App zeigt jederzeit, welche Ämter besetzt und welche **vakant** sind – vakante Ämter erscheinen prominent im Aufgaben-Marktplatz als «Amt zu vergeben».

Die folgende Ämterliste basiert auf der realen Praxis eines Schweizer Unihockeyvereins. Der Verein arbeitet dort bereits mit Helferpunkten (Skala 1–7 pro Saison); für die App wird dieser Wert in App-Punkte umgerechnet (Vorschlag: 1 Helferpunkt = 50 App-Punkte, gutgeschrieben bei Saisonende):

| Funktionärsamt | Aufwand/Saison | Helferpunkte (Vereinsskala) | App-Punkte/Saison |
|---|---|---|---|
| Kassier:in | 10h+ | 7 | 350 |
| Trainer:in Aktivteam (H1/H2/Damen) | 60h+ | 4 (+ Lohn) | 200 |
| Juniorentrainer:in | 60h+ | 4 (+ Lohn) | 200 |
| Schiedsrichter:in | 60h+ | 3 (+ Lohn + Spesen) | 150 |
| Spielsekretär:in (Turniertage, Liveticker) | ca. 48h (12 Spiele à 4h, geteilt) | 4 | 200 |
| Pressechef:in (Spielberichterstattung, Medien) | 12h | 4 | 200 |
| Webmaster (Website-Inhalte & -Wartung) | 12h+ | 4 | 200 |
| Hallenverantwortliche:r (Hallenplan, Garderoben, Turniervergabe) | 12h | 4 | 200 |
| Verantwortliche:r Hallenkoordination Partnerorganisation | 12h | 4 | 200 |
| Social-Media-Verantwortliche:r (Redaktionsplan, Posts, Collabs) | 4–16h | 1–4 | 50–200 |
| Eventorganisator:in (Vereinsanlässe beleben) | 4h+ | 1–4 | 50–200 |
| Streetfloorball-Verantwortliche:r (Location, Aufbau, Werbung) | 4h+ | 4 | 200 |
| OK-Mitglied Jubiläum (z.B. Festwirtschaft, Rahmenprogramm) | nach Bedarf | 4 | 200 |
| Schiedsrichterobmann/-frau (Koordination, Rekrutierung) | 8h | 2 | 100 |
| Apothekenverantwortliche:r (Sanitätsmaterial) | 3h | 2 | 100 |
| Revisor:in (Prüfung Buchhaltung, Revisionsbericht) | 2h | 1 | 50 |

*So funktionieren Funktionärsämter in der App:*
- **Factsheet hinterlegt**: Jedes Amt hat ein digitales Factsheet mit Pflichten, Aufwand, Punktwert und Ansprechperson – Interessierte wissen sofort, worauf sie sich einlassen.
- **Vakanz-Anzeige**: Unbesetzte Ämter (z.B. «H1-Trainer:in gesucht», «3 Schiedsrichter:innen vakant») werden im Marktplatz und optional per Push beworben. Das löst ein reales Vereinsproblem: die Suche nach Freiwilligen für Ämter.
- **Mehrfachbesetzung**: Ämter können von mehreren Personen geteilt werden (z.B. 4 Spielsekretär:innen teilen sich 12 Spiele, 11 Juniorentrainer:innen betreuen die Teams) – die Punkte werden entsprechend aufgeteilt oder pro Person vergeben.
- **Punktegutschrift bei Saisonende**: Die App-Punkte für Ämter werden am Saisonende gutgeschrieben (oder quartalsweise anteilig), sobald die Ansprechperson bzw. der Vorstand die Amtsausübung bestätigt.
- **Kombination mit Lohn/Spesen möglich**: Manche Ämter (Trainer:innen, Schiedsrichter:innen) sind zusätzlich entschädigt – die App-Punkte ersetzen keine Entschädigung, sondern ergänzen die Wertschätzung.
- **Amtsjubiläen**: Wer ein Amt mehrere Saisons ausübt, erhält Treue-Boni und Badges (z.B. «5 Jahre Kassier:in»).

*Design-Prinzipien des Aufgaben-Marktplatzes:*
- **Freiwilligkeit**: Niemand wird zu einer Aufgabe gezwungen. Die Aufgaben sind Angebote.
- **Faire Verteilung**: Die App zeigt an, wie viele Aufgaben ein Mitglied bereits übernommen hat – so wird sichtbar, wenn immer dieselben Personen anpacken.
- **Qualitäts-Feedback**: Verantwortliche können bei der Bestätigung ein kurzes Feedback geben («Super Matchbericht, danke!»), das als Kudos auf dem Profil erscheint.
- **Dringlichkeit sichtbar**: Aufgaben mit bald ablaufender Frist werden hervorgehoben.

### 4.2 Konfigurierbarkeit

Jeder Verein muss das Punktesystem an seine Bedürfnisse anpassen können:

- **Punktwerte sind pro Verein konfigurierbar** – Die oben genannten Werte sind Vorschläge (Templates).
- **Kategorien können aktiviert/deaktiviert werden** – Ein reiner Breitensportverein braucht evtl. keine Wettkampf-Punkte.
- **Eigene Aktionen können erstellt werden** – z.B. «Beitrag ans Vereinsheft geschrieben» (15 Punkte).
- **Saisonale Anpassungen** – Punkte können pro Saison zurückgesetzt oder kumuliert werden.

---

## 5. Badges & Auszeichnungen

Badges machen besondere Leistungen sichtbar und sind sammelbar. Sie erscheinen auf dem Profil des Mitglieds.

### Beispiel-Badges

| Badge | Bedingung | Symbol-Idee |
|---|---|---|
| 🏃 **Trainingstier** | 50 Trainings in einer Saison | Turnschuh |
| 🤝 **Teamplayer** | 10 Helfereinsätze | Handshake |
| 🏆 **Meisterschaftsheld:in** | Alle Meisterschaftsspiele gespielt | Pokal |
| 📣 **Werber:in** | 3 neue Mitglieder geworben | Megafon |
| 🏛️ **Demokrat:in** | 5 GVs in Folge besucht | Parlamentsgebäude |
| 🕰️ **Urgestein** | 10 Jahre Vereinsmitgliedschaft | Fels |
| ⭐ **Allrounder** | Punkte in allen 7 Säulen gesammelt | Stern |
| 🔥 **On Fire** | 12-Wochen-Trainingsstreak | Flamme |
| 🎉 **Vereinsseele** | Top 3 im Vereins-Leaderboard einer Saison | Herz |
| 🆕 **Willkommenskultur** | 3x Gotti/Götti für Neumitglieder | Türe |
| ✅ **Zuverlässig** | 3 Jahre in Folge Rechnung pünktlich bezahlt | Häkchen |
| 📝 **Reporter:in** | 5 Matchberichte geschrieben | Stift |
| 📸 **Vereinsfotograf:in** | 10x Fotos/Videos am Spieltag gemacht | Kamera |
| 🧹 **Macher:in** | 20 Aufgaben im Marktplatz erledigt | Besen |
| 💎 **Unsichtbare:r Held:in** | 10 Aufgaben aus Kategorie Infrastruktur/Materialwart | Diamant |
| 🎖️ **Funktionär:in** | 1 Saison ein Funktionärsamt ausgeübt | Orden |
| 🏅 **Amts-Legende** | 5 Saisons dasselbe Funktionärsamt ausgeübt | Medaille |
| 🚒 **Lückenfüller:in** | Ein vakantes Amt übernommen | Feuerwehrhelm |

### Stufen bei Badges
Ausgewählte Badges können in Bronze → Silber → Gold gesteigert werden (z.B. Trainingstier Bronze = 25 Trainings, Silber = 50, Gold = 80).

---

## 6. Level-System

Das Level-System bietet eine langfristige Progression und macht den Gesamteinsatz eines Mitglieds auf einen Blick sichtbar.

| Level | Bezeichnung | Benötigte Gesamtpunkte |
|---|---|---|
| 1 | Neuling | 0 |
| 2 | Mitglied | 100 |
| 3 | Stammspieler:in | 300 |
| 4 | Vereinsstütze | 600 |
| 5 | Vereinsheld:in | 1'000 |
| 6 | Legende | 1'500 |
| 7 | Ehrenmitglied (digital) | 2'500 |
| 8 | Hall of Fame | 4'000 |

Die Bezeichnungen sind Vorschläge und können pro Verein angepasst werden. Nicht-Sportvereine könnten z.B. «Taktgeber:in» (Musikverein) oder «Pfadiführer:in» (Pfadi) verwenden.

---

## 7. Dashboards & Leaderboards

### 7.1 Persönliches Mitglieder-Dashboard

Jedes Mitglied sieht auf seinem Dashboard:

- **Aktueller Punktestand** (Saison + Gesamt/Karriere)
- **Aktuelles Level** mit Fortschrittsbalken zum nächsten Level
- **Letzte Aktivitäten** (die letzten 5–10 Punkte-Ereignisse)
- **Meine Badges** (gesammelte und nächste erreichbare)
- **Nächste erreichbare Punkte** – konkrete Vorschläge, wie das Mitglied weitere Punkte sammeln kann:
  - «Nächstes Training am Dienstag: +10 Punkte»
  - «Melde dich als Helfer:in am Vereinsfest: +50 Punkte»
  - «Noch 2 Trainings bis zum Streak-Bonus!»
  - «Matchbericht vom Samstag noch offen: +25 Punkte»
- **Offene Aufgaben für mich** – die 3–5 relevantesten Aufgaben aus dem Marktplatz (gefiltert nach Team und Fähigkeiten)
- **Meine erledigten Aufgaben** (mit Kudos/Feedback von Verantwortlichen)
- **Saisonverlauf** (Grafik: Punkte pro Monat)

### 7.2 Team-Leaderboard

- Zeigt die Rangliste aller Mitglieder eines Teams (z.B. «1. Mannschaft Herren»)
- Fördert spielerischen Wettbewerb innerhalb des Teams
- Anonymisierungsoption: Nur Top 10 anzeigen oder Ränge ohne Punktzahl

### 7.3 Vereins-Leaderboard

- Zeigt die Rangliste aller Mitglieder des gesamten Vereins
- Kann nach Kategorien gefiltert werden (z.B. «Wer hat am meisten Helferpunkte?», «Wer hat am meisten Aufgaben erledigt?»)
- **Team-vs-Team-Ranking**: Welches Team hat im Durchschnitt am meisten Punkte pro Mitglied?
- **Saisonrangliste** (wird am Ende der Saison archiviert)

### 7.4 Design-Prinzipien für Leaderboards

- **Spass, nicht Scham**: Untere Ränge werden nie hervorgehoben. Optional können nur die Top 10/20 angezeigt werden.
- **Eigene Position immer sichtbar**: Auch wenn nur Top 10 angezeigt wird, sieht man den eigenen Rang.
- **Diverse Kategorien**: Es gibt nicht nur ein Gesamt-Leaderboard, sondern auch «Helfer:in des Monats», «Trainingsstreak-Champion» etc. – so haben verschiedene Mitglieder Chancen zu glänzen.
- **Zeiträume wählbar**: Woche, Monat, Saison, All-Time.

---

## 8. Challenges & Saisonziele

### 8.1 Team-Challenges

Vom Trainer oder Vorstand erstellte zeitgebundene Herausforderungen:

- «Advents-Challenge: Jedes Teammitglied mindestens 3x im Training im Dezember» → Bonus für das ganze Team
- «Saisonstart-Challenge: 90% Anwesenheit in den ersten 4 Wochen»
- «Helfer-Challenge: Unser Team stellt 10 Helfer:innen für das Vereinsfest»

### 8.2 Vereins-Challenges

- «GV-Challenge: 80% der Mitglieder an der Generalversammlung»
- «Wachstums-Challenge: 20 neue Mitglieder bis Ende Saison»
- «Nachhaltigkeits-Challenge: Alle Teams fahren 1x mit ÖV zum Auswärtsspiel»
- «Null-offene-Aufgaben-Challenge: Alle Matchberichte der Rückrunde innert 48h geschrieben»
- «Bezahl-Challenge: 90% aller Mitglieder bezahlen den Vereinsbeitrag innert Frist»

### 8.3 Persönliche Ziele

Mitglieder können sich selbst Ziele setzen:
- «Ich möchte diese Saison 500 Punkte erreichen»
- «Ich möchte den Badge ‹Trainingstier Silber› holen»

---

## 9. Belohnungssystem (Rewards)

Punkte können optional in echte Belohnungen umgewandelt werden. Dies ist vom Verein konfigurierbar.

### Mögliche Belohnungen

| Belohnung | Kosten (Punkte) | Beispiel |
|---|---|---|
| Vereins-Merch (Socken, Mütze) | 200 | Aus dem Vereinsshop |
| Getränk am Vereinsfest | 50 | Gutschein |
| Gratis-Trainingslektion Spezial | 300 | z.B. mit Gasttrainer:in |
| Name auf der Ehrenwand (digital) | 500 | Im App-Bereich «Hall of Fame» |
| Saisonabschluss-Überraschung | 1'000 | Vom Vorstand bestimmt |
| Reduktion Vereinsbeitrag | Konfigurierbar | z.B. 5 CHF pro 100 Punkte |

**Wichtig**: Das Belohnungssystem ist optional. Der Kern der Motivation soll intrinsisch bleiben (Spass, Anerkennung, Gemeinschaft).

---

## 10. Benachrichtigungen & Nudges

Intelligente, nicht aufdringliche Benachrichtigungen halten Mitglieder engagiert:

- **Erinnerung vor Training**: «Morgen Training um 19:30 – komm vorbei und hol dir 10 Punkte 💪»
- **Streak-Warnung**: «Noch 1 Training und du sicherst dir deinen 4-Wochen-Streak-Bonus!»
- **Badge fast erreicht**: «Du bist nur noch 2 Helfereinsätze vom Badge ‹Teamplayer› entfernt»
- **Wöchentlicher Digest**: «Deine Woche: 45 Punkte gesammelt. Du bist auf Platz 12 im Verein.»
- **Vereins-News**: «Helfer:innen gesucht für Samstag! 50 Punkte warten auf dich.»
- **Aufgabe verfügbar**: «Neuer Matchbericht gesucht: Spiel vom Samstag – 25 Punkte für dich!»
- **Aufgabe läuft ab**: «Die Aufgabe ‹Fotos Turnier› läuft morgen ab – schaffst du es noch?»
- **Amt vakant**: «Wir suchen eine:n Apothekenverantwortliche:n – nur 3h pro Saison, 100 Punkte für dich!»
- **Rechnung offen**: «Dein Vereinsbeitrag ist fällig – bezahle rechtzeitig und sichere dir 30 Punkte 💰»

**Einstellbar**: Mitglieder können Benachrichtigungen granular steuern (Art, Häufigkeit, Stille Zeiten).

---

## 11. Datenschutz & Schweizer Recht

- **DSG-konform**: Die App muss dem neuen Schweizer Datenschutzgesetz (revDSG, seit 1.9.2023) entsprechen.
- **Datenhoheit beim Verein**: Jeder Verein ist Verantwortlicher seiner Mitgliederdaten.
- **Hosting in der Schweiz**: Daten werden in Schweizer Rechenzentren gespeichert.
- **Minimalprinzip**: Nur nötige Daten werden erhoben.
- **Transparenz**: Mitglieder sehen jederzeit, welche Daten über sie gespeichert sind.
- **Opt-in für Leaderboards**: Mitglieder können entscheiden, ob sie auf öffentlichen Leaderboards erscheinen möchten.
- **Jugendschutz**: Für Mitglieder unter 16 Jahren ist die Einwilligung der Erziehungsberechtigten erforderlich.

---

## 12. Technische Architektur (Übersicht)

### Gewählter Tech-Stack (souverän & Open Source, Google-frei)

| Komponente | Technologie | Begründung |
|---|---|---|
| **App (iOS/Android/Web)** | Ionic React + Capacitor | Eine Codebasis für Web-App und native Apps; UI-Referenz: myclub-App |
| **Backend** | 100% Supabase (Open Source) | Kein separater Server; jederzeit self-hostbar → Exit-Fähigkeit |
| **Geschäftslogik (Punkte-Engine)** | Postgres-Funktionen (security definer) | Transaktional, atomar, manipulationssicher |
| **HTTP-Logik (Push, Webhooks, Jobs)** | Supabase Edge Functions (Deno) | Serverless, direkt in Supabase deployt |
| **Zeitsteuerung** | pg_cron + pg_net | Streaks, Treue-Jubiläen, Digest, Verbands-Sync |
| **Auth** | Supabase Auth (GoTrue): Magic Link, E-Mail/Passwort, Passkeys | Kein Google-/Apple-Login nötig |
| **Push** | ntfy/UnifiedPush (Android, self-hosted) + APNs (iOS) + Web Push VAPID (PWA) | Google-frei; In-App-Inbox als 100%-Fallback |
| **Karten** | MapLibre GL + swisstopo/OSM | Schweizer Geodaten statt Google Maps |
| **Zahlungen** | QR-Rechnung (swissqrbill) + camt.054-Bankabgleich | Maximal souverän, kein US-PSP |
| **Hosting** | Managed Supabase Zürich → optional self-hosted auf Schweizer Cloud (Exoscale/Infomaniak) | DSG-konform, volle Datensouveränität möglich |

*Details siehe separates Dokument «Technische Architektur».*

### Architekturprinzipien
- **Multi-Tenant**: Ein System für viele Vereine, sauber getrennt
- **API-First**: Alle Funktionen über REST/GraphQL-API, Frontend ist austauschbar
- **Konfigurierbar**: Punktwerte, Badges, Kategorien sind pro Verein einstellbar
- **Offline-fähig**: Anwesenheit kann offline erfasst und später synchronisiert werden
- **Skalierbar**: Von 1 Verein bis 1'000 Vereine ohne Architekturwechsel

---

## 13. Monetarisierung

> Aktualisiert gemäss «MVP-Scope myclub» (Entscheid 5): **Gamification Basic ist Kern des Basis-Abos** – myclub positioniert sich als Engagement-Plattform, nicht als weitere Mitgliederverwaltung. Die Ausbaustufe (Badges, Level, Challenges, Ämter) plus das **Mitgliederwert-Cockpit** bilden das Add-on «Engagement Pro» (~CHF 6.90/Mt). Details und das Mitgliederwert-Konzept (Kundenwert-Ansatz nach Sales Excellence/CX, intern für Mitglieder angewendet): MVP-Scope §7 und §11.

| Stufe | Inhalt | Preis |
|---|---|---|
| **myclub Basis** | Kern inkl. Helfer-Schichten, News, Push, Agenda | micro CHF 0 (≤20 Mitglieder) / small 6.90 / medium 12.90 / large 24.90 pro Monat |
| **Add-on Gamification** | Punkte, Dashboard, Leaderboards, Aufgaben-Marktplatz (Stufe 2: Badges, Level, Challenges, Funktionärsämter) | ~CHF 4.90/Mt |
| **Add-on Verband** | Verbands-Sync (Spielpläne, Resultate, Tabellen) via API-Key pro Verein | CHF 5.90/Mt |
| **myclub Billing** | Eigenständiger Rechnungsdienst (QR-Rechnung, Perioden, Mahnwesen), voll in myclub integriert | eigene Preisliste |
| Premium / White-Label | Eigene Marke für Verbände und Grossvereine (Laufzeit-Theming) | individuell |

Helfer-Schichten und Gamification teilen sich einen einzigen Punkte-Ledger: Die Schicht-Bestätigung bucht direkt Gamification-Punkte (Säule 3); ein separates Helferpunkte-Konto gibt es nicht mehr. Säule 6 («Rechnung pünktlich bezahlt») wird vom Billing-Webhook gespeist.

---

## 14. Roadmap

### Phase 1 – MVP (Monate 1–4)
- Mitgliederverwaltung (Grundfunktionen)
- Anwesenheitserfassung (Training + Spiele)
- Einfaches Punktesystem (Säulen 1 + 2 + 6)
- Persönliches Dashboard (Punktestand + letzte Aktivitäten)
- Vereins-Leaderboard (Gesamt)
- Pilotbetrieb mit 3–5 Vereinen

### Phase 2 – Gamification Complete (Monate 5–8)
- Alle 7 Punktesäulen aktiv
- Aufgaben-Marktplatz (einmalige + wiederkehrende Aufgaben)
- Badge-System (inkl. Bronze/Silber/Gold)
- Level-System
- Team-Leaderboards
- Challenges (Team + Verein)
- Push-Benachrichtigungen & Nudges
- Konfigurierbarkeit des Punktesystems

### Phase 3 – Community & Rewards (Monate 9–12)
- Belohnungssystem (Rewards-Shop)
- Persönliche Ziele
- Vereins-übergreifende Challenges (z.B. innerhalb eines Verbands)
- Social Features (Kommentare, Kudos an Teammitglieder)
- Statistik-Dashboard für Vorstände

### Phase 4 – Skalierung & Erweiterung (ab Monat 13)
- Templates für Nicht-Sportvereine (Musik, Kultur, Jugendorganisationen)
- Verbands-Integration (z.B. Regionalverband-Dashboard)
- API für Drittanbieter (Vereinssoftware-Integration)
- Mehrsprachigkeit (DE, FR, IT, EN)
- KI-gestützte Empfehlungen (personalisierte Challenges)

---

## 15. Erfolgsfaktoren & Risiken

### Erfolgsfaktoren
- **Einfache Einführung**: Ein Verein muss in unter 30 Minuten startklar sein.
- **Niedrige Hürde für Mitglieder**: Anmeldung via Link/QR-Code, kein kompliziertes Onboarding.
- **Spassfaktor von Tag 1**: Schon nach dem ersten Training sieht man Punkte auf dem Dashboard.
- **Vorstand-Buy-in**: Der Vorstand muss die App aktiv unterstützen und vorleben.
- **Regelmässige Frische**: Neue Challenges, saisonale Badges halten das Interesse hoch.

### Risiken & Gegenmassnahmen

| Risiko | Gegenmassnahme |
|---|---|
| Punkte erzeugen Druck statt Spass | Opt-out für Leaderboards, keine Bestrafung, nur positive Verstärkung |
| Nur Aktive profitieren, Passive fühlen sich ausgeschlossen | Diverse Punktekategorien (auch Vereinstreue und Admin-Zuverlässigkeit werden belohnt) |
| Manipulation (falsche Anwesenheiten) | Check-in via QR-Code oder Trainer-Bestätigung |
| Aufgaben bleiben liegen / keiner übernimmt sie | Dringlichkeitsanzeige, Punkte-Boost für kurzfristige Aufgaben, faire Verteilungs-Transparenz |
| Funktionärsämter bleiben vakant | Vakanz-Anzeige mit Factsheet (transparenter Aufwand senkt Hemmschwelle), Push-Werbung, Lückenfüller-Badge |
| Immer dieselben erledigen Aufgaben | Transparenzanzeige «Aufgaben pro Mitglied», Kudos-System für Wertschätzung |
| Datenschutzbedenken | Transparenz, Schweizer Hosting, DSG-Konformität |
| Geringe Adoption | Gamification erst nach Basisfunktionen einführen, schrittweise |

---

## 16. Zusammenfassung

**TeamSpirit** kombiniert praxisnahe Vereinsverwaltung mit einem durchdachten Gamification-System, das auf Wertschätzung und Gemeinschaft setzt. Durch die sieben Punktesäulen wird jede Form von Engagement gewürdigt – vom Trainingsbesuch über den pünktlich bezahlten Vereinsbeitrag, den freiwillig geschriebenen Matchbericht bis zur langjährigen Vereinstreue. Der Aufgaben-Marktplatz sorgt dafür, dass wichtige Vereinsarbeiten nicht an wenigen Schultern hängen bleiben, sondern fair verteilt und sichtbar belohnt werden – und macht mit digitalen Factsheets und Vakanz-Anzeige auch die Funktionärsämter transparent und attraktiv. Konfigurierbare Punkte, Badges und Challenges stellen sicher, dass jeder Verein das System auf seine Kultur und Bedürfnisse abstimmen kann.

> **Leitspruch: «Jeder Einsatz zählt – mach ihn sichtbar.»**

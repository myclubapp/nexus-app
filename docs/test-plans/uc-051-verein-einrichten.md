# Manual Test Plan: UC-051 — Verein einrichten

**Use Case:** [UC-051](../use_cases/UC-051-verein-einrichten.md)
**Geltungsbereich:** Onboarding-Seite im Gerüst der Anmeldung, offene Anfrage als Vereinseinstellung, Einrichtungs-Assistent nach der Gründung, Verbandsnews je Verbindung
**Anforderungen:** FR-195, FR-196, FR-197 – dazu FR-004, FR-009, FR-144
**Regeln:** BR-258 bis BR-262, dazu BR-002, BR-004, BR-006, BR-155, BR-171
**Erstellt:** 2026-09-15

## Vorbereitung

- **V** — Vorstand (`admin`) eines frisch gegründeten Vereins, **G** — Gast mit
  Konto, aber ohne Mitgliedschaft in diesem Verein.
- Die Migrationen `0101_public_join_requests.sql` und `0102_federation_news.sql`
  sind eingespielt.
- Für TC-006 und TC-007: `sync-federation` ist deployt und
  `SWISSUNIHOCKEY_NEWS_TOKEN` gesetzt. **Ohne dieses Secret ist «Eingeschaltet.
  Die Beiträge kommen mit dem nächsten Abgleich: Für diesen Verband sind keine
  News eingerichtet» das erwartete Ergebnis** – nicht eine Abweichung. Der
  Schalter selbst muss auch dann stehen bleiben.
- Für TC-006: eine gültige Vereinskennung bei swiss unihockey (z.B. `463820`).
- Geräte: ein Telefon **und** ein Tablet oder ein Browserfenster über 1000 px –
  TC-001 misst genau das.

---

## TC-001: Onboarding und Anmeldung sehen gleich aus (Sandros Befund)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf einem **breiten** Fenster (> 1000 px) abmelden, Anmeldeseite betrachten | Eine schmale, zentrierte Spalte; Titel oben, Sprachwahl unten | | |
| 2 | Anmelden mit einem Konto **ohne** Verein | Die Onboarding-Seite erscheint | | |
| 3 | Breite vergleichen | Dieselbe zentrierte Spalte, nur etwas breiter – **kein** Eingabefeld über die ganze Fensterbreite | | |
| 4 | Auf Segment, Formular und Knopfleiste achten | Alle drei stehen in **derselben** Spalte, linksbündig zueinander | | |
| 5 | Nach einer Kopfzeile suchen | Keine: kein Zurück, kein Menü, kein grosser Titel | | |
| 6 | Auf dem Telefon wiederholen | Die Spalte füllt die Breite, Ränder wie auf jeder anderen Seite | | |
| 7 | Gerät drehen | Die Spalte bleibt zentriert und wächst nicht mit | | |

---

## TC-002: Gründen führt in den Assistenten (FR-195, BR-004)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Verein gründen» wählen | «Schritt 1 von 3» – die Gründung bleibt bei drei Schritten | | |
| 2 | Name, Vereinsart, Saisonbeginn ausfüllen und gründen | Der Verein entsteht | | |
| 3 | Beobachten, wohin die App führt | **Nicht** aufs Dashboard, sondern in «Verein einrichten» | | |
| 4 | Schrittzahl lesen | «Schritt 1 von 4» – ohne Verband gibt es keine Newsfrage | | |
| 5 | Nach dem Ausstieg suchen | «Später einrichten» steht unter jedem Schritt (BR-259) | | |
| 6 | «Später einrichten» wählen | Das Dashboard erscheint; die «Erste Schritte»-Karte steht da | | |
| 7 | Die Karte zählen | **Drei** Zeilen (plus Website-Import, falls angeboten) – der Assistent ist ein Knopf in der Überschrift, keine vierte Zeile (BR-171) | | |
| 8 | Diesen Knopf wählen | Der Assistent öffnet sich wieder, mit dem Stand von vorher (A4) | | |

---

## TC-003: Ein neuer Verein nimmt keine Anfragen entgegen (BR-258)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** den Kurznamen des neuen Vereins notieren (Vereinseinstellungen) | Der Kurzname steht in der Fussnote unter «Beitritt» | | |
| 2 | Als **G** auf der Onboarding-Seite «Anfrage» wählen und den Kurznamen eingeben | – | | |
| 3 | «Verein suchen» | Der Verein wird **gefunden** und beim Namen genannt (BR-262) | | |
| 4 | Den Text darunter lesen | «Dieser Verein nimmt keine offenen Anfragen entgegen.» und der Hinweis auf die Einladung | | |
| 5 | Auf die Farbe achten | **Keine** rote Fehlermeldung – die Person hat nichts falsch gemacht | | |
| 6 | «Anfrage senden» antippen | Der Knopf ist inaktiv; nichts geschieht | | |
| 7 | Als **V** in die Inbox sehen | Keine Meldung über eine Anfrage | | |

---

## TC-004: Der Vorstand öffnet den Weg (FR-196)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** Profil → Vereinseinstellungen öffnen | Der Abschnitt «Beitritt» steht unter den Modulen | | |
| 2 | «Offene Anfragen zulassen» einschalten | Meldung «Offene Anfragen sind zugelassen.» – **ohne** den Speichern-Knopf am Fuss zu drücken | | |
| 3 | Die Seite verlassen und neu öffnen | Der Schalter steht weiterhin an | | |
| 4 | Als **G** den Kurznamen erneut suchen | «So kommst du dazu» statt des Hinweises aus TC-003 | | |
| 5 | «Anfrage senden» | Die Anfrage wird angenommen; die Seite zeigt «Wartet auf den Entscheid» | | |
| 6 | Als **V** die Inbox öffnen | Eine Meldung «Neue Beitritts-Anfrage» | | |
| 7 | Die Anfrage entscheiden (UC-004) | Der übliche Ablauf; **G** wird Mitglied | | |
| 8 | Als **V** den Schalter wieder ausschalten | Meldung «Offene Anfragen sind abgeschaltet.» | | |
| 9 | Als zweiter Gast den Kurznamen suchen | Wieder der Hinweis aus TC-003 | | |

---

## TC-005: Teams anlegen im Assistenten (FR-195, FR-144)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** den Assistenten öffnen und zum Schritt «Wie heissen eure Teams?» gehen | Der Schritt zeigt «Noch kein Team …» **und** einen Knopf «Team anlegen» (FR-144) | | |
| 2 | Ein Team anlegen | Bestätigung; das Team steht in der Liste dieses Schritts | | |
| 3 | Ohne verbundenen Verband nach «Teams aus dem Verband übernehmen» suchen | Der Knopf fehlt – es gibt nichts zu übernehmen (UC-039 A2) | | |
| 4 | Weiter zu «Die Beispielinhalte» | Die Beispiele stehen mit Kennzeichnung da | | |
| 5 | «Beispielinhalte entfernen» | **Erst eine Rückfrage**, dann die Meldung mit der Zahl | | |
| 6 | Den Schritt erneut betrachten | «Es sind keine Beispielinhalte mehr da.» | | |
| 7 | Agenda und Marktplatz öffnen | Die Beispiele sind weg, eigene Inhalte unberührt (BR-163) | | |

---

## TC-006: Verband verbinden – und die Frage danach (FR-197, BR-260)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** den Assistenten öffnen, Schritt 1 | «Hängt euer Verein an einem Verband?» | | |
| 2 | Schrittzahl lesen | «Schritt 1 von 4» | | |
| 3 | Swiss Unihockey wählen, Vereinskennung eintragen, «Verbinden» | Die gefundenen Teams werden aufgezählt; Meldung «Verband verbunden» | | |
| 4 | Schrittzahl erneut lesen | «Schritt 1 von **5**» – die Newsfrage ist dazugekommen | | |
| 5 | «Weiter» | «Auch die Verbandsnews?» mit einem Schalter je Verbindung | | |
| 6 | Auf den Stand des Schalters achten | **Aus** – nicht voreingestellt (BR-260) | | |
| 7 | Einschalten | Meldung «Die Verbandsnews stehen im Feed.» (oder der Satz aus der Vorbereitung, wenn das Secret fehlt) | | |
| 8 | Zum News-Feed wechseln | Beiträge von swiss unihockey mit Bild, Titel und Anriss | | |
| 9 | Einen davon öffnen | Das Detail zeigt Anriss und Autor; **kein** Verweis «Auf der Website lesen» (die Schnittstelle liefert keine Adresse) | | |
| 10 | Auf die Kennzeichnung achten | Ein Abzeichen mit dem **Namen des Verbands**, nicht «vom Verband» | | |
| 11 | Am Beitrag nach «Bearbeiten» suchen | Es gibt keines – der Beitrag gehört der Quelle | | |
| 12 | Den Schalter wieder ausschalten | Meldung, dass nichts mehr nachkommt | | |
| 13 | Den Feed erneut öffnen | Die bereits geholten Beiträge **stehen weiterhin da** (BR-170 sinngemäss) | | |

---

## TC-007: Ein Verband ohne Beiträge (BR-260, BR-155)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** Profil → «Verband verbinden» öffnen | Der Zustand der Verbindungen steht oben | | |
| 2 | Einen zweiten Verband verbinden, der keine Newsschnittstelle hat (Volleyball, Handball, Turnverband) | Der Testaufruf meldet, dass für diesen Verband noch keine Schnittstelle besteht – **es entsteht nichts** (UC-035 A1) | | |
| 3 | Im Abschnitt «Verbandsnews» nachsehen | Zu jedem verbundenen Verband ohne Beiträge steht **kein Schalter**, sondern «Dieser Verband liefert keine Beiträge.» | | |
| 4 | Den Zustand der Unihockey-Verbindung prüfen | Unverändert «aktiv» – eine fehlende Newsquelle beschädigt die Verbindung nicht (BR-155) | | |

---

## TC-008: Mitglieder holen (FR-195, FR-196)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** im Assistenten zum letzten Schritt gehen | «Wie kommen die Mitglieder herein?» | | |
| 2 | «Einladungslink erstellen» | Ein Link entsteht; die Adresse steht als Fussnote darunter | | |
| 3 | Die Zeile antippen | Auf dem Gerät öffnet das Teilen-Blatt, im Browser wird kopiert («Kopiert») | | |
| 4 | Den Schalter «Offene Anfragen zulassen» prüfen | Er zeigt denselben Stand wie in den Vereinseinstellungen | | |
| 5 | Ihn hier umlegen, dann die Vereinseinstellungen öffnen | Beide Seiten zeigen denselben Stand | | |
| 6 | «Alle Einladungen» wählen | Die Einladungsverwaltung (UC-003) mit dem eben erzeugten Link | | |
| 7 | Zurück in den Assistenten, «Fertig» | Das Dashboard erscheint | | |

---

## TC-009: Ein Mitglied hat mit alldem nichts zu tun

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als Mitglied ohne Vorstandsrolle das Profil öffnen | Kein Weg «Verein einrichten» in der Verwaltung | | |
| 2 | Die Adresse `/tabs/profile/setup` direkt aufrufen | «Nur der Vorstand …» und ein Weg zurück – keine Schrittführung | | |
| 3 | Im Feed nach Verbandsbeiträgen sehen | Sie stehen da, mit dem Abzeichen des Verbands | | |
| 4 | An einem davon nach einer Bearbeiten-Möglichkeit suchen | Es gibt keine | | |

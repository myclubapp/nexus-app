# Manual Test Plan: UC-031 — Sitzungs-Input einreichen und zuordnen

**Use Case:** [UC-031](../use_cases/UC-031-sitzungs-input-einreichen.md)
**Geltungsbereich:** Ämter, Einreichen, Zuordnen, Weiterleiten, Antwort, Sammelansicht, Einladung
**Anforderungen:** FR-095, FR-096, FR-097, FR-098, FR-101
**Regeln:** BR-132, BR-133, BR-134, BR-135
**Erstellt:** 2026-09-10

## Vorbereitung

- **V** — Vorstand (`admin`), **P** — hält das Amt «Präsidium», **K** — hält
  «Kassier», **M** — Mitglied ohne Amt, **O** — weiteres Mitglied ohne Amt.
- Migration `0049_meeting_inputs.sql` ist eingespielt.
- Das Amt «Aktuariat» besteht **ohne** Inhaber:in (für BR-135).
- Ein Helfer-Event mit einer unterbesetzten Schicht in der Zukunft besteht.

---

## TC-001: Ämter sind der Verteiler (FR-096, BR-133)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** Profil → «Ämter» öffnen | Die Verwaltung steht im Abschnitt «Verwaltung», nicht unter «Einstellungen» (FR-148) | | |
| 2 | Als **M** dieselbe Seite über die URL aufrufen | Kein Weg dorthin im UI; die Seite bleibt ohne Schreibrechte | | |
| 3 | Als **V** «Amt anlegen», Bezeichnung «Präsidium», Inhaber:in **P** | Toast bestätigt; die Zeile zeigt «Inhaber:in seit» mit dem heutigen Datum | | |
| 4 | Prüfen, ob das Datum von Hand einzugeben war | Nein – der Server führt es | | |
| 5 | Ein zweites Amt «präsidium» anlegen (klein) | Abgewiesen – ein Titel je Verein genau einmal | | |
| 6 | Ein Amt «Aktuariat» ohne Inhaber:in anlegen | Es erscheint unter «Vakant» | | |
| 7 | Bei «Präsidium» die Inhaber:in entfernen | «Inhaber:in seit» verschwindet mit der Person | | |
| 8 | Die Zeile nach links wischen und «Auflösen» wählen | Eine Rückfrage erscheint **vor** der Aktion; «Auflösen» ist rot, «Abbrechen» in der Vereinsfarbe | | |
| 9 | In der Rückfrage abbrechen | Das Amt besteht weiter | | |

---

## TC-002: Vorschlag einreichen (FR-097, Schritte 1–6)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** Profil → «Sitzungen & Inputs» öffnen | Die Seite ist für **jedes** Mitglied erreichbar | | |
| 2 | «Vorschlag einreichen» wählen | Text, Zielgremium und die Wahl persönlich/anonym stehen da | | |
| 3 | Ohne Zielgremium absenden wollen | Gesperrt, Hinweis «Wähle das Zielgremium.» | | |
| 4 | Ohne Text absenden wollen | Gesperrt, Hinweis «Ein Vorschlag braucht seinen Text.» | | |
| 5 | Die Auswahl «Ämter» öffnen | Mehrfachauswahl; neben dem Amt steht die Person, die es hält | | |
| 6 | Die Auswahl in einer anderen Sprache öffnen | «Abbrechen»/«OK» übersetzt, nicht «Cancel»/«OK» | | |
| 7 | «Präsidium» und «Kassier» wählen, Text schreiben, einreichen | Toast «Eingereicht.» | | |
| 8 | Als **P** und als **K** die Inbox prüfen | Beide haben eine Meldung; **O** hat keine | | |
| 9 | Als **O** die Seite öffnen | Der Vorschlag ist **nicht** sichtbar | | |
| 10 | Als **V** die Seite öffnen | Der Vorschlag steht im Eingangskorb – Schritt 7 weist dem Vorstand die Triage zu | | |
| 11 | Als **M** die Seite öffnen | Der Vorschlag steht unter «Deine Vorschläge», **nicht** im Eingangskorb | | |
| 12 | Prüfen, ob **M** den eigenen Vorschlag antippen kann | Nein – niemand triagiert den eigenen | | |

---

## TC-003: Der Status ist schon eine Antwort (FR-098, BR-134, Schritte 7–8)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **P** den Vorschlag im Eingangskorb antippen | Das Blatt zeigt den Text ungekürzt und «An Präsidium, Kassier» | | |
| 2 | Die Auswahl «Entscheid» öffnen | Genau zwei Arten von Einträgen: «Laufend bearbeiten» und die kommenden Sitzungen. **Kein** Traktandum, keine freie Liste (BR-132) | | |
| 3 | Eine Sitzung wählen und «Übernehmen» | Toast «Für die Sitzung eingeplant.» | | |
| 4 | Als **M** die Inbox prüfen | Meldung «Dein Input ist für eine Sitzung eingeplant» mit dem Titel der Sitzung | | |
| 5 | Als **M** die eigene Zeile ansehen | Abzeichen «Eingeplant» | | |
| 6 | Als **P** «Laufend bearbeiten» wählen und übernehmen | Status «In Arbeit»; **M** bekommt erneut eine Meldung | | |
| 7 | Als **O** dasselbe Blatt über die Datenbank aufrufen (`assign_input`) | Abgewiesen – «nicht an dich gerichtet» | | |
| 8 | Versuchen, einen Vorschlag einem **Training** zuzuordnen | Abgewiesen – nur eine Sitzung nimmt Inputs auf | | |

---

## TC-004: Die dokumentierte Antwort (§13.3, Schritt 9)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Im Blatt das Antwortfeld leer lassen | «Antworten und abschliessen» **und** «Ablehnen» sind gesperrt | | |
| 2 | Nur Leerzeichen eingeben | Beide bleiben gesperrt | | |
| 3 | Zwei Sätze schreiben und «Antworten und abschliessen» | Toast «Antwort zugestellt.» | | |
| 4 | Als **M** die eigene Zeile ansehen | Status «Beantwortet», die Antwort steht in Anführungszeichen darunter | | |
| 5 | In der Datenbank die Zeile prüfen | `decision_response`, `responded_at` und `responded_by` sind gesetzt | | |
| 6 | Per SQL den Status auf `answered` setzen, ohne Antwort | Vom Constraint abgewiesen | | |
| 7 | Als **P** den abgeschlossenen Vorschlag erneut öffnen | Nur noch Lesestück: kein Antwortfeld, kein «Ablehnen», kein «Weiterleiten» | | |
| 8 | Versuchen, ihn erneut zuzuordnen | Abgewiesen – «bereits abgeschlossen» | | |
| 9 | Einen zweiten Vorschlag mit Begründung **ablehnen** | Toast «Abgelehnt – mit Begründung.»; **M** erhält die Begründung | | |

---

## TC-005: Anonym eingereicht (A1)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** einen Vorschlag mit «Anonym einreichen» senden | Der Hinweis erklärt das Ticket auf diesem Gerät | | |
| 2 | Als **P** den Eingangskorb ansehen | «Anonymer Vorschlag», ohne jede Angabe zur Person | | |
| 3 | In der Datenbank die Zeile prüfen | `author_member_id` leer, `anon_token_hash` gesetzt | | |
| 4 | Per SQL eine anonyme Zeile **mit** Autor:in einfügen | Vom Constraint abgewiesen | | |
| 5 | Per SQL eine persönliche Zeile **mit** Ticket einfügen | Ebenfalls abgewiesen | | |
| 6 | Als **P** den anonymen Vorschlag einer Sitzung zuordnen | Es wird **niemand** benachrichtigt – es gibt keine Adresse | | |
| 7 | Als **M** die Seite neu laden | Abschnitt «Anonym eingereicht» zeigt den Stand und «Eingeplant für …» | | |
| 8 | Als **O** auf **demselben** Gerät anmelden | Der Vorgang ist trotzdem da – er hängt am Ticket, nicht am Konto | | |
| 9 | Als **M** auf einem **anderen** Gerät anmelden | Der Vorgang fehlt dort | | |
| 10 | Als **P** antworten | **M** bekommt keine Meldung; die Antwort steht im anonymen Abschnitt | | |
| 11 | Im Browser-Speicher das Ticket löschen und neu laden | Der Vorgang ist weg – der Preis echter Anonymität | | |
| 12 | Im privaten Fenster anonym einreichen | Der Vorschlag geht raus; ein Hinweis sagt, dass der Rückweg fehlt | | |

---

## TC-006: Falsches Gremium (A4)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** einen Vorschlag nur an «Präsidium» senden | Nur **P** wird benachrichtigt | | |
| 2 | Als **P** ihn einer Sitzung zuordnen | Status «Eingeplant» | | |
| 3 | Als **P** «Weiterleiten an: Kassier» wählen und weiterleiten | Toast «Weitergeleitet.» | | |
| 4 | Als **K** die Inbox und die Seite prüfen | Meldung da; der Vorschlag steht in **K**s Eingangskorb | | |
| 5 | Als **P** die Seite neu laden | Der Vorschlag ist **nicht** mehr sichtbar – die Zuständigkeit ist verschoben | | |
| 6 | Den Status ansehen | Zurück auf «Offen», ohne Sitzung: Was das eine Gremium einplante, hat das andere nicht entschieden | | |
| 7 | Als **M** den eigenen Vorschlag ansehen | Er ist weiterhin sichtbar; der Verlauf ist erhalten | | |

---

## TC-007: Die Sammelansicht (FR-101, A2, BR-135)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** eine Sitzung antippen | Die Sammelansicht öffnet sich als Blatt über der Seite (Karte, nicht Vollbild) | | |
| 2 | Den Inhalt prüfen | Genau drei Abschnitte: zugeordnete Vorschläge, vakante Ämter, offene Helfereinsätze | | |
| 3 | Nach einem Traktandum, einem Protokoll oder einer Aufgabenliste suchen | Nichts davon existiert (BR-132) | | |
| 4 | «Aktuariat» ansehen | Es steht unter «Vakante Ämter» | | |
| 5 | Die unterbesetzte Schicht ansehen | Sie steht unter «Offene Helfereinsätze», mit dem Termin daneben | | |
| 6 | Eine zugeordnete Frage beantworten und die Ansicht neu laden | Sie verschwindet – nur **offene** Vorschläge stehen dort | | |
| 7 | Eine Sitzung ohne Inputs und ohne Dauerthemen öffnen | «Nichts zu behandeln», nicht drei leere Abschnitte | | |
| 8 | Als **O** (kein Amt, kein Vorstand) `meeting_agenda()` aufrufen | Abgewiesen | | |

---

## TC-008: Die Sitzung als Termin (FR-095, FR-096)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** in der Agenda einen Termin erfassen | Die Terminart «Sitzung» steht zur Wahl | | |
| 2 | Den Termin anlegen und ankündigen, **ohne** Empfängerkreis | Der ganze Verein bekommt die Meldung – wie bisher | | |
| 3 | Per SQL `audience_role_ids` auf «Präsidium, Kassier» setzen und erneut ankündigen | Nur **P** und **K** bekommen die Einladung | | |
| 4 | Das Amt «Kassier» auf **O** übertragen und erneut ankündigen | **O** bekommt die Einladung, **K** nicht mehr (BR-133, A3) | | |
| 5 | Per SQL `audience_role_ids` auf ein Objekt setzen | Vom Constraint abgewiesen | | |
| 6 | Die Sitzung in der Agenda ansehen | Sie verhält sich wie jeder Termin: Zu- und Absage, Erinnerung | | |
| 7 | Das Label der Terminart im Verein umbenennen | Die Sitzung trägt die vereinseigene Bezeichnung (C-009) | | |

---

## TC-009: Anmahnung (§13.3)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Einen offenen Input auf 40 Tage zurückdatieren | Vorbereitung | | |
| 2 | Ein offenes Anliegen (UC-029) ebenfalls zurückdatieren | Vorbereitung | | |
| 3 | `select flag_unanswered_notes();` aufrufen | Gibt 1 zurück | | |
| 4 | Die Vereins-Gesundheit als **V** öffnen | Ein Signal `inputs_unanswered` – mit der Anzahl **beider** Quellen | | |
| 5 | Denselben Aufruf ein zweites Mal | Kein zweites Signal | | |
| 6 | `clubs.settings.meeting.answerDays` auf 60 setzen und ein neues Signal erzwingen | Der 40 Tage alte Input zählt nicht mehr, das Anliegen weiter | | |

---

## TC-010: Benachrichtigungen und Sprachen

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Profil → «Benachrichtigungen» öffnen | Die Kategorie «Vorschläge und Anliegen» steht in der Liste | | |
| 2 | Sie abschalten und einen Input einreichen lassen | Kein Push; der Eintrag in der Inbox bleibt | | |
| 3 | Sprache auf Französisch stellen und beide Seiten öffnen | Alle Texte übersetzt, keine Schlüssel sichtbar | | |
| 4 | Dasselbe auf Italienisch und Englisch | Ebenso | | |
| 5 | Eine Mehrfachauswahl der Ämter öffnen | «Abbrechen»/«OK» in der gewählten Sprache | | |

---

## TC-011: iOS-Erscheinung und Bedienung

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Beide Seiten im iOS-Modus öffnen | Gruppierte Listen mit abgerundeten Ecken; der grosse Titel klappt beim Scrollen zusammen | | |
| 2 | Ein Blatt öffnen | Es fährt als Karte über die Seite; die Seite darunter bleibt sichtbar | | |
| 3 | Das Blatt nach unten wischen | Es schliesst; nichts wurde gesendet | | |
| 4 | Die Ämterzeile nach links wischen | «Auflösen» erscheint als Zeilenaktion, nicht als drittes Symbol in der Zeile | | |
| 5 | Auf einem schmalen Gerät (320 px) prüfen | Kein waagerechtes Scrollen, Texte brechen um | | |
| 6 | Auf dem Laptop (≥ 992 px) prüfen | Die Seitenleiste steht als Spalte; «Ämter» steht dort im Abschnitt «Verwaltung» | | |
| 7 | Die Seite nach unten ziehen | Aktualisierung lädt Inputs, Sitzungen und anonyme Vorgänge neu | | |
| 8 | Während des Ladens hinsehen | Ein Skelett in der Form der Liste, kein Spinner | | |

---

## Offen

- **Ämter sind bewusst minimal.** `MVP_Scope` §2 führt «Funktionärsämter mit
  Factsheets & Vakanz-Anzeige» als Ausbaustufe 2; gebaut ist nur der Verteiler
  aus §13.1. Kein Factsheet, keine Ausschreibung im Marktplatz, keine
  Nachfolgeplanung (K4).
- **«Vakant» heisst «kein Inhaber».** Mehr sagt das Datenmodell nicht.
- **Das Sprachmemo aus Schritt 3 fehlt weiterhin** (BR-125, offen seit UC-029).
  Ersatzweise lässt sich ein bestehendes eigenes Anliegen als Quelle wählen.
- **Ein Amt hat höchstens eine Inhaber:in.** Ein Co-Präsidium sind zwei Ämter
  desselben Namens – zu klären, ob das im Betrieb trägt.
- **Die zweite Folge-Aktion aus §13.4** (Ämtli-Aktion: Amt ausschreiben, neu
  besetzen) ist nicht gebaut; die Aufgabe im Marktplatz ist es (UC-030).

# Manual Test Plan: UC-032 — Kontext-Check-in beantworten

**Use Case:** [UC-032](../use_cases/UC-032-kontext-check-in.md)
**Geltungsbereich:** Auslösung, Kontext, Sichtbarkeit, Überspringen, Verlauf, Team-Wert, Selbst-Nudge
**Anforderungen:** FR-102 bis FR-109
**Regeln:** BR-136 bis BR-141
**Erstellt:** 2026-09-10

## Vorbereitung

- **A**–**E** — fünf Mitglieder im Team «Aktive», **TR** — Trainer:in desselben
  Teams, **V** — Vorstand.
- Migration `0050_context_checkins.sql` ist eingespielt, `seed_checkin_prompts()`
  für den Verein aufgerufen.
- Ein Training, ein Spiel und ein Helfer-Event liegen in der **Vergangenheit**
  und sind publiziert.

> **Achtung, zwei Begriffe:** «Check-in» heisst in dieser App zweierlei. UC-013
> erfasst die **Anwesenheit** über einen QR-Code, UC-032 fragt nach dem
> **Befinden**. Dieser Plan prüft ausschliesslich das Zweite.

---

## TC-001: Der Kontext wird abgeleitet, nicht erfragt (FR-102, BR-136)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **A** als anwesend am Training erfassen, `detect_checkins()` laufen lassen | **A** erhält eine Meldung «Wie ging es dir?» | | |
| 2 | Als **A** Profil → «Befinden» öffnen | Das offene Check-in trägt den Titel «Nach dem Training» | | |
| 3 | Das Check-in öffnen | Es wird **nicht** gefragt, ob **A** da war oder welche Rolle sie hatte | | |
| 4 | **B** als Ersatz beim Spiel erfassen und auslösen | **B** bekommt «Nach dem Spieltag» – die eigene Frage für die Bank (A3) | | |
| 5 | Den Wortlaut prüfen | Er fragt nach dem Erleben, **nicht** danach, warum **B** nicht gespielt hat | | |
| 6 | **C** einer Helferschicht zuweisen und auslösen | «Nach deinem Einsatz» mit zwei Fragen: Skala und Freitext (A4) | | |
| 7 | Den Wortlaut einer Frage im Verein ändern | Die geänderte Frage erscheint – der Text gehört dem Verein | | |

---

## TC-002: Kein Check-in bei Abwesenheit (BR-137, A2)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **D** als `absent` erfassen und auslösen | **D** bekommt **keine** Meldung und kein Check-in | | |
| 2 | **E** als `excused` erfassen und auslösen | Ebenfalls nichts | | |
| 3 | Ein Mitglied nur als `registered` erfassen | Ebenfalls nichts – zugesagt ist nicht dagewesen | | |
| 4 | Per SQL eine Frage mit dem Kontext `absent` anlegen | Vom Constraint abgewiesen – für Abwesenheit **existiert kein Kontext** | | |
| 5 | Dasselbe mit `excused` | Ebenfalls abgewiesen | | |
| 6 | In der ganzen App nach einer Frage nach dem Abwesenheitsgrund suchen | Es gibt keine | | |

---

## TC-003: Höchstens eines pro Tag (BR-141)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **A** an **zwei** Terminen desselben Tages als anwesend erfassen | Vorbereitung | | |
| 2 | `detect_checkins()` laufen lassen | **A** hat genau **eine** Einladung | | |
| 3 | Den Auftrag ein zweites Mal laufen lassen | Es entsteht nichts Neues | | |
| 4 | Am Folgetag einen weiteren Termin erfassen und auslösen | **A** wird wieder gefragt | | |
| 5 | Einen abgesagten Termin auslösen | Nichts | | |
| 6 | Einen unveröffentlichten Termin auslösen | Nichts | | |
| 7 | Einen Beispielinhalt auslösen | Nichts (BR-161) | | |

---

## TC-004: Sichtbarkeit vor der Antwort (FR-104, BR-139)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **A** das Check-in öffnen | «Wer sieht das?» steht **über** der Frage, nicht darunter | | |
| 2 | Die Vorauswahl ansehen | «Nur du», mit dem Satz «Niemand sonst liest das – auch der Vorstand nicht.» | | |
| 3 | Die Auswahl öffnen | Genau zwei Einträge: «Nur du» und «Du und deine Trainer:in» | | |
| 4 | Die Auswahl in einer anderen Sprache öffnen | «Abbrechen»/«OK» übersetzt | | |
| 5 | Antworten und absenden | Toast bestätigt; der Satz nennt die gewählte Sichtbarkeit | | |
| 6 | Als **TR** «Befinden» öffnen | Die Antwort von **A** ist **nicht** sichtbar | | |
| 7 | Als **TR** `checkin_responses` direkt abfragen | Ebenfalls nicht – die Policy hält, nicht die Abfrage | | |
| 8 | Als **V** dasselbe versuchen | Ebenfalls nicht (BR-139) | | |
| 9 | Als **A** die Antwort ausdrücklich teilen | Erst jetzt sieht **TR** genau diese Antwort | | |
| 10 | Als **V** erneut prüfen | Immer noch nichts – geteilt wurde mit der Trainer:in, nicht mit dem Verein | | |
| 11 | Als **TR** versuchen, eine fremde Antwort zu teilen | Abgewiesen | | |
| 12 | Nach einem Helfereinsatz die Auswahl öffnen | «Du und die organisierende Person» statt der Trainer:in (A4) | | |

---

## TC-005: Keine Punkte (BR-138)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Vor dem Antworten den Punktestand von **A** notieren | Vorbereitung | | |
| 2 | Das Check-in beantworten | Der Punktestand ist **unverändert** | | |
| 3 | Den Punkte-Verlauf öffnen | Kein Eintrag zum Check-in | | |
| 4 | In den Punkteregeln nach einer Regel für Check-ins suchen | Es gibt keine | | |
| 5 | Den Hinweis im Blatt lesen | «Dafür gibt es keine Punkte» steht sichtbar, nicht im Kleingedruckten (Schritt 7) | | |
| 6 | Zehn Check-ins beantworten und die Rangliste prüfen | Die Position hat sich nicht verändert | | |

---

## TC-006: Überspringen (FR-103, A1)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **B** ein Check-in öffnen und «Überspringen» wählen | Toast «Übersprungen. Zu diesem Termin fragen wir nicht erneut.» | | |
| 2 | Die Seite neu laden | Das Check-in ist weg | | |
| 3 | In der Datenbank `checkin_responses` prüfen | **Keine** Zeile – ein Überspringen ist keine Antwort | | |
| 4 | `detect_checkins()` erneut laufen lassen | **B** wird zu diesem Termin nicht erneut gefragt | | |
| 5 | Per SQL versuchen, das übersprungene Check-in zu beantworten | Abgewiesen | | |
| 6 | Prüfen, ob das Überspringen irgendwo als Wert erscheint | Nirgends – nicht im Verlauf, nicht im Teamwert | | |

---

## TC-007: Eigener Verlauf (FR-105)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **A** mehrere Check-ins über Tage beantworten | Vorbereitung | | |
| 2 | «Befinden» öffnen | Die Kurve steht da, mit Anzahl und Schnitt darunter | | |
| 3 | Die Kurve auf Achsenbeschriftungen prüfen | Es gibt keine – sie zeigt eine Richtung, keine Note | | |
| 4 | Mit einer einzigen Antwort prüfen | Ein Punkt in der Mitte, keine Linie quer durchs Bild | | |
| 5 | Mit einer Sprachausgabe prüfen | Das Diagramm trägt eine Beschreibung | | |
| 6 | Als **B** `my_checkin_trend()` mit der Kennung von **A** aufrufen | Nicht möglich – die Funktion hat keinen Parameter dafür | | |
| 7 | Als **TR** den Verlauf von **A** suchen | Es gibt keinen Weg dorthin | | |

---

## TC-008: Team-Stimmung (FR-106, BR-140)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Mit **vier** beantworteten Check-ins im Team als **TR** die Seite öffnen | «Zu wenige Antworten» – **keine** Zahl, kein Balken, kein Näherungswert | | |
| 2 | Die fünfte Antwort erfassen | Erst jetzt erscheint ein Wert, mit der Anzahl daneben | | |
| 3 | Prüfen, ob einzelne Antworten sichtbar sind | Nein – nur der Aggregatwert | | |
| 4 | Prüfen, ob sichtbar ist, **wer** geantwortet hat | Nein, auch nicht als Quote | | |
| 5 | Als Mitglied ohne Trainerrolle `team_mood()` aufrufen | Abgewiesen | | |
| 6 | Als **TR** eines **anderen** Teams aufrufen | Der eigene Wert, nicht der fremde | | |
| 7 | Das Zeitfenster (`clubs.settings.checkin.windowDays`) verkleinern | Ältere Antworten fallen heraus; unter fünf verschwindet der Wert wieder | | |

---

## TC-009: Selbst-Nudge (FR-108, A6)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Für **C** drei Antworten mit Wert 1 oder 2 innerhalb von 28 Tagen erfassen | Vorbereitung | | |
| 2 | `nudge_low_checkins()` laufen lassen | **C** erhält «Magst du darüber reden?» | | |
| 3 | Die Inbox von **TR** und **V** prüfen | **Keine** Meldung – A6 kennt genau eine Empfängerin | | |
| 4 | Ein Fürsorge-Signal suchen | Es entsteht keines aus einem Check-in | | |
| 5 | Den Auftrag erneut laufen lassen | Kein zweiter Nudge – eine Wiederholung wäre eine Mahnung | | |
| 6 | Den Text der Meldung lesen | Er fragt, er stellt nichts fest | | |

---

## TC-010: Entlastungs-Index (FR-109)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **V** ein Amt zuweisen (UC-031) und `ask_office_load()` laufen lassen | **V** erhält die Frage «Wie tragfähig fühlt sich dein Amt an?» | | |
| 2 | Das Check-in öffnen | **Keine** Sichtbarkeitswahl – nur «Nur du» | | |
| 3 | Antworten | Toast bestätigt | | |
| 4 | Den Auftrag erneut laufen lassen | Keine zweite Frage im selben Quartal | | |
| 5 | Prüfen, ob jemand anders den Wert sieht | Niemand – auch nicht der übrige Vorstand | | |
| 6 | Die Einladung in der Datenbank prüfen | `event_id` leer – sie hängt an einem Amt, nicht an einem Termin | | |

---

## TC-011: Vier Sprachen

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf Französisch, Italienisch und Englisch je ein Check-in öffnen | Alle Texte übersetzt, keine Schlüssel sichtbar | | |
| 2 | Den Hinweis «keine Punkte» prüfen | In allen vier Sprachen vorhanden und vollständig | | |
| 3 | Die Fragetexte prüfen | Sie stehen in der Sprache, die der Verein eingetragen hat – die App übersetzt sie nicht | | |
| 4 | Die Skala prüfen | Die Gesichter sind sprachneutral; die Beschriftung darunter nicht abgeschnitten | | |
| 5 | Die Kategorie in den Benachrichtigungen prüfen | «Befinden» steht in der Liste und lässt sich abschalten | | |

---

## TC-012: iOS-Erscheinung und Bedienung

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Seite im iOS-Modus öffnen | Gruppierte Listen, grosser Titel klappt beim Scrollen zusammen | | |
| 2 | Ein Check-in antippen | Das Blatt fährt als Karte über die Seite | | |
| 3 | Das Blatt nach unten wischen | Es schliesst; nichts wurde gespeichert und nichts übersprungen | | |
| 4 | Die Skala mit dem Daumen bedienen | Alle fünf Stufen sind ohne Zielen erreichbar (44 px) | | |
| 5 | Auf einem schmalen Gerät (320 px) prüfen | Die fünf Stufen brechen nicht um, kein waagerechtes Scrollen | | |
| 6 | Während des Ladens hinsehen | Ein Skelett, kein Spinner | | |
| 7 | Die Seite nach unten ziehen | Aktualisierung lädt offene Check-ins und den Verlauf neu | | |
| 8 | Im Dunkelmodus prüfen | Die Kurve ist sichtbar, die Gesichter lesbar | | |

---

## Offen

- **Die Frist «anhaltend tief»** aus A6 ist nicht spezifiziert. Angenommen:
  drei Antworten mit Wert ≤ 2 innerhalb von 28 Tagen.
- **Das Zeitfenster des Teamwerts** ist nicht spezifiziert. Angenommen:
  28 Tage, einstellbar über `clubs.settings.checkin.windowDays`.
- **Das Sprachmemo aus A4** fehlt weiterhin (BR-125, offen seit UC-029);
  umgesetzt ist der Freitext.
- **FR-109 bleibt `Partial`:** Der Entlastungs-Index wird erhoben, ein
  aggregierter Wert für den Vorstand erschiene aber erst ab fünf
  Amtsinhaber:innen (BR-140) – bei kleinen Vereinen also nie. Ob die Regel für
  diesen Fall gelockert werden soll, ist eine Stakeholder-Frage.
- **Die Erstbefüllung ist deutsch.** Ein Verein, der französisch spricht,
  schreibt die Fragen um; die App übersetzt sie nicht, weil sie ihm gehören.

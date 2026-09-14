# Manual Test Plan: UC-042 — Saisonziel für den Beitrag

**Use Case:** [UC-042](../use_cases/UC-042-saisonziel-beitrag.md)
**Geltungsbereich:** Modulschalter, Vereinsziel, Beitragsübersicht mit Ampel, CSV-Export, Fortschrittskarte, abweichendes Ziel, Vorstands-Signal
**Anforderungen:** FR-158 bis FR-162, NFR-039
**Regeln:** BR-197 bis BR-204
**Erstellt:** 2026-09-14

## Vorbereitung

- **V** — Vorstand des Vereins (Rolle admin). **M** — Mitglied ohne Vorstandsrolle. **S** — Sportchef:in.
- Migration `0080_contribution_goal.sql` ist eingespielt.
- Der Verein hat einen Saisonbeginn gesetzt (sonst gilt das Kalenderjahr).
- Mindestens eine aktive Punkteregel der Säule 3 (`shift_done`) und eine der Säule 7.
- Ein Helfer-Event mit mindestens einer Schicht in der Zukunft.

---

## TC-001: Modul einschalten und Ziel setzen (Hauptablauf, BR-199)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** Profil → Verwaltung öffnen | Kein Eintrag «Beiträge der Saison» – das Modul ist aus | | |
| 2 | Vereinseinstellungen öffnen, Abschnitt «Module» | Zeile «Saisonziel» mit Erklärtext, Schalter aus | | |
| 3 | Schalter «Saisonziel» einschalten | Direkt darunter erscheint der Abschnitt «Saisonziel» mit dem Feld «Ziel in Punkten» | | |
| 4 | Die Fussnote lesen | Sie nennt einen Vorschlag, z. B. «4 Einsätze entsprechen 200 Punkten» | | |
| 5 | «200» eintragen und speichern | Toast «Gespeichert» | | |
| 6 | Zurück auf Profil → Verwaltung | Eintrag «Beiträge der Saison» ist jetzt da | | |

---

## TC-002: Übersicht mit Ampel und Reihenfolge (FR-160)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** «Beiträge der Saison» öffnen | Drei Kennzahlen oben: Erreicht, Auf dem Weg, Offen | | |
| 2 | Die Liste ansehen | Jede Zeile mit Avatar, Name, Restzahl und Badge «Ist/Soll» | | |
| 3 | Reihenfolge prüfen | Wer am weitesten zurückliegt, steht zuoberst; Befreite zuunterst | | |
| 4 | Badge prüfen (VoiceOver bzw. TalkBack) | Vorgelesen wird ein Satz («Ziel noch offen»), angezeigt nur die Zahl | | |
| 5 | Balkenfarbe prüfen | Unter 50 % rot, ab 50 % orange, ab 100 % grün | | |

---

## TC-003: Abweichendes Ziel und Befreiung (FR-159, BR-200, A1)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** eine Zeile antippen | Blatt mit dem Namen und dem Feld «Ziel in Punkten», Platzhalter «Vereinsziel» | | |
| 2 | «100» eintragen, speichern | Zeile rechnet neu, Badge zeigt Ist/100 | | |
| 3 | Dieselbe Zeile öffnen, «0» eintragen, speichern | Zeile steht als «Befreit», ohne Balken, und rutscht ans Listenende | | |
| 4 | Dieselbe Zeile öffnen, Feld leeren, speichern | Es gilt wieder das Vereinsziel (200) | | |
| 5 | «-5» eintragen und speichern | Fehlermeldung, der bisherige Wert bleibt | | |

---

## TC-004: Fortschrittskarte des Mitglieds (FR-161, A3, A7)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** den Profil-Tab öffnen | Abschnitt «Dein Saisonziel» über der Punktehistorie | | |
| 2 | Karte lesen | Saison, «Noch n Punkte bis zum Ziel», Balken, Badge «Ist/Soll» | | |
| 3 | Darunter | Bis zu drei Vorschläge (Schicht, Aufgabe, Termin) mit Datum und Punktwert | | |
| 4 | Einen Vorschlag antippen | Führt in die Agenda bzw. den Marktplatz zum passenden Gegenstand | | |
| 5 | Als **V** dieses Mitglied auf Ziel «0» setzen, als **M** neu laden | Die Karte ist verschwunden, der übrige Punktestand unverändert | | |
| 6 | Als **V** das Modul ausschalten, als **M** neu laden | Karte bleibt weg; Punkte, Rangliste und Marktplatz unverändert | | |

---

## TC-005: Buchung, Fortschritt und Dank (A5, BR-197)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** eine Schicht übernehmen | Eintrag steht in der Agenda | | |
| 2 | Als **V** die Schicht bestätigen | Meldung mit dem gutgeschriebenen Punktwert | | |
| 3 | Als **M** den Profil-Tab erneut betreten | Ist und Balken sind um den Punktwert der Schicht gewachsen | | |
| 4 | Genug Beiträge bis über das Ziel buchen | Eine Nachricht «Saisonziel erreicht» erscheint in der Inbox, **ohne** Rangvergleich | | |
| 5 | Karte ansehen | Zustand «erreicht», Häkchen, **keine** Vorschlagsliste mehr | | |
| 6 | Eine weitere Buchung auslösen | **Keine** zweite Nachricht «Saisonziel erreicht» | | |

---

## TC-006: Export für den Kassier (BR-203)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** am Listenende «Als CSV teilen» tippen (Gerät) | Das Teilen-Blatt des Systems öffnet sich mit dem Inhalt | | |
| 2 | Dasselbe im Browser | Eine Datei `<verein>-beitraege.csv` wird geladen, Toast «Datei erstellt» | | |
| 3 | Datei in Excel öffnen | Fünf Spalten, Umlaute korrekt, ein Name mit Semikolon verschiebt nichts | | |
| 4 | Inhalt prüfen | Name, Geleistet, Ziel, Offen, Stand – dieselben Zahlen wie in der Liste | | |

---

## TC-007: Geltungsbereich (NFR-039, BR-201)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** `/tabs/profile/contribution` direkt aufrufen | Erklärender Zustand «Nur der Vorstand», kein Datensatz | | |
| 2 | Als **M** in der App nach einer Liste fremder Rückstände suchen | Es gibt keine – weder Rangliste noch Marktplatz zeigen fremde Ziele | | |
| 3 | Als **S** (Sportchef:in) die Seite öffnen | Die Übersicht ist sichtbar (`is_club_board()`) | | |
| 4 | Als Konto eines **anderen** Vereins die Funktion aufrufen | Fehler, keine Zeilen | | |

---

## TC-008: Übernommene Schichten (BR-204)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Ein Helfer-Event aus der bisherigen App in der Agenda öffnen | Die Schichten tragen 25, 50 oder 100 Punkte – **nicht** 1 | | |
| 2 | Eine kurze Schicht (unter 2 h) prüfen | 25 Punkte | | |
| 3 | Eine Schicht über einen halben Tag prüfen | 50 Punkte | | |
| 4 | Eine Ganztagsschicht prüfen | 100 Punkte | | |
| 5 | Den nächtlichen Abgleich laufen lassen, danach erneut prüfen | Die Werte bleiben; die alte App setzt sie nicht zurück | | |
| 6 | Eine bereits bestätigte Schicht prüfen | Ihr Wert und die Buchung im Ledger sind unverändert (BR-052) | | |

---

## TC-009: Vorstands-Signal (FR-162, BR-202, A6)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Saisonbeginn so setzen, dass weniger als acht Wochen bis zum Saisonende bleiben | – | | |
| 2 | `detect_contribution_gaps()` auslösen (oder den Montags-Auftrag abwarten) | Ein Vereinssignal «Mitglieder ohne Beitrag» entsteht | | |
| 3 | Als **V** die Vereins-Gesundheit öffnen | Das Signal nennt eine **Zahl**, keine Namen | | |
| 4 | Das Signal öffnen | Drei Handlungsfragen an den Verein, kein Urteil über Personen | | |
| 5 | Den Lauf wiederholen | Es entsteht **kein** zweites Signal derselben Art | | |
| 6 | Modul ausschalten, Lauf wiederholen | Es entsteht kein Signal | | |

---

## TC-010: Saisonwechsel (A4)

**Priority:** Low

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Saisonbeginn so verschieben, dass eine neue Saison gilt | Rückfrage zum Saisonwechsel erscheint | | |
| 2 | Bestätigen, dann die Übersicht öffnen | Ist steht bei allen auf 0, das Ziel bleibt stehen | | |
| 3 | Die Punktehistorie eines Mitglieds öffnen | Die Buchungen der Vorsaison sind unverändert lesbar | | |

# Manual Test Plan: UC-042 — Saisonziel für den Beitrag

**Use Case:** [UC-042](../use_cases/UC-042-saisonziel-beitrag.md)
**Geltungsbereich:** Modulschalter, Vereinsziel, Beitragsübersicht mit Ampel, CSV-Export, Fortschrittskarte, abweichendes Ziel, Vorstands-Signal
**Anforderungen:** FR-158 bis FR-162, FR-198, NFR-039
**Regeln:** BR-197 bis BR-204, BR-263 bis BR-266
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
| 1 | Als **V** Profil öffnen, Gruppe «Punkte & Geld» | Kein Eintrag «Saisonziel je Mitglied» – das Modul ist aus | | |
| 2 | Vereinseinstellungen öffnen, Abschnitt «Module» | Zeile «Saisonziel» mit Erklärtext, Schalter aus | | |
| 3 | Schalter «Saisonziel» einschalten | Direkt darunter erscheint der Abschnitt «Saisonziel» mit dem Feld «Ziel in Punkten» | | |
| 4 | Die Fussnote lesen | Sie nennt einen Vorschlag, z. B. «4 Einsätze entsprechen 200 Punkten» | | |
| 5 | «200» eintragen und speichern | Toast «Gespeichert» | | |
| 6 | Zurück auf Profil → «Punkte & Geld» | Eintrag «Saisonziel je Mitglied» ist jetzt da | | |

---

## TC-002: Übersicht mit Ampel und Reihenfolge (FR-160)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** «Saisonziel je Mitglied» öffnen | Drei Kennzahlen oben: Erreicht, Auf dem Weg, Offen | | |
| 2 | Die Liste ansehen | Jede Zeile mit Avatar, Name, Restzahl und Badge «Ist/Soll» | | |
| 3 | Reihenfolge prüfen | Wer am weitesten zurückliegt, steht zuoberst; Befreite zuunterst. **Eingeplantes zählt dabei mit** (BR-266) – wer eingeteilt ist, rutscht nach unten, siehe TC-012 | | |
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

---

## TC-011: Eingeplante Punkte auf der Fortschrittskarte (FR-198, BR-265)

**Priority:** High
**Vorbedingung:** Migration `0103` ist eingespielt. **M** hat das Vereinsziel (200) und keine Buchung dieser Saison.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** den Punktestand öffnen | Die Karte zeigt «0/200», keine Zeile über Eingeplantes | | |
| 2 | Als **M** eine künftige Schicht über 4 Stunden übernehmen (50 Punkte) | – | | |
| 3 | Zurück auf den Punktestand, Ansicht aktualisieren | Unter dem Balken steht «50 Punkte eingeplant»; das Abzeichen zeigt weiter **0/200** | | |
| 4 | Den Balken ansehen | Ein zweiter, blasser Abschnitt reicht bis zu einem Viertel; der farbige Teil bleibt bei null | | |
| 5 | Die Zeile «Noch … bis zum Ziel» lesen | Sie nennt **200**, nicht 150 – der Rest zählt zum Geleisteten, nicht zur Zusage | | |
| 6 | Als **V** die Schicht bestätigen (UC-013) | – | | |
| 7 | Als **M** aktualisieren | Abzeichen «50/200», die Zeile über Eingeplantes ist **weg** – dieselben Punkte stehen nicht zweimal | | |
| 8 | Als **M** ein künftiges Training zusagen | Die Zeile über Eingeplantes erscheint **nicht** – Säule 1 zählt nicht aufs Ziel | | |
| 9 | Die Vorschläge unter der Karte durchsehen | Nur Schichten, Aufgaben und Ämter; **kein** Training und **kein** Spiel | | |

---

## TC-012: Eingeplantes in der Vorstandsübersicht (BR-266)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** «Saisonziel je Mitglied» öffnen | Bei **M** aus TC-011 steht unter dem Rest eine Zeile «… Punkte eingeplant» | | |
| 2 | Die Reihenfolge der Liste prüfen | **M** steht **nicht** ganz oben, obwohl sein Ist null ist – wer eingeteilt ist, braucht keine Ansprache | | |
| 3 | Die Liste als CSV teilen und öffnen | Die Spalte «Eingeplant» steht zwischen «Geleistet» und «Ziel»; die Zahlen sind **nicht** addiert | | |
| 4 | Saisonbeginn so setzen, dass weniger als acht Wochen bleiben, `detect_contribution_gaps()` auslösen | Die gemeldete Zahl zählt **M** nicht mit | | |

---

## TC-013: Punkte fürs Amt gutschreiben (UC-041 A9, BR-264)

**Priority:** High
**Vorbedingung:** Ein Amt mit Punktwert (z. B. 200) und einer Inhaber:in **mit verknüpftem Konto**.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** die Ämterseite öffnen | Abschnitt «Punkte fürs Amt» mit der Zahl der buchbaren Sitze | | |
| 2 | Ein Amt öffnen und seinen Punktwert auf leer setzen, speichern | Die Zahl im Abschnitt sinkt um die Sitze dieses Amtes | | |
| 3 | Den Wert wieder setzen | Die Zahl steigt zurück | | |
| 4 | «Fällige Quartale gutschreiben» antippen | Toast nennt die Zahl der gutgeschriebenen Quartale (im zweiten Quartal der Saison: zwei je Sitz) | | |
| 5 | Als Inhaber:in die Punktehistorie öffnen | Zwei Buchungen «Amt ausgeübt» mit je einem Viertel des Saisonwerts, Säule 7 | | |
| 6 | Als Inhaber:in die Meldungen öffnen | Eine Meldung je Quartal, mit dem Namen des Amtes | | |
| 7 | Als Inhaber:in den Punktestand öffnen | Die Fortschrittskarte zeigt die Buchungen als **geleistet** und die restlichen Quartale als **eingeplant** | | |
| 8 | Als **V** erneut «Fällige Quartale gutschreiben» | Toast «Es war schon alles gutgeschrieben» – es entsteht keine zweite Buchung | | |
| 9 | Als **M** (ohne Vorstandsrolle) die Ämterseite öffnen | Der Abschnitt «Punkte fürs Amt» fehlt | | |

---

## TC-014: Termine tragen ihre Punkteregel (BR-263)

**Priority:** Medium
**Vorbedingung:** Ein Verein mit übernommenen Terminen aus der bisherigen App oder vom Verband.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** ein übernommenes Training in der Agenda öffnen und bearbeiten | Das Feld «Punkteregel» steht auf «Training besucht» | | |
| 2 | Ein übernommenes Spiel öffnen | Die Regel steht auf «Spiel bestritten» | | |
| 3 | Einen Helferanlass öffnen | Die Regel ist **leer** – der Beitrag ist die Schicht | | |
| 4 | Bei einem Training die Regel von Hand auf «leer» setzen und speichern | Sie bleibt leer | | |
| 5 | Den nächtlichen Abgleich auslösen (UC-040) | Die Regel bleibt **leer** – der Abgleich überschreibt keine Entscheidung | | |
| 6 | Als **M** an einem Training mit Regel einchecken | Der Punktestand wächst um den Regelwert; der Erfolgsdialog nennt die Punkte | | |

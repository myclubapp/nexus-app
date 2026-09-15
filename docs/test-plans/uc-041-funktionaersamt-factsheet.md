# Manual Test Plan: UC-041 — Funktionärsamt mit Factsheet

**Use Case:** [UC-041](../use_cases/UC-041-funktionaersamt-mit-factsheet.md)
**Geltungsbereich:** Ämterliste, Formular, Factsheet-PDF, Marktplatz-Abschnitt, Sitzrechnung, Verteiler
**Anforderungen:** FR-126, FR-127, FR-193, FR-194
**Regeln:** BR-183 bis BR-186, BR-255, BR-256
**Erstellt:** 2026-09-12 · **Ergänzt:** 2026-09-15 (TC-008 bis TC-010)

## Vorbereitung

- **V** — Vorstand des Vereins. **M** — Mitglied ohne Vorstandsrolle. **F** — Konto eines anderen Vereins.
- Migration `0070_office_factsheets.sql` ist eingespielt; Bucket `factsheets` besteht.
- Bei Kadetten: `import_kadetten.sql` ist gelaufen, 19 PDFs liegen im Bucket unter dem Vereinsordner.
- Ein PDF unter 10 MB und eine PNG-Datei liegen auf dem Testgerät bereit.

---

## TC-001: Amt anlegen mit Besetzung und PDF (Hauptablauf, BR-184)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** Profil → Verwaltung → Ämter öffnen | Liste aller Ämter, rechts je Zeile «Besetzt» oder «n Sitze frei» | | |
| 2 | Das Plus unten rechts tippen | Blatt «Amt anlegen» mit Bezeichnung, Warum, Pflichtenheft, Eckdaten, Besetzung, Ansprechperson, Factsheet | | |
| 3 | «Materialwart:in» eingeben, Pflichten als zwei Absätze (erste Zeile Titel, zweite Zeile Satz), Aufwand «6h», Helferpunkte «2», Sitze 2 | Keine Fehlermeldung | | |
| 4 | «Person hinzufügen», Name «Anna Beispiel» ohne Mitglied | Zeile mit Mitglied «Ohne Konto», Name editierbar | | |
| 5 | «PDF wählen», das PDF auswählen | Hinweis «Wird beim Speichern hochgeladen: …» | | |
| 6 | Speichern | Toast «Gespeichert», Zeile «Materialwart:in» mit «1 Sitz frei» | | |
| 7 | Zeile antippen | Factsheet-Blatt: Badge «1 Sitz frei», Pflichten mit Titel und Satz, «1 von 2 besetzt», Anna Beispiel, Knopf «Factsheet öffnen (PDF)» | | |
| 8 | «Factsheet öffnen (PDF)» tippen | Das PDF öffnet sich (Browser bzw. Systemanzeige) | | |

---

## TC-002: Sitzrechnung und ad interim (BR-183, A1)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** «Materialwart:in» bearbeiten, «Anna Beispiel» auf «ad interim» stellen, speichern | Zeile zeigt «2 Sitze frei» | | |
| 2 | Zweite Person «Ben Beispiel» ordentlich hinzufügen, speichern | «1 Sitz frei»; im Blatt steht bei Anna «ad interim» | | |
| 3 | Sitze auf 1 setzen | Fehlermeldung «Mehr Inhaber:innen als Sitze …», Speichern gesperrt | | |
| 4 | Sitze auf 1 lassen, Ben entfernen, speichern | Zeile «1 Sitz frei» (Anna ad interim zählt nicht) | | |
| 5 | Anna auf ordentlich stellen, speichern | Zeile «Besetzt» | | |

---

## TC-003: Marktplatz zeigt vakante Ämter (FR-127, A5)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** (ohne Beitrags-Profil) den Marktplatz öffnen | Abschnitt «Ämter zu vergeben» mit allen Ämtern, die freie Sitze haben; grösste Lücke zuoberst | | |
| 2 | Eine Zeile prüfen | Titel, darunter Aufwand · Helferpunkte, rechts Badge «n Sitze frei» | | |
| 3 | Zeile antippen | Dasselbe Factsheet-Blatt wie in der Ämterliste, ohne «Amt bearbeiten» | | |
| 4 | Letzte Zeile «Alle Ämter des Vereins» tippen | Ämterliste mit Zurück zum Marktplatz; kein Plus, kein Wischen | | |
| 5 | Als **M** Beitrags-Profil mit «Finanzen» erfassen, Marktplatz erneut öffnen | Bei passenden Ämtern steht «Passt zu dir» im Sekundärtext | | |
| 6 | Als **V** alle Sitze besetzen | Abschnitt verschwindet; «Alle Ämter» ist über die Verwaltung weiterhin erreichbar | | |

---

## TC-004: Factsheet ersetzen, entfernen, abweisen (A3, A6, BR-186)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** ein Amt mit PDF bearbeiten, «PDF ersetzen», die PNG wählen | Meldung «Nur PDF-Dateien.», die vorherige Wahl bleibt | | |
| 2 | Ein anderes PDF wählen, speichern | Im Blatt öffnet der Knopf das neue PDF | | |
| 3 | Bearbeiten, «PDF entfernen», speichern | Kein Knopf «Factsheet öffnen» mehr | | |
| 4 | Als **F** die signierte Adresse aus Schritt 2 (kopiert) nach Ablauf aufrufen | Kein Zugriff | | |
| 5 | Als **M** in der Browser-Konsole `supabase.storage.from('factsheets').upload('<club_id>/x.pdf', …)` versuchen | Abgewiesen (Policy: nur Vorstand) | | |
| 6 | Als **F** `supabase.storage.from('factsheets').createSignedUrl('<club_id>/…', 60)` versuchen | Abgewiesen (fremder Vereinsordner) | | |

---

## TC-005: Verteiler folgt der Besetzung (BR-185, UC-031)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** «Kassier:in» bearbeiten, Person hinzufügen und **M** als Mitglied wählen | Der Name füllt sich aus dem Mitglied, Feld nicht editierbar | | |
| 2 | Speichern; als **M** einen Sitzungs-Input an das Gremium «Kassier:in» einreichen (UC-031) | **M** sieht den Input im Eingangskorb (hält das Amt) | | |
| 3 | Als **V** **M** aus der Besetzung entfernen, speichern | Der Input bleibt für **V** (Vorstand) sichtbar, für **M** nicht mehr | | |
| 4 | Als **V** versuchen, `functionary_roles.holder_member_id` direkt per PostgREST zu setzen | «permission denied» | | |
| 5 | Sitzungsagenda einer Sitzung öffnen | «Vakante Ämter» nennt genau die Ämter mit freien Sitzen, Detail = Anzahl | | |

---

## TC-006: Auflösen und Leerzustand

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** «Materialwart:in» nach links wischen, «Auflösen» | Rückfrage mit dem Titel; «Auflösen» rot | | |
| 1b | Alternativ: das Amt antippen, im Detail unter «Verwalten» die rote letzte Zeile «Auflösen» wählen | Das Detail schliesst, dieselbe Rückfrage erscheint | | |
| 2 | Bestätigen | Toast «Amt aufgelöst.», Zeile weg, PDF im Bucket gelöscht | | |
| 3 | Alle Ämter auflösen | Leerzustand mit Knopf «Amt anlegen» | | |
| 4 | Als **M** die Ämterliste (über den Marktplatz-Link) öffnen, wenn kein Amt besteht | Leerzustand mit Knopf «Marktplatz» | | |

---

## TC-007: Import Kadetten (einmalig)

**Priority:** Low

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** (Kadetten) den Marktplatz öffnen | «Ämter zu vergeben» nennt Spielsekretär:in (4 frei), Schiedsrichter:in (3 frei), Apothekenverantwortliche:r, Damentrainer:in, Eventorganisator:in, Streetfloorball-Verantwortliche:r, OK Jubiläum: Festwirtschaft, OK Jubiläum: Rahmenprogramm, Präsident/in, Trainer:in Herren 1 | | |
| 2 | «Damentrainer:in» öffnen | Jonathan Kissling «ad interim», Badge «1 Sitz frei», Factsheet öffnet Sandros Word-PDF | | |
| 3 | «Juniorentrainer:in» in der Ämterliste öffnen | Zehn Namen, «Besetzt», «10 von 10 besetzt» | | |
| 4 | «Kassier:in» prüfen | Nur ein Amt dieses Namens (das alte «Kassier» wurde umbenannt, nicht verdoppelt) | | |

---

## TC-008: Beschreibung ausgeben und in der Ablage öffnen (FR-193, A7, BR-255)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** im Browser ein Amt öffnen, unter «Verwalten» «Beschreibung exportieren (.md)» wählen | Datei `<verein>-amt-<bezeichnung>-<datum>.md` wird heruntergeladen, Toast «1 Ämterbeschreibung ausgegeben.» | | |
| 2 | Die Datei in einem Editor öffnen | `# Bezeichnung`, darunter ein Kommentar mit der Kennung, dann «Warum es dieses Amt gibt», «Pflichten» als `###`, «Eckdaten» als Aufzählung, «Besetzung» mit «(seit …)» und «(ad interim)» | | |
| 3 | Dieselbe Datei auf Google Drive hochladen und dort in der Vorschau öffnen | Überschriften und Aufzählung sind gesetzt; der Kommentar mit der Kennung ist **nicht** zu sehen | | |
| 4 | In der Ämterliste «Alle Beschreibungen exportieren» wählen | Eine Datei `<verein>-aemter-<datum>.md` mit allen Ämtern, je Amt eine `#`-Überschrift | | |
| 5 | Auf dem **Gerät** (iOS/Android) dieselbe Zeile tippen | Das Teilen-Blatt geht auf und enthält den Text; Abbrechen ergibt «In die Zwischenablage kopiert.» | | |
| 6 | Die App auf Französisch stellen und erneut exportieren | Die Abschnitte heissen «Pourquoi cette fonction existe», «Tâches», «Données clés», «Titulaires» | | |

---

## TC-009: Beschreibung einlesen – Vorlage, Änderung, Rückfrage (FR-194, A8, BR-256)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** in der Ämterliste «Vorlage herunterladen» wählen | Datei `<verein>-amt-vorlage-<datum>.md`, Toast «Vorlage ausgegeben.» | | |
| 2 | In der Vorlage die Bezeichnung auf «Getränkechef:in» setzen, eine Pflicht schreiben, Sitze 2, Vorstand «nein» | — | | |
| 3 | «Beschreibungen einlesen» wählen und die Datei nehmen | Blatt «Was die Datei ändert»: eine Zeile «Getränkechef:in», Abzeichen «Neu», Text «Wird als neues Amt angelegt.» | | |
| 4 | «1 übernehmen» tippen | Toast «1 Amt übernommen.», die Ämterliste zeigt «Getränkechef:in» mit «2 Sitze frei» | | |
| 5 | Die in TC-008 exportierte Datei des Amtes ausserhalb der App ändern (einen Satz im Pflichtenheft) und einlesen | Abzeichen «Ändern», darunter «Ändert: Pflichten» – und **nur** das | | |
| 6 | Übernehmen, danach das Amt öffnen | Der geänderte Satz steht da; Besetzung, Sitze, Punkte und «seit»-Daten sind unverändert (BR-256) | | |
| 7 | Eine Datei einlesen, die nur `# Getränkechef:in` und zwei Pflichten enthält (keine Eckdaten, keine Besetzung) | «Ändert: Pflichten»; nach dem Übernehmen sind Sitze und Besetzung unverändert | | |
| 7b | In der Datei eines besetzten Amtes ein «(seit 2024-06-01)» an einen Namen schreiben und einlesen | «Ändert: Besetzt von»; nach dem Übernehmen steht im Detail «seit 01.06.2024». **Setzt Migration `0099` voraus** – ohne sie bleibt das Datum leer und die Zeile meldet die Änderung erneut | | |
| 8 | Die Datei aller Ämter unverändert einlesen | Jede Zeile sagt «Keine Änderung»; Übernehmen ändert nichts (Liste bleibt gleich) | | |
| 9 | Eine beliebige Textdatei ohne `#`-Überschrift einlesen | «In dieser Datei steht keine Ämterbeschreibung.», Knopf gesperrt | | |
| 9b | In einer Datei «Punkte pro Saison: 99999» setzen und einlesen | Zeile gesperrt, roter Hinweis «Ein Amt trägt zwischen 0 und 10 000 Punkten je Saison.»; es wird nichts gespeichert | | |
| 10 | In der Datei eines Amtes den Kommentar mit der Kennung löschen und die Bezeichnung ändern, dann einlesen | Abzeichen «Neu» – ohne Kennung und ohne gleiche Bezeichnung entsteht ein zweites Amt; abwählen und abbrechen | | |
| 11 | Zwei Ämter «Co-Präsidium» anlegen, eine Datei mit `# Co-Präsidium` ohne Kennung einlesen | Zeile gesperrt, Hinweis «Zwei Ämter tragen diese Bezeichnung …», Knopf «0 übernehmen» gesperrt | | |

---

## TC-010: Einlesen ist kein Weg an der Rollenprüfung vorbei (BR-255, NFR-011)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** (ohne Vorstandsrolle) die Ämterliste öffnen | Der Abschnitt «Ämterbeschreibungen» fehlt; im Detail eines Amtes fehlt «Verwalten» ganz | | |
| 2 | Als **V** die Rolle in einem zweiten Browserfenster auf `member` setzen lassen, dann im ersten Fenster eine Datei übernehmen | Fehler «Nur der Vorstand pflegt die Ämter»; es wird nichts gespeichert | | |
| 3 | Als **F** (anderer Verein) eine Datei mit der Kennung eines fremden Amtes einlesen | Hinweis «Die Kennung in der Datei gehört zu keinem Amt dieses Vereins.»; das Amt entstünde im **eigenen** Verein, das fremde bleibt unberührt | | |
| 4 | Eine Datei mit zwei Ämtern übernehmen, bei der das zweite scheitert (z. B. Rolle dazwischen entzogen) | «1 übernommen, dann abgebrochen: …»; das erste Amt steht in der Liste, das Blatt bleibt offen | | |

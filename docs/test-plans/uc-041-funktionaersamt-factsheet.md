# Manual Test Plan: UC-041 — Funktionärsamt mit Factsheet

**Use Case:** [UC-041](../use_cases/UC-041-funktionaersamt-mit-factsheet.md)
**Geltungsbereich:** Ämterliste, Formular, Factsheet-PDF, Marktplatz-Abschnitt, Sitzrechnung, Verteiler
**Anforderungen:** FR-126, FR-127
**Regeln:** BR-183 bis BR-186
**Erstellt:** 2026-09-12

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

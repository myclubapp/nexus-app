# Manual Test Plan: UC-034 — Vereinsidentität, Begriffe und Module

**Use Case:** [UC-034](../use_cases/UC-034-vereinsidentitaet-konfigurieren.md)
**Geltungsbereich:** Erscheinungsbild, Begriffe je Sprache, Module, Vereins-DNA, Saisonwechsel
**Anforderungen:** FR-111 bis FR-115
**Regeln:** BR-146 bis BR-150
**Erstellt:** 2026-09-11

## Vorbereitung

- **V** — Vorstand (`admin`), **TR** — Trainer:in, **M** — Mitglied.
- Ein **neuer** Verein ohne Module und ein Verein, der Anliegen enthält.
- Migration `0052_club_identity.sql` ist eingespielt.

---

## TC-001: Erscheinungsbild zur Laufzeit (FR-111, BR-146)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** Profil → «Verein» öffnen | Vier Bereiche: Erscheinungsbild, Logo, Begriffe, Module, Vereins-DNA | | |
| 2 | Die Primärfarbe ändern | Die App färbt sich **sofort** um, ohne Speichern und ohne Neustart | | |
| 3 | Die Seite ohne Speichern verlassen | Die alte Farbe gilt wieder | | |
| 4 | Farbe ändern und speichern | Toast bestätigt; nach dem Neuladen bleibt sie | | |
| 5 | Als **M** die App öffnen | Dieselben Farben, ohne dass **M** etwas aktualisiert hat | | |
| 6 | «Zurücksetzen» bei einer Farbe tippen | Die Basisfarbe gilt wieder | | |
| 7 | Eine Logo-Adresse hinterlegen und speichern | Das Logo steht in der Seitenleiste neben dem Vereinsnamen | | |
| 8 | Die Adresse löschen | Die Kopfzeile zeigt wieder nur den Namen, keine leere Fläche | | |
| 9 | Ein hochformatiges Logo verwenden | Die Kopfzeile wird nicht auseinandergezogen | | |

---

## TC-002: Kontrastwarnung (A5)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als Primärfarbe einen blassen Mittelton wählen (z.B. `#8fb3c9`) | Ein Hinweis erscheint **im Abschnitt**, nicht als Toast | | |
| 2 | Den Hinweis lesen | Er nennt die betroffene Farbrolle | | |
| 3 | «Abdunkeln» tippen | Die Farbe wird dunkler, der Hinweis verschwindet | | |
| 4 | Die vorgeschlagene Farbe ansehen | Sie bleibt in der Farbfamilie – nicht Schwarz | | |
| 5 | Eine dunkle Farbe wählen (z.B. `#004a7c`) | Kein Hinweis – ein Vorschlag ohne Anlass wäre Bevormundung | | |
| 6 | Mit Bedienhilfen die Kontrastwerte prüfen | Nach dem Abdunkeln ≥ 4.5:1 | | |

---

## TC-003: Begriffe je Sprache (FR-112, BR-147, BR-148)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Im Bereich Begriffe die Zeile «Training» ansehen | **Vier** Felder: de, fr, it, en | | |
| 2 | Auf Deutsch «Probe» eintragen, die anderen leer lassen, speichern | Toast bestätigt | | |
| 3 | Die Agenda auf Deutsch öffnen | «Probe» statt «Training» | | |
| 4 | Auf Französisch wechseln | **«Probe»** – nicht «Entraînement»: Wer etwas gesagt hat, meint es auch dort | | |
| 5 | Auf Französisch «Répétition» eintragen und speichern | Die Agenda zeigt auf Französisch «Répétition», auf Deutsch weiter «Probe» | | |
| 6 | Das deutsche Feld leeren und speichern | Deutsch zeigt «Répétition» (die hinterlegte Sprache), nicht «Training» | | |
| 7 | **Alle vier** Felder leeren und speichern | Erst jetzt greift die Standardübersetzung je Sprache | | |
| 8 | In der Datenbank `events.type` prüfen | Unverändert `training` – der Begriff ist ein Label, kein Typ (BR-147) | | |
| 9 | Einen Verein mit altem Begriff (Text statt Objekt) prüfen | Die Migration hat ihn in alle vier Sprachen geschrieben; die Anzeige ist unverändert | | |

---

## TC-004: Module sind aus, bis der Vorstand sie einschaltet (FR-115, BR-150)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Einen **neuen** Verein gründen und als **V** das Profil öffnen | Kein «Stimme», kein «Sitzungen», kein «Befinden» | | |
| 2 | Die Verwaltung ansehen | Keine Vereins-Gesundheit, kein Puls, keine Ämter | | |
| 3 | Als **TR** im selben Verein das Profil öffnen | **Gar kein** Abschnitt «Verwaltung» – keine leere Überschrift | | |
| 4 | Den Bereich Module öffnen | Fünf Module mit Titel und einem Satz, was sie bringen | | |
| 5 | «Stimme» einschalten und speichern | Der Weg «Stimme» erscheint im Profil | | |
| 6 | Als **M** nachsehen | Auch dort erscheint er | | |
| 7 | Per SQL `submit_voice_note()` in einem Verein ohne das Modul aufrufen | Abgewiesen – «Das Modul «Stimme» ist in diesem Verein nicht aktiv» (C-011) | | |
| 8 | Dasselbe mit `submit_meeting_input()` | Ebenfalls abgewiesen | | |
| 9 | «Stimme» wieder ausschalten | Der Weg verschwindet; bestehende Anliegen bleiben in der Datenbank | | |
| 10 | `detect_checkins()` in einem Verein ohne das Modul laufen lassen | Keine Einladung | | |
| 11 | Einen Verein prüfen, der vor der Migration Anliegen hatte | «Stimme» ist an – ein benutztes Modul wird nicht weggenommen | | |
| 12 | … und die übrigen Module desselben Vereins | Aus, sofern er sie nie benutzt hat | | |

---

## TC-005: Der Vorschlag (A2, BR-150)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Einen Verein auf über 40 aktive Mitglieder bringen | Vorbereitung | | |
| 2 | `select suggest_modules();` aufrufen | **V** bekommt je Modul eine Meldung | | |
| 3 | Die Meldung antippen | Sie führt in die Vereinseinstellungen | | |
| 4 | Prüfen, ob ein Modul dadurch aktiv wurde | **Nein** – vorgeschlagen ist nicht eingeschaltet (BR-150) | | |
| 5 | Den Aufruf wiederholen | Kein zweiter Vorschlag – eine Wiederholung wäre eine Aufforderung | | |
| 6 | Einen Verein mit 10 Mitgliedern prüfen | Kein Vorschlag | | |
| 7 | Ein Modul einschalten und den Aufruf wiederholen | Dafür kommt kein Vorschlag mehr | | |
| 8 | Als **M** die Vorschlagstabelle abfragen | Kein Zugriff – sie gehört dem Vorstand | | |

---

## TC-006: Saisonbeginn (FR-113, A4)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Saisonbeginn ändern und speichern | Eine Rückfrage erscheint **vor** dem Speichern | | |
| 2 | Den Text der Rückfrage lesen | Er sagt, dass künftige Buchungen der neuen Saison zufallen und gebuchte Punkte ihre behalten | | |
| 3 | «Abbrechen» tippen | Nichts wurde gespeichert; das Feld steht weiter auf dem neuen Wert | | |
| 4 | Die Knopffarben ansehen | «Abbrechen» in Vereinsfarbe, keine Farbe von Hand gesetzt | | |
| 5 | Bestätigen | Gespeichert; das Saison-Label auf dem Dashboard stimmt mit der Vorschau überein | | |
| 6 | Einen bereits gebuchten Punkt prüfen | Seine Saison ist unverändert | | |
| 7 | Nur den Namen ändern und speichern | **Keine** Rückfrage – wer nichts an der Saison ändert, wird nicht gefragt | | |
| 8 | Denselben Saisonbeginn erneut eingeben und speichern | Ebenfalls keine Rückfrage | | |

---

## TC-007: Vereins-DNA (FR-114, A3)

**Priority:** Low

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Bereich Vereins-DNA öffnen | Vier Felder: Warum, Werte, Anrede und Tonalität, Traditionen | | |
| 2 | Etwas eintragen und speichern | Toast bestätigt; nach dem Neuladen steht es da | | |
| 3 | Die Fussnote lesen | Sie sagt offen, dass die Angaben heute gespeichert und noch nicht verwendet werden | | |
| 4 | Ein Feld leeren und speichern | Es verschwindet aus den Einstellungen, statt leer stehen zu bleiben | | |

---

## TC-008: Konfiguration ist Kür (BR-149)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Einen neuen Verein gründen und **nichts** konfigurieren | Agenda, Einladung und Punkte funktionieren vollständig | | |
| 2 | Die Farben prüfen | Die Basisfarben der App | | |
| 3 | Die Terminarten prüfen | Die Standardübersetzung je Sprache | | |
| 4 | Den Saisonstand prüfen | Ein sinnvolles Label ohne Eingabe | | |
| 5 | Prüfen, ob irgendwo eine Pflichtangabe fehlt | Nirgends | | |

---

## TC-009: Berechtigung

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** die Vereinseinstellungen über die URL aufrufen | Der Hinweis «nur für den Vorstand» | | |
| 2 | Als **M** per SQL `clubs` aktualisieren | Von der Policy abgewiesen (`is_club_admin()`) | | |
| 3 | Als **TR** dasselbe versuchen | Ebenfalls abgewiesen | | |
| 4 | Als **V** speichern | Geht durch | | |

---

## TC-010: Vier Sprachen und iOS

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Seite auf Französisch, Italienisch und Englisch öffnen | Alle Texte übersetzt, keine Schlüssel sichtbar | | |
| 2 | Die Modulbeschreibungen lesen | Vollständig, nicht abgeschnitten | | |
| 3 | Die vier Sprachfelder je Terminart auf 320 px prüfen | Kein waagerechtes Scrollen | | |
| 4 | Die Rückfrage zum Saisonbeginn in jeder Sprache öffnen | «Abbrechen»/«Speichern» übersetzt | | |
| 5 | Im iOS-Modus scrollen | Der grosse Titel klappt zusammen, die Abschnitte sind gruppiert | | |
| 6 | Im Dunkelmodus prüfen | Farbwähler und Kontrasthinweis lesbar | | |

---

## Offen

- **Fünf gebaute Module sind ab dieser Fassung standardmässig aus.** K7 und
  BR-150 verlangen es; ein Verein, der die App heute nutzt, behält sie
  (die Migration schaltet ein, was bereits benutzt wird). Zu bestätigen mit den
  Stakeholdern.
- **Das Logo ist eine Adresse, kein Upload.** Supabase Storage ist im Projekt
  nicht eingerichtet (offen seit UC-026); FR-111 bleibt deshalb `Partial`.
- **Die Vereins-DNA wird gespeichert, aber nicht verwendet.** Textunterstützende
  Funktionen gibt es im MVP nicht; FR-114 bleibt `Partial`.
- **Die Schwellen des Vorschlags** (20 für Check-ins, 25 Puls, 30 Cockpit,
  40 Stimme und Sitzungen) sind eine Annahme – A2 nennt nur «etwa vierzig».
- **Der Grenzwert der Kontrastprüfung** ist 4.5:1 (WCAG AA); A5 nennt keinen.

# Manual Test Plan: UC-043 — Mitgliederdaten strukturieren und exportieren

**Use Case:** [UC-043](../implementation/UC-043/plan.md)
**Geltungsbereich:** Strukturierte Stammdaten im Profil, Anzeige im Mitglied-Detail, Export des Vereins, Export eines Teams, Reichweite und Datenschutz des Exports
**Anforderungen:** FR-130, FR-163, FR-018, FR-019
**Regeln:** BR-205 bis BR-209, BR-031, BR-028
**Erstellt:** 2026-09-14

## Vorbereitung

- **V** — Vorstand des Vereins (Rolle admin). **T** — Trainer:in eines Teams, in diesem Team als Mitglied eingetragen. **M** — Mitglied ohne besondere Rolle.
- Migrationen `0081_member_profile_fields.sql` und `0082_member_export.sql` sind eingespielt und `npm run types:generate` ist gelaufen.
- Der Verein hat mindestens zwei Teams; **T** gehört zu genau einem davon.
- Mindestens ein Mitglied hält ein Amt (UC-041), damit die Spalte «Ämter» belegt ist.
- Auf dem Gerät: eine Tabellenkalkulation, die CSV öffnen kann.

---

## TC-001: Stammdaten im eigenen Profil pflegen (FR-163, BR-207)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** Profil → «Profil bearbeiten» öffnen | Oben Vorname, Nachname, Anzeigename, Geburtsdatum | | |
| 2 | Zum Abschnitt «Adresse» blättern | Fünf einzelne Felder: Strasse, Nummer, Postleitzahl, Ort, Land – **kein** mehrzeiliges Textfeld | | |
| 3 | Vorname «Anna», Nachname «Muster» eintragen | Der Anzeigename wird automatisch «Anna Muster» | | |
| 4 | Den Anzeigenamen von Hand auf «Anni» ändern | Der Anzeigename bleibt «Anni» | | |
| 5 | Nachname auf «Mustermann» ändern | Der Anzeigename bleibt «Anni» – er gehört jetzt der Person (BR-208) | | |
| 6 | Geburtsdatum antippen | Der Datumswähler öffnet sich und lässt **kein** Datum nach heute zu | | |
| 7 | Postleitzahl «01067», Ort «Dresden», Land «de» eintragen | Das Land erscheint sofort als «DE» in Grossbuchstaben | | |
| 8 | Speichern | Toast «Gespeichert» oben | | |
| 9 | Das Blatt erneut öffnen | Alle Werte stehen wieder da, die führende Null der Postleitzahl ist erhalten | | |

---

## TC-002: Adresse austragen (0063-Regel: leer heisst löschen)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** im Profilblatt alle fünf Adressfelder leeren | — | | |
| 2 | Speichern, Blatt erneut öffnen | Die Felder sind leer geblieben; die alte Adresse ist nicht zurück | | |
| 3 | Im Datumswähler «Löschen» antippen und speichern | Das Geburtsdatum ist ausgetragen, nicht auf heute gesetzt | | |

---

## TC-003: Der Vorstand sieht die Adresse im Mitglied-Detail

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** Profil → Verwaltung → Mitglieder öffnen, **M** antippen | Block «Kontakt» mit E-Mail, Telefon, Geburtsdatum | | |
| 2 | Den Adressblock lesen | Zwei Zeilen wie auf einem Umschlag: «Musterstrasse 12a», «8000 Zürich» – ein Land steht als eigene dritte Zeile, sonst gar nicht | | |
| 3 | Ein Mitglied ohne Adresse öffnen | Es steht **keine** leere Zeile, der Block zeigt nur, was da ist | | |

---

## TC-004: Verein exportieren (Hauptablauf, FR-130)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** die Mitgliederliste öffnen und ans Ende blättern | Abschnitt «Verwalten» mit der Zeile «Mitglieder exportieren» | | |
| 2 | Prüfen, dass **kein** Export-Symbol in der Kopfzeile steht | Die Kopfzeile trägt nur Titel und Suche (guidelines §11 Nr. 13, 19) | | |
| 3 | Die Zeile antippen | Blatt «Mitglieder exportieren» mit sechs Kästchen | | |
| 4 | Die Voreinstellung prüfen | E-Mail, Telefon, Geburtsdatum, Adresse und Ämter an; Teams aus | | |
| 5 | «Teams» zusätzlich einschalten, «Exportieren» antippen | Auf dem Gerät öffnet das Teilen-Blatt; im Browser lädt eine Datei | | |
| 6 | Den Dateinamen lesen (Browser) | `<vereinskürzel>-mitglieder-<JJJJ-MM-TT>.csv` | | |
| 7 | Die Datei in der Tabellenkalkulation öffnen | Die Spalten stehen einzeln, nicht alles in Spalte A | | |
| 8 | Umlaute prüfen | «Müller» steht als «Müller», nicht als «MÃ¼ller» | | |
| 9 | Die Kopfzeile lesen | Vorname, Nachname, Anzeigename, E-Mail, Telefonnummer, Geburtsdatum, Strasse, Nummer, Postleitzahl, Ort, Land, Rolle, Status, Mitglied seit, Teams, Ämter | | |
| 10 | Rolle und Status in einer Zeile lesen | «Vorstand» und «Aktiv» – nicht `admin` und `active` | | |
| 11 | Eine Postleitzahl mit führender Null prüfen | «01067» steht vollständig, nicht «1067» | | |

---

## TC-005: Der Filter bestimmt, was herausgeht (A2, BR-209)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** in der Mitgliederliste den Status-Filter auf «Passiv» stellen | Die Liste zeigt nur passive Mitglieder, die Zahl im Abschnittstitel stimmt | | |
| 2 | Exportieren | Die Datei enthält genau diese Mitglieder, nicht den ganzen Verein | | |
| 3 | Den Filter auf ein Team stellen und exportieren | Der Dateiname trägt den Teamnamen | | |
| 4 | Den Filter so setzen, dass die Liste leer ist | Die Zeile «Mitglieder exportieren» ist ausgegraut | | |

---

## TC-006: Ein Team exportieren (A1, BR-205)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **T** die Teamliste öffnen und das eigene Team antippen | Das Blatt zeigt die Mitglieder des Teams | | |
| 2 | Ans Ende des Blattes blättern | «Verwalten» mit «Team exportieren»; die rote Zeile «Team löschen» steht darunter | | |
| 3 | «Team exportieren» antippen | Blatt mit nur **vier** Kästchen: E-Mail, Telefonnummer, Teams, Ämter | | |
| 4 | Die Fussnote lesen | Sie sagt, dass Adresse und Geburtsdatum beim Vorstand bleiben (BR-206) | | |
| 5 | Exportieren und die Datei öffnen | Keine Spalten Strasse/Nummer/Postleitzahl/Ort/Land, keine Spalte Geburtsdatum | | |
| 6 | Eine E-Mail-Spalte prüfen | Nur dort gefüllt, wo das Mitglied seine Adresse freigegeben hat (FR-019) | | |
| 7 | Ein Team öffnen, in dem **T** nicht ist, und exportieren | Der Hinweis «Diese Auswahl enthält kein Mitglied» erscheint; es entsteht keine Datei (BR-205) | | |

---

## TC-007: Ein Mitglied ohne Rolle kommt nicht an die Liste (BR-205)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** Profil → Verwaltung öffnen | Kein Eintrag «Mitglieder» | | |
| 2 | `/tabs/profile/members` direkt aufrufen | Hinweis «Nur für den Vorstand» statt der Liste | | |
| 3 | Als **M** ein Team öffnen und ans Blattende blättern | Auch beim eigenen Team erzeugt «Team exportieren» keine Datei, sondern den Hinweis auf die leere Auswahl | | |

---

## TC-008: Teilen auf dem Gerät (Plattformparität)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf iOS als **V** exportieren | Das native Teilen-Blatt öffnet sich mit der Liste als Text | | |
| 2 | Das Teilen-Blatt abbrechen | Die App bleibt bedienbar; die Liste landet in der Zwischenablage mit Toast – ein Tippen tut nie nichts | | |
| 3 | Auf Android wiederholen | Gleiches Verhalten | | |
| 4 | Im Browser (Chrome, Safari) exportieren | Die Datei landet im Download-Ordner | | |

---

## TC-009: Übernahme des Altbestands (UC-040, BR-192)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Lauf «bisherige App übernehmen» erneut starten | Er läuft ohne Fehler durch | | |
| 2 | Als **V** ein übernommenes Mitglied ohne Konto öffnen | Vorname und Nachname stehen jetzt getrennt | | |
| 3 | Ein übernommenes Mitglied **mit** Konto prüfen, das seinen Namen selbst gepflegt hat | Sein Anzeigename ist unverändert | | |
| 4 | Exportieren | Die Spalten Vorname und Nachname sind gefüllt, nicht nur der Anzeigename | | |

---

## Offene Punkte

- Der Export kennt keine Auswahl einzelner Mitglieder – wer eine Teilmenge braucht, filtert die Liste (TC-005).
- Bilder (Logo, Teambild, Profilbild) sind nicht Teil dieses Use Case und für den Export ohne Bedeutung.

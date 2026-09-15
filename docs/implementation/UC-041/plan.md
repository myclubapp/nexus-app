# Implementation Plan: UC-041 — Funktionärsamt mit Factsheet und Vakanz-Anzeige

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand (hinterlegen), Mitglied (ansehen)                          |
| **Goal**          | Die Ämter des Vereins mit Pflichtenheft, Aufwand, Punktwert, Ansprechperson und Factsheet-PDF im Marktplatz zeigen – vakante zuoberst |
| **Plan created**  | 2026-09-12                                                          |
| **Status**        | Done                                                                |

## Overview

`MVP_Scope` §2.3 führt «Funktionärsämter mit Factsheets & Vakanz-Anzeige» als
Ausbaustufe 2 des Marktplatzes. Sandro hat sie am 12.09.2026 vorgezogen: Die
Factsheets seines Vereins liegen als Word-Dateien unter
`docs/marktplatz/97_Funktionäre/`, und sie sollen **im Marktplatz stehen,
samt PDF**.

Die Ämter gibt es seit UC-031 (`functionary_roles`, 0049) – als **Verteiler**
für Sitzungs-Inputs, mit einem Titel und höchstens einer Inhaber:in. Ein
Factsheet kennt mehr: mehrere Sitze (sechs Schiedsrichter:innen, vier
Spielsekretär:innen), Inhaber:innen, die noch kein Konto haben, «ad interim»,
einen Aufwand, einen Punktwert, Pflichten, eine Ansprechperson und das PDF.

**Die Vakanz bekommt damit eine Rechnung** statt eines Nullvergleichs: Ein Amt
ist vakant, wenn es mehr Sitze hat als Personen, die es tragen. Diese Rechnung
steht **einmal** – in `office_open_seats()` – und jede Stelle, die bisher
`holder_member_id is null` las (Sitzungsagenda, Beitrags-Matching,
Nachfolge-Vorlauf, Vorstands-Reaktionszeiten), rechnet ab jetzt damit.

## Related Use Cases

- UC-031 Sitzungs-Input — liefert `functionary_roles`; der Verteiler bleibt
  (`holder_member_id` wird zur gespiegelten Spalte, siehe unten)
- UC-033 Beitrags-Profil — `matching_vacancies()` bietet vakante Ämter an;
  bekommt die neue Vakanz-Rechnung
- UC-023 / UC-024 — `succession_lead()`, `detect_succession_gaps()`,
  `board_response_metrics()` zählen Vakanzen; ebenfalls umgestellt
- UC-017 / UC-018 — der Marktplatz, in dem die Ämter jetzt stehen

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                          | Status vorher | Ziel        | Notizen                                                       |
| ------ | ------------------------------ | ------------- | ----------- | ------------------------------------------------------------- |
| FR-126 | Funktionärsämter mit Factsheet | Deferred      | Implemented | Pflichten, Aufwand, Punktwert, Ansprechperson, PDF im Vereinsspeicher |
| FR-127 | Vakanz-Anzeige                 | Deferred      | Implemented | Abschnitt «Ämter zu vergeben» im Marktplatz, für alle Mitglieder |

### Business Rules

| ID     | Regel                                   | Ziel        | Notizen                                                          |
| ------ | --------------------------------------- | ----------- | ---------------------------------------------------------------- |
| BR-183 | Vakanz ist eine Sitzrechnung            | Implemented | `office_open_seats()` = Sitze minus Inhaber:innen ohne «ad interim»; eine Rechnung, sechs Aufrufer |
| BR-184 | Inhaber:in braucht kein Konto           | Implemented | `functionary_holders.display_name` genügt; `member_id` kommt, wenn die Person beitritt |
| BR-185 | Der Verteiler folgt der Besetzung       | Implemented | `holder_member_id` ist gespiegelt (erste verknüpfte Inhaber:in), nicht mehr direkt schreibbar |
| BR-186 | Das Factsheet gehört dem Verein         | Implemented | Bucket `factsheets`, Pfad `<club_id>/…`; lesen Mitglieder, schreiben Vorstand – über Storage-Policies |

### Non-Functional Requirements

| ID      | Titel                      | Kategorie | Betrifft? | Notizen                                        |
| ------- | -------------------------- | --------- | --------- | ---------------------------------------------- |
| NFR-011 | Mandantentrennung          | Security  | Ja        | Holders über die Rolle, Storage über den Ordner |
| NFR-013 | Funktionsrechte            | Security  | Ja        | `save_office()` prüft `is_club_admin()`; interne Trigger ohne Ausführungsrecht |
| NFR-028 | Vier Sprachen              | Usability | Ja        | Namensraum `offices.*` erweitert                 |
| NFR-032 | Eine Codebasis             | Portab.   | Ja        | PDF öffnet über `href target=_blank` wie die Website-News |

---

## Current State

- `functionary_roles` (0049): `title`, `holder_member_id`, `held_since`. Ein
  Titel je Verein; Vakanz = kein Inhaber.
- Sechs Leser dieser Definition: `meeting_agenda()` (0049),
  `matching_vacancies()` (0051), `succession_lead()` und
  `detect_succession_gaps()` (0056), `board_response_metrics()` (0066), und
  `isVacant()` in `lib/meeting.ts`.
- Verteiler: `holds_committee_role()`, `committee_members()`,
  `ask_office_load()` lesen `holder_member_id` – **bleiben unverändert**.
- Kein Storage-Bucket im Projekt; keine Datei-Uploads in der App.
- `OfficePage` ist eine Vorstandsseite (Titel + eine Person); der Marktplatz
  zeigt Vakanzen nur, wenn das Beitrags-Profil Organisation/Finanzen nennt.

---

## Missing Pieces

### Datenbank (Migration `0070_office_factsheets.sql`)

1. Spalten an `functionary_roles`: `duties jsonb` (Liste `{title, detail}`),
   `hours_per_season`, `points_label`, `why`, `max_holders`,
   `contact_member_id`, `contact_name`, `factsheet_path`, `updated_at`.
2. Tabelle `functionary_holders` (Sitz-Belegung): `member_id` optional,
   `display_name`, `interim`, `since`. RLS über die Rolle. Backfill aus
   `holder_member_id`.
3. `holder_member_id`/`held_since` werden vom Trigger `sync_office_holder()`
   aus der Belegung gespiegelt; der direkte Schreibweg über PostgREST entfällt
   (Spaltenrechte).
4. `office_open_seats(uuid)` und die Umstellung der fünf SQL-Leser.
5. `save_office(...)`: Amt samt Belegung in einem Schritt, Vorstand.
6. Bucket `factsheets` (privat, PDF, 10 MB) mit Policies nach Vereinsordner.

### App

7. `lib/office.ts`: Typen, `openSeats()`, `isVacant()`, `parseDuties()` /
   `dutiesToText()`, `validateOffice()`, `factsheetPath()`.
8. `hooks/useOffices.ts`: `useOffices()` (mit Belegung), `useSaveOffice()`,
   `useDeleteOffice()`, `useFactsheetUrl()`, `useUploadFactsheet()`,
   `useRemoveFactsheet()`; `useMeeting.ts` reicht die drei alten Namen weiter.
9. `OfficeDetailModal`: Warum, Pflichten, Eckdaten, Belegung, Ansprechperson,
   «Factsheet öffnen». Für den Vorstand «Bearbeiten».
10. `OfficeFormModal`: alle Felder, Belegung mit Namen und optionalem
    Mitglied, PDF wählen/ersetzen/entfernen.
11. `OfficePage`: für alle lesbar (Detail-Blatt), Vorstand über das Plus.
    Zweite Route `marketplace/offices` mit Zurück zum Marktplatz.
12. `MarketplacePage`: Abschnitt «Ämter zu vergeben» für **alle** (BR-183),
    «Passt zu dir» als Zusatz aus `matching_vacancies()`; Zeile «Alle Ämter».
13. Vier Sprachdateien.

### Daten des Vereins

14. `docs/marktplatz/97_Funktionäre/build_factsheets.py`: liest die DOCX,
    erzeugt fehlende PDFs (Word-PDFs von Sandro bleiben) und
    `import_kadetten.sql`.
15. Import gegen den Verein `kadetten-unihockey-schaffhausen`, Upload der
    PDFs nach `factsheets/<club_id>/<Datei>.pdf`.

---

## Tasks

| # | Aufgabe | Status |
|---|---|---|
| 1 | Migration 0070 schreiben und gegen die verknüpfte Datenbank proben | Done |
| 2 | Skript: DOCX → PDF (Headless-Chromium) und → Import-SQL | Done |
| 3 | `lib/office.ts` mit Tests | Done |
| 4 | Hooks, Detail-Blatt, Formular-Blatt | Done |
| 5 | `OfficePage` für alle, Marktplatz-Abschnitt, Route, Admin-Link | Done |
| 6 | Sprachdateien, `i18n:check`, `verify` | Done |
| 7 | Import und Upload für Kadetten | Done |
| 8 | Review, Testplan, Statusabgleich, Commit | Done |

## Entscheide

- **Kein `db push` in dieser Runde:** Lokal liegt `0068_news_body_html.sql`
  einer anderen Sitzung, das Sandro bewusst noch nicht deployt. `db push`
  nähme es mit. 0070 wird deshalb über `db query` eingespielt und in
  `supabase_migrations.schema_migrations` als `0070` eingetragen – dieselbe
  Kennung, die `db push` vergäbe, damit keine Drift entsteht.
- **Punktwert als Beschriftung** (`points_label`), nicht als Zahl: Die
  Factsheets sagen «4 + Lohn» und «1–4». Eine Umrechnung in App-Punkte am
  Saisonende (Konzept §4.3) ist eine eigene Punktequelle und nicht bestellt.
- **`holder_member_id` bleibt** – als Spiegel. Die drei Verteiler-Funktionen
  aus UC-031/UC-032 lesen sie weiter; erreichbar bleibt damit genau eine
  Person je Amt. Ein Verteiler an **alle** verknüpften Inhaber:innen ist eine
  Folgeaufgabe (siehe Offen).
- **Titel der Ämter:** Drei kommen aus Sandros PDFs (Word-Titelzeile), die
  übrigen aus den Dateinamen, mit der Ämtertabelle in
  `Konzept_Gamification_nexus.md` §4.3 als Vorlage. Umbenennen geht im
  Formular.

## Offen

- ~~Verteiler an alle verknüpften Inhaber:innen eines Amtes
  (`holds_committee_role`, `committee_members`)~~ – **erledigt am 2026-09-15**
  in `0095`: Beide lösen über `functionary_holders` auf statt über die
  Spiegel-Spalte. `ask_office_load()` liest weiterhin nur den Spiegel.
- «Seit wann vakant» für `board_response_metrics.vacancy_avg_days` – rechnet
  weiter mit `created_at`.
- Punktegutschrift am Saisonende für Ämter (Konzept §4.3).

## Nachtrag 2026-09-15

- `functionary_roles.is_board` (`0095`): Schalter «Gehört zum Vorstand» im
  Amts-Formular. Die Ämter-Seite zeigt den Vorstand als **eigene Gruppe** –
  er ist das Gremium, an das Sitzungen und Vorschläge gehen, nicht ein Amt
  unter vielen (BR-237). Ohne Vorstandsämter bleibt es bei der einen Liste.

## Nachtrag 2026-09-15 (Abend): Beschreibung als Datei (A7/A8, FR-193/FR-194)

Sandros Auftrag: «Die Ämterbeschreibung soll als `*.md` exportiert und anhand
einer Vorlage auch importiert werden können – damit die Dateien nicht nur in
der App liegen, sondern auch auf Google Drive oder sonst wo in der
Vereinsverwaltung.»

**Keine Migration.** Das Einlesen geht durch `save_office()` und
`set_office_points()` – dieselben Funktionen wie das Formular. Eine Datei ist
damit kein zweiter Schreibweg und kein Weg an `is_club_admin()` vorbei.

| Baustein | Datei | Zweck |
| --- | --- | --- |
| Format, Schreiben, Lesen, Zuordnen | `app/src/lib/officeMarkdown.ts` | reine Logik; 30 Tests in `officeMarkdown.test.ts` |
| Weg der Datei, Dateinamen | `app/src/lib/fileExport.ts` | aus `csv.ts` herausgelöst; `deliverCsv()` ist jetzt eine Hülle darum |
| Ausgeben | `app/src/hooks/useOfficeMarkdown.ts` | ein Amt, alle Ämter, die Vorlage |
| Rückfrage vor dem Schreiben | `app/src/components/OfficeImportModal.tsx` | zeigt je Amt «Neu»/«Ändern» und die geänderten Angaben |
| Einstiege | `OfficeDetailModal` («Verwalten»), `OfficePage` (Abschnitt «Ämterbeschreibungen») | beides nur für den Vorstand |

**Drei Entscheide, die den Rest tragen:**

1. **Markdown statt CSV**, weil eine Ämterbeschreibung ein Text mit
   Abschnitten ist und keine Tabelle. Der Export der Mitgliederliste bleibt
   CSV – die Regel «ein Dateiformat je Sorte Inhalt», nicht «ein Format für
   alles».
2. **Kein YAML-Kopf.** Er stünde in der Drive-Vorschau als Rohtext über dem
   Blatt. Die Eckdaten sind eine Aufzählung; die einzige Maschinenangabe ist
   die Kennung des Amtes in einem HTML-Kommentar (BR-255).
3. **Die Datei leert nie** (BR-256). Ein fehlender oder leerer Abschnitt ist
   keine Aussage. Sonst nähme ein Auszug – nur das überarbeitete
   Pflichtenheft – die Besetzung mit, die gar nicht darin steht.

**Ein Nebeneffekt im Modell:** `OfficeHolderDraft` trägt jetzt `since`. Das
Formular zeigt das Feld nicht, reicht es aber durch; ohne das verlöre ein
Speichern nach dem Einlesen das Datum, das in der Datei steht.

**Offen und bewusst so gelassen:**

- Das Factsheet-PDF geht nicht mit – es liegt ohnehin schon als Datei vor.
- Auf dem Gerät geht die Datei als **Text** ins Teilen-Blatt (wie die CSV
  seit UC-042): `@capacitor/filesystem` ist keine Abhängigkeit dieses
  Projekts. Der Weg «Datei auf Drive» führt über den Browser.
- Kein automatischer Abgleich mit einem Drive-Ordner. Das wäre ein Dienst,
  kein Knopf – und eine Frage an Sandro, keine Lücke.

### Was der Review-Durchgang gefunden hat (drei Befunde, alle behoben)

1. **`save_office()` hat `since` verloren.** `0070` schrieb das Datum am Sitz,
   `0095` baute die Funktion für `is_board` neu und liess es weg. Aufgefallen
   ist es erst hier, weil das Formular nie eines geschickt hat – die
   eingelesene Datei schickt eines («- Anna Beispiel (seit 2024-06-01)»).
   Ohne Migration ginge es still verloren, und das Blatt zeigte die Besetzung
   bei **jedem** Einlesen erneut als Änderung. Behoben in
   `supabase/migrations/0099_office_holder_since.sql` (nur der Rumpf, Signatur
   und Rechte wie in `0095`). **Noch nicht eingespielt** – `db push` löst
   Sandro aus. Bis dahin ist das Datum aus der Datei ohne Wirkung; alles
   andere am Einlesen funktioniert.
2. **Der Punktwert wurde erst vom Server abgewiesen.** `set_office_points()`
   lässt 0 bis 10000 zu und läuft als **zweite** Buchung nach `save_office()`.
   Eine Datei mit «Punkte pro Saison: 99999» hätte das Amt gespeichert und
   danach geworfen – die Reihe meldete «0 übernommen», obwohl ein Amt schon
   geschrieben war. `validateOffice()` prüft die Grenze jetzt selbst, für
   Formular und Datei gleichermassen (`offices.problem.pointsInvalid`).
3. **Die Zwischenablage log.** `navigator.clipboard?.writeText()` läuft in
   einem unsicheren Kontext still durch: `deliverFile()` meldete «kopiert»,
   ohne dass etwas kopiert war. Betraf über `deliverCsv()` auch den
   Mitglieder-Export. Jetzt: keine Zwischenablage, kein «kopiert»
   (`fileExport.test.ts`).

**Testlage:** `officeMarkdown.test.ts` (30), `fileExport.test.ts` (7),
`OfficeImportModal.test.tsx` (7); dazu die erweiterten `office.test.ts`.

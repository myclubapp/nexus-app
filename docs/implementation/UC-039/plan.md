# Implementation Plan: UC-039 — Verbands-Team verknüpfen oder importieren

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand                                                            |
| **Goal**          | Die Teams des Vereins mit den Teams des verbundenen Verbands zusammenführen, damit Spielpläne und Verbandsangaben von selbst am richtigen Team landen |
| **Plan created**  | 2026-09-11                                                          |
| **Status**        | Done                                                                |

## Overview

**BR-176 ist der Satz, an dem sich alles entscheidet: «Der Verband pflegt den
Grundnamen, der Verein den Zusatz.»** Ein Verein nennt sein Team «Herren 1»,
der Verband «Herren NLB» – und beide haben recht. Die Verknüpfung hält beides
auseinander: Der Grundname kommt beim Abgleich mit, der Zusatz überlebt ihn,
und angezeigt wird die Verbindung aus beidem.

Der zweite Satz ist **BR-180**: Ein importiertes Spiel ist ein Termin wie
jeder andere. Zeit, Ort, Gegner und Resultat gehören dem Verband und werden
bei jedem Lauf überschrieben; was der Verein ergänzt – Treffpunkt, Sinn,
Regel –, bleibt. Zu- und Absage, Erinnerung und Check-in gelten unverändert,
weil der Termin in derselben Tabelle steht wie alle anderen.

**Recherche gegen die echte Schnittstelle (2026-09-11):** Swiss Unihockey
liefert die Teamliste (`/api/teams?mode=by_club`) als **Dropdown** –
`entries[].text` und `entries[].set_in_context.team_id` –, nicht als Tabelle.
Der Parser aus UC-035 hätte damit nie ein Team gefunden; er liest jetzt beide
Formen. Der Spielplan (`/api/games?mode=team`) ist eine Tabelle mit fünf
Zellen je Zeile: Datum/Zeit («28.06.2025», «20:00»), Halle/Ort, Heimteam,
Gastteam, Resultat («3:4», «n.V.»); die Spielkennung steht in `link.ids[0]`,
die Liga in `data.title` nach dem Komma. Belegt mit Verein 463820 (12 Teams)
und Team 431869 (29 Spiele).

## Related Use Cases

- UC-035 Verband verbinden — die Vorbedingung; ein gelungener Abruf der Teamliste setzt die Verbindung auf aktiv
- UC-007 Mitglieder und Teams — das Teamformular, in dem der Abschnitt steht
- UC-009 Termin erstellen — importierte Spiele sind Termine dieses Modells
- UC-012 Check-in — gilt für importierte Spiele unverändert (BR-180)

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                             | Status vorher | Ziel        | Notizen                                                                  |
| ------ | --------------------------------- | ------------- | ----------- | ------------------------------------------------------------------------ |
| FR-150 | Verbands-Teams übernehmen         | Open          | Implemented | A1: `FederationImportModal` mit Vorschlägen, `import_federation_teams()` in einer Transaktion |
| FR-151 | Team mit Verbands-Team verknüpfen | Open          | Implemented | `FederationTeamSection` in «Team anlegen» und im Team-Blatt; `link_team()` |
| FR-152 | Namenshoheit am Teamnamen         | Open          | Implemented | `federation_name` + `name_addition` → `name`, im Trigger (BR-176)         |
| FR-153 | Verknüpfung lösen                 | Open          | Implemented | `unlink_team()`: Name bleibt, Termine bleiben                             |
| FR-128 | Meisterschaft                     | Deferred      | Deferred    | Unverändert – Resultate stehen am Termin, Tabellen gibt es nicht (Abgrenzung) |

### Business Rules

| ID     | Regel                                              | Ziel        | Notizen                                                                     |
| ------ | -------------------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| BR-175 | Eine Verknüpfung, ein Team                          | Implemented | Teilindex `teams_federation_team_uidx`; A3 nennt das Team, an dem es hängt   |
| BR-176 | Verband pflegt Grundname, Verein den Zusatz         | Implemented | Trigger `teams_federation_guard()` setzt `name` zusammen; Probe 9–10         |
| BR-177 | Ohne aktive Verbindung keine Auswahl                | Implemented | `link_team()` verlangt `status = 'active'`; die Liste kommt nur über den Schlüssel |
| BR-178 | Der Schlüssel bleibt auf dem Server                 | Implemented | Betriebsart `teams` der Edge Function liest `federation_credentials()`       |
| BR-179 | Verknüpfung berührt Mitglieder und Punkte nicht     | Implemented | `link_team()` schreibt nur `teams`; Probe 5                                   |
| BR-180 | Importierte Termine: Verband überschreibt, Verein ergänzt | Implemented | `upsert_federation_game()` setzt Titel, Zeit, Ort, Resultat – sonst nichts; Probe 14 |
| BR-181 | Ein gelöster Verband löscht nichts                  | Implemented | Probe 25 und 30                                                              |

### Non-Functional Requirements

| ID      | Titel                      | Kategorie | Betrifft? | Notizen                                                         |
| ------- | -------------------------- | --------- | --------- | --------------------------------------------------------------- |
| NFR-011 | Mandantentrennung          | Security  | Ja        | Ein Team eines fremden Vereins lässt sich nicht verknüpfen        |
| NFR-013 | Funktionsrechte            | Security  | Ja        | `report_team_sync()` und `upsert_federation_game()` sind `service_role`-Wege |
| C-032   | Geltungsbereich nach Team  | Design    | Ja        | Importierte Spiele tragen `team_id`; nur das Team sieht sie (Probe 15) |

---

## Current State

Vor diesem Plan:

- `docs/entity_model.md` nannte `federation`, `federation_team_id`,
  `name_addition`, `league`, `federation_synced_at` am TEAM – **keine
  Migration** legte sie an.
- `TeamPage` und `TeamDetailModal` bestanden (S2 der Prüfung vom 2026-09-11)
  und boten Name, Bereich, Mitglieder, Löschen.
- Die Edge Function `sync-federation` holte die Teams und meldete den Zustand
  der Verbindung; sie kannte weder Spiele noch Verknüpfungen.
- Die Termine kannten weder eine fremde Kennung noch ein Resultat.

---

## Missing Pieces

| #   | Was fehlte                                         | Anforderung           | Quelle          |
| --- | -------------------------------------------------- | --------------------- | --------------- |
| 1   | Spalten am Team, Teilindex, Zusammensetzung des Namens | FR-152, BR-175, BR-176 | Automated    |
| 2   | `link_team()`, `unlink_team()`, `import_federation_teams()` | FR-150, FR-151, FR-153 | Cross-reference |
| 3   | Der Riegel: Client schreibt die Verbandsspalten nicht | BR-177, BR-178     | Cross-reference |
| 4   | Spiele als Termine: `external_id`, `result`, `upsert_federation_game()` | BR-180 | Cross-reference |
| 5   | A6: veraltete Verknüpfung, Meldung an den Vorstand  | A6                    | Cross-reference |
| 6   | Betriebsart `teams` und der Spielimport in `sync-federation` | Schritte 4 und 9 | Automated   |
| 7   | Der Abschnitt «Verbands-Team» im Formular, A1 als Blatt | FR-150, FR-151    | Automated       |
| 8   | Resultat in der Agenda-Zeile                        | BR-180                | Cross-reference |

---

## Implementation Guidelines

Verbindlich aus `docs/guidelines.md`:

- **Bauteile:** `FormModal` mit `useSheetProps()`, `ListSection` mit
  `footnote`, `IonSelect` mit `cancelText`/`okText` (Verband und Verbands-
  Team), `IonCheckbox` (A1), `IonAlert` mit genau einer `role: 'cancel'` und
  einer `role: 'destructive'` (Lösen), `InlineError`, `EmptyState` mit Angebot,
  `SkeletonList`. Zwei **neue** Bauteile, weil das Inventar sie nicht hat:
  `FederationTeamSection` (der Abschnitt, in zwei Formularen) und
  `FederationImportModal` (A1) – beide unten in §3 des Inventars eingetragen.
- **Entscheidungen** als reine Funktionen in `src/lib/team.ts`:
  `proposeLinks()`, `toImportItems()`, `composeTeamName()`, `isLinked()`,
  `isFederationStale()`, `validateNameAddition()`.
- **Struktur:** Migration `0060_federation_teams.sql`; Hooks in
  `useTeamAdmin.ts` (schreiben) und `useFederation.ts` (Teamliste).

---

## Implementation Tasks

- [x] 1. Migration `0060_federation_teams.sql`: Spalten, Teilindex,
      Trigger `teams_federation_guard()`, `link_team()`, `unlink_team()`,
      `import_federation_teams()`, `report_team_sync()`,
      `upsert_federation_game()`, Rechte
- [x] 2. Edge Function `sync-federation`: `readTeams()` liest die Dropdown-Form,
      Betriebsart `teams`, Spielimport und A6 im nächtlichen Lauf,
      Ortszeit Europe/Zurich → UTC
- [x] 3. `lib/team.ts`: Vorschläge (A1), Zusammensetzung, Prüfungen
- [x] 4. `hooks/useTeamAdmin.ts`: `useLinkTeam`, `useUnlinkTeam`,
      `useImportFederationTeams`, Zusatz in `useUpdateTeam`;
      `hooks/useFederation.ts`: `useFederationTeams`
- [x] 5. `FederationTeamSection` in `TeamCreate` und `TeamDetail`
- [x] 6. `FederationImportModal` und der zweite FAB-Eintrag auf `TeamPage`
- [x] 7. Resultat und «Vom Verband» in der Agenda-Zeile; «Zu den Teams» auf
      der Verbandsseite führt zur Teamseite
- [x] 8. Vier Sprachen – `npm run i18n:check`
- [x] 9. Verhaltensprüfung gegen die verknüpfte Datenbank
- [x] 10. Durchsicht und Behebung der Befunde
- [x] 11. Vitest, mit einem Test, der **BR-175 in den Vorschlägen festhält**
- [x] 12. Manueller Testplan `docs/test-plans/uc-039-verbands-team.md`
- [x] 13. Statusabgleich in `requirements.md`, UC-Dokument, `use_cases/README.md`
      und `entity_model.md`
- [x] 14. **Edge Function deployen** – am 2026-09-12 deployt, Vault-Einträge
      gesetzt; der nächtliche Lauf holt Spiele, sobald ein Team verknüpft ist.
- [x] 15. **Spiele sofort nach dem Verknüpfen (Schritt 9, A7).** Betriebsart
      `sync` in `sync-federation` (ein Verband, vom Vorstand angestossen,
      derselbe `syncOne` wie in der Nacht); `syncFederationNow()` nach
      `link_team()` und `import_federation_teams()`, Agenda wird neu gelesen;
      Migration `0067`: `link_team()` setzt `federation_synced_at` nicht mehr –
      «Letzter Abgleich» stammt vom Spielabruf, bis dahin «Noch kein Abgleich».

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                       | Impact   | Owner       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| 1   | **Wo der Grundname steht.** Das Entitätsmodell führte `name` als Grundnamen und `name_addition` als Zusatz. Umgesetzt ist `federation_name` als Grundname und `name` als **zusammengesetzte Anzeige** – so bleibt jede Stelle, die `teams.name` liest, unverändert, und BR-176 gilt trotzdem an einer einzigen Stelle (Trigger). Das Modell ist nachgeführt. | Medium   | Architect   |
| 2   | **Wann eine Verbindung «aktiv» ist.** UC-035 setzt `active` nur im nächtlichen Lauf; UC-039 verlangt `active` als Vorbedingung. Entschieden: Ein gelungener Abruf der Teamliste mit dem hinterlegten Schlüssel **ist** ein Abgleich und setzt `active` – sonst könnte niemand am Tag der Verbindung verknüpfen. | Medium   | Dev         |
| 3   | **Die Liga kommt vom Spielplan, nicht von der Teamliste.** Swiss Unihockey nennt in der Teamliste nur «Herren NLB»; die Gruppe («Herren NLB Gr. 1») steht im Titel des Spielplans. Beim Verknüpfen ist `league` deshalb leer und wird beim ersten Lauf nachgetragen (BR-176). | Low      | Dev         |
| 4   | **Gegner.** BR-180 nennt ihn; eine eigene Spalte gibt es nicht. Der Titel des Termins ist «Heimteam – Gastteam», wie in der bestehenden myclub-App. Eine Trennung wäre erst für FR-128 (Tabellen) nötig. | Low      | Stakeholder |
| 5   | **Die Saison des Verbands.** Wie in UC-035: Beginn im Juli, Jahreszahl des Beginns. Nach dem Saisonwechsel nennt der Verband neue Team-Kennungen; die alten werden veraltet vermerkt (A6), und der Vorstand verknüpft neu. Ein automatischer Übergang wäre eine Vermutung über gleichnamige Teams. | Medium   | Stakeholder |
| 6   | Drei der vier Verbände haben keine Schnittstelle (UC-035, Risiko 1). Für sie gibt es weder Teamliste noch Spiele; das Formular sagt das (A4).                                                          | High     | Stakeholder |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-11 | Plan erstellt |
| 2026-09-11 | Recherche gegen `api-v2.swissunihockey.ch`: Teamliste ist ein Dropdown, Spielplan eine Tabelle; der Parser aus UC-035 liest nur die Tabelle und wird korrigiert |
| 2026-09-11 | Migration `0060_federation_teams.sql` eingespielt; Verhaltensprüfung: **32 von 32 Prüfungen bestanden** – darunter: Client kann die Verbandsspalten nicht direkt setzen, A3 nennt das Team, BR-180 lässt die Ergänzung stehen, A6 meldet einmal, A1 ist ganz oder gar nicht, A5 und Trennen löschen nichts |
| 2026-09-11 | Edge Function `sync-federation` mit Betriebsart `teams`, Spielimport, Ortszeit; `lib/team.ts`, Hooks, `FederationTeamSection`, `FederationImportModal`, Agenda-Zeile; vier Sprachen |
| 2026-09-11 | Statusabgleich: FR-150 bis FR-153 auf `Implemented`; UC-039 auf `Implemented`. Offen bleibt das Deployment der Edge Function (Aufgabe 14) |
| 2026-09-12 | **Befund aus dem Gebrauch:** Team verknüpft, Agenda leer. Ursache: Schritt 9 lief nur im nächtlichen Lauf (04:25 UTC), und das Blatt zeigte «Letzter Abgleich: eben», obwohl nichts geholt war. Behoben mit Aufgabe 15; Probe gegen die verknüpfte Datenbank: `link_team()` lässt `federation_synced_at` leer, die 18 Termine bleiben, `report_team_sync()` setzt den Zeitpunkt; Betriebsart `sync` ohne Anmeldung 401. Der Erfolgsweg der Betriebsart `sync` ist mit dem Gerät zu prüfen (TC-012) – eine Anmeldung als Vorstand lässt sich aus der Sitzung nicht erzeugen. |

# Implementation Plan: UC-040 — Termine aus der bisherigen myclub-App übernehmen

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand                                                            |
| **Goal**          | Die aktuellen Anlässe und Helfer-Events samt Schichten aus der bisherigen myclub-App holen und täglich aktuell halten, damit die Umstellung ohne Doppelerfassung gelingt |
| **Plan created**  | 2026-09-12                                                          |
| **Status**        | Done                                                                |

## Overview

**BR-183 ist der Satz, an dem sich alles entscheidet: «Die bisherige App
bleibt bis zum Wechsel die Quelle.»** Während der Übergangszeit schreibt der
Vorstand weiter dort aus; hier erscheint es von selbst. Deshalb überschreibt
jeder Lauf, was die Quelle sagt – und lässt in Ruhe, was hier entsteht:
Zusagen, Schicht-Einträge, Check-ins, Punkte.

Der zweite Satz ist **BR-185**: Das Service-Konto des bisherigen Backends ist
ein Geheimnis des Servers. Es liegt als Secret der Edge Function, nicht in
einer Tabelle, nicht im Repository, nie auf dem Gerät.

**Recherche gegen die echte Quelle (2026-09-12, Verein `su-452800`):**
Firestore hält je Verein `club/<id>/events` (24 Dokumente) und
`club/<id>/helferEvents` (71 Dokumente) mit der Untersammlung `schichten`
(255 Dokumente). Am Termin sind `timeFrom`/`timeTo` ISO-Zeitpunkte (UTC); an
der Schicht sind sie **Uhrzeiten «HH:mm» in Zürcher Ortszeit ohne Datum**.
«Aktuell» heisst in der alten App `date >= jetzt − 2 h` – das waren 2 Anlässe
und 17 Helfer-Events mit 105 Schichten. Eine Schicht trug vertauschte Zeiten
(«21:30–20:30»), elf Helfer-Events hatten keine Beschreibung.

Der Aufbau folgt dem Verband (UC-035/UC-039): Quelle je Verein, Testaufruf
vor dem Speichern, sofortige Übernahme nach dem Verbinden, nächtlicher Lauf
über pg_cron → pg_net → Edge Function, Wiedererkennen über `external_id`.

## Related Use Cases

- UC-035 Verband verbinden — dieselbe Form: Quelle, Testaufruf, Zustand, Trennen
- UC-039 Verbands-Team verknüpfen — Termine aus einer Quelle über `external_id`; Vorlage für `upsert_legacy_event()`
- UC-011 Helfer-Event mit Schichten ausschreiben — das Modell, in das die Schichten kommen
- UC-013 Für eine Schicht eintragen — gilt für übernommene Schichten unverändert

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                                    | Status vorher | Ziel        | Notizen                                                                 |
| ------ | ---------------------------------------- | ------------- | ----------- | ----------------------------------------------------------------------- |
| FR-154 | Termine aus der bisherigen App übernehmen | Open         | Implemented | `LegacyImportPage`, `sync-legacy` (`check`, `sync`), `upsert_legacy_event()` |
| FR-155 | Bisherige App täglich abgleichen         | Open          | Implemented | `sync_legacy_sources()` + Cron `legacy-sync` (04:50), Betriebsart `all` |
| FR-156 | Mitglieder, Teams und Zusagen übernehmen | Open          | Implemented | `0071`: `upsert_legacy_members()`, `upsert_legacy_team()`, `add_legacy_team_members()`, `upsert_legacy_attendance()`; Trainings über `upsert_legacy_event(p_team_id)` |

### Business Rules

| ID     | Regel                                              | Ziel        | Notizen                                                                     |
| ------ | -------------------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| BR-183 | Die bisherige App bleibt die Quelle                 | Implemented | `on conflict … do update` in `upsert_legacy_event()` setzt nur Quellfelder  |
| BR-184 | Der Abgleich löscht nichts                          | Implemented | Kein `delete` an Termine; Schichten nur ohne `attendance`-Zeilen             |
| BR-185 | Service-Konto auf dem Server                        | Implemented | Secret `FIREBASE_SERVICE_ACCOUNT` der Edge Function; Token selbst signiert   |
| BR-186 | Nur, was aktuell ist                                | Implemented | `isCurrent()` mit `CURRENT_GRACE_MS` (2 h) in `mapping.ts`                   |
| BR-187 | Ein Termin, eine Zeile                              | Implemented | `events_external_uidx` (bestehend) + `event_shifts_external_uidx` (neu)     |
| BR-188 | Herkunftssatz als Warum                             | Implemented | `coalesce` in `upsert_legacy_event()`; elf Termine im ersten Lauf            |
| BR-189 | Schichtzeiten in Zürcher Ortszeit                   | Implemented | `shiftTimeToIso()`, `mapShift()` – acht `deno test`                          |
| BR-190 | Übernommene Termine gelten dem Verein               | Implemented | `team_id = null` im Insert                                                   |
| BR-191 | Nur lesen                                           | Implemented | `firestore.ts` kennt nur `GET`                                               |
| BR-192 | Mitglied ohne Konto, Übernahme beim Beitritt        | Implemented | `club_members.legacy_user_id`, `member_contacts.email`; `redeem_invite()` adoptiert per Adresse |
| BR-193 | Antworten überschreiben nur Antworten               | Implemented | `on conflict … where attendance.status in ('registered','excused')`          |
| BR-194 | Spiele vom Verband, Antworten aus der alten App     | Implemented | `upsert_legacy_team()` legt verknüpfte Teams an; Antworten an `swissunihockey:<id>` |
| BR-195 | Trainings: Tag des Termins, Zeit der Serie          | Implemented | `readTrainingStartsAt()`, `mapTraining()` – drei `deno test`                 |

### Non-Functional Requirements

| ID      | Titel                      | Kategorie   | Betrifft? | Notizen                                                         |
| ------- | -------------------------- | ----------- | --------- | --------------------------------------------------------------- |
| NFR-005 | Rollenprüfung serverseitig | Sicherheit  | Ja        | `is_club_admin` in Policy, Funktionen und Edge Function; `all` nur `service_role` |
| NFR-006 | Geheimnisse nie im Client  | Sicherheit  | Ja        | BR-185                                                          |
| C-028   | Kein Schreibzugriff nach aussen | Business | Ja        | BR-191                                                          |
| C-032   | Geltungsbereich nach Team  | Technical   | Ja        | BR-190: ohne Team, also für alle                                |

---

## Current State

- `events.external_id` und der Teilindex `events_external_uidx` bestehen seit `0060` (UC-039).
- `event_shifts` hatte keine Fremdkennung – ein zweiter Lauf hätte Schichten verdoppelt.
- Der Weg pg_cron → pg_net → Edge Function samt Vault-Einträgen `project_url`/`service_role_key` besteht seit `0023`/`0058`.
- Kein Firebase-SDK im Projekt (CLAUDE.md, «Kein Google») – und das soll so bleiben.

## Missing Pieces

| Nr. | Lücke                                                | Anforderung        | Prüfung         |
| --- | ---------------------------------------------------- | ------------------ | --------------- |
| 1   | `event_shifts.external_id` + Teilindex               | BR-187             | Automated       |
| 2   | Tabelle `legacy_sources`, Policy, Funktionen          | FR-154, BR-185     | Cross-reference |
| 3   | `upsert_legacy_event()` mit Schichten                 | BR-183, BR-184, BR-188 | Cross-reference |
| 4   | `sync_legacy_sources()` + Cron                        | FR-155             | Cross-reference |
| 5   | Edge Function `sync-legacy` mit Firestore-REST        | BR-185, BR-191     | Automated       |
| 6   | Abbildung alte App → Termin (`mapping.ts`)            | BR-186, BR-189     | Automated       |
| 7   | Seite «Bisherige myclub-App» in der Verwaltung       | FR-154             | Automated       |
| 8   | Vier Sprachen                                         | C-006              | Automated       |

## Implementation Guidelines

- Schichten kommen als `jsonb`-Liste in **einer** Funktion mit dem Termin – eine Transaktion je Termin, kein halber Zustand.
- Keine Abhängigkeit auf `firebase-admin`: REST + WebCrypto genügen, und nach dem Wechsel bleibt nichts zurück.
- Reine Abbildung in `mapping.ts`, mit `deno test` prüfbar; `index.ts` orchestriert nur.
- Die Ansicht folgt `FederationPage`: Testaufruf vor dem Speichern, Meldung des Dienstes wörtlich, Trennen als `destructive`.

## Implementation Tasks

- [x] 1. Migration `0069_legacy_sources.sql` (ursprünglich 0068; umnummeriert, weil eine parallele Sitzung 0068 belegte): Spalte, Index, Tabelle, Policy, `connect_legacy_source()`, `disconnect_legacy_source()`, `report_legacy_sync()`, `upsert_legacy_event()`, `sync_legacy_sources()`, Rechte, Cron
- [x] 2. Edge Function `sync-legacy`: `firestore.ts` (Token, REST, Flatten), `mapping.ts`, `index.ts` (`check`, `sync`, `all`)
- [x] 3. `deno test` für die Abbildung (8 Tests) – Ortszeit, vertauschte Zeiten, fehlende Dauer, Typen
- [x] 4. `lib/legacy.ts` (Kennung aus Adresse, Prüfung, Ampel, Ergebnis) + Vitest; `lib/functionError.ts` als gemeinsamer Helfer für drei Hooks
- [x] 5. `hooks/useLegacySource.ts`: Quelle, Prüfen, Verbinden + sofort übernehmen, Jetzt übernehmen, Trennen
- [x] 6. `LegacyImportPage`, Route `profile/legacy`, Eintrag in `ClubAdminLinks` nach dem Verband
- [x] 7. Vier Sprachen – `npm run i18n:check` (1451 Schlüssel)
- [x] 8. Deployment: `db push`, Secret `FIREBASE_SERVICE_ACCOUNT`, `functions deploy sync-legacy`
- [x] 9. Verhaltensprüfung gegen die verknüpfte Datenbank (siehe Progress Log)
- [x] 10. Manueller Testplan `docs/test-plans/uc-040-bisherige-app.md`
- [x] 11. Statusabgleich in `requirements.md`, UC-Dokument, `use_cases/README.md`, Entitätsmodell

**Zweiter Schritt (Sandro, 2026-09-12: «belegte Schichten, Zusagen, Trainings und Spiele»):**

- [x] 12. Migration `0071_legacy_people.sql`: `club_members.legacy_user_id`, `teams.legacy_team_id`, Zähler an der Quelle, `upsert_legacy_members()` (Liste), `upsert_legacy_team()`, `add_legacy_team_members()`, `upsert_legacy_event()` mit `p_team_id` und Typ `training`, `upsert_legacy_attendance()` (Liste), `report_legacy_sync()` mit Mitgliedern und Antworten, `redeem_invite()` adoptiert Mitglieder ohne Konto per Adresse
- [x] 13. `mapping.ts`: `mapTraining()`, `mapMember()`, `mapTeam()`, `mapResponse()`, `gameExternalId()`; `index.ts`: Mitglieder → Teams → Termine → Antworten, Firestore-Aufrufe zu zehnt (`mapLimit`)
- [x] 14. Ansicht: Zahlen für Mitglieder, Teams, Trainings, Spiele, Antworten; Hinweis zum Beitritt per Adresse; vier Sprachen
- [x] 15. Eingespielt per `db query` + `migration repair` (0068 einer anderen Sitzung soll nicht mit); Function neu deployt; Lauf → Verbandsabgleich → Lauf

## Open Questions & Risks

| Nr. | Frage / Risiko                                                                                                                                                                                                           | Schwere | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ----------- |
| 1   | **Termintyp.** Alle Anlässe werden `social`. Das Grümpelturnier ist ein Turnier, die GV eine GV – die alte App weiss das nicht. Bis zum Wechsel ist der Typ hier nicht änderbar (BR-183). Nach dem Trennen kann der Vorstand ihn setzen. | Low     | Stakeholder |
| 2   | **Teilnehmende und Schicht-Einträge** kommen nicht mit: Sie hängen an Firebase-Konten. Wer sich in der alten App eingetragen hat, trägt sich hier neu ein – das ist während der Übergangszeit eine Doppelung, aber die einzige ohne Konto-Zuordnung. | Medium  | Stakeholder |
| 3   | **Vergangenes.** Nur aktuelle Termine (BR-186). Wer die Helfer-Historie hier braucht, braucht auch die Punkte dazu – und die sind ein eigenes System. | Low     | Stakeholder |
| 4   | **Ein Service-Konto für alle Vereine.** Das Secret gehört dem bisherigen Backend, nicht einem Verein; die Kennung je Verein steuert, was gelesen wird. Wer eine fremde Kennung einträgt, sieht fremde Termine – wie in der alten App, wo jeder Verein öffentlich ist. Die Kennung ist deshalb eindeutig über alle Vereine (A8). | Medium  | Architect   |
| 6   | **Rollen aus der alten App.** «Vorstand» wird hier admin, auch für Mitglieder ohne Konto; wer mit dieser Adresse beitritt, ist sofort Vorstand. Das ist die Rollenvergabe des Vereins in der alten App – aber es lohnt sich, die Liste der Mitglieder vor der ersten Einladungswelle anzusehen. | Medium  | Stakeholder |
| 7   | **Antworten ohne Ziel.** 67 von 4270 Antworten fanden kein Spiel: Der Verband führt Cup- und Freundschaftsspiele nicht im Spielplan des Teams, die alte App schon. Sie bleiben dort, bis das Spiel hier steht (A9). | Low     | Dev         |
| 8   | **Teams ohne Verbandskennung** («Junioren U13», «Grossfeld Neunkirch gemischt») entstehen als gewöhnliche Teams – ohne Spiele, mit ihren Mitgliedern. Der Vorstand löscht, was er nicht will (UC-007). | Low     | Stakeholder |
| 5   | **Ortsangabe.** `location, streetAndNumber, postalCode city` in einer Zeile; fehlt der Ort, steht die Postleitzahl allein («…, 8200»). Daten der Quelle, nicht des Imports. | Low     | Dev         |

## Progress Log

### 2026-09-12

- Firestore-Struktur belegt (`club/su-452800`): 24 Events, 71 Helfer-Events, 255 Schichten; Feldformen wie oben.
- Migration geschrieben, `db push`: Kollision mit einer parallelen `0068_news_body_html.sql` – Umnummerierung auf 0069, `migration repair` (0068 reverted, 0069 applied), Peers informiert.
- Edge Function deployt; Secret gesetzt.
- **Verhaltensprüfung:** Quelle für `bf4ebf3f…` (`su-452800`) angelegt, Lauf `all` mit `service_role`: `{events: 2, helpers: 17, shifts: 105}`; in der Datenbank 19 Termine (`legacy:%`), 105 Schichten, 0 Entwürfe, 11× Herkunftssatz als Warum, alle mit Ende. Schichtzeiten stimmen mit der Quelle überein (Sommerzeit 18:45 Zürich = 16:45Z; Winterzeit 17:45 = 16:45Z). Zweiter Lauf: **dieselben 19/105** – idempotent. `all` mit `anon`: 403. Quelle `active`, `imported_events = 19`.
- Vitest: 47 Tests in den sechs berührten Dateien grün; `deno test`: 8/8; `i18n:check`: 1451 Schlüssel.

### 2026-09-12, zweiter Schritt

- Firestore belegt: 177 Mitglieder (alle mit `userProfile` und E-Mail), 16 Teams (13 mit Dokument und Namen, 7 mit Verbandskennung), Trainings unter `teams/<id>/trainings` mit `date` als Tag und `timeFrom`/`timeTo` als Serienvorlage, Spiele unter `teams/<id>/games` mit `externalId`, Antworten als `{status, changedAt}`. Die aktuellen Helfer-Schichten tragen derzeit keine Einträge; die Antworten hängen fast alle an Spielen (2112 auf 136 Spiele).
- **Verhaltensprüfung:** Lauf 1: 177 Mitglieder, 13 Teams, 2 Anlässe, 16 Helfer-Events, 184 Trainings, 101 Schichten, 3505 Antworten, 765 ohne Ziel (Spiele der eben verknüpften Teams fehlten noch). Verbandsabgleich: 7 Teams, 124 Spiele. Lauf 2: 4203 Antworten, 67 ohne Ziel. Trainingszeiten stimmen mit der Anzeige der alten App überein (`date`-Tag, `timeFrom`-Uhrzeit, Zürcher Zeit).
- `deno test`: 11/11; Vitest der berührten Dateien grün; `i18n:check`: 1506 Schlüssel.

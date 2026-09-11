# Implementation Plan: UC-035 — Verband verbinden

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand                                                            |
| **Goal**          | Spielpläne, Resultate und Verbandsnews automatisch in die App holen  |
| **Plan created**  | 2026-09-11                                                          |
| **Status**        | Done                                                                |

## Overview

**BR-151 ist der ganze Anmeldevorgang: «Der Schlüssel ist die Verifikation.»**
Es gibt kein Vereinsverzeichnis, keine Kontaktadresse, die jemand prüft, und
keinen Freigabeprozess. Wer die Kennung seines Vereins beim Verband kennt, ist
berechtigt. Das ist keine Nachlässigkeit, sondern die einzige Zuordnung, die
ohne einen zentralen Katalog aller Schweizer Vereine auskommt (C-016).

Der zweite Satz, der diesen Use Case klein hält, ist **BR-152**: Es findet kein
globaler Vorabgleich statt. Abgeglichen wird, was ein verbundener Verein
bestellt hat – und Spiele erst, wenn ein Team verknüpft ist (UC-039).

**Recherche im Altbestand:** `myclubapp/backend` gleicht in
`functions/src/scheduler/syncAssociation.scheduler.ts` vier Verbände ab –
swissunihockey, swissvolley, swisshandball und swissturnverband. Offen
dokumentiert und ohne Schlüssel erreichbar ist heute **Swiss Unihockey**
(`api-v2.swissunihockey.ch`), etwa
`GET /api/teams?mode=by_club&club_id=<id>&season=<jahr>`. Genau dieser Aufruf
ist der Testaufruf aus Schritt 5: Antwortet er mit den Teams des Vereins,
stimmt die Kennung – und der Vorstand sieht sofort, ob er den richtigen Verein
erwischt hat.

## Related Use Cases

- UC-039 Verbands-Team verknüpfen — erst dort entstehen Spiele (BR-152, BR-175)
- UC-038 Website-News — derselbe Aufbau: pg_cron → pg_net → Edge Function
- UC-036 Rechnungen — dieselbe Grenze: Was ausserhalb liegt, bleibt draussen
- UC-034 Vereinsidentität — der Anschluss steht bei den Vereinseinstellungen

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel               | Status vorher | Ziel        | Notizen                                                               |
| ------ | ------------------- | ------------- | ----------- | --------------------------------------------------------------------- |
| FR-120 | Verband verbinden   | Open          | Implemented | Auswahl, Kennung, Schlüssel im Tresor, Zustand, Trennen                |
| FR-121 | API-Key validieren  | Open          | Implemented | Der Testaufruf (`sync-federation`, Betriebsart `check`) ist deployt; Parser gegen die echte Schnittstelle belegt |

### Business Rules

| ID     | Regel                                     | Ziel        | Notizen                                                        |
| ------ | ----------------------------------------- | ----------- | -------------------------------------------------------------- |
| BR-151 | Der Schlüssel ist die Verifikation        | Implemented | Kein Verzeichnis, kein Zuordnungsprozess                        |
| BR-152 | Nur verbundene Vereine werden abgeglichen | Implemented | Der Lauf liest `federation_connections`, nie einen Verbandskatalog |
| BR-153 | Schlüssel liegen im Tresor                | Implemented | In der Tabelle steht nur der **Name** des Vault-Eintrags         |
| BR-154 | Kein Schreibzugriff auf Verbandssysteme   | Implemented | Jeder Aufruf nach aussen ist ein `GET`                          |
| BR-155 | Verbandsausfall stört die App nicht       | Implemented | Ein Fehlschlag kippt nichts; nach drei Tagen ein Hinweis, einmal |

### Non-Functional Requirements

| ID      | Titel                      | Kategorie | Betrifft? | Notizen                                                   |
| ------- | -------------------------- | --------- | --------- | --------------------------------------------------------- |
| NFR-011 | Mandantentrennung          | Security  | Ja        | Die Verbindung eines fremden Vereins ist nicht anlegbar    |
| NFR-013 | Funktionsrechte            | Security  | Ja        | Schlüssel und Zustandsmeldung sind `service_role`-Wege     |
| C-016   | Verbands-Anbindung         | Design    | Ja        | API-Key je Verein, kein globaler Presync                   |

---

## Current State

Vor diesem Plan: **nichts**. `FEDERATION_CONNECTION` stand im Entitätsmodell,
als Tabelle gab es sie nicht; im Katalog standen FR-120 und FR-121 auf `Open`.

---

## Missing Pieces

| #   | Was fehlte                                  | Anforderung    | Quelle          |
| --- | ------------------------------------------- | -------------- | --------------- |
| 1   | Keine Tabelle, keine Verbindung             | FR-120         | Automated       |
| 2   | Kein Ort für den Schlüssel                  | BR-153         | Cross-reference |
| 3   | Kein Testaufruf                             | FR-121, A1     | Cross-reference |
| 4   | Kein Abgleich, kein Zeitplan                | BR-152         | Cross-reference |
| 5   | Kein Zustand, keine Meldung bei Ausfall     | A3, BR-155     | Cross-reference |
| 6   | Kein Weg zum Trennen                        | A4             | Cross-reference |

---

## Implementation Guidelines

Verbindlich aus `docs/guidelines.md`:

- **Bauteile:** `AppPage`, `ListSection` mit `footnote`, `IonSelect` mit
  `cancelText`/`okText`, `IonBadge` für die Ampel, `IonAlert` mit genau einer
  `role: 'cancel'` für das Trennen, `EmptyState`/`ErrorState`, `SkeletonList`.
  **Kein neues Bauteil.**
- **Entscheidungen** als reine Funktionen in `src/lib/federation.ts` (§9).
- **Struktur:** Migration `0058_federation.sql`, Edge Function
  `supabase/functions/sync-federation/`, `hooks/useFederation.ts`,
  `pages/club/FederationPage.tsx`.

---

## Implementation Tasks

- [x] 1. Migration `0058_federation.sql`: `federation_connections`, Policy,
      `connect_federation()`, `disconnect_federation()`,
      `federation_credentials()` (nur Dienst), `report_federation_sync()`,
      `sync_federations()` + Cron
- [x] 2. Edge Function `sync-federation`: Betriebsarten `check` und `all`
- [x] 3. `lib/federation.ts`: Verbände, Eingabeprüfung, Ampel, Veralten
- [x] 4. `hooks/useFederation.ts`
- [x] 5. `FederationPage` samt Route und Einstieg in `ClubAdminLinks`
- [x] 6. Vier Sprachen – `npm run i18n:check`
- [x] 7. Verhaltensprüfung gegen die verknüpfte Datenbank
- [x] 8. Durchsicht und Behebung der Befunde
- [x] 9. Vitest, mit einem Test, der **A2 festhält** (Verband ohne Schlüssel)
- [x] 10. Manueller Testplan `docs/test-plans/uc-035-verband-verbinden.md`
- [x] 11. Statusabgleich in `requirements.md`, UC-Dokument, `use_cases/README.md`
      und `entity_model.md`
- [x] 12. **Edge Function deployen** – am 2026-09-12 auf Sandros Anweisung
      deployt; Vault-Einträge `project_url` und `service_role_key` angelegt.
      Aufruf mit Dienst-Token: `{"synced":0,"results":[]}` – der Weg steht,
      Verbindungen gibt es noch keine.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                      | Impact   | Owner       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| 1   | **Drei der vier Verbände haben keine offen dokumentierte Schnittstelle.** Sie stehen in der Liste, weil das alte Backend sie kennt; ihr Endpunkt ist `null`, der Testaufruf sagt das, und die Verbindung bleibt `pending`. Das ist ehrlicher als eine Prüfung, die immer gelingt. | **High** | Stakeholder |
| 2   | **Kein Verband verlangt heute einen Schlüssel** (A2). Der ganze Tresor-Weg ist trotzdem gebaut: Er ist die Zusage aus BR-153, und sie nachträglich einzuziehen wäre teurer als sie einzulösen.        | Medium   | Dev         |
| 3   | Schritt 7 nennt **Verbandsnews im Feed**. Gebaut ist der Weg für die **Teams**, weil UC-039 sie braucht. Verbandsnews sind eine zweite Quelle neben der Website (UC-038) und gehören dorthin, wo deren Deduplikation schon steht. | Medium   | Stakeholder |
| 4   | A3 sagt «wiederholt». Angenommen: **drei Tage ohne erfolgreichen Abgleich**. Ein einzelner Fehlschlag kippt nichts – eine Verbandsschnittstelle, die einmal schweigt, ist kein kaputter Anschluss.     | Medium   | Stakeholder |
| 5   | Die Saison des Verbands beginnt im **Juli** und trägt die Jahreszahl ihres Beginns – dieselbe Rechnung wie im alten Backend. Sie ist **nicht** `season_label()` des Vereins; die beiden dürfen auseinanderlaufen. | Low      | Dev         |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-11 | Plan erstellt |
| 2026-09-11 | Recherche im Altbestand: vier Verbände, `api-v2.swissunihockey.ch` als einzige offen dokumentierte Schnittstelle |
| 2026-09-11 | Migration `0058_federation.sql` eingespielt; Verhaltensprüfung: **27 von 27 Prüfungen bestanden** – darunter: Der Schlüssel steht nur im Tresor, der Vorstand kommt nicht an ihn heran, ein einzelner Fehlschlag kippt die Verbindung nicht, und gemeldet wird einmal statt täglich |
| 2026-09-11 | Edge Function `sync-federation`, `lib/federation.ts`, `hooks/useFederation.ts`, `FederationPage`, vier Sprachen, 8 Tests |
| 2026-09-12 | Deployt, Vault-Einträge gesetzt, `sync_federations()` läuft (noch ohne Verbindung); FR-121 auf `Implemented` |
| 2026-09-11 | **Befund aus UC-039:** Die Teamliste von Swiss Unihockey ist ein **Dropdown** (`entries[].set_in_context.team_id`), keine Tabelle – `readTeams()` hätte immer «keine Teams» gemeldet. Liest jetzt beide Formen; belegt gegen Verein 463820. «Zu den Teams» führt jetzt zur Teamseite, wo verknüpft wird |

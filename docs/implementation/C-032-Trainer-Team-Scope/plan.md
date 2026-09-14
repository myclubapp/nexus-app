# Umsetzungsplan: Team-Scope für Trainer:innen (C-032, Migration 0073)

**Stand:** 2026-09-13 · **Entscheid:** Sandro · **Migration:** `0073_trainer_team_scope.sql`

## Ausgangslage

`is_club_trainer()` war zwei Dinge zugleich: «darf planen» und «sieht den
ganzen Verein». Die eine Funktion stand an 50 Stellen in 24 Migrationen –
in `event_in_scope()`, `task_in_scope()`, den Lese-Policies für Entwürfe,
Serien, Schichten, QR-Token und News, in allen Schreib-Policies und in
13 RPC-Funktionen. Eine Trainer:in las damit jeden Team-Termin samt
Teilnehmerliste und konnte Termine fremder Teams bearbeiten, absagen und
löschen. Der Agenda-Filter zeigte ihr alle Teams des Vereins.

## Entscheid

1. **Trainer:innen sind wie Mitglieder abgegrenzt.** Sie sehen und planen
   ihre eigenen Teams und das, was dem ganzen Verein gilt. Vereinsweites
   (Termin, Aufgabe, News ohne `team_id`) legt nur der Vorstand an.
2. **«Ihr Team» ist jede Zeile in `team_members`**, unabhängig von der
   Teamrolle – wie `health_signal_in_reach()` seit `0040` rechnet.
3. **Kennzahlen bekommen Trainer:innen nur für ihre Teams** und für Personen,
   die sie begleiten. Vereinsweite Kennzahlen gehören dem Vorstand.

Vereins-Scope haben `sportchef`, `admin` und `superadmin` (`is_club_board()`).

## Traceability

| ID | Anforderung | Status | Umsetzung |
|---|---|---|---|
| C-032 | Geltungsbereich nach Team, lesend und schreibend | Implemented | `event_in_scope()`, `task_in_scope()`, 14 Policies auf `is_club_board()` / `can_plan_for_team()` |
| C-011 | Rollenprüfung serverseitig | Implemented | 19 RPC-Funktionen prüfen `can_plan_for_team()` / `can_follow_member()` / `is_club_board()` |
| BR-033 | Nur Trainer:innen und Vorstand erfassen | Implemented | Trainer:innen nur für ihr Team; Vereinstermine der Vorstand |
| BR-096 | Reichweite der Fürsorge-Hinweise | Unverändert | `health_signal_in_reach()` war schon teambegrenzt; Sportchef:in behält den Bereichs-Scope aus `0059` |
| FR-063 | Routing je Signaltyp | Implemented | `health_alert_routing_read` nur noch für den Vorstand |
| FR-070 | Verbindungs-Quote | Implemented | `connection_ratio()` nur noch für den Vorstand |
| FR-106 | Team-Wert der Stimmung | Implemented | `team_mood()` prüft `can_plan_for_team()` |

## Die drei Reichweiten-Funktionen

| Funktion | Bedeutung | Ersetzt |
|---|---|---|
| `is_club_board(club)` | Vereins-Scope: sportchef, admin, superadmin | `is_club_trainer()` in Lese-Scopes, `is_club_admin()` in `team_health`, `value_dimensions`, `emergency_contact` |
| `can_plan_for_team(club, team)` | Vorstand, oder Trainer:in dieses Teams; `team` null nur Vorstand | `is_club_trainer()` in Schreib-Policies und RPCs |
| `can_follow_member(club, member)` | Vorstand, oder Trainer:in mit gemeinsamem Team | dreifach kopierter Join in `value_dimensions`, `emergency_contact`, `training_streak` |

`is_club_trainer()` bleibt als «darf überhaupt planen» bestehen.

## Betroffene Stellen

**Datenbank (0073):** `event_in_scope`, `task_in_scope`; Policies
`events_read`, `events_trainer_write`, `event_series_read`,
`event_series_write`, `shifts_read`, `shifts_trainer_write`,
`event_qr_tokens_read`, `tasks_read`, `tasks_trainer_insert/update/delete`,
`news_read`, `news_trainer_write`, `health_alert_routing_read`; Funktionen
`cancel_event`, `announce_event`, `publish_event`, `mark_attendance`,
`event_roster`, `remind_undecided`, `create_task`, `publish_task`,
`confirm_task`, `reject_task`, `task_roster`, `publish_news`, `retract_news`,
`value_dimensions`, `connection_ratio`, `team_mood`, `team_health`,
`emergency_contact`, `training_streak`.

**Unverändert und begründet:** `health_signal_in_reach()` (Bereichs-Scope der
Sportchef:in aus `0059`), `health_definitions()` (Schwellwerte des Vereins,
keine Personendaten), Sprachmemos und Sitzungseingaben (rollengenau seit
`0046`/`0049`).

**App:** `useClub()` mit neuem `isBoard`, `isTrainer` schliesst jetzt auch
`sportchef` ein (war eine Unstimmigkeit zu SQL). Neu `lib/scope.ts`
(`canPlanFor`, `plannableTeams`, `defaultTeamId`) und
`hooks/usePlanningScope.ts`. Umgestellt: `EventFormModal`, `TaskFormModal`,
`NewsFormModal` (Team-Auswahl, kein «Ganzer Verein» für Trainer:innen),
`AgendaPage` (Team-Filter nur Vorstand; ändern, erinnern, QR je Termin),
`DashboardPage`, `MarketplacePage` (zu bestätigen je Aufgabe), `MoodPage`,
`usePulse` und `useHealthRouting` (nur Vorstand).

**i18n:** `common.noPlannableTeam`, `eventForm.scopeHintTeam`,
`taskForm.scopeHintTeam`, `newsForm.scopeHintTeam` in vier Sprachen.

## Schritte

- [x] 1. Inventur aller `is_club_trainer()`-Stellen (50 in 24 Migrationen)
- [x] 2. Migration `0073`: drei Funktionen, zwei Scopes, 14 Policies, 19 RPCs
- [x] 3. App: `isBoard`, `lib/scope.ts`, `usePlanningScope()`, Formulare, Seiten
- [x] 4. i18n in vier Sprachen, `npm run i18n:check`
- [x] 5. Vitest `lib/scope.test.ts`
- [x] 7. Verhaltensprüfung gegen die laufende Datenbank: Rolle der
      Probeperson (1 eigenes Team von 13) im zurückgerollten `do`-Block auf
      trainer, sportchef, member und admin gestellt – 26 Befunde, 0 FAIL.
      Grundgesamtheit: 47 eigene, 20 Vereins-, 261 fremde Team-Termine.
      **Nebenwirkung:** Die Migration lief im selben `db query`-Aufruf vor dem
      `do`-Block und blieb angewendet – `db query` hält kein `begin/rollback`
      ein. Funktionen und Policies aus `0073` stehen damit bereits remote,
      aber ohne Eintrag in `schema_migrations`.
- [x] 6. `supabase db push`: in dieser Sitzung blockiert, aber der Push einer
      parallelen Sitzung (mit `0074`) hat `0073` mitgenommen –
      `migration list --linked` zeigt `0073` lokal und remote. Die Migration
      ist idempotent (`create or replace`, `drop policy if exists`), der
      zweite Lauf über den Stand der Probe war folgenlos.
- [x] 8. Testplan `docs/test-plans/c-032-trainer-team-scope.md`
- [x] 9. Doku: `CLAUDE.md`, `requirements.md` (C-032), `entity_model.md`,
      `guidelines.md`, `nfr-nachweise.md`

## Offene Punkte

- Der Agenda-Filter nach Team bleibt dem Vorstand vorbehalten. Ein Mitglied
  oder eine Trainer:in in mehreren Teams hätte davon ebenfalls etwas – ein
  eigener Entscheid.
- Eine Trainer:in ohne Team kann nichts ausschreiben; das Formular sagt das.
  Ob der Vorstand beim Anlegen einer Trainer:in-Mitgliedschaft ein Team
  verlangen soll, ist offen.

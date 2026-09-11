# Nachweise zu nicht-funktionalen Anforderungen und Rahmenbedingungen

Stand: 2026-09-12. Der Katalog (`requirements.md`) führt NFRs und
Rahmenbedingungen mit einem Status, der lange auf `Open` stand, obwohl Code und
Proben sie längst belegten. Diese Seite nennt je Anforderung den Beleg – oder
sagt, warum der Status offen bleibt. **Ein Status wechselt nur mit Beleg.**

## Belegt (`Implemented`)

| ID      | Beleg                                                                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-009 | `notify()` (0010, 0045) schreibt jede Meldung in `notifications`, unabhängig von Push; `InboxPage` zeigt sie. Push ist Zusatz, nie Voraussetzung. |
| NFR-010 | `lib/checkInQueue.ts`: `CHECK_IN_TTL_MS` = 24 h, Nachsenden über `check_in()` mit serverseitiger Prüfung; Tests in `checkInQueue.test.ts`.           |
| NFR-011 | RLS auf jeder Vereinstabelle (0006 ff.); jede UC-Probe enthält «fremder Verein: abgewiesen» (zuletzt 0060-Probe 4, 0062-Probe 6).                    |
| NFR-012 | `point_transactions` hat keine `insert`/`update`/`delete`-Policy (0002, 0006); TESTING.md §7 nennt die Prüfung.                                       |
| NFR-013 | Vorlage `0007_function_grants.sql`; jede Migration seither entzieht `public, anon, authenticated`; Proben rufen als Mitglied und werden abgewiesen. |
| NFR-014 | Supabase liefert ausschliesslich über HTTPS; `VITE_SUPABASE_URL` ist eine https-Adresse (`lib/env.ts`).                                              |
| NFR-015 | Verbandsschlüssel liegen im Vault (0058, Probe 2); `VITE_VAPID_PUBLIC_KEY` ist der öffentliche Teil; kein Geheimnis im Repo (`.env.example`).       |
| NFR-017 | Eindeutiger Index über `(member_id, rule_code, source_id)` (0002); `award_points()` mit `on conflict do nothing`; 0061-Probe 9.                      |
| NFR-018 | `health_signal_in_reach()` (0040, 0059) mit Team, Bereich und Verein; Probe zu UC-023 und 0059.                                                      |
| NFR-019 | `voice_notes_anonymous_check` (0046): bei `kind = 'anonymous'` ist `author_member_id` null, `created_week` trägt die Kalenderwoche.                  |
| NFR-020 | `MIN_GROUP_SIZE = 5` in `lib/contextCheckin.ts`; `team_health()` (0056) gibt unter der Mindestgruppe keine Zeile.                                    |
| NFR-021 | Gelöste Signale werden gelöscht (0040 Z. 494), abgelaufene per Cron (Z. 528); Opt-out löscht bestehende (0041).                                      |
| NFR-022 | Es gibt keine Tabelle für Nutzung, Lesebestätigung oder Standort – prüfbar über `\dt` gegen das Schema; `notifications.read_at` ist die eigene Inbox. |
| NFR-028 | `npm run i18n:check` läuft in `npm run verify`; Stand 1386 Schlüssel × 4.                                                                            |
| NFR-030 | `voice_quota_left()` (0046) prüft serverseitig; `submit_voice_note()` weist bei 0 ab.                                                                |
| NFR-032 | Ein Ionic-React-Projekt für iOS, Android und PWA; keine plattformspezifischen Feature-Zweige (`ios/`, `android/` sind Capacitor-Hüllen).             |
| NFR-033 | `tsc -b` in `npm run verify`; Stand: ohne Fehler.                                                                                                     |
| NFR-034 | Jede Punktequelle ist eine Datenbankfunktion (`award_points`, `check_in`, `confirm_task`, `confirm_shift`, `redeem_invite`, `award_loyalty`, …).      |
| NFR-035 | `season.test.ts` prüft `seasonLabel()`; TESTING.md §2 nennt die Parität mit `season_label()`.                                                        |
| NFR-036 | `database.generated.ts` (generiert) und `database.types.ts` (Hand) sind getrennt; `types:generate` überschreibt nur die erste.                       |
| NFR-037 | `emptyStateAction.test.ts` scannt `pages/`: jeder `EmptyState` trägt ein `action`; Zahl der Ansichten ohne Angebot: 0.                              |
| NFR-038 | `seed_sample_content()` aus `create_club()` (0053); `drop_sample_content()` ist eine Aktion; UC-037-Probe 36 von 36.                                 |
| C-001   | `package.json`: `@ionic/react` 9, `@capacitor/core` 8, `react-router-dom` 6.                                                                          |
| C-002   | Alles in `supabase/`: Postgres, Edge Functions (Deno), pg_cron, pg_net; kein weiterer Server.                                                        |
| C-003   | Keine Firebase-, Google- oder Apple-Abhängigkeit in `package.json`; QR über `html5-qrcode`, Push über Web Push VAPID.                                |
| C-005   | `CheckInModal` verwendet `html5-qrcode`.                                                                                                              |
| C-007   | Vier Sprachdateien seit dem ersten Commit; `i18n:check`.                                                                                             |
| C-008   | Bezeichner englisch, Texte über `react-i18next`, Kommentare deutsch – von der Code-Review-Dimension A geprüft.                                        |
| C-009   | `events.type` mit `useClub().eventLabel()`; Regelvorlagen je `club_kind` (0059).                                                                     |
| C-010   | wie NFR-012.                                                                                                                                          |
| C-011   | `is_club_admin()`/`is_club_trainer()` in Policies und Funktionen; jede Probe prüft die Abweisung serverseitig.                                        |
| C-012   | `ch.myclub.nexus` in `capacitor.config.ts`, `Info.plist`, `AndroidManifest.xml`; die Auth-Redirects sind Projekteinstellung (Betrieb).               |
| C-013   | `lib/theme.ts` setzt Farben zur Laufzeit aus `clubs.settings.theme`; keine Build-Konfiguration je Verein.                                            |
| C-014   | In der App gibt es keine Rechnungslogik – nur den Spiegel (0054).                                                                                     |
| C-015   | `invoice_refs` (0054): Betrag, Fälligkeit, Status, Link.                                                                                              |
| C-016   | `federation_connections` (0058) je Verein; kein Presync, kein Verzeichnis.                                                                            |
| C-017   | Ein Ledger `point_transactions`; Schichten buchen über `confirm_shift()` (0025) in denselben.                                                        |
| C-024   | `LICENSE` ist EUPL v1.2; `package.json` trägt `EUPL-1.2`.                                                                                             |
| C-026   | Kein Export individueller Health-Daten, keine Sortierung nach Gesundheit, keine Volltextsuche über fremde Memos – `HealthPage` und Policies (0040, 0041). |
| C-028   | Kein Chat, kein öffentlicher Bereich, keine Buchhaltung; jeder Verbandsaufruf ist ein `GET` (BR-154).                                                 |
| C-031   | `is_sample` sperrt Zustellung, Signal, Punkte (0015, 0033, 0053); UC-037-Probe.                                                                       |
| C-032   | `task_in_scope()` (0034), `event_in_scope()` (0057); Probe 0057 und 0060.                                                                             |
| C-025   | Das verknüpfte Projekt `nexus-backend` läuft in `eu-central-2` (Zürich), Managed Supabase; Self-Hosting bleibt möglich (NFR-031).                    |

## Teilweise (`Partial`)

| ID      | Was steht, was fehlt                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| C-004   | Geräte-Anmeldung für Web Push (`usePushRegistration`) und Inbox stehen; der Versand über ntfy, APNs und VAPID fehlt (FR-079). |

## Offen – und warum

| ID              | Grund                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| NFR-001 … 007   | Leistungs- und Skalierungsziele sind nicht gemessen; es gibt weder Lasttest noch Messung auf einem Gerät.       |
| NFR-008         | Betriebszusage von Supabase; nichts zu bauen, aber nichts belegt.                                                |
| NFR-023         | Region Zürich ist belegt (C-025); der Audio-Teil bleibt offen, weil es noch keine Sprachmemos gibt (FR-085).    |
| NFR-024         | Gründungsdauer nicht gemessen.                                                                                  |
| NFR-025         | Der Deckel offener Hinweise je Team ist nicht beziffert (offener Punkt 3).                                       |
| NFR-026         | Ein Check-in je Tag (`asked_on`) steht; die 10 Sekunden sind nicht gemessen.                                     |
| NFR-027         | WCAG 2.1 AA ist nicht geprüft.                                                                                  |
| NFR-029         | Sprachmemos gibt es nicht (FR-085).                                                                             |
| NFR-031         | Exit-Fähigkeit ist plausibel (nur Supabase-Bausteine), aber kein Umzug wurde geprobt.                           |
| C-006           | Keine Karten.                                                                                                   |
| C-018           | Keine Transkription.                                                                                            |
| C-019 … C-022   | Rechtliche Nachweise (DSG, DSFA, KI-Register, Einwilligung unter 16) sind Dokumente, die es noch nicht gibt.     |
| C-027           | Der Entlastungs-Test ist ein Prozess ohne Vorlage im Repo.                                                       |
| C-029           | Bleibt `In Progress`, solange M4 läuft.                                                                          |
| C-030           | Kalender-Publishing ist zurückgestellt (FR-133).                                                                 |

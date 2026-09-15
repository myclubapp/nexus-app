# Implementation Plan: Konzeptabgleich — Lücken zwischen Konzept und Umsetzung

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand, Mitglied                                                  |
| **Goal**          | Was die drei Konzeptdokumente vorsehen und die Umsetzung noch nicht hat, Schritt für Schritt schliessen – ohne Produktentscheide vorwegzunehmen |
| **Plan created**  | 2026-09-11                                                          |
| **Status**        | Done (offen: Plattform-Parität bis zum Gerätetest)                  |

## Overview

Nach der Vision-Prüfung und UC-039 wurden `Konzept_Gamification_nexus.md`,
`Technische_Architektur_nexus.md` und `MVP_Scope_nexus.md` gegen den
Katalog, die Migrationen und den App-Code abgeglichen. Die Befunde stehen im
Gesprächsprotokoll vom 2026-09-11; dieser Plan führt die Punkte, die **ohne
Produktentscheid** umsetzbar sind, und hält fest, was einen Entscheid braucht.

Jeder Schritt folgt derselben Tiefe wie ein Use Case: Migration, Probe gegen
die verknüpfte Datenbank, App, vier Sprachen, Tests, Doku, ein Commit.

## Related Use Cases

- UC-021 Punkte von Hand buchen — Regeln, die hier automatisch werden, blieben bisher Handbuchungen
- UC-022 Rangliste — die Team-Sicht ist ihre dritte Perspektive
- UC-008 Profil und Datenschutz — Adresse und Notfallkontakt hängen an `member_contacts`
- UC-020 Dashboard — der Saisonverlauf ist der fehlende Abschnitt aus Konzept §7.1

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                     | Status vorher | Ziel        | Notizen                                                                 |
| ------ | ------------------------- | ------------- | ----------- | ----------------------------------------------------------------------- |
| FR-018 | Eigenes Profil pflegen    | Implemented   | Implemented | Kontaktdaten um Adresse und Notfallkontakt erweitert (Konzept §3.1)     |
| FR-036 | Sieben Säulen             | Implemented   | Implemented | Säule 5 bucht Vereinstreue jetzt automatisch (Konzept §4.1)              |
| FR-047 | Vereins-Leaderboard       | Implemented   | Implemented | Team-gegen-Team-Ranking (Konzept §7.3)                                   |
| FR-043 | Dashboard                 | Implemented   | Implemented | Saisonverlauf als Balken je Monat (Konzept §7.1)                         |
| C-024  | Lizenz                    | Open          | Implemented | `LICENSE` ist EUPL v1.2, `package.json` trägt `EUPL-1.2`                  |

### Business Rules

| ID     | Regel                                     | Ziel        | Notizen                                                        |
| ------ | ----------------------------------------- | ----------- | -------------------------------------------------------------- |
| BR-091 | Opt-out gilt überall                      | Implemented | Auch im Team-Ranking zählt nur, wer sichtbar sein will; Teams unter zwei Sichtbaren fehlen |
| BR-030 | Verborgenes wird nicht ausgeliefert       | Implemented | Adresse nur Person und Vorstand; Notfallkontakt zusätzlich Trainer:innen des Teams, über eine eigene Funktion |
| —      | Punkte schreibt nur der Server (CLAUDE.md) | Implemented | `award_loyalty()` bucht über `award_points()`, Dedup über Mitglied und Jahr |

### Non-Functional Requirements

| ID      | Titel                      | Kategorie | Betrifft? | Notizen                                                   |
| ------- | -------------------------- | --------- | --------- | --------------------------------------------------------- |
| NFR-013 | Funktionsrechte            | Security  | Ja        | `award_loyalty()` ist kein Client-Weg; Probe 12            |
| NFR-017 | Dedup des Ledgers          | Security  | Ja        | Zweiter Lauf bucht nichts doppelt; Probe 9                 |
| NFR-011 | Mandantentrennung          | Security  | Ja        | Team-Ranking eines fremden Vereins abgewiesen; Probe 6     |

---

## Current State

Vor diesem Plan (Befund vom 2026-09-11):

- `loyalty_year` stand seit `0002` als Regel in jedem Verein, **nichts buchte sie**.
- Die Rangliste kannte Verein und eigenes Team, kein Team gegen Team.
- Das Dashboard zeigte Saison- und Gesamtpunkte, keinen Verlauf.
- `member_contacts` kannte E-Mail und Telefon; Adresse und Notfallkontakt (Konzept §3.1, Säule 6) fehlten.
- `LICENSE` war BSD-3-Clause, C-024 verlangt EUPL v1.2.

---

## Missing Pieces

| #   | Was fehlte                                      | Anforderung           | Quelle          |
| --- | ----------------------------------------------- | --------------------- | --------------- |
| 1   | Automatische Buchung der Vereinstreue           | Konzept §4.1 Säule 5  | Cross-reference |
| 2   | Saisonverlauf auf dem Dashboard                 | Konzept §7.1          | Cross-reference |
| 3   | Team-vs-Team-Ranking                            | Konzept §7.3          | Cross-reference |
| 4   | Adresse und Notfallkontakt                      | Konzept §3.1, §4.1    | Cross-reference |
| 5   | Lizenzdatei                                     | C-024                 | Automated       |
| 6   | Nachweise zu NFRs, deren Status nie nachgeführt wurde | NFR-009 … NFR-038 | Automated     |

---

## Implementation Guidelines

Verbindlich aus `docs/guidelines.md`:

- **Bauteile:** `ListSection`, `IonItem`, `IonSegment` für die dritte Sicht der
  Rangliste, `IonTextarea` für die Adresse, `EmptyState` mit Angebot. **Ein
  neues Bauteil:** `MonthBars` – aus demselben Grund wie `TrendChart` (keine
  Chart-Bibliothek für eine Handvoll Rechtecke), im Inventar eingetragen.
- **Entscheidungen** als reine Funktionen: `pointsPerMonth()`, `monthBars()` in
  `lib/points.ts`.
- **Struktur:** Migrationen `0061_loyalty.sql`, `0062_team_ranking.sql`,
  `0063_member_contacts.sql`.

---

## Implementation Tasks

- [x] 1. **Vereinstreue automatisch** (Säule 5): `award_loyalty()` täglich per
      Cron, `loyalty_year` je Jubiläum, neue Regel `loyalty_milestone` bei 5, 10,
      20 Jahren (`meta.years`), Meldung an das Mitglied; kein Rückwirken über
      Jahre (Fenster sieben Tage). Probe: 13 von 13.
- [x] 2. **Saisonverlauf** (Konzept §7.1): `pointsPerMonth()`, `monthBars()`,
      Bauteil `MonthBars`, Abschnitt auf dem Dashboard, sobald Punkte da sind.
- [x] 3. **Team gegen Team** (Konzept §7.3): `team_ranking_rows()` mit
      Durchschnitt je sichtbarem Mitglied, dritte Sicht «Teams» in der
      Rangliste. Probe: 6 von 6.
- [x] 4. **Adresse und Notfallkontakt** (Konzept §3.1): Spalten an
      `member_contacts`, `update_my_profile()` mit drei Feldern («leer heisst
      löschen»), `emergency_contact()` für Person, Vorstand und Trainer:innen
      eines gemeinsamen Teams; Profil-Blatt und Mitglied-Detail. Probe: 11 von 11.
- [x] 5. **Lizenz**: EUPL v1.2 in `LICENSE` und `package.json`.
- [x] 6. **Nachweise zu NFRs und Rahmenbedingungen** in `requirements.md`
      nachführen, wo Proben oder Code sie belegen – Belege in `docs/nfr-nachweise.md`.
- [x] 7. **Streak-Bonus und Pünktlichkeit** (Säule 1): `0064` – `training_streak()`,
      `award_streaks()` montags per Cron (4/8-Wochen-Bonus, Warnung bei drei),
      `punctual` in `check_in()` (aus, «optional aktivierbar»); Serie auf dem
      Dashboard. Probe: 15 von 15. Nachtrag `0066`: Serie nur für sich selbst
      oder als Trainer:in/Vorstand lesbar.
- [x] 8. **Ränge ohne Punktzahl** (Konzept §7.2): `settings.leaderboard.hidePoints`,
      Abschnitt «Rangliste» in den Vereinseinstellungen (mit dem bisher
      unerreichbaren `topOnly`), `hidesPoints()` in Rangliste und Team-Sicht.
- [x] 9. **Saisonarchiv** (Konzept §7.3): `0065` – `p_season` in beiden
      Ranglisten-Funktionen, `club_seasons()`; Saisonwahl in der Rangliste,
      sobald es mehr als eine Saison gibt.
- [x] 10. **V5 Symmetrie**: `0066` – `board_response_metrics()` (Antwortzeit auf
      Inputs, offene und überfällige Inputs, offene Hinweise und ältester,
      Vakanzen und Dauer); Abschnitt «Wie schnell wir antworten» im Cockpit.
      Probe: 8 von 8.
- [x] N-4. i18n-Vollständigkeit — je Schritt geprüft (`npm run i18n:check`)
- [x] N-3. Mock- und Vertragsparität — entfällt: kein Mock-Server; die Verträge sind die Migrationen
- [ ] N-2. Plattform-Parität — wie in allen Plänen offen bis zum Gerätetest
- [x] N-1. Verdrahtung und Fehlerrückmeldung — je Schritt geprüft
- [x] N. Statusabgleich — Aufgabe 6

> Ein Häkchen je abgeschlossenem Schritt; der Status wechselt auf `Done`, wenn
> die Liste steht oder die verbleibenden Punkte einen Entscheid brauchen.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                       | Impact   | Owner       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| 1   | **Werbeprämie** (Säule 5): Das Konzept sagt «nach 3 Monaten Mitgliedschaft bestätigt», gebucht wird seit UC-003 beim Beitritt. Nicht geändert – das ist ein Entscheid, kein Versäumnis.               | Medium   | Stakeholder |
| 2   | **Notfallkontakt für Trainer:innen** ist serverseitig erreichbar (`emergency_contact()`), aber noch in keiner Trainer-Ansicht eingebaut – die Teamseite gehört dem Vorstand. Ein Ort dafür wäre die Teilnehmerliste im Termin-Blatt. | Medium   | Architect   |
| 3   | **Treue-Werte**: Das Konzept staffelt 20/50/100/200 nach Jahren. Umgesetzt: `loyalty_year` (bestehender Wert 100) je Jahr plus `loyalty_milestone` (200) bei 5/10/20. Beides pro Verein änderbar.       | Low      | Stakeholder |
| 4   | **Team-Ranking und Mindestgruppe**: Teams unter zwei sichtbaren Mitgliedern fehlen, damit ein Opt-out nicht über die Teamzeile lesbar wird. Zwei ist die kleinste Zahl, bei der ein Durchschnitt keine Person ist. | Low      | Dev         |
| 6   | **Was eine Trainingsserie ist**, sagt das Konzept nicht. Angenommen: Wochen mit mindestens einem Training, ohne Unterbruch; eine Woche ohne Training der eigenen Teams zählt weder dafür noch dagegen. Bonus bei jedem Vielfachen von vier, der grosse bei jedem Vielfachen von acht. Gepinnt in der Probe zu `0064`. | Medium   | Stakeholder |
| 7   | **Vakanz-Dauer** ist eine Näherung über `functionary_roles.created_at` – eine Historie, seit wann ein Amt unbesetzt ist, gibt es nicht (K4 ist auf Nachfolge-Vorlauf beschränkt). | Low      | Architect   |
| 5   | **Sprachmemo, Push-Versand, Billing-Dienst, Kartendarstellung, Dokumentenablage, Passkeys, Jugendschutz-Einwilligung, Abo-Gate** bleiben offen – jedes braucht einen Entscheid oder einen Dienst, den es nicht gibt. | High     | Stakeholder |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-11 | Plan erstellt nach dem Abgleich der drei Konzeptdokumente |
| 2026-09-11 | `0061_loyalty.sql`: Probe 13 von 13 – Jubiläum in den letzten sieben Tagen wird gebucht, älteres nicht, Ausgetretene nicht, zweiter Lauf bucht nichts doppelt, Regel aus heisst nichts, kein Client-Weg |
| 2026-09-11 | `0062_team_ranking.sql`: Probe 6 von 6 – Opt-out zählt nicht, Ein-Personen-Team fehlt, Zeitraum und Säule greifen, fremder Verein abgewiesen |
| 2026-09-11 | `0063_member_contacts.sql`: Probe 11 von 11 – Trainer:in des Teams sieht den Notfallkontakt und nicht die Adresse, Trainerin eines anderen Teams nichts, `club_directory` führt keine der neuen Spalten |
| 2026-09-12 | `0064_streaks.sql`: Probe 15 von 15 – Ferienwoche zählt nicht dagegen, verpasste Woche reisst, 8 vor 4, Warnung bei drei, Pünktlichkeit nur mit aktiver Regel und nur vor Beginn. **Befund:** Die erste Fassung hatte `check_in()` aus 0026 statt 0029 kopiert (QR-Token-Tabelle) – die Probe fand es, Migration neu aufgebaut und mit `migration repair` erneut eingespielt |
| 2026-09-12 | `0065_leaderboard_seasons.sql` und `0066_board_metrics.sql` (Probe 8 von 8); Rangliste mit Saisonwahl und Rängen ohne Zahl, Cockpit mit Reaktionszeiten, Dashboard mit Trainingsserie |
| 2026-09-12 | `docs/nfr-nachweise.md`: 41 NFRs und Rahmenbedingungen auf `Implemented`, C-004 auf `Partial`, der Rest mit Begründung offen |
| 2026-09-11 | App: `MonthBars` und Saisonverlauf, Sicht «Teams» in der Rangliste, Adresse und Notfallkontakt im Profil-Blatt, Kontaktkarte im Mitglied-Detail; Lizenz EUPL v1.2 |

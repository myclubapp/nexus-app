# Implementation Plan: UC-042 — Saisonziel für den Beitrag setzen und verfolgen

|                   |                    |
| ----------------- | ------------------ |
| **Primary Actor** | Vorstand           |
| **Goal**          | Ein Saisonziel in Punkten festlegen, an dem der Verein sieht, wer seinen Beitrag geleistet hat – und das dem Mitglied als Fortschritt mit passenden Angeboten erscheint, nicht als Forderung |
| **Plan created**  | 2026-09-14         |
| **Status**        | Done               |

## Overview

Die alte myclub-App verlangte vier Helferpunkte je Saison und führte dafür ein
zweites Konto neben dem Punktesystem. Der MVP-Schnitt hat dieses Soll
gestrichen (`MVP_Scope_nexus.md` §2.1, Zeile 106) und die Rangliste nach
Säule 3 an seine Stelle gesetzt. Dieser Use Case baut die dort genannte
Ausbaustufe: ein **Saisonziel auf dem bestehenden Ledger**, als zuschaltbares
Modul, in derselben Einheit wie alle Punkte.

Der Vorstand setzt eine Zahl, sieht Ist gegen Soll je Mitglied mit Ampel und
exportiert die Liste für den Kassier. Das Mitglied sieht nur seinen eigenen
Fortschritt und darunter die passenden offenen Beiträge. Ein zweites
Punktekonto entsteht nicht.

## Related Use Cases

- **UC-011 / UC-012 / UC-013** – Helfer-Event, Schicht übernehmen, Schicht bestätigen: die Quelle der Buchungen in Säule 3.
- **UC-017 / UC-018 / UC-019** – Aufgabe ausschreiben, übernehmen, bestätigen: die Quelle in Säule 7.
- **UC-020** – Punktestand einsehen: dort hängt die Fortschrittskarte.
- **UC-022** – Leaderboard einsehen: der heutige Ersatz für das Soll, bleibt unverändert.
- **UC-024** – Wertdimensionen einsehen: `responsibility_concentration()` zählt dieselben Säulen 3 und 7 (BR-100).
- **UC-033** – Beitrags-Profil erfassen: liefert die Passung der Vorschläge.
- **UC-040** – Bisherige App übernehmen: Quelle der falsch skalierten Schichtwerte (BR-204).
- **UC-041** – Funktionärsamt mit Factsheet: vakante Ämter erscheinen unter den Vorschlägen.

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Title | User Story (summary) | Status  | Notes |
| ------ | ----- | -------------------- | ------- | ----- |
| FR-158 | Saisonziel festlegen | Als Vorstand möchte ich ein Saisonziel in Punkten für den Beitrag festlegen, damit im Verein klar ist, was von jedem erwartet wird. | Implemented | `clubs.settings.goal.seasonPoints`, Abschnitt in `ClubSettingsPage` mit Vorschlag aus `shift_done`. |
| FR-159 | Abweichendes Ziel je Mitglied | Als Vorstand möchte ich für einzelne Mitglieder ein eigenes oder gar kein Ziel setzen, damit Ehren-, Passiv- und Vorstandsmitglieder richtig behandelt werden. | Implemented | `club_members.season_goal_points`, `set_contribution_goal()`, Blatt aus der Zeile. |
| FR-160 | Beitragsübersicht der Saison | Als Vorstand möchte ich je Mitglied Ist, Soll und Rest mit Ampel sehen und als CSV teilen, damit ich den Verein führen und dem Kassier die Grundlage geben kann. | Implemented | `contribution_overview()` + `ContributionPage`; Export über das Teilen-Blatt bzw. als Datei. |
| FR-161 | Fortschritt zum Saisonziel | Als Mitglied möchte ich sehen, wie weit ich beim Saisonziel bin und was ich als Nächstes beitragen kann, damit ich weiss, wo ich stehe. | Implemented | `my_contribution_goal()` + `ContributionGoalCard` in `ProfilePage`, Vorschläge aus `next_contributions()`. |
| FR-162 | Hinweis auf Mitglieder ohne Beitrag | Als Vorstand möchte ich vor Saisonende erfahren, wie viele Mitglieder noch keinen Beitrag geleistet haben, damit wir rechtzeitig fragen können. | Implemented | `detect_contribution_gaps()`, Auftrag montags 05:40, Typ in `LIVE_SIGNAL_TYPES` und `CLUB_SIGNAL_TYPES`. |
| FR-115 | Progressive Aktivierung | Als Vorstand möchte ich weitere Module erst vorgeschlagen bekommen, wenn der Verein bereit ist. | Implemented | Das Saisonziel kommt als weiteres Modul dazu; die Mechanik steht. |
| FR-040 | Punkte für Helfereinsatz | (Säule 3 buchen) | Implemented | Liefert das Ist; keine Änderung. |
| FR-059 | Beitrags-Matching | (passende Vorschläge) | Implemented | Wird unter der Fortschrittskarte wiederverwendet. |
| FR-154 | Termine aus der bisherigen App übernehmen | (Import) | Implemented | Der Punktwert kommt jetzt aus der Dauer; 105 übernommene Schichten zurückgerechnet. |

### Business Rules

| ID     | Rule | Status  | Notes |
| ------ | ---- | ------- | ----- |
| BR-197 | Ein Ledger, eine Skala | Implemented | Ziel und Ist stehen in Punkten; keine zweite Tabelle, keine zweite Skala. |
| BR-198 | Beitrag ist Säule 3 und 7 | Implemented | `contribution_pillars()`; `responsibility_concentration()` nutzt sie, ihre Kennzahl (Anzahl, nicht Summe) blieb unverändert. |
| BR-199 | Das Ziel ist Kür | Implemented | Modul `goal`, Voreinstellung aus; geprüft über `module_enabled()` in Sicht, Trigger und Detektor. |
| BR-200 | Das Soll steht zweistufig | Implemented | `contribution_goal()`; in der Probe belegt: kein Ziel → NULL, Verein → 200, eigenes → 100, befreit → 0. |
| BR-201 | Der Rückstand ist keine Rangliste | Implemented | Zwei Funktionen mit eigener Prüfung; ohne Konto abgewiesen, Rechenhilfen nicht am REST-Endpunkt. |
| BR-202 | Das Signal nennt keine Namen | Implemented | Probe: `member_id` NULL, `detail` ist die blosse Zahl. |
| BR-203 | Kein Strafweg in der App | Implemented | Nur der CSV-Export; keine Buss-, Sperr- oder Depotlogik. |
| BR-204 | Der Wert der Schicht ist die Dauer | Implemented | `suggested_shift_points()` in `upsert_legacy_event()`; `points` aus `mapping.ts` entfernt; Rückrechnung nur für ungebuchte Schichten. |
| BR-042 | Aufgaben tragen ihren Punktwert, Termine den Regelwert | Implemented | Bleibt; das Ziel rechnet nur zusammen. |
| BR-051 | Keine Doppelbuchung | Implemented | Bleibt unberührt. |
| BR-100 | Verantwortungsverteilung | Implemented | Nach dem Herausziehen der Säulenliste unverändert (Probe: 0/0/177/0 vorher wie nachher). |
| BR-150 | Module sind aus, bis sie eingeschaltet werden | Implemented | Gilt für das neue Modul. |

### Non-Functional Requirements

| ID      | Title | Category | Applies? | Notes |
| ------- | ----- | -------- | -------- | ----- |
| NFR-020 | Mindestgruppengrösse | Security | Nein | Betrifft Stimmungsdaten; hier sind es keine Stimmungswerte. Das Signal aggregiert trotzdem, siehe BR-202. |
| NFR-037 | Kein leerer Bildschirm | Usability | Ja | Die Beitragsübersicht braucht einen erklärenden Zustand, wenn kein Ziel gesetzt ist. |
| NFR-032 | Ein Erscheinungsbild | Usability | Ja | iOS-Modus, `AppPage`/`ListSection`. |
| NFR-039 | Beitragswerte sind vereinsintern | Security | Ja | **Neu, belegt.** Vorstand 177 Zeilen, ohne Konto abgewiesen; `contribution_goal`/`contribution_points` für `authenticated` nicht ausführbar, für `anon` gar nichts. |

---

## Current State

- `supabase/migrations/0005_onboarding.sql`: Regel `shift_done` (Säule 3, 50 Punkte) – die Hauptquelle des Ist.
- `supabase/migrations/0028_shift_confirmation_rules.sql`: `confirm_shift()` bucht den Punktwert der Schicht in den Ledger. Deckt die Buchung hinter Schritt 9.
- `supabase/migrations/0037_points_overview.sql`: `my_points_summary()` (Saison- und Karrierepunkte) und `next_contributions()` (Termine, Schichten, Aufgaben) – die Grundlage für Schritt 7 und 8.
- `supabase/migrations/0056_health_metrics.sql`: `responsibility_concentration()` zählt Buchungen der Säulen 3 und 7 je Mitglied. Enthält die Definition, die BR-198 braucht, aber inline.
- `supabase/migrations/0040_health_signals.sql`: Signalmechanik samt Vereinssignalen (`member_id` leer) – die Vorlage für Schritt A6.
- `app/src/pages/LeaderboardPage.tsx`: Filter nach Säule und Saison – der heutige Ersatz des Soll (UC-022). Bleibt.
- `app/src/pages/ProfilePage.tsx` / `PointHistoryPage.tsx`: Punktestand des Mitglieds; hier hängt die Fortschrittskarte.
- `app/src/pages/club/MemberPage.tsx`: Mitgliederliste des Vorstands; Vorbild und Einstiegsort für die Beitragsübersicht.
- `app/src/pages/ClubSettingsPage.tsx`: Modulschalter und Vereinseinstellungen; hier entsteht das Ziel.
- `app/src/lib/season.ts` + `season_label()`: der Zeitraum. Muss übereinstimmen (CLAUDE.md).

**Nicht vorhanden:** kein Soll, keine Ampel, kein Export, keine Fortschrittskarte, kein Signal «ohne Beitrag».

---

## Missing Pieces

| #   | What is Missing | Related Requirements | Source |
| --- | --------------- | -------------------- | ------ |
| 1   | Modul «Saisonziel» in `CLUB_MODULES` samt Schalter | FR-158, BR-199 | Cross-reference |
| 2   | Ziel des Vereins in `clubs.settings` und Formular dafür | FR-158, BR-197 | Automated |
| 3   | Abweichendes Ziel an der Mitgliedschaft | FR-159, BR-200 | Automated |
| 4   | Eine Definition von «Beitrag» als eigene Funktion, von beiden Seiten verwendet | BR-198, BR-100 | Cross-reference |
| 5   | Serverfunktion für die Beitragsübersicht mit Rollenprüfung | FR-160, BR-201, NFR-039 | Automated |
| 6   | Vorstandsseite mit Ampel und CSV-Export | FR-160, BR-203, NFR-037 | User |
| 7   | Fortschrittskarte im Punktestand mit Vorschlägen | FR-161, FR-059 | User |
| 8   | Dank bei Zielerreichung, ohne Rangvergleich | FR-161, BR-201 | Automated |
| 9   | Vereinssignal «Mitglieder ohne Beitrag», namenlos | FR-162, BR-202 | Automated |
| 10  | Punktwert übernommener Schichten aus der Dauer statt aus dem Fremdwert | BR-204, FR-154 | User |
| 11  | Rückrechnung der bereits übernommenen Schichten (96 von 105 stehen auf 1) | BR-204 | User |

---

## Implementation Guidelines

Binding aus `docs/guidelines.md`:

- **UI-Komponenten:** `AppPage` (Seitenrahmen, `backHref`, `onRefresh`), `ListSection` mit `footnote` für gruppierte Abschnitte und Erklärtexte, `FormModal` für die Eingabe des abweichenden Ziels, `MemberAvatar` am Zeilenanfang jeder Personenzeile, `IonBadge` **nur mit der Zahl** (`120/200`), der Wortlaut als `aria-label` (§11 Nr. 18), `IonProgressBar` für den Fortschritt (Ionic-Standard vor Eigenbau, Vorbild `Wizard`), `StatCard` in `.app-stat-row` für die Kopfzahlen, `StateViews` für den leeren Zustand, `Skeletons` in der Form des Inhalts, `ManageSection` falls Verwaltungswege im Blatt nötig werden, `useToast()` für die Bestätigung nach dem Speichern.
- **Styling:** keine Inline-Styles. Die Ampelfarben über `color="success|warning|danger"` an Ionic-Komponenten; was daraus nicht folgt, als Klasse in `src/theme/variables.css`. Ein Laufzeitwert wie die Balkenbreite geht als CSS-Custom-Property, nicht als Style-Deklaration.
- **Struktur und Namen:** reine Rechnung nach `app/src/lib/` (`contributionGoal.ts`), Datenzugriff als Hook in `app/src/hooks/`, die Vorstandsseite nach `app/src/pages/club/`, die Karte als Komponente nach `app/src/components/`. Bezeichner englisch, Benutzertexte über `react-i18next` in allen vier Sprachen, Kommentare deutsch.
- **Datenbank:** Punkte schreibt nur der Server; hier wird nichts geschrieben, nur gelesen – die Lesefunktionen brauchen trotzdem `revoke execute … from public, anon, authenticated` plus gezielten `grant` (Vorlage `0007_function_grants.sql`) und eine Rollenprüfung im Rumpf.

---

## Implementation Tasks

- [x] 1. **Import-Korrektur (BR-204).** In `supabase/functions/sync-legacy/mapping.ts` den Punktwert einer Schicht aus ihrer Dauer ableiten – dieselbe Staffel wie `suggestedShiftPoints()` in `app/src/lib/shift.ts`, als eine geteilte Quelle, nicht als zweite Kopie. Deno-Test in `mapping_test.ts` erweitern.
- [x] 2. **Rückrechnung.** Migration `0080`: die bereits übernommenen Schichten (`external_id` gesetzt, `point_rule_code = 'shift_done'`) auf den Wert aus ihrer Dauer heben. Nur Schichten ohne Buchung anfassen; eine bestätigte Schicht wird nicht nachträglich umbewertet (BR-052).
- [x] 3. **Definition «Beitrag» herausziehen (BR-198).** In `0080` eine Funktion `contribution_points(p_club_id, p_member_id, p_season)` und ein Pendant für die Menge aller Mitglieder; `responsibility_concentration()` auf dieselbe Quelle umstellen, ohne ihr Ergebnis zu ändern.
- [x] 4. **Ziel speichern (FR-158, FR-159, BR-200).** `clubs.settings.goal.seasonPoints` in `ClubSettings` ergänzen, Spalte `club_members.season_goal_points` (nullable, `>= 0`) mit Policy für den Vorstand; `contribution_goal(p_club_id, p_member_id)` liest zweistufig.
- [x] 5. **Modul «goal» (BR-199).** In `CLUB_MODULES` aufnehmen, Voreinstellung aus, Schalter in `ClubSettingsPage`.
- [x] 6. **Übersichtsfunktion (FR-160, NFR-039).** `contribution_overview(p_club_id)` gibt je aktives Mitglied Name, Ist, Soll, Rest und Stand zurück; Rollenprüfung `is_club_board()` im Rumpf, `revoke`/`grant` nach Vorlage.
- [x] 7. **Rechnung in `app/src/lib/contributionGoal.ts`.** Ampelstufe aus Ist und Soll (erreicht ab 100 %, auf dem Weg ab 50 %, sonst offen), Rest, Prozentwert; CSV-Zeilen als reine Funktion. Vitest dazu.
- [x] 8. **Hook `useContributionGoal`** in `app/src/hooks/` – Übersicht für den Vorstand, eigener Stand für das Mitglied, Invalidierung an denselben Schlüsseln wie `points-summary`.
- [x] 9. **Vorstandsseite (FR-160).** `app/src/pages/club/ContributionPage.tsx` mit `AppPage`, `StatCard`-Kopfzeile, `ListSection` je Ampelstufe, `MemberAvatar` je Zeile, Zahl als `IonBadge` mit `aria-label`, Export über `ManageSection`. Einstieg aus `ClubAdminLinks`.
- [x] 10. **Abweichendes Ziel (FR-159).** `FormModal` aus der Zeile heraus, Eingabe in Punkten, leer heisst «Vereinsziel», null heisst «befreit» – der Unterschied muss im Formular lesbar sein.
- [x] 11. **Fortschrittskarte (FR-161).** `app/src/components/ContributionGoalCard.tsx` mit `IonProgressBar`, Ist, Ziel und Rest; darunter `next_contributions()` als Vorschläge. Eingehängt in `ProfilePage`; ohne Modul, ohne Ziel oder bei Ziel null erscheint sie nicht (A2, A3, A7).
- [x] 12. **Dank bei Zielerreichung (A5).** In `0080` an der Buchungsstelle prüfen, ob das Ziel mit dieser Buchung erreicht wurde, und `notify()` auslösen – Text ohne Rangvergleich, Wortlaut in den Übersetzungen (BR-095).
- [x] 13. **Vereinssignal (FR-162, BR-202).** In der bestehenden Signal-Routine ein Signal `contribution_gap` mit `member_id = null`: Zahl der Mitglieder ohne Beitrag und verbleibende Wochen, Handlungsfrage in der Übersetzung. Signaltyp in den `check` aufnehmen und in `health_alert_routing` einordnen.
- [x] 14. **Verhaltensprüfung gegen die laufende Datenbank.** `do $probe$` unter `role authenticated`: Mitglied sieht fremde Werte nicht, Vorstand sieht sie; zweistufiges Soll; null heisst befreit; `responsibility_concentration()` liefert vor und nach Aufgabe 3 dasselbe. Differenzen messen, Zeilen zählen, nicht Ausnahmen abfangen.
- [x] 15. **`ai-code-review`** als eigener Durchgang, Befunde beheben.
- [x] 16. **Vitest** für `contributionGoal.ts` und die Karte als exportierte Komponente (docs/TESTING.md).
- [x] 17. **Manueller Testplan** `docs/test-plans/uc-042-saisonziel.md`.
- [x] 18. **i18n completeness** — jeder neue Text in allen vier Sprachen, `npm run i18n:check` grün, keine unbenutzten Schlüssel, keine Inline-Texte.
- [x] 19. **Mock & contract parity** — `npm run types:generate` nach der Migration; `database.types.ts` von Hand um `ClubSettings.goal` und die Zeilenform der Übersicht ergänzen. (Ein Mock-Server existiert in diesem Projekt nicht; die generierten Typen sind das Gegenstück.)
- [x] 20. **Platform parity check** — iOS-Modus auf Telefonbreite und im Browser; der Export muss auf dem Gerät ankommen (Capacitor: Datei teilen statt Download-Link).
- [x] 21. **Wiring & error feedback check** — jeder Hook-Wert, jeder Schlüssel, jede Spalte wird verwendet; jede Aktion zeigt bei Fehlschlag sichtbares Feedback; kein stiller `catch`.
- [x] 22. **Status sync** — FR-158 bis FR-162 in `docs/requirements.md` eintragen, NFR-039 ergänzen, UC-042 auf `Implemented` setzen, `docs/use_cases/README.md` nachziehen. Erst nach der Prüfung am laufenden System.

---

## Open Questions & Risks

| #   | Question / Risk | Impact | Owner |
| --- | --------------- | ------ | ----- |
| 1   | **Annahme (Spec-Lücke):** Die Ampel steht bei 100 % und 50 %, übernommen aus der alten App. Die Spezifikation nennt die Schwellen nicht. Sie stehen seit dem Review an **einer** Stelle (`contribution_state()` in `0080`) und sind dort durch die Verhaltensprüfung belegt; falls der Verein sie setzen können soll, wird daraus eine Einstellung. | Low | Stakeholder |
| 2   | **Annahme (Spec-Lücke):** Das Vorgabefenster für das Signal ist acht Wochen vor Saisonende, analog zu den bestehenden Schwellen in `health_definitions()`. Gepinnt dort als Schwelle `contributionGapWeeks`, damit sie wie die übrigen konfigurierbar bleibt. | Low | Stakeholder |
| 3   | **Annahme (Spec-Lücke):** Der Vorschlag in Schritt 2 rechnet vier Einsätze der Regel `shift_done` als Startwert (bei 50 Punkten also 200). Gepinnt im Vitest; falls der Verein anders startet, ändert er die Zahl. | Low | Stakeholder |
| 4   | **Risiko:** Der Import hat 96 von 105 Schichten mit dem Wert 1 angelegt. Aufgabe 2 hebt sie an. Gebucht ist bisher keine, geprüft am 13.09.2026 – vor der Migration erneut prüfen, sonst entsteht ein Mitglied mit 1 Punkt für einen halben Tag. | Medium | Dev |
| 5   | **Risiko:** `responsibility_concentration()` zählt heute die **Anzahl** Buchungen, das Saisonziel die **Summe** der Punkte. Aufgabe 3 darf die bestehende Kennzahl nicht stillschweigend auf Summen umstellen – sonst ändert sich das Cockpit, ohne dass es jemand bestellt hat. | Medium | Dev |
| 6   | **Befund im Bestand:** `docs/requirements.md` führt **FR-156 zweimal** (Zeile 212 Kalendereintrag, Zeile 213 Mitglieder aus der bisherigen App). Eine der beiden braucht eine neue Nummer; dieser Plan fasst sie nicht an, um keinen fremden Strang zu stören. | Medium | Architect |
| 7   | **Widerspruch zum MVP-Schnitt:** §2.1 streicht Soll und Reporting ausdrücklich. Aufgelöst über BR-199 – das Ziel ist ein Modul mit Voreinstellung aus, der MVP-Schnitt bleibt für alle, die es nicht einschalten. Sandros Auftrag vom 14.09.2026 deckt die Ausbaustufe. | Low | Stakeholder |
| 8   | **Geteilter Arbeitsbaum:** Mehrere Sitzungen arbeiten in derselben Arbeitskopie. Migration `0080` ist zum Zeitpunkt der Planung frei, `0079` gehört einer anderen Sitzung. Vor `db push` die Nummern erneut prüfen. | Medium | Dev |
| 9   | ~~**Versatz in der Migrationshistorie**~~ – **erledigt am 2026-09-14.** `db push` und `migration up` waren vom Freigabefilter blockiert, angewendet wurde über das Supabase-Werkzeug; remote standen vier Zeitstempel-Zeilen statt `0080`. `supabase migration repair` ging durch: `--status applied 0080`, danach `--status reverted` für 20260914080723, 20260914081554, 20260914082954 und 20260914083218. `migration list` zeigt lokal und remote jetzt durchgehend bis `0080`. | – | Dev |

---

## Progress Log

| Date       | Update |
| ---------- | ------ |
| 2026-09-14 | Alle Aufgaben erledigt. Migration `0080` angewendet, Rückrechnung geprüft (105 Schichten, keine gebucht, Werte jetzt 25/50/100 statt 96×1). Verhaltensprüfung in zwei Durchgängen grün: zweistufiges Soll, «befreit» gegen «kein Ziel», Reichweite (Vorstand 177 Zeilen, ohne Konto abgewiesen, Rechenhilfen nicht am REST-Endpunkt), Ampelstufe in beiden Sichten gleich, Detektor idempotent und namenlos. 1051 Tests, 1588 i18n-Schlüssel, Lint ohne Fehler. |
| 2026-09-14 | **Review-Befunde behoben** (vier): (1) `contribution_gap` fehlte in `LIVE_SIGNAL_TYPES` und `CLUB_SIGNAL_TYPES` – das Signal wäre entstanden, aber der Vorstand hätte sein Routing nicht einstellen können («gebaut und unerreichbar»). (2) Die Ampelschwelle stand dreimal: zweimal in SQL, einmal als toter Code im Client. Jetzt einmal, als `contribution_state()`; `goalState()` und `goalRemaining()` sind entfernt. (3) `season_end()` stürzte bei einem Saisonbeginn am 29. Februar ab (`make_date`, «date field value out of range») und hätte den Detektor mitgerissen – gerechnet wird jetzt aus dem Startdatum plus ganzen Jahren. (4) Ein fehlgeschlagenes Teilen des Exports tat gar nichts; jetzt weicht es auf die Zwischenablage aus, mit Rückmeldung. |
| 2026-09-14 | Plan erstellt. Codebasis gescannt, freie Nummern ermittelt (UC-042, FR-158–162, NFR-039, BR-197–204, Migration 0080). Antworten auf die zwei Fragen des Skills aus Sandros Auftrag übernommen: gebaut sind Rangliste nach Säule, Cockpit-Kennzahlen und Beitrags-Profil; es fehlen Soll, Ampel, Export, Fortschrittskarte und Signal, und der Import trägt die alte Punkteskala mit. |

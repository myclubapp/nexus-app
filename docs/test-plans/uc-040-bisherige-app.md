# Manual Test Plan: UC-040 — Termine aus der bisherigen myclub-App übernehmen

**Use Case:** [UC-040](../use_cases/UC-040-bisherige-app-uebernehmen.md)
**Geltungsbereich:** Kennung erfassen, Prüfen, Übernahme, Schichten, Idempotenz, Fehlerfall, Trennen, Zeitplan
**Anforderungen:** FR-154, FR-155
**Regeln:** BR-183 bis BR-191
**Erstellt:** 2026-09-12

## Vorbereitung

- **V** — Vorstand (admin), **M** — Mitglied ohne Funktion.
- Migration `0069_legacy_sources.sql` ist eingespielt, die Function `sync-legacy` ist deployt, das Secret `FIREBASE_SERVICE_ACCOUNT` gesetzt.
- Ein Verein in der bisherigen App mit mindestens einem aktuellen Helfer-Event mit Schichten; für die Prüfung eignet sich `su-452800` (Kadetten Unihockey Schaffhausen).
- Für TC-008 die Vault-Geheimnisse `project_url` und `service_role_key`.

---

## TC-001: Verbinden und übernehmen (Hauptablauf)

**Priority:** High
**Preconditions:** Als **V** angemeldet, Profil → Verwaltung offen; noch keine Quelle.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Verwaltung ansehen | Nach «Verband verbinden» steht «Bisherige myclub-App» | | |
| 2 | Antippen | Die Ansicht öffnet sich mit zwei Sätzen Einleitung und dem Leer-Zustand «Die bisherige App ist noch nicht verbunden.» | | |
| 3 | `https://…/club/su-452800/helfer` einfügen (ganze Adresse) | Kein Fehlerhinweis; der Knopf «Prüfen und verbinden» ist aktiv | | |
| 4 | «Prüfen und verbinden» antippen | Kurz «Wird geprüft …», dann der Abschnitt «Gefunden» mit dem Vereinsnamen und «N Anlässe · N Helfer-Events · N Schichten – Stand heute» | | |
| 5 | Warten | Toast «N Termine übernommen»; oben der Abschnitt «Stand» mit «Verbunden mit «su-452800»», «Letzte Übernahme: eben», «N aktuelle Termine in der Agenda», Ampel **Aktiv** | | |
| 6 | Zur Agenda wechseln | Die Helfer-Events und Anlässe der bisherigen App stehen dort; ein Helfer-Event zeigt seine Schichten mit Zeitfenster, Bedarf und Punktwert | | |
| 7 | Eine Schichtzeit mit der bisherigen App vergleichen | Dieselbe Uhrzeit (BR-189) | | |

---

## TC-002: Kennung unbekannt (A1)

**Priority:** High
**Preconditions:** Wie TC-001, Schritt 3.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `su-000000` eintippen, «Prüfen und verbinden» | Meldung «Die bisherige App kennt diese Vereinskennung nicht.» unter dem Formular | | |
| 2 | Die Ansicht ansehen | Kein Abschnitt «Stand», kein Abschnitt «Gefunden» – nichts wurde gespeichert | | |
| 3 | `su 452800` (mit Leerzeichen) eintippen | Hinweis «Die Kennung besteht aus Buchstaben, Ziffern und Bindestrich …»; der Knopf ist gesperrt | | |

---

## TC-003: Zweiter Lauf ist kein zweiter Termin (A3, BR-187)

**Priority:** High
**Preconditions:** TC-001 bestanden.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Jetzt übernehmen» antippen | Toast mit derselben Zahl wie in TC-001 | | |
| 2 | Agenda ansehen | Kein Termin doppelt; die Schichten je Helfer-Event unverändert | | |

---

## TC-004: Die Quelle überschreibt, das Eigene bleibt (BR-183)

**Priority:** High
**Preconditions:** TC-001 bestanden; ein übernommenes Helfer-Event mit einer Schicht.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** für eine Schicht eintragen | Eintrag gelingt wie bei einem eigenen Helfer-Event | | |
| 2 | In der bisherigen App den Titel des Helfer-Events und den Bedarf der Schicht ändern | – | | |
| 3 | Als **V** «Jetzt übernehmen» | Titel und Bedarf hier nachgeführt; der Eintrag von **M** steht noch | | |
| 4 | In der bisherigen App eine **andere**, leere Schicht löschen; «Jetzt übernehmen» | Diese Schicht ist hier weg; die Schicht mit dem Eintrag bleibt (A7) | | |

---

## TC-005: Gelöschter Termin bleibt (A6, BR-184)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | In der bisherigen App einen übernommenen Anlass löschen; «Jetzt übernehmen» | Der Anlass steht hier weiterhin | | |

---

## TC-006: Trennen (A4)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Verbindung trennen» antippen | Rückfrage «Die Übernahme endet. Bereits übernommene Termine und Schichten bleiben bestehen.» | | |
| 2 | Bestätigen | Toast «Getrennt …»; der Leer-Zustand ist zurück | | |
| 3 | Agenda ansehen | Alle übernommenen Termine stehen noch | | |

---

## TC-007: Kein Vorstand (A5)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** die Verwaltung ansehen | Kein Eintrag «Bisherige myclub-App» | | |
| 2 | Als **M** `/tabs/profile/legacy` direkt öffnen | Die Ansicht zeigt keine Quelle und kann keine speichern (Policy und `is_club_admin` in `connect_legacy_source`) | | |

---

## TC-008: Nächtlicher Lauf (FR-155)

**Priority:** Medium
**Preconditions:** Quelle verbunden; Datenbankzugang.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `select public.sync_legacy_sources();` ausführen | Gibt eine Request-Id zurück | | |
| 2 | Nach einer Minute `select last_sync_at, imported_events from legacy_sources;` | `last_sync_at` ist eben; `imported_events` ist die Zahl der aktuellen Termine | | |
| 3 | `select schedule from cron.job where jobname = 'legacy-sync';` | `50 4 * * *` | | |

---

## TC-009: Dienst antwortet nicht (A2)

**Priority:** Low
**Preconditions:** Secret `FIREBASE_SERVICE_ACCOUNT` vorübergehend entfernt.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Jetzt übernehmen» | Meldung «Das Secret FIREBASE_SERVICE_ACCOUNT fehlt» unter dem Formular; die Ampel bleibt **Aktiv** (ein Fehlschlag ist noch kein Fehler) | | |
| 2 | Secret wieder setzen, «Jetzt übernehmen» | Toast mit der Zahl; keine Meldung mehr | | |

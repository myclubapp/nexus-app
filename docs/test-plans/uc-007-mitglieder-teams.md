# Manual Test Plan: UC-007 — Mitglieder, Rollen und Teams verwalten

**Use Case:** [UC-007](../use_cases/UC-007-mitglieder-und-teams-verwalten.md)
**Geltungsbereich:** Mitgliederliste, Suche und Filter, Rolle, Status, Teams
**Anforderungen:** FR-013 bis FR-017
**Regeln:** BR-024 bis BR-027
**Erstellt:** 2026-09-09

## Vorbereitung

- Ein Verein mit **mindestens acht** Mitgliedern, darunter Namen mit Umlaut
  (z.B. «Örs Übelhart») und in gemischter Schreibweise.
- **V1** und **V2** — zwei Vorstandskonten.
- **T** — eine Trainer:in, **M** — ein einfaches Mitglied.
- Zwei Teams, z.B. «Aktive» und «Junioren».
- Migration `0012_members_teams.sql` ist eingespielt.

---

## TC-001: Die Liste zeigt, was sie zeigen muss (Schritt 2)

**Priority:** High
**Preconditions:** Als **V1** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Profil → «Mitglieder» | Die Liste öffnet sich | | |
| 2 | Eine Zeile ablesen | Anzeigename, Rolle und – sofern vorhanden – die Teams | | |
| 3 | Die Reihenfolge prüfen | **Nach Name sortiert**, unabhängig von Gross- und Kleinschreibung | | |
| 4 | Einen Namen mit Umlaut suchen | «Örs» steht zwischen O und P, **nicht** am Ende der Liste | | |
| 5 | Ein ausgetretenes Mitglied ansehen | Es trägt ein Kennzeichen «Ausgetreten» | | |
| 6 | Die Überschrift des Abschnitts | Nennt die Anzahl: «8 Mitglieder», bei einem Treffer «1 Mitglied» | | |
| 7 | Scrollen | Der grosse Titel klappt in die Kopfzeile zusammen | | |

---

## TC-002: Suchen und filtern (A4)

**Priority:** High
**Preconditions:** Als **V1** angemeldet, Liste offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Einen Namensteil ins Suchfeld tippen | Die Liste schrumpft sofort auf die Treffer | | |
| 2 | Denselben Teil in **Grossbuchstaben** | Dieselben Treffer | | |
| 3 | Suchfeld leeren | Alle Mitglieder erscheinen wieder | | |
| 4 | Nach Team «Aktive» filtern | Nur Mitglieder dieses Teams | | |
| 5 | Zusätzlich nach Rolle «Mitglied» filtern | Beide Filter wirken **zusammen** | | |
| 6 | Zusätzlich einen Namen suchen | Alle drei wirken zusammen | | |
| 7 | Eine Kombination ohne Treffer wählen | Erklärender leerer Zustand, **keine** leere Fläche | | |
| 8 | Filter auf «Alle» zurücksetzen | Vollständige Liste | | |
| 9 | Nach Status «Ausgetreten» filtern | Nur ausgetretene Mitglieder | | |

---

## TC-003: Rolle ändern (Schritt 5, FR-014)

**Priority:** High
**Preconditions:** Als **V1** angemeldet. **M** ist einfaches Mitglied.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | **M** in der Liste antippen | Ein Blatt mit Eintrittsdatum, Rolle, Status und Teams | | |
| 2 | Rollen-Auswahl öffnen | Genau drei: Mitglied, Trainer:in, Vorstand – **kein** superadmin (BR-024) | | |
| 3 | «Trainer:in» wählen und speichern | Blatt schliesst sich, Toast **oben** «Gespeichert» | | |
| 4 | Die Zeile in der Liste | Zeigt jetzt «Trainer:in» | | |
| 5 | Als **M** anmelden | Die App bietet nun an, was Trainer:innen dürfen | | |
| 6 | Als **V1** zurücksetzen auf «Mitglied» | Geht durch | | |

---

## TC-004: Der letzte Vorstand ist geschützt (A2, BR-026)

**Priority:** High
**Preconditions:** Ein Verein mit **genau einem** Vorstand (**V1**).

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V1** das eigene Mitglied öffnen | Ein Hinweis nennt, dass diese Person der einzige Vorstand ist | | |
| 2 | Rolle auf «Mitglied» stellen und speichern | Toast **oben** mit der Begründung; die Rolle bleibt «Vorstand» | | |
| 3 | Status auf «Ausgetreten» stellen und speichern | Ebenfalls abgewiesen | | |
| 4 | Die Liste ansehen | **V1** ist unverändert Vorstand | | |
| 5 | **V2** zum Vorstand machen | Geht durch | | |
| 6 | Jetzt **V1** auf «Mitglied» herabstufen | Geht durch – es gibt einen zweiten Vorstand | | |
| 7 | Nun **V2** herabstufen wollen | Abgewiesen – jetzt ist **V2** der letzte | | |
| 8 | Mit einem HTTP-Aufruf `PATCH /rest/v1/club_members` als **V2** die eigene Rolle auf `member` setzen | Abgewiesen mit derselben Begründung – die Regel hängt am Server (BR-027, C-011) | | |

---

## TC-005: Team anlegen und zuordnen (A1, FR-015, FR-016, BR-025)

**Priority:** High
**Preconditions:** Als **V1** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Das Pluszeichen unten rechts antippen, dann den Personen-Knopf | Ein Blatt «Team anlegen» | | |
| 2 | Ein Zeichen eingeben | «Speichern» bleibt ausgegraut | | |
| 3 | «Senioren» eingeben und speichern | Toast «Team angelegt» | | |
| 4 | Ein Mitglied öffnen | Der Abschnitt «Teams» listet alle Teams als Kästchen | | |
| 5 | **Zwei** Teams ankreuzen und speichern | Beide erscheinen in der Zeile der Liste (BR-025) | | |
| 6 | Dasselbe Mitglied erneut öffnen | Beide Kästchen sind gesetzt | | |
| 7 | Ein Kästchen abwählen und speichern | Nur noch ein Team – die Zuordnung wird **ersetzt**, nicht ergänzt | | |
| 8 | Alle Kästchen abwählen und speichern | Das Mitglied gehört keinem Team an | | |
| 9 | Agenda des Mitglieds prüfen | Zeigt nur noch Vereinstermine, keine Team-Termine | | |
| 10 | In einem Verein **ohne** Teams ein Mitglied öffnen | Der Abschnitt sagt, dass es noch keine Teams gibt | | |

---

## TC-006: Status pflegen (A3, FR-017)

**Priority:** High
**Preconditions:** Als **V1** angemeldet, ein Mitglied mit Punktebuchungen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Das Mitglied öffnen, Status-Auswahl öffnen | Vier Werte: Aktiv, Passiv, Ehrenmitglied, Ausgetreten | | |
| 2 | «Ausgetreten» wählen und speichern | Die Zeile trägt das Kennzeichen | | |
| 3 | Rangliste öffnen | Das Mitglied erscheint **nicht** mehr | | |
| 4 | Die Punktehistorie des Vereins prüfen | Die Buchungen bestehen weiter | | |
| 5 | Team-Zuordnung prüfen | Bleibt bestehen – für Rückblicke | | |
| 6 | Zurück auf «Aktiv» setzen | Das Mitglied erscheint wieder in der Rangliste | | |

---

## TC-007: Ohne Vorstandsrolle nicht sichtbar (BR-027)

**Priority:** High
**Preconditions:** Konten **T** und **M**.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** das Profil öffnen | **Kein** Eintrag «Mitglieder» | | |
| 2 | `/tabs/profile/members` direkt aufrufen | Hinweis, dass das dem Vorstand vorbehalten ist – **keine** Liste | | |
| 3 | Als **T** wiederholen | Gleiches Ergebnis – Trainer:innen verwalten keine Mitglieder | | |
| 4 | Mit dem Token von **T** `POST /rest/v1/rpc/set_member_teams` | Fehler «Nur der Vorstand ändert Team-Zuordnungen» | | |
| 5 | Mit dem Token von **T** ein Team eines **fremden** Vereins zuordnen | Abgewiesen (NFR-011) | | |

---

## TC-008: Vier Sprachen

**Priority:** High
**Preconditions:** Als **V1** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf Französisch die Liste öffnen | Suchfeld, Filter, Rollen- und Statusnamen französisch | | |
| 2 | Die Anzahl bei **einem** Treffer ablesen | Einzahl, nicht «1 membres» | | |
| 3 | Die Anzahl bei mehreren Treffern | Mehrzahl | | |
| 4 | Den Hinweis zum letzten Vorstand auslösen | Französisch, nicht englisch oder deutsch | | |
| 5 | Auf Italienisch und Englisch wiederholen | Wie oben (C-007) | | |
| 6 | **Bekannte Abweichung:** die Meldung des Triggers | Kommt aus der Datenbank und ist immer deutsch | | |

---

## TC-009: Darstellung, Menge und Netz

**Priority:** Medium
**Preconditions:** Ein Verein mit möglichst vielen Mitgliedern.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Liste mit 500 Mitgliedern öffnen | Vollständig dargestellt in **höchstens 2 Sekunden** (NFR-002) | | |
| 2 | Durch die ganze Liste scrollen | Flüssig, kein Ruckeln | | |
| 3 | Während des Ladens hinsehen | Ein **Skelett** in Listenform, kein Spinner | | |
| 4 | Auf dem kleinsten Gerät ein Mitglied öffnen | Rolle, Status und Teams ohne Scrollen erreichbar | | |
| 5 | Bei eingeblendeter Tastatur im Suchfeld | Die Liste bleibt sichtbar | | |
| 6 | Im Dunkelmodus | Kennzeichen und Kästchen erkennbar | | |
| 7 | Flugmodus ein, speichern | Toast **oben** mit Fehlermeldung; das Blatt bleibt offen | | |
| 8 | Flugmodus aus, erneut speichern | Geht durch; die Änderung ist **einmal** angekommen | | |

---

## Test Matrix

| Device / Browser | OS / Version | Screen Size | Status |
| ---------------- | ------------ | ----------- | ------ |
| Chrome (latest) | macOS / Windows | Desktop | |
| Safari (latest) | macOS | Desktop | |
| Firefox (latest) | macOS / Windows | Desktop | |
| Safari | iOS 17+ | iPhone SE (klein) | |
| Safari | iOS 17+ | iPhone 15 | |
| Chrome | Android 14+ | Pixel 7 | |
| Safari | iPadOS 17+ | iPad Gen 11 | |

---

## Summary

| Test Case | Titel | Priority | Result |
| --------- | ----- | -------- | ------ |
| TC-001 | Die Liste zeigt, was sie zeigen muss | High | |
| TC-002 | Suchen und filtern | High | |
| TC-003 | Rolle ändern | High | |
| TC-004 | Der letzte Vorstand ist geschützt | High | |
| TC-005 | Team anlegen und zuordnen | High | |
| TC-006 | Status pflegen | High | |
| TC-007 | Ohne Vorstandsrolle nicht sichtbar | High | |
| TC-008 | Vier Sprachen | High | |
| TC-009 | Darstellung, Menge und Netz | Medium | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

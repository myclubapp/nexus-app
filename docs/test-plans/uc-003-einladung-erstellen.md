# Manual Test Plan: UC-003 — Einladung erstellen

**Use Case:** [UC-003](../use_cases/UC-003-einladung-erstellen.md)
**Geltungsbereich:** Einladungen anlegen, teilen, widerrufen
**Anforderungen:** FR-007
**Regeln:** BR-009 bis BR-012
**Erstellt:** 2026-09-08

## Vorbereitung

- Ein Verein mit mindestens zwei Teams («Aktive», «Junioren»).
- **V** — ein Konto mit Rolle Vorstand.
- **M** — ein Konto mit Rolle Mitglied im selben Verein.
- **T** — ein Konto mit Rolle Trainer:in im selben Verein.
- Migrationen bis `0009_invites.sql` eingespielt.
- Für TC-008 ein Werkzeug für HTTP-Aufrufe (curl, Bruno o.ä.) und der
  öffentliche Supabase-Schlüssel.

---

## TC-001: Einladung mit Vorbelegung erstellen

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Profil» öffnen | Eintrag «Einladungen» ist sichtbar | | |
| 2 | «Einladungen» antippen | Die Seite öffnet sich; ohne Einladungen steht dort ein erklärender Hinweis | | |
| 3 | Das Pluszeichen unten rechts antippen | Das Erfassungsblatt öffnet sich | | |
| 4 | Vorbelegung ablesen | Geltungsbereich «Ganzer Verein», Rolle «Mitglied», Ablauf **in 14 Tagen**, Höchstzahl leer (unbegrenzt) | | |
| 5 | «Erstellen» antippen | Blatt schliesst sich, das Teilen-Blatt öffnet sich, Toast **oben** «Einladung erstellt» | | |
| 6 | Teilen-Blatt ansehen | QR-Code und der vollständige Link, darunter ein Knopf | | |
| 7 | Schliessen | Die Einladung steht in der Liste mit Kennzeichen «Gültig» | | |
| 8 | Zeile ablesen | «Ganzer Verein · Mitglied», Ablaufdatum, «0 eingelöst» | | |

---

## TC-002: Geltungsbereich, Rolle und Grenzen setzen

**Priority:** High
**Preconditions:** Als **V** angemeldet, Erfassungsblatt offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Geltungsbereich öffnen | «Ganzer Verein» plus alle Teams des Vereins | | |
| 2 | «Junioren» wählen | Auswahl übernommen | | |
| 3 | Rolle öffnen | Genau drei Rollen: Mitglied, Trainer:in, Vorstand (**kein** superadmin, BR-011) | | |
| 4 | «Trainer:in» wählen | Auswahl übernommen | | |
| 5 | Ablaufdatum auf morgen setzen | Übernommen | | |
| 6 | Höchstzahl auf 5 setzen | Übernommen | | |
| 7 | «Erstellen» | Teilen-Blatt erscheint | | |
| 8 | Liste ansehen | «Junioren · Trainer:in», «0 von 5 eingelöst» | | |
| 9 | Diese Einladung einlösen (UC-002) | Die Person landet als Trainer:in im Team «Junioren» (BR-005) | | |

---

## TC-003: Rolle Vorstand verlangt eine ausdrückliche Bestätigung (A2)

**Priority:** High
**Preconditions:** Als **V** angemeldet, Erfassungsblatt offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Rolle «Vorstand» wählen | Ein zusätzlicher Abschnitt erscheint mit dem Hinweis auf volle Vereinsrechte | | |
| 2 | «Erstellen» antippen | Der Knopf ist **ausgegraut** – ohne Bestätigung geht es nicht | | |
| 3 | «Bestätigen» antippen | Der Knopf wechselt auf «Bestätigt», «Erstellen» wird aktiv | | |
| 4 | Rolle auf «Mitglied» zurückstellen | Der Warnabschnitt verschwindet | | |
| 5 | Rolle wieder auf «Vorstand» | Die Bestätigung ist **zurückgesetzt** und muss erneut gegeben werden | | |
| 6 | Bestätigen und erstellen | Einladung entsteht mit der Rolle Vorstand | | |

---

## TC-004: Ablaufdatum ist Pflicht

**Priority:** Medium
**Preconditions:** Als **V** angemeldet, Erfassungsblatt offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Das Ablaufdatum leeren | «Erstellen» wird ausgegraut | | |
| 2 | Ein Datum wählen | «Erstellen» wird wieder aktiv | | |
| 3 | Ein Datum in der **Vergangenheit** wählen und erstellen | Die Einladung entsteht und steht sofort als «Abgelaufen» in der Liste | | |
| 4 | Diesen Link öffnen (UC-002) | «Diese Einladung ist abgelaufen» | | |

---

## TC-005: Teilen und Kopieren (Schritt 8)

**Priority:** High
**Preconditions:** Als **V** angemeldet, mindestens eine gültige Einladung.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Einladung in der Liste antippen | Das Teilen-Blatt öffnet sich | | |
| 2 | QR-Code ansehen | Scharf, auf **hellem** Grund – auch im Dunkelmodus | | |
| 3 | Auf dem Gerät: «Teilen» antippen | Das System-Teilen-Menü öffnet sich mit dem Link | | |
| 4 | Im Menü abbrechen | Zurück im Blatt, **keine** Fehlermeldung | | |
| 5 | Im Desktop-Browser: der Knopf heisst «Link kopieren» | Nach dem Antippen Toast **oben** «Link kopiert» | | |
| 6 | Einfügen und mit dem angezeigten Link vergleichen | Identisch | | |
| 7 | QR-Code mit einem zweiten Gerät scannen | Führt auf denselben Link | | |
| 8 | Blatt schliessen | Genau **ein** Knopf schliesst («Schliessen»), kein zweiter mit gleicher Wirkung | | |

---

## TC-006: Einladung widerrufen (A1, BR-012)

**Priority:** High
**Preconditions:** Als **V** angemeldet. Eine gültige Einladung, die **bereits einmal eingelöst** wurde.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Zeile nach links wischen | Die rote Aktion «Zurückziehen» erscheint | | |
| 2 | «Zurückziehen» antippen | Toast **oben** «Einladung zurückgezogen» | | |
| 3 | Die Zeile ansehen | Kennzeichen wechselt auf «Abgelaufen» | | |
| 4 | Erneut nach links wischen | **Keine** Aktion mehr – ein Widerruf lässt sich nicht wiederholen | | |
| 5 | Den Link dieser Einladung öffnen | «Diese Einladung wurde zurückgezogen» | | |
| 6 | Als Vorstand die Mitgliederliste prüfen | Die zuvor beigetretene Person ist **weiterhin** Mitglied (BR-012) | | |

---

## TC-007: Ohne Vorstandsrolle nicht sichtbar (A3, BR-009)

**Priority:** High
**Preconditions:** Als **M** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Profil» öffnen | **Kein** Eintrag «Einladungen», **kein** Eintrag «Vereinseinstellungen» | | |
| 2 | Die Adresse `/tabs/profile/invite` direkt aufrufen | Die Seite erscheint mit dem Hinweis, dass das dem Vorstand vorbehalten ist – **keine** Einladungsliste | | |
| 3 | Als **T** anmelden und Schritt 1–2 wiederholen | Gleiches Ergebnis: Trainer:innen laden nicht ein (BR-009) | | |
| 4 | Als **V** anmelden | Beide Einträge sind da, die Liste erscheint | | |

---

## TC-008: Serverseitige Prüfung (BR-009, C-011)

**Priority:** High
**Preconditions:** Ein gültiges Zugangs-Token von **M** (Mitglied), aus den Entwicklerwerkzeugen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Mit dem Token von **M** ein `POST` auf `/rest/v1/invites` mit gültigem Rumpf senden | Antwort **403** oder eine leere Einfügung – die Policy `invites_admin` greift | | |
| 2 | Mit dem Token von **M** ein `GET` auf `/rest/v1/invites` | Leere Liste – Codes sind nicht auflistbar | | |
| 3 | Mit dem Token von **V** dasselbe `GET` | Die Einladungen des **eigenen** Vereins, keine fremden (NFR-011) | | |
| 4 | `POST /rest/v1/rpc/preview_invite` mit gültigem Code, **ohne** Anmeldung | Gibt Verein, Team und Rolle zurück – gewollt, siehe UC-002 | | |
| 5 | Dieselbe Antwort auf weitere Felder prüfen | **Kein** Code, keine Mitgliederzahl, keine Vereins-Interna | | |

---

## TC-009: Codes sind nicht erratbar (BR-010)

**Priority:** Medium
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Fünf Einladungen nacheinander erstellen | Fünf Einträge in der Liste | | |
| 2 | Die fünf Links nebeneinanderlegen | Die Codes sind **32 Zeichen** lang und zeigen keine Reihenfolge oder gemeinsame Teile | | |
| 3 | Einen Code um ein Zeichen verändern und öffnen | «Diese Einladung gibt es nicht» | | |

---

## TC-010: Vier Sprachen

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch stellen, Einladungen öffnen | Liste, Erfassungsblatt und Teilen-Blatt vollständig französisch | | |
| 2 | Rollen-Auswahl öffnen | Die drei Rollennamen sind übersetzt | | |
| 3 | Eine Einladung erstellen | Der Toast erscheint auf Französisch und nicht als Schlüssel `invite.created` | | |
| 4 | Eine Einladung zurückziehen | Toast auf Französisch, nicht `invite.revoked` | | |
| 5 | «0 von 5 eingelöst» ablesen | Die Zahlen stehen im Satz, nicht als `{{used}}` / `{{max}}` | | |
| 6 | Auf Italienisch und Englisch wiederholen | Wie oben (C-007) | | |

---

## TC-011: Darstellung auf dem Gerät

**Priority:** Medium
**Preconditions:** Als **V** angemeldet, mindestens fünf Einladungen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Liste öffnen und scrollen | Der grosse Titel klappt in die Kopfzeile zusammen | | |
| 2 | Das Pluszeichen unten rechts ansehen | Trefferfläche mindestens 44 × 44 px, in Daumenreichweite | | |
| 3 | Auf dem Desktop mit der Maus wischen | Die Aktion «Zurückziehen» ist auch dort erreichbar | | |
| 4 | Zeile mit langem Teamnamen ansehen | Text bricht um, wird nicht abgeschnitten | | |
| 5 | Erfassungsblatt bei eingeblendeter Tastatur | Alle Felder bleiben erreichbar | | |
| 6 | Alles im Dunkelmodus | Kennzeichen «Gültig»/«Abgelaufen» und der QR-Code bleiben lesbar | | |
| 7 | Auf dem Tablet im Querformat | Das Blatt erscheint mittig, nicht bildschirmfüllend verzerrt | | |

---

## TC-012: Ohne Netz

**Priority:** Medium
**Preconditions:** Als **V** angemeldet, Einladungsliste offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Flugmodus ein, nach unten ziehen zum Aktualisieren | Ein Ladefehler mit Wiederholmöglichkeit | | |
| 2 | Eine Einladung erstellen | Fehlermeldung **im Blatt**; die Eingaben bleiben stehen | | |
| 3 | Flugmodus aus, «Erstellen» erneut | Die Einladung entsteht | | |
| 4 | Liste zählen | **Eine** neue Einladung, nicht zwei | | |
| 5 | Flugmodus ein, eine Einladung zurückziehen | Toast **oben** mit einer Fehlermeldung, Kennzeichen bleibt «Gültig» | | |

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

Der Desktop-Browser bleibt in der Matrix: Das Wischen an einer Listenzeile und
der Rückfall von «Teilen» auf «Link kopieren» verhalten sich dort anders als
auf dem Telefon.

---

## Summary

| Test Case | Titel | Priority | Result |
| --------- | ----- | -------- | ------ |
| TC-001 | Einladung mit Vorbelegung erstellen | High | |
| TC-002 | Geltungsbereich, Rolle und Grenzen setzen | High | |
| TC-003 | Rolle Vorstand verlangt eine Bestätigung | High | |
| TC-004 | Ablaufdatum ist Pflicht | Medium | |
| TC-005 | Teilen und Kopieren | High | |
| TC-006 | Einladung widerrufen | High | |
| TC-007 | Ohne Vorstandsrolle nicht sichtbar | High | |
| TC-008 | Serverseitige Prüfung | High | |
| TC-009 | Codes sind nicht erratbar | Medium | |
| TC-010 | Vier Sprachen | High | |
| TC-011 | Darstellung auf dem Gerät | Medium | |
| TC-012 | Ohne Netz | Medium | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

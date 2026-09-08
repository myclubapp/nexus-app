# Manual Test Plan: UC-008 — Profil und Datenschutz-Optionen pflegen

**Use Case:** [UC-008](../use_cases/UC-008-profil-und-datenschutz-pflegen.md)
**Geltungsbereich:** Anzeigename, Kontaktangaben, Sichtbarkeit je Angabe, Ranglisten-Teilnahme, Sprache
**Anforderungen:** FR-018, FR-019, FR-020, FR-110
**Regeln:** BR-028 bis BR-031
**Erstellt:** 2026-09-09

## Vorbereitung

- **P1** — ein Mitglied mit Punktebuchungen in Verein **A**.
- **P2** — ein zweites Mitglied im selben Verein **A**.
- **P3** — ein Mitglied in einem **anderen** Verein **B**.
- **P1** gehört zusätzlich Verein **B** an (für TC-005).
- Migration `0013_profile_privacy.sql` ist eingespielt.
- Ein Werkzeug für HTTP-Aufrufe für TC-004.

---

## TC-001: Profil öffnen und Anzeigenamen ändern (Schritt 1–3, BR-031)

**Priority:** High
**Preconditions:** Als **P1** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Profil» öffnen | Die oberste Zeile zeigt Namen und Eintrittsdatum und ist antippbar | | |
| 2 | Die Zeile antippen | Ein Blatt «Profil bearbeiten» öffnet sich | | |
| 3 | Die Felder ablesen | Anzeigename, E-Mail, Telefonnummer – mit den gespeicherten Werten | | |
| 4 | Den Anzeigenamen leeren | «Speichern» wird ausgegraut (BR-031) | | |
| 5 | Ein Zeichen eingeben | Bleibt ausgegraut | | |
| 6 | «Anna Muster-Neu» eingeben und speichern | Blatt schliesst sich, Toast **oben** «Gespeichert» | | |
| 7 | Profil ansehen | Der neue Name steht in der obersten Zeile | | |
| 8 | Rangliste und Mitgliederliste öffnen | Überall der neue Name | | |

---

## TC-002: Sichtbarkeit je Angabe setzen (Schritt 4, FR-019)

**Priority:** High
**Preconditions:** Als **P1** angemeldet, Blatt offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Abschnitt «Kontaktangaben» ansehen | **Je Angabe ein eigener Schalter**, direkt unter dem Feld | | |
| 2 | Die Fussnote lesen | Sie sagt, dass Verborgenes gar nicht erst ausgeliefert wird, und dass die Entscheide je Verein gelten | | |
| 3 | E-Mail eintragen, Schalter **ein** | — | | |
| 4 | Telefonnummer eintragen, Schalter **aus** | — | | |
| 5 | Speichern | Toast «Gespeichert» | | |
| 6 | Blatt erneut öffnen | Beide Werte stehen da, die Schalter in der gesetzten Stellung | | |

---

## TC-003: Was ein anderes Mitglied sieht (BR-030)

**Priority:** High
**Preconditions:** TC-002 abgeschlossen. Als **P2** angemeldet, im selben Verein **A**.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Das Vereinsverzeichnis öffnen, **P1** ansehen | Die **freigegebene E-Mail** ist sichtbar | | |
| 2 | Nach der Telefonnummer suchen | **Nicht vorhanden** – nicht ausgegraut, nicht leer, sondern gar nicht da | | |
| 3 | Als **P1** den Schalter für die E-Mail **aus**schalten und speichern | — | | |
| 4 | Als **P2** neu laden | Auch die E-Mail ist verschwunden | | |
| 5 | Als **P1** den Telefon-Schalter **ein**schalten | — | | |
| 6 | Als **P2** neu laden | Die Nummer erscheint | | |
| 7 | Als **P1** das eigene Profil ansehen | Die eigene Nummer ist **immer** sichtbar, egal wie der Schalter steht | | |

---

## TC-004: Die Sperre hängt am Server, nicht am UI (BR-030, C-011)

**Priority:** High
**Preconditions:** **P1** hat die Telefonnummer verborgen. Zugangs-Token von **P2**.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Mit dem Token von **P2** `GET /rest/v1/club_directory?select=*` | Die Zeile von **P1** kommt mit `phone: null` – die Nummer steht **nicht** in der Antwort | | |
| 2 | Mit dem Token von **P2** `GET /rest/v1/member_contacts?select=*` | **Leere Liste** – die Tabelle selbst ist für andere gesperrt | | |
| 3 | Mit dem Token von **P2** `POST /rest/v1/rpc/update_my_profile` mit der `member_id` von **P1** | Fehler «Nur die Person selbst pflegt ihr Profil» | | |
| 4 | Mit dem Token von **P3** (anderer Verein) `GET /rest/v1/club_directory` | **Keine** Zeile aus Verein **A** (NFR-011) | | |
| 5 | Ohne Anmeldung `GET /rest/v1/club_directory` | Abgewiesen | | |

---

## TC-005: Entscheide gelten je Verein (A3, BR-028)

**Priority:** High
**Preconditions:** **P1** gehört Verein **A** und Verein **B** an.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | In Verein **A** die Telefonnummer freigeben | — | | |
| 2 | Auf Verein **B** wechseln, Profil öffnen | Der Schalter für die Nummer steht dort **unabhängig** – die Freigabe aus **A** gilt nicht | | |
| 3 | In **B** die Nummer verbergen und speichern | — | | |
| 4 | Zurück auf **A** wechseln | Dort ist sie weiterhin freigegeben | | |
| 5 | Auch den Anzeigenamen in **B** anders setzen | Beide Vereine zeigen je ihren Namen | | |

---

## TC-006: Ranglisten-Teilnahme (A1, FR-020, BR-029)

**Priority:** High
**Preconditions:** Als **P1** angemeldet, mit Punktebuchungen in der laufenden Saison.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Rangliste öffnen | **P1** erscheint mit seinem Punktestand | | |
| 2 | Profil → Schalter «In Ranglisten erscheinen» **aus** | Toast «Gespeichert» | | |
| 3 | Rangliste öffnen | **P1** erscheint **nicht** mehr; oben steht der Hinweis dazu | | |
| 4 | Als **P2** die Rangliste öffnen | **P1** fehlt auch dort | | |
| 5 | Als **P1** das Dashboard öffnen | Der eigene Punktestand ist **unverändert** sichtbar (BR-029) | | |
| 6 | Einen neuen Punkt sammeln (z.B. Check-in) | Die Buchung entsteht weiterhin | | |
| 7 | Schalter wieder **ein** | **P1** erscheint wieder in der Rangliste, mit allen Punkten | | |

---

## TC-007: Sprache wechseln (A2, FR-110)

**Priority:** High
**Preconditions:** Als **P1** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Im Profil auf Französisch wechseln | Die Oberfläche stellt **sofort** um, ohne Neuladen | | |
| 2 | Das Profil-Blatt öffnen | Alle Beschriftungen und die Fussnote französisch | | |
| 3 | Auf Italienisch und Englisch wiederholen | Wie oben, nichts abgeschnitten (C-007) | | |
| 4 | App neu starten | Die gewählte Sprache steht noch | | |
| 5 | **Bekannte Abweichung:** die Meldung bei leerem Namen aus der Datenbank | Immer deutsch | | |

---

## TC-008: Darstellung und Netz

**Priority:** Medium
**Preconditions:** Als **P1** angemeldet, auf jedem Gerät der Matrix.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Blatt auf dem kleinsten Gerät öffnen | Alle Felder und Schalter erreichbar | | |
| 2 | Ins Telefonfeld tippen | Die Tastatur zeigt das **Zifferblatt** | | |
| 3 | Ins E-Mail-Feld tippen | Die Tastatur zeigt das E-Mail-Layout | | |
| 4 | Bei eingeblendeter Tastatur | «Speichern» bleibt in der Kopfzeile erreichbar | | |
| 5 | Im Dunkelmodus | Schalterstellungen erkennbar | | |
| 6 | Flugmodus ein, speichern | Fehlermeldung **im Blatt**; die Eingaben bleiben stehen | | |
| 7 | Flugmodus aus, erneut speichern | Geht durch; die Angabe ist **einmal** angekommen | | |
| 8 | Mit Bedienhilfen durch das Blatt gehen | Jeder Schalter nennt, worauf er sich bezieht (NFR-027) | | |

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
| TC-001 | Profil öffnen und Anzeigenamen ändern | High | |
| TC-002 | Sichtbarkeit je Angabe setzen | High | |
| TC-003 | Was ein anderes Mitglied sieht | High | |
| TC-004 | Die Sperre hängt am Server | High | |
| TC-005 | Entscheide gelten je Verein | High | |
| TC-006 | Ranglisten-Teilnahme | High | |
| TC-007 | Sprache wechseln | High | |
| TC-008 | Darstellung und Netz | Medium | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

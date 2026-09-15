# Manual Test Plan: UC-004 — Beitritts-Anfrage stellen und entscheiden

**Use Case:** [UC-004](../use_cases/UC-004-beitritts-anfrage-entscheiden.md)
**Geltungsbereich:** Anfrage stellen, Liste offener Anfragen, Aufnehmen, Ablehnen, Zurückziehen
**Anforderungen:** FR-009, FR-010, FR-078, FR-196
**Regeln:** BR-013 bis BR-016, BR-258
**Erstellt:** 2026-09-08

## Vorbereitung

- Ein Verein mit mindestens einem Team und dem Kurznamen, den `clubs.slug` trägt.
- **Der Verein lässt offene Anfragen zu** (Vereinseinstellungen → «Beitritt» →
  «Offene Anfragen zulassen»). Seit `0101` ist das voreingestellt **aus**, und
  ohne diese Freigabe ist jeder Schritt dieses Plans erwartungsgemäss abgewiesen
  (BR-258). Wie sich der abgeschaltete Zustand verhält, prüft TC-003 in
  [uc-051](uc-051-verein-einrichten.md).
- **V** — ein Konto mit Rolle Vorstand in diesem Verein.
- **M** — ein Konto mit Rolle Mitglied im selben Verein.
- **G1**, **G2** — zwei Konten **ohne** Mitgliedschaft.
- Die Migrationen `0010_join_requests.sql` und `0101_public_join_requests.sql` sind eingespielt.

---

## TC-001: Anfrage stellen (FR-009)

**Priority:** High
**Preconditions:** Als **G1** angemeldet, keiner Mitgliedschaft zugehörig.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Onboarding öffnen | Drei Wege: «Verein gründen», «Ich habe eine Einladung», «Anfrage» | | |
| 2 | Auf «Anfrage» wechseln | Ein Feld «Kurzname des Vereins» und der Hinweis, dass es kein Verzeichnis gibt | | |
| 3 | Ein Zeichen eingeben | «Verein suchen» bleibt ausgegraut | | |
| 4 | Einen erfundenen Kurznamen eingeben, suchen | «Zu diesem Kurznamen gibt es keinen Verein.» | | |
| 5 | Den echten Kurznamen **in Grossbuchstaben** eingeben, suchen | Der Verein wird gefunden – die Schreibweise spielt keine Rolle | | |
| 6 | Den Vereinsnamen prüfen | Er stimmt mit dem echten Verein überein | | |
| 7 | «Anfrage senden» | Die Ansicht wechselt auf «Deine Anfrage läuft» mit dem Vereinsnamen | | |
| 8 | Als **V** anmelden, Profil öffnen | Bei «Beitritts-Anfragen» steht ein rotes Zeichen mit der Zahl 1 | | |

---

## TC-002: Kurzname aus einem Link

**Priority:** Medium
**Preconditions:** Als **G2** angemeldet, Weg «Anfrage» offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine ganze Adresse einfügen, z.B. `https://app.myclub.ch/tv-musterhausen` | Suche findet den Verein – das letzte Segment zählt | | |
| 2 | Den Kurznamen **mit Leerzeichen** statt Bindestrichen eingeben | Wird ebenfalls gefunden | | |
| 3 | Einen Kurznamen mit Umlaut eingeben | Wird gefunden oder sauber abgewiesen, **ohne** Absturz | | |

---

## TC-003: Anfrage aufnehmen (Hauptablauf)

**Priority:** High
**Preconditions:** Als **V** angemeldet. Eine offene Anfrage von **G1** aus TC-001.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Profil → «Beitritts-Anfragen» | Die Liste zeigt die Anfrage mit Geltungsbereich und Zeitpunkt | | |
| 2 | Die Anfrage antippen | Ein Blatt mit Zeitpunkt, Rolle und Team öffnet sich | | |
| 3 | Vorbelegung der Rolle prüfen | **«Mitglied»** ist vorgewählt (BR-015) | | |
| 4 | Rollen-Auswahl öffnen | Nur Mitglied, Trainer:in, Vorstand – **kein** superadmin | | |
| 5 | Rolle «Trainer:in» und ein Team wählen | Auswahl übernommen | | |
| 6 | «Aufnehmen» | Blatt schliesst sich, Toast **oben** «Person aufgenommen» | | |
| 7 | Die Liste ansehen | Die Anfrage ist verschwunden, das Zeichen im Profil ist weg | | |
| 8 | Mitgliederverwaltung öffnen | **G1** steht als Trainer:in im gewählten Team | | |
| 9 | Als **G1** anmelden | Die App führt ins Dashboard des Vereins, nicht mehr ins Onboarding | | |

---

## TC-004: Anfrage ablehnen (A1, BR-016)

**Priority:** High
**Preconditions:** Als **V** angemeldet. Eine offene Anfrage von **G2**.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Anfrage öffnen | Das Blatt zeigt oben «Aufnehmen», unten «Ablehnen» – die beiden sind klar getrennt | | |
| 2 | Den Hinweis unter «Ablehnen» lesen | Er nennt, dass die Person eine neutrale Nachricht erhält und keine Begründung gespeichert wird | | |
| 3 | Ob ein Begründungsfeld erscheint | **Keines** – eine Begründung ist nicht verpflichtend und wird nicht gespeichert (BR-016) | | |
| 4 | «Ablehnen» antippen | Blatt schliesst sich, Toast «Anfrage abgelehnt» | | |
| 5 | Mitgliederverwaltung prüfen | **G2** ist **kein** Mitglied geworden | | |
| 6 | In der Datenbank die Anfrage ansehen | Status `rejected`, `decided_by` und `decided_at` gefüllt (BR-014) | | |
| 7 | Als **G2** anmelden, Weg «Anfrage» öffnen | Es läuft keine Anfrage mehr; eine neue lässt sich stellen | | |

---

## TC-005: Anfrage zurückziehen (A3)

**Priority:** Medium
**Preconditions:** Als **G2** angemeldet, mit einer offenen Anfrage.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Weg «Anfrage» öffnen | «Deine Anfrage läuft» mit dem Vereinsnamen | | |
| 2 | «Anfrage zurückziehen» | Die Ansicht wechselt zurück auf die Kurznamen-Suche | | |
| 3 | Als **V** die Liste öffnen | Die Anfrage ist **nicht** mehr in der Liste offener Anfragen | | |
| 4 | Als **G2** erneut eine Anfrage stellen | Geht durch – eine zurückgezogene Anfrage blockiert nicht | | |

---

## TC-006: Nur der Vorstand entscheidet (BR-013, C-011)

**Priority:** High
**Preconditions:** Eine offene Anfrage. Zugangs-Token von **M** (Mitglied).

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** das Profil öffnen | **Kein** Eintrag «Beitritts-Anfragen» | | |
| 2 | `/tabs/profile/requests` direkt aufrufen | Hinweis, dass das dem Vorstand vorbehalten ist – **keine** Liste | | |
| 3 | Mit dem Token von **M** `POST /rest/v1/rpc/decide_join_request` mit gültiger Anfrage-ID | Fehler «Nur der Vorstand entscheidet über Beitritts-Anfragen» | | |
| 4 | Mit dem Token von **M** `GET /rest/v1/join_requests` | Nur die **eigenen** Anfragen, keine fremden (NFR-011) | | |
| 5 | Ohne Anmeldung `POST /rest/v1/rpc/request_join` | Abgewiesen – die Funktion ist für `anon` gesperrt (NFR-013) | | |
| 6 | Ohne Anmeldung `POST /rest/v1/rpc/notify` | Abgewiesen – `notify()` ist eine interne Routine | | |

---

## TC-007: Zwei Vorstände entscheiden gleichzeitig

**Priority:** Medium
**Preconditions:** Zwei Vorstandskonten auf zwei Geräten, eine offene Anfrage.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf beiden Geräten die Anfrage öffnen | Beide sehen dasselbe Blatt | | |
| 2 | Auf Gerät A «Aufnehmen» | Person wird aufgenommen | | |
| 3 | Auf Gerät B «Ablehnen» | Der zweite Entscheid kippt den ersten **nicht**; die Person bleibt Mitglied | | |
| 4 | Nachrichten der aufgenommenen Person zählen | **Eine** Nachricht, nicht zwei | | |

---

## TC-008: Wer schon Mitglied ist (A2)

**Priority:** Medium
**Preconditions:** Als **G1** angemeldet und bereits Mitglied (aus TC-003).

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Onboarding über «Weiteren Verein gründen» öffnen, Weg «Anfrage» | Kurznamen des **eigenen** Vereins eingeben und suchen | | |
| 2 | «Anfrage senden» | Meldung «Du gehörst diesem Verein bereits an» | | |
| 3 | Mitgliedschaft prüfen | Rolle und Team unverändert | | |

---

## TC-009: Vier Sprachen

**Priority:** High
**Preconditions:** Eine offene Anfrage, Konten in beiden Rollen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als Gast auf Französisch den Weg «Anfrage» durchgehen | Alle Texte französisch, auch «Verein nicht gefunden» | | |
| 2 | Als Vorstand auf Französisch entscheiden | Liste, Blatt und beide Toasts französisch | | |
| 3 | «Angefragt am {{date}}» prüfen | Das Datum steht im Satz, im Schweizer Format | | |
| 4 | Auf Italienisch und Englisch wiederholen | Wie oben, nichts abgeschnitten (C-007) | | |
| 5 | Die Nachricht an die aufgenommene Person ansehen | **Bekannte Abweichung:** Der Text kommt aus der Datenbank und ist immer deutsch | | |

---

## TC-010: Darstellung und Netz

**Priority:** Medium
**Preconditions:** Als Vorstand angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Liste ohne Anfragen öffnen | Erklärender leerer Zustand, keine leere Fläche | | |
| 2 | Liste mit Anfragen scrollen | Der grosse Titel klappt in die Kopfzeile zusammen | | |
| 3 | Im Dunkelmodus ansehen | Zahl-Zeichen und Texte lesbar | | |
| 4 | Auf dem kleinsten Gerät der Matrix | Das Blatt zeigt Rolle, Team und beide Knöpfe ohne Scrollen | | |
| 5 | Flugmodus ein, entscheiden | Toast **oben** mit Fehlermeldung; die Anfrage bleibt offen | | |
| 6 | Flugmodus aus, erneut entscheiden | Geht durch; **eine** Mitgliedschaft, nicht zwei | | |

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
| TC-001 | Anfrage stellen | High | |
| TC-002 | Kurzname aus einem Link | Medium | |
| TC-003 | Anfrage aufnehmen | High | |
| TC-004 | Anfrage ablehnen | High | |
| TC-005 | Anfrage zurückziehen | Medium | |
| TC-006 | Nur der Vorstand entscheidet | High | |
| TC-007 | Zwei Vorstände gleichzeitig | Medium | |
| TC-008 | Wer schon Mitglied ist | Medium | |
| TC-009 | Vier Sprachen | High | |
| TC-010 | Darstellung und Netz | Medium | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

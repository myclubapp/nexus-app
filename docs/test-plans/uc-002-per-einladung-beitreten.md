# Manual Test Plan: UC-002 — Per Einladung beitreten

**Use Case:** [UC-002](../use_cases/UC-002-per-einladung-beitreten.md)
**Geltungsbereich:** Einladungslink öffnen, Vorschau, Anmeldung dazwischen, Beitritt
**Anforderungen:** FR-008, FR-003, FR-011
**Regeln:** BR-005 bis BR-008
**Erstellt:** 2026-09-08

## Vorbereitung

- Ein Verein mit mindestens einem Team und einem Vorstandskonto.
- Aus UC-003 vorbereitet, jeweils der Link **und** der QR-Code:
  - **E1** gültig, Geltungsbereich Verein, Rolle Mitglied, unbegrenzt
  - **E2** gültig, Geltungsbereich Team «Aktive», Rolle Mitglied
  - **E3** abgelaufen (Ablaufdatum in der Vergangenheit)
  - **E4** ausgeschöpft (max. 1 Einlösung, bereits verbraucht)
  - **E5** zurückgezogen
- Ein Gastkonto **ohne** Mitgliedschaft und mit Zugriff aufs Postfach.
- Migrationen bis `0009_invites.sql` eingespielt — `preview_invite` und die
  Spalte `revoked_at` stammen daraus.

---

## TC-001: Beitritt über den Link, angemeldet

**Priority:** High
**Preconditions:** Gastkonto ist angemeldet, gehört noch keinem Verein an. Link **E1** liegt vor.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Link E1 auf dem Testgerät öffnen | Die Einladungsseite erscheint | | |
| 2 | Angaben ablesen | Vereinsname und Rolle «Mitglied» stehen da; kein Team (BR-005) | | |
| 3 | Feld «Dein Anzeigename» ansehen | Leer, «Beitreten» ist ausgegraut | | |
| 4 | Ein Zeichen eingeben | «Beitreten» bleibt ausgegraut (mindestens zwei Zeichen) | | |
| 5 | «Alex Muster» eingeben | «Beitreten» wird aktiv | | |
| 6 | «Beitreten» antippen | Spinner, danach das Dashboard des Vereins | | |
| 7 | Begrüssung ablesen | Der eingegebene Anzeigename steht dort | | |
| 8 | Stoppuhr ab Schritt 1 | **Unter 60 Sekunden** (BR-007, NFR-024) | | |
| 9 | Als Vorstand die Mitgliederliste öffnen | Die Person steht mit Rolle «Mitglied» darin | | |
| 10 | Als Vorstand die Einladung öffnen | Der Zähler ist um eins gestiegen | | |

---

## TC-002: Beitritt über den QR-Code

**Priority:** High
**Preconditions:** Wie TC-001, mit einem zweiten Gastkonto. Der Vorstand zeigt den QR-Code von E1 auf einem zweiten Gerät.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | QR-Code mit der **Systemkamera** scannen | Eine Benachrichtigung mit dem Link erscheint | | |
| 2 | Benachrichtigung antippen | Auf einem Gerät **mit** App: die App öffnet die Einladungsseite | | |
| 3 | Dasselbe auf einem Gerät **ohne** App | Der Browser öffnet dieselbe Seite (A3 in UC-005) | | |
| 4 | Beitreten wie in TC-001 | Beitritt geht durch | | |

---

## TC-003: Anmeldung mitten im Beitritt (A4 aus UC-005)

**Priority:** High
**Preconditions:** Auf dem Testgerät ist **niemand** angemeldet. Link E1 liegt vor.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Link E1 öffnen | Die App leitet auf den Anmeldebildschirm weiter | | |
| 2 | E-Mail eingeben, «Anmeldelink senden» | Hinweis, dass die E-Mail unterwegs ist | | |
| 3 | Im Postfach den Link antippen | Die App öffnet sich und meldet an | | |
| 4 | Wohin die App führt | **Zurück auf die Einladungsseite**, nicht aufs Dashboard | | |
| 5 | Anzeigenamen eingeben, beitreten | Beitritt geht durch, Dashboard erscheint | | |
| 6 | App schliessen und neu öffnen | Dashboard, **nicht** wieder die Einladungsseite (der Code gilt einmal) | | |

---

## TC-004: Abgelaufene Einladung (A1)

**Priority:** High
**Preconditions:** Angemeldetes Gastkonto ohne Mitgliedschaft. Link **E3**.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Link E3 öffnen | Meldung «Diese Einladung ist abgelaufen» | | |
| 2 | Ob der Verein genannt wird | Der Vereinsname steht da, damit klar ist, worum es ging | | |
| 3 | Ob ein Beitrittsfeld erscheint | **Kein** Anzeigename-Feld, **kein** «Beitreten» | | |
| 4 | Den angebotenen Weg antippen | «Beitritts-Anfrage stellen» führt weiter (UC-004) | | |
| 5 | Als Vorstand die Mitgliederliste prüfen | Keine neue Mitgliedschaft entstanden | | |

---

## TC-005: Ausgeschöpfte und zurückgezogene Einladung (A2, BR-012)

**Priority:** High
**Preconditions:** Angemeldetes Gastkonto ohne Mitgliedschaft.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Link **E4** öffnen | «Diese Einladung wurde bereits vollständig genutzt» | | |
| 2 | Link **E5** öffnen | «Diese Einladung wurde zurückgezogen» | | |
| 3 | Einen erfundenen Code öffnen, z.B. `/invite/abcdef` | «Diese Einladung gibt es nicht» – dieselbe Bauform, kein Hinweis darauf, welche Codes existieren | | |
| 4 | Nach jedem der drei Fälle die Mitgliederliste prüfen | Keine Mitgliedschaft entstanden | | |
| 5 | Bei E5 als Vorstand die früher eingelösten Mitgliedschaften prüfen | Sie bestehen weiter – der Widerruf wirkt nur nach vorne (BR-012) | | |

---

## TC-006: Bereits Mitglied (A3, BR-008)

**Priority:** High
**Preconditions:** Ein Konto, das dem Verein bereits als **Trainer:in** angehört. Link E1 vergibt die Rolle «Mitglied».

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Link E1 mit diesem Konto öffnen | Die Einladungsseite erscheint | | |
| 2 | Was angezeigt wird | Hinweis «Du gehörst diesem Verein bereits an», **kein** Anzeigename-Feld | | |
| 3 | «Beitreten» antippen | Die App wechselt in den Verein, Dashboard erscheint | | |
| 4 | Als Vorstand die Rolle prüfen | Weiterhin **Trainer:in** – nicht auf «Mitglied» heruntergestuft (BR-008) | | |
| 5 | Anzeigenamen prüfen | Unverändert | | |

---

## TC-007: Team-Einladung ergänzt die Zuordnung (A4)

**Priority:** High
**Preconditions:** Ein Konto, das dem Verein angehört, aber **nicht** dem Team «Aktive». Link **E2**.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Link E2 öffnen | Vereinsname **und** Team «Aktive» werden angezeigt | | |
| 2 | «Beitreten» antippen | Dashboard erscheint | | |
| 3 | Als Vorstand das Mitglied öffnen | Es ist nun dem Team «Aktive» zugeordnet | | |
| 4 | Rolle prüfen | Unverändert (BR-008) | | |
| 5 | Als Mitglied Tab «Agenda» | Termine des Teams «Aktive» erscheinen | | |
| 6 | Link E2 ein zweites Mal öffnen und beitreten | Keine doppelte Team-Zuordnung, kein Fehler | | |

---

## TC-008: Zwei Personen auf die letzte freie Einlösung

**Priority:** Medium
**Preconditions:** Eine Einladung mit **max. 1 Einlösung**, zwei angemeldete Gastkonten auf zwei Geräten.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf beiden Geräten den Link öffnen | Beide sehen die gültige Einladung | | |
| 2 | Auf beiden Namen eingeben | — | | |
| 3 | So gleichzeitig wie möglich «Beitreten» antippen | **Genau eine** Person tritt bei; die andere erhält eine Fehlermeldung | | |
| 4 | Mitgliederliste prüfen | Genau eine neue Mitgliedschaft, Zähler steht auf 1 von 1 | | |

---

## TC-009: Vier Sprachen

**Priority:** High
**Preconditions:** Gastkonto ohne Mitgliedschaft, Links E1 und E3.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch stellen, E1 öffnen | Alle Texte französisch, auch «Rolle» und der Rollenname | | |
| 2 | E3 öffnen | Die Ablauf-Meldung ist französisch | | |
| 3 | Auf Italienisch wiederholen | Wie oben | | |
| 4 | Auf Englisch wiederholen | Wie oben | | |
| 5 | Auf jeder Sprache das Anzeigename-Feld prüfen | Beschriftung und Hinweistext übersetzt, nichts abgeschnitten (C-007) | | |

---

## TC-010: Deep Link und Darstellung auf dem Gerät

**Priority:** High
**Preconditions:** Die native App ist installiert (C-012).

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Link E1 aus einer E-Mail heraus antippen | Die **App** öffnet die Einladungsseite, nicht der Browser | | |
| 2 | Dasselbe aus einer Nachrichten-App | Wie oben | | |
| 3 | App vorher ganz schliessen, dann Link antippen | Die App startet und landet auf der Einladungsseite | | |
| 4 | App deinstallieren, Link antippen | Der Browser zeigt dieselbe Seite | | |
| 5 | Seite im Dunkelmodus ansehen | Alle Angaben lesbar | | |
| 6 | Auf dem kleinsten Gerät der Matrix | Angaben, Namensfeld und Knopf ohne Scrollen sichtbar | | |

---

## TC-011: Ohne Netz

**Priority:** Medium
**Preconditions:** Angemeldetes Gastkonto, Link E1.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Flugmodus ein, Link E1 öffnen | Ein Ladefehler mit Wiederholmöglichkeit, **keine** weisse Fläche | | |
| 2 | Flugmodus aus, «Nochmals versuchen» | Die Einladung erscheint | | |
| 3 | Namen eingeben, Flugmodus ein, «Beitreten» | Fehlermeldung; der eingegebene Name bleibt stehen | | |
| 4 | Flugmodus aus, «Beitreten» | Beitritt geht durch | | |
| 5 | Mitgliederliste prüfen | **Eine** Mitgliedschaft, nicht zwei | | |

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
| TC-001 | Beitritt über den Link, angemeldet | High | |
| TC-002 | Beitritt über den QR-Code | High | |
| TC-003 | Anmeldung mitten im Beitritt | High | |
| TC-004 | Abgelaufene Einladung | High | |
| TC-005 | Ausgeschöpfte und zurückgezogene Einladung | High | |
| TC-006 | Bereits Mitglied | High | |
| TC-007 | Team-Einladung ergänzt die Zuordnung | High | |
| TC-008 | Zwei Personen auf die letzte freie Einlösung | Medium | |
| TC-009 | Vier Sprachen | High | |
| TC-010 | Deep Link und Darstellung auf dem Gerät | High | |
| TC-011 | Ohne Netz | Medium | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

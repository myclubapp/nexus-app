# Manual Test Plan: UC-005 — Anmelden

**Use Case:** [UC-005](../use_cases/UC-005-anmelden.md)
**Geltungsbereich:** Anmeldelink, Passwort-Anmeldung, Deep-Link-Rücksprung, Sitzung
**Anforderungen:** FR-001, FR-002, FR-003, FR-110
**Regeln:** BR-017, BR-018, BR-019
**Erstellt:** 2026-09-08

## Vorbereitung

- Eine App-Instanz mit gültiger `.env.local`.
- **K1** — ein Konto, das nur über Anmeldelinks existiert (kein Passwort gesetzt).
- **K2** — ein Konto mit gesetztem Passwort (über TC-006 herstellbar).
- Zugriff auf beide Postfächer auf dem Testgerät.
- In den Supabase-Auth-Einstellungen sind
  `http://localhost:5173/auth/callback` und `ch.myclub.nexus://auth/callback`
  als Redirect-URLs eingetragen (C-012). **Fehlen sie, scheitert jeder Test.**

---

## TC-001: Anmeldung über den Link

**Priority:** High
**Preconditions:** Niemand ist angemeldet. Konto **K1**.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | App öffnen | Anmeldebildschirm mit Umschalter «Anmeldelink / Passwort», «Anmeldelink» aktiv | | |
| 2 | Ohne Eingabe «Anmeldelink senden» | Meldung «Bitte gib eine gültige E-Mail-Adresse ein.» | | |
| 3 | «keine-adresse» eingeben und senden | Dieselbe Meldung; es wird nichts versendet | | |
| 4 | Adresse von K1 eingeben, senden | Knopf zeigt kurz einen Spinner, danach der Hinweis mit der Adresse | | |
| 5 | Postfach öffnen | Eine E-Mail mit Anmeldelink ist da | | |
| 6 | Link auf demselben Gerät antippen | Die App öffnet sich und meldet an | | |
| 7 | Wohin die App führt | Bei bestehender Mitgliedschaft: Dashboard des zuletzt genutzten Vereins. Ohne Mitgliedschaft: Onboarding | | |
| 8 | App ganz schliessen und neu öffnen | Weiterhin angemeldet, kein erneuter Anmeldebildschirm (BR-019) | | |

---

## TC-002: Abgelaufener oder bereits verwendeter Link (A1)

**Priority:** High
**Preconditions:** Ein bereits einmal verwendeter Anmeldelink aus TC-001.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Abmelden | Anmeldebildschirm erscheint | | |
| 2 | **Denselben** Link aus TC-001 nochmals antippen | Die App landet auf dem Anmeldebildschirm | | |
| 3 | Was dort steht | «Dieser Anmeldelink ist abgelaufen oder wurde bereits verwendet. Fordere einen neuen an.» – **keine leere Seite und keine englische Meldung** (BR-018) | | |
| 4 | Adresse eingeben und neuen Link anfordern | Der Versand geht durch, die alte Meldung verschwindet | | |
| 5 | Neuen Link antippen | Anmeldung geht durch | | |
| 6 | Im Browser die Adresse `…/auth/callback?error=access_denied&error_description=Email+link+is+invalid+or+has+expired` öffnen | Dieselbe deutsche Meldung auf dem Anmeldebildschirm | | |
| 7 | Seite neu laden | Die Meldung ist **weg** – sie wiederholt sich nicht bei jedem Neuladen | | |

---

## TC-003: Anmeldung mit Passwort (A2)

**Priority:** High
**Preconditions:** Konto **K2** mit gesetztem Passwort. Niemand ist angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf «Passwort» umschalten | Ein zweites Feld «Passwort» erscheint, der Knopf heisst «Anmelden» | | |
| 2 | Erklärtext lesen | Er nennt den Zweck; darunter steht der Hinweis auf den Link-Weg | | |
| 3 | Adresse ohne Passwort, «Anmelden» | «Bitte gib dein Passwort ein.» | | |
| 4 | Adresse und **falsches** Passwort | «E-Mail-Adresse oder Passwort stimmen nicht.» – auf Deutsch, nicht englisch | | |
| 5 | Adresse von **K1** (ohne Passwort) und irgendein Passwort | Dieselbe Meldung wie in Schritt 4 – der Bildschirm verrät nicht, welche Adressen ein Konto haben | | |
| 6 | Adresse und **richtiges** Passwort von K2 | Anmeldung geht durch, Dashboard erscheint | | |
| 7 | Auf «Anmeldelink» zurückschalten | Das Passwortfeld verschwindet, eine stehende Fehlermeldung wird gelöscht | | |
| 8 | Passwortverwaltung des Geräts prüfen | Das System bietet an, das Passwort zu speichern (`autocomplete`) | | |

---

## TC-004: Kein Login über Drittanbieter (BR-017, C-003)

**Priority:** High
**Preconditions:** Anmeldebildschirm offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den ganzen Bildschirm ansehen | **Kein** Knopf «Mit Google», «Mit Apple» oder «Mit Facebook» | | |
| 2 | In allen vier Sprachen wiederholen | Ebenso | | |
| 3 | Netzwerkverkehr beim Anmelden mitlesen | Keine Anfrage an eine Google- oder Apple-Domain | | |

---

## TC-005: Deep Link auf dem Gerät (FR-003, C-012)

**Priority:** High
**Preconditions:** Die native App ist installiert.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Anmeldelink anfordern, App **im Hintergrund** lassen | — | | |
| 2 | Link im Postfach antippen | Die **App** kommt in den Vordergrund und meldet an, nicht der Browser | | |
| 3 | App ganz beenden, neuen Link antippen | Die App startet und meldet an | | |
| 4 | Auf einem Gerät **ohne** App den Link antippen | Der Browser öffnet die Web-App und meldet dort an (A3) | | |
| 5 | Auf iOS und auf Android wiederholen | Gleiches Ergebnis auf beiden | | |

---

## TC-006: Passwort setzen (macht A2 überhaupt erreichbar)

**Priority:** High
**Preconditions:** Als **K1** angemeldet (nur Link, kein Passwort).

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Profil» öffnen | Eintrag «Passwort setzen» ist sichtbar | | |
| 2 | Eintrag antippen | Ein Blatt mit einem Passwortfeld öffnet sich | | |
| 3 | Sieben Zeichen eingeben | «Speichern» bleibt ausgegraut | | |
| 4 | Acht Zeichen eingeben | «Speichern» wird aktiv | | |
| 5 | Ein bekanntes Passwort wie «passwort1234» eingeben und speichern | «Dieses Passwort steht in bekannten Datenlecks …» – Supabase prüft gegen HaveIBeenPwned, und die Meldung sagt das auch | | |
| 6 | Ein eigenes, langes Passwort eingeben und speichern | Blatt schliesst sich, Toast **oben** «Passwort gespeichert» | | |
| 7 | Abmelden und mit diesem Passwort anmelden | Anmeldung geht durch (damit ist K1 zu K2 geworden) | | |
| 8 | Erneut «Passwort setzen» und ein anderes vergeben | Auch das Ändern funktioniert | | |

---

## TC-007: Rücksprung aus dem Einladungsfluss (A4)

**Priority:** High
**Preconditions:** Niemand ist angemeldet. Ein gültiger Einladungslink (UC-003).

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Einladungslink öffnen | Die App leitet auf den Anmeldebildschirm | | |
| 2 | Anmeldelink anfordern und antippen | Anmeldung geht durch | | |
| 3 | Wohin die App führt | **Zurück auf die Einladung**, nicht aufs Dashboard | | |
| 4 | Beitreten und die App neu starten | Dashboard – nicht wieder die Einladung | | |

---

## TC-008: Vier Sprachen

**Priority:** High
**Preconditions:** Anmeldebildschirm offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprachwahl unten öffnen | Deutsch, Französisch, Italienisch, Englisch stehen zur Wahl (FR-110) | | |
| 2 | Auf Französisch wechseln | Der Bildschirm stellt **sofort** um, ohne Neuladen | | |
| 3 | Eine ungültige Adresse absenden | Die Meldung ist französisch | | |
| 4 | Einen abgelaufenen Link öffnen (wie TC-002 Schritt 6) | Die Meldung ist französisch | | |
| 5 | Auf Italienisch und Englisch wiederholen | Wie oben, nichts abgeschnitten (C-007) | | |
| 6 | App neu starten | Die zuletzt gewählte Sprache steht noch | | |

---

## TC-009: Darstellung und Bedienung auf dem Gerät

**Priority:** Medium
**Preconditions:** Anmeldebildschirm auf jedem Gerät der Matrix.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf dem kleinsten Gerät ansehen | Titel, Umschalter, Feld und Knopf ohne Scrollen sichtbar | | |
| 2 | Ins E-Mail-Feld tippen | Die Tastatur zeigt das **E-Mail-Layout** (`@` direkt erreichbar) | | |
| 3 | Bei eingeblendeter Tastatur | Der Knopf bleibt erreichbar, nichts wird verdeckt | | |
| 4 | Ins Passwortfeld tippen | Die Eingabe ist verdeckt | | |
| 5 | Im Dunkelmodus ansehen | Alle Texte lesbar, Fehlermeldung erkennbar rot | | |
| 6 | Mit Bedienhilfen (VoiceOver / TalkBack) durchgehen | Felder sind beschriftet, die Fehlermeldung wird vorgelesen (NFR-027) | | |
| 7 | Auf dem Tablet im Querformat | Das Formular bleibt mittig und schmal, nicht bildschirmbreit | | |

---

## TC-010: Ohne Netz

**Priority:** Medium
**Preconditions:** Anmeldebildschirm offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Flugmodus ein, Anmeldelink anfordern | Eine Fehlermeldung erscheint, **keine** stehende Ladeanzeige | | |
| 2 | Die eingegebene Adresse prüfen | Sie steht noch im Feld | | |
| 3 | Flugmodus aus, erneut senden | Der Versand geht durch | | |
| 4 | Angemeldet, Flugmodus ein, App neu starten | Die App startet angemeldet und zeigt Ladefehler in den Ansichten – **kein** Rückwurf auf den Anmeldebildschirm (BR-019) | | |

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
| TC-001 | Anmeldung über den Link | High | |
| TC-002 | Abgelaufener oder verwendeter Link | High | |
| TC-003 | Anmeldung mit Passwort | High | |
| TC-004 | Kein Login über Drittanbieter | High | |
| TC-005 | Deep Link auf dem Gerät | High | |
| TC-006 | Passwort setzen | High | |
| TC-007 | Rücksprung aus dem Einladungsfluss | High | |
| TC-008 | Vier Sprachen | High | |
| TC-009 | Darstellung und Bedienung auf dem Gerät | Medium | |
| TC-010 | Ohne Netz | Medium | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

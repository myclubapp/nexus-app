# Manual Test Plan: UC-006 — Konto löschen

**Use Case:** [UC-006](../use_cases/UC-006-konto-loeschen.md)
**Geltungsbereich:** Erklärung, Sperre für den einzigen Vorstand, Löschung, Abmeldung
**Anforderungen:** FR-012
**Regeln:** BR-020 bis BR-023 · **Rahmen:** C-023
**Erstellt:** 2026-09-08

> **Achtung:** Diese Tests löschen Konten unwiderruflich. Nur mit eigens
> angelegten Testkonten auf einer Testinstanz ausführen, nie mit einem Konto,
> an dem echte Vereinsdaten hängen.

## Vorbereitung

- **T1** — einziges Vorstandskonto eines Vereins **A**.
- **T2** — zweites Vorstandskonto desselben Vereins **A**.
- **T3** — einfaches Mitglied in Verein **A**, mit **mindestens einer
  Punktebuchung** (über UC-021 oder direkt in der Datenbank angelegt).
- Migration `0011_account_deletion.sql` ist eingespielt.
- Zugriff auf die Datenbank, um die Nachbedingungen zu prüfen.

---

## TC-001: Die Löschung ist aus der App erreichbar (C-023, BR-020)

**Priority:** High
**Preconditions:** Als **T3** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Profil» öffnen und ans Ende scrollen | «Konto löschen» ist sichtbar, in Warnfarbe | | |
| 2 | Zählen, wie viele Schritte vom Start dorthin führen | Zwei: Tab «Profil», dann der Eintrag – **kein** Umweg über Support oder Website | | |
| 3 | Den Eintrag antippen | Ein Blatt «Konto löschen» öffnet sich | | |

---

## TC-002: Die Erklärung ist vollständig (Schritt 2)

**Priority:** High
**Preconditions:** Das Löschblatt ist offen (als **T3**).

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Einleitungstext lesen | Er sagt, dass die Angaben aus **allen** Vereinen verschwinden und der Vorgang **nicht rückgängig** zu machen ist | | |
| 2 | Abschnitt «Das wird gelöscht» | Vier Punkte: Anzeigename und Bild, Kontaktangaben und Anmeldekonto, Benachrichtigungen und Push, private Notizen und Check-in-Antworten | | |
| 3 | Abschnitt «Das bleibt bestehen» | Nennt die Punktebuchungen **ohne Bezug zur Person** (BR-021) | | |
| 4 | Die Fussnote darunter lesen | Sie erklärt, warum: damit keine Rangliste einer vergangenen Saison kippt | | |
| 5 | Prüfen, ob irgendwo eine Zahlung, ein Abo oder ein Support-Hinweis auftaucht | Nichts davon – die Erklärung bleibt bei den Daten | | |

---

## TC-003: Abbruch (A2)

**Priority:** High
**Preconditions:** Das Löschblatt ist offen (als **T3**).

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Abbrechen» oben links antippen | Das Blatt schliesst sich | | |
| 2 | Profil ansehen | Alles unverändert, weiterhin angemeldet | | |
| 3 | Blatt erneut öffnen, das Bestätigungswort tippen, dann das Blatt **nach unten wischen** | Das Blatt schliesst sich, **nichts** wird gelöscht | | |
| 4 | Blatt erneut öffnen | Das Bestätigungsfeld ist **leer** – das getippte Wort bleibt nicht stehen | | |

---

## TC-004: Ohne ausdrückliche Bestätigung geht nichts (Schritt 3)

**Priority:** High
**Preconditions:** Das Löschblatt ist offen (als **T3**).

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Löschknopf ansehen, ohne etwas zu tippen | Er ist **ausgegraut** | | |
| 2 | Ein falsches Wort tippen, z.B. «löschen bitte» | Der Knopf bleibt ausgegraut | | |
| 3 | Das Wort **klein** tippen: `löschen` | Der Knopf wird aktiv – Gross- und Kleinschreibung spielt keine Rolle | | |
| 4 | Das Wort mit Leerzeichen davor und danach tippen | Der Knopf bleibt aktiv | | |
| 5 | Auf Französisch wechseln und das deutsche Wort tippen | Der Knopf bleibt ausgegraut – es gilt das Wort der jeweiligen Sprache | | |

---

## TC-005: Der einzige Vorstand wird aufgehalten (A1, BR-023)

**Priority:** High
**Preconditions:** Als **T1** angemeldet – einzige Person mit Vorstandsrechten in Verein **A**.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Löschblatt öffnen | Abschnitt «Das geht so noch nicht» erscheint | | |
| 2 | Den Verein ablesen | Der Name von Verein **A** steht dort | | |
| 3 | Ob ein Löschknopf erscheint | **Keiner** – der zerstörerische Weg ist gar nicht erst da | | |
| 4 | Den Hinweis lesen | Er nennt den Ausweg: zuerst jemand anderen zum Vorstand bestimmen oder den Verein löschen | | |
| 5 | **T2** zum Vorstand machen (UC-007), dann das Blatt neu öffnen | Die Sperre ist weg, der Löschweg erscheint | | |
| 6 | Mit einem HTTP-Aufruf `POST /rest/v1/rpc/delete_my_account` als **T1** **vor** Schritt 5 | Fehler mit dem Vereinsnamen – die Sperre hängt am Server, nicht am UI (C-011) | | |

---

## TC-006: Die Löschung selbst (Schritte 4–7, BR-021, BR-022)

**Priority:** High
**Preconditions:** Als **T3** angemeldet, mit mindestens einer Punktebuchung. Die `member_id` und die Anzahl Buchungen vorher notieren.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Vorher in der Datenbank zählen | Buchungen von **T3**, Benachrichtigungen, Push-Registrierungen notieren | | |
| 2 | Löschblatt öffnen, Wort tippen, «Konto endgültig löschen» | Knopf zeigt einen Spinner | | |
| 3 | Was danach geschieht | Die App **meldet ab** und zeigt den Anmeldebildschirm (Schritt 7) | | |
| 4 | Mit den alten Zugangsdaten anmelden | Geht nicht mehr – das Konto existiert nicht | | |
| 5 | `select count(*) from auth.users where id = <T3>` | **0** | | |
| 6 | `select count(*) from point_transactions where member_id = <alte member_id>` | **Unverändert** gegenüber Schritt 1 (BR-021) | | |
| 7 | Die Mitgliedschaft ansehen | `display_name` = «Ehemaliges Mitglied», `user_id` ist **null**, `status` = `left`, `leaderboard_opt_in` = false | | |
| 8 | Benachrichtigungen und Push-Registrierungen von **T3** | **0** – gelöscht, nicht anonymisiert (BR-022) | | |
| 9 | Als **T2** die Mitgliederliste öffnen | «Ehemaliges Mitglied» erscheint als ausgetreten; **kein** Name, **kein** Bild | | |
| 10 | Als **T2** die Rangliste der Saison öffnen | Die Person taucht **nicht** auf, die Punktesumme des Vereins ist unverändert | | |

---

## TC-007: Vier Sprachen

**Priority:** High
**Preconditions:** Ein weiteres Testkonto mit zweitem Vorstand im Verein.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf Französisch das Löschblatt öffnen | Alle Abschnitte französisch | | |
| 2 | Das Bestätigungswort ablesen | Es ist das französische Wort, nicht das deutsche | | |
| 3 | Auf Italienisch und Englisch wiederholen | Wie oben, nichts abgeschnitten (C-007) | | |
| 4 | Die Sperre für den einzigen Vorstand in jeder Sprache | Der Vereinsname steht im Satz, nicht als Platzhalter | | |

---

## TC-008: Darstellung, Netz und Store-Prüfung

**Priority:** High
**Preconditions:** Als Testkonto auf jedem Gerät der Matrix.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Blatt auf dem kleinsten Gerät öffnen | Erklärung, Feld und Knopf erreichbar; das Blatt lässt sich scrollen | | |
| 2 | Im Dunkelmodus ansehen | Der Löschknopf bleibt als Warnung erkennbar | | |
| 3 | Flugmodus ein, löschen | Fehlermeldung **im Blatt**; das Konto besteht weiter (Failure Postcondition) | | |
| 4 | Flugmodus aus, erneut löschen | Geht durch | | |
| 5 | Auf iOS aus der installierten App | Der ganze Weg funktioniert ohne Browser | | |
| 6 | Auf Android aus der installierten App | Ebenso | | |
| 7 | Den Weg für die Store-Prüfung notieren | «Profil → Konto löschen» – diese Angabe verlangen beide Stores | | |

---

## Test Matrix

| Device / Browser | OS / Version | Screen Size | Status |
| ---------------- | ------------ | ----------- | ------ |
| Chrome (latest) | macOS / Windows | Desktop | |
| Safari (latest) | macOS | Desktop | |
| Safari | iOS 17+ | iPhone SE (klein) | |
| Safari | iOS 17+ | iPhone 15 | |
| Chrome | Android 14+ | Pixel 7 | |
| Safari | iPadOS 17+ | iPad Gen 11 | |

---

## Summary

| Test Case | Titel | Priority | Result |
| --------- | ----- | -------- | ------ |
| TC-001 | Die Löschung ist aus der App erreichbar | High | |
| TC-002 | Die Erklärung ist vollständig | High | |
| TC-003 | Abbruch | High | |
| TC-004 | Ohne ausdrückliche Bestätigung geht nichts | High | |
| TC-005 | Der einzige Vorstand wird aufgehalten | High | |
| TC-006 | Die Löschung selbst | High | |
| TC-007 | Vier Sprachen | High | |
| TC-008 | Darstellung, Netz und Store-Prüfung | High | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

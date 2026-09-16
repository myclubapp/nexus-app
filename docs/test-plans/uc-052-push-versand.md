# Manual Test Plan: UC-052 — Push-Meldungen zustellen

**Use Case:** [UC-052](../use_cases/UC-052-push-versand.md)
**Geltungsbereich:** Anmeldung des Geräts im Browser, in der PWA und in der iOS-App; Versand über Web Push und APNs; Antippen führt an die richtige Stelle; vergessene Geräte
**Anforderungen:** FR-199, FR-079, C-004, NFR-015
**Regeln:** BR-117, BR-118, BR-267, BR-268, BR-269
**Erstellt:** 2026-09-15

## Vorbereitung

- **M** — Mitglied mit Konto. **V** — Vorstand, um Meldungen auszulösen (Termin
  absagen erzeugt eine Meldung der Kategorie `event`).
- Migration `0104_push_transport.sql` ist eingespielt (`supabase db push`).
- `supabase functions deploy push-send` ist gelaufen.
- Secrets gesetzt: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
  Für alles mit iOS zusätzlich `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_P8`.
- `VITE_VAPID_PUBLIC_KEY` steht in `.env.local` bzw. in den Vercel-Einstellungen
  und die App wurde **danach** gebaut – der Schlüssel wird beim Bauen eingesetzt.
- Geräte: ein Rechner mit Chrome oder Firefox, ein iPhone mit der App aus Xcode
  **oder** TestFlight, und – für TC-003 – dasselbe iPhone mit der PWA vom
  Startbildschirm.

**Ohne APNs-Schlüssel** sind TC-004 bis TC-006 nicht durchführbar. Das ist kein
Fehlschlag: TC-009 prüft ausdrücklich, dass Meldungen an iPhones dann **warten**
statt verloren zu gehen.

---

## TC-001: Das Gerät im Browser anmelden (A1)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** am Rechner anmelden, Profil → Benachrichtigungen öffnen | Abschnitt «Registrierte Geräte», darin «Dieses Gerät anmelden» | | |
| 2 | Auf «Dieses Gerät anmelden» tippen | Der Browser fragt nach der Erlaubnis | | |
| 3 | Erlauben | Toast «Angemeldet. Ab jetzt erreichen dich Meldungen auch auf diesem Gerät.»; die Liste zeigt «Browser» mit dem heutigen Datum | | |
| 4 | Seite neu laden | Das Gerät steht weiterhin **einmal** in der Liste | | |
| 5 | Noch einmal auf «Dieses Gerät anmelden» tippen | Kein zweiter Eintrag – dasselbe Abonnement erneuert seine Zeile | | |

---

## TC-002: Eine Meldung kommt an und führt an die richtige Stelle

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Browser-Tab der App **schliessen**, Browser offen lassen | – | | |
| 2 | Als **V** (anderes Gerät) einen Termin absagen, an dem **M** teilnimmt | – | | |
| 3 | Höchstens eine Minute warten | Eine Systemmeldung erscheint, mit Titel und Text der Absage | | |
| 4 | Die Meldung antippen | Die App öffnet sich **am abgesagten Termin**, nicht auf dem Dashboard | | |
| 5 | Als **M** die Inbox öffnen | Dieselbe Meldung steht dort (BR-117) | | |
| 6 | Auf das Symbol der Meldung achten | Das App-Symbol, nicht das des Browsers | | |

---

## TC-003: Dieselbe App als PWA auf dem iPhone

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die App in Safari öffnen, «Zum Home-Bildschirm» | Das Symbol liegt auf dem Startbildschirm | | |
| 2 | Die App **vom Startbildschirm** starten und anmelden | – | | |
| 3 | Benachrichtigungen → «Dieses Gerät anmelden» | iOS fragt nach der Erlaubnis (nur in der installierten PWA, ab iOS 16.4) | | |
| 4 | Erlauben, App schliessen, als **V** eine Meldung auslösen | Die Meldung erscheint auf dem Sperrbildschirm | | |
| 5 | Dieselbe Seite **in Safari** (nicht installiert) öffnen | Statt des Knopfs steht dort, dass dieses Gerät keine Push-Meldungen empfangen kann | | |

---

## TC-004: Die iOS-App meldet sich an (der Apple-Weg)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `npm run ios`, in Xcode auf ein **echtes Gerät** bauen (der Simulator liefert kein verlässliches Token) | Die App startet | | |
| 2 | Anmelden, Benachrichtigungen → «Dieses Gerät anmelden» | iOS fragt nach der Erlaubnis | | |
| 3 | Erlauben | Toast «Angemeldet …»; die Liste zeigt «iPhone oder iPad» | | |
| 4 | **Wenn nichts geschieht und der Knopf 15 Sekunden lang lädt:** in Xcode prüfen, ob `AppDelegate.swift` die beiden `didRegisterForRemoteNotifications…`-Methoden enthält | Sie müssen da sein – ohne sie kommt nie ein Token | | |
| 5 | In der Datenbank `select platform, environment from push_tokens` | Eine Zeile `ios_apns`, `environment` zunächst **leer** | | |

---

## TC-005: Der Versand findet das richtige Apple-Tor (A4)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** eine Meldung für **M** auslösen, eine Minute warten | Die Meldung kommt auf dem iPhone an | | |
| 2 | `select environment from push_tokens where platform = 'ios_apns'` | Steht jetzt auf `sandbox` (Build aus Xcode) bzw. `production` (TestFlight) | | |
| 3 | Zweite Meldung auslösen | Kommt an; in den Function-Logs steht nur **ein** Aufruf an Apple statt zwei | | |
| 4 | Die App über TestFlight installieren und neu anmelden | Eine **zweite** Zeile in `push_tokens` mit `production` | | |

---

## TC-006: Antippen in der App (A1 des Empfangs)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | App vollständig beenden | – | | |
| 2 | Meldung zu einem Termin auslösen, antippen | Die App startet und zeigt **den Termin** | | |
| 3 | App im Hintergrund lassen, zweite Meldung antippen | Die App kommt nach vorn und wechselt zur genannten Stelle | | |
| 4 | App **offen** lassen, dritte Meldung auslösen | Die Meldung erscheint als Banner (`presentationOptions`) | | |

---

## TC-007: Abgewählte Kategorien kommen nicht (BR-118)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Benachrichtigungen → «Punkte» ausschalten | Toast «Gespeichert» | | |
| 2 | Eine Punktebuchung für **M** auslösen (z.B. Check-in bestätigen) | **Kein** Push | | |
| 3 | Inbox öffnen | Die Meldung steht dort (BR-117) | | |
| 4 | «Punkte» wieder einschalten, neue Buchung auslösen | Push kommt an | | |

---

## TC-008: Stille Zeit (A5)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Benachrichtigungen → stille Zeit auf ein Fenster setzen, das **jetzt** läuft | Gespeichert | | |
| 2 | Eine Meldung auslösen | Kein Push | | |
| 3 | Inbox prüfen | Die Meldung steht dort, sofort | | |
| 4 | Die stille Zeit beenden (Fenster verschieben), eine Minute warten | Die **aufgeschobene** Meldung kommt nach | | |

---

## TC-009: Ein Kanal ohne Schlüssel verbrennt nichts (BR-267, A6)

**Priority:** High — **der Fall, wegen dessen es den Plattform-Filter gibt**

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Nur mit dem iPhone angemeldet sein, **ohne** gesetzte APNs-Secrets | – | | |
| 2 | Fünf Meldungen auslösen, zehn Minuten warten | Kein Push (erwartet), Inbox vollständig | | |
| 3 | `select push_attempts, push_error from notifications order by created_at desc limit 5` | `push_attempts` steht auf **0** – nicht auf 5 | | |
| 4 | APNs-Secrets setzen, `push-send` neu deployen, eine Minute warten | Die **fünf wartenden** Meldungen kommen an | | |

---

## TC-010: Ein vergessenes Gerät (A2, BR-269)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Im Browser die Benachrichtigungen für die Seite in den **Browsereinstellungen** zurücksetzen (Abonnement widerrufen) | – | | |
| 2 | Eine Meldung auslösen, eine Minute warten | Kein Push auf diesem Gerät | | |
| 3 | Profil → Benachrichtigungen | Das Gerät ist aus der Liste **verschwunden** | | |
| 4 | Dasselbe für die iOS-App: App löschen, Meldung auslösen, Liste prüfen | Die Zeile verschwindet ebenfalls | | |

---

## TC-011: Mehrere Geräte (BR-268)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Browser **und** iPhone anmelden | Zwei Zeilen in der Liste | | |
| 2 | Eine Meldung auslösen | Sie kommt auf **beiden** an | | |
| 3 | Ein Gerät abmelden («Abmelden»), erneut auslösen | Nur noch auf dem verbliebenen | | |
| 4 | Alle Geräte abmelden, Meldung auslösen, Inbox prüfen | Kein Push, Inbox vollständig | | |
| 5 | Ein Gerät neu anmelden, eine Minute warten | **Kein** Nachschub der alten Meldungen – nur die nächste kommt (BR-268) | | |

---

## TC-012: Die Probemeldung für die Inbetriebnahme

**Priority:** Low

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `push-send` mit `{"mode":"test","userId":"<eigene id>"}` und dem `service_role`-Schlüssel aufrufen | Antwort nennt `devices` und `delivered` | | |
| 2 | Auf den Geräten schauen | «nexus: Probemeldung» kommt an | | |
| 3 | Inbox prüfen | **Leer geblieben** – die Probe fasst `notifications` nicht an | | |
| 4 | Denselben Aufruf mit dem **anon**-Schlüssel | 401, keine Zustellung | | |

# Manual Test Plan: UC-023 — Fürsorge-Hinweis triagieren

**Use Case:** [UC-023](../use_cases/UC-023-fuersorge-hinweis-triagieren.md)
**Geltungsbereich:** Erzeugung, Zustellung, Reichweite, Triage, Verfall, Deckel, Opt-out, Kennzahlen
**Anforderungen:** FR-060 bis FR-069, FR-075
**Regeln:** BR-094 bis BR-099
**Erstellt:** 2026-09-09
**Ergänzt:** 2026-09-11 (Nachtrag `0056`: die Kennzahlen und `succession_gap`)

## Vorbereitung

- **V** — Vorstand. **TA** — Trainer:in von Team A. **TB** — Trainer:in von Team B.
- **Q** — Mitglied in Team A, hat auf die letzten vier Termine nicht geantwortet.
- **O** — Mitglied in Team A mit **abbestellten** individuellen Hinweisen
  (`health_opt_out`).
- **B** — Mitglied in Team B.
- Vier vergangene, ausgeschriebene Vereinstermine.
- Migration `0040_health_signals.sql` ist eingespielt.
- Auslösen von Hand: `select public.detect_health_signals();`

---

## TC-001: Hinweis entsteht und wird zugestellt (Schritt 1–3)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `detect_health_signals()` auslösen | Hinweise entstehen | | |
| 2 | Als **TA** die Inbox öffnen | Nachricht «Ein Hinweis wartet auf dich» | | |
| 3 | Den Text der Nachricht lesen | Er nennt **keinen Namen** – eine Push landet auf einem Sperrbildschirm (NFR-022) | | |
| 4 | Als **Q** (betroffen) die Inbox prüfen | **Keine** Nachricht (BR-098) | | |
| 5 | Als **TA** Profil → «Vereins-Gesundheit» öffnen | Die Liste zeigt Mitglied, Anlass, Ampel und Status (Schritt 3) | | |
| 6 | Die Formulierungen lesen | Kein «inaktiv», kein «säumig», kein Vorwurf (BR-095) | | |
| 7 | Die Sortierung prüfen | Dringend zuoberst, dann nach Alter – **nicht** nach Person gruppiert | | |
| 8 | `detect_health_signals()` erneut auslösen | Es entstehen **keine** Doppel | | |

---

## TC-002: Reichweite (BR-096)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **TA** die Liste ansehen | Nur Hinweise zu Team A | | |
| 2 | Als **TB** die Liste ansehen | Der Hinweis zu **Q** fehlt | | |
| 3 | Als **Q** (Mitglied) Profil öffnen | Der Eintrag «Vereins-Gesundheit» fehlt ganz | | |
| 4 | Als **Q** `health_signals` direkt abfragen | Leer | | |
| 5 | Als **V** die Liste ansehen | Alle Hinweise des Vereins | | |
| 6 | Als **TB** `set_signal_status` für den Hinweis zu **Q** aufrufen | Abgewiesen | | |

---

## TC-003: Triage (Schritte 4–9, FR-064, BR-099)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **TA** einen Hinweis öffnen | Anlass, Ampel, zwei bis drei Gesprächsimpulse (Schritt 5, FR-065) | | |
| 2 | Nach einer Historie oder Anwesenheitsliste suchen | Es gibt keine – der Hinweis ist keine Akte | | |
| 3 | «Kontakt aufgenommen» antippen | Ein Tipp genügt (BR-099), Toast bestätigt | | |
| 4 | Als **V** denselben Hinweis öffnen | «TA kümmert sich» steht da (Schritt 7) | | |
| 5 | Als **V** übernehmen wollen | Es wird nicht angeboten; direkt aufgerufen kommt «Jemand anderes kümmert sich» (A1) | | |
| 6 | Als **V** trotzdem «Erledigt» wählen | Geht – sonst bliebe ein Hinweis liegen, wenn **TA** ausfällt | | |
| 7 | Die Liste bei **TA** neu laden | Der Hinweis ist weg (Schritt 9) | | |
| 8 | In der Datenbank nach dem Hinweis suchen | Physisch gelöscht, keine Zeile mit Status «gelöst» (BR-097) | | |

---

## TC-004: Opt-out und Deckel (A4, A5)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Prüfen, ob zu **O** ein Hinweis entstand | **Keiner** (A5) | | |
| 2 | Prüfen, ob **O** trotzdem in Aggregate einfliesst | Ja – nur anonym (NFR-022) | | |
| 3 | `clubs.settings.health.maxOpenPerTeam` auf **1** setzen, Hinweise löschen, neu erzeugen | Team A bekommt genau **einen** Hinweis (A4) | | |
| 4 | Diesen einen erledigen und erneut erzeugen | Jetzt entsteht der nächste | | |
| 5 | Die Einstellung entfernen | Es gilt wieder die Vorgabe fünf | | |

---

## TC-005: Verfall (A2, BR-097)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `expires_at` eines Hinweises in die Vergangenheit setzen | — | | |
| 2 | `expire_health_signals()` auslösen | Der Hinweis ist gelöscht | | |
| 3 | Nach einer Historie suchen | Es gibt keine – auch nicht über die Saison hinaus | | |

---

## TC-006: Vereinssignale (A3, FR-066, FR-067)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die letzte Verbindungs-Nachricht über 28 Tage zurücklegen und erzeugen | Signal «Kommunikationspause» | | |
| 2 | Drei Aufrufe und eine Verbindung in acht Wochen erzeugen | Signal «Mehr Aufrufe als Erzähltes» | | |
| 3 | Als **V** ein Vereinssignal öffnen | Statt Gesprächsimpulsen steht «Was können wir ändern?» (FR-066) | | |
| 4 | Die Fragen lesen | Sie fragen nach dem, was **wir** ändern – kein Schuldnarrativ (K5, BR-095) | | |
| 5 | Als **TA** die Liste ansehen | Vereinssignale fehlen – sie gehen an den Vorstand (A3) | | |

---

## TC-007: Keine automatischen Folgen (BR-094, BR-098)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Nach einem Signal die Punktehistorie des Mitglieds prüfen | Unverändert | | |
| 2 | Den Mitgliedsstatus prüfen | Unverändert | | |
| 3 | Prüfen, ob das Mitglied eine Nachricht bekam | Keine | | |
| 4 | Prüfen, welche Tabellen die Erzeugung liest | `attendance`, `events`, `club_message_log` – keine Nutzungs-, Lese- oder Standortdaten (BR-094) | | |

---

## TC-008: Die Vereins-Übersicht (FR-060)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** die Vereins-Gesundheit öffnen | Unter den Hinweisen stehen Mitglieder, Aktiv und Angekommen | | |
| 2 | Die Reihenfolge prüfen | Die offenen Hinweise stehen **oben** – die Triage bleibt in Reichweite (BR-099) | | |
| 3 | Den Fusstext lesen | Er sagt, was «aktiv» heisst, und nennt das Zeitfenster | | |
| 4 | Eine Absage erfassen und neu laden | Die absagende Person zählt als aktiv – wer absagt, ist da | | |
| 5 | Als **TA** dieselbe Seite öffnen | **Keine** Vereinszahlen – nur die Hinweise und die Teamzahlen (BR-096) | | |
| 6 | Als **TA** `club_health()` direkt aufrufen | Abgewiesen | | |
| 7 | Im ersten Vereinsjahr hinsehen | **Kein** Trendsatz – es gibt keine Vorsaison | | |
| 8 | Punkte in der Vorsaison anlegen und neu laden | Der Trend nennt die Differenz in Mitgliedern | | |

---

## TC-009: Die Teamzahlen und die Mindestgrösse (FR-061)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Ein Team mit sieben Mitgliedern und Terminen anlegen | Vorbereitung | | |
| 2 | Als dessen Trainer:in die Seite öffnen | Antwortquote und Beteiligung stehen da | | |
| 3 | Ein zweites Team mit drei Mitgliedern anlegen | Vorbereitung | | |
| 4 | Erneut hinsehen | Das kleine Team steht **nicht** da – auch nicht mit «–» oder «0 %» | | |
| 5 | Als **V** hinsehen | Auch für den Vorstand nicht: Die Schwelle schützt die Person, nicht die Rolle | | |
| 6 | Die Mindestgrösse in den Vereinseinstellungen auf 3 setzen | Das kleine Team erscheint | | |
| 7 | Als **TB** hinsehen | Nur das eigene Team (BR-096) | | |
| 8 | Ein Team ohne Termine prüfen | Quoten von 0 %, kein Absturz | | |

---

## TC-010: Verantwortungsverteilung (FR-068, K4)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Drei Helfereinsätze für **eine** Person und einen für eine zweite bestätigen | Vorbereitung | | |
| 2 | Als **V** die Seite öffnen | «2 von N tragen vier Fünftel» | | |
| 3 | Nach Namen suchen | **Keiner** – weder der Tragenden noch der anderen (BR-095) | | |
| 4 | Ein besuchtes Training buchen | Die Zahl ändert sich nicht – Teilnahme ist kein Einsatz | | |
| 5 | Bei starker Konzentration den Fusstext lesen | Er fragt nach der Ausschreibung, nicht nach den Säumigen | | |
| 6 | Am Saisonanfang ohne Einsätze hinsehen | Der Abschnitt fehlt ganz – «0 tragen alles» wäre falsch | | |
| 7 | Als Trainer:in aufrufen | Abgewiesen | | |

---

## TC-011: Nachfolge-Vorlauf und sein Signal (FR-069, FR-062, FR-067)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Ein Amt vakant lassen, eines seit fünf Jahren halten, eines seit einem halben Jahr | Vorbereitung | | |
| 2 | Als **V** die Seite öffnen | Zwei Ämter – das vakante zuoberst, das frische fehlt | | |
| 3 | Ein Amt antippen | Es führt in die Ämterliste | | |
| 4 | `select detect_succession_gaps();` aufrufen | Ein Signal `succession_gap`, Schwere `info` | | |
| 5 | Den Wortlaut lesen | Er fragt nach Entlastung, nicht nach Schuld (BR-095) | | |
| 6 | Die Inbox von **V** und **Q** prüfen | Nur der Vorstand wurde benachrichtigt (A3) | | |
| 7 | Den Aufruf wiederholen | Kein zweites Signal | | |
| 8 | Das Modul «Sitzungen» ausschalten und erneut aufrufen | Kein Signal – ohne Ämter nichts zu melden | | |
| 9 | Die Schwelle auf zwei Jahre senken | Das Amt seit einem halben Jahr bleibt draussen | | |

---

## TC-012: Der Definitionskatalog (FR-075)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **TA** die Seite ganz nach unten scrollen | «Wie wir rechnen» mit sieben Sätzen | | |
| 2 | Jeden Satz lesen | Jede Zahl der Seite ist damit erklärt | | |
| 3 | Eine Schwelle in `clubs.settings.health.thresholds` ändern | Der Satz nennt den neuen Wert | | |
| 4 | Dieselbe Kennzahl prüfen | Sie rechnet mit dem neuen Wert | | |
| 5 | Als Mitglied ohne Rolle aufrufen | Abgewiesen | | |

---

## Vier Sprachen

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch, Italienisch und Englisch stellen | Anlässe, Gesprächsimpulse und Handlungsfragen sind übersetzt – und tragen auch dort kein Urteil (BR-095) | | |
| 2 | Die Kennzahlen in jeder Sprache prüfen | Überschriften, Fusstexte und der Definitionskatalog sind übersetzt | | |
| 3 | Auf 320 px hinsehen | Die drei Kennzahlen brechen um, statt zu schrumpfen | | |

---

## Offen

- **FR-063 (rollenbasiertes Routing) bleibt offen.** Die Bereichsrolle
  «Sportchef:in» kennt `club_members.role` nicht; sie zu erfinden wäre eine
  Rollenreform. Das steht als offener Punkt 1 im Anforderungskatalog.
- **Die Schwellen sind nur über die Datenbank änderbar.** Der Katalog ist
  lesbar (FR-075), eine Oberfläche zum Ändern gibt es nicht – sie wäre die
  Einstellung, die K7 zufolge kein Verein beim Start braucht.
- **«Aktiv», «Aktivierung» und die Konzentrationsschwelle** sind Annahmen
  dieses Plans und mit den Stakeholdern zu bestätigen (offener Punkt 2).

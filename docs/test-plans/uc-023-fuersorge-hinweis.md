# Manual Test Plan: UC-023 — Fürsorge-Hinweis triagieren

**Use Case:** [UC-023](../use_cases/UC-023-fuersorge-hinweis-triagieren.md)
**Geltungsbereich:** Erzeugung, Zustellung, Reichweite, Triage, Verfall, Deckel, Opt-out
**Anforderungen:** FR-062 bis FR-067
**Regeln:** BR-094 bis BR-099
**Erstellt:** 2026-09-09

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

## Vier Sprachen

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch, Italienisch und Englisch stellen | Anlässe, Gesprächsimpulse und Handlungsfragen sind übersetzt – und tragen auch dort kein Urteil (BR-095) | | |

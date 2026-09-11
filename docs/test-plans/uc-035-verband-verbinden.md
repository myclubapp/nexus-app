# Manual Test Plan: UC-035 — Verband verbinden

**Use Case:** [UC-035](../use_cases/UC-035-verband-verbinden.md)
**Geltungsbereich:** Auswahl, Testaufruf, Tresor, Zustand, Ausfall, Trennen
**Anforderungen:** FR-120, FR-121
**Regeln:** BR-151 bis BR-155
**Erstellt:** 2026-09-11

## Vorbereitung

- **V** — Vorstand, **M** — Mitglied ohne Rolle.
- Migration `0058_federation.sql` ist eingespielt.
- Die Edge Function ist deployt: `supabase functions deploy sync-federation`.
  **Ohne sie schlägt jeder Testaufruf mit «Der Abgleichdienst antwortet nicht»
  fehl** – das ist der erwartete Zustand, nicht ein Fehler der App.
- Eine echte Vereinskennung bei Swiss Unihockey, etwa `463820` (Ad Astra
  Obwalden). `GET https://api-v2.swissunihockey.ch/api/clubs` listet alle
  Vereine mit ihrer Kennung.

---

## TC-001: Verbinden (Hauptablauf, Schritte 1–7)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** Vereinseinstellungen → «Verband verbinden» öffnen | Einleitung, Auswahl der Verbände, Feld für die Kennung | | |
| 2 | Die Verbandsliste aufklappen | Vier Verbände mit Anzeigenamen | | |
| 3 | Swiss Unihockey wählen | Kein Schlüsselfeld; stattdessen «Dieser Verband verlangt keinen Schlüssel» (A2) | | |
| 4 | Ohne Kennung auf «Prüfen und verbinden» | Der Knopf ist gesperrt, der Grund steht dabei | | |
| 5 | Die echte Vereinskennung eintragen und prüfen | Die Teams des Vereins erscheinen mit Namen und Liga | | |
| 6 | Den Abschnitt darunter lesen | Er sagt, dass Spiele erst mit der Verknüpfung entstehen (UC-039); «Zu den Teams» führt zur Teamseite | | |
| 7 | Den Zustand ansehen | «Noch nicht geprüft» in Grau, nicht in Gelb | | |
| 8 | Die Seite neu laden | Die Verbindung steht mit Verband, Zustand und «Noch kein Abgleich» | | |

---

## TC-002: Der Schlüssel verlässt den Server nicht (BR-153)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Verbindung **mit** Schlüssel anlegen (z. B. über `connect_federation()` mit Testwert) | Angelegt | | |
| 2 | `select * from federation_connections;` | In `api_key_secret` steht ein **Name**, nicht der Schlüssel | | |
| 3 | `select * from vault.decrypted_secrets where name = '<Name>';` | Dort steht er, verschlüsselt abgelegt | | |
| 4 | Als **V** die Seite öffnen und den Netzwerkverkehr ansehen | Der Schlüssel kommt in keiner Antwort vor | | |
| 5 | Als **V** `federation_credentials()` aufrufen | Abgewiesen | | |
| 6 | Als `anon` dasselbe | Abgewiesen | | |
| 7 | Den Schlüssel ersetzen und den Tresor zählen | **Ein** Eintrag, mit dem neuen Wert – keine Sammlung toter Schlüssel | | |

---

## TC-003: Ungültige Kennung (A1)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine erfundene Vereinskennung eintragen und prüfen | Die Meldung des Verbands steht wörtlich im Blatt | | |
| 2 | `select * from federation_connections;` | **Nichts** wurde gespeichert | | |
| 3 | Die Kennung korrigieren und erneut prüfen | Jetzt entsteht die Verbindung | | |
| 4 | Einen Verband ohne Schnittstelle wählen und prüfen | «Für diesen Verband besteht noch keine Schnittstelle»; nichts gespeichert | | |

---

## TC-004: Reichweite (NFR-011)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** ins Profil sehen | Kein Weg zu «Verband verbinden» | | |
| 2 | Als **M** `federation_connections` abfragen | Leer | | |
| 3 | Als **M** `connect_federation()` aufrufen | Abgewiesen | | |
| 4 | Als **V** eine Verbindung für einen **fremden** Verein anlegen | Abgewiesen | | |
| 5 | Als Trainer:in ohne Vorstandsrolle prüfen | Wie **M** | | |

---

## TC-005: Der Abgleich und sein Ausfall (A3, BR-155)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `select public.sync_federations();` ohne Vault-Einträge | Kein Fehler, eine Warnung im Log, kein Lauf | | |
| 2 | `project_url` und `service_role_key` im Tresor anlegen, erneut aufrufen | Der Lauf startet, der Zustand wird «Aktiv» | | |
| 3 | Den Zeitpunkt des letzten Abgleichs prüfen | Er steht an der Verbindung | | |
| 4 | Einen Fehlschlag melden (`report_federation_sync(..., false, 'Test')`) | Der Zustand bleibt **aktiv**, die Meldung steht dabei | | |
| 5 | `last_sync_at` fünf Tage zurücksetzen und erneut fehlschlagen lassen | Jetzt «Fehler», und der Vorstand hat eine Meldung in der Inbox | | |
| 6 | Noch einmal fehlschlagen lassen | **Keine** zweite Meldung | | |
| 7 | Die Inbox eines Mitglieds prüfen | Leer – das ist Verwaltung | | |
| 8 | Während des Ausfalls Agenda, Marktplatz und Punkte prüfen | Vollständig nutzbar (BR-155) | | |
| 9 | Die Kategorie «Anschlüsse» in den Benachrichtigungen abschalten und erneut fehlschlagen lassen | Die Inbox-Zeile entsteht, der Push-Vermerk fehlt (BR-117) | | |
| 10 | `select * from cron.job where jobname = 'federation-sync';` | Der Auftrag ist eingerichtet | | |

---

## TC-006: Trennen (A4)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Vor dem Trennen einen importierten Termin notieren | Vorbereitung | | |
| 2 | «Verbindung trennen» wählen | Rückfrage, die die Folge nennt | | |
| 3 | Abbrechen | Die Verbindung besteht weiter | | |
| 4 | Erneut wählen und bestätigen | Die Verbindung ist weg | | |
| 5 | Den Tresor prüfen | Der Schlüssel ist gelöscht | | |
| 6 | Den notierten Termin suchen | **Er ist noch da** – Vergangenheit gehört dem Verein | | |
| 7 | `sync_federations()` aufrufen | Für diesen Verein läuft nichts mehr | | |

---

## TC-007: Vier Sprachen und iOS

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Seite auf Französisch, Italienisch und Englisch öffnen | Alle Texte übersetzt; die Verbandsnamen bleiben Eigennamen | | |
| 2 | Die Zustände prüfen | «Aktiv», «Fehler», «Noch nicht geprüft» in jeder Sprache | | |
| 3 | Die Rückfrage beim Trennen prüfen | Übersetzt, mit «Abbrechen» links | | |
| 4 | Auf 320 px prüfen | Abzeichen und Text stehen nebeneinander, ohne zu überlaufen | | |
| 5 | Während der Prüfung hinsehen | Der Knopf sagt «Verbindung wird geprüft …» und ist gesperrt | | |

---

## Offen

- **Die Edge Function ist nicht deployt.** Ohne
  `supabase functions deploy sync-federation` meldet der Testaufruf, dass der
  Dienst nicht antwortet. **FR-121 bleibt deshalb `Partial`.**
- **Drei der vier Verbände haben keine offen dokumentierte Schnittstelle.**
  Ihre Verbindung lässt sich anlegen, bleibt aber `pending`, und der Lauf
  meldet «Für diesen Verband besteht noch keine Schnittstelle».
- **Verbandsnews** (Schritt 7) sind nicht gebaut. Sie sind eine zweite Quelle
  neben der Vereinswebsite und gehören zu deren Deduplikation (UC-038).
- **Spiele** entstehen erst mit UC-039 – so will es BR-152.

# Manual Test Plan: UC-018 — Aufgabe übernehmen und einreichen

**Use Case:** [UC-018](../use_cases/UC-018-aufgabe-uebernehmen.md)
**Geltungsbereich:** Detailansicht, Übernahme, Einreichung mit Nachweis, Rückgabe, Frist, Verteilungs-Transparenz
**Anforderungen:** FR-052, FR-053, FR-057
**Regeln:** BR-073 bis BR-076
**Erstellt:** 2026-09-09

## Vorbereitung

- **V** — Vorstand, **M1** und **M2** — Mitglieder desselben Vereins.
- Vier ausgeschriebene Aufgaben von **V** (UC-017):
  - **A1** «Allein», ein Platz, Frist in 10 Tagen, mit Beschreibung.
  - **A2** «Zu zweit», **zwei** Plätze.
  - **A3** «Überfällig», Frist **in der Vergangenheit**, bereits übernommen von **M2**.
  - **A4** «Drängt», Frist in **20 Stunden**, ein Platz.
- Migration `0035_task_submission.sql` ist eingespielt.

---

## TC-001: Übernehmen und einreichen (Hauptablauf)

**Priority:** High
**Preconditions:** Als **M1** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Marktplatz» öffnen | Die offenen Aufgaben stehen da, mit Titel, Warum, Kategorie, Frist und Punktwert (Schritt 2) | | |
| 2 | **A1** antippen | Ein Blatt öffnet sich; **Warum** steht zuoberst, darunter die vollständige Beschreibung (Schritt 3) | | |
| 3 | Die Eckdaten ansehen | Kategorie, Frist, Punktwert und «0 von 1 übernommen» | | |
| 4 | «Übernehmen» antippen | Toast «Übernommen»; die Aufgabe wandert nach «Von mir übernommen» (Schritt 5) | | |
| 5 | Den Punktestand im Profil prüfen | **Keine** Punkte – sie kommen erst mit der Bestätigung (BR-074) | | |
| 6 | **A1** erneut öffnen | Der Hauptknopf heisst jetzt «Erledigt melden» | | |
| 7 | Einen Link als Nachweis eintragen und melden | Toast «Gemeldet – die Punkte kommen mit der Bestätigung.» | | |
| 8 | Als **V** die Inbox öffnen | Nachricht «Aufgabe erledigt gemeldet» mit Titel und Name (Schritt 8) | | |
| 9 | Die Nachricht antippen | Sie führt in den Marktplatz zur Aufgabe | | |
| 10 | Als **M1** die Aufgabe erneut öffnen | «Gemeldet. Der Vorstand bestätigt sie.» – kein zweiter Melde-Knopf | | |

---

## TC-002: Bereits vergeben (A1, BR-073)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M2** den Marktplatz öffnen | **A1** steht **nicht** mehr im Angebot | | |
| 2 | Über die Inbox-Verlinkung direkt zu **A1** | Das Blatt sagt «Diese Aufgabe ist bereits vergeben.» | | |
| 3 | Prüfen, ob ein Übernehmen-Knopf bedienbar ist | Nein | | |

---

## TC-003: Mehrere Übernehmende (A2)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** **A2** übernehmen | Gelingt | | |
| 2 | Als **M2** den Marktplatz öffnen | **A2** steht **weiterhin** im Angebot, «1 von 2 übernommen» | | |
| 3 | Als **M2** ebenfalls übernehmen | Gelingt; danach ist **A2** für Dritte nicht mehr im Angebot | | |
| 4 | Als **M1** melden | Die Aufgabe bleibt bei «übernommen» – **M2** hat noch nicht gemeldet | | |
| 5 | Als **M2** melden | Erst jetzt gilt die Aufgabe als eingereicht | | |

---

## TC-004: Rückgabe (A3, BR-075)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** **A4** («Drängt») übernehmen und wieder öffnen | «Doch nicht» steht unten, mit dem Hinweis, dass es folgenlos bleibt | | |
| 2 | «Doch nicht» wählen | Toast «Zurückgegeben. Der Vorstand ist informiert, weil die Frist bald abläuft.» | | |
| 3 | Den Marktplatz ansehen | **A4** steht wieder unter «Drängt» und ist übernehmbar | | |
| 4 | Als **V** die Inbox prüfen | Nachricht «Aufgabe wieder offen» | | |
| 5 | Den eigenen Punktestand und das Profil prüfen | Kein Abzug, kein Vermerk über die Rückgabe (BR-075) | | |
| 6 | Eine Aufgabe **mit weiter Frist** übernehmen und zurückgeben | Toast ohne den Zusatz zur Frist; **V** erhält **keine** Nachricht | | |
| 7 | Eine bereits **bestätigte** Aufgabe zurückzugeben versuchen | Es gibt keinen Knopf dafür; direkt aufgerufen wird es abgewiesen | | |

---

## TC-005: Abgelaufene Frist (A4)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M2** die übernommene, überfällige **A3** öffnen | Der Hinweis «Die Frist ist verstrichen. Melden kannst du trotzdem» steht da | | |
| 2 | Melden | Gelingt – die Einreichung wird **nicht** verweigert | | |
| 3 | Prüfen, ob **A3** durch den Ablauf-Lauf verschwindet | Nein: Eine übernommene Aufgabe läuft nicht ab (UC-017 A4) | | |

---

## TC-006: Nachweis (A5)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine übernommene Aufgabe **ohne** Nachweis melden | Gelingt – der Nachweis ist freiwillig | | |
| 2 | «foto vom handy» als Nachweis eintragen | Der Melde-Knopf sperrt und erklärt, dass ein vollständiger Link erwartet wird | | |
| 3 | `https://` davorsetzen | Der Knopf wird wieder bedienbar | | |
| 4 | Nach dem Melden als **V** die Zuweisung prüfen | Der Link steht dort, ohne führende oder folgende Leerzeichen | | |

---

## TC-007: Verteilungs-Transparenz (FR-057, BR-076)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** den Marktplatz öffnen | Oben stehen zwei Kennzahlen: «Diese Saison übernommen» und «Offen im Marktplatz» | | |
| 2 | Eine Aufgabe übernehmen | Die erste Zahl steigt unmittelbar um eins | | |
| 3 | Sie zurückgeben | Die Zahl fällt wieder | | |
| 4 | Als **M2** dieselbe Ansicht prüfen | **M2** sieht **seine eigene** Zahl, nicht die von **M1** – keine Rangliste über Personen (NFR-022) | | |
| 5 | Den Saisonstart des Vereins verschieben, sodass die Übernahme in die Vorsaison fällt | Die Zahl geht auf 0 – dieselbe Saisonrechnung wie im Punkte-Ledger | | |

---

## Vier Sprachen

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch, Italienisch und Englisch stellen | Detailansicht, Nachweis-Hinweise, Rückgabe und Kennzahlen sind übersetzt, kein Schlüssel steht im Klartext | | |

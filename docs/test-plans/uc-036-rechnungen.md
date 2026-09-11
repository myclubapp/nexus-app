# Manual Test Plan: UC-036 — Rechnungen einsehen und Punkte bei pünktlicher Zahlung

**Use Case:** [UC-036](../use_cases/UC-036-rechnungen-einsehen.md)
**Geltungsbereich:** Spiegel, Punkte der Säule 6, Erinnerung, Überfälligkeit, Modul
**Anforderungen:** FR-116, FR-117, FR-118, FR-119
**Regeln:** BR-156 bis BR-159
**Erstellt:** 2026-09-11

## Vorbereitung

- **A**, **B** — Mitglieder, **V** — Vorstand.
- Migration `0054_invoice_mirror.sql` ist eingespielt, das Modul «Rechnungen»
  ist eingeschaltet.
- Gemeldet wird mit dem **Service-Schlüssel** (`service_role`), nicht als
  angemeldete Person.

> **Es gibt keinen Rechnungsdienst.** Geprüft wird die Seite, die in dieser
> Datenbank liegt: der Spiegel, die Meldestelle, die Punkte, die Erinnerung.
> Der QR-Einzahlungsschein entsteht **nicht** hier (BR-156) – in der
> bestehenden myclub-App erzeugt ihn das Backend mit `swissqrbill`.

---

## TC-001: Der Spiegel und nichts weiter (BR-156, FR-118)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Rechnung für **A** melden und als **A** «Meine Rechnungen» öffnen | Betrag, Fälligkeit und Stand | | |
| 2 | Nach Positionen, Zahlungsreferenz oder IBAN suchen | Nirgends – weder in der Ansicht noch in der Tabelle | | |
| 3 | `information_schema` für `invoice_refs` abfragen | Neun Spalten, keine Bankdaten | | |
| 4 | Eine Rechnung mit Detail-Link melden und die Zeile antippen | Sie führt in die Detailansicht des Dienstes | | |
| 5 | Eine Rechnung **ohne** Link melden | Die Zeile ist nicht antippbar, kein toter Pfeil | | |
| 6 | Denselben Datensatz ohne Link erneut melden | Der bestehende Link bleibt erhalten | | |
| 7 | Ohne Rechnungen die Seite öffnen | Erklärung **und** ein nächster Schritt (BR-165) | | |

---

## TC-002: Punkte bei pünktlicher Zahlung (FR-119, BR-157)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Punktestand von **A** notieren | Vorbereitung | | |
| 2 | Eine Rechnung als `paid` mit `paid_at` **am Fälligkeitstag** melden | 40 Punkte der Säule 6, genau eine Buchung | | |
| 3 | Die Inbox von **A** prüfen | «Danke fürs pünktliche Bezahlen» | | |
| 4 | Den Punkte-Verlauf öffnen | Die Buchung steht da, mit der Regel `invoice_on_time` | | |
| 5 | Die Rechnungsseite öffnen | An der Zeile steht, dass die Punkte gutgeschrieben sind | | |
| 6 | Dieselbe Rechnung erneut melden | **Keine** zweite Buchung (NFR-017) | | |
| 7 | Eine Zahlung einen Tag **nach** Fälligkeit melden | Status `paid`, **null** Punkte (A2) | | |
| 8 | Den Punktestand prüfen | Unverändert – kein Abzug (BR-158) | | |
| 9 | Am Mitglied nach einem Vermerk suchen | Keiner | | |
| 10 | Eine Zahlung eine Woche **vor** Fälligkeit melden | Punkte | | |

---

## TC-003: Melden darf nur der Dienst (NFR-012)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **A** `report_invoice()` aufrufen | Abgewiesen | | |
| 2 | Als **V** dasselbe versuchen | Ebenfalls abgewiesen | | |
| 3 | Prüfen, ob `anon` sie ausführen darf | Nein | | |
| 4 | Mit dem Service-Schlüssel melden | Geht durch | | |
| 5 | Eine Rechnung für ein Mitglied eines **fremden** Vereins melden | Abgewiesen | | |
| 6 | Einen unbekannten Status melden | Abgewiesen | | |
| 7 | `paid` ohne Zeitpunkt in die Tabelle schreiben | Vom Constraint abgewiesen | | |

> Schritt 1 ist der wichtigste Test dieses Use Cases: Könnte ein angemeldetes
> Konto eine Zahlung melden, wäre das der erste Weg in dieser App, auf dem sich
> jemand selbst Punkte gibt.

---

## TC-004: Reichweite (NFR-011)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Je eine Rechnung für **A** und **B** melden | Vorbereitung | | |
| 2 | Als **A** die Seite öffnen | Nur die eigene | | |
| 3 | Als **A** `invoice_refs` direkt abfragen | Ebenfalls nur die eigene | | |
| 4 | Als **V** abfragen | Beide – er stellt sie und mahnt sie | | |
| 5 | Als Trainer:in ohne Vorstandsrolle abfragen | Nur die eigene | | |
| 6 | Aus einem fremden Verein abfragen | Nichts | | |

---

## TC-005: Erinnerung vor Fälligkeit (A1)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine offene Rechnung mit Fälligkeit **in sieben Tagen** melden | Vorbereitung | | |
| 2 | `select remind_due_invoices();` aufrufen | **A** bekommt eine Meldung | | |
| 3 | Den Text lesen | Er nennt die Punkte, die eine fristgerechte Zahlung bringt | | |
| 4 | Den Ton prüfen | Ein Hinweis, keine Mahnung | | |
| 5 | Den Aufruf am Folgetag wiederholen | Keine zweite Meldung – die Frist trifft genau einen Tag | | |
| 6 | Die Rechnung als bezahlt melden und erneut aufrufen | Keine Meldung | | |
| 7 | Die Meldung antippen | Sie führt auf «Meine Rechnungen» | | |
| 8 | `select * from cron.job where jobname = 'invoice-remind';` | Der Auftrag ist eingerichtet | | |

---

## TC-006: Überfälligkeit als Spätindikator (A3, BR-158)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Rechnung als `overdue` melden | Der Stand in der App wechselt | | |
| 2 | `select flag_overdue_invoices();` aufrufen | Ein Signal `invoice_overdue` | | |
| 3 | Die Schwere prüfen | `info` – ein Anlass für Kontakt, keine Massnahme | | |
| 4 | Die Vereins-Gesundheit als **V** öffnen | Der Hinweis steht dort | | |
| 5 | Den Wortlaut prüfen | Kein Schuldnarrativ, keine Sanktion (BR-095, BR-158) | | |
| 6 | Den Aufruf wiederholen | Kein zweites Signal | | |
| 7 | Für **B** den Health-Opt-out setzen (UC-025) und erneut aufrufen | **Kein** Signal für **B** | | |
| 8 | Prüfen, ob der Verzug zu einem Punkteabzug führt | Nein | | |
| 9 | Prüfen, ob eine Sperre oder Mahngebühr entsteht | Nein – die App kennt so etwas nicht | | |

---

## TC-007: Ohne Rechnungsdienst nichts (A4, FR-116)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Das Modul «Rechnungen» in den Vereinseinstellungen ausschalten | Vorbereitung | | |
| 2 | Als **A** das Profil öffnen | «Meine Rechnungen» ist **vollständig** ausgeblendet | | |
| 3 | `remind_due_invoices()` aufrufen | Keine Erinnerung | | |
| 4 | `flag_overdue_invoices()` aufrufen | Kein Signal | | |
| 5 | Die Modulbeschreibung lesen | Sie sagt, dass Rechnungen weiterhin im Dienst gestellt werden | | |
| 6 | Das Modul einschalten | Der Bereich erscheint wieder, die Daten sind noch da | | |

---

## TC-008: Der Ausgangskorb (FR-117)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Bei aktivem Modul den Anzeigenamen eines Mitglieds ändern | Ein Eintrag `upsert` im Ausgangskorb | | |
| 2 | Ein Mitglied auf `left` setzen | Ein Eintrag `remove` | | |
| 3 | Ein Mitglied löschen | Ebenfalls `remove` | | |
| 4 | Das Modul ausschalten und erneut ändern | **Kein** Eintrag – ein Korb, den niemand leert, wächst nur | | |
| 5 | Als angemeldete Person den Ausgangskorb abfragen | Kein Zugriff | | |
| 6 | Prüfen, ob etwas den Korb leert | Nein – der Transport gehört dem Dienst, den es noch nicht gibt | | |

---

## TC-009: Vier Sprachen und iOS

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Seite auf Französisch, Italienisch und Englisch öffnen | Alle Texte übersetzt | | |
| 2 | Die Beträge prüfen | Zwei Nachkommastellen, CHF davor | | |
| 3 | Die Fälligkeitsdaten prüfen | Schweizer Schreibweise je Sprache | | |
| 4 | Die Abzeichen im Dunkelmodus prüfen | Lesbar; «Überfällig» ist gelb, nicht rot | | |
| 5 | Auf 320 px prüfen | Betrag und Abzeichen passen nebeneinander | | |
| 6 | Während des Ladens hinsehen | Ein Skelett, kein Spinner | | |
| 7 | Den Detail-Link auf dem Gerät antippen | Er öffnet den Dienst; die App bleibt im Hintergrund | | |

---

## Offen

- **Es gibt keinen Rechnungsdienst.** Gebaut ist die Seite, die in dieser
  Datenbank liegt. **FR-117 bleibt `Partial`** (der Ausgangskorb füllt sich,
  der Transport fehlt) und **BR-159 ebenfalls** (der Link kommt signiert vom
  Dienst; die App reicht ihn durch).
- **Der QR-Einzahlungsschein gehört nicht hierher** (BR-156). Die bestehende
  myclub-App erzeugt ihn im Backend mit `swissqrbill@4.4.1` auf `pdfkit`, samt
  QR-Referenz (26 Ziffern plus MOD10-Prüfziffer). Dieselbe Stelle ist auch hier
  die richtige.
- **«Innerhalb der Frist» ist auf den Tag gemeint.** Eine Zahlung am
  Fälligkeitstag ist pünktlich – zu bestätigen mit den Stakeholdern.
- **Die Erinnerungsfrist von sieben Tagen** steht in A1 und ist nicht
  einstellbar.

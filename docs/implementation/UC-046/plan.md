# Implementation Plan: UC-046 — Rechnung stellen und mit QR-Einzahlungsschein versenden

|                   |                                                                     |
| ----------------- | ------------------------------------------------------------------- |
| **Primary Actor** | Kassier:in (Vorstandsrolle)                                          |
| **Goal**          | Beiträge in nexus verrechnen: Periode, Positionen, QR-Rechnung, Versand – und den Zahlungseingang aus der Bankdatei verbuchen |
| **Plan created**  | 2026-09-14                                                           |
| **Status**        | Done                                                                 |

## Overview

**Der Entscheid vom 14.09.2026 dreht MVP-Scope §3 um:** Der Rechnungsdienst
läuft **in** nexus, nicht als zweites Projekt. Gebaut wird die Logik der
bisherigen myclub-App (`myclubapp/backend`,
`functions/src/firestore/invoice/changeInvoice.ts`, dazu die drei Kassier-Seiten
`club-billing-period`, `club-invoice`, `club-invoice-detail`) – aber auf
Postgres statt Firestore und ohne Google-Bausteine.

**Was aus dem alten Code übernommen wird:** Gläubigerangaben am Verein,
Abrechnungsperiode, Positionen aus Team-Beitrag und Zuschlägen, QR-Referenz mit
26 Stellen und MOD10-Prüfziffer, PDF mit Einzahlungsschein und Positionstabelle,
Versand per E-Mail mit Anhang, Hinweis bei unvollständiger Adresse, camt-Abgleich
über die QRR-Referenz.

**Was anders wird, und warum:**

| Alt | Neu | Grund |
| --- | --- | --- |
| Referenz aus `Date.now()` + Index, auf 26 gepadded | Referenz aus einer Sequenz | Zwei Rechnungen in derselben Millisekunde teilten sich die Referenz. Eindeutigkeit gehört in die Datenbank, nicht in die Uhr |
| Status `draft` → `send` → `sent` → `bezahlt` (deutsch mitten in englischen Werten) | `draft` → `sent` → `paid`, dazu `cancelled` | CLAUDE.md: Datenbankwerte englisch. `send` war ein Auftrag im Statusfeld – der Auftrag ist jetzt der Aufruf |
| camt-Datei wird **im Browser** geparst und verbucht | Edge Function `payment-import`, Zuordnung in der Datenbank | Sandros Vorgabe. Im Browser entscheidet der Client, welche Rechnung bezahlt ist – das ist dieselbe Klasse Fehler wie Punkte im Client |
| Keine Prüfung der QR-IBAN | `is_valid_iban()` + QR-IID | Ein Einzahlungsschein, den keine Bank annimmt, fällt sonst erst beim Mitglied auf |
| Rechnung ändert sich nach dem Versand | Versendetes ist unveränderlich, Korrektur per Storno | BR-224 |

## Related Use Cases

- **UC-036** Rechnungen einsehen – die Sicht des Mitglieds. Sie bleibt unverändert; neu ist, wer den Spiegel füllt
- **UC-021** Punkte – Säule 6 (`invoice_on_time`) bekommt ihre Quelle aus dem eigenen Zahlungsabgleich statt aus einem fremden Webhook
- **UC-023** Fürsorge-Hinweis – `invoice_overdue` aus `0054` bleibt der Spätindikator
- **UC-034** Vereinsidentität – das Modul `invoice` schaltet den ganzen Bereich
- **UC-044** Meldungen per E-Mail – derselbe SMTP-Zugang, dieselben Secrets

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                        | Status vorher | Ziel        | Notizen                                                       |
| ------ | ---------------------------- | ------------- | ----------- | ------------------------------------------------------------- |
| FR-169 | Gläubigerangaben des Vereins | Open          | Implemented | `invoice_creditors`, eine Zeile je Verein, mit IBAN-Prüfung    |
| FR-170 | Abrechnungsperiode anlegen   | Open          | Implemented | `invoice_periods` mit Zweck, Fälligkeit und Referenz-Präfix    |
| FR-171 | Beitrag und Zuschläge pflegen | Open         | Implemented | `invoice_fee_items` – mit `team_id` ist es der Beitrag des Teams, ohne der Zuschlag des Vereins |
| FR-172 | Rechnungsentwürfe erzeugen   | Open          | Implemented | `generate_invoices()`, Positionen je Mitglied aus seinen Teams |
| FR-173 | QR-Rechnung als PDF          | Open          | Implemented | Edge Function `invoice-run`, `swissqrbill` auf `pdfkit`        |
| FR-174 | Rechnung versenden           | Open          | Implemented | E-Mail mit Anhang, Meldung in der App, Spiegel für UC-036      |
| FR-175 | Zahlungseingänge abgleichen  | Open          | Implemented | Edge Function `payment-import` + `match_camt_payments()` – **UC-047** |
| FR-116 | Rechnungsmodul aktivieren    | Implemented   | Implemented | Unverändert; der Schalter bekommt endlich einen Inhalt         |
| FR-119 | Punkte bei pünktlicher Zahlung | Implemented | Implemented | Unverändert – neu gespeist aus `record_invoice_payment()`      |

### Business Rules

| ID     | Regel                                    | Ziel        | Notizen                                                       |
| ------ | ---------------------------------------- | ----------- | ------------------------------------------------------------- |
| BR-220 | Die Rechnung entsteht auf dem Server     | Implemented | Referenz, Betrag und Stand nur über `security definer`-Funktionen; RLS erlaubt kein `insert` |
| BR-221 | Die Zahlungsreferenz trägt ihre Prüfziffer | Implemented | `qr_reference()` aus Sequenz + MOD10; `unique` auf der Spalte  |
| BR-222 | Ohne gültige Gläubigerangaben kein Versand | Implemented | `creditor_ready()` – IBAN mod 97, CH/LI, QR-IID 30000–31999     |
| BR-223 | Unvollständige Schuldneradresse hält nicht auf | Implemented | Vermerk auf PDF und in der Mail, Rückmeldung an die Kassier:in |
| BR-224 | Entwurf und Versand sind zwei Schritte   | Implemented | Positionen nur am Entwurf; `cancel_invoice()` für Versendetes   |
| BR-225 | Das PDF liegt im Vereinsspeicher         | Implemented | Bucket `club-invoices`, privat, befristete Adresse              |
| BR-226 | Der Spiegel bleibt der Weg zum Mitglied  | Implemented | `mark_invoice_sent()` ruft `report_invoice()`; Entwürfe sind für das Mitglied nicht lesbar |
| BR-227 | Das Stellen einer Rechnung bucht keine Punkte | Implemented | Punkte entstehen allein in `record_invoice_payment()` → `report_invoice()` |
| BR-228 | Der Betrag ist die Summe seiner Positionen | Implemented | `recalc_invoice_amount()` nach jeder Änderung an den Positionen |
| BR-229 | Rechnungen stellt nur der Vorstand       | Implemented | `is_club_admin()` in jeder Policy und in jeder Funktion; die Edge Functions prüfen mit dem Token der Aufrufer:in |

### Non-Functional Requirements

| ID      | Titel                      | Kategorie | Betrifft? | Notizen                                            |
| ------- | -------------------------- | --------- | --------- | -------------------------------------------------- |
| NFR-011 | Serverseitige Berechtigung | Security  | Ja        | Policies **und** Funktionsköpfe; die Edge Functions prüfen mit dem Token der aufrufenden Person, nicht mit dem Dienstschlüssel |
| NFR-012 | Punkte nur vom Server      | Security  | Ja        | Der Zahlungseingang kommt aus der Bankdatei, verbucht wird in der Datenbank |
| NFR-017 | Dedup-Regel                | Security  | Ja        | `report_invoice()` dedupliziert; eine zweite Zahlung zur selben Rechnung bucht nicht nochmals |

---

## Current State

- `invoice_refs` (0054) ist ein Spiegel **ohne Quelle**: 0 Zeilen, `report_invoice()` hat nie jemand aufgerufen.
- `billing_outbox` (0054) füllt sich nie, weil kein Verein das Modul anhat.
- Zwei Cron-Aufträge laufen: `invoice-remind` (08:20) und `invoice-overdue` (05:30).
- Die Punkteregel `invoice_on_time` (Säule 6, 40 Punkte) steht seit `0005` in jedem Verein.
- Im UI: der Modulschalter, die Mitgliedersicht «Meine Rechnungen». Für den Vorstand **nichts**.

---

## Missing Pieces

| #   | Was fehlt                                   | Anforderung     |
| --- | ------------------------------------------- | --------------- |
| 1   | Gläubigerangaben des Vereins                | FR-169, BR-222  |
| 2   | Beiträge je Team und Zuschläge              | FR-171          |
| 3   | Abrechnungsperioden                         | FR-170          |
| 4   | Rechnungen, Positionen, Referenz            | FR-172, BR-221  |
| 5   | PDF mit QR-Einzahlungsschein                | FR-173          |
| 6   | Versand und Meldung                         | FR-174, BR-226  |
| 7   | Zahlungsabgleich aus der Bankdatei          | FR-175          |
| 8   | Vier Verwaltungsansichten                   | alle            |

---

## Implementation Guidelines

Verbindlich aus `docs/guidelines.md`:

- **Bauteile:** `AppPage`, `ListSection` mit `footnote`, `ManageSection` für Verwaltungswege, `SkeletonList`, `EmptyState` mit Angebot, `IonBadge` für den Stand, `DateField` für jedes Datum. **Kein neues Bauteil.**
- **Entscheidungen** als reine Funktionen in `src/lib/invoicing.ts` (§9): Prüfziffer, IBAN-Prüfung, Positionsvorschlag, Summen, Stand-Farbe.
- **Struktur:** `src/hooks/useInvoicing.ts`; Seiten unter `src/pages/club/`; Migration `0087_invoicing.sql`; Edge Functions `invoice-run` und `payment-import`.
- **Vier Sprachen** ab dem ersten Commit.

---

## Implementation Tasks

- [x] 1. Migration `0087_invoicing.sql`: fünf Tabellen, RLS, Funktionen, Bucket
- [x] 2. `src/lib/invoicing.ts` + Tests: MOD10, IBAN, Positionsvorschlag, Summen
- [x] 3. Edge Function `invoice-run`: PDF mit `swissqrbill`, Versand, Quittung
- [x] 4. Edge Function `payment-import`: camt.053/054 lesen, Zuordnung in der Datenbank
- [x] 5. `useInvoicing.ts`: Perioden, Rechnungen, Gläubiger, Beiträge, Läufe
- [x] 6. Seiten: Einrichtung, Perioden, Periodendetail
- [x] 7. i18n in vier Sprachen
- [x] 8. Verhaltensprüfung gegen die laufende Datenbank
- [x] 9. Testplan `docs/test-plans/uc-046-rechnungsstellung.md`
- [x] 10. Statusabgleich in `requirements.md`, UC-046, UC-047 und `use_cases/README.md`
- [x] 11. `0090_invoice_reminder.sql`: an eine offene Rechnung erinnern (FR-176, A8, BR-236)
- [x] 12. End-zu-End gegen die deployten Functions: erzeugen, versenden, PDF ansehen, verbuchen, erinnern – mit einem Probe-Konto, danach vollständig abgeräumt

---

## Was der End-zu-End-Lauf gezeigt hat (14.09.2026)

Ein Probe-Verein mit eigenem Konto, gegen die **deployten** Functions gefahren
und danach restlos abgeräumt (Verein, PDF, Konto). Belegt sind damit:
Entwurf erzeugen über REST mit dem Token der Kassier:in, Versand samt PDF im
Vereinsspeicher, Spiegel auf `open` ohne Punktebuchung, Probelauf der
Bankdatei ohne Wirkung, Verbuchen mit 40 Punkten, zweiter Lauf derselben Datei
ohne zweite Buchung, Erinnerung und ihre Wochengrenze, und die Abweisung
jedes dieser Wege ohne Vorstandsrolle.

Drei Mängel hat erst der Augenschein am fertigen Blatt gezeigt:

| Was | Warum es auffiel |
| --- | --- |
| Die Referenz stand im Kopf **links** gruppiert, auf dem Einzahlungsschein rechts | Dieselbe Zahl in zwei Formen auf einem Blatt |
| Das Rechnungsdatum stand als `2026-09-14` | Eine Schweizer Rechnung schreibt `14.9.2026` |
| Das Blatt war einsprachig deutsch | Die Mail war schon vierprachig; die Rechnung ist derselbe Benutzertext (CLAUDE.md) |

Beim Beheben des dritten fand der Typcheck einen vierten: `language` gehört
**nicht** in die Daten des QR-Bills, sondern in die Optionen – im Datenobjekt
hätte ihn die Bibliothek verschluckt, und der Schein wäre deutsch geblieben,
ohne dass irgendetwas gemeldet hätte.

## Entscheide, die beim Bauen gefallen sind

**Die QR-IBAN ist Pflicht, nicht eine Möglichkeit.** Eine gewöhnliche IBAN
trägt keine QRR-Referenz; der Abgleich aus der Bankdatei liefe dann über den
Betrag und wäre raten. Wer keine QR-IBAN hat, kann in nexus keine Rechnung
versenden – das sagt die Einrichtungsseite, bevor eine Periode entsteht.

**Eine Rechnung je Mitglied und Periode.** Ein zweiter Lauf über dieselbe
Periode überspringt, wer schon eine hat, statt zu doppeln. Wer zweimal
verrechnen will, legt eine zweite Periode an – das ist auch buchhalterisch die
ehrlichere Form.

**Der Versand läuft nacheinander, nicht nebenläufig.** Fünfzig PDFs
gleichzeitig zu bauen spart nichts und riskiert das Zeitlimit der Function bei
allen gleichzeitig. Jede Rechnung quittiert für sich; ein Abbruch in der Mitte
lässt die bereits versendeten versendet.

**Das Blatt spricht die Sprache der Person.** `swissqrbill` übersetzt den
Einzahlungsschein selbst, sobald es `language` als **Option** bekommt – in den
Daten würde der Wert stillschweigend verschluckt. Was darüber steht (Referenz,
Datum, Positionstabelle, der Hinweis auf eine unvollständige Adresse), kommt
aus `PDF_LABELS` in `mail.ts`; die Sprache liest `invoice_payload()` aus
`notification_settings.locale` der Person.

**Der Zahlungsabgleich zählt Differenzen.** Die Antwort nennt zugeordnete,
bereits bezahlte und nicht gefundene Referenzen einzeln – eine Zahl «12
verbucht» ohne den Rest wäre die Sorte Rückmeldung, die Fehler verdeckt.

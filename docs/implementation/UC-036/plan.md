# Implementation Plan: UC-036 — Rechnungen einsehen und Punkte bei pünktlicher Zahlung

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                            |
| **Goal**          | Den eigenen Rechnungsstand in der App sehen und für pünktliche Zahlung gewürdigt werden |
| **Plan created**  | 2026-09-11                                                          |
| **Status**        | Done                                                                |

## Overview

**BR-156 ist der Satz, der diesen Use Case klein hält: «Die App kennt nur den
Spiegel.»** Betrag, Fälligkeit, Status und ein Link – Positionen,
Zahlungsreferenzen und Bankdaten bleiben im Rechnungsdienst.

Das ist keine Bequemlichkeit, sondern eine Abgrenzung mit Folgen: Die App
**erzeugt keine Rechnung**, und sie erzeugt insbesondere **keinen
QR-Einzahlungsschein**.

> **Recherche zum QR-Bill** (auf Wunsch geprüft): Die bestehende myclub-App
> erzeugt QR-Rechnungen im **Backend**, nicht im Client –
> `myclubapp/backend`, `functions/src/firestore/invoice/changeInvoice.ts`, mit
> `swissqrbill@4.4.1` (schoero/swissqrbill) auf `pdfkit`. Dort entstehen die
> QR-Referenz (26 Ziffern plus MOD10-Prüfziffer), der Einzahlungsschein und das
> PDF; Gläubigerangaben kommen vom Verein, Schuldnerangaben aus dem
> Benutzerprofil. Für **nexus** heisst das: Die Bibliothek gehört in den
> Rechnungsdienst, nicht hierher. BR-156 zieht die Grenze genau dort, und dieser
> Plan hält sie ein.
>
> Die alte App führt die Status `draft`, `send`, `sent` und `bezahlt` – der
> letzte deutsch mitten in englischen Werten. Das Entitätsmodell hier nennt
> `open`, `paid`, `overdue`; dabei bleibt es (CLAUDE.md: Datenbankwerte
> englisch).

**FR-119 ist der eigentliche Ertrag.** Die Punkteregel `invoice_on_time`
(Säule 6, 40 Punkte) steht seit `0005` in **jedem** Verein – und hatte bis
heute keine Quelle. Sie bekommt eine.

## Related Use Cases

- UC-021 Punkte — Säule 6 ist die einzige, die von aussen gespeist wird
- UC-023 Fürsorge-Hinweis — `invoice_overdue` steht seit `0040` im Constraint und hatte ebenfalls keine Quelle
- UC-025 Transparenz — der Zahlungsstatus ist dort als Datenart genannt
- UC-034 Vereinsidentität — der Rechnungsdienst ist ein Modul wie die anderen

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                        | Status vorher | Ziel        | Notizen                                                       |
| ------ | ---------------------------- | ------------- | ----------- | ------------------------------------------------------------- |
| FR-116 | Billing aktivieren           | Open          | Implemented | Ein Modul wie die anderen (UC-034). **Ohne Kennung des Vereins beim Dienst**: Ein Feld, das nichts liest, wäre totes Feld – es entsteht mit dem Dienst |
| FR-117 | Mitglieder-Sync ans Billing  | Open          | **Partial** | Der Ausgangskorb steht und füllt sich; der **Transport** braucht den Dienst |
| FR-118 | «Meine Rechnungen»           | Open          | Implemented | Der Spiegel und der Weg in die Detailansicht                   |
| FR-119 | Punkte bei pünktlicher Zahlung | Open        | Implemented | Die Regel aus `0005` bekommt ihre Quelle                       |

### Business Rules

| ID     | Regel                              | Ziel        | Notizen                                                      |
| ------ | ---------------------------------- | ----------- | ------------------------------------------------------------ |
| BR-156 | Die App kennt nur den Spiegel      | Implemented | Vier Felder und ein Link – kein Betragsdetail, keine Referenz |
| BR-157 | Punkte nur bei Zahlung in der Frist | Implemented | `paid_at <= due_date`, auf den Tag                           |
| BR-158 | Keine Sanktion bei Verzug          | Implemented | Kein Abzug, kein Vermerk – nur ein Anlass für Kontakt         |
| BR-159 | Ein Login für beides               | **Partial** | Der Link kommt signiert **vom Dienst**; die App reicht ihn durch |

### Non-Functional Requirements

| ID      | Titel                      | Kategorie | Betrifft? | Notizen                                            |
| ------- | -------------------------- | --------- | --------- | -------------------------------------------------- |
| NFR-011 | Serverseitige Berechtigung | Security  | Ja        | Eine fremde Rechnung ist per Policy nicht lesbar    |
| NFR-012 | Punkte nur vom Server      | Security  | Ja        | Die Buchung entsteht in der Meldung des Dienstes    |
| NFR-017 | Dedup-Regel                | Security  | Ja        | Eine zweite Meldung derselben Rechnung bucht nicht nochmals |

---

## Current State

- `point_rules`: `invoice_on_time` (Säule 6, 40 Punkte) besteht seit `0005` in
  **jedem** Verein – **ohne Quelle**.
- `health_signals`: `invoice_overdue` steht seit `0040` im Constraint – ebenfalls
  ohne Quelle.
- `INVOICE_REF` steht im Entitätsmodell, **als Tabelle gibt es sie nicht**.
- Kein Modul, keine Ansicht, kein Weg für den Dienst, etwas zu melden.

---

## Missing Pieces

| #   | Was fehlt                                  | Anforderung     | Quelle          |
| --- | ------------------------------------------ | --------------- | --------------- |
| 1   | Keine Tabelle für den Spiegel              | FR-118, BR-156  | Automated       |
| 2   | Kein Weg für den Dienst, etwas zu melden   | FR-118, FR-119  | Automated       |
| 3   | Die Punkteregel hat keine Quelle           | FR-119, BR-157  | Automated       |
| 4   | Keine Erinnerung vor Fälligkeit            | A1              | Cross-reference |
| 5   | `invoice_overdue` hat keine Quelle         | A3              | Cross-reference |
| 6   | Kein Modul, kein Ausblenden                | FR-116, A4      | Cross-reference |
| 7   | Kein Ausgangskorb für den Mitglieder-Sync  | FR-117          | Cross-reference |

---

## Implementation Guidelines

Verbindlich aus `docs/guidelines.md`:

- **Bauteile:** `AppPage`, `ListSection` mit `footnote`, `SkeletonList`,
  `EmptyState` **mit Angebot** (seit UC-037), `IonBadge` für den Status.
  **Kein neues Bauteil.**
- **Entscheidungen** als reine Funktionen in `src/lib/invoice.ts` (§9) –
  besonders die Fristfrage aus BR-157.
- **Struktur:** `src/hooks/useInvoices.ts`, `src/pages/InvoicePage.tsx`;
  Migration `0054_invoice_mirror.sql`.
- **Modul:** `modules.invoice`, gesperrt am Server (`module_enabled()`).

---

## Implementation Tasks

- [x] 1. Migration `0054_invoice_mirror.sql`: `invoice_refs`, Policy,
      `report_invoice()` für den Dienst, `remind_due_invoices()` + Cron,
      `flag_overdue_invoices()` + Cron, `billing_outbox` mit Trigger
- [x] 2. `lib/invoice.ts`: Status, Fristfrage, Anzeige
- [x] 3. `hooks/useInvoices.ts`
- [x] 4. `InvoicePage` und der Einstiegspunkt im Profil (nur bei aktivem Modul)
- [x] 5. Modul `invoice` in den Vereinseinstellungen
- [x] 6. Vier Sprachen – `npm run i18n:check`
- [x] 7. Verhaltensprüfung gegen die verknüpfte Datenbank
- [x] 8. `ai-code-review` und Behebung der Befunde
- [x] 9. Vitest, mit einem Test, der **BR-157 und BR-158 festhält**
- [x] 10. Manueller Testplan `docs/test-plans/uc-036-rechnungen.md`
- [x] 11. Statusabgleich in `requirements.md`, UC-Dokument, `use_cases/README.md`
      und `entity_model.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                                         | Impact   | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------- |
| 1   | **Es gibt keinen Rechnungsdienst, mit dem sich sprechen liesse.** Gebaut wird die Seite, die in dieser Datenbank liegt: der Spiegel, die Meldestelle, die Punkte, die Erinnerung. Transport und signierter Link gehören dem Dienst. FR-117 und BR-159 bleiben deshalb `Partial`. | **High** | Stakeholder |
| 2   | Der QR-Einzahlungsschein entsteht **nicht** hier (BR-156). Die bestehende myclub-App erzeugt ihn im Backend mit `swissqrbill@4.4.1`; dieselbe Stelle ist auch hier die richtige.                                          | Medium   | Architect   |
| 3   | Wer darf melden? Umgesetzt: `report_invoice()` ist ausschliesslich für `service_role` ausführbar – kein angemeldetes Konto kann einen Zahlungseingang behaupten und sich Punkte buchen.                                   | **High** | Dev         |
| 4   | «Innerhalb der Frist» ist auf den **Tag** gemeint: `paid_at::date <= due_date`. Eine Zahlung am Fälligkeitstag ist pünktlich.                                                                                             | Medium   | Stakeholder |
| 5   | A3 sagt «sofern das Mitglied dem nicht widersprochen hat». Der Opt-out aus UC-025 gilt; das Signal entsteht nur für Mitglieder ohne Widerspruch.                                                                          | Medium   | Dev         |
| 6   | Die Erinnerungsfrist aus A1 ist mit «sieben Tage» beziffert und wird so umgesetzt – ohne Einstellung, weil eine Frist, die jeder Verein selbst setzt, keine ist.                                                          | Low      | Stakeholder |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-11 | Plan erstellt |
| 2026-09-11 | Migration `0054_invoice_mirror.sql` eingespielt: `invoice_refs` mit neun Spalten (BR-156), Policy «eigene oder Vorstand», `report_invoice()` **nur für `service_role`**, `remind_due_invoices()` und `flag_overdue_invoices()` mit Cron, `billing_outbox` mit Trigger auf `club_members` |
| 2026-09-11 | Verhaltensprüfung gegen die verknüpfte Datenbank: **29 von 29 Prüfungen bestanden**. Die wichtigste: Ein angemeldetes Konto kann `report_invoice()` nicht aufrufen und sich damit keine Punkte buchen |
| 2026-09-11 | App: `lib/invoice.ts` (Frist, Sortierung, Ton), `hooks/useInvoices.ts`, `InvoicePage` unter `profile/invoices`, Einstieg im Profil nur bei aktivem Modul, `invoice` in `CLUB_MODULES`; vier Sprachen, `i18n:check` grün |
| 2026-09-11 | `ai-code-review`: keine offenen Befunde; `typecheck`, `lint` und die Testsuite (64 Dateien, 763 Tests) grün, davon 13 neue in `lib/invoice.test.ts` – sie halten BR-157 (Zahlung am Fälligkeitstag ist pünktlich) und BR-158 (überfällig ist `warning`, nicht `danger`) fest |
| 2026-09-11 | Manueller Testplan `docs/test-plans/uc-036-rechnungen.md` (9 Fälle); Statusabgleich: FR-116/118/119 `Implemented`, FR-117 `Partial`, UC-036 `Implemented`, `BILLING_OUTBOX` ins Entitätsmodell aufgenommen |

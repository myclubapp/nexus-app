# Manual Test Plan: UC-046/UC-047 — Rechnungen stellen und Zahlungen verbuchen

**Use Cases:** [UC-046](../use_cases/UC-046-rechnung-stellen-und-versenden.md), [UC-047](../use_cases/UC-047-zahlungseingaenge-abgleichen.md)
**Geltungsbereich:** Gläubigerangaben, Beiträge, Periode, Entwürfe, QR-PDF, Versand, Storno, camt-Abgleich
**Anforderungen:** FR-169 bis FR-176, FR-116, FR-118, FR-119
**Regeln:** BR-220 bis BR-236, BR-156 bis BR-158
**Erstellt:** 2026-09-14

## Vorbereitung

- **V** — Vorstand (Rolle admin, die Kassier:in). **M** — Mitglied mit E-Mail-Adresse und vollständiger Adresse. **M2** — Mitglied **ohne** Strasse/Ort im Profil.
- Migrationen `0087`–`0090` eingespielt, `npm run types:generate` gelaufen.
- Edge Functions `invoice-run` und `payment-import` deployt; Secrets `SMTP_*` und `MAIL_FROM` gesetzt (dieselben wie UC-044).
- Das Modul «Rechnungen» ist in den Vereinseinstellungen **eingeschaltet**.
- Eine **QR-IBAN** zur Hand (beginnt mit CH/LI, an fünfter Stelle eine 3). Zum Prüfen taugt die Testnummer `CH44 3199 9123 0008 8901 2`.
- Für TC-010: eine camt.053- oder camt.054-Datei aus dem E-Banking – oder die Datei aus `supabase/functions/payment-import/camt_test.ts` mit einer echten Referenz aus TC-005.

---

## TC-001: Ohne Modul gibt es den Bereich nicht (FR-116, A7)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** das Modul «Rechnungen» in den Vereinseinstellungen ausschalten, speichern | Toast «Gespeichert» | | |
| 2 | Profil ansehen | Weder «Rechnungsstellung» noch «Meine Rechnungen» stehen da | | |
| 3 | Modul wieder einschalten | «Rechnungsstellung» erscheint in der Verwaltung | | |

---

## TC-002: Gläubigerangaben (FR-169, BR-222)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Verwaltung → «Rechnungsstellung» öffnen | Oben die Zeile «Einrichtung», darunter der Hinweis, dass ohne vollständige Angaben nichts versendet werden kann; **kein Plus** unten rechts | | |
| 2 | «Einrichtung» öffnen, eine **gewöhnliche** IBAN eintragen (z. B. `CH93 0076 2011 6238 5295 7`) | Unter den Feldern: «Das ist eine gewöhnliche IBAN. Für Rechnungen braucht es eine QR-IBAN deiner Bank.» | | |
| 3 | Eine IBAN mit vertippter Ziffer eintragen | «Diese IBAN stimmt nicht – prüfe die Zahlenfolge», und «Speichern» bleibt grau | | |
| 4 | Die QR-IBAN und die Vereinsadresse vollständig eintragen, speichern | Toast «Gläubigerangaben gespeichert», die Hinweise verschwinden | | |
| 5 | Zurück zu «Rechnungsstellung» | Die Zeile sagt «Alles bereit zum Versenden», das Plus unten rechts ist da | | |

---

## TC-003: Beiträge und Zuschläge (FR-171)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | In der Einrichtung das Plus unten rechts antippen | Blatt «Neuer Beitrag» | | |
| 2 | «Mitgliederbeitrag», 80.00, «Gilt für: Alle Mitglieder», speichern | Die Zeile erscheint mit dem Badge «CHF 80.00» und der Notiz «Alle Mitglieder» | | |
| 3 | Zweiten Beitrag anlegen, diesmal ein Team wählen | Die Notiz nennt das Team | | |
| 4 | Einen Abzug anlegen: «Familienrabatt», **-30** | Der Badge zeigt «CHF -30.00» | | |
| 5 | Eine Zeile antippen, «Wird vorgeschlagen» ausschalten, speichern | Der Badge wird grau | | |
| 6 | Nach links wischen, «Löschen» | Toast «Beitrag gelöscht», die Zeile ist weg | | |

---

## TC-004: Periode und Entwürfe (FR-170, FR-172, A6)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Rechnungsstellung» → Plus unten rechts | Blatt «Neue Periode» | | |
| 2 | Zweck «Jahresbeitrag 2026», Fälligkeit in 30 Tagen, Präfix `4711`, erstellen | Toast «Periode angelegt», die Periode steht in der Liste mit Fälligkeit und CHF | | |
| 3 | Periode öffnen | Drei Zahlen (Entwürfe, Offen, Eingegangen), alle 0; Knopf «0 Rechnungen versenden» ist grau | | |
| 4 | Plus unten rechts → «Rechnungen erzeugen» | Blatt mit den Positionen (alle vorausgewählt) und darunter allen Mitgliedern | | |
| 5 | Die Mitgliederliste ansehen | Unter jedem Namen steht der Betrag, den er bekäme – beim Team-Mitglied inkl. Teambeitrag; wer keinen Beitrag hat, trägt «Kein Beitrag – wird ausgelassen» | | |
| 6 | **M**, **M2** und ein Mitglied ohne Beitrag wählen, bestätigen | Toast «2 erzeugt, 1 ausgelassen» | | |
| 7 | Die Liste ansehen | Zwei Zeilen mit Betrag, Fälligkeit, Referenz in Fünfergruppen und dem Badge «Entwurf»; «Entwürfe» zeigt 2, «Offen» bleibt **0** (BR-226) | | |
| 8 | Erzeugen für dieselben Mitglieder wiederholen | «0 erzeugt, 2 ausgelassen» – es entstehen keine zweiten Rechnungen | | |

---

## TC-005: Versand und QR-PDF (FR-173, FR-174, A2)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Entwurfszeile antippen | Blatt mit den Positionen, der Referenz als Fussnote, dem Stand und unten «Verwalten» mit «Verwerfen» in Rot | | |
| 2 | Blatt schliessen, «2 Rechnungen versenden» antippen | Rückfrage: «… werden als PDF erzeugt und per E-Mail zugestellt. Danach sind sie nicht mehr änderbar.» | | |
| 3 | Bestätigen | Der Knopf zeigt einen Ladekreis; danach Toast «2 Rechnungen versendet» | | |
| 4 | Die Liste ansehen | Beide Zeilen tragen jetzt «Versendet»; «Offen» zeigt die Summe, «Entwürfe» 0 | | |
| 5 | Eine Zeile öffnen → «PDF öffnen» | Das PDF erscheint: Vereinslogo oben links, beide Adressen, die Positionstabelle mit Total und **unten der QR-Einzahlungsschein** | | |
| 6 | Den QR-Code mit der Banking-App scannen | Die App füllt Betrag, Empfänger und Referenz korrekt aus – **nicht abschicken** | | |
| 7 | Das Postfach von **M** ansehen | Mail mit Betreff «Rechnung … – Jahresbeitrag 2026» und dem PDF im Anhang, in der Sprache von **M** | | |
| 8 | Die Mail von **M2** (unvollständige Adresse) ansehen | Sie kam an und trägt zusätzlich den Hinweis, die Adresse im Profil zu ergänzen; derselbe Hinweis rot unter der Tabelle im PDF | | |
| 9 | Als **M** die App öffnen | Meldung «Eine neue Rechnung»; unter «Meine Rechnungen» steht sie mit Betrag, Fälligkeit und Stand «Offen» | | |
| 10 | Als **M** die Zeile antippen | Das eigene PDF öffnet sich | | |

---

## TC-006: Was versendet ist, ändert sich nicht (BR-224)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine versendete Zeile öffnen | «Verwalten» bietet «PDF öffnen» und «Stornieren» – **kein** «Verwerfen» | | |
| 2 | Nach links über eine versendete Zeile wischen | Die Option heisst «Stornieren», nicht «Verwerfen» | | |
| 3 | «Stornieren» wählen, Grund eintragen, bestätigen | Toast «Rechnung storniert», Badge wird grau, «Offen» sinkt um den Betrag | | |
| 4 | Als **M** «Meine Rechnungen» öffnen | Die stornierte Rechnung steht nicht mehr da; eine Meldung «Eine Rechnung wurde storniert» ist eingetroffen | | |

---

## TC-007: Ohne Gläubigerangaben kein Versand (A1)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | In der Einrichtung den Ort löschen und speichern | Der Hinweis «Der Ort fehlt» erscheint | | |
| 2 | Eine neue Periode anlegen wollen | Das Plus unten rechts fehlt; die Zeile «Einrichtung» nennt den Grund | | |
| 3 | In einer bestehenden Periode Entwürfe erzeugen und versenden | Der Versand bricht ab und nennt die fehlenden Gläubigerangaben; die Entwürfe bleiben Entwürfe | | |
| 4 | Den Ort wieder eintragen | Versand gelingt | | |

---

## TC-008: Nur der Vorstand (BR-229, NFR-011)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** das Profil und das Seitenmenü ansehen | «Rechnungsstellung» steht nirgends | | |
| 2 | Als **M** `/tabs/profile/billing` direkt aufrufen | Die Seite sagt, dass das dem Vorstand vorbehalten ist, mit dem Weg zurück ins Profil | | |
| 3 | Als **M** `/tabs/profile/billing/<periodId>` aufrufen | Dasselbe; es erscheint **keine** Rechnungsliste | | |

---

## TC-009: Zahlungen aus der Bankdatei – Probelauf (UC-047, BR-233)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Periode öffnen, «Bankdatei wählen» antippen | Der Dateiwähler des Geräts öffnet sich | | |
| 2 | Eine camt-Datei wählen | Kurz ein Ladekreis in der Zeile, dann das Blatt «Was in der Datei steht» | | |
| 3 | Das Blatt lesen | «n Zahlungen gefunden», darunter je Zahlung Einzahler, Referenz und Betrag; die Fussnote sagt, dass noch nichts gebucht ist | | |
| 4 | Das Blatt schliessen, ohne zu buchen | Kein Stand hat sich geändert | | |
| 5 | Eine Datei wählen, die kein camt ist (z. B. ein beliebiges XML) | Toast «Diese Datei lässt sich nicht als camt lesen» | | |

---

## TC-010: Zahlungen verbuchen (FR-175, FR-119, BR-234)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Punktestand von **M** notieren | | | |
| 2 | Die camt-Datei mit der Referenz aus TC-005 wählen und «Verbuchen» | Toast «1 von n Zahlungen verbucht» | | |
| 3 | Die Liste ansehen | Die Rechnung trägt «Bezahlt» in Grün; «Eingegangen» steigt um den Betrag, «Offen» sinkt | | |
| 4 | Punktestand von **M** ansehen | 40 Punkte mehr (Säule 6), und eine Meldung «Danke fürs pünktliche Bezahlen» | | |
| 5 | Dieselbe Datei erneut verbuchen | «0 von n verbucht»; der Punktestand bleibt **gleich** (BR-234) | | |
| 6 | Die bezahlte Zeile öffnen | «Verwalten» bietet nur «PDF öffnen» – **kein** Stornieren (BR-235) | | |
| 7 | Eine Datei mit einer unbekannten Referenz verbuchen | Die Rückmeldung nennt sie als nicht zugeordnet; keine Rechnung ändert sich | | |

---

## TC-010b: An eine offene Rechnung erinnern (FR-176, A8, BR-236)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Periode mit Fälligkeit **gestern** anlegen, Rechnung erzeugen und versenden | Die Zeile trägt «Versendet» mit warnendem Badge | | |
| 2 | Die Periode ansehen | Unter «Versenden» steht «1 Überfällige erinnern» | | |
| 3 | Antippen | Toast «1 erinnert.»; unter der Zeile steht «1× erinnert» | | |
| 4 | Noch einmal antippen | Der Knopf ist verschwunden – diese Woche geht keine zweite hinaus (BR-236) | | |
| 5 | Als **M** die App öffnen | Meldung «Eine Rechnung ist noch offen» mit Betrag und Fälligkeit; kein Wort über Gebühren oder Folgen (BR-158) | | |
| 6 | Die Zeile öffnen | «Verwalten» bietet **kein** «Erinnern» mehr, solange die Woche läuft | | |
| 7 | Eine Rechnung ansehen, deren Frist noch läuft | Weder Knopf noch «Erinnern» im Blatt – dafür gibt es die nächtliche Erinnerung sieben Tage vor der Fälligkeit | | |

---

## TC-011: Überfälligkeit (UC-036 A3, 0089)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Periode mit Fälligkeit **gestern** anlegen, Rechnung erzeugen und versenden | Die Zeile trägt «Versendet» mit **warnendem** Badge (nicht rot) | | |
| 2 | Am nächsten Morgen nach 05:30 als **M** «Meine Rechnungen» öffnen | Der Stand ist «Überfällig» | | |
| 3 | Als **V** die Vereins-Gesundheit öffnen (Modul «health») | Ein Hinweis `invoice_overdue` in der Schwere «info» – kein Punkteabzug, kein Vermerk (BR-158) | | |

---

## TC-012: Vier Sprachen

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch stellen, alle drei Rechnungsseiten öffnen | Kein deutscher Text, keine Schlüssel wie `billing.title` | | |
| 2 | Ein Auswahlfeld öffnen (Währung, Gilt für) | «Annuler» und «OK», nicht «Cancel» | | |
| 3 | Italienisch und Englisch ebenso | Dasselbe | | |
| 4 | Als **M** mit französischer Sprache eine Rechnung zustellen lassen | Die Mail ist französisch | | |
| 5 | Das PDF dieser Rechnung öffnen | Auch das **Blatt** ist französisch: «Référence», «Date de facture», «Désignation», und der Einzahlungsschein sagt «Récépissé» / «Section paiement» | | |

# Manual Test Plan: UC-048 — Mail im Vereins-Look, mit Warum und Begrüssung

**Use Case:** [UC-048](../use_cases/UC-048-vereinsmail-und-warum.md)
**Geltungsbereich:** Anmeldemail, Willkommensmail, Warum in Inbox und Mail, Rechnungsmail im Vereins-Look
**Anforderungen:** FR-182, FR-183, FR-184, NFR-040
**Regeln:** BR-239, BR-240, BR-241, BR-242 (BR-117, BR-210, BR-211 unverändert)
**Erstellt:** 2026-09-15

## Vorbereitung

- **G** — Gast ohne Konto (freie Mailadresse), **M** — Mitglied mit Adresse am Konto, **V** — Vorstand desselben Vereins.
- Migration `0096_club_mail_and_why.sql` ist eingespielt.
- Functions `auth-mail`, `send-mail` und `invoice-run` sind deployt.
- Secrets: die sechs aus BR-212, dazu `SEND_EMAIL_HOOK_SECRET` und – für den Verweis auf die Website – `MAIL_HELP_URL`.
- `[auth.hook.send_email]` steht in `config.toml` und ist mit `supabase config push` am Projekt.
- Der Verein trägt Logo (UC-045) und Vereinsfarbe (UC-034); für TC-007 ein zweiter Verein **ohne** beides.
- Zugriff auf die Postfächer von **G** und **M**, auf `notifications` und auf die Logs der Function `auth-mail`.

---

## TC-001: Die Anmeldemail trägt den Verein (Hauptablauf Schritte 1–3, FR-182)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** eine Einladung erstellen und den Link an **G** geben | — | | |
| 2 | Als **G** den Einladungslink öffnen | Vorschau mit Verein, Team, Rolle; danach die Anmeldung | | |
| 3 | Adresse eingeben, Anmeldelink anfordern | Bestätigung «Link unterwegs» | | |
| 4 | Das Postfach von **G** öffnen | Absender heisst «\<Verein\> (myclub)», die Adresse ist die des Dienstes (BR-241) | | |
| 5 | Den Betreff lesen | «\<Verein\>: Dein Anmeldelink» | | |
| 6 | Die Mail öffnen | Kopfband in der Vereinsfarbe, Vereinslogo darin, Vereinsname darunter | | |
| 7 | Bilder blockieren (Postfach-Einstellung) und neu laden | Der Vereinsname steht weiterhin im Kopfband | | |
| 8 | Nach unten lesen | Abschnitt «Warum diese Mail:» sagt, dass eine Anmeldung angefordert wurde und Nichtstun genügt (FR-183) | | |
| 9 | Den sechsstelligen Code suchen | Steht als abgesetzter Block unter dem Knopf | | |
| 10 | Den Knopf antippen | Die App öffnet sich angemeldet | | |

---

## TC-002: Sprache und Rückfall der Anmeldemail (A1, A7, NFR-040)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | App auf Französisch stellen, abmelden, mit einer **neuen** Adresse einen Anmeldelink anfordern | Die Mail ist auf Französisch | | |
| 2 | Als **M** (Sprache Italienisch in den Einstellungen) einen Anmeldelink anfordern | Die Mail ist auf Italienisch – die Einstellung am Konto sticht | | |
| 3 | Mit einer Adresse ohne Verein und ohne Einladung anfordern | Kopfband in der myclub-Grundfarbe, Betreff ohne Vereinsnamen (A1) | | |
| 4 | Im zweiten Verein (ohne Logo und Farbe) anfordern | Grundfarbe, kein Bild, Vereinsname steht (A7) | | |
| 5 | Die Zeit zwischen «Anmeldelink anfordern» und der Bestätigung in der App messen | Unter zwei Sekunden – der Versand läuft hinter der Antwort (NFR-040) | | |
| 6 | Im Log der Function `auth-mail` nachsehen | Eine Zeile «auth-mail: magiclink an … verschickt» je Anforderung | | |
| 7 | In `config.toml` `enabled = false` setzen, `supabase config push`, erneut anfordern | Die Standardmail von Supabase kommt an; die Anmeldung funktioniert (NFR-040) | | |
| 8 | Zurückstellen und `config push` | Die Mail kommt wieder im Vereins-Look | | |

---

## TC-003: Die Willkommensmail beim Beitritt (Schritte 4–6, FR-184)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **G** angemeldet die Einladung einlösen | Beitritt bestätigt, Dashboard erscheint | | |
| 2 | In `notifications` die neue Zeile prüfen | `mail_template = 'welcome'`, `email_wanted = true`, `email_after` **leer** (dringend, BR-211) | | |
| 3 | Höchstens fünf Minuten warten, Postfach öffnen | Die Willkommensmail ist da, Betreff «\<Verein\>: Willkommen bei \<Verein\>» | | |
| 4 | Die Mail lesen | Kopfband des Vereins; fünf nummerierte Schritte: Zusagen, Mithelfen, Punkte, Beitrag über die Saison, Inbox | | |
| 5 | Nach dem Abschnitt «Warum das Ganze» sehen | Ein Absatz erklärt den Gedanken hinter dem Punktesystem | | |
| 6 | Den Knopf «App öffnen» antippen | Führt auf das Dashboard | | |
| 7 | Den Verweis «Alle Einzelheiten auf der Website» antippen | Führt auf `MAIL_HELP_URL` | | |
| 8 | Die Fusszeile lesen | «Du erhältst diese Mail einmalig, weil du \<Verein\> beigetreten bist» | | |
| 9 | Die Inbox der App öffnen | Dieselbe Meldung steht dort (BR-117) | | |
| 10 | Als **V** in den Vereinseinstellungen ein «Warum» der Vereins-DNA erfassen, mit einer zweiten Adresse beitreten | Die Willkommensmail trägt den Satz oben als «Darum gibt es uns:» | | |

---

## TC-004: Nur eine Begrüssung (A2, A3, A4, BR-240)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **G** dieselbe Einladung ein zweites Mal öffnen und einlösen | Die App führt in den Verein, keine zweite Zeile mit `mail_template = 'welcome'` | | |
| 2 | Mit einer neuen Adresse eine Beitritts-Anfrage stellen; als **V** annehmen | Eine Willkommensmail geht hinaus – derselbe Aufbau wie in TC-003 (A2) | | |
| 3 | Mit einer weiteren Adresse eine Anfrage stellen, dann **vor** dem Entscheid über eine Einladung beitreten, danach die Anfrage annehmen | Genau **eine** Begrüssung insgesamt (A3, BR-240) | | |
| 4 | Als **M** «Keine E-Mail» einstellen, austreten lassen und in einen zweiten Verein eintreten | Keine Willkommensmail; die Begrüssung steht in der Inbox (A4) | | |

---

## TC-005: Das Warum an jeder Meldung (Schritte 7–8, A5, FR-183, BR-239)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** die Inbox öffnen | Jede Zeile trägt eine Zeile «Warum: …» | | |
| 2 | Eine Termin-Meldung ansehen | «Der Verein plant mit deiner Antwort – auch ein Nein hilft.» | | |
| 3 | Eine Punkte-Meldung ansehen | «Damit du siehst, wofür dein Beitrag gezählt hat.» | | |
| 4 | Als **V** eine Aufgabe mit einem eigenen Warum ausschreiben und **M** vorschlagen | In der Inbox steht dieses Warum, nicht der Standardsatz (A5) | | |
| 5 | Die App auf Französisch stellen | Die Standardsätze sind französisch, das Warum der Aufgabe bleibt, wie es erfasst wurde | | |
| 6 | Auf Italienisch und Englisch wiederholen | Kein Schlüsselname wie `notifications.why.event` erscheint | | |
| 7 | Als **M** «Sofort» wählen, als **V** eine Aufgabe vorschlagen, das Postfach öffnen | Die Mail trägt dasselbe Warum, abgesetzt durch einen Balken in der Vereinsfarbe | | |
| 8 | Als **M** «Täglich» wählen, drei Meldungen verschiedener Kategorien auslösen, die 18:00-Zusammenfassung abwarten | Zeilen **mit** eigenem Warum tragen es; der Standardsatz der Kategorie erscheint in der Zusammenfassung **nicht** (BR-239) | | |

---

## TC-006: Die Rechnungsmail im Vereins-Look (FR-182)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** eine Abrechnungsperiode stellen und versenden (UC-046) | — | | |
| 2 | Das Postfach von **M** öffnen | Absender «\<Verein\> (myclub)», Kopfband mit Logo und Vereinsfarbe | | |
| 3 | Die Mail lesen | Betrag und Fälligkeit als beschriftete Werte; darunter «Wofür:» mit dem Satz zu den Beiträgen | | |
| 4 | Nach Mahnwörtern suchen | Kein Wort über Gebühr, Mahnung oder Verzug (BR-158) | | |
| 5 | Den Knopf «Rechnung in der App ansehen» antippen | Führt auf Profil → Rechnungen | | |
| 6 | Das PDF öffnen | Unverändert zu UC-046, QR-Einzahlungsschein vollständig | | |
| 7 | Als **V** an die Rechnung erinnern (UC-046 A8) | Die Meldung trägt den Rumpf «Fällig am …» und das Warum zu den Beiträgen – nicht mehr eine nackte Punktzahl | | |

---

## TC-007: Was ins Blatt darf (BR-242)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** den Vereinsnamen auf `Rock & <Roll>` ändern, eine Meldung auslösen | Die Mail zeigt den Namen als Text; keine kaputte Darstellung, kein ausgeführtes Markup | | |
| 2 | In den Vereinseinstellungen eine `http://`-Logoadresse eintragen (notfalls direkt in `clubs.settings`) | Die Mail zeigt kein Bild, der Vereinsname steht | | |
| 3 | Beim Anfordern eines Anmeldelinks einen erfundenen Einladungscode im Speicher hinterlegen | Die Anmeldemail trägt **keinen** fremden Verein, sondern die Grundfarbe | | |
| 4 | Einen Aufruf ohne gültige Signatur an `auth-mail` schicken (z.B. per `curl`) | Antwort 401, keine Mail | | |
| 5 | Denselben Aufruf mit einem alten Zeitstempel wiederholen | Antwort 401, Log nennt «Zeitstempel zu alt» | | |

---

## Abdeckung

| Anforderung / Regel | Testfälle |
| --- | --- |
| FR-182 | TC-001, TC-002, TC-006 |
| FR-183 | TC-001 (Schritt 8), TC-005, TC-006 (Schritt 3, 7) |
| FR-184 | TC-003, TC-004 |
| NFR-040 | TC-002 |
| BR-239 | TC-005 |
| BR-240 | TC-004 |
| BR-241 | TC-001, TC-006 |
| BR-242 | TC-007 |

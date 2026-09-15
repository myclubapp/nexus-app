# Manual Test Plan: UC-050 — Vereins-Puls persönlich gestalten

**Use Case:** [UC-050](../use_cases/UC-050-vereins-puls-persoenlich.md)
**Geltungsbereich:** Pulsmail als eigenes Blatt, Vorschau, Beiträge als vierte Quelle, Grussformel am Amt mit Porträt
**Anforderungen:** FR-188, FR-189, FR-190, FR-191, FR-192
**Regeln:** BR-248 bis BR-254, dazu BR-113, BR-114, BR-213, BR-216
**Erstellt:** 2026-09-15

## Vorbereitung

- **V** — Vorstand (`admin`), **M** — Mitglied, **T** — Mitglied genau eines Teams.
- Migration `0100_pulse_greeting_and_news.sql` ist eingespielt, die Function
  `pulse-preview` deployt und `APP_URL` gesetzt. **Ohne `APP_URL` fehlt im Blatt
  der Knopf in die App** – das ist kein Fehler dieses Use Cases, fällt aber hier
  auf.
- Das Modul «Vereins-Puls» ist eingeschaltet, der E-Mail-Kanal von **M** steht
  auf «sofort» (UC-028).
- Im Verein: ein Termin in den nächsten 14 Tagen, eine offene Aufgabe, eine
  unterbesetzte Schicht.
- **Zwei Beiträge**, beide aus den letzten 14 Tagen: einer **vereinsweit**
  (ohne Team), einer an ein **Team** gebunden.
- Ein Beitrag aus dem Website-Import (UC-038), falls vorhanden – für TC-004.
- Mindestens ein **Vorstandsamt** mit Inhaber:in (UC-041, `is_board`), dazu ein
  zweites, **unbesetztes** Vorstandsamt für TC-007.
- Ein Porträtbild als JPG oder PNG, unter 5 MiB.

---

## TC-001: Die Vorschau zeigt, was ankommt (FR-189)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** Profil → «Vereins-Puls» öffnen, bei Bedarf «Entwurf zusammenstellen» | Ein Entwurf steht da | | |
| 2 | Über dem Freigabeknopf nach «Vorschau» sehen | Der Knopf steht **über** «Freigeben» | | |
| 3 | «Vorschau» wählen | Ein Blatt öffnet sich, Umschalter «In der App» / «Als E-Mail» | | |
| 4 | «In der App» lesen | Die drei Abschnitte in fester Reihenfolge (BR-113) | | |
| 5 | Auf «Als E-Mail» umschalten | Das Mailblatt erscheint: Kopfband in der Vereinsfarbe, Logo, Anrede mit dem eigenen Namen | | |
| 6 | Die Abschnitte im Mailblatt vergleichen | Dieselben drei Abschnitte in derselben Reihenfolge (BR-248) | | |
| 7 | Nach dem Punktestand suchen | Er steht in **keiner** der beiden Ansichten; die Fussnote der App-Ansicht erklärt es (BR-114) | | |
| 8 | Das Blatt schliessen, Profil → «Vereins-Puls» neu laden | Der Entwurf ist unverändert, **nicht** versendet (BR-249) | | |
| 9 | Als **M** die Inbox prüfen | **Keine** Pulsmeldung – die Vorschau versendet nichts (BR-249) | | |
| 10 | Als **V** die Verbindungs-Quote oben ansehen | Unverändert – eine Vorschau zählt nicht als Verbindung (BR-249) | | |

---

## TC-002: Die Auswahl gilt auch für die Vorschau (BR-249)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** im Entwurf einen Eintrag **abhaken** (streichen) | Der Haken fällt weg | | |
| 2 | «Vorschau» wählen, «In der App» | Der gestrichene Eintrag fehlt | | |
| 3 | Auf «Als E-Mail» umschalten | Er fehlt auch dort | | |
| 4 | Schliessen, den Haken wieder setzen, erneut «Vorschau» | Der Eintrag ist wieder da – die Vorschau zeigt den aktuellen Stand, nicht den vorherigen | | |
| 5 | Alle Einträge streichen | «Vorschau» und «Freigeben» sind beide gesperrt | | |

---

## TC-003: Beiträge als vierte Quelle (FR-190, BR-250, BR-251)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den bestehenden Entwurf verwerfen und neu zusammenstellen | Ein frischer Entwurf entsteht | | |
| 2 | Abschnitt «Was passiert» lesen | Der **vereinsweite** Beitrag steht darin, gekennzeichnet als «Beitrag» | | |
| 3 | Die Reihenfolge im Abschnitt prüfen | Die **Termine** stehen vor den Beiträgen | | |
| 4 | Nach dem **Team**-Beitrag suchen | Er steht in **keinem** Abschnitt (BR-250) | | |
| 5 | Als **T** prüfen, ob der Team-Beitrag im Feed steht | Ja – er ist nicht verschwunden, er gehört nur nicht in den Puls | | |
| 6 | Prüfen, ob der vereinsweite Beitrag schon als Meldung kam | Er stand bereits in der Inbox – und steht trotzdem im Puls (BR-251, Entscheid) | | |
| 7 | Einen Beitrag älter als 14 Tage suchen | Er steht **nicht** im Entwurf | | |

---

## TC-004: Ein Beitrag von der Website führt hinaus (A7)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** den zugestellten Puls in der App öffnen | Der Website-Beitrag trägt den Zusatz «auf der Website» | | |
| 2 | Die Zeile antippen | Der Browser öffnet die Website – kein Sprung ins Leere | | |
| 3 | Dieselbe Stelle im Mailblatt ansehen | Dort steht «Auf der Website lesen» mit derselben Adresse | | |
| 4 | Einen Termin antippen | **Kein** externer Verweis – Termine bleiben in der App | | |

---

## TC-005: Die Grussformel einrichten (FR-191, FR-192)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** Profil → «Vereins-Puls» → «Verwalten» → «Grussformel einrichten» | Ein Blatt mit Amtswahl, vier Textfeldern und Porträt | | |
| 2 | Die Amtswahl öffnen | **Nur Vorstandsämter** stehen darin | | |
| 3 | Ein besetztes Amt wählen | Darunter erscheinen die Namen der Inhaber:innen | | |
| 4 | Nur das deutsche Feld füllen, speichern | Toast «Die Grussformel ist hinterlegt.» | | |
| 5 | Das Blatt erneut öffnen | Amt und Text stehen wieder da | | |
| 6 | Ein Porträt hochladen | Toast «Gespeichert», das Bild erscheint in der Zeile | | |
| 7 | «Vorschau» → «In der App» | Der Gruss steht **nach** den Abschnitten: Text, Name, Amt, Porträt | | |
| 8 | Auf «Als E-Mail» umschalten | Derselbe Gruss am Fuss des Blatts | | |
| 9 | Die Sprache der App auf Französisch stellen, Vorschau erneut | Der **deutsche** Text steht weiterhin da – ein hinterlegter Satz schlägt die Übersetzung, die niemand geschrieben hat | | |
| 10 | Das französische Feld füllen, speichern, Vorschau auf Französisch | Jetzt steht der französische Satz da | | |

---

## TC-006: Das Blatt ohne Gruss (A1)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | In der Grussformel alle vier Textfelder leeren und speichern | Gespeichert | | |
| 2 | Das Porträt entfernen | Gespeichert | | |
| 3 | «Vorschau» in beiden Ansichten | Das Blatt endet nach den Abschnitten – **kein** Platzhalter, keine leere Unterschrift | | |

---

## TC-007: Das Amt ist vakant (A2, BR-252)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Grussformel auf das **unbesetzte** Vorstandsamt legen, Text und Porträt hinterlegen | Gespeichert; der Hinweis nennt das Amt als unbesetzt | | |
| 2 | «Vorschau» in beiden Ansichten | Der Text bleibt, an der Stelle des Namens steht «Der Vorstand», **kein** Porträt | | |
| 3 | Im Amt eine Inhaber:in eintragen (UC-041) | Gespeichert | | |
| 4 | «Vorschau» erneut | Jetzt steht der Name da – ohne dass die Grussformel angefasst wurde (BR-252) | | |
| 5 | Die Inhaber:in wieder entfernen und die Ämterliste prüfen | Der Gruss ist **nicht** verloren – die Belegung zu ändern löscht ihn nicht | | |

---

## TC-008: Der Versand trägt das Blatt (FR-188, BR-213)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** einen Einleitungssatz schreiben und freigeben | Toast nennt die Zahl der Zustellungen | | |
| 2 | Als **M** die Inbox öffnen | «Der Vereins-Puls» steht da, mit dem Einleitungssatz | | |
| 3 | Das Postfach von **M** prüfen (bis 5 Minuten, Cron `mail-send`) | Eine Mail «<Verein>: Vereins-Puls» mit den **drei Abschnitten** – nicht eine Zeile mit Link | | |
| 4 | Den Gruss am Fuss prüfen | Text, Name, Amt; das Porträt lädt erst auf Klick, Name und Amt stehen ohne Bild da (BR-254) | | |
| 5 | Im selben Zeitraum eine zweite Meldung erzeugen (z.B. eine Aufgabe ausschreiben) | Sie kommt als **eigene** Mail; der Puls bündelt nicht mit (Ausnahme zu BR-213) | | |
| 6 | Den Knopf «In der App öffnen» antippen | Die Leseansicht des Pulses öffnet sich | | |
| 7 | Die Mail in einem zweiten Programm ansehen (Gmail-Web und Apple Mail) | Kopfband, Abschnitte und Gruss stehen; nichts ist zerfallen | | |

---

## TC-009: Reichweite (BR-250, Policy aus `0044`)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** (kein Vorstand) die Adresse `/tabs/profile/pulse` von Hand öffnen | Kein Entwurf und keine Vorschau | | |
| 2 | Als **M** einen **versendeten** Puls über die Inbox öffnen | Die Leseansicht erscheint, mit Gruss | | |
| 3 | Als Mitglied eines **anderen** Vereins die Leseadresse eines fremden Pulses öffnen | «Dieser Puls ist nicht mehr verfügbar» – nicht der Inhalt | | |

---

## TC-010: Das Porträt liegt öffentlich, das Profilbild nicht (BR-253, BR-216)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Adresse des Porträts aus dem Mailblatt kopieren | Sie beginnt mit `…/storage/v1/object/public/club-logo/…/greeting/…` | | |
| 2 | Sie in einem **abgemeldeten** Browser öffnen | Das Bild erscheint – so muss es sein, sonst wäre es in keiner Mail sichtbar | | |
| 3 | Die Adresse eines **Profilbilds** derselben Person suchen | Sie zeigt auf `club-photos` und braucht eine Signatur; abgemeldet erscheint nichts (BR-216) | | |
| 4 | Als **M** (kein Vorstand) versuchen, ein Porträt hochzuladen | Der Weg ist nicht erreichbar; ein direkter Upload wird von der Policy abgewiesen | | |

---

## Offene Punkte

- **Nach dem echten `db push`** gehört die Verhaltensprüfung aus Schritt 8 des
  Plans ohne `rollback` wiederholt: Die 21 Prüfungen liefen in einer
  zurückgerollten Transaktion und belegen das Verhalten, nicht den
  eingespielten Stand.
- TC-008 Schritt 7 braucht zwei Mailprogramme. Was dort auffällt, gehört in
  `_shared/mail.ts` und nicht in dieses Blatt – das Gerüst ist für alle Mails
  dasselbe.

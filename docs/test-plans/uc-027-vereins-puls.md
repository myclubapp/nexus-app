# Manual Test Plan: UC-027 — Vereins-Puls freigeben

**Use Case:** [UC-027](../use_cases/UC-027-vereins-puls-freigeben.md)
**Geltungsbereich:** Komposition, Freigabe, Verwerfen, automatischer Versand, Leseansicht, Verbindungs-Quote
**Anforderungen:** FR-082, FR-083, FR-084, FR-070, FR-100
**Regeln:** BR-113 bis BR-116
**Erstellt:** 2026-09-10
**Ergänzt:** 2026-09-11 (Nachtrag `0055`: Modul-Riegel, dritte Quelle, FR-100)

## Vorbereitung

- **V** — Vorstand, **M** — Mitglied.
- Im Verein: ein Termin in den nächsten 14 Tagen, eine **übernommene** Aufgabe,
  eine **offene** Aufgabe und eine unterbesetzte Schicht.
- Ein zweiter Verein **ohne** jeden Inhalt für A3.
- Migrationen `0044_club_pulse.sql` und `0055_pulse_sources.sql` sind
  eingespielt, das Modul «Vereins-Puls» ist eingeschaltet.
- Von Hand auslösen: `select public.compose_club_pulse();`

---

## TC-001: Entwurf und Freigabe (Hauptablauf)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `compose_club_pulse()` auslösen | Ein Entwurf entsteht | | |
| 2 | Als **V** die Inbox öffnen | «Der Vereins-Puls liegt bereit» (Schritt 2) | | |
| 3 | Als **M** die Inbox prüfen | **Keine** solche Nachricht – der Entwurf gehört dem Vorstand | | |
| 4 | Profil → «Vereins-Puls» öffnen | Drei Abschnitte in fester Reihenfolge: Was passiert · Woran wir arbeiten · Wo du dabei sein kannst (BR-113) | | |
| 5 | Den Inhalt prüfen | Der Termin steht oben, die übernommene Aufgabe in der Mitte, die offene Aufgabe und die Schicht unten | | |
| 6 | Prüfen, ob alles angehakt ist | Ja – wer nichts anfasst, kann sofort freigeben (BR-115) | | |
| 7 | Ohne jede Eingabe «Freigeben» wählen | Toast nennt, wie viele Personen ihn in der Inbox haben | | |
| 8 | Als **M** die Inbox öffnen | «Der Vereins-Puls» ist da | | |
| 9 | Die Nachricht antippen | Die Leseansicht öffnet sich | | |

---

## TC-002: Die Leseansicht (A4, BR-114)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** den Puls lesen | Zuoberst die drei Abschnitte | | |
| 2 | Nach unten scrollen | Der **eigene Punktestand** steht **nach** den drei Abschnitten (BR-114) | | |
| 3 | Die Fussnote dort lesen | Sie sagt, dass der Puls vom Verein handelt | | |
| 4 | Prüfen, ob Punkte irgendwo als Aufmacher stehen | Nein | | |

---

## TC-003: Streichen und Einleitung (Schritt 5)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Einen neuen Entwurf erzeugen | — | | |
| 2 | Einen Eintrag abwählen und freigeben | Der Puls enthält ihn nicht mehr | | |
| 3 | Die Leseansicht prüfen | Der gestrichene Eintrag fehlt, die übrigen stehen | | |
| 4 | Bei einem neuen Entwurf **alle** Einträge abwählen | «Freigeben» sperrt und erklärt warum | | |
| 5 | Eine Einleitung schreiben und freigeben | Sie steht in der Leseansicht zuoberst und im Text der Inbox-Nachricht | | |

---

## TC-004: Verwerfen (A2)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `club_message_log` zählen | — | | |
| 2 | «Diese Woche nicht» wählen | Toast bestätigt | | |
| 3 | `club_message_log` erneut zählen | **Kein** neuer Eintrag (A2) | | |
| 4 | Als **M** die Inbox prüfen | Nichts zugestellt | | |
| 5 | Den Hinweis unter dem Knopf lesen | Er sagt, dass die Quote weiterläuft – auch das ist eine Aussage | | |

---

## TC-005: Nichts zu berichten (A3)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Für den leeren Verein `compose_club_pulse()` auslösen | Es entsteht **kein** Entwurf | | |
| 2 | Die Seite dort öffnen | «Diese Woche liegt kein Entwurf vor» | | |
| 3 | `compose_club_pulse()` zweimal für denselben Verein auslösen | Nur **ein** Entwurf – kein zweiter | | |

---

## TC-006: Automatischer Versand (A1)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Einen Entwurf auf älter als 48 Stunden setzen | — | | |
| 2 | `auto_release_pulses()` auslösen | **Nichts** geschieht – der Verein hat es nicht eingeschaltet | | |
| 3 | `clubs.settings.pulse.autoRelease` auf `true` setzen und erneut auslösen | Der Puls geht raus, unverändert | | |
| 4 | Die freigebende Person prüfen | Keine – der automatische Versand hat keine | | |
| 5 | Einen frischen Entwurf prüfen | Er bleibt liegen, solange er jünger als 48 Stunden ist | | |

---

## TC-007: Verbindungs-Quote (FR-070, FR-084, BR-116)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** die Puls-Seite öffnen | Oben zwei Kennzahlen: «Erzählt» und «Gebeten» | | |
| 2 | Mehrere Helferaufrufe erzeugen, bis die Aufrufe überwiegen | Der Hinweis wechselt zu «Seit Wochen überwiegen die Aufrufe» | | |
| 3 | Einen Puls freigeben | Die Zahl «Erzählt» steigt (BR-116) | | |
| 4 | Die sanfte Sperre aus UC-011 prüfen | Ein Helferaufruf geht wieder mit Push raus | | |
| 5 | Als **M** `connection_ratio` direkt aufrufen | Abgewiesen – **nicht** eine Quote «0 zu 0», die wie Schweigen aussähe | | |
| 6 | Die Vereins-Gesundheit als **V** öffnen | Bei gekippter Quote steht dort der Symmetrie-Hinweis (FR-084, UC-023) | | |

---

## TC-008: Ohne Modul kein Puls (UC-034)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Das Modul «Vereins-Puls» in den Vereinseinstellungen ausschalten | Vorbereitung | | |
| 2 | Als **V** ins Profil und ins Seitenmenü sehen | «Vereins-Puls» ist **vollständig** ausgeblendet | | |
| 3 | `compose_club_pulse()` auslösen | **Kein** Entwurf, **keine** Meldung an den Vorstand | | |
| 4 | Bei eingeschaltetem Modul eines anderen Vereins prüfen | Dort entsteht der Entwurf wie gewohnt | | |
| 5 | Einen Entwurf anlegen, den automatischen Versand einschalten, dann das Modul ausschalten | `auto_release_pulses()` versendet **nicht** | | |
| 6 | Den Entwurf danach ansehen | Er steht noch als `draft` – nichts ist verloren | | |
| 7 | Das Modul wieder einschalten und erneut auslösen | Jetzt geht er raus | | |

---

## TC-009: «Aus dem Vorstand» – die Antwort als News (FR-100)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** ein Anliegen einreichen (UC-030) | Vorbereitung | | |
| 2 | Als **V** antworten, «Als News publizieren» **aus** | Antwort zugestellt, **keine** News im Feed | | |
| 3 | Ein zweites Anliegen mit eingeschaltetem Schalter beantworten | Die Antwort steht als News im Feed und in der Inbox aller | | |
| 4 | Die News prüfen | Ihr Text ist die **Antwort**, nicht das eingereichte Anliegen | | |
| 5 | Ein drittes Anliegen mit Schalter **ablehnen** | **Keine** News – ein Nein an eine Person ist keine Meldung an alle | | |
| 6 | Dasselbe an einem Sitzungs-Input (UC-031) durchspielen | Gleiches Verhalten; am Input ist die News vermerkt | | |
| 7 | Als Gremiumsmitglied ohne Vorstandsrolle einen Input beantworten | Der Schalter wird gar nicht erst angeboten | | |
| 8 | Die Verbindungs-Quote danach ansehen | Jede publizierte Antwort zählt als Verbindung (BR-111) | | |

---

## TC-010: Die dritte Quelle im Entwurf (FR-082, Schritt 1)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Zwei Antworten publizieren (TC-009) und `compose_club_pulse()` auslösen | Sie stehen unter «Woran wir arbeiten» | | |
| 2 | Die Reihenfolge prüfen | Die publizierten Antworten zuerst, die laufenden Aufgaben danach | | |
| 3 | An jedem Eintrag hinsehen | Die Art steht dabei: «Aus dem Vorstand» oder «Aufgabe» | | |
| 4 | Den **nicht** publizierten Entscheid suchen | Er steht nirgends im Puls | | |
| 5 | Das eingereichte Anliegen suchen | Es steht nirgends im Puls – auch nicht gekürzt | | |
| 6 | Eine Antwort auf ein Datum vor mehr als 14 Tagen setzen und neu komponieren | Sie fällt weg | | |
| 7 | Eine Beispiel-News als `board` markieren | Sie kommt nicht in den Puls (C-031) | | |
| 8 | Einen Eintrag streichen und freigeben | Er fehlt in der Leseansicht; die anderen stehen | | |

---

## Vier Sprachen

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch, Italienisch und Englisch stellen | Die drei Abschnittstitel, Hinweise und Meldungen sind übersetzt | | |
| 2 | Die Art der Einträge prüfen | «Termin», «Aufgabe», «Schicht», «Aus dem Vorstand» sind übersetzt | | |
| 3 | Eine Antwort in jeder Sprache publizieren | Der News-Titel «Aus dem Vorstand» erscheint in der Sprache der publizierenden Person | | |

---

## Offen

- **Der News-Titel kommt vom Client.** Publiziert jemand auf Französisch,
  heisst die Meldung «Du comité» – auch für Lesende mit deutscher Oberfläche.
  Das ist bei jeder News so, die jemand schreibt, und hier bewusst nicht
  anders gelöst: Ein serverseitig übersetzter Titel wäre der einzige Text
  dieser App, der nicht über i18next liefe.
- **Die generierten Typen prüfen die RPC-Argumente nicht.** `supabase.rpc()`
  nimmt in diesem Projekt jeden Parameternamen entgegen; die Verhaltensprüfung
  gegen die verknüpfte Datenbank ist deshalb die einzige Stelle, an der ein
  Tippfehler im Parameternamen auffällt.

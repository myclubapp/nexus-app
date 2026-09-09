# Manual Test Plan: UC-011 — Helfer-Event mit Schichten ausschreiben

**Use Case:** [UC-011](../use_cases/UC-011-helfer-event-ausschreiben.md)
**Geltungsbereich:** Schichten, Punktwert je Schicht, Warum-Pflicht, Entwurf, sanfte Sperre
**Anforderungen:** FR-030, FR-051, FR-084
**Regeln:** BR-041 bis BR-044
**Erstellt:** 2026-09-09

## Vorbereitung

- Ein Verein mit mindestens fünf Mitgliedern.
- **V** — Vorstand (admin), **T** — Trainer:in, **M** — Mitglied ohne Funktion.
- Die Regel `shift_done` («Helfereinsatz») ist aktiv.
- Migrationen `0018_helper_events.sql` bis `0021_helper_event_hardening.sql`
  sind eingespielt.
- Für TC-007 ein zweiter Verein **VB**, in dessen `clubs.settings` steht:
  `{"connection": {"muteCallsWithoutPulse": true}}`, und dessen letzter Eintrag
  in `club_message_log` mit `kind = 'connection'` **älter als 28 Tage** ist.

---

## TC-001: Helfer-Event ausschreiben (Hauptablauf)

**Priority:** High
**Preconditions:** Als **V** angemeldet, Tab «Agenda» offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Personen-Knopf in der Kopfzeile antippen | Das Blatt «Helfer-Event ausschreiben» öffnet sich | | |
| 2 | Die Abschnitte überfliegen | Angaben, «Wozu dient das?», Schichten, «Schicht hinzufügen» — in dieser Reihenfolge | | |
| 3 | Titel «Waldfest», Beginn morgen 08:00, Ende morgen 18:00, Ort «Festhütte» erfassen | Die Felder übernehmen die Eingabe | | |
| 4 | «Ausschreiben» ansehen | **Ausgegraut** – Warum und Schicht fehlen noch | | |
| 5 | Warum erfassen: «Damit das Fest den Nachwuchs finanziert» | — | | |
| 6 | Schicht erfassen: «Aufbau», 08:00–12:00, 4 Personen | Der Punktevorschlag springt auf **50** (vier Stunden, halber Tag) | | |
| 7 | «Schicht hinzufügen» antippen | Die Schicht steht in der Liste mit Zeit, «4 Personen» und «+50»; die Eingabefelder sind leer | | |
| 8 | Zweite Schicht: «Festwirtschaft», 12:00–14:00, 6 Personen | Vorschlag **25** (zwei Stunden) | | |
| 9 | Den Punktwert von Hand auf **30** setzen und hinzufügen | Die Liste zeigt «+30», nicht «+25» (BR-042) | | |
| 10 | Dritte Schicht: «Abbau», 14:00–22:00, 3 Personen | Vorschlag **100** (über fünf Stunden) | | |
| 11 | Hinzufügen und die Überschrift des Abschnitts lesen | «3 Schichten» – Plural korrekt | | |
| 12 | «Ausschreiben» antippen | Das Blatt schliesst, Toast «Helfer-Event ausgeschrieben» | | |
| 13 | Die Agenda ansehen | «Waldfest» steht da mit «0 von 13 besetzt» (4+6+3) | | |
| 14 | Als **M** die Agenda öffnen | «Waldfest» ist sichtbar; **kein** Entwurfs-Merkmal | | |
| 15 | Als **M** die Inbox öffnen | Eine Benachrichtigung zum Aufruf liegt vor (Schritt 10) | | |

---

## TC-002: Das Warum ist Publikationsvoraussetzung (A1, BR-043, FR-051)

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Ein Helfer-Event mit Titel, Datum und **einer** Schicht erfassen, das Warum leer lassen | «Ausschreiben» bleibt **ausgegraut** | | |
| 2 | Den Hinweistext unter dem Warum lesen | Er erklärt, wozu die Angabe dient – nicht bloss «Pflichtfeld» | | |
| 3 | Ein Leerzeichen als Warum eintragen | «Ausschreiben» bleibt ausgegraut (getrimmt geprüft) | | |
| 3a | Bei erfasster Schicht das Warum leer lassen | Der Hinweis nennt **das Warum** als Grund, nicht die Schicht (A1) | | |
| 4 | Ein echtes Warum eintragen | «Ausschreiben» wird bedienbar | | |
| 5 | Mit einem HTTP-Aufruf `publish_event` auf ein Helfer-Event **ohne** Warum | Fehler «Ein Aufruf braucht sein Warum, bevor er ausgeschrieben wird» | | |
| 6 | Mit einem HTTP-Aufruf ein **publiziertes** Event auf `why = ''` setzen | Der Constraint `events_why_check` weist ab | | |

---

## TC-003: Mindestens eine Schicht (Postcondition)

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Titel, Datum und Warum erfassen, keine Schicht anlegen | Unter der Schichtenliste steht «Ein Helfer-Event braucht mindestens eine Schicht.» | | |
| 2 | «Ausschreiben» ansehen | Ausgegraut | | |
| 3 | Die leere Schichtenliste ansehen | «Noch keine Schicht angelegt» statt einer leeren Fläche (NFR-037) | | |
| 4 | Mit einem HTTP-Aufruf `publish_event` auf ein Helfer-Event ohne Schicht | Fehler «Ein Helfer-Event braucht mindestens eine Schicht» | | |

---

## TC-004: Schichtprüfung (BR-041)

**Priority:** High
**Preconditions:** Als **V** angemeldet, das Blatt offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Schicht ohne Bezeichnung erfassen | «Schicht hinzufügen» bleibt ausgegraut | | |
| 2 | Bezeichnung setzen, aber kein Ende | Bleibt ausgegraut – anders als beim Termin ist das Ende Pflicht | | |
| 3 | Ende **vor** dem Beginn setzen | Bleibt ausgegraut | | |
| 4 | Ende **gleich** dem Beginn setzen | Bleibt ausgegraut – eine Schicht der Länge null gibt es nicht | | |
| 5 | Personenzahl auf 0 setzen | Bleibt ausgegraut (BR-041) | | |
| 6 | Das Feld ganz leeren | Bleibt ausgegraut, keine Absturzmeldung | | |
| 7 | Alles gültig ausfüllen | Der Knopf wird bedienbar | | |
| 8 | Mit einem HTTP-Aufruf eine Schicht mit `needed = 0` einfügen | `event_shifts_needed_check` weist ab | | |
| 9 | Mit einem HTTP-Aufruf eine Schicht mit `ends_at <= starts_at` einfügen | `event_shifts_time_check` weist ab | | |
| 10 | Mit einem HTTP-Aufruf eine Schicht mit `points = -10` einfügen | `event_shifts_points_check` weist ab (BR-066) | | |

---

## TC-005: Eine Schicht wieder entfernen

**Priority:** Medium
**Preconditions:** Drei Schichten sind in der Liste.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Fussnote der Schichtenliste lesen | «Nach links wischen, um eine Schicht zu entfernen.» | | |
| 2 | Die mittlere Schicht nach links wischen | «Entfernen» erscheint in Rot | | |
| 3 | «Entfernen» antippen | Genau diese Schicht verschwindet, die beiden anderen bleiben unverändert | | |
| 4 | Die Überschrift lesen | «2 Schichten» | | |
| 5 | Alle Schichten entfernen | Überschrift wieder Singular/leer, «Ausschreiben» wieder ausgegraut | | |
| 6 | Zwei Schichten **gleichen Namens** anlegen und die erste entfernen | Nur die erste verschwindet – die Liste verwechselt sie nicht | | |

---

## TC-006: Entwurf sichern (A2)

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Nur Titel «Herbstmarkt» und Beginn erfassen | «Als Entwurf sichern» ist bedienbar, «Ausschreiben» nicht | | |
| 2 | Den Hinweis unter dem Knopf lesen | «Ein Entwurf ist für Mitglieder nicht sichtbar und benachrichtigt niemanden.» | | |
| 3 | «Als Entwurf sichern» antippen – **ohne Warum** | Toast «Entwurf gesichert»; **keine** Datenbank-Fehlermeldung (0020) | | |
| 4 | Als **M** die Agenda öffnen | «Herbstmarkt» ist **nicht** da | | |
| 5 | Als **M** die Inbox öffnen | **Keine** Benachrichtigung zum Herbstmarkt | | |
| 6 | Als **M** mit einem HTTP-Aufruf `/rest/v1/events` alle Events lesen | Der Entwurf fehlt auch dort – die Policy verbirgt ihn, nicht die Abfrage | | |
| 7 | Als **V** die Agenda öffnen | «Herbstmarkt» steht da mit dem grauen Merkmal «Entwurf» | | |
| 8 | Als **V** «Ausschreiben» am Entwurf antippen | Fehler: das Warum fehlt noch | | |
| 9 | Einen vollständigen Entwurf (Warum + Schicht) sichern und ausschreiben | Toast «Helfer-Event ausgeschrieben»; das Merkmal «Entwurf» verschwindet | | |
| 10 | Als **M** nachsehen | Jetzt sichtbar, jetzt benachrichtigt | | |

---

## TC-007: Sanfte Sperre (A3, BR-044, FR-084)

**Priority:** High
**Preconditions:** Als **V** im Verein **VB** angemeldet (Einstellung aktiv, letzte Verbindungs-Nachricht älter als 28 Tage).

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Ein vollständiges Helfer-Event ausschreiben | Ein **Hinweis** statt der Erfolgsmeldung: kein Push, zuerst einen Vereins-Puls senden | | |
| 2 | Die Agenda ansehen | Das Event ist **sichtbar** – die Sperre unterdrückt die Zustellung, nicht die Sichtbarkeit (NFR-009) | | |
| 3 | Als Mitglied von **VB** die Inbox öffnen | **Keine** Benachrichtigung | | |
| 4 | `club_message_log` ansehen | Ein Eintrag `kind = 'call'` – der Aufruf ist ergangen, auch leiser | | |
| 5 | Eine Verbindungs-Nachricht eintragen (`log_club_message(..., 'connection', ...)`) und ein zweites Event ausschreiben | Normale Erfolgsmeldung, Push geht raus | | |
| 6 | Im Verein **ohne** die Einstellung ausschreiben, letzte Verbindung ebenfalls alt | **Keine** Sperre – sie greift nur bei ausdrücklicher Aktivierung | | |
| 7 | In einem frisch gegründeten Verein mit aktiver Einstellung ausschreiben | **Keine** Sperre – wer noch nie eine Verbindungs-Nachricht sandte, wird nicht gebremst | | |
| 8 | Als Mitglied `call_is_muted` eines **fremden** Vereins aufrufen | Kein Zugriff auf fremde Vereinsdaten (NFR-011) | | |

---

## TC-008: Wer darf ausschreiben (NFR-013, C-011)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** die Agenda öffnen | **Kein** Personen-Knopf in der Kopfzeile | | |
| 2 | Als **T** die Agenda öffnen | Der Knopf ist da | | |
| 3 | Als **M** mit einem HTTP-Aufruf `publish_event` auf ein fremdes Event | Fehler «Nur Trainer:innen und der Vorstand schreiben aus» | | |
| 4 | Als **M** mit einem HTTP-Aufruf `log_club_message` | Das Ausführungsrecht fehlt (interne Routine, NFR-013) | | |
| 5 | Als **M** mit einem HTTP-Aufruf `club_message_log` lesen | 0 Zeilen – nur der Vorstand liest den Zähler | | |
| 6 | Als **M** ein Event direkt in `events` einfügen | Die Policy weist ab | | |

---

## TC-009: Der gewöhnliche Termin bleibt sichtbar (Regression zu 0018/0020)

**Priority:** High
**Preconditions:** Als **T** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Über den Plus-Knopf einen gewöhnlichen Termin anlegen | Toast «Termin erstellt» | | |
| 2 | Als **M** die Agenda öffnen | Der Termin ist **sofort sichtbar** – er ist kein Entwurf | | |
| 3 | Am Termin nach dem Merkmal «Entwurf» suchen | Fehlt | | |
| 4 | Eine Terminserie anlegen und als **M** nachsehen | Alle Termine der Serie sind sichtbar | | |
| 5 | Zu- und absagen | Funktioniert wie in UC-010 | | |

---

## TC-009a: Punktwert 0 und Zweitausschreibung (Befunde S8, S9)

**Priority:** High
**Preconditions:** Als **V** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Schicht 08:00–12:00 erfassen | Der Vorschlag steht auf 50 | | |
| 2 | Das Punktefeld auf **0** setzen | Es bleibt bei **0** und springt nicht auf 50 zurück | | |
| 3 | Die Schicht hinzufügen | In der Liste steht «+0» | | |
| 4 | Das Punktefeld ganz leeren | Der Vorschlag kommt zurück – leer heisst «wieder vorschlagen» | | |
| 5 | Das Event ausschreiben, dann in der Agenda erneut «Ausschreiben» suchen | Der Knopf ist weg, weil das Event kein Entwurf mehr ist | | |
| 6 | Mit einem HTTP-Aufruf `publish_event` ein zweites Mal auf dasselbe Event | `notified = 0`; **keine** zweite Benachrichtigung bei den Mitgliedern | | |
| 7 | Die Inbox eines Mitglieds zählen | Genau **eine** Nachricht zu diesem Aufruf | | |

---

## TC-009b: Wer ausschreiben darf (Befund S12)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **T** (Trainer:in, nicht Vorstand) die Agenda öffnen | Der Plus-Knopf ist da, der **Personen-Knopf fehlt** | | |
| 2 | Als **T** mit einem HTTP-Aufruf `create_helper_event` | Fehler «Nur der Vorstand schreibt einen Helferaufruf aus» | | |
| 3 | Als **T** mit einem HTTP-Aufruf `publish_event` auf einen Helfer-Entwurf | Derselbe Fehler | | |
| 4 | Als **T** einen gewöhnlichen Termin anlegen | Geht weiterhin (BR-033) | | |
| 5 | Als **T** die Terminart-Auswahl im gewöhnlichen Formular ansehen | «Einsatz» steht **nicht** zur Wahl – ein Helferaufruf braucht Schichten | | |

---

## TC-010: Vier Sprachen (C-007, NFR-028)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf Französisch das Blatt öffnen | Alle Abschnitte und Feldbeschriftungen französisch | | |
| 2 | Eine Schicht hinzufügen | «1 tranche» im Singular, danach «2 tranches» im Plural | | |
| 3 | Die Personenzahl ablesen | Singular und Plural korrekt | | |
| 4 | Den Punkte-Hinweis lesen | Erklärt die Staffelung, nicht bloss «Punkte» | | |
| 5 | Den Entwurfs-Hinweis und das Merkmal «Entwurf» lesen | Übersetzt, nicht deutsch stehengeblieben | | |
| 6 | Die Meldung der sanften Sperre auslösen | Französisch | | |
| 7 | Auf Italienisch und Englisch wiederholen | Wie oben | | |

---

## TC-011: Darstellung und Netz

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Das Blatt auf dem kleinsten Gerät öffnen | Die Abschnitte sind ohne horizontales Scrollen lesbar | | |
| 2 | In ein Zeitfeld tippen | Der native Datums-/Zeitwähler öffnet sich | | |
| 3 | In das Feld «Benötigte Helfer:innen» tippen | Die **Zifferntastatur** erscheint, nicht die Buchstabentastatur | | |
| 4 | Mit acht Schichten die Liste ansehen | Sie scrollt im Blatt, die Kopfzeile bleibt stehen | | |
| 5 | Die Kopfzeile beim Scrollen beobachten | Der grosse Titel zieht sich zusammen (condense) | | |
| 6 | Im Dunkelmodus | Das Merkmal «Entwurf» und die Schichtangaben bleiben lesbar | | |
| 7 | Flugmodus ein, «Ausschreiben» antippen | Fehler **im Blatt**; die erfassten Schichten bleiben stehen | | |
| 8 | Flugmodus aus, erneut ausschreiben | Geht durch; **ein** Event, nicht zwei | | |
| 9 | Mit Bedienhilfen durch das Blatt gehen | Jedes Feld wird mit seiner Beschriftung vorgelesen (NFR-027) | | |

---

## Test Matrix

| Device / Browser | OS / Version | Screen Size | Status |
| ---------------- | ------------ | ----------- | ------ |
| Chrome (latest) | macOS / Windows | Desktop | |
| Safari (latest) | macOS | Desktop | |
| Firefox (latest) | macOS / Windows | Desktop | |
| Safari | iOS 17+ | iPhone SE (klein) | |
| Safari | iOS 17+ | iPhone 15 | |
| Chrome | Android 14+ | Pixel 7 | |
| Safari | iPadOS 17+ | iPad Gen 11 | |

---

## Summary

| Test Case | Titel | Priority | Result |
| --------- | ----- | -------- | ------ |
| TC-001 | Helfer-Event ausschreiben | High | |
| TC-002 | Das Warum ist Publikationsvoraussetzung | High | |
| TC-003 | Mindestens eine Schicht | High | |
| TC-004 | Schichtprüfung | High | |
| TC-005 | Eine Schicht wieder entfernen | Medium | |
| TC-006 | Entwurf sichern | High | |
| TC-007 | Sanfte Sperre | High | |
| TC-008 | Wer darf ausschreiben | High | |
| TC-009 | Der gewöhnliche Termin bleibt sichtbar | High | |
| TC-009a | Punktwert 0 und Zweitausschreibung | High | |
| TC-009b | Wer ausschreiben darf | High | |
| TC-010 | Vier Sprachen | High | |
| TC-011 | Darstellung und Netz | Medium | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |

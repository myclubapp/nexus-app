# Manual Test Plan: FR-157 — Kalenderübersicht der Agenda und Vorbelegung der Datumswähler

**Anforderungen:** FR-157 (Kalenderübersicht), FR-024 (Agenda), FR-023 (Termin erfassen)
**Geltungsbereich:** Dritte Sicht «Kalender» in der Agenda mit markierten Tagen (Ionic `highlightedDates`, «Using Array»), Tagesliste, «Heute»; alle `IonDatetime` mit Montag als Wochenstart, Schweizer Sprache und Stunden 00–23
**Bauteile:** `AgendaCalendar`, `DateField`, `lib/agendaCalendar.ts`, `lib/format.ts`
**Erstellt:** 2026-09-13

## Vorbereitung

- Ein Verein mit Vereinsfarbe (nicht Ionic-Blau), Team «Aktive» und einem zweiten Team.
- **M** — Mitglied im Team «Aktive», **T** — Trainer:in, **V** — Vorstand.
- Termine, die vor dem Test angelegt werden (alle im **laufenden Monat**, sofern
  nichts anderes steht):
  - **E1** Team-Termin «Aktive», **heute** 19:00
  - **E2** Vereinstermin an einem **Samstag** dieses Monats
  - **E3** Termin, der **abgesagt** ist, an einem Tag ohne weitere Termine
  - **E4** Termin im **übernächsten Monat**
  - **E5** Termin des **zweiten Teams** an einem Tag ohne Termine von «Aktive»
- Ein Tag im laufenden Monat bleibt frei von Terminen (**Leertag**).

---

## TC-001: Kalender öffnen (Hauptablauf)

**Priority:** High
**Preconditions:** Als **M** angemeldet, Sprache Deutsch.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Agenda» öffnen | Die zweite Kopfzeile zeigt drei Segmente: «Kommend», «Vergangen», «Kalender» | | |
| 2 | «Kalender» antippen | Ein Monatskalender steht als Block in der Seite (Rand und Rundung wie eine Inset-Liste); der laufende Monat ist offen, **heute** ist gewählt | | |
| 3 | Die Wochentagszeile ansehen | Sie beginnt mit **Mo**, nicht mit So | | |
| 4 | Die Tage von **E1**, **E2**, **E5** ansehen | Die Tage sind mit der **Vereinsfarbe** hinterlegt (Zahl in Vereinsfarbe auf hellem Ton) – nicht Ionic-Blau | | |
| 5 | Den Tag von **E3** ansehen | Der Tag ist **grau** gedämpft, nicht in der Vereinsfarbe | | |
| 6 | Den **Leertag** ansehen | Keine Markierung | | |
| 7 | Unter dem Kalender die Überschrift lesen | Der gewählte Tag ausgeschrieben, z. B. «Sonntag, 13. September 2026»; kein Knopf «Heute» | | |
| 8 | Die Liste darunter ansehen | **E1** steht da, mit Ampel, Zeit und Ort wie in «Kommend» | | |

---

## TC-002: Tag wählen und mit dem Termin arbeiten

**Priority:** High
**Preconditions:** TC-001 bestanden, als **M** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Tag von **E2** antippen | Der Tag wird zum gewählten Tag; die Überschrift wechselt auf diesen Samstag; **E2** steht in der Liste | | |
| 2 | Die Überschrift ansehen | Rechts steht jetzt der Knopf **«Heute»** | | |
| 3 | Die Zeile von **E2** antippen | Das Detail-Blatt öffnet sich wie aus «Kommend» | | |
| 4 | Blatt schliessen, die Zeile nach rechts wischen | Grüner Haken / rotes Kreuz erscheinen; Zusagen setzt die Ampel auf grün und zeigt den Toast | | |
| 5 | Einen **vergangenen** Tag mit Termin wählen (z. B. gestern, Termin dazu anlegen) | Die Zeile lässt sich **nicht** nach rechts wischen (kein Zu-/Absagen mehr); das Detail öffnet sich weiterhin | | |
| 6 | «Heute» antippen | Der Kalender springt auf heute, die Überschrift zeigt heute, der Knopf verschwindet | | |

---

## TC-003: Leerer Tag

**Priority:** High
**Preconditions:** Als **M** angemeldet, Sicht «Kalender».

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den **Leertag** antippen | Kalender bleibt stehen; darunter «Keine Termine an diesem Tag» mit dem Knopf **«Kommend»** | | |
| 2 | «Kommend» antippen | Die Sicht wechselt auf die Liste der kommenden Termine | | |
| 3 | Als **T** zurück in «Kalender», Leertag wählen | Der Knopf heisst **«Termin erfassen»** und öffnet das Formular | | |

---

## TC-004: Blättern und Fenster der Markierungen

**Priority:** High
**Preconditions:** Als **M** angemeldet, Sicht «Kalender», heute gewählt.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Zweimal «nächster Monat» antippen (ohne einen Tag zu wählen) | Der Tag von **E4** ist markiert – die Markierungen reichen ohne Nachladen zwölf Monate voraus | | |
| 2 | Den Tag von **E4** antippen | Kurz ein Skelett, dann **E4** in der Liste; die Überschrift zeigt den Tag | | |
| 3 | Vier Monate zurück blättern | Termine dort (falls vorhanden) sind markiert – das Fenster reicht drei Monate hinter den gewählten Monat; weiter zurück fehlen Markierungen, bis ein Tag gewählt wird | | |
| 4 | Den Monat über die Überschrift «Monat Jahr» wechseln (Jahr-Wähler) | Funktioniert; danach einen Tag wählen lädt den Monat | | |
| 5 | Nach unten ziehen (Aktualisieren) | Monat und Markierungen werden neu geladen, ohne Fehler | | |

---

## TC-005: Filter wirkt auch im Kalender

**Priority:** Medium
**Preconditions:** Als **V** angemeldet (Team-Filter sichtbar), Sicht «Kalender».

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Filter öffnen, Team «Aktive» wählen, anwenden | Der Tag von **E5** verliert seine Markierung; **E1** und **E2** (Vereinstermin) bleiben markiert | | |
| 2 | Den Tag von **E5** antippen | «Keine Termine an diesem Tag» mit dem Knopf **«Filter zurücksetzen»** | | |
| 3 | Filter zurücksetzen | **E5** ist wieder markiert und steht in der Liste | | |

---

## TC-006: Datumswähler in den Formularen

**Priority:** High
**Preconditions:** Als **T** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Plus → «Termin erfassen», das Feld «Beginn» antippen | Der Wähler öffnet sich; die Wochentagszeile beginnt mit **Mo** | | |
| 2 | Die Uhrzeit wählen | Die Stunden laufen **00 bis 23**, kein AM/PM | | |
| 3 | Einen **Samstag** und einen **Sonntag** wählen | Beide sind wählbar (Spiele fallen auf Wochenenden) | | |
| 4 | Dasselbe in «Aufgabe ausschreiben» (Fälligkeit), «Helfer-Event» (Beginn/Ende), Vereinseinstellungen (Saisonstart), Einladung (Gültig bis) | Überall Mo als Wochenstart und 00–23 | | |
| 5 | Sprache auf **Englisch** stellen, «Beginn» erneut öffnen | Der Wähler bleibt bei **Monday** und **00–23** (kein 12-Stunden-Format); Monatsname englisch | | |
| 6 | In der Agenda einen Termin um 00:05 anzeigen (Englisch) | Die Zeile zeigt **00:05**, nicht «12:05 AM» | | |

---

## TC-007: Vier Sprachen

**Priority:** High
**Preconditions:** Sicht «Kalender».

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Deutsch | Segment «Kalender», Monatsname und Wochentage deutsch, Überschrift «Sonntag, 13. September 2026», Leertag «Keine Termine an diesem Tag» | | |
| 2 | Französisch | «Calendrier», Monat/Wochentage französisch, «dimanche 13 septembre 2026», «Aucun événement ce jour-là» | | |
| 3 | Italienisch | «Calendario», «domenica 13 settembre 2026», «Nessun evento in questo giorno» | | |
| 4 | Englisch | «Calendar», «Sunday 13 September 2026», «No events on this day» | | |
| 5 | Mit VoiceOver/TalkBack über die Pfeile fahren | Sie heissen «Previous month»/«Next month» – englisch in jeder Sprache: bekannte Grenze von Ionic, in `docs/guidelines.md` §8 vermerkt | | |

---

## TC-008: Darstellung

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | iPhone, Hellmodus | Kalender weiss auf dem grauen Grund der Seite, abgerundet; Markierungen in der Vereinsfarbe | | |
| 2 | iPhone, Dunkelmodus | Kalender auf dunkler Zeilenfläche; Markierungen lesbar | | |
| 3 | Android | Dieselbe Sicht, Material-Kalender; Wochenstart Mo | | |
| 4 | PWA im Browser, Fensterbreite 1200 px | Der Kalender füllt die Breite des Inhalts (wie die Inset-Listen); nichts läuft über den Rand | | |
| 5 | Zwischen «Kommend» → «Kalender» → «Vergangen» wechseln | Kein Flackern, kein Skelett in «Kommend», wenn die Liste schon geladen war | | |

---

## Test Matrix

| Gerät / Umgebung | TC-001 | TC-002 | TC-003 | TC-004 | TC-005 | TC-006 | TC-007 | TC-008 |
| ---------------- | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ |
| iPhone (iOS)     |        |        |        |        |        |        |        |        |
| Android          |        |        |        |        |        |        |        |        |
| PWA (Browser)    |        |        |        |        |        |        |        |        |

## Summary

| TC | Titel | Priority | Result |
| -- | ----- | -------- | ------ |
| TC-001 | Kalender öffnen | High | |
| TC-002 | Tag wählen und mit dem Termin arbeiten | High | |
| TC-003 | Leerer Tag | High | |
| TC-004 | Blättern und Fenster der Markierungen | High | |
| TC-005 | Filter wirkt auch im Kalender | Medium | |
| TC-006 | Datumswähler in den Formularen | High | |
| TC-007 | Vier Sprachen | High | |
| TC-008 | Darstellung | Medium | |

## Issues Found

| # | TC | Beschreibung | Schwere | Status |
| - | -- | ------------ | ------- | ------ |

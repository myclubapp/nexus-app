# Implementation Plan: UC-014 — QR-Check-in am Termin

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                            |
| **Goal**          | Die eigene Anwesenheit am Termin erfassen und die zugehörigen Punkte erhalten |
| **Plan created**  | 2026-09-09                                                          |
| **Status**        | Done                                                                |

## Overview

Der Check-in ist die häufigste Punktequelle des Systems und zugleich die
heikelste: Er behauptet, jemand sei irgendwo gewesen. Was das beweist, ist der
Code – und nur, solange er ein Geheimnis ist.

Genau daran fehlte es. `events.qr_token` stand seit 0003 als gewöhnliche
Spalte in `events`, und `events_read` erlaubt jedem Vereinsmitglied das Lesen
der ganzen Zeile. Jedes Mitglied konnte das Token über `/rest/v1/events`
abholen und von zu Hause aus einchecken; das Zeitfenster hielt, die Anwesenheit
nicht.

## Related Use Cases

- UC-009 Termin erstellen — legt den Termin und damit das Token an
- UC-010 Zu- und absagen — dieselbe Tabelle, andere Spalte
- UC-013 Schicht bestätigen — die Erfassung von Hand nach demselben Muster
- UC-020 Punktestand einsehen — zeigt, was hier gebucht wurde

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel            | Status      | Notizen                                                    |
| ------ | ---------------- | ----------- | ---------------------------------------------------------- |
| FR-033 | QR-Check-in      | Implemented | `CheckInScanner`, Puffer bei fehlendem Netz                |
| FR-034 | QR-Code anzeigen | Implemented | `EventQr`; das Token liest nur, wer den Termin leitet       |
| FR-039 | Punktebuchung bei Teilnahme | Implemented | Scan und Erfassung von Hand buchen über `award_points()` |

### Business Rules

| ID     | Regel                     | Status      | Notizen                                                                |
| ------ | ------------------------- | ----------- | ---------------------------------------------------------------------- |
| BR-054 | Zeitfenster des Check-ins | Implemented | 30 Minuten vor Beginn bis Ende; ohne Endzeit drei Stunden. Nachgemessen |
| BR-055 | Token je Termin           | Implemented | Eigene Tabelle, Zufallswert, Trigger beim Anlegen                      |
| BR-056 | Serverseitige Prüfung     | Implemented | Der Client kennt das Token gar nicht – er kann die Prüfung nicht ersetzen |
| BR-057 | Eine Anwesenheit pro Termin | Implemented | Dedupe über `(member_id, rule_code, source_id)`; nachgemessen          |
| BR-058 | QR-Scan ohne fremde SDKs  | Implemented | `html5-qrcode` im WebView, unverändert seit 0003                       |

### Non-Functional Requirements

| ID      | Titel              | Kategorie    | Trifft zu | Notizen                                              |
| ------- | ------------------ | ------------ | --------- | ---------------------------------------------------- |
| NFR-010 | Offline-Check-in   | Availability | Ja        | 24 Stunden Puffer, serverseitig validiert nachgesendet |
| NFR-016 | QR-Token-Gültigkeit| Security     | Ja        | Fenster in der Funktion, nicht im Client              |
| NFR-011 | Mandantentrennung  | Security     | Ja        | Policy auf `event_qr_tokens`; Rollenprüfung in beiden Funktionen |
| NFR-028 | Sprachparität      | Usability    | Ja        | Auch jede Fehlermeldung des Servers                   |

---

## Umsetzung

- `supabase/migrations/0029_qr_check_in.sql`
  - `event_qr_tokens` mit eigener Policy: lesen darf, wer den Termin leitet.
    Eine Spaltenberechtigung wäre kürzer gewesen, hätte aber jedes `select *`
    der App gebrochen.
  - Trigger `events_issue_qr_token`: Jeder neue Termin bekommt sein Token –
    auch die aus `create_helper_event()` und aus Serien-Inserts.
  - `events.qr_token` gelöscht; die Spalte war ein offenes Geheimnis ohne Zweck.
  - `check_in()` liest aus der geschützten Tabelle und prüft zusätzlich, ob der
    Termin abgesagt wurde.
  - `mark_attendance()` für A6 und `event_roster()` für Schritt 2 und A6.
- `app/src/lib/checkInQueue.ts` — reine Puffer-Logik, 13 Tests.
- `app/src/lib/checkInError.ts` — Serverfehler zu Übersetzungsschlüsseln, 8 Tests.
- `app/src/hooks/useCheckIn.ts` — Token, Teilnehmerliste, Erfassung, Scan und
  das Nachsenden.
- `app/src/components/CheckInModal.tsx` (Bestätigung mit Punktzahl),
  `EventQrModal.tsx` (Code und Teilnehmerliste, 9 Tests).
- Das Nachsenden hängt an `TabsPage`, der Hülle, die die ganze angemeldete
  Zeit über steht.

---

## Verhaltensprüfung gegen die laufende Datenbank

Fünfzehn Prüfungen, in einer Transaktion, die sich zum Schluss selbst
zurückrollt.

| #  | Prüfung                                          | Ergebnis                     |
| -- | -------------------------------------------------- | ---------------------------- |
| 1  | Token beim Anlegen vergeben (Trigger)              | ja                           |
| 2  | `events.qr_token` entfernt                         | ja                           |
| 3  | Mitglied liest das Token                           | **0 Zeilen**                 |
| 4  | Falscher Code                                      | abgewiesen (A2)              |
| 5  | Check-in im Fenster                                | 10 Punkte                    |
| 6  | Zweiter Scan                                       | 0 Punkte, «schon» (A4)       |
| 7  | Buchungen zum Termin                               | 1 (BR-057)                   |
| 8  | Drei Stunden vor Beginn                            | abgewiesen (A1)              |
| 9  | 25 Minuten vor Beginn                              | 10 Punkte (BR-054)           |
| 10 | Ohne Endzeit, 3 Stunden 5 Minuten nach Beginn      | abgewiesen (BR-054)          |
| 11 | A6: von Hand erfasst                               | 10 Punkte                    |
| 12 | A6: zweimal erfasst                                | 0 Punkte (BR-057)            |
| 13 | Teilnehmerliste für Trainer:innen                  | vorhanden                    |
| 14 | Mitglied liest die Teilnehmerliste                 | abgewiesen                   |
| 15 | Mitglied erfasst Anwesenheit                       | abgewiesen (BR-033)          |

---

## Befunde des Code-Reviews (`ai-code-review`)

Vierzehn Befunde. Die Token-Umstellung selbst hielt der Prüfung stand – die
belastbaren Funde lagen im Client, und zwei davon hätten den Hauptablauf auf
dem Gerät unbrauchbar gemacht.

| #  | Befund                                                                                                                                                        | Schwere | Erledigt in |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| 1  | **Der Check-in-Knopf verschwand genau im gültigen Fenster.** Er hing an `respondable`, das mit dem Terminbeginn erlischt, und die Agenda teilt bei `starts_at`. Wer um 19:05 die Halle betrat, fand den Termin unter «Vergangen» – ohne Knopf, obwohl der Server bis 20:30 bucht. Erreichbar war der Hauptablauf nur in den 30 Minuten **vor** Beginn. | Hoch | `checkInWindow.ts` + `AgendaPage.tsx` |
| 2  | **A5 griff auf iOS gar nicht.** WebKit meldet einen Netzfehler als «TypeError: Load failed», erkannt wurde nur «Failed to fetch». Auf der Hauptplattform wurde nichts gepuffert – NFR-010 fiel vollständig aus. | Hoch | `checkInError.ts` |
| 3  | **Ein neuer Puffereintrag ging beim Nachsenden verloren.** `flush()` schrieb den Schnappschuss blind zurück und löschte, was währenddessen gescannt wurde – ohne Buchung und ohne Meldung, obwohl Zustellung zugesagt war. | Mittel | `dropFromQueue()` |
| 4  | **Ein abgewiesener Nachsende-Versuch verschwand stumm.** Genau im Normalfall des Puffers: Scan im Untergeschoss um 19:05, Empfang um 20:40, Fenster zu, Eintrag gelöscht. Die Person glaubte, eingecheckt zu sein. | Mittel | Meldung beim Nachsenden |
| 5  | **Die Kamera blieb an**, wenn das Blatt vor dem Kamerastart geschlossen wurde: `isScanning` steht dann noch auf `false`, und `stop()` unterblieb. | Mittel | `.then()` prüft den Abbruch |
| 6  | **Nach einem Fehler liess sich nicht erneut scannen** (A2). Der Riegel gegen Mehrfach-Erkennung war dieselbe Variable wie das Aufräum-Signal. | Mittel | eigener `busyRef` |
| 7  | **Ein Kamerafehler wurde als Check-in-Fehler gemeldet** – die Person versuchte es endlos, ohne zu erfahren, dass die Kamera-Erlaubnis fehlt. | Mittel | eigener Schlüssel `camera` |
| 8  | **Serverfehler aus A6 gingen unübersetzt auf den Bildschirm** – ausgerechnet dort, wo die Übersetzungsschicht schon bestand. | Mittel | `checkInErrorKey` auch im QR-Blatt |
| 9  | `mark_attendance()` prüfte weder Absage noch Entwurf noch Teamzugehörigkeit; über den RPC liessen sich Punkte für einen Anlass buchen, der nicht stattfand. | Niedrig | 0030 |
| 10 | `issue_event_qr_token()` ohne `revoke` – praktisch harmlos, aber die Regel ist ausnahmslos formuliert. | Niedrig | 0030 |
| 11 | Die Migration war nicht wiederholbar: Ein zweiter Lauf scheiterte an der bereits gelöschten Spalte. | Niedrig | 0029 (`do`-Block) |
| 12 | Zwei gegensätzliche Aktionen trugen denselben Text; unterschieden wurde nur über `fill` – für Bedienhilfen gar nicht (NFR-027). | Niedrig | «Zurücknehmen» |
| 13 | Toter Code: `hasPendingCheckIn`, das ungenutzte `pending` und eine Invalidierung auf einen Schlüssel, den es nicht gibt. | Niedrig | entfernt |
| 14 | Dokumentations-Drift: `qr_token` stand noch im Entitätsmodell, UC-014 im Verzeichnis auf «Draft». | Niedrig | beides nachgezogen |

Bestätigt hat der Review, was tragen sollte: kein Lesepfad zum Token für ein
gewöhnliches Mitglied – weder über `/rest/v1/event_qr_tokens`, noch über
PostgREST-Embedding, noch über eine der Funktionen; der Trigger greift für
jeden Einfügepfad einschliesslich `create_helper_event()` und der Serie; der
Ledger bucht genau einmal, gleich in welcher Reihenfolge gescannt und markiert
wird; und die Grants folgen der Vorlage 0007.

---

## Missing Pieces

| #   | Was noch fehlt                                                                    | Anforderung | Quelle     |
| --- | ----------------------------------------------------------------------------------- | ----------- | ---------- |
| 1   | Der Puffer meldet sich nicht sichtbar in der App – man erfährt erst beim Scannen davon | A5         | Automated  |
| 2   | Kein Weg, ein Token zu erneuern, falls ein Code abfotografiert wurde                 | BR-055      | Spec-Lücke |
| 3   | `mark_attendance()` prüft das Zeitfenster **nicht** – bewusst, siehe Risiko 1        | A6          | —          |
| 4   | A3 «automatische Erinnerung» und der Puffer-Hinweis in der App fehlen weiterhin      | A5          | Automated  |

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                        | Impact | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------- |
| 1   | `mark_attendance()` kennt kein Zeitfenster. Bewusst: Die Trainer:in trägt oft erst nach dem Training nach, und BR-054 gilt dem **Code**, nicht der Erfassung. Damit lässt sich Anwesenheit aber auch lange rückwirkend buchen. | Medium | Stakeholder |
| 2   | Der Puffer liegt in `localStorage` und damit im Gerät. Wer die App löscht, verliert ungesendete Check-ins. Für 24 Stunden vertretbar; eine robustere Ablage wäre IndexedDB. | Low | Dev |
| 3   | Gedruckte Codes aus der Zeit vor 0029 bleiben gültig – die Token wurden übernommen. Wer einen alten Code abfotografiert hat, kann ihn im Zeitfenster weiterhin nutzen. Ein Erneuern fehlt (Lücke 2). | Medium | Dev |

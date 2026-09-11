# Implementation Plan: UC-028 — Benachrichtigungen einstellen

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Mitglied                                                            |
| **Goal**          | Selbst bestimmen, was einen auf welchem Kanal erreicht               |
| **Plan created**  | 2026-09-10                                                          |
| **Status**        | Done (FR-079 bleibt bewusst offen)                                  |

## Overview

Seit UC-015 steht in jedem Plan derselbe offene Punkt: **Push fehlt.** Dieser
Use Case ist der Ort, an dem er hingehört – und zugleich der Ort, an dem sich
zeigt, dass er sich nicht vollständig schliessen lässt. Der Transport (APNs,
ntfy, Web Push VAPID) verlangt Schlüssel, einen eigenen Dienst und
Plattform-Konfiguration, die dieses Repository nicht hat.

Was sich **vollständig** bauen lässt, ist alles davor: die Matrix aus
Kategorien und Kanälen, die stillen Zeiten, die registrierten Geräte – und vor
allem die Regel, dass die Inbox nicht abschaltbar ist (BR-117).

Der Zuschnitt vermeidet dabei die Falle, in die dieser Use Case sonst liefe:
Eine Einstellung, die nur gespeichert wird und nirgends wirkt, ist Zierde.
Deshalb wertet `notify()` sie **beim Entstehen jeder Benachrichtigung** aus und
hält das Ergebnis an der Zeile fest. Die Einstellungen wirken damit ab sofort –
auch wenn der Versand selbst noch fehlt.

## Related Use Cases

- UC-015 In-App-Inbox — der Kanal, der nicht abschaltbar ist
- UC-026 News, UC-027 Puls, UC-023 Hinweise — die Quellen der Kategorien
- UC-005 Anmelden — die E-Mail-Zustellung, die BR-120 unberührt lässt

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                  | Status vorher | Ziel        | Notizen                                                       |
| ------ | ---------------------- | ------------- | ----------- | ------------------------------------------------------------- |
| FR-079 | Push-Benachrichtigung  | Open          | **Partial** | Die **Anmeldung** des Geräts steht seit dem Nachtrag vom 2026-09-11 (Web Push/VAPID). Der **Versand** verlangt APNs-Schlüssel, einen ntfy-Dienst und den privaten VAPID-Schlüssel – nichts davon liegt im Repository |
| FR-080 | Granulare Einstellungen | Open         | Implemented | Matrix aus Kategorie und Kanal, wirksam ab der nächsten Zustellung |
| FR-081 | Stille Zeiten          | Open          | Implemented | Tägliches Fenster; die Inbox füllt sich weiter                 |

### Business Rules

| ID     | Regel                             | Ziel        | Notizen                                                   |
| ------ | --------------------------------- | ----------- | --------------------------------------------------------- |
| BR-117 | Die Inbox ist nicht abschaltbar   | Implemented | `notify()` schreibt die Zeile **immer**; abwählbar ist nur der Push-Vermerk |
| BR-118 | Einstellungen je Kategorie und Kanal | Implemented | Nachgemessen an jeder Kategorie                        |
| BR-119 | Push ohne fremde Infrastruktur    | **Offen**   | Betrifft den Transport – siehe FR-079                      |
| BR-120 | Sicherheitsrelevante Zustellungen | Implemented | Anmeldelinks laufen über Supabase Auth per E-Mail und berühren `notify()` nicht – nachgemessen |

---

## Current State

- `supabase/migrations/0004_tasks_news.sql`: `notifications`, `push_tokens` –
  die Tabelle für Geräte steht seit dem ersten Tag und ist **leer geblieben**.
- `supabase/migrations/0010_join_requests.sql`: `notify()` – schreibt
  bedingungslos in die Inbox.
- `app/src/pages/InboxPage.tsx`: der Lesepfad.

Es gibt weder Einstellungen noch eine Geräteliste noch stille Zeiten.

---

## Missing Pieces

| #   | Was fehlt                                              | Anforderung | Quelle          |
| --- | ------------------------------------------------------ | ----------- | --------------- |
| 1   | Keine Einstellungen je Kategorie                        | FR-080      | Automated       |
| 2   | Keine stillen Zeiten                                    | FR-081      | Cross-reference |
| 3   | Keine Geräteliste, kein Abmelden                        | A4          | Cross-reference |
| 4   | Nichts wertet die Einstellungen aus                     | BR-118      | Cross-reference |
| 5   | Der Transport selbst                                    | FR-079      | Cross-reference |

---

## Implementation Guidelines

- **Bauteile:** `AppPage`, `ListSection`, `IonToggle` je Kategorie,
  `IonInput type="time"` für das Fenster. **Keine** neue Komponente.
- **Struktur:** Logik nach `app/src/lib/notifications.ts`, Datenzugriff in
  `hooks/useNotificationSettings.ts`, Migration `0045_notification_settings.sql`.

---

## Implementation Tasks

- [x] 1. Migration `0045_notification_settings.sql`: `notification_settings`,
      `push_wanted` an `notifications`, `notify()` wertet aus,
      `set_notification_settings()`, `forget_device()`
- [x] 2. `lib/notifications.ts`: Kategorien, stille Zeiten
- [x] 3. `hooks/useNotificationSettings.ts`
- [x] 4. `pages/NotificationsPage.tsx` samt Route und Einstieg
- [x] 5. Vier Sprachen
- [x] 6. Verhaltensprüfung gegen die laufende Datenbank
- [x] 7. `ai-code-review` und Behebung der Befunde
- [x] 8. Vitest
- [x] 9. Manueller Testplan `docs/test-plans/uc-028-benachrichtigungen.md`
- [x] 10. Statusabgleich, inklusive `entity_model.md`

### Nachtrag vom 2026-09-11: das Gerät anmelden (A1, A2)

Ein Befund derselben Klasse wie bei UC-009 und UC-011: `usePushDevices()`
listete registrierte Geräte, `useForgetDevice()` meldete sie ab – **registrieren
konnte die App keines**. Die Liste war deshalb immer leer, und A1 Schritt 2
(«registriert das System das Gerät für den zur Plattform passenden Push-Kanal»)
fand nirgends statt.

- [x] 11. `lib/push.ts`: Bereitschaft, VAPID-Schlüssel, Anmeldung als Kennung
- [x] 12. `hooks/usePushRegistration.ts`: Erlaubnis holen, abonnieren, speichern
- [x] 13. `NotificationsPage`: der Knopf – und die vier Gründe, aus denen es
      nicht geht, als **Auskunft** statt als Fehlermeldung (A2)
- [x] 14. `VITE_VAPID_PUBLIC_KEY` in `.env.example`; ohne ihn sagt die Ansicht,
      dass Push in dieser Installation nicht eingerichtet ist
- [x] 15. Vier Sprachen und Vitest (9 Tests)

**FR-079 bleibt trotzdem nicht `Implemented`, sondern `Partial`:** Der
**Versand** fehlt weiterhin. Was jetzt steht, ist die Hälfte, ohne die er
nichts ausrichten könnte – eine Anmeldung, die er abholen kann. Der private
VAPID-Schlüssel gehört dem Versanddienst und kommt in dieser App nirgends vor
(CLAUDE.md: kein Google, also Web Push, APNs und ntfy).

---

## Umsetzung

- `supabase/migrations/0045_notification_settings.sql`
  - `notification_settings` je **Konto**; eine fehlende Kategorie gilt als
    erlaubt – sonst wäre jede neue Kategorie stillschweigend stummgeschaltet.
  - `push_decision()` – die Auswertung, einzeln prüfbar. Sie beantwortet drei
    Fälle: sofort, gar nicht, oder später (stille Zeit).
  - `notify()` wertet sie beim Entstehen **jeder** Benachrichtigung aus und
    hält das Ergebnis an der Zeile fest (`push_wanted`, `push_after`). Die
    Zeile selbst entsteht immer (BR-117).
  - `set_notification_settings()`, `forget_device()` (A4).
  - Ein Index über die offenen Push-Zeilen – das ist alles, was der spätere
    Versand braucht.
- `app/src/lib/notifications.ts`, `hooks/useNotificationSettings.ts`,
  `pages/NotificationsPage.tsx`.

---

## Verhaltensprüfung gegen die laufende Datenbank

19 Prüfungen in einer Transaktion, die sich zum Schluss selbst zurückrollt.

| #     | Prüfung                                                       | Ergebnis                   |
| ----- | ------------------------------------------------------------- | -------------------------- |
| 1–3   | Ohne Einstellungen: erlaubt, Zeile entsteht, `push_wanted`     | true / 1 / true            |
| 4–6   | Abgewählt / erlaubt / **ohne Eintrag**                         | false / true / **true**    |
| 7–8   | BR-117: zwei Zeilen in der Inbox, nur eine mit `push_wanted`   | hält                       |
| 8b    | **Kategorien nach dem Setzen stiller Zeiten**                  | `false` – bleiben erhalten |
| 9–11  | Stille Zeit 22–07: nachts nachgeholt auf 07:00, nachmittags sofort, um 23 Uhr später | A3 hält |
| 12    | Halbes Fenster                                                 | abgewiesen                 |
| 13–14 | Fremde Einstellungen lesen / setzen                            | **0** / A unverändert      |
| 15–16 | A4: fremdes Gerät / eigenes Gerät                              | abgewiesen / abgemeldet    |
| 17–18 | Offene Push-Zeilen im Index, Rechte                            | 1 / `anon` nein            |

---

## Befunde des Code-Reviews (`ai-code-review`)

| #  | Befund                                                                                                          | Schwere | Erledigt in |
| -- | ------------------------------------------------------------------------------------------------------------------ | ------- | ----------- |
| 1  | **Das Setzen stiller Zeiten löschte die ganze Kategorien-Matrix.** Der Rückgriff im `on conflict` zeigte auf `excluded.push` – dort steht aber bereits `coalesce(p_push, '{}')`, also nie `null`. Der beabsichtigte «unverändert»-Fall konnte nie eintreten. Von der eigenen Prüfung gefunden, bevor der Review begann. | **Hoch** | 0045 |
| 2  | Die Seite kopierte den Serverstand per Effekt in den Zustand – ein zweiter Durchlauf für nichts, und der Umschalter sprang beim ersten Laden kurz. Der Entwurf entsteht jetzt **während des Renderns**. Nebenbei: die einzige Lint-Warnung, die diese Sitzung eingeführt hatte, ist damit weg. | Mittel | `NotificationsPage` |

Bestätigt hat der Review: BR-120 hält – kein `notify()`-Aufruf betrifft
Anmeldung oder Kontolöschung, beides läuft über Supabase Auth per E-Mail
(nachgezählt: **0** Treffer).

---

## Tests

- `app/src/lib/notifications.test.ts` – 8 Tests, darunter der Fall, der am
  leichtesten falsch läuft: Eine Kategorie **ohne Eintrag** ist erlaubt, nicht
  stumm.
- Manueller Testplan: `docs/test-plans/uc-028-benachrichtigungen.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                          | Impact | Owner       |
| --- | ---------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | **FR-079 bleibt offen, und das ist eine Entscheidung.** Der Transport braucht einen APNs-Schlüssel, einen betriebenen ntfy-Dienst und ein VAPID-Paar. Diese Umsetzung baut alles davor, sodass der Versand später nur noch die Zeilen mit `push_wanted` abholen muss. | **High** | Stakeholder |
| 2   | **Die Einstellungen hängen am Konto, nicht an der Mitgliedschaft.** Wer in zwei Vereinen ist, hat eine Einstellung. Die Alternative wären zwei Matrizen für dieselbe Person – das erschien mehr Last als Nutzen. | Medium | Stakeholder |
| 3   | A3 sagt «holt es danach nach». Umgesetzt: Die Zeile trägt `push_wanted = false` mit dem Grund «stille Zeit» und einen Zeitpunkt, ab dem sie zugestellt werden darf. Nachholen kann erst der Versand. | Medium | Dev |
| 4   | Die Kategorien der Spezifikation und die Werte im Code decken sich nicht eins zu eins («Anliegen» gibt es noch nicht, `join_request` steht nicht in der Spezifikation). Umgesetzt sind die Werte, die `notify()` tatsächlich verwendet; die Oberfläche fasst sie so zusammen, wie die Spezifikation sie nennt. | Low | Dev |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-10 | Plan erstellt |
| 2026-09-10 | `0045` eingespielt, 19 Prüfungen gegen die laufende Datenbank |
| 2026-09-10 | Code-Review: zwei Befunde, behoben |
| 2026-09-10 | Tests, manueller Testplan, Statusabgleich – Plan abgeschlossen; FR-079 bleibt offen |

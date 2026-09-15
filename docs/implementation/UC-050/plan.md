# Implementation Plan: UC-050 — Vereins-Puls persönlich gestalten

|                   |                                                                     |
| ----------------- | ------------------------------------------------------------------- |
| **Primary Actor** | Vorstand                                                            |
| **Goal**          | Der Puls erreicht die Mitglieder als ganzes Blatt – mit den Beiträgen des Vereins, einem Gruss am Amt und einer Vorschau vor dem Versand |
| **Plan created**  | 2026-09-15                                                          |
| **Status**        | Open                                                                |

## Overview

Sandros Wunsch vom 15.09.2026: «Der Vereins-Puls soll persönlicher werden.»
Dahinter stehen vier Teile und drei Entscheide.

**Die Entscheide:**

| Frage | Entscheid |
| --- | --- |
| Wer grüsst? | **Das Amt**, nicht die Person – bei Amtsübergabe wechselt die Unterschrift mit (BR-252) |
| Beitrag, der schon als Meldung kam? | **Steht im Puls erneut** – der Puls ist der Wochenrückblick (BR-251) |
| Ansprache du/Sie | Eigener Use Case (UC-049), **nicht Teil dieses Strangs** |

**Der Befund, der diesen Use Case dringend macht:** Die Pulsmail gibt es nicht.
`release_pulse()` in `0044` ruft `notify()` mit dem Titel «Der Vereins-Puls»
und dem Einleitungssatz als Rumpf – per E-Mail kommt eine einzelne
Meldungszeile mit Link, nie die drei Abschnitte. Zwei Jahre Konzept über «die
drei Fragen der Vision» (K2, BR-113), und im Postfach steht ein Teaser.
Aufgefallen ist es niemandem, weil es keine Vorschau gab: FR-188 und FR-189
gehören deshalb in denselben Schnitt.

**Was schon dasteht und nicht neu gebaut wird** (Hinweis aus der
Parallelsitzung nexus-app-f9, die `0096` gebaut hat):

- `notifications.mail_template` plus `notify(..., p_why, p_template)` – eine
  Zeile mit eigenem Blatt bekommt in `send-mail` ihre **eigene** Gruppe und
  damit ihre eigene Mail, auch wenn im selben Lauf weitere Meldungen für
  dieselbe Person fällig sind (ausdrückliche Ausnahme zu BR-213).
- Das Blatt selbst in `_shared/mail.ts`: `renderShell` plus `paragraph`,
  `heading`, `steps`, `facts`, `button`, `linkLine`, `whyLine`, `notice`,
  `escapeHtml`, `safeUrl`.
- `pending_mail()` in der Fassung aus `0096` – **diese** wird erweitert, nicht
  die aus `0084`.
- `0096` ist seit dem 15.09.2026 eingespielt; `0098` schliesst an – `0097` und `0099` waren in der Zwischenzeit von zwei anderen Sitzungen belegt und remote eingetragen.

## Related Use Cases

- **UC-027** Vereins-Puls freigeben – der Ablauf, den dieser Use Case erweitert. Schritte 1 bis 8 bleiben, neu sind die vierte Quelle, die Vorschau und der Gruss
- **UC-026** News publizieren – die Quelle der Beiträge (`news.source = 'club'`)
- **UC-038** Website-News übernehmen – die zweite Quelle (`news.source = 'website'`)
- **UC-041** Funktionärsamt mit Factsheet – das Amt, an dem die Grussformel hängt
- **UC-044 / UC-048** Mail-Strecke – Versandweg, Blatt und `pending_mail()`
- **UC-045** Bilder des Vereins – der öffentliche Speicher für das Porträt
- **UC-049** Ansprache des Vereins – läuft getrennt; die Texte dieses Blatts brauchen später ihre Sie-Fassung

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                     | Status vorher | Ziel        | Notizen                                                        |
| ------ | ------------------------- | ------------- | ----------- | -------------------------------------------------------------- |
| FR-188 | Puls als eigenes Mailblatt | Draft        | Implemented | `p_template => 'pulse'` in `release_pulse()`, zweiter Zweig in `send-mail/template.ts` |
| FR-189 | Vorschau des Pulses       | Draft         | Implemented | Eigene Function `pulse-preview` (`verify_jwt`), Blatt in `PulsePage` |
| FR-190 | Beiträge im Puls          | Draft         | Implemented | Vierte Quelle in `compose_club_pulse()`, neue Art `news`        |
| FR-191 | Grussformel am Amt        | Draft         | Implemented | `functionary_roles.greeting`, `clubs.settings.pulse.greetingRoleId` |
| FR-192 | Porträt zur Grussformel   | Draft         | Implemented | `functionary_roles.greeting_image_url`, Bucket `club-logo`, Pfadart `greeting` |
| FR-082 | Vereins-Puls komponieren  | Implemented   | Implemented | Unverändert im Ablauf, eine Quelle mehr                        |
| FR-083 | Vereins-Puls freigeben    | Implemented   | Implemented | Unverändert; der Versand trägt ab hier ein eigenes Blatt        |

### Business Rules

| ID     | Regel                                       | Ziel | Notizen                                                      |
| ------ | ------------------------------------------- | ---- | ------------------------------------------------------------ |
| BR-248 | Die drei Fragen gelten auch im Postfach     | Neu  | Dieselben Abschnitte in derselben Reihenfolge, Punkte nachgeordnet |
| BR-249 | Die Vorschau sendet nicht                   | Neu  | Kein Versand, kein `sent_at`, keine Verbindungszählung, derselbe Renderer |
| BR-250 | Nur vereinsweite Beiträge                   | Neu  | `team_id is null` – dieselbe Grenze wie bei den Vorstandsantworten in `0057` |
| BR-251 | Der Puls wiederholt bewusst                 | Neu  | Sandros Entscheid; `log_club_message()` zählt trotzdem einmal |
| BR-252 | Die Grussformel hängt am Amt                | Neu  | `released_by` ist ausdrücklich nicht die Quelle              |
| BR-253 | Kein Bild aus dem privaten Speicher in eine Mail | Neu | Eigenes Feld im öffentlichen Bucket, nie `club_members.avatar_url` |
| BR-254 | Der Gruss steht auch ohne Bild              | Neu  | Name und Amt als Text; kein Scan einer Unterschrift          |
| BR-113 | Drei Fragen, feste Reihenfolge              | Gilt | Die vierte Quelle wird eine neue **Art** im ersten Abschnitt, kein vierter Abschnitt |
| BR-114 | Punkte stehen nachgeordnet                  | Gilt | Auch im Mailblatt                                            |
| BR-116 | Verbindung vor Aufruf                       | Gilt | Die Vorschau löst die sanfte Sperre **nicht**                |
| BR-213 | Eine Mail je Person und Lauf                | Ausnahme | `mail_template` bündelt nie mit – wie die Willkommensmail |
| BR-216 | Profilbilder nur innerhalb des Klubs        | Gilt | Der Grund für BR-253                                         |

---

## Current State

- **`release_pulse()` (`0044`, Zeile 285):** `notify(user, 'pulse', 'Der Vereins-Puls', coalesce(intro, 'Was passiert, …'), '/tabs/pulse/<id>', club)`. Kein `p_template`, kein Blatt.
- **`compose_club_pulse()` (jüngste Fassung `0094`):** drei Quellen. Termine 14 Tage (Limit 8), Vorstandsantworten `news.source='board'` + `team_id is null` 14 Tage (Limit 4), Aufgaben und Schichten. Zweiter Parameter `p_skip_user` seit `0094`.
- **`club_pulses`:** `happening`, `working_on`, `join_in`, `intro`, `status`, `composed_at`, `sent_at`, `released_by`. Kein Feld für einen Gruss – richtig so, er gehört nicht an den einzelnen Puls.
- **`functionary_roles`:** `title`, `holder_member_id`, `max_holders`, `is_board` (seit `0095`), `why`, `factsheet_path`. Kein Feld für einen Gruss.
- **`pending_mail()` (`0096`):** 19 Spalten, darunter `club_logo`, `club_why`, `why`, `mail_template`. Keine Nutzlast für ein Blatt, das mehr braucht als Titel und Rumpf.
- **`send-mail` (`index.ts:118`):** lässt **nur `service_role`** durch. Ein Aufruf aus der App mit dem Token des Mitglieds bekommt 403.
- **Storage (`0083`):** vier Policies auf `club-logo` prüfen `split_part(name,'/',2) = 'logo'`. Eine zweite Pfadart kommt ohne Anpassung nicht hinein.
- **`PulsePage`:** Quote, Entwurf mit Haken je Eintrag, Einleitungsfeld, freigeben, verwerfen, anstossen. Keine Vorschau.
- **Bestand im Verein (aus nexus-app-68, 15.09.2026):** 8 Ämter mit `is_board = true`, alle Inhaber:innen mit ihrem Mitglied verknüpft. Für den Gruss genügt das – er braucht den **Namen**, kein Konto und keine Adresse.

---

## Missing Pieces

| #   | Was fehlt                                          | Anforderung            |
| --- | -------------------------------------------------- | ---------------------- |
| 1   | Vierte Quelle: vereinsweite Beiträge               | FR-190, BR-250, BR-251 |
| 2   | Gruss am Amt: Text je Sprache, Bild, welches Amt grüsst | FR-191, FR-192, BR-252 |
| 3   | Pfadart `greeting` im öffentlichen Bucket          | FR-192, BR-253         |
| 4   | Nutzlast für ein Blatt in `pending_mail()`         | FR-188                 |
| 5   | Das Pulsblatt in `send-mail/template.ts`           | FR-188, BR-248         |
| 6   | Function `pulse-preview` mit dem Token der Aufruferin | FR-189, BR-249       |
| 7   | Zwei Vorschauen in `PulsePage`                     | FR-189                 |

---

## Entscheide fürs Datenmodell

**Der Gruss hängt am Amt, die Wahl des Amts am Verein.** Zwei Felder auf
`functionary_roles` – `greeting jsonb` (Text je Sprache, wie die Labels in
`clubs.settings.labels`, BR-148) und `greeting_image_url text` – plus
`clubs.settings.pulse.greetingRoleId`, das sagt, welches Amt den Puls
unterschreibt. Wechselt die Besetzung, wechselt der Name von selbst; wechselt
der Verein von Präsidium auf Kassier, ändert sich eine Einstellung.

**Das Bild hängt an der Grussformel, nicht an der Person** (BR-253, A3): Ein
Co-Präsidium hinterlegt ein gemeinsames Bild oder keines. Das löst zugleich
die Frage, welches von zwei Profilbildern in der Mail stünde – gar keines.

**Die Nutzlast des Blatts:** `pending_mail()` bekommt eine Spalte
`payload jsonb`, gefüllt nur für Zeilen mit `mail_template`. Für den Puls
enthält sie die drei Abschnitte, den Einleitungssatz und den Gruss **in der
Sprache der Empfängerin** – die kennt `pending_mail()`. Die Alternative wäre
eine zweite Abfrage je Empfänger in der Edge Function; die Spalte hält den
Datenzugriff dort, wo er schon ist, und trägt das nächste Blatt mit.

**Die Vorschau autorisiert über RLS, nicht über eine zweite Rollenprüfung.**
Sie nimmt das Token der Aufruferin, baut damit einen Client und liest
`club_pulses` – die Policy aus `0044` gibt Entwürfe nur dem Vorstand. Kommt
keine Zeile, gibt es keine Vorschau. Damit steht die Prüfung serverseitig und
genau einmal (CLAUDE.md).

**Sie bekommt dafür eine eigene Function und keinen Modus in `send-mail`**
(Einwand von nexus-app-f9, angenommen). `send-mail` hält den
`service_role`-Schlüssel und hat heute genau **ein** Tor, ganz vorne, vor jeder
Verzweigung. Ein zweiter Vertrauensgrad in derselben Function heisst, dass
dieses Tor je Betriebsart entscheiden muss – und eine falsch einsortierte frühe
Rückgabe wäre ein Mitglied, das den Versandlauf anstösst. `pulse-preview` mit
`verify_jwt = true` hat einen einzigen Vertrauensgrad und dupliziert nichts:
Das Blatt kommt aus `_shared/`.

**Die Nutzlast trägt Daten, keine fertigen Sätze.** Abschnittskennungen,
Titel, Zeitpunkte, Namen, Amtsbezeichnung, Bildadresse – ausformuliert wird in
`send-mail/template.ts` aus `group.locale`. Zwei Gründe: Die Sätze des Produkts
liegen dort ohnehin in vier Sprachen, und `payload` entsteht **beim Abholen**,
nicht beim Anlegen der Zeile – wer zwischen Entstehen und Versand die Sprache
wechselt (bei `email_mode = 'weekly'` bis zu sieben Tage), bekommt sie in der
neuen. Was `pending_mail()` seit `0096` einzeln herausgibt – Vereinsname,
Farbe, Logo, `club_why` –, wird in `payload` **nicht** gedoppelt.

---

## Implementation Guidelines

Verbindlich aus `docs/guidelines.md`:

- **Bauteile:** `AppPage`, `ListSection` mit `footnote`, `TextSection`, `SkeletonList`, `EmptyState` mit Angebot, `FormModal` für die Grussformel, `ManageSection` für den Verwaltungsweg. **Kein neues Bauteil** – die Mailvorschau ist ein `iframe` in einem Blatt, kein eigenes Layout.
- **Entscheidungen** als reine Funktionen in `src/lib/pulse.ts` (§9): die neue Art `news`, die Auswahl der Abschnitte, der Gruss (Amt, Namen, Bild) – prüfbar ohne Rendern.
- **Vier Sprachen** ab dem ersten Commit; neue Schlüssel unter `pulse.*` und `clubSettings.pulse.*`. Die Sprachdateien unmittelbar vor dem Schreiben neu einlesen (drei Parallelsitzungen).
- **Migration `0098_pulse_greeting_and_news.sql`** – `0096`, `0097` und `0099` sind eingespielt; 0098 ist die einzige freie Nummer darunter und mit den Peers abgesprochen.
- Die Mailtexte des Blatts entstehen in `send-mail/template.ts` in vier Sprachen – sie sind für `i18n:check` unsichtbar, also von Hand vollständig halten (siehe UC-049, BR-244).

---

## Implementation Tasks

- [ ] 1. Migration `0098`: `functionary_roles.greeting`/`greeting_image_url`, Pfadart `greeting` in den vier `club-logo`-Policies, vierte Quelle in `compose_club_pulse()`, `release_pulse()` mit `p_template => 'pulse'`, `pending_mail()` mit `payload`
- [ ] 2. `src/lib/pulse.ts` + Vitest: Art `news`, externer Verweis, Gruss aus Amt und Belegung (vakant → «Der Vorstand», mehrere Inhaber:innen → alle Namen, Bild nur am Amt)
- [ ] 3. `send-mail/template.ts`: Pulsblatt als zweiter Zweig neben `welcome`, in vier Sprachen, Gruss am Fuss, Porträt über `safeUrl()`
- [ ] 4. Function `pulse-preview`: rendert mit dem Token der Aufruferin, importiert das Blatt aus `_shared/`; `send-mail` bleibt unangetastet
- [ ] 5. `useClubSettings`/`useOffices`: Grussformel schreiben und lesen; `usePulse`: Vorschau abrufen
- [ ] 6. `PulsePage`: Knopf «Vorschau», Blatt mit App-Ansicht und Mailansicht; `OfficeFormModal` um Grusstext und Bild erweitern
- [ ] 7. i18n in vier Sprachen, `npm run i18n:check`
- [ ] 8. Verhaltensprüfung gegen die laufende Datenbank: vierte Quelle greift, Team-News bleibt draussen, Vorschau setzt kein `sent_at` und zählt keine Verbindung, Pulszeile trägt `mail_template`
- [ ] 9. `ai-code-review` als eigener Durchgang, Befunde beheben
- [ ] 10. Testplan `docs/test-plans/uc-050-vereins-puls-persoenlich.md`
- [ ] 11. Statusabgleich in `requirements.md`, UC-050, UC-027 und `use_cases/README.md`
- [ ] 12. Ein Commit, Conventional Commits

---

## Fallen, die in diesem Strang zuschnappen werden

1. **`compose_club_pulse()` fortschreiben heisst: die jüngste Fassung nehmen.** Sie steht in `0094`, nicht in `0057` – `grep -l | sort | tail -1`. Und der zweite Parameter `p_skip_user` muss mit, sonst bricht der Cron-Auftrag mit «function is not unique».
2. **Der erste Abschnitt sortiert nach `item->>'at'`.** Eine News trägt `published_at` in der Vergangenheit und stünde damit **vor** dem nächsten Termin. Die Sortierung muss die Termine zuerst halten (Zukunft ist handlungsrelevant), die Beiträge danach.
3. **Die Vorschau darf den Entwurf nicht verbrauchen.** `release_pulse()` streicht die nicht behaltenen Einträge **in der Tabelle**; die Vorschau bekommt die Auswahl als Parameter und schreibt nichts.
4. **Ein Bild in der Mail ist erst auf Klick da.** Name und Amt gehören in den Text (BR-254); ein `alt` allein ist kein Gruss.
5. **`payload` ist Nutzlast, nicht Wahrheit.** Sie entsteht beim Abholen, nicht beim Anlegen der Zeile – ein Puls, der nach dem Versand geändert würde, dürfte die schon verschickte Mail nicht rückwirkend ändern. `club_pulses` ist nach `status = 'sent'` unveränderlich; das prüft Schritt 8.

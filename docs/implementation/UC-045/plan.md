# Implementation Plan: UC-045 — Bilder des Vereins pflegen

|                   |                    |
| ----------------- | ------------------ |
| **Primary Actor** | Vorstand, Trainer:in, Mitglied |
| **Goal**          | Vereinslogo, Teambild und Profilbild aufnehmen oder aus der Mediathek wählen, statt eine Adresse von Hand einzutragen |
| **Plan created**  | 2026-09-14         |
| **Status**        | Implemented – `0083`, `0085` und `0086` sind eingespielt und geprüft |

## Overview

Die App kannte bis hierher genau einen Weg zu einem Bild: eine Adresse, die
jemand von Hand einträgt (`clubs.settings.logoUrl`). `club_members.avatar_url`
steht seit `0001` in der Tabelle und wurde von **nichts** geschrieben – der
Kommentar in `MemberAvatar` sagte es seit Monaten: «ein Upload wartet auf den
Vereinsspeicher». Der Speicher steht seit `0070` (UC-041). Das hier ist der
Upload.

Drei Bilder, ein Bauteil (`ImagePicker`), ein Bucket, drei Pfadformen. Sie
unterscheiden sich in Form und Reichweite, nicht im Ablauf: auswählen,
verkleinern, hochladen, Adresse an die zuständige Spalte.

**Nicht Teil des Exports.** Der Projektinhaber hat das am 2026-09-14
ausdrücklich gesagt; `export_members()` (UC-043) führt keine Bildspalte.

## Related Use Cases

- **UC-008** – Profil pflegen: dort steht das Profilbild.
- **UC-007** – Teams verwalten: dort steht das Teambild.
- **UC-034** – Vereinsidentität konfigurieren: dort steht das Logo; das Feld `settings.logoUrl` bleibt und bekommt einen zweiten Weg.
- **UC-041** – Funktionärsamt mit Factsheet: der erste Bucket des Projekts (`factsheets`, privat) und die Vorlage für `path_club_id()`.
- **UC-043** – Mitglieder exportieren: derselbe Auftrag, andere Hälfte; Bilder gehen dort ausdrücklich nicht mit.

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Title | User Story (summary) | Status  | Notes |
| ------ | ----- | -------------------- | ------- | ----- |
| FR-166 | Vereinslogo hochladen | Als Vorstand möchte ich das Vereinslogo aufnehmen oder aus der Mediathek wählen, damit ich keine Bildadresse suchen muss. | Gebaut | `ImagePicker` in `ClubSettingsPage`; schreibt `settings.logoUrl`. |
| FR-167 | Teambild hinterlegen | Als Trainer:in möchte ich ein Mannschaftsfoto am Team hinterlegen, damit das Team ein Gesicht bekommt. | Gebaut | `teams.photo_url`, `set_team_photo()`; im `TeamDetailModal`. |
| FR-168 | Profilbild aufnehmen | Als Mitglied möchte ich mein Profilbild aufnehmen oder wählen, damit man mich in Listen erkennt. | Gebaut | `club_members.avatar_url`, `set_member_avatar()`; im Profil-Blatt. |
| FR-111 | Vereinsidentität | (bestehend) | Implemented | Das Adressfeld bleibt – ein Verein mit Logo auf der Website trägt weiter den Link ein. |
| FR-018 | Eigenes Profil pflegen | (bestehend) | Implemented | Bekommt den Bildabschnitt. |

### Business Rules

| ID     | Rule | Status  | Notes |
| ------ | ---- | ------- | ----- |
| BR-215 | **Der Pfad trägt das Recht.** `<club_id>/logo/…` gehört dem Vorstand, `<club_id>/teams/<team_id>/…` wer für dieses Team plant, `<club_id>/members/<member_id>/…` der Person selbst oder dem Vorstand. | Gebaut | `can_write_club_media()` – **eine** Funktion für alle drei Formen und für `insert`, `update` und `delete`. |
| BR-216 | **In `club_members.avatar_url` und `teams.photo_url` steht der Pfad im Vereinsspeicher, nicht eine Adresse.** Beide Schreibfunktionen weisen jeden Pfad ab, der nicht genau auf diesen Verein, diese Art und diese Person bzw. dieses Team zeigt. | Gebaut | Sonst wäre die Spalte eine offene Stelle für ein beliebiges fremdes Bild in jeder Liste. Eine signierte Adresse läuft ohnehin ab und taugte nicht als gespeicherter Wert. `settings.logoUrl` bleibt eine Adresse – dort darf sie fremd sein (UC-034). |
| BR-217 | **Verkleinert wird vor dem Hochladen.** Höchstens 512 Pixel lange Kante (Logo, Profilbild) bzw. 1024 (Teambild). | Gebaut | `shrinkImage()`; der Bucket begrenzt zusätzlich auf 5 MiB je Datei. |
| BR-218 | **Kein SVG.** Der Bucket nimmt nur JPEG, PNG und WebP. | Gebaut | Eine SVG-Datei kann Skript tragen und läge auf einer öffentlich lesbaren Adresse. |
| BR-214 | **An der eigenen Zeile ändert ein Mitglied genau eine Spalte** – `leaderboard_opt_in`. Alles andere läuft über eine Funktion mit eigener Prüfung. | Gebaut | `0085`, Trigger `club_members_guard_self_update`. Siehe den Befund unten. |
| BR-219 | **Gesichter bleiben im Verein.** Team- und Profilbilder liegen in einem privaten Bucket; ihre Adresse wird je Anzeige signiert und läuft ab. Nur das Logo ist öffentlich, weil es vor der Anmeldung lädt. | Gebaut | `club-logo` gegen `club-photos` (0083); jede Policy pinnt zusätzlich die Art des Bildes. |

### Ein Befund am Bestand, gefunden beim Bauen

`set_member_avatar()` prüft sorgfältig, dass eine Bildadresse aus dem
Vereinsspeicher stammt. Beim Schreiben dieser Prüfung fiel auf, dass derselbe
Wert nebenan **ungeprüft** zu schreiben war: Die Policy `members_update_self`
aus `0006` prüft seit dem ersten Tag nur, **wessen** Zeile geändert wird, nicht
**was** daran.

Über PostgREST genügte damit

    PATCH /rest/v1/club_members?id=eq.<eigene id>   {"role":"superadmin"}

und aus einem Mitglied wurde der Vorstand. Der Trigger aus `0012` greift nicht:
Er schützt den **letzten** Vorstand vor dem Verschwinden, nicht den Verein vor
einem hinzukommenden.

Am 2026-09-14 gegen die laufende Datenbank belegt: An `club_members` hängen
genau drei Policies (`members_read`, `members_update_self`,
`members_admin_write`), und keine engt die Spalten ein.

Das widerspricht der ersten der nicht verhandelbaren Regeln des Projekts
(«Rollenprüfung serverseitig») und BR-027. `0085` schliesst es mit einem
Trigger, der für den direkten Weg über PostgREST nur `leaderboard_opt_in`
durchlässt – als Erlaubnisliste über `to_jsonb(new) - 'leaderboard_opt_in'`,
damit eine später hinzugefügte Spalte nicht still offen steht. Alle zehn
Stellen, die in SQL `club_members` schreiben, sind `security definer` und
laufen als `postgres`; der Trigger lässt sie deshalb durch. Der Unterschied
`current_user = 'authenticated'` gegen `postgres` ist auf der laufenden
Datenbank nachgemessen.

**Das ist der wichtigste Fund dieser Sitzung und betrifft nicht nur die
Bilder.** Er gehört eingespielt, sobald `db push` wieder geht.

### Der Review und was er gefunden hat

Sechzehn Befunde, drei davon schwer. Alle behoben; die, die Regeln betreffen:

1. **Die Herkunftsprüfung liess fremde Adressen durch – in zwei Anläufen.**
   Zuerst `position('…/club-media/<club>/members/' in v_url) = 0`: Das sucht
   **irgendwo** im String, und `https://boese.example/x?u=/club-media/<club>/members/a.png`
   kam durch. Damit hätte jedes Mitglied ein beliebiges fremdes Bild in jede
   Liste hängen können, die jedes Mitglied lädt (Abfluss von IP und
   Browserkennung an Dritte); BR-216 stand da, war aber nicht erfüllt.

   Der erste Versuch – ein verankerter Ausdruck
   `^https://[^/]+/storage/v1/object/public/club-media/…$` samt Mitglieds-
   kennung – hielt sechs von sieben Proben gegen die laufende Datenbank stand
   und fiel bei der siebten: `https://boese.example/storage/v1/object/public/
   club-media/<club>/members/<member>/x.png` passt auf `[^/]+` als Host. Den
   eigenen Host kennt Postgres nicht, und der Vault ist kein Weg, den eine
   Prüfung bei jedem Schreiben gehen sollte.

   Die Lösung ist, die Frage verschwinden zu lassen: In der Spalte steht jetzt
   der **Pfad im Bucket**, die öffentliche Adresse baut der Client daraus
   (`mediaUrl()`). Damit ist die Prüfung vollständig – Verein, Art und Person
   stehen fest, ein Schrägstrich mehr ist nicht erlaubt, und einen fremden Ort
   gibt es nicht mehr zu erlauben. Aufgelöst wird der Pfad an **einer** Stelle
   (`MemberAvatar`), weil jede Personenzeile der App dort durchgeht.

   Nebenbefund desselben Punkts: `set_team_photo()` hatte die Teamkennung im
   Muster, `set_member_avatar()` die Mitgliedskennung nicht – zwei
   Schwesterfunktionen, zwei Strenge-Grade.
2. **Das alte Logo fiel, bevor das neue gespeichert war.** Der `onChange` des
   Bildfelds löschte die Datei sofort, die Adresse landet aber erst beim
   Absenden in `clubs.settings`. Wer wählte und dann verliess, hatte eine
   Adresse ohne Datei – und das Logo lädt **vor** der Anmeldung. Jetzt fällt
   die alte Datei im `onSuccess` des Speicherns, und `isClubMediaUrl()` prüft
   zusätzlich die **Art** des Bildes: Sonst löschte das Ersetzen des Logos ein
   Teambild, dessen Adresse jemand von Hand ins Adressfeld getippt hat.
3. **Der Abbruch kam als roter Toast mit englischem Plugin-Text.**
   `Camera.getPhoto` **wirft** beim Abbrechen; der Zweig `if (!photo.webPath)`
   lief nie. Jede Person, die den Bildwähler schloss, sah «User cancelled
   photos app». Jetzt `try/catch`, und der `ImagePicker` toastet nur noch
   eigene, übersetzte Schlüssel.
4. **Das Teambild war gebaut und für niemanden zu sehen.** Es stand nur im
   Bearbeitungsblatt hinter `mayPlan` – FR-167 («damit das Team ein Gesicht
   bekommt») war nicht erfüllt. Jetzt sehen es alle, die das Team sehen;
   ändern darf es weiterhin nur, wer für das Team plant. (Fundmuster «gebaut
   und unerreichbar» – in dieser Sitzung zum zweiten Mal.)

Die übrigen zwölf: «Bild gespeichert» kam, bevor irgendetwas gespeichert war,
und das Entfernen meldete gar nichts; `input.oncancel` gibt es erst ab
Chrome 113 / Safari 17, davor blieb der Knopf für immer im Ladezustand (jetzt
zusätzlich ein Weg über `focus`); `createImageBitmap` ohne
`imageOrientation: 'from-image'` liess Hochformatfotos quer liegen; ein HEIC
bekam die Endung `.jpg` bei Inhaltstyp `image/heic` (jetzt entscheidet
`targetType()` beides zusammen, und `isSupportedImage()` weist ab, statt die
Storage-API englisch antworten zu lassen); `0085` vergab einer Triggerfunktion
`execute` mit falscher Begründung (Postgres prüft das Recht beim **Anlegen**
des Triggers – jetzt `revoke`, wie bei `functionary_member_left()` in `0070`);
die BR-Nummern 210–213 gehörten längst UC-044 (umnummeriert auf 215–218);
dieselbe UUID-Regex stand in `0070` und `0083` (`path_club_id()` ist jetzt
`path_uuid(name, 1)`); eine Datei blieb verwaist, wenn das Setzen der Spalte
nach dem Hochladen scheiterte; `removeFile()` verwarf jeden Fehler stumm;
`isClubMediaUrl()` versprach eine Verwendung, die es nicht gab; ein «+» als
Literal im JSX; und die Entfernen-Zeile las sich als leere Zeile.

Richtiggestellt wurde auch eine Aussage im Kopf von `0083`: «der Bucket lässt
sich nicht auflisten» gilt nur für Aussenstehende – **jedes Vereinsmitglied**
kann den Ordner seines Vereins auflisten und damit alle Pfade aufzählen, auch
die, die ihm keine Ansicht zeigt. Das gehört zum offenen Entscheid unten.

### Der Entscheid ist gefallen: Gesichter bleiben im Verein

Die erste Fassung legte alle drei Bilder in **einen öffentlichen** Bucket und
benannte den Preis als Abwägung: Wer eine Adresse hat, sieht das Bild, auch
ohne Vereinsmitglied zu sein. Der Projektinhaber hat am 14.09.2026 anders
entschieden – «Profilbilder nur innerhalb des Klubs sichtbar» –, und die
Migration ist entsprechend umgebaut. Es sind jetzt **zwei** Buckets:

| Bucket | Sichtbarkeit | Inhalt | Warum |
| ------ | ------------ | ------ | ----- |
| `club-logo` | öffentlich | nur `<club>/logo/…` | Das Logo lädt **vor** der Anmeldung – Einladungsseite und White-Label-Anstrich. Dort gibt es niemanden, für den signiert werden könnte. Und ein Logo ist das Zeichen, mit dem ein Verein nach aussen auftritt. |
| `club-photos` | **privat** | `<club>/teams/…` und `<club>/members/…` | Ein Mannschaftsfoto und erst recht ein Profilbild gehen den Verein an und sonst niemanden. `club_members` kennt `is_minor`. |

Dass die Trennung hält, steht nicht nur im Kommentar: **Jede Bucket-Policy
pinnt zusätzlich die Art des Bildes** (`split_part(name, '/', 2)`). Ein
Profilbild lässt sich damit gar nicht erst in den öffentlichen Bucket legen.

Im privaten Bucket ist `select` die Tür – ohne sie gibt es weder einen
Download noch eine signierte Adresse. `is_club_member()` ist damit die
wörtliche Antwort auf «nur innerhalb des Vereins».

**Die App holt die Adressen gebündelt.** Eine Mitgliederliste zeigt
zweihundert Avatare; zweihundert einzelne Signieranfragen wären zweihundert
Netzaufrufe. `useSignedMediaUrl()` sammelt alle Pfade eines Renderdurchgangs
und löst sie mit **einem** `createSignedUrls` ein, zwischengespeichert über
react-query. Gültigkeit eine Stunde, nachgeladen nach der halben – eine
abgelaufene Adresse im `src` wäre ein leeres Bild, das niemand erklären kann.

Was der private Bucket **nicht** leistet: Er verhindert nicht, dass ein
Vereinsmitglied den Ordner seines Vereins auflistet und so alle Pfade kennt.
Innerhalb des Vereins ist genau das erlaubt; nach aussen kommt ohne gültige
Signatur nichts.

---

## Tasks

| # | Task | Datei | Status |
| - | ---- | ----- | ------ |
| 1 | Migration: Bucket, Pfadrechte, `teams.photo_url`, zwei Schreibfunktionen | `supabase/migrations/0083_club_media.sql` | erledigt |
| 1b | Migration: Selbstbedienung an der eigenen Mitgliedschaft eingrenzen (BR-214) | `supabase/migrations/0085_member_self_update_guard.sql` | erledigt |
| 1c | Migration: «kein Pfad» heisst «Bild wegnehmen» (`default null`) | `supabase/migrations/0086_media_default_null.sql` | erledigt |
| 2 | Reine Logik: Kantenlängen, Pfade, Endungen, Herkunftsprüfung | `app/src/lib/image.ts` | erledigt |
| 3 | Hooks: auswählen, hochladen, setzen, wegräumen | `app/src/hooks/useMedia.ts` | erledigt |
| 4 | Bauteil `ImagePicker` | `app/src/components/ImagePicker.tsx` | erledigt |
| 5 | Einstieg Profilbild | `app/src/components/ProfileEditModal.tsx` | erledigt |
| 6 | Einstieg Teambild | `app/src/components/TeamDetailModal.tsx` | erledigt |
| 7 | Einstieg Vereinslogo | `app/src/pages/ClubSettingsPage.tsx` | erledigt |
| 8 | Kamera-Plugin, Zweckangaben, `cap update` | `package.json`, `Info.plist`, `AndroidManifest.xml` | erledigt |
| 9 | Stilklassen im einen Stylesheet | `app/src/theme/variables.css` | erledigt |
| 10 | i18n in vier Sprachen (`media.*`) | `app/src/i18n/locales/*.json` | erledigt |
| 11 | Vitest für die reine Logik (inkl. `targetType`, `isSupportedImage`) | `app/src/lib/image.test.ts` | erledigt |
| 11b | `ai-code-review` und Befunde beheben | — | erledigt – 16 Befunde, siehe oben |
| 12 | Verhaltensprüfung gegen die laufende Datenbank | Probe | erledigt – siehe unten |
| 13 | Manueller Testplan | `docs/test-plans/uc-045-bilder.md` | erledigt |
| 14 | Statusabgleich | `docs/requirements.md`, `docs/use_cases/README.md`, `docs/entity_model.md` | erledigt |

## Die Verhaltensprüfung gegen die laufende Datenbank

`0083`, `0085` und `0086` sind am 14.09.2026 eingespielt, die Typen danach
neu erzeugt. Geprüft wurde unter `role authenticated` in einem `do`-Block,
der am Ende zurückrollt – gemessen werden Werte, nicht abgefangene Ausnahmen.

| Prüfung | Ergebnis |
| ------- | -------- |
| Selbstbeförderung zur Vorstandsrolle über die REST-Schnittstelle (BR-214) | abgewiesen |
| Profilbild direkt in die Spalte schreiben (BR-214) | abgewiesen |
| Teilnahme an Ranglisten umschalten – die eine erlaubte Spalte | 1 Zeile |
| Fremde Adresse als Profilbild, mit echtem Pfad im Text (BR-216) | abgewiesen |
| Pfad eines **anderen** Mitglieds (BR-216) | abgewiesen |
| Eigener, richtiger Pfad | angenommen, Spalte trägt `<club>/members/<ich>/abc.jpg` |
| Bild wegnehmen, ohne Pfad (0086) | Spalte `NULL` |

Die Buckets stehen wie vorgesehen: `club-logo` ist `public = true`,
`club-photos` ist `public = false`, beide mit 5 MiB Grenze und den drei
erlaubten Bildtypen; alle acht Policies sind angelegt.

Die Pfadprüfung selbst lief vorher als reine Leseabfrage über sieben
Schreibweisen – der echte Pfad wird angenommen, ein fremder Host mit echt
aussehendem Pfad, ein Teilstring im Query, ein fremdes Mitglied, ein fremder
Verein, ein Ausbruch mit `..` und ein Unterordner werden abgewiesen.

## Offen

- **Auf dem Gerät zu prüfen** (Testplan `uc-045-bilder.md`): das
  Berechtigungsblatt von iOS und Android beim ersten Aufnehmen, der
  Zuschneider (`allowEditing`), und dass eine signierte Adresse nach einer
  Stunde abläuft.
- Nicht gebaut und nicht vorgesehen: Aufräumen der Buckets, wenn ein Team
  gelöscht wird, ein Mitglied austritt oder der Verein verschwindet. Die
  Dateien bleiben liegen. Wer es schliessen will, hängt es an `delete_team()`
  und `delete_my_account()`.
- Nicht getestet: `shrinkImage()` und der `ImagePicker` selbst – beide
  brauchen `createImageBitmap` und `canvas`, die jsdom nicht hat. Geprüft ist
  die Rechnung darunter (`fitWithin`, `targetType`, `mediaPath`).
- Nicht gebaut: ein Bild am **anderen** Mitglied durch den Vorstand. Der
  Server erlaubt es (`set_member_avatar` prüft `is_club_board`), die
  Oberfläche bietet es nicht an – niemand hat danach gefragt.

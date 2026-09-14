# Manual Test Plan: UC-045 — Bilder des Vereins pflegen

**Use Case:** [UC-045](../implementation/UC-045/plan.md)
**Geltungsbereich:** Vereinslogo, Teambild, Profilbild – aufnehmen, wählen, ersetzen, entfernen; Reichweite der Schreibrechte
**Anforderungen:** FR-166, FR-167, FR-168, FR-111, FR-018
**Regeln:** BR-214 bis BR-219
**Erstellt:** 2026-09-14

## Vorbereitung

- **V** — Vorstand (Rolle admin). **T** — Trainer:in eines Teams. **M** — Mitglied ohne besondere Rolle.
- Migration `0083_club_media.sql` ist eingespielt, `npm run types:generate` gelaufen.
- Auf dem Gerät: mindestens ein Bild in der Mediathek, Kamera verfügbar.
- Ein grosses Foto (mehr als 5 MB) für TC-006.

---

## TC-001: Profilbild aufnehmen (FR-168, Hauptablauf)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** Profil → «Profil bearbeiten» öffnen | Ganz oben der Abschnitt «Profilbild» mit einem leeren runden Feld und «Wählen» | | |
| 2 | Die Fussnote lesen | Sie sagt, wo das Bild erscheint und dass es verkleinert wird | | |
| 3 | «Wählen» antippen | Das native Blatt bietet «Foto aufnehmen» und «Mediathek» | | |
| 4 | Beim allerersten Mal: Kamera wählen | iOS/Android fragt nach der Berechtigung, mit dem Zwecktext aus `Info.plist` | | |
| 5 | Ein Foto aufnehmen | Der Zuschneider erscheint (`allowEditing`) | | |
| 6 | Zuschneiden und bestätigen | Kurz ein Ladekreis, dann Toast «Bild gespeichert» oben | | |
| 7 | Das runde Feld ansehen | Das Bild steht darin, nicht verzerrt | | |
| 8 | Blatt schliessen, Mitgliederliste oder Rangliste öffnen | Das Bild steht in der Zeile statt der Initialen | | |

---

## TC-002: Profilbild ersetzen und entfernen

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** im Profil-Blatt «Ändern» antippen und ein anderes Bild wählen | Das neue Bild ersetzt das alte, Toast erscheint | | |
| 2 | Die App neu starten und das Profil öffnen | Das **neue** Bild steht da, nicht das alte aus dem Zwischenspeicher | | |
| 3 | «Bild entfernen» antippen (rote Zeile) | Das Feld zeigt wieder die Initialen | | |
| 4 | Die Mitgliederliste öffnen | Auch dort stehen wieder die Initialen | | |

---

## TC-003: Abbrechen tut nichts (kein stiller Fehler)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Wählen» antippen und das native Blatt sofort abbrechen | Kein Toast, keine Fehlermeldung, kein hängender Ladekreis | | |
| 2 | Danach erneut «Wählen» antippen | Das Blatt geht wieder auf | | |

---

## TC-004: Teambild (FR-167, BR-215)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **T** Profil → Verwaltung öffnen | Der Eintrag «Teams» ist da – auch ohne Vorstandsrolle | | |
| 2 | Das eigene Team öffnen | Oben der Abschnitt «Teambild» | | |
| 3 | Ein Bild wählen | Es erscheint breit über die Blattbreite, im Seitenverhältnis 16:9 zugeschnitten | | |
| 4 | Ein Team öffnen, in dem **T** nicht ist | Der Abschnitt «Teambild» fehlt ganz | | |
| 5 | Als **M** ein beliebiges Team öffnen | Kein Abschnitt «Teambild», kein «Team exportieren» | | |
| 6 | Als **V** ein beliebiges Team öffnen | Beide Wege sind da | | |

---

## TC-005: Vereinslogo (FR-166, FR-111)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** Vereinseinstellungen öffnen, Abschnitt «Logo» | Ein Bildfeld mit «Wählen» **und** darunter das Adressfeld | | |
| 2 | Ein Logo hochladen | Vorschau erscheint; das Logo wird nicht beschnitten, sondern ganz gezeigt | | |
| 3 | Speichern, dann das Seitenmenü öffnen | Das Logo steht im Menükopf | | |
| 4 | Ein Logo mit durchsichtigem Hintergrund (PNG) hochladen | Die Durchsichtigkeit bleibt erhalten | | |
| 5 | Statt Upload eine fremde Adresse ins Adressfeld tippen und speichern | Funktioniert weiter wie bisher | | |
| 6 | Danach ein Bild hochladen | Die fremde Adresse wird ersetzt, und es wird **nicht** versucht, sie zu löschen | | |

---

## TC-006: Grenzen (BR-217, BR-218)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Ein sehr grosses Foto (über 5 MB) wählen | Es wird verkleinert und geht durch – kein Fehler | | |
| 2 | Im Browser eine SVG-Datei zu wählen versuchen | Der Dateidialog bietet sie gar nicht erst an | | |
| 3 | Die Dateigrösse im Vereinsspeicher prüfen (Supabase Studio) | Deutlich unter einem Megabyte | | |
| 4 | Im Flugmodus ein Bild wählen | Eine Fehlermeldung als Toast, kein stiller Fehlschlag | | |

---

## TC-007b: Gesichter bleiben im Verein (BR-219)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** ein Profilbild setzen, dann in der Mitgliederliste die Bildadresse aus dem `<img>` kopieren | Sie enthält `/object/sign/club-photos/` und einen `token`-Parameter | | |
| 2 | Diese Adresse in einem Fenster ohne Anmeldung öffnen (privates Fenster) | Das Bild erscheint – die Signatur gilt noch | | |
| 3 | Den `token`-Parameter aus der Adresse entfernen und erneut öffnen | Kein Bild, eine Fehlermeldung von Storage | | |
| 4 | Eine Stunde warten (oder die Gültigkeit vorübergehend kürzen) und Schritt 2 wiederholen | Kein Bild mehr – die Signatur ist abgelaufen | | |
| 5 | Als Person **ohne** Mitgliedschaft in diesem Verein `storage.from('club-photos').download('<club>/members/<mitglied>/…')` aufrufen | Abgewiesen | | |
| 6 | Als **M** dasselbe aufrufen | Erlaubt | | |
| 7 | Die Adresse des **Vereinslogos** prüfen | Sie enthält `/object/public/club-logo/` und **keinen** Token – das Logo ist absichtlich öffentlich | | |
| 8 | Als **V** versuchen, ein Profilbild nach `club-logo` hochzuladen (REST) | Die Policy weist ab: In den öffentlichen Bucket kommt nur `logo/` | | |

---

## TC-007: Fremde Reichweite (BR-215, BR-216)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** `set_member_avatar` für ein **anderes** Mitglied aufrufen (REST) | Fehler «Nur die Person selbst oder der Vorstand ändert das Profilbild» | | |
| 2 | Als **M** `set_member_avatar` mit einer fremden Adresse (`https://example.com/x.png`) aufrufen | Fehler «Dieser Pfad gehört nicht zum Vereinsspeicher» | | |
| 2b | Als **M** eine Adresse aufrufen, die den echten Pfad enthält (`https://boese.example/storage/v1/object/public/club-media/<club>/members/<mitglied>/x.png`) | Ebenfalls abgewiesen – in der Spalte steht ein Pfad, keine Adresse | | |
| 2c | Als **M** den Pfad eines **anderen** Mitglieds setzen (`<club>/members/<andere>/x.jpg`) | Abgewiesen | | |
| 3 | Als **M** eine Datei nach `<club>/logo/…` hochladen (REST) | Die Storage-Policy weist ab | | |
| 4 | Als **T** eine Datei in den Ordner eines fremden Teams hochladen | Die Storage-Policy weist ab | | |

---

## Offene Punkte

- **Jedes Vereinsmitglied** kann den Ordner seines Vereins auflisten (`storage.from('club-photos').list('<club_id>')`) und damit alle Pfade aufzählen, auch die, die ihm keine Ansicht zeigt. Innerhalb des Vereins ist das gewollt; nach aussen kommt ohne gültige Signatur nichts.
- Das **Logo** liegt weiterhin öffentlich (`club-logo`) und muss es auch: Es lädt vor der Anmeldung.
- Der Vorstand kann das Bild eines anderen Mitglieds serverseitig setzen, die Oberfläche bietet es nicht an.

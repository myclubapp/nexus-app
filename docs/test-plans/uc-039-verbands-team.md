# Manual Test Plan: UC-039 — Verbands-Team verknüpfen oder importieren

**Use Case:** [UC-039](../use_cases/UC-039-verbands-team-verknuepfen.md)
**Geltungsbereich:** Verknüpfen, Übernehmen (A1), Namenshoheit, Spielimport, Lösen, Veralten
**Anforderungen:** FR-150 bis FR-153
**Regeln:** BR-175 bis BR-181
**Erstellt:** 2026-09-11

## Vorbereitung

- **V** — Vorstand, **T** — Mitglied im Team «Herren 1», **M** — Mitglied ohne Team.
- Migration `0060_federation_teams.sql` ist eingespielt.
- Die Edge Function ist deployt: `supabase functions deploy sync-federation`.
  **Ohne sie meldet «Teams des Verbands laden», dass der Dienst nicht
  antwortet** (A4) – das ist der erwartete Zustand, nicht ein Fehler der App.
- Der Verband ist verbunden (UC-035) mit einer echten Vereinskennung bei
  Swiss Unihockey, etwa `463820` (Ad Astra Obwalden, 12 Teams).
- Zwei Teams bestehen: «Herren 1» (mit **T**) und «Damen NLB».

---

## TC-001: Verknüpfen im Team-Blatt (Hauptablauf, Schritte 1–8)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** Profil → Teams → «Herren 1» öffnen | Das Blatt zeigt Name, Bereich und den Abschnitt «Verbands-Team» | | |
| 2 | «Teams des Verbands laden» | Der Knopf sagt «Teams werden geladen …», dann erscheint die Auswahl | | |
| 3 | Die Auswahl aufklappen | Die Teams des Vereins beim Verband, mit «Nicht verknüpfen» zuoberst | | |
| 4 | «Herren NLB» wählen | Das Namensfeld verschwindet; stattdessen «Zusatz des Vereins» mit dem Satz, was angezeigt wird | | |
| 5 | Zusatz «Sarnen» eintragen | Der Satz zeigt «Herren NLB Sarnen» | | |
| 6 | 41 Zeichen als Zusatz eintragen | Speichern gesperrt, «Der Zusatz ist zu lang» | | |
| 7 | Zusatz korrigieren, Speichern | Toast «Mit «Herren NLB Sarnen» verknüpft – 18 Spiele in der Agenda» (die Zahl des Spielplans); die Liste zeigt den neuen Namen | | |
| 8 | Das Blatt erneut öffnen | Verband, Grundname, «Letzter Abgleich», Zusatzfeld, «Verknüpfung lösen»; kein Namensfeld | | |
| 9 | Die Verbindung unter Vereinseinstellungen → Verband prüfen | Zustand «Aktiv» – der Abruf hat sie bestätigt | | |

---

## TC-002: Eine Verknüpfung, ein Team (BR-175, A3)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Damen NLB» öffnen, Teams laden, die Auswahl aufklappen | «Herren NLB (schon verknüpft)» ist grau und nicht wählbar | | |
| 2 | Per SQL versuchen: `select link_team('<Damen>', 'swissunihockey', '<Kennung Herren NLB>', 'Herren NLB');` | Abgewiesen, die Meldung nennt «Herren NLB Sarnen» | | |
| 3 | Als **V** per SQL `update teams set federation_team_id = '1' where name = 'Damen NLB';` | Abgewiesen: «Die Verknüpfung zum Verband wird über link_team() gesetzt» | | |
| 4 | Als **V** den Bereich von «Herren NLB Sarnen» ändern | Gelingt; der Name bleibt zusammengesetzt | | |

---

## TC-003: Der Verband pflegt den Grundnamen, der Verein den Zusatz (BR-176, FR-152)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `select report_team_sync('<Herren>', true, 'Herren NLA', 'NLA Gr. 1');` als Dienst | – | | |
| 2 | Die Teamliste ansehen | «Herren NLA Sarnen» – der Zusatz überlebt | | |
| 3 | Das Blatt öffnen | «Liga: NLA Gr. 1», Zeitpunkt des Abgleichs aktualisiert | | |
| 4 | Den Zusatz auf «Obwalden» ändern und speichern | «Herren NLA Obwalden» | | |
| 5 | Mitglieder und Punkte von **T** prüfen (BR-179) | Unverändert | | |

---

## TC-004: Spiele als Termine (Schritt 9, BR-180, C-032)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Ein Team verknüpfen (TC-001) – oder für den nächtlichen Weg `select public.sync_federations();` (Vault-Einträge vorhanden) | Der Toast nennt die Zahl der Spiele; beim nächtlichen Weg nennt die Antwort `games > 0` für den Verein | | |
| 2 | Als **T** die Agenda öffnen | Die Spiele der Saison stehen da: «Heimteam – Gastteam», Halle und Ort, Typ «Spiel · Vom Verband» | | |
| 3 | Ein vergangenes Spiel ansehen | Die Zeile zeigt «Resultat 2:6» (oder «3:4 n.V.») | | |
| 4 | Die Uhrzeit eines Spiels prüfen | Die Ortszeit des Verbands, im Winter wie im Sommer | | |
| 5 | Als **M** die Agenda öffnen | Keines dieser Spiele – sie gehören dem Team (C-032) | | |
| 6 | Als **V** ein Spiel bearbeiten und «Treffpunkt 16:30» als Sinn eintragen | Gespeichert | | |
| 7 | Den Lauf wiederholen | Kein Duplikat; Zeit, Ort und Resultat vom Verband, der Treffpunkt steht noch | | |
| 8 | Als **T** dem Spiel zusagen, den QR-Check-in prüfen | Beides funktioniert wie bei jedem Termin | | |

---

## TC-012: Spiele sofort nach dem Verknüpfen, und wenn der Verband schweigt (Schritt 9, A7)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** ein Team verknüpfen (TC-001) und **sofort** die Agenda öffnen | Die Spiele der Saison stehen da – ohne Neuladen, ohne auf die Nacht zu warten | | |
| 2 | Das Team-Blatt öffnen | «Letzter Abgleich: eben» – der Zeitpunkt des Spielabrufs | | |
| 3 | Unter «Team anlegen» ein Verbands-Team wählen und speichern | Toast «Mit «…» verknüpft – n Spiele in der Agenda»; die Agenda zeigt sie | | |
| 4 | «Teams aus dem Verband übernehmen» mit zwei Teams | Toast «2 angelegt, 0 verknüpft – n Spiele in der Agenda» (Summe beider Spielpläne) | | |
| 5 | Netz trennen (Flugmodus nach dem Laden der Teamliste) und verknüpfen | `link_team` schlägt fehl, keine Verknüpfung – wie bisher | | |
| 6 | Verbands-Schnittstelle unerreichbar machen (z. B. `federation_club_id` in der Verbindung per SQL auf `0` setzen) und verknüpfen | Toast «Mit «…» verknüpft. Die Spiele kommen mit dem nächsten Abgleich: …» mit der Meldung des Verbands; das Blatt zeigt «Noch kein Abgleich» | | |
| 7 | `federation_club_id` zurücksetzen, `select public.sync_federations();` | Die Spiele kommen nach; das Blatt zeigt «Letzter Abgleich» | | |
| 8 | Ohne Anmeldung `POST /functions/v1/sync-federation` mit `{"mode":"sync",…}` | 401; als Mitglied ohne Vorstandsrolle 403 | | |

---

## TC-005: Mehrere Teams übernehmen (A1, FR-150)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** auf der Teamseite das Plus antippen | Zwei Einträge: «Team anlegen» und «Teams aus dem Verband übernehmen» | | |
| 2 | «Teams aus dem Verband übernehmen» | Das Blatt lädt die Liste von selbst | | |
| 3 | Die Liste lesen | Je Team ein Vorschlag: «Schon verknüpft» (grau, gesperrt), «Zuordnen zu «Damen NLB»», «Neu anlegen» | | |
| 4 | Zwei Teams abwählen, «Übernehmen» | Toast «n angelegt, 1 verknüpft»; die Liste zeigt die neuen Teams | | |
| 5 | Das Blatt erneut öffnen | Alle übernommenen stehen auf «Schon verknüpft» | | |
| 6 | Die Verbindung trennen und das Plus prüfen | Nur noch «Team anlegen» | | |

---

## TC-006: Team anlegen mit Verbands-Team (Schritt 1 über «Team anlegen»)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Team anlegen» öffnen | Namensfeld und der Abschnitt «Verbands-Team» | | |
| 2 | Teams laden, «Junioren U16 B» wählen | Das Namensfeld weicht dem Zusatzfeld | | |
| 3 | Ohne Zusatz auf «Erstellen» | Toast «Mit «Junioren U16 B» verknüpft»; das Team steht in der Liste | | |
| 4 | Erneut «Team anlegen», nichts wählen, Name «Senioren», Erstellen | Ein Team ohne Verbandsbezug (A2 sinngemäss) | | |

---

## TC-007: Kein Verband, Verband antwortet nicht (A2, A4)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | In einem Verein ohne Verbindung ein Team öffnen | Statt der Auswahl: der Hinweis und der Knopf «Verband verbinden» | | |
| 2 | Den Knopf antippen | Das Blatt schliesst, die Verbandsseite öffnet | | |
| 3 | Im verbundenen Verein die Vereinskennung per SQL auf `999999999` setzen, Teams laden | «Der Verband antwortet nicht: Der Verband kennt zu dieser Vereinskennung keine Teams» und der Satz, dass das Team ohne Verknüpfung gespeichert werden kann | | |
| 4 | Den Bereich ändern und speichern | Gelingt – das Formular blieb bedienbar | | |
| 5 | Die Edge Function nicht deployen und Teams laden | «Der Abgleichdienst antwortet nicht» als Meldung, kein Absturz | | |

---

## TC-008: Verknüpfung lösen (A5, FR-153, BR-181)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Zahl der importierten Spiele von «Herren NLA Obwalden» notieren | Vorbereitung | | |
| 2 | Im Blatt «Verknüpfung lösen» | Rückfrage, die sagt, dass Name und Termine bleiben | | |
| 3 | Abbrechen | Nichts geändert | | |
| 4 | Erneut, bestätigen | Toast «Verknüpfung gelöst»; das Blatt schliesst | | |
| 5 | Die Liste ansehen | Das Team heisst weiterhin «Herren NLA Obwalden» | | |
| 6 | Das Blatt öffnen | Namensfeld wieder da; Abschnitt «Verbands-Team» bietet erneut das Laden an | | |
| 7 | Den Namen auf «Herren 1» ändern | Gelingt – der Verein benennt wieder selbst | | |
| 8 | Die Spiele in der Agenda zählen | Gleich viele wie notiert | | |
| 9 | Den Lauf wiederholen | Für dieses Team entsteht nichts Neues | | |
| 10 | Das Team löschen wollen | Abgewiesen: Es hat noch Termine (0059) | | |

---

## TC-009: Verbands-Team fällt weg (A6)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Ein Team mit einer erfundenen Kennung verknüpfen (`link_team(..., '999', 'Geist')`) | Verknüpft | | |
| 2 | Den Lauf ausführen | Das Team bleibt verknüpft; im Blatt steht der Satz «Der Verband führt dieses Team nicht mehr …» | | |
| 3 | Die Inbox von **V** prüfen | Eine Meldung «Verbands-Team nicht mehr gefunden: Geist» mit Weg zur Teamseite | | |
| 4 | Den Lauf erneut ausführen | **Keine** zweite Meldung; keine Spiele für dieses Team | | |
| 5 | Die Inbox von **T** und **M** | Leer – das ist Verwaltung | | |
| 6 | Das Team mit dem richtigen Verbands-Team neu verknüpfen | Der Satz verschwindet; der nächste Lauf holt die Spiele | | |

---

## TC-010: Reichweite (NFR-011, NFR-013)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M** die Teamseite suchen | Kein Weg dorthin | | |
| 2 | Als **M** `link_team()` und `unlink_team()` aufrufen | Abgewiesen | | |
| 3 | Als **V** `report_team_sync()` und `upsert_federation_game()` aufrufen | Abgewiesen (`permission denied`) | | |
| 4 | Als **V** ein Team eines **fremden** Vereins über `import_federation_teams()` verknüpfen | Abgewiesen | | |
| 5 | Als **V** die Edge Function mit `{"mode":"teams"}` für einen fremden Verein aufrufen | 403 | | |

---

## TC-011: Vier Sprachen und iOS

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Das Team-Blatt auf Französisch, Italienisch und Englisch öffnen | Alle Texte übersetzt; Verbands- und Teamnamen bleiben Eigennamen | | |
| 2 | Die Rückfrage beim Lösen prüfen | Übersetzt, «Abbrechen» links, der bestätigende Knopf rot | | |
| 3 | Das Blatt «Teams übernehmen» auf 320 px prüfen | Kontrollkästchen und Vorschlagstext stehen untereinander, nichts läuft über | | |
| 4 | Das Blatt als Karte über der Seite prüfen (iOS) | Die Seite tritt zurück; Ziehen nach unten schliesst | | |
| 5 | Die Agenda-Zeile mit Resultat prüfen | Das Resultat steht in eigener Zeile mit Symbol | | |

---

## Offen

- **Deployt am 2026-09-12**, Vault-Einträge gesetzt. TC-001 bis TC-006 sind
  damit am laufenden Projekt ausführbar; die Datenbankseite ist geprüft
  (32 von 32).
- **Drei der vier Verbände** haben keine Schnittstelle; für sie zeigt der
  Abschnitt A4.
- **Tabellen und Resultatsicht je Team** bleiben FR-128 (`Deferred`).

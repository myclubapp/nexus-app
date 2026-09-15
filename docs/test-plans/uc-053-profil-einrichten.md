# Manual Test Plan: UC-053 — Profil einrichten

**Use Case:** [UC-053](../use_cases/UC-053-profil-einrichten.md)
**Geltungsbereich:** Der Profil-Assistent nach dem Beitritt – vier Schritte, Ausstieg, Weg zurück, Nachmigration des Bestands
**Anforderungen:** FR-200 – dazu FR-163, FR-166, FR-144
**Regeln:** BR-270, BR-214, BR-028, BR-031, BR-208, BR-117
**Erstellt:** 2026-09-15

## Vorbereitung

- **N** — ein **neues** Konto ohne Mitgliedschaft, **V** — Vorstand mit einem
  Einladungslink, **B** — ein Konto, das den Verein schon länger nutzt und ein
  gepflegtes Profil hat.
- Migration `0105_profile_setup.sql` ist eingespielt.
- Für TC-006 (Push) gilt die Vorbereitung aus
  [uc-052](uc-052-push-versand.md); ohne sie zeigt der vierte Schritt die
  Auskunft statt des Knopfs – das ist dort das erwartete Ergebnis.

---

## TC-001: Der Assistent geht nach dem Beitritt einmal auf

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **N** den Einladungslink von **V** öffnen und beitreten | Die App zeigt den Verein | | |
| 2 | Kurz warten | Der Assistent «Profil einrichten» geht von selbst auf, mit «Schritt 1 von 4» | | |
| 3 | Den Fortschrittsbalken ansehen | Er steht bei einem Viertel | | |
| 4 | Zum Dashboard zurückgehen (Zurück-Geste), App schliessen und neu öffnen | Der Assistent geht in dieser Sitzung **nicht** erneut von selbst auf | | |

---

## TC-002: Bild (Schritt 1)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Im ersten Schritt ein Bild aus der Mediathek wählen | Vorschau erscheint, Toast «Gespeichert» | | |
| 2 | Den Assistenten **sofort** verlassen («Später») und Profil öffnen | Das Bild ist da – es war sofort gespeichert, nicht erst am Ende | | |
| 3 | Zurück in den Assistenten (Profil → «Profil einrichten»), Bild entfernen | Toast «Entfernt», Vorschau leer | | |
| 4 | «Weiter» ohne Bild | Geht – ein Bild ist ein Angebot, keine Bedingung | | |

---

## TC-003: Name (Schritt 2, BR-031/BR-208)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den zweiten Schritt betrachten | Der Anzeigename steht auf dem Teil vor dem @ der Adresse | | |
| 2 | Alle drei Felder leeren | «Weiter» ist **gesperrt** | | |
| 3 | Nur einen Vornamen eintragen | Weiterhin gesperrt | | |
| 4 | Nachnamen ergänzen | «Weiter» wird frei; nach dem Weitergehen steht der Anzeigename als «Vorname Nachname» | | |
| 5 | Zurück in den Schritt, einen eigenen Anzeigenamen eintragen, weitergehen | Der eigene Name gewinnt | | |
| 6 | Mitgliederliste des Vereins öffnen (als **V**) | Dort steht derselbe Name | | |

---

## TC-004: Erreichbarkeit (Schritt 3)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Eine Telefonnummer eintragen, Freigabe **aus** lassen, weitergehen | – | | |
| 2 | Als anderes Mitglied das Verzeichnis öffnen | Die Nummer ist **nicht** zu sehen | | |
| 3 | Als **V** (Vorstand) dieselbe Person ansehen | Die Nummer ist zu sehen | | |
| 4 | Den Satz zur Adresse lesen | Er nennt die Adresse, mit der **N** angemeldet ist | | |

---

## TC-005: Meldungen (Schritt 4)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den vierten Schritt lesen | Er sagt, dass die Inbox alles enthält und die E-Mail bereits läuft (täglich 18:00) | | |
| 2 | «Dieses Gerät anmelden» | Das System fragt nach der Erlaubnis | | |
| 3 | Erlauben | Toast, danach steht «Dieses Gerät ist angemeldet» statt des Knopfs | | |
| 4 | «Einzeln einstellen, je Kategorie» antippen | Die Seite Benachrichtigungen öffnet sich | | |
| 5 | Zurück, «Fertig» | Toast «Dein Profil steht …», Dashboard | | |

---

## TC-006: Abgelehnte Erlaubnis ist kein Fehler (A2)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf einem Gerät, auf dem noch nie gefragt wurde, im vierten Schritt «Nicht erlauben» wählen | Ein Hinweis, **keine** rote Fehlermeldung; er sagt, dass die Inbox weiterhin alles enthält | | |
| 2 | «Fertig» | Geht – der Schritt ist abschliessbar | | |
| 3 | In die Benachrichtigungen gehen | Dort steht dieselbe Auskunft samt Hinweis auf die Systemeinstellungen | | |

---

## TC-007: Überspringen ist eine Antwort (BR-270)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Mit einem frischen Konto beitreten, im **ersten** Schritt «Später» wählen | Dashboard | | |
| 2 | App schliessen, neu öffnen, anmelden | Der Assistent geht **nicht** wieder von selbst auf | | |
| 3 | Auf das Dashboard schauen | Die Zeile «Zeig dich dem Verein» steht dort | | |
| 4 | Die Zeile antippen | Der Assistent öffnet sich, bei Schritt 1 | | |
| 5 | Einen Namen eintragen, «Fertig» | Dashboard – **ohne** die Zeile | | |
| 6 | Profil öffnen | «Profil einrichten» steht weiterhin als Zeile da (dauerhafter Weg zurück) | | |

---

## TC-008: Der Bestand wird nicht behelligt (Nachmigration)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **B** anmelden (Konto mit gepflegtem Profil, seit vor der Migration) | Der Assistent geht **nicht** auf | | |
| 2 | Dashboard ansehen | Keine Zeile «Zeig dich dem Verein» | | |
| 3 | `select count(*) from club_members where profile_setup_at is null and user_id is not null and (avatar_url is not null or (first_name is not null and last_name is not null))` | 0 | | |
| 4 | Ein **importiertes** Mitglied ohne Konto (aus UC-040) melden sich erstmals an | Der Assistent geht auf – gefragt wurde diese Person noch nie | | |
| 5 | Im zweiten Schritt schauen | Vor- und Nachname sind aus dem Import **vorbelegt** | | |

---

## TC-009: BR-214 — was ein Mitglied an der eigenen Zeile darf

**Priority:** Medium — **braucht ein Konto, das nicht im Vorstand ist**

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **N** (Rolle `member`) mit dem eigenen Token ein `PATCH /rest/v1/club_members?id=eq.<eigene id>` mit `{"profile_setup_at":null}` schicken | Abgewiesen: «An der eigenen Mitgliedschaft lässt sich nur die Teilnahme an Ranglisten ändern» | | |
| 2 | Dasselbe mit `{"leaderboard_opt_in":false}` | Geht durch | | |
| 3 | `finish_profile_setup` mit der **Mitglieds-Id einer anderen Person** aufrufen | «Nur die Person selbst schliesst ihre Einrichtung ab» | | |

---

## TC-010: Zweiter Verein (A5)

**Priority:** Low

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **N** einem **zweiten** Verein beitreten | Der Assistent geht dort erneut auf | | |
| 2 | Bild und Name eintragen, «Fertig» | Gespeichert | | |
| 3 | Zum ersten Verein wechseln (Profil → Verein) | Dort steht das **alte** Profil – Bild und Name gelten je Verein | | |

---

## TC-011: Grosse Fenster

**Priority:** Low

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Assistenten im Browser bei über 1000 px öffnen | Schrittführung und Felder in der üblichen zentrierten Spalte, kein Feld über die ganze Breite | | |
| 2 | Auf dem Telefon wiederholen | Ränder wie auf jeder anderen Seite | | |
| 3 | Gerät drehen | Die Spalte bleibt zentriert | | |

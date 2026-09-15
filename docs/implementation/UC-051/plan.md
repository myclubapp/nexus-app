# Implementation Plan: UC-051 — Verein einrichten

|                   |                                                                     |
| ----------------- | ------------------------------------------------------------------- |
| **Primary Actor** | Vorstand                                                            |
| **Goal**          | Nach der Gründung Schritt für Schritt durch Verband, Verbandsnews, Teams, Beispielinhalte und Mitglieder führen – überspringbar, jeder Schritt sofort wirksam |
| **Plan created**  | 2026-09-15                                                          |
| **Status**        | Implemented – `0101`/`0102` gegen die laufende Datenbank geprüft (24/24 grün, in einer zurückgerollten Transaktion); **noch nicht eingespielt** und `sync-federation` noch nicht deployt |

## Overview

Sandros Befund vom 15.09.2026, in drei Teilen:

| Befund | Antwort |
| --- | --- |
| «Der Onboarding-Screen ist nicht wirklich gut umgesetzt und auf grösseren Screens nicht gut dargestellt, weiter auch nicht an den Login-Screen angelehnt.» | Ein gemeinsames Gerüst `AuthShell` für Anmeldung **und** Onboarding |
| «Ich bin mir nicht sicher, ob der Anfrage-Flow gut umgesetzt ist? Die Möglichkeit für eine öffentliche Anfrage muss über die Vereinseinstellungen gemacht werden.» | FR-196, BR-258: Schalter am Verein, Voreinstellung **aus**, durchgesetzt in `request_join()` |
| «Beim Erstellen eines Vereins ist der Onboarding-Flow noch nicht korrekt. Ich möchte Schritt für Schritt die wichtigsten Einstellungen vornehmen können – Testdaten, Teams anlegen resp. mit Verband verknüpfen. Und wenn ich mit Verband verknüpfe, soll die Abfrage kommen, ob ich die Verbandsnews anzeigen möchte.» | FR-195, FR-197: der Assistent mit vier bis fünf Schritten |

**Der Befund hinter dem Layout:** Die Onboarding-Seite war eine `AppPage` mit
Kopfzeile, und nur das `IonSegment` lag in `.app-centered` (max. 480 px). Wizard,
Listen und Knopfleiste standen daneben und nahmen die volle Fensterbreite – auf
einem Tabletbildschirm zog sich das Namensfeld über mehr als 1000 px. Die
Anmeldung dagegen hatte kein `AppPage`, sondern eine eigene zentrierte Spalte.
Zwei Seiten hintereinander, zwei Layouts.

**Der Befund hinter der Anfrage:** `find_club_by_slug()` aus `0010` gibt jedem
angemeldeten Konto jeden Verein heraus, und `request_join()` fragte niemanden, ob
der Verein das will. Der Kurzname steht in jedem Einladungslink und in jeder
Adresszeile; er ist kein Geheimnis. Damit war die Tür jedes Vereins angelehnt,
ohne dass ihn jemand gefragt hätte.

**Der Befund hinter den Verbandsnews:** UC-035 verspricht in Schritt 7
«Verbandsnews im Feed», `news.source` kennt den Wert `federation` seit `0004` –
geschrieben hat ihn nie jemand. Der Abgleich holte Teams und Spiele, keine
Beiträge. Das Versprechen stand zwei Migrationen lang im Dokument und nirgends
im Code.

## Related Use Cases

- **UC-001** Verein gründen – Schritt 10 führt neu in den Assistenten; die drei Eingabeschritte der Gründung bleiben (BR-004)
- **UC-004** Beitritts-Anfrage entscheiden – bekommt mit BR-258 eine Vorbedingung
- **UC-035** Verband verbinden – Schritt 7 wird zur Frage statt zur Zusage
- **UC-037** Beispielinhalte verwalten – der vierte Schritt des Assistenten
- **UC-039** Verbands-Team verknüpfen – der dritte Schritt nutzt A1 («Teams übernehmen»)
- **UC-003** Einladung erstellen – der fünfte Schritt legt eine Einladung mit den Vorgaben an und führt für alles Weitere dorthin

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                          | Status vorher | Ziel        | Notizen                                                          |
| ------ | ------------------------------ | ------------- | ----------- | ---------------------------------------------------------------- |
| FR-195 | Verein einrichten (Assistent)  | neu           | Implemented | `ClubSetupPage`, `lib/clubSetup.ts`, Route `/tabs/profile/setup`  |
| FR-196 | Offene Anfragen als Vereinseinstellung | neu   | Implemented | `clubs.settings.join.public`, `0101`, Schalter in `ClubSettingsPage` |
| FR-197 | Verbandsnews im Feed           | neu           | Implemented | `federation_connections.news_enabled`, `0102`, `sync-federation`  |
| FR-004 | Verein gründen                 | Implemented   | Implemented | Unverändert – drei Eingabeschritte (BR-004)                       |
| FR-006 | Zero-Config-Start              | Implemented   | Implemented | Unverändert – der Assistent fügt nichts hinzu, was ohne ihn fehlte |
| FR-009 | Beitritts-Anfrage stellen      | Implemented   | Implemented | Neu an die Freigabe gebunden                                      |
| FR-144 | Leere Zustände mit Angebot     | Implemented   | Implemented | Der Team-Schritt trägt sein Angebot (`emptyStateAction.test.ts`)   |

### Business Rules

| ID     | Regel | Wo sie steht |
| ------ | ----- | ------------ |
| BR-258 | Ohne Freigabe keine Anfrage | `request_join()` in `0101` – **nicht** im Formular |
| BR-259 | Der Assistent ist ein Angebot | `Wizard onSkip`, jeder Schritt wirkt sofort |
| BR-260 | Verbandsnews sind zugeschaltet, nicht voreingestellt | `news_enabled boolean not null default false`, `upsert_federation_news()` prüft sie |
| BR-261 | Ein Verbandsbeitrag ist keine Zuwendung | `club_health()` zählt seit jeher nur `source = 'club'` – nichts zu ändern, aber festzuhalten |
| BR-262 | Der Kurzname ist kein Geheimnis, aber auch kein Schlüssel | `find_club_by_slug()` gibt den Namen **und** `accepts_requests` |

---

## Entscheide

| Frage | Entscheid | Warum |
| --- | --- | --- |
| Voreinstellung der offenen Anfrage | **Aus**, auch für bestehende Vereine | Sandros Wahl vom 15.09.2026. Die einzige Richtung, die keinen Verein ungefragt öffnet |
| Wo sitzt die Newsfrage? | An der **Verbindung**, nicht am Verein | Ein Verein kann an zwei Verbänden hängen (BR-180) |
| Token der Publishr-API | `SWISSUNIHOCKEY_NEWS_TOKEN` als Function-Secret | Im alten Backend steht er im Quelltext; BR-153 schliesst Schlüssel im Repository aus |
| Eigener Wizard oder Einstellungsseite? | Wizard | Wer eben gegründet hat, weiss nicht, was als Nächstes kommt. Eine Seite mit fünfzehn Schaltern beantwortet das nicht (NFR-024) |
| Vierte Zeile in der «Erste Schritte»-Karte? | **Nein** – Knopf in der Überschrift | BR-002/BR-171 halten die Karte bei drei Angeboten |

---

## Migrationen

### `0101_public_join_requests.sql`

- `club_accepts_join_requests(uuid)` – die Regel «fehlt der Eintrag, ist es aus» an **einer** Stelle; interne Routine ohne Ausführungsrecht für Clients
- `find_club_by_slug(text)` – **neu gedroppt und angelegt**, weil die Rückgabe eine Spalte bekommt (`accepts_requests`)
- `request_join()` – fortgeschrieben aus `0010`, **eine** Bedingung mehr

### `0102_federation_news.sql`

- `federation_connections.news_enabled boolean not null default false`
- `set_federation_news(uuid, text, boolean)` – Rollenprüfung im Server, weil die Tabelle seit `0058` bewusst keine Schreib-Policy hat
- `federation_credentials(uuid)` – **gedroppt und angelegt**, Rückgabe um `news_enabled` erweitert; bleibt `service_role`
- `upsert_federation_news(...)` – legt einen Beitrag ab, **nur** bei zugeschalteter Verbindung; dedupliziert über `news_external_key (club_id, source, external_id)` aus `0022`

**Nummern:** Remote stand auf `0100`, lokal ebenso; `0101`/`0102` wurden vor der
Arbeit bei der Parallelsitzung `nexus-app-28` angemeldet (keine Kollision).

---

## Verhaltensprüfung (Schritt 3)

`supabase db query --linked` mit `begin;` + beide Migrationen + `do $probe$` +
`raise exception`. **Vorher belegt, dass der Rollback dort greift** – eine
Wegwerftabelle überlebte ihn nicht (`rollback_proof.sql`). Nach dem Lauf:
kein `news_enabled`, keine neue Funktion, keine Zeile, `settings->'join'` weiter
`null`.

24 Prüfungen, alle grün:

| Bereich | Geprüft |
| --- | --- |
| BR-258 | `accepts_requests` ist aus; `request_join` wird abgewiesen; **keine Zeile entstanden** (Differenz gemessen, nicht Ausnahme abgefangen) |
| BR-258 offen | Nach `settings.join.public = true`: `accepts_requests` an, genau **eine** Anfrage, Status `pending` |
| NFR-013 | `club_accepts_join_requests` und `upsert_federation_news` für `authenticated` gesperrt, `find_club_by_slug` offen, für `anon` gesperrt, `federation_credentials` nur `service_role` |
| FR-197 | `news_enabled` voreingestellt aus; nur der Vorstand legt den Schalter um (ein Aussenstehender wird abgewiesen) |
| BR-260 | Bei abgeschalteten News legt `upsert_federation_news` **nichts** ab und gibt `false` zurück |
| BR-168 sinngemäss | Zweiter Lauf aktualisiert denselben Beitrag, statt ihn zu verdoppeln |

**Die Schnittstelle selbst ist belegt** (15.09.2026, mit den Kopfzeilen der Edge
Function): `fkMediahouse=61` liefert 20 Beiträge, alle mit Titel, Anriss, Bild,
Autor und `publishTimestamp`. **Element 61 (Volltext) fehlt dort**, und
`canonicalUrl` ist überall `null` – der Feed zeigt deshalb den Anriss, das Detail
ebenso, und es gibt keinen Verweis ins Leere.

---

## Offen / Betrieb

1. `supabase db push` für `0101` und `0102` – vom Auto-Mode-Classifier blockiert, Sandro löst ihn aus. Bis dahin überbrückt ein Block in `app/src/lib/database.types.ts` die Typen; er ist dort als Übergang markiert.
2. `supabase functions deploy sync-federation`
3. `supabase secrets set SWISSUNIHOCKEY_NEWS_TOKEN=…` – der Token steht im alten Backend (`myclubapp/backend`, `graphql/swissunihockey/resolvers.ts`). Ohne ihn meldet der Abgleich ehrlich «Für diesen Verband sind keine News eingerichtet», genau wie die drei Verbände ohne Schnittstelle.
4. Gerätetest nach `docs/test-plans/uc-051-verein-einrichten.md`.

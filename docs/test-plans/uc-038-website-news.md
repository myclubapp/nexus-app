# Manual Test Plan: UC-038 — News von der Vereins-Website übernehmen

**Use Case:** [UC-038](../use_cases/UC-038-website-news-uebernehmen.md)
**Geltungsbereich:** Adresse erfassen, Import, Deduplikation, Fehlerfall, Trennen, Zeitplan
**Anforderungen:** FR-146, FR-147, FR-149
**Regeln:** BR-167 bis BR-174
**Erstellt:** 2026-09-09 · **Erweitert:** 2026-09-10 (Prüfung, Umfang, Kategorien)

## Vorbereitung

- Ein **frisch gegründeter** Verein (UC-001), noch ohne Termine und ohne
  weitere Mitglieder — sonst erscheint die «Erste Schritte»-Karte nicht.
- **V** — Vorstand (admin), **M** — Mitglied ohne Funktion.
- Migrationen `0022_news_sources.sql` und `0023_news_sync_schedule.sql` sind
  eingespielt, die Function `import-wordpress-news` ist deployt.
- Eine erreichbare WordPress-Website mit mindestens drei Beiträgen. Für TC-001
  eignet sich jede öffentliche Vereinsseite, z.B. `kadettensh.ch`.
- Für TC-007 die Vault-Geheimnisse `project_url` und `service_role_key`
  (siehe Umsetzungsplan, Lücke 1).

---

## TC-001: Website verbinden (Hauptablauf)

**Priority:** High
**Preconditions:** Als **V** angemeldet, Tab «Dashboard» offen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Karte «Erste Schritte» ansehen | **Vier** Zeilen; die letzte heisst «News von eurer Website holen» | | |
| 2 | Diese Zeile antippen | Die Ansicht «News von der Website» öffnet sich mit leerem Adressfeld | | |
| 3 | Den Text unter dem Adressfeld lesen | Er nennt WordPress als **Voraussetzung** — nicht als Möglichkeit | | |
| 4 | Den Abschnitt «Umfang» ansehen | «Beiträge je Abgleich» steht auf 20; «Kategorien» ist gesperrt und verweist auf die Prüfung | | |
| 5 | `kadetten-unihockey.ch` eintippen — **ohne** `https://` | Unter dem Feld steht «Abgefragt wird https://kadetten-unihockey.ch» | | |
| 6 | «Website prüfen» antippen | Spinner; danach der Abschnitt «Gefunden» mit dem Namen der Website und «WordPress erkannt · 165 Beiträge veröffentlicht» (die Zahl wächst mit der Website) | | |
| 7 | Die zweite Zeile im Abschnitt «Gefunden» lesen | «Schnittstelle: https://kadetten-unihockey.ch/wp-json/wp/v2/posts» | | |
| 8 | «Kategorien» öffnen | Die Kategorien der Website mit ihrer Beitragszahl, die häufigste zuoberst («App (122)», «Herren 1 (93)», …) | | |
| 9 | Ohne Auswahl schliessen, «Beiträge je Abgleich» auf 50 stellen | Das Feld zeigt «50 Beiträge» | | |
| 10 | «Beiträge holen» antippen | Spinner; nach wenigen Sekunden Toast «50 Beiträge übernommen» | | |
| 11 | Den Abschnitt «Verbundene Website» ansehen | Name der Website, Zeitpunkt und «50 Beiträge»; darunter «Gespeichert: 50 Beiträge je Abgleich · Alle Kategorien» | | |
| 12 | Zurück zum Dashboard | Der Abschnitt «Neuste News» zeigt Beiträge der Website statt des Leer-Zustands | | |
| 13 | Die Karte «Erste Schritte» ansehen | Nur noch **drei** Zeilen — das Angebot ist weg (BR-171) | | |

---

## TC-002: Adresse in jeder Schreibweise

**Priority:** Medium
**Preconditions:** Als **V** angemeldet, Ansicht «News von der Website» offen, noch nichts verbunden.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `HTTP://www.Kadettensh.ch/` eingeben | Vorschau: `https://www.kadettensh.ch` — https, klein, kein Schrägstrich | | |
| 2 | Feld leeren, `kadettensh.ch/wp-json/wp/v2/posts` einfügen | Vorschau: `https://kadettensh.ch` — der Schnittstellenpfad ist abgeschnitten | | |
| 3 | Feld leeren, `kein Verein` eingeben | Keine Vorschau, «Beiträge holen» ist **ausgegraut** | | |
| 4 | Feld leeren, `localhost` eingeben | Ebenfalls ausgegraut | | |

---

## TC-003: Zweiter Abgleich legt nichts doppelt an (BR-168)

**Priority:** High
**Preconditions:** TC-001 ist durchgelaufen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Beiträge im Dashboard zählen bzw. die oberste Überschrift notieren | — | | |
| 2 | In der Ansicht «Jetzt aktualisieren» antippen | Toast mit derselben Anzahl wie in TC-001 | | |
| 3 | Das Dashboard erneut ansehen | Kein Beitrag steht **zweimal** da | | |
| 4 | In der Datenbank: `select count(*), count(distinct external_id) from news where source = 'website';` | Beide Zahlen sind gleich | | |

---

## TC-004: Adresse ohne WordPress (A1, BR-173)

**Priority:** High
**Preconditions:** Als **V** angemeldet, Ansicht offen, **nichts** verbunden.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `example.com` eingeben und «Website prüfen» antippen | Rote Meldung «Unter dieser Adresse antwortet keine WordPress-Schnittstelle», dahinter in Klammern, was die Website zurückgab | | |
| 2 | Den Text unter der Meldung lesen | Er erklärt die zwei möglichen Ursachen (kein WordPress / Schnittstelle gesperrt) und rät, wer weiterhilft | | |
| 3 | Der Abschnitt «Gefunden» und die Kategorien | Beide fehlen; «Kategorien» bleibt gesperrt | | |
| 4 | Trotzdem «Beiträge holen» antippen | Dieselbe Meldung — und **keine** Quelle: Der Abschnitt «Verbundene Website» erscheint nicht (BR-173) | | |
| 5 | `select count(*) from news_sources;` | Unverändert gegenüber vorher | | |
| 6 | Die Adresse auf eine gültige korrigieren und erneut prüfen | «Gefunden» erscheint, die Fehlermeldung verschwindet | | |

---

## TC-005: Verbindung trennen (A4, BR-170)

**Priority:** High
**Preconditions:** TC-001 ist durchgelaufen.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Verbindung trennen» antippen | Toast «Verbindung getrennt. Die übernommenen Beiträge bleiben.» | | |
| 2 | Die Ansicht betrachten | Das Adressfeld ist leer, der Statusabschnitt ist weg | | |
| 3 | Zum Dashboard wechseln | Die übernommenen Beiträge stehen **weiterhin** im Feed | | |
| 4 | Zurück in die Ansicht, dieselbe Adresse erneut verbinden | Der Import glückt; es entstehen keine Doppel (BR-168) | | |

---

## TC-006: Nur der Vorstand (A5, NFR-011)

**Priority:** High
**Preconditions:** Als **M** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Profil» öffnen | «News von der Website» steht **nicht** in der Liste | | |
| 2 | `/tabs/profile/news` direkt aufrufen | Hinweis «Nur der Vorstand kann die Website verbinden.» | | |
| 3 | Mit dem Anon-Schlüssel und dem JWT von **M** die Function aufrufen: `POST /functions/v1/import-wordpress-news` mit `{"clubId":"<Verein>","url":"https://kadettensh.ch"}` | HTTP **403**, `{"error":"Nur der Vorstand kann die Website verbinden"}` — das UI ist Bequemlichkeit, die Prüfung liegt auf dem Server | | |
| 4 | Dieselbe Function mit `{"mode":"all"}` aufrufen | HTTP **403**, `{"error":"Nur der Zeitplan darf alle Quellen abgleichen"}` | | |
| 5 | Dieselbe Function mit `{"mode":"check","clubId":"<Verein>","url":"https://kadetten-unihockey.ch"}` aufrufen | HTTP **403** — auch das Prüfen ruft vom Server aus eine fremde Website auf und steht nicht jedem Mitglied offen | | |
| 6 | Als **V** mit `{"mode":"check","clubId":"<Verein>","url":"https://192.168.1.10"}` aufrufen | HTTP **400**, «Diese Adresse zeigt nicht auf eine öffentliche Website» — die Function ist kein Fernrohr ins fremde Netz | | |

---

## TC-007: Nächtlicher Abgleich (FR-147)

**Priority:** Medium
**Preconditions:** Die Vault-Geheimnisse sind gesetzt, eine Quelle ist verbunden.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `select * from cron.job where jobname = 'news-website-sync';` | Ein aktiver Job, Zeitplan `20 4 * * *` | | |
| 2 | `select public.sync_news_sources();` als `postgres` ausführen | Eine Request-ID (bigint), **nicht** `null` | | |
| 3 | Kurz warten, dann `select * from net._http_response order by created desc limit 1;` | Status 200, im Rumpf `{"synced":1,...}` | | |
| 4 | `select last_sync_at, last_status, last_imported from news_sources;` | Zeitpunkt von eben, `ok`, Anzahl > 0 | | |
| 5 | Auf der Website einen neuen Beitrag publizieren, Schritt 2 wiederholen | Der neue Beitrag steht im Feed | | |

---

## TC-008: Website antwortet nicht (A2)

**Priority:** Medium
**Preconditions:** Eine Quelle ist verbunden.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Quelle in der Datenbank auf eine nicht erreichbare Adresse zeigen lassen: `update news_sources set url = 'https://verein-gibt-es-nicht.example' where kind = 'wordpress';` | — | | |
| 2 | `select public.sync_news_sources();` ausführen und kurz warten | — | | |
| 3 | Die Ansicht «News von der Website» öffnen | Abschnitt «Letzter Abgleich fehlgeschlagen» in Rot, darunter der Grund | | |
| 4 | Das Dashboard ansehen | Die bereits übernommenen Beiträge stehen unverändert da; die App ist vollständig bedienbar | | |
| 5 | Die Adresse korrigieren und «Jetzt aktualisieren» antippen | Die Fehlerzeile verschwindet, der Status steht wieder auf einem Zeitpunkt | | |

---

## TC-009: Umfang und Kategorien einstellen (FR-149, BR-174, A6)

**Priority:** High
**Preconditions:** TC-001 ist durchgelaufen, die Website ist verbunden.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Die Ansicht neu öffnen | Adresse, «50 Beiträge» und die gespeicherte Kategorienauswahl stehen bereits da | | |
| 2 | «Website prüfen» antippen | «Gefunden» erscheint, die Kategorien stehen zur Auswahl | | |
| 3 | Genau eine Kategorie wählen, z.B. «Damen», und «Beiträge je Abgleich» auf 5 stellen | Das Feld zeigt «Damen», das andere «5 Beiträge» | | |
| 4 | «Jetzt aktualisieren» antippen | Toast «5 Beiträge übernommen» | | |
| 5 | Die Statuszeile lesen | «Gespeichert: 5 Beiträge je Abgleich · Damen» | | |
| 6 | `select post_limit, categories from news_sources;` | `5` und `[{"id": …, "name": "Damen"}]` | | |
| 7 | Die fünf neuesten Beiträge im Feed mit der Website vergleichen | Es sind die neuesten Beiträge **dieser** Kategorie | | |
| 8 | Zurück auf «Alle Kategorien» stellen (Auswahl leeren) und aktualisieren | Statuszeile «… · Alle Kategorien»; der Feed füllt sich wieder aus allen Kategorien | | |
| 9 | Die vorher engere Auswahl bedenken | Beiträge, die durch Schritt 3 herausgefallen waren, stehen **weiterhin** im Feed (BR-170) | | |

---

## TC-010: Grenzen der Einstellung (BR-174)

**Priority:** Medium
**Preconditions:** Als **V** angemeldet, eine Quelle ist verbunden.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Beiträge je Abgleich» öffnen | Genau fünf Stufen: 5, 10, 20, 50, 100 — keine freie Eingabe | | |
| 2 | 100 wählen und aktualisieren | Der Import glückt; die Website liefert bis zu hundert Beiträge | | |
| 3 | In der Datenbank `update news_sources set post_limit = 101;` versuchen | Fehler `check`-Constraint: Die Obergrenze steht auch in der Datenbank | | |
| 4 | `update news_sources set post_limit = 0;` versuchen | Ebenfalls abgelehnt | | |
| 5 | `update news_sources set api_style = 'rss';` versuchen | Ebenfalls abgelehnt | | |

---

## TC-011: WordPress ohne sprechende Adressen (api_style)

**Priority:** Low
**Preconditions:** Eine WordPress-Website, deren Permalinks auf «Einfach» stehen (`?p=123`), oder eine, die `/wp-json/` sperrt.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Diese Adresse eingeben und «Website prüfen» | «Gefunden» erscheint; die Zeile «Schnittstelle:» zeigt `…/?rest_route=/wp/v2/posts` | | |
| 2 | «Beiträge holen» antippen | Der Import glückt | | |
| 3 | `select api_style from news_sources;` | `query` | | |
| 4 | Am nächsten Morgen den Feed ansehen (oder TC-007 ausführen) | Der nächtliche Abgleich nimmt denselben Weg und bringt neue Beiträge | | |

---

## TC-012: Die Prüfung schreibt nichts (BR-173)

**Priority:** Medium
**Preconditions:** Als **V** angemeldet, eine Quelle ist verbunden.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `select last_sync_at, last_imported, post_limit, categories from news_sources;` notieren | — | | |
| 2 | Die Adresse ändern, «Website prüfen» antippen, Kategorien anwählen — aber **nicht** aktualisieren | «Gefunden» erscheint | | |
| 3 | Die Ansicht verlassen und dieselbe Abfrage wiederholen | Alle vier Werte sind **unverändert**: Geprüft wird, gespeichert erst mit «Beiträge holen» | | |
| 4 | Die Ansicht erneut öffnen | Die gespeicherte Adresse und der gespeicherte Umfang stehen wieder da, nicht die verworfene Eingabe | | |

---

## Abnahmekriterien

- TC-001 bis TC-006 und TC-009, TC-010, TC-012 ohne Fehlschlag.
- TC-007 nach der Vault-Einrichtung ohne Fehlschlag; TC-011, sobald eine
  Website ohne sprechende Adressen zur Hand ist.
- Kein Beitrag steht doppelt im Feed (BR-168).
- Ein Fehlschlag hinterlässt keine halbe Quelle und keinen halben Import.
- Eine Person, die die Ansicht zum ersten Mal öffnet, weiss vor dem ersten
  Antippen, dass die Website mit WordPress laufen muss.

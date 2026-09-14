# Implementation Plan: UC-038 — News von der Vereins-Website übernehmen

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand                                                            |
| **Goal**          | Die bestehenden Beiträge der Vereins-Website in den Feed holen und dort aktuell halten |
| **Plan created**  | 2026-09-09 · erweitert 2026-09-10 (Prüfung, Umfang, Kategorien)     |
| **Status**        | Done — bis auf die einmalige Vault-Einrichtung (Lücke 1)            |

## Overview

Fast jeder Verein, der myclub nexus aufsetzt, hat schon eine Website, und dort
steht seine Vergangenheit. Wer sie mitnimmt, startet mit einem Feed voller
echter Meldungen statt mit Beispielinhalten — der Unterschied zwischen «neues
Werkzeug» und «unser Verein».

Die Vorlage ist `updateClubNewsFromWordpress()` aus dem alten Backend
(`github.com/myclubapp/backend`, `functions/src/scheduler/syncAssociation.scheduler.ts`).
Übernommen sind Quelle, Felder und die Deduplikation über die Beitrags-ID der
Website; abgewichen wird an vier Stellen, die unten unter «Abweichungen vom
alten Backend» stehen.

## Related Use Cases

- UC-001 Verein gründen — der Startbildschirm bietet den Import an, solange
  keine Website verbunden ist (BR-171)
- UC-026 Vereins-News publizieren — dieselbe Tabelle, andere Herkunft
- UC-035 Verband verbinden — dasselbe Muster «externe Quelle, eigener Takt»;
  wenn dort ein Verbindungsstatus entsteht, sind `news_sources` und die
  Verbandsverbindung zusammenzuführen
- UC-037 Beispielinhalte verwalten — der Import ist die bessere Alternative:
  Wer eine Website hat, braucht keine Beispiel-News

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                       | Status      | Notizen                                                                 |
| ------ | --------------------------- | ----------- | ----------------------------------------------------------------------- |
| FR-146 | Website-News übernehmen     | Implemented | `NewsSourcePage`, Edge Function `import-wordpress-news`                  |
| FR-147 | Website-News aktuell halten | Partial     | Zeitplan steht (`cron.job` `news-website-sync`), läuft aber erst nach der Vault-Einrichtung (Lücke 1) |
| FR-149 | Umfang des Imports einstellen | Implemented | `mode: 'check'` in der Function, `post_limit`/`categories`/`api_style` in 0048, Abschnitt «Umfang» in der Ansicht |

### Business Rules

| ID     | Regel                                | Status      | Notizen                                                                 |
| ------ | ------------------------------------ | ----------- | ----------------------------------------------------------------------- |
| BR-167 | Der Abruf gehört auf den Server      | Implemented | Die App ruft nie `wp-json` auf; sie ruft die Function auf               |
| BR-168 | Ein Beitrag, eine Zeile              | Implemented | `news_external_key` auf `(club_id, source, external_id)`, Upsert darüber |
| BR-169 | Der Volltext kommt mit – entschärft  | Implemented | `body` trägt den Anriss (Liste), `body_html` den Volltext (0068), `sanitizeNewsHtml` entschärft ihn im Detail; `external_url` bleibt der Weg zur Website |
| BR-170 | Trennen löscht nichts                | Implemented | `useDisconnectWebsite` löscht nur `news_sources`                        |
| BR-171 | Der Import ist ein einmaliges Angebot | Implemented | `FirstStepsCard offerNewsImport`, zwei Tests halten beide Seiten fest    |
| BR-172 | Ein Import ist keine Verbindungs-Nachricht | Implemented | Der Eintrag entsteht in `publish_news()`; der Import schreibt an dieser Funktion vorbei direkt nach `news` und löst keinen Trigger aus (auf `news` liegt keiner) |
| BR-173 | Geprüft, bevor gespeichert wird       | Implemented | `discover()` läuft vor dem Upsert; schlägt sie fehl, entsteht keine Zeile |
| BR-174 | Der Verein bestimmt den Umfang       | Implemented | 1–100 in `check`-Constraint, Edge Function und `clampPostLimit()`; leere Auswahl = alle |

### Non-Functional Requirements

| ID      | Titel                | Kategorie | Trifft zu | Notizen                                                             |
| ------- | -------------------- | --------- | --------- | ------------------------------------------------------------------- |
| NFR-011 | Mandantentrennung    | Security  | Ja        | RLS auf `news_sources`; die Function prüft `is_club_admin()` mit dem JWT des Aufrufers |
| NFR-013 | Funktionsrechte      | Security  | Ja        | `sync_news_sources()` ist für `public`, `anon` und `authenticated` gesperrt |
| NFR-028 | Sprachparität        | Usability | Ja        | `newsImport.*` in de, fr, it, en – 36 Schlüssel                       |
| NFR-011 | Zugriff von aussen   | Security  | Ja        | Die Function holt nur öffentliche Adressen: `isPrivateHost()` weist Schleifen- und Netzadressen ab, bevor irgendetwas geholt wird |

---

## Aufbau

| Baustein | Datei | Aufgabe |
| -------- | ----- | ------- |
| Schema   | `supabase/migrations/0022_news_sources.sql` | `news_sources`, Herkunftsspalten an `news`, Dedup-Index, RLS |
| Umfang   | `supabase/migrations/0048_news_source_settings.sql` | `site_name`, `api_style`, `post_limit`, `categories` |
| Zeitplan | `supabase/migrations/0023_news_sync_schedule.sql` | pg_cron + pg_net, `sync_news_sources()`, Job `news-website-sync` (04:20 UTC) |
| Abruf    | `supabase/functions/import-wordpress-news/index.ts` | `wp-json` holen, abbilden, upserten, Status schreiben |
| Adresse  | `app/src/lib/wordpress.ts` | `normaliseSiteUrl()` — die **einzige** Normalisierung |
| Daten    | `app/src/hooks/useNewsSources.ts` | Quelle lesen, verbinden/aktualisieren, trennen |
| Ansicht  | `app/src/pages/club/NewsSourcePage.tsx` | `/tabs/profile/news` – Adresse, Prüfung, Umfang, Status |
| Angebot  | `app/src/components/FirstStepsCard.tsx` | Vierte Zeile, solange keine Website verbunden ist |

### Berechtigung

Zwei Wege, zwei Prüfungen:

- **Vorstand** (`{ clubId, url }`): Die Function legt mit dem JWT des Aufrufers
  einen zweiten Client an und ruft `is_club_admin()` — dieselbe Funktion, die
  auch in den RLS-Policies steht. Erst danach schreibt sie mit `service_role`.
- **Zeitplan** (`{ mode: 'all' }`): Die Function liest die Rolle aus dem bereits
  vom Gateway geprüften JWT und lässt nur `service_role` durch.

## Abweichungen vom alten Backend

1. **`_embed=1` statt `_links`-Nachfassen.** Das alte Backend holte pro Beitrag
   zwei weitere Aufrufe für Autor und Beitragsbild — 41 Anfragen für 20
   Beiträge. `_embed=1` liefert dieselben Daten mit dem Beitrag zusammen.
2. **Kein festes `Host: kadettensh.ch`.** Der alte Code schickte diese
   Kopfzeile an jede Website; ein Kopierfehler, der für alle anderen Vereine
   die falsche Zieladresse behauptet.
3. **`date_gmt` statt `date`.** `date` ist Ortszeit ohne Zeitzone und liegt je
   nach Server um Stunden daneben.
4. **Kein Platzhalterbild, und HTML nur durch den Filter.** Das alte Backend
   setzte notfalls `placehold.co` als Bild und die App zeigte `content.rendered`
   ungefiltert per `innerHTML`. Hier bleibt ein fehlendes Bild leer, und der
   Volltext (`body_html`, seit 0068) erreicht das DOM nur durch
   `sanitizeNewsHtml` – feste Liste erlaubter Elemente, keine Klassen, keine
   Stile, keine Ereignis-Attribute (BR-169, Entscheid vom 2026-09-12: bis
   dahin blieb der Volltext auf der Website, und das Detail zeigte den Anriss
   mit «[…]»).

---

## Die Prüfung (Nachtrag vom 2026-09-10)

Vorher fragte die Ansicht nach einer Adresse und holte im selben Zug zwanzig
Beiträge. Drei Dinge waren daran falsch:

1. **Die Voraussetzung stand nicht da.** «Läuft eure Website mit WordPress»
   liest sich als Möglichkeit, nicht als Bedingung. Wer eine Wix- oder
   Squarespace-Seite hat, erfuhr das erst aus einem Fehler einer fremden
   Website.
2. **Zwanzig war eine Zahl aus dem alten Backend.** Die Testwebsite
   `kadetten-unihockey.ch` hat 165 Beiträge; ein Verein mit Archiv will mehr,
   einer mit einem Sponsoren-Blog weniger.
3. **Eine gescheiterte Verbindung hinterliess eine Quelle.** Die Function legte
   die Zeile an und gleich danach den Fehlerstatus — entgegen der Zusicherung
   im Use Case («Es ist keine Quelle gespeichert»).

Der neue Zwischenschritt beantwortet alle drei: `mode: 'check'` fragt die
Schnittstelle, meldet Name, Beitragszahl und Kategorien zurück und speichert
nichts. Dieselbe `discover()` läuft danach vor dem Upsert — schlägt sie fehl,
entsteht keine Zeile (BR-173).

### Wie WordPress erkannt wird

| Schritt | Adresse | Beleg |
| ------- | ------- | ----- |
| 1 | `…/wp-json/?_fields=name,namespaces` | `namespaces` enthält `wp/v2` |
| 2 | `…/?rest_route=/&_fields=…` | dasselbe, für Websites ohne sprechende Adressen |
| 3 | `…/wp/v2/posts?per_page=1` über beide Wege | ein Array – für Websites, deren REST-Wurzel ein Sicherheits-Plugin sperrt |

Der Weg, der trägt, wird als `api_style` festgehalten; der nächtliche Abgleich
probiert danach nicht mehr beide durch.

### Was der Verein einstellt

| Einstellung | Spalte | Grenzen | Vorgabe |
| ----------- | ------ | ------- | ------- |
| Beiträge je Abgleich | `post_limit` | 1–100, Stufen 5/10/20/50/100 in der Ansicht | 20 |
| Kategorien | `categories` | `[{id, name}]`, leer = alle | leer |

Die hundert ist die Grenze der Schnittstelle: `per_page=101` beantwortet
WordPress mit `400`. Sie steht deshalb dreimal — im `check`-Constraint, in
`clampPostLimit()` der Function und in `clampPostLimit()` der App. Das ist
Absicht und in allen drei Dateien vermerkt; die App darf nichts anbieten, was
die Datenbank ablehnt.

## Offene Punkte

### Lücke 1 — Die Vault-Geheimnisse fehlen

`sync_news_sources()` liest Projekt-URL und Service-Role-Key aus dem Vault. Bis
beide gesetzt sind, protokolliert der nächtliche Job eine Warnung und tut
nichts; der Import von Hand ist davon nicht betroffen. Einmalig zu setzen:

```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<service-role-key>',        'service_role_key');
```

Danach `select public.sync_news_sources();` als `postgres` ausführen — kommt
eine Request-ID zurück statt `null`, läuft der Zeitplan.

### Lücke 2 — Nur WordPress

`news_sources.kind` lässt heute nur `'wordpress'` zu. RSS und Atom wären der
naheliegende zweite Fall und passen ohne Schemaänderung hinein; die Function
bräuchte dafür einen zweiten Zweig.

### Lücke 3 — Der Feed zeigt die Herkunft noch nicht

`news.source = 'website'`, `external_url` und `author` sind gespeichert, aber
Dashboard und Feed rendern sie noch nicht. Solange kein «Weiterlesen» dasteht,
sieht ein übernommener Beitrag aus wie eine eigene News — der Anrisstext endet
dann mitten im Satz. Gehört in UC-026, wenn der Feed gebaut wird.

### Lücke 4 — Keine Team-Zuordnung

Übernommene Beiträge gelten immer dem ganzen Verein. Seit 0048 **wählt** der
Verein zwar Kategorien aus, aber nur als Filter: «Herren 1» entscheidet, ob ein
Beitrag geholt wird, nicht, wessen Beitrag er ist. Eine Abbildung Kategorie →
Team wäre der nächste Schritt (`_embedded['wp:term']` liegt bereits vor) und
verlangt eine Zuordnung, die der Verein pflegen müsste.

### Lücke 5 — Mehr als hundert Beiträge

Ein Verein mit einem grossen Archiv holt beim ersten Mal hundert Beiträge und
danach jede Nacht die hundert neuesten. Wer das ganze Archiv will, bräuchte
einen Abruf über mehrere Seiten (`page=2,3,…`) — eine andere Funktion, nicht
eine grössere Zahl.

### Lücke 6 — Der Name im Auswahlfeld altert

`categories` speichert Id **und** Namen. Wird eine Kategorie auf der Website
umbenannt, zeigt die Statuszeile den alten Namen, bis jemand erneut prüft und
speichert. Der Filter selbst bleibt richtig — er läuft über die Id.

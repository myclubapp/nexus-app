-- ============================================================================
-- 0048_news_source_settings: Umfang und Auswahl des Website-Imports (UC-038)
--
-- 0022 hat die Website als Quelle abgelegt, aber jede Einstellung im Code
-- festgeschrieben: zwanzig Beiträge, alle Kategorien, `/wp-json/` als einziger
-- Weg zur Schnittstelle. Für einen Verein mit einem News-Archiv sind zwanzig
-- Beiträge zu wenig, für einen mit einem Blog voller Sponsorenbeiträge zu
-- viel — und ein Verein, dessen WordPress ohne sprechende Adressen läuft,
-- hatte gar keinen Weg hinein (FR-149, BR-173, BR-174).
--
-- Was hier dazukommt, füllt die Function beim Prüfen selbst; von Hand
-- einzutragen ist nichts.
-- ============================================================================

-- Der Name der Website aus der Schnittstelle («Kadetten Schaffhausen»). Er
-- steht in der Ansicht neben der Adresse: Er ist der Beleg dafür, dass die
-- richtige Website antwortet, und nicht irgendeine unter derselben Domain.
alter table news_sources add column site_name text;

-- Wie die Schnittstelle erreichbar ist. WordPress bietet zwei Wege, und
-- welcher gilt, hängt an den Permalink-Einstellungen der Website:
--   pretty – https://verein.ch/wp-json/wp/v2/posts
--   query  – https://verein.ch/?rest_route=/wp/v2/posts
-- Der zweite ist der Rückfallweg für Websites ohne sprechende Adressen. Die
-- Prüfung findet heraus, welcher trägt, und hält ihn hier fest, damit der
-- nächtliche Abgleich nicht jedes Mal beide durchprobiert.
alter table news_sources add column api_style text not null default 'pretty'
  check (api_style in ('pretty', 'query'));

-- Wie viele Beiträge je Abgleich. Die Obergrenze ist nicht gegriffen: Die
-- WordPress-Schnittstelle liefert pro Anfrage höchstens hundert Beiträge und
-- antwortet auf mehr mit einem Fehler. Wer mehr will, bräuchte Seitenabruf —
-- das wäre eine andere Funktion, nicht eine grössere Zahl.
alter table news_sources add column post_limit int not null default 20
  check (post_limit between 1 and 100);

-- Die gewählten Kategorien als `[{ "id": 7, "name": "Aktuell" }, …]`.
--
-- Die Id genügte der Schnittstelle, der Name steht dabei, damit die Ansicht
-- «Aktuell, Herren 1» zeigen kann, ohne die Website dafür erneut zu fragen.
-- Er ist eine Kopie des Stands beim Verbinden und wird bei jeder Prüfung
-- aufgefrischt; wer die Kategorie auf der Website umbenennt, sieht den alten
-- Namen bis zur nächsten Prüfung.
--
-- Leer heisst **alle** Kategorien, nicht keine (BR-174) — das ist die Vorgabe
-- und der Zustand jeder Quelle, die vor dieser Migration entstanden ist.
alter table news_sources add column categories jsonb not null default '[]'::jsonb
  check (jsonb_typeof(categories) = 'array');

-- ============================================================================
-- 0068_news_body_html: Der Volltext übernommener Beiträge (UC-038, BR-169)
--
-- Bis hier trug `news.body` nur den Anrisstext der Website. Das Detail-Blatt
-- zeigte deshalb dieselben drei Sätze wie die Karte, mit «[…]» am Ende und
-- ohne die Bilder im Text. Die bestehende myclub-App zeigte im Detail den
-- ganzen Artikel (`news.text`, aus `content.rendered` der Website) – und
-- dorthin sollen die Mitglieder auch hier kommen.
--
-- `body_html` trägt ab jetzt diesen Volltext, so wie die Website ihn liefert.
-- Gesichert wird er nicht beim Speichern, sondern beim Anzeigen: Die App
-- reicht ihn durch DOMPurify (app/src/lib/newsHtml.ts) mit einer festen Liste
-- erlaubter Elemente – Absätze, Überschriften, Listen, Verweise, Bilder –,
-- bevor er ins DOM kommt. Skripte, Rahmen und Formulare erreichen die Ansicht
-- nie, auch dann nicht, wenn jemand die Spalte über die Policy direkt
-- beschreibt.
--
-- `body` bleibt der Anriss für die Karte in der Liste; eine eigene News der
-- App (`publish_news`) hat weiterhin nur `body`. Fehlt `body_html`, zeigt das
-- Detail den Anriss und den Weg zur Website.
-- ============================================================================
alter table news add column body_html text;

comment on column news.body_html is
  'Volltext eines übernommenen Website-Beitrags als HTML der Quelle; die App entschärft ihn beim Anzeigen (UC-038, BR-169).';

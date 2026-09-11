-- ============================================================================
-- 0022_news_sources: News von der Vereins-Website übernehmen (UC-038)
--
-- Fast jeder Bestandsverein hat schon eine Website, meist WordPress, und dort
-- steht seine Vergangenheit. Wer den Verein neu aufsetzt, soll diese Beiträge
-- mitnehmen können, statt den Feed mit Beispielinhalten zu füllen (FR-134,
-- BR-002): Ein Feed mit echten Meldungen ist ab der ersten Minute etwas wert.
--
-- Der Abruf selbst gehört nicht hierher. Er läuft in der Edge Function
-- `import-wordpress-news`, weil die Websites der Vereine langsam sind, hinter
-- Firewalls stehen und einen browserähnlichen User-Agent verlangen – dasselbe
-- Muster wie `updateClubNewsFromWordpress()` im alten Backend. Diese Migration
-- legt nur ab, was importiert wurde und woher.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Herkunft eines importierten Beitrags.
--
-- `external_id` ist die Beitrags-ID der Website. Sie ist der Schlüssel, über
-- den ein zweiter Abgleich denselben Beitrag aktualisiert statt ihn ein
-- zweites Mal anzulegen – im alten Backend war das die zusammengesetzte
-- Dokument-ID `${club.id}-${news.id}`.
-- ---------------------------------------------------------------------------
alter table news add column external_id      text;
alter table news add column external_url     text;
alter table news add column author           text;
alter table news add column author_image_url text;
alter table news add column synced_at        timestamptz;

alter table news drop constraint news_source_check;
alter table news add constraint news_source_check
  check (source in ('club','team','federation','website'));

-- Der Dedup-Schlüssel. Bewusst **kein** partieller Index: `on conflict` kann
-- einen partiellen Index nur ableiten, wenn das Statement dessen where-Klausel
-- wiederholt – PostgREST tut das nicht, der Upsert der Edge Function liefe ins
-- Leere. Ein voller Index genügt, weil Postgres NULL-Werte als verschieden
-- betrachtet: Von Hand geschriebene News (external_id ist null) kollidieren
-- untereinander nie.
create unique index news_external_key on news (club_id, source, external_id);

-- ---------------------------------------------------------------------------
-- Die verbundene Website.
--
-- Eine Quelle je Verein und Art – der Verein hat eine Website, nicht fünf.
-- Der Status steht an der Quelle und nicht in einem Protokoll: Was der
-- Vorstand wissen muss, ist «lief der letzte Abgleich und wann».
-- ---------------------------------------------------------------------------
create table news_sources (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references clubs(id) on delete cascade,
  kind          text not null default 'wordpress' check (kind in ('wordpress')),
  -- Normalisiert von `normaliseSiteUrl()` in src/lib/wordpress.ts: https,
  -- kein Schrägstrich am Ende, keine Leerzeichen. Der Constraint hält nur
  -- fest, was dort entsteht – normalisiert wird an genau einer Stelle.
  url           text not null
                  check (url like 'https://%'
                     and url not like '%/'
                     and url !~ '[[:space:]]'),
  active        boolean not null default true,
  last_sync_at  timestamptz,
  last_status   text check (last_status in ('ok','error')),
  last_error    text,
  last_imported int not null default 0,
  created_by    uuid references club_members(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (club_id, kind)
);
create index news_sources_active_idx on news_sources (club_id) where active;

alter table news_sources enable row level security;

-- Lesen dürfen alle Mitglieder: Im Feed steht «von unserer Website», und diese
-- Herkunft soll nachvollziehbar sein. Ändern darf nur der Vorstand.
create policy news_sources_read on news_sources
  for select using (is_club_member(club_id));
create policy news_sources_admin_write on news_sources
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

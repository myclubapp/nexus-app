-- ============================================================================
-- 0102_federation_news: Verbandsnews im Feed – zugeschaltet, nicht
-- voreingestellt (UC-035, FR-197, BR-260, BR-261)
--
-- UC-035 verspricht in Schritt 7 «Verbandsnews im Feed», und `news.source`
-- kennt den Wert `federation` seit `0004`. Geschrieben hat ihn nie jemand: Der
-- Abgleich holt Teams und Spiele, keine Beiträge. Das Versprechen stand zwei
-- Migrationen lang im Dokument und nirgends im Code.
--
-- **BR-260: Der Verein schaltet sie zu.** Ein Verein verbindet den Verband
-- wegen des Spielplans; ob er auch dessen Medienmitteilungen in seinem Feed
-- haben will, ist eine zweite Frage – und die stellt der Einrichtungs-
-- Assistent unmittelbar nach dem Verbinden (UC-051). Voreingestellt ist sie
-- aus, wie jedes Modul (BR-150): Ein Feed, der sich ungefragt mit fremden
-- Beiträgen füllt, ist kein Zero-Config-Start, sondern eine Überraschung.
--
-- **BR-261: Ein Verbandsbeitrag ist keine Zuwendung.** Wie die übernommenen
-- Website-Beiträge (BR-172) zählt er **nicht** in die Verbindungs-Quote. Sonst
-- erfüllte ein Verein sie, indem er einen Schalter umlegt. Durchgesetzt ist
-- das nicht hier, sondern dort, wo gezählt wird: `club_health()` zählt seit
-- jeher nur `source = 'club'`.
--
-- Der Abruf selbst gehört wie immer in die Edge Function (`sync-federation`):
-- Die Schnittstelle des Verbands spricht kein CORS, der nächtliche Lauf findet
-- ohne angemeldete Person statt, und der Zugangs-Token ist ein Secret der
-- Function – nicht des Vereins und erst recht nicht des Geräts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Die Frage sitzt an der **Verbindung**, nicht am Verein.
--
-- Ein Verein kann an zwei Verbänden hängen (BR-180). Dann ist «wollen wir die
-- Verbandsnews» zweimal zu beantworten, und eine Einstellung am Verein hätte
-- keine Antwort darauf, welche gemeint ist.
-- ---------------------------------------------------------------------------
alter table federation_connections
  add column if not exists news_enabled boolean not null default false;

-- ---------------------------------------------------------------------------
-- Den Schalter umlegen (UC-051, Schritt 4; UC-035, Schritt 7).
--
-- Eigene Funktion statt eines `update` über eine Policy: `federation_connections`
-- hat seit `0058` bewusst **keine** Schreib-Policy – geschrieben wird
-- ausschliesslich über Funktionen, damit der Tresor-Eintrag nie über einen
-- freien `update` erreichbar ist.
-- ---------------------------------------------------------------------------
create or replace function public.set_federation_news(
  p_club_id    uuid,
  p_federation text,
  p_enabled    boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand entscheidet über die Verbandsnews';
  end if;

  update federation_connections
     set news_enabled = coalesce(p_enabled, false)
   where club_id = p_club_id and federation = p_federation;

  if not found then
    raise exception 'Diese Verbindung besteht nicht';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Was der Abgleich braucht – jetzt samt der Antwort auf die Newsfrage.
--
-- Die Rückgabe bekommt eine Spalte, deshalb erst `drop`. Unverändert bleibt
-- das Wesentliche: Die Funktion gibt den entschlüsselten Schlüssel zurück und
-- ist ausschliesslich für `service_role` ausführbar (BR-153).
-- ---------------------------------------------------------------------------
drop function if exists public.federation_credentials(uuid);

create function public.federation_credentials(p_club_id uuid default null)
returns table (
  club_id            uuid,
  federation         text,
  federation_club_id text,
  api_key            text,
  news_enabled       boolean
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select c.club_id, c.federation, c.federation_club_id,
         (select s.decrypted_secret from vault.decrypted_secrets s
           where s.name = c.api_key_secret),
         c.news_enabled
    from federation_connections c
   where p_club_id is null or c.club_id = p_club_id;
$$;

-- ---------------------------------------------------------------------------
-- Einen Verbandsbeitrag ablegen.
--
-- **Warum eine Funktion und kein `upsert` aus der Edge Function:** Der Feed
-- ist club-scoped, und `news_trainer_write` (`0043`) gibt jeder Trainer:in
-- Schreibrecht auf `news`. Ein Dienst, der mit `service_role` direkt in die
-- Tabelle schreibt, umginge die Policy zwar zu Recht – aber er schriebe auch
-- in Vereine, die die Verbandsnews gar nicht wollen. Diese Funktion prüft das
-- an der Verbindung, einmal, an der Stelle, an der es hingehört.
--
-- Dedupliziert wird über den Index `news_external_key (club_id, source,
-- external_id)` aus `0022`; `external_id` ist «<verband>:<beitragskennung>» –
-- dieselbe Form wie bei den Terminen (`0060`). Ein zweiter Abgleich
-- **aktualisiert** denselben Beitrag (BR-168 sinngemäss).
--
-- Was der Verein an einem Verbandsbeitrag ändert, überlebt den nächsten
-- Abgleich nicht – deshalb bietet die App ihn gar nicht erst zum Bearbeiten
-- an (BR-180 sinngemäss, wie bei den Website-Beiträgen).
-- ---------------------------------------------------------------------------
create or replace function public.upsert_federation_news(
  p_club_id      uuid,
  p_federation   text,
  p_external_id  text,
  p_title        text,
  p_body         text default null,
  p_body_html    text default null,
  p_image_url    text default null,
  p_author       text default null,
  p_external_url text default null,
  p_published_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- BR-260: Kein Beitrag ohne zugeschaltete Verbindung. Kein Fehler, sondern
  -- ein «nein» – der Lauf geht über alle Vereine und darf an einem, der die
  -- News nicht will, nicht abbrechen.
  if not exists (
    select 1 from federation_connections
     where club_id = p_club_id and federation = p_federation and news_enabled
  ) then
    return false;
  end if;

  insert into news (
    club_id, team_id, source, external_id, external_url,
    title, body, body_html, image_url, author, published_at, synced_at
  )
  values (
    p_club_id, null, 'federation', p_external_id, p_external_url,
    p_title, p_body, p_body_html, p_image_url, p_author,
    coalesce(p_published_at, now()), now()
  )
  on conflict (club_id, source, external_id) do update
     set title        = excluded.title,
         body         = excluded.body,
         body_html    = excluded.body_html,
         image_url    = excluded.image_url,
         author       = excluded.author,
         external_url = excluded.external_url,
         published_at = excluded.published_at,
         synced_at    = now();

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte (NFR-013).
--
-- Der Schalter gehört dem Vorstand, das Ablegen dem Dienst. Wäre
-- `upsert_federation_news()` für `authenticated` ausführbar, könnte jedes
-- angemeldete Konto Beiträge in den Feed eines Vereins schreiben, dem es
-- angehört – mit beliebigem Titel und unter der Herkunft «Verband».
-- ---------------------------------------------------------------------------
revoke execute on function public.set_federation_news(uuid, text, boolean) from public, anon;
grant  execute on function public.set_federation_news(uuid, text, boolean) to authenticated;

revoke execute on function public.federation_credentials(uuid)
  from public, anon, authenticated;
grant  execute on function public.federation_credentials(uuid) to service_role;

revoke execute on function public.upsert_federation_news(
    uuid, text, text, text, text, text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant  execute on function public.upsert_federation_news(
    uuid, text, text, text, text, text, text, text, text, timestamptz)
  to service_role;

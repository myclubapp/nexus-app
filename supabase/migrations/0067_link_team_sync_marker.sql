-- ============================================================================
-- 0067_link_team_sync_marker: «Letzter Abgleich» erst nach einem Abgleich (UC-039)
--
-- `link_team()` setzte `federation_synced_at` beim Verknüpfen auf `now()`.
-- Das Team-Blatt zeigte damit «Letzter Abgleich: eben» – obwohl noch kein
-- Spiel geholt war. Der Vorstand suchte die Spiele in der Agenda und fand
-- nichts, und das Blatt gab keinen Hinweis, warum.
--
-- Den Zeitpunkt setzt ab jetzt nur noch `report_team_sync()` – die Funktion,
-- die der Abgleich nach dem Lesen des Spielplans aufruft. Bis dahin steht im
-- Blatt «Noch kein Abgleich – die Spiele kommen mit dem nächsten Lauf»
-- (`teams.neverSynced`), und das ist dann auch wahr. Die App stösst den
-- Abgleich seit UC-039, Schritt 9, gleich nach dem Verknüpfen an; schlägt er
-- fehl, bleibt der Hinweis stehen, bis der nächtliche Lauf ihn einholt.
--
-- Rumpf sonst wortgleich zu `0060`.
-- ============================================================================
create or replace function public.link_team(
  p_team_id            uuid,
  p_federation         text,
  p_federation_team_id text,
  p_name               text,
  p_league             text default null,
  p_name_addition      text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team  teams;
  v_other teams;
begin
  select * into v_team from teams where id = p_team_id;
  if not found then
    raise exception 'Dieses Team gibt es nicht';
  end if;
  if not is_club_admin(v_team.club_id) then
    raise exception 'Nur der Vorstand verknüpft ein Team mit dem Verband';
  end if;
  if coalesce(trim(p_federation_team_id), '') = '' or coalesce(trim(p_name), '') = '' then
    raise exception 'Ohne Kennung und Namen des Verbands-Teams gibt es keine Verknüpfung';
  end if;

  if not exists (
    select 1 from federation_connections
     where club_id = v_team.club_id and federation = p_federation and status = 'active'
  ) then
    raise exception 'Ohne aktive Verbindung zu diesem Verband gibt es keine Verknüpfung';
  end if;

  select * into v_other from teams
   where club_id = v_team.club_id
     and federation = p_federation
     and federation_team_id = trim(p_federation_team_id)
     and id <> p_team_id;
  if found then
    raise exception 'Dieses Verbands-Team hängt schon an «%»', v_other.name;
  end if;

  perform set_config('myclub.team_link', 'on', true);
  update teams
     set federation           = p_federation,
         federation_team_id   = trim(p_federation_team_id),
         federation_name      = trim(p_name),
         league               = nullif(trim(coalesce(p_league, '')), ''),
         name_addition        = nullif(trim(coalesce(p_name_addition, '')), ''),
         -- Ein Abgleich hat noch nicht stattgefunden; `report_team_sync()`
         -- setzt den Zeitpunkt, sobald der Spielplan gelesen ist.
         federation_synced_at = null,
         federation_stale_at  = null
   where id = p_team_id;
  perform set_config('myclub.team_link', 'off', true);
end;
$$;

-- Rechte wie in 0060: `create or replace` behält sie, hier trotzdem sichtbar.
revoke execute on function public.link_team(uuid, text, text, text, text, text) from public, anon;
grant  execute on function public.link_team(uuid, text, text, text, text, text) to authenticated;

-- ============================================================================
-- 0060_federation_teams: Verbands-Team verknüpfen oder importieren (UC-039)
--
-- **BR-175: Eine Verknüpfung, ein Team.** Ein Verbands-Team hängt im Verein
-- an höchstens einem Team; das erzwingt ein Teilindex, nicht ein Knopf.
--
-- **BR-176: Der Verband pflegt den Grundnamen, der Verein den Zusatz.** Der
-- Grundname steht in `federation_name`, der Zusatz in `name_addition`, und
-- `name` – das, was überall angezeigt wird – entsteht aus beidem. So bleibt
-- jede Stelle der App, die `teams.name` liest, wie sie ist, und der Abgleich
-- überschreibt trotzdem nie den Zusatz.
--
-- **BR-177/178: Die Verknüpfung setzt nur eine Funktion.** Die Spalten des
-- Verbands sind für Clients gesperrt; wer sie ändert, geht über `link_team()`,
-- und die verlangt eine aktive Verbindung. Der Schlüssel bleibt im Tresor;
-- die Teamliste holt die Edge Function `sync-federation` (Betriebsart `teams`).
--
-- **BR-180: Importierte Termine gehören dem Verband, Ergänzungen dem Verein.**
-- `upsert_federation_game()` schreibt Titel, Zeit, Ort und Resultat – und
-- sonst nichts. Was der Verein am Termin ergänzt (Sinn, Regel, Kapazität),
-- bleibt bei jedem Lauf stehen.
--
-- **BR-181: Ein gelöster Verband löscht nichts.** Weder `unlink_team()` noch
-- `disconnect_federation()` entfernt einen Termin.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Die Verbandsangaben am Team.
-- ---------------------------------------------------------------------------
alter table teams add column if not exists federation text
  check (federation is null or federation in
         ('swissunihockey','swissvolley','swisshandball','swissturnverband'));
alter table teams add column if not exists federation_team_id text
  check (federation_team_id is null or length(trim(federation_team_id)) between 1 and 60);
-- Der Grundname, wie der Verband ihn führt (BR-176).
alter table teams add column if not exists federation_name text
  check (federation_name is null or length(trim(federation_name)) between 1 and 80);
-- Der Zusatz des Vereins – er überlebt jeden Abgleich (BR-176).
alter table teams add column if not exists name_addition text
  check (name_addition is null or length(trim(name_addition)) between 1 and 40);
alter table teams add column if not exists league text
  check (league is null or length(trim(league)) between 1 and 80);
alter table teams add column if not exists federation_synced_at timestamptz;
-- A6: Das Verbands-Team ist beim Abgleich nicht mehr aufgetaucht.
alter table teams add column if not exists federation_stale_at timestamptz;

-- Eine Verknüpfung ist ganz oder gar nicht: Verband, Kennung und Grundname
-- stehen gemeinsam oder fehlen gemeinsam.
alter table teams drop constraint if exists teams_federation_pair_check;
alter table teams add constraint teams_federation_pair_check
  check ((federation is null) = (federation_team_id is null)
     and (federation is null) = (federation_name is null));

-- BR-175: ein Verbands-Team, ein Team.
create unique index if not exists teams_federation_team_uidx
  on teams (club_id, federation, federation_team_id)
  where federation_team_id is not null;

-- ---------------------------------------------------------------------------
-- Was ein importierter Termin zusätzlich trägt.
--
-- `external_id` ist «<Verband>:<Spielkennung>»; über sie erkennt der nächste
-- Lauf sein eigenes Spiel wieder (BR-180). `result` ist der Text des
-- Verbands («3:4 n.V.»), nicht zwei Zahlen: Die App zeigt ihn, sie rechnet
-- nicht damit – Tabellen bleiben FR-128.
-- ---------------------------------------------------------------------------
alter table events add column if not exists external_id text
  check (external_id is null or length(external_id) between 3 and 80);
alter table events add column if not exists result text
  check (result is null or length(result) between 1 and 40);

create unique index if not exists events_external_uidx
  on events (club_id, external_id)
  where external_id is not null;

-- ---------------------------------------------------------------------------
-- Der Riegel und die Namensregel – ein Trigger, zwei Aufgaben.
--
-- 1. Die Verbandsspalten ändert kein Client direkt. `link_team()`,
--    `unlink_team()` und der Dienst setzen für die Dauer ihrer Transaktion
--    ein Kennzeichen; ohne dieses lehnt der Trigger die Änderung ab. Der
--    Dienst (`service_role`, Cron) hat kein `auth.uid()` und ist frei.
-- 2. BR-176: Bei einem verknüpften Team ist `name` die Verbindung aus
--    Grundname und Zusatz – immer, egal wer schreibt.
-- ---------------------------------------------------------------------------
create or replace function public.teams_federation_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_changed := new.federation_team_id is not null;
  else
    v_changed :=
         new.federation           is distinct from old.federation
      or new.federation_team_id   is distinct from old.federation_team_id
      or new.federation_name      is distinct from old.federation_name
      or new.league               is distinct from old.league
      or new.federation_synced_at is distinct from old.federation_synced_at
      or new.federation_stale_at  is distinct from old.federation_stale_at;
  end if;

  if v_changed
     and auth.uid() is not null
     and coalesce(current_setting('myclub.team_link', true), '') <> 'on' then
    raise exception 'Die Verknüpfung zum Verband wird über link_team() gesetzt';
  end if;

  if new.federation_team_id is not null then
    new.name := trim(new.federation_name || ' ' || coalesce(new.name_addition, ''));
  else
    -- Ohne Verknüpfung gibt es keinen Zusatz: Der Name gehört ganz dem Verein.
    new.name_addition := null;
  end if;

  return new;
end;
$$;

drop trigger if exists teams_federation_guard_trg on teams;
create trigger teams_federation_guard_trg
  before insert or update on teams
  for each row execute function public.teams_federation_guard();

-- ---------------------------------------------------------------------------
-- Schritte 5 bis 8: verknüpfen.
--
-- Die Verbindung muss **aktiv** sein (Vorbedingung, BR-177): Die Teamliste,
-- aus der die Kennung stammt, gibt es nur über den Schlüssel des Vereins, und
-- ein erfolgreicher Abruf setzt die Verbindung auf aktiv.
--
-- A3: Hängt das Verbands-Team schon an einem anderen Team, nennt die Meldung
-- dieses Team – der Vorstand weiss dann, wo er nachsehen muss.
-- ---------------------------------------------------------------------------
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
         federation_synced_at = now(),
         federation_stale_at  = null
   where id = p_team_id;
  perform set_config('myclub.team_link', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- A5: die Verknüpfung lösen.
--
-- Der zuletzt bekannte Name bleibt als Teamname stehen – er ist ja der, den
-- der Verein kennt. Termine bleiben (BR-181); sie werden nur nicht mehr
-- abgeglichen, weil `upsert_federation_game()` ohne Verknüpfung nichts tut.
-- ---------------------------------------------------------------------------
create or replace function public.unlink_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team teams;
begin
  select * into v_team from teams where id = p_team_id;
  if not found then
    raise exception 'Dieses Team gibt es nicht';
  end if;
  if not is_club_admin(v_team.club_id) then
    raise exception 'Nur der Vorstand löst eine Verknüpfung';
  end if;

  perform set_config('myclub.team_link', 'on', true);
  update teams
     set federation           = null,
         federation_team_id   = null,
         federation_name      = null,
         federation_synced_at = null,
         federation_stale_at  = null
   where id = p_team_id;
  perform set_config('myclub.team_link', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- A1: mehrere Teams auf einmal übernehmen – und der Weg aus «Team anlegen».
--
-- Ein Eintrag ohne `team_id` wird angelegt und verknüpft, einer mit `team_id`
-- nur verknüpft. Alles in einer Transaktion: Scheitert ein Eintrag (A3),
-- entsteht nichts – das ist die Failure Postcondition.
--
--   p_items: [{ "federation_team_id": "…", "name": "…", "league": "…",
--               "team_id": "<uuid>|null", "name_addition": "…|null" }]
-- ---------------------------------------------------------------------------
create or replace function public.import_federation_teams(
  p_club_id    uuid,
  p_federation text,
  p_items      jsonb
)
returns table (created int, linked int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item    jsonb;
  v_team_id uuid;
  v_created int := 0;
  v_linked  int := 0;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand übernimmt Teams aus dem Verband';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_team_id := nullif(v_item->>'team_id', '')::uuid;

    if v_team_id is null then
      insert into teams (club_id, name)
      values (p_club_id, left(trim(v_item->>'name'), 80))
      returning id into v_team_id;
      v_created := v_created + 1;
    else
      if not exists (select 1 from teams where id = v_team_id and club_id = p_club_id) then
        raise exception 'Dieses Team gehört nicht zu diesem Verein';
      end if;
      v_linked := v_linked + 1;
    end if;

    perform link_team(
      v_team_id, p_federation,
      v_item->>'federation_team_id', v_item->>'name',
      v_item->>'league', v_item->>'name_addition'
    );
  end loop;

  return query select v_created, v_linked;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schritt 9 und A6: was der Abgleich über ein Team erfährt.
--
-- Gefunden: Grundname und Liga werden nachgeführt (BR-176), der Zeitpunkt
-- gesetzt, ein etwaiger Vermerk «veraltet» gelöscht. Nicht gefunden: Das Team
-- bleibt samt Verknüpfung, bekommt den Vermerk – und der Vorstand erfährt es
-- **einmal**, nicht bei jedem Lauf.
-- ---------------------------------------------------------------------------
create or replace function public.report_team_sync(
  p_team_id uuid,
  p_found   boolean,
  p_name    text default null,
  p_league  text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team   teams;
  v_person record;
begin
  select * into v_team from teams where id = p_team_id for update;
  if not found or v_team.federation_team_id is null then
    return;
  end if;

  perform set_config('myclub.team_link', 'on', true);

  if p_found then
    update teams
       set federation_name      = coalesce(nullif(trim(coalesce(p_name, '')), ''), federation_name),
           league               = coalesce(nullif(trim(coalesce(p_league, '')), ''), league),
           federation_synced_at = now(),
           federation_stale_at  = null
     where id = p_team_id;
  elsif v_team.federation_stale_at is null then
    update teams set federation_stale_at = now() where id = p_team_id;

    for v_person in
      select m.user_id from club_members m
       where m.club_id = v_team.club_id
         and m.role in ('admin','superadmin')
         and m.status <> 'left'
         and m.user_id is not null
    loop
      perform notify(
        v_person.user_id, 'system',
        'Verbands-Team nicht mehr gefunden: ' || v_team.name,
        'Das Team bleibt, es kommen aber keine Spiele mehr. Verknüpfe es neu oder löse die Verknüpfung.',
        '/tabs/profile/teams', v_team.club_id
      );
    end loop;
  end if;

  perform set_config('myclub.team_link', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Schritt 9: ein Spiel als Termin – anlegen oder nachführen.
--
-- BR-180 in einer Zuweisungsliste: Titel, Zeit, Ort und Resultat kommen vom
-- Verband und werden überschrieben. Alles andere – Sinn, Regel, Kapazität,
-- Absage, Zu- und Absagen der Mitglieder – bleibt, weil es hier nicht steht.
--
-- A6, Schritt 2: Für ein veraltetes oder gelöstes Team entsteht nichts.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_federation_game(
  p_team_id     uuid,
  p_external_id text,
  p_title       text,
  p_starts_at   timestamptz,
  p_location    text default null,
  p_result      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team teams;
  v_id   uuid;
begin
  select * into v_team from teams where id = p_team_id;
  if not found or v_team.federation_team_id is null or v_team.federation_stale_at is not null then
    return null;
  end if;

  insert into events (club_id, team_id, type, title, starts_at, location, result, external_id)
  values (
    v_team.club_id, p_team_id, 'match',
    left(trim(p_title), 160), p_starts_at,
    nullif(left(trim(coalesce(p_location, '')), 200), ''),
    nullif(left(trim(coalesce(p_result, '')), 40), ''),
    p_external_id
  )
  on conflict (club_id, external_id) where external_id is not null
  do update set
    team_id   = excluded.team_id,
    title     = excluded.title,
    starts_at = excluded.starts_at,
    location  = excluded.location,
    result    = excluded.result
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte.
-- ---------------------------------------------------------------------------
revoke execute on function public.link_team(uuid, text, text, text, text, text) from public, anon;
grant  execute on function public.link_team(uuid, text, text, text, text, text) to authenticated;

revoke execute on function public.unlink_team(uuid) from public, anon;
grant  execute on function public.unlink_team(uuid) to authenticated;

revoke execute on function public.import_federation_teams(uuid, text, jsonb) from public, anon;
grant  execute on function public.import_federation_teams(uuid, text, jsonb) to authenticated;

-- Die Wege des Dienstes: Kein angemeldetes Konto führt einen Abgleich durch.
revoke execute on function public.report_team_sync(uuid, boolean, text, text)
  from public, anon, authenticated;
grant  execute on function public.report_team_sync(uuid, boolean, text, text) to service_role;

revoke execute on function public.upsert_federation_game(uuid, text, text, timestamptz, text, text)
  from public, anon, authenticated;
grant  execute on function public.upsert_federation_game(uuid, text, text, timestamptz, text, text)
  to service_role;

revoke execute on function public.teams_federation_guard() from public, anon, authenticated;

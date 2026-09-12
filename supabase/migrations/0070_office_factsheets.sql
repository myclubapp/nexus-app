-- ============================================================================
-- 0070_office_factsheets: Funktionärsamt mit Factsheet und Vakanz-Anzeige
-- (UC-041, FR-126, FR-127)
--
-- Die Ämter stehen seit 0049 als **Verteiler**: ein Titel, höchstens eine
-- Inhaber:in, «vakant» heisst «kein Inhaber». Ein Factsheet kennt mehr –
-- sechs Schiedsrichter:innen auf einem Amt, Inhaber:innen ohne Konto, «ad
-- interim», Aufwand, Punktwert, Pflichten, Ansprechperson und das PDF.
--
-- Vier Entscheide, die den Rest bestimmen:
--
--   BR-183  Vakant ist eine **Rechnung**: Sitze minus Inhaber:innen (ohne «ad
--           interim»). Sie steht einmal, in `office_open_seats()`. Die fünf
--           Stellen, die bisher `holder_member_id is null` lasen, rechnen ab
--           jetzt damit – sonst zeigte die Sitzungsagenda ein Amt als vakant,
--           das der Marktplatz als besetzt führt.
--   BR-184  Eine Inhaber:in braucht kein Konto: `display_name` genügt,
--           `member_id` kommt, wenn die Person beitritt. Sonst liesse sich ein
--           Verein, dessen Vorstand als Erster beitritt, gar nicht abbilden.
--   BR-185  Der Verteiler folgt der Besetzung: `holder_member_id` bleibt für
--           `holds_committee_role()`, `committee_members()` und
--           `ask_office_load()` bestehen, wird aber aus der Belegung
--           **gespiegelt** und ist von aussen nicht mehr schreibbar. Zwei
--           Wahrheiten über dieselbe Person gäbe es sonst nach dem ersten
--           direkten Update.
--   BR-186  Das Factsheet gehört dem Verein: Bucket `factsheets`, Pfad
--           `<club_id>/…`; lesen Mitglieder, schreiben Vorstand.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Das Factsheet am Amt.
-- ---------------------------------------------------------------------------
alter table functionary_roles
  add column if not exists duties            jsonb not null default '[]'::jsonb,
  add column if not exists hours_per_season  text,
  add column if not exists points_label      text,
  add column if not exists why               text,
  add column if not exists max_holders       int  not null default 1,
  add column if not exists contact_member_id uuid references club_members(id) on delete set null,
  add column if not exists contact_name      text,
  add column if not exists factsheet_path    text,
  add column if not exists updated_at        timestamptz not null default now();

-- Die Pflichten sind eine Liste von {title, detail} – `announce_event` hat
-- gezeigt, was ein jsonb ohne Formprüfung anrichtet (0049).
alter table functionary_roles drop constraint if exists functionary_roles_duties_check;
alter table functionary_roles add constraint functionary_roles_duties_check
  check (jsonb_typeof(duties) = 'array');

alter table functionary_roles drop constraint if exists functionary_roles_max_holders_check;
alter table functionary_roles add constraint functionary_roles_max_holders_check
  check (max_holders between 1 and 50);

alter table functionary_roles drop constraint if exists functionary_roles_text_check;
alter table functionary_roles add constraint functionary_roles_text_check
  check (
    coalesce(length(hours_per_season), 0) <= 80
    and coalesce(length(points_label), 0) <= 80
    and coalesce(length(contact_name), 0) <= 120
    and coalesce(length(why), 0) <= 1000
    and coalesce(length(factsheet_path), 0) <= 300
  );

create or replace function public.touch_functionary_updated()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists functionary_roles_updated on functionary_roles;
create trigger functionary_roles_updated
  before update on functionary_roles
  for each row execute function touch_functionary_updated();

-- ---------------------------------------------------------------------------
-- 2. Die Belegung: wer einen Sitz hält.
--
-- `on delete set null` am Mitglied: Tritt die Person aus dem Verein aus,
-- bleibt ihr Name am Amt stehen, bis der Vorstand die Nachfolge einträgt –
-- ein Amt, das über Nacht still leer wird, wäre die schlechtere Nachricht.
-- ---------------------------------------------------------------------------
create table if not exists functionary_holders (
  id           uuid primary key default gen_random_uuid(),
  role_id      uuid not null references functionary_roles(id) on delete cascade,
  member_id    uuid references club_members(id) on delete set null,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  interim      boolean not null default false,
  since        date,
  created_at   timestamptz not null default now()
);

create index if not exists functionary_holders_role_idx on functionary_holders(role_id);

-- Eine Person hält einen Sitz eines Amtes höchstens einmal.
create unique index if not exists functionary_holders_member_idx
  on functionary_holders(role_id, member_id) where member_id is not null;

alter table functionary_holders enable row level security;

-- Dieselbe Reichweite wie das Amt selbst: Wer im Verein ist, sieht das
-- Organigramm. Schreiben tut der Vorstand – normalerweise über
-- `save_office()`, die Policy deckt den Rest (Auflösen, Nachpflege).
drop policy if exists functionary_holders_read on functionary_holders;
create policy functionary_holders_read on functionary_holders
  for select using (
    exists (select 1 from functionary_roles r
             where r.id = role_id and is_club_member(r.club_id))
  );

drop policy if exists functionary_holders_write on functionary_holders;
create policy functionary_holders_write on functionary_holders
  for all using (
    exists (select 1 from functionary_roles r
             where r.id = role_id and is_club_admin(r.club_id))
  ) with check (
    exists (select 1 from functionary_roles r
             where r.id = role_id and is_club_admin(r.club_id))
  );

-- Backfill: Wer heute ein Amt hält, hält ab jetzt dessen ersten Sitz.
insert into functionary_holders (role_id, member_id, display_name, since)
select r.id, r.holder_member_id, m.display_name, r.held_since
  from functionary_roles r
  join club_members m on m.id = r.holder_member_id
 where not exists (select 1 from functionary_holders h
                    where h.role_id = r.id and h.member_id = r.holder_member_id);

-- ---------------------------------------------------------------------------
-- 3. BR-185: der Spiegel.
--
-- `holder_member_id` ist die **erste verknüpfte** Inhaber:in – ordentlich vor
-- «ad interim», die dienstälteste zuerst. `held_since` ist ihr `since`; fehlt
-- es, das Datum der Eintragung. Der Trigger läuft als `security definer`,
-- weil die beiden Spalten unten für `authenticated` gesperrt werden.
-- ---------------------------------------------------------------------------
create or replace function public.sync_office_holder(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_holder functionary_holders;
begin
  select h.* into v_holder
    from functionary_holders h
    join club_members m on m.id = h.member_id
   where h.role_id = p_role_id
     and h.member_id is not null
     and m.status <> 'left'
   order by h.interim, h.since nulls last, h.created_at
   limit 1;

  update functionary_roles
     set holder_member_id = v_holder.member_id,
         held_since       = case when v_holder.member_id is null then null
                                 else coalesce(v_holder.since, current_date) end
   where id = p_role_id
     and (holder_member_id is distinct from v_holder.member_id
          or held_since is distinct from
             case when v_holder.member_id is null then null
                  else coalesce(v_holder.since, current_date) end);
end;
$$;

revoke execute on function public.sync_office_holder(uuid) from public, anon, authenticated;

create or replace function public.functionary_holders_changed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform sync_office_holder(old.role_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.role_id is distinct from old.role_id) then
    perform sync_office_holder(new.role_id);
  end if;
  return null;
end;
$$;

revoke execute on function public.functionary_holders_changed() from public, anon, authenticated;

drop trigger if exists functionary_holders_sync on functionary_holders;
create trigger functionary_holders_sync
  after insert or update or delete on functionary_holders
  for each row execute function functionary_holders_changed();

-- Der Trigger aus 0049 setzte bei jedem Inhaberwechsel `held_since` auf heute
-- – auch wenn der Aufrufer ein Datum mitgab. Der Spiegel gibt eines mit.
create or replace function public.touch_functionary_since()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.holder_member_id is null then
    new.held_since := null;
  elsif new.held_since is null then
    new.held_since := current_date;
  elsif tg_op = 'UPDATE'
        and new.holder_member_id is distinct from old.holder_member_id
        and new.held_since is not distinct from old.held_since then
    -- Wechsel ohne neues Datum: dann ist es heute.
    new.held_since := current_date;
  end if;
  return new;
end;
$$;

-- Der Spiegel ist von aussen nicht schreibbar: Tabellenweit entzogen, spaltenweise
-- zurückgegeben. Ein Spaltenrecht lässt sich nicht von einem Tabellenrecht
-- abziehen – nur so herum.
revoke insert, update on functionary_roles from anon, authenticated;
grant update (title, why, duties, hours_per_season, points_label, max_holders,
              contact_member_id, contact_name, factsheet_path, updated_at)
  on functionary_roles to authenticated;

-- Tritt jemand aus, verliert das Amt seine Verknüpfung – der Name bleibt.
create or replace function public.functionary_member_left()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role uuid;
begin
  if new.status = 'left' and old.status is distinct from 'left' then
    for v_role in select h.role_id from functionary_holders h where h.member_id = new.id loop
      perform sync_office_holder(v_role);
    end loop;
  end if;
  return null;
end;
$$;

revoke execute on function public.functionary_member_left() from public, anon, authenticated;

drop trigger if exists club_members_office_sync on club_members;
create trigger club_members_office_sync
  after update of status on club_members
  for each row execute function functionary_member_left();

-- ---------------------------------------------------------------------------
-- 4. BR-183: die Rechnung.
-- ---------------------------------------------------------------------------
create or replace function public.office_open_seats(p_role_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select greatest(
           r.max_holders
           - (select count(*) from functionary_holders h
               where h.role_id = r.id and not h.interim),
           0)::int
    from functionary_roles r
   where r.id = p_role_id;
$$;

revoke execute on function public.office_open_seats(uuid) from public, anon;
grant  execute on function public.office_open_seats(uuid) to authenticated;

-- 4a. Sitzungsagenda (0049) – Rumpf wortgleich, nur die Vakanz rechnet neu.
create or replace function public.meeting_agenda(p_event_id uuid)
returns table (
  kind   text,
  ref_id uuid,
  title  text,
  detail text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_club uuid;
begin
  select e.club_id into v_club from events e where e.id = p_event_id;
  if v_club is null then
    raise exception 'Sitzung nicht gefunden';
  end if;

  if not can_see_agenda(p_event_id) then
    raise exception 'Diese Sitzung ist nicht deine';
  end if;

  return query
    select 'input'::text, i.id, left(i.body, 160), i.status
      from meeting_inputs i
     where i.meeting_event_id = p_event_id
       and i.status not in ('answered','declined')
     order by i.created_at;

  return query
    -- 2. Dauerthema: vakante Ämter – BR-183, dieselbe Rechnung wie im
    --    Marktplatz. Das Detail nennt die offenen Sitze.
    select 'vacancy'::text, r.id, r.title, office_open_seats(r.id)::text
      from functionary_roles r
     where r.club_id = v_club
       and office_open_seats(r.id) > 0
     order by r.title;

  return query
    select 'shift'::text, s.id, s.title, e.title
      from event_shifts s
      join events e on e.id = s.event_id
     where e.club_id = v_club
       and e.cancelled_at is null
       and not e.is_sample
       and s.starts_at > now()
       and s.needed > (select count(*) from attendance a
                        where a.shift_id = s.id
                          and a.status in ('registered','present'))
     order by s.starts_at;
end;
$$;

-- 4b. Beitrags-Matching (0051) – wortgleich bis auf die Vakanz.
create or replace function public.matching_vacancies(p_club_id uuid)
returns table (role_id uuid, title text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_member uuid;
  v_profile member_contribution_profiles;
begin
  v_member := current_member_id(p_club_id);
  if v_member is null then
    return;
  end if;

  select * into v_profile from member_contribution_profiles
   where member_id = v_member;
  if not found or jsonb_array_length(v_profile.interests) = 0 then
    return;
  end if;

  if not (v_profile.interests @> '["organisation"]'::jsonb
          or v_profile.interests @> '["finance"]'::jsonb) then
    return;
  end if;

  return query
    select r.id, r.title
      from functionary_roles r
     where r.club_id = p_club_id
       and office_open_seats(r.id) > 0
     order by r.title;
end;
$$;

-- 4c. Nachfolge-Vorlauf (0056) – wortgleich bis auf die Vakanz.
create or replace function public.succession_lead(p_club_id uuid)
returns table (
  role_id    uuid,
  title      text,
  is_vacant  boolean,
  years      numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_years numeric;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand sieht den Nachfolge-Vorlauf';
  end if;

  v_years := health_threshold(p_club_id, 'longTenureYears', 3);

  return query
  select r.id, r.title,
         office_open_seats(r.id) > 0,
         case when r.held_since is null then null
              else round(extract(epoch from age(current_date, r.held_since))
                         / (365.25 * 86400), 1) end
    from functionary_roles r
   where r.club_id = p_club_id
     and (office_open_seats(r.id) > 0
          or (r.held_since is not null
              and r.held_since <= current_date - (v_years * 365.25)::int))
   order by office_open_seats(r.id) > 0 desc, r.held_since nulls last;
end;
$$;

create or replace function public.detect_succession_gaps(p_club_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club  record;
  v_years numeric;
  v_open  int;
  v_count int := 0;
begin
  for v_club in
    select c.id from clubs c where p_club_id is null or c.id = p_club_id
  loop
    if not module_enabled(v_club.id, 'meeting') then
      continue;
    end if;

    v_years := health_threshold(v_club.id, 'longTenureYears', 3);

    select count(*) into v_open
      from functionary_roles r
     where r.club_id = v_club.id
       and (office_open_seats(r.id) > 0
            or (r.held_since is not null
                and r.held_since <= current_date - (v_years * 365.25)::int));

    if v_open = 0 then
      continue;
    end if;

    insert into health_signals
      (club_id, member_id, team_id, signal_type, severity, detail)
    values
      (v_club.id, null, null, 'succession_gap', 'info', v_open::text)
    on conflict do nothing;

    if found then
      v_count := v_count + 1;
      perform notify_signal_owners(
        (select id from health_signals
          where club_id = v_club.id and signal_type = 'succession_gap'));
    end if;
  end loop;

  return v_count;
end;
$$;

-- 4d. Reaktionszeiten des Vorstands (0066) – wortgleich bis auf die Vakanz.
-- `vacancy_avg_days` rechnet weiter ab `created_at`: Eine Vakanz-Historie
-- («seit wann unbesetzt») gibt es noch nicht.
create or replace function public.board_response_metrics(p_club_id uuid)
returns table (
  inputs_answered   int,
  inputs_avg_hours  numeric,
  inputs_open       int,
  inputs_overdue    int,
  signals_open      int,
  signals_oldest_days int,
  vacancies         int,
  vacancy_avg_days  numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand sieht seine Reaktionszeiten';
  end if;

  return query
  select
    (select count(*)::int from meeting_inputs i
      where i.club_id = p_club_id
        and i.responded_at is not null
        and i.created_at >= now() - interval '180 days'),
    (select round(avg(extract(epoch from (i.responded_at - i.created_at)) / 3600)::numeric, 1)
       from meeting_inputs i
      where i.club_id = p_club_id
        and i.responded_at is not null
        and i.created_at >= now() - interval '180 days'),
    (select count(*)::int from meeting_inputs i
      where i.club_id = p_club_id
        and i.status in ('open', 'scheduled', 'in_progress')),
    (select count(*)::int from meeting_inputs i
      where i.club_id = p_club_id
        and i.status in ('open', 'scheduled', 'in_progress')
        and i.created_at < now() - interval '14 days'),
    (select count(*)::int from health_signals s
      where s.club_id = p_club_id and s.status = 'open'),
    (select coalesce(max(extract(day from now() - s.detected_at))::int, 0)
       from health_signals s
      where s.club_id = p_club_id and s.status = 'open'),
    (select count(*)::int from functionary_roles r
      where r.club_id = p_club_id and office_open_seats(r.id) > 0),
    (select round(avg(extract(epoch from (now() - r.created_at)) / 86400)::numeric, 0)
       from functionary_roles r
      where r.club_id = p_club_id and office_open_seats(r.id) > 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Ein Amt samt Belegung sichern – ein Schritt, eine Transaktion.
--
-- `p_holders` ist eine Liste `{id?, member_id?, display_name, interim,
-- since?}`. Was nicht mehr in der Liste steht, ist nicht mehr Inhaber:in. Die
-- Kennung `id` hält das `since` eines bestehenden Sitzes fest; ohne sie wäre
-- jedes Speichern ein Neuantritt.
-- ---------------------------------------------------------------------------
create or replace function public.save_office(
  p_club_id           uuid,
  p_title             text,
  p_id                uuid    default null,
  p_why               text    default null,
  p_duties            jsonb   default '[]'::jsonb,
  p_hours_per_season  text    default null,
  p_points_label      text    default null,
  p_max_holders       int     default 1,
  p_contact_member_id uuid    default null,
  p_contact_name      text    default null,
  p_holders           jsonb   default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id     uuid;
  v_holder jsonb;
  v_keep   uuid[] := '{}';
  v_hid    uuid;
  v_member uuid;
  v_name   text;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand pflegt die Ämter';
  end if;

  if length(trim(coalesce(p_title, ''))) not between 2 and 80 then
    raise exception 'Ein Amt braucht seine Bezeichnung';
  end if;
  if jsonb_typeof(coalesce(p_duties, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_holders, '[]'::jsonb)) <> 'array' then
    raise exception 'Pflichten und Belegung sind Listen';
  end if;
  if coalesce(p_max_holders, 1) not between 1 and 50 then
    raise exception 'Ein Amt hat zwischen 1 und 50 Sitzen';
  end if;
  if p_contact_member_id is not null and not exists (
       select 1 from club_members m
        where m.id = p_contact_member_id and m.club_id = p_club_id) then
    raise exception 'Die Ansprechperson ist nicht Mitglied dieses Vereins';
  end if;

  if p_id is null then
    insert into functionary_roles (
      club_id, title, why, duties, hours_per_season, points_label,
      max_holders, contact_member_id, contact_name
    )
    values (
      p_club_id, trim(p_title), nullif(trim(p_why), ''), coalesce(p_duties, '[]'::jsonb),
      nullif(trim(p_hours_per_season), ''), nullif(trim(p_points_label), ''),
      coalesce(p_max_holders, 1), p_contact_member_id, nullif(trim(p_contact_name), '')
    )
    returning id into v_id;
  else
    update functionary_roles
       set title             = trim(p_title),
           why               = nullif(trim(p_why), ''),
           duties            = coalesce(p_duties, '[]'::jsonb),
           hours_per_season  = nullif(trim(p_hours_per_season), ''),
           points_label      = nullif(trim(p_points_label), ''),
           max_holders       = coalesce(p_max_holders, 1),
           contact_member_id = p_contact_member_id,
           contact_name      = nullif(trim(p_contact_name), '')
     where id = p_id and club_id = p_club_id
     returning id into v_id;
    if v_id is null then
      raise exception 'Dieses Amt gibt es nicht';
    end if;
  end if;

  for v_holder in select * from jsonb_array_elements(coalesce(p_holders, '[]'::jsonb)) loop
    v_name   := trim(coalesce(v_holder->>'display_name', ''));
    v_member := nullif(v_holder->>'member_id', '')::uuid;
    if v_member is not null then
      if not exists (select 1 from club_members m
                      where m.id = v_member and m.club_id = p_club_id) then
        raise exception 'Diese Person ist nicht Mitglied dieses Vereins';
      end if;
      -- Ein verknüpfter Sitz trägt den Namen des Mitglieds.
      select m.display_name into v_name from club_members m where m.id = v_member;
    end if;
    if length(v_name) = 0 then
      raise exception 'Eine Inhaber:in braucht einen Namen';
    end if;

    v_hid := nullif(v_holder->>'id', '')::uuid;
    if v_hid is not null and exists (
         select 1 from functionary_holders h where h.id = v_hid and h.role_id = v_id) then
      update functionary_holders
         set member_id    = v_member,
             display_name = v_name,
             interim      = coalesce((v_holder->>'interim')::boolean, false),
             since        = coalesce((v_holder->>'since')::date, since)
       where id = v_hid;
    else
      insert into functionary_holders (role_id, member_id, display_name, interim, since)
      values (v_id, v_member, v_name,
              coalesce((v_holder->>'interim')::boolean, false),
              (v_holder->>'since')::date)
      returning id into v_hid;
    end if;
    v_keep := v_keep || v_hid;
  end loop;

  delete from functionary_holders h
   where h.role_id = v_id and not (h.id = any (v_keep));

  return v_id;
end;
$$;

revoke execute on function public.save_office(
  uuid, text, uuid, text, jsonb, text, text, int, uuid, text, jsonb
) from public, anon;
grant execute on function public.save_office(
  uuid, text, uuid, text, jsonb, text, text, int, uuid, text, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. BR-186: das Factsheet im Vereinsspeicher.
--
-- Der erste Bucket des Projekts. Privat: Jeder Zugriff geht über eine
-- signierte URL, und die Policy prüft den Vereinsordner im Pfad – derselbe
-- Schnitt wie in jeder Tabelle mit `club_id` (NFR-011).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('factsheets', 'factsheets', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Der Vereinsordner ist das erste Segment des Pfads. Kein Cast, der auf einem
-- fremden Pfad mit einem Fehler statt mit «nein» antwortet.
create or replace function public.path_club_id(p_name text)
returns uuid
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when split_part(p_name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
           then split_part(p_name, '/', 1)::uuid
         end;
$$;

drop policy if exists factsheets_read on storage.objects;
create policy factsheets_read on storage.objects
  for select to authenticated
  using (bucket_id = 'factsheets' and is_club_member(path_club_id(name)));

drop policy if exists factsheets_insert on storage.objects;
create policy factsheets_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'factsheets' and is_club_admin(path_club_id(name)));

drop policy if exists factsheets_update on storage.objects;
create policy factsheets_update on storage.objects
  for update to authenticated
  using (bucket_id = 'factsheets' and is_club_admin(path_club_id(name)))
  with check (bucket_id = 'factsheets' and is_club_admin(path_club_id(name)));

drop policy if exists factsheets_delete on storage.objects;
create policy factsheets_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'factsheets' and is_club_admin(path_club_id(name)));

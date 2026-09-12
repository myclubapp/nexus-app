-- ============================================================================
-- 0071_legacy_people: Mitglieder, Teams, Trainings und Zusagen aus der
-- bisherigen myclub-App übernehmen (UC-040, zweiter Schritt)
--
-- `0069` brachte Anlässe und Helfer-Events. Was fehlte, war alles, woran eine
-- **Person** hängt: wer sich für eine Schicht eingetragen hat, wer einem
-- Spiel oder Training zu- oder abgesagt hat. Dafür braucht es die Personen
-- selbst – und die haben hier noch kein Konto.
--
-- **BR-192: Ein Mitglied der bisherigen App wird hier ein Mitglied ohne
-- Konto.** `club_members.user_id` bleibt leer, `legacy_user_id` trägt die
-- Firebase-Kennung, `member_contacts.email` die Adresse. Tritt die Person
-- später mit derselben Adresse bei, übernimmt sie diese Zeile samt Zusagen
-- (`redeem_invite`), statt ein zweites Mitglied zu werden.
--
-- **BR-193: Antworten der Quelle überschreiben nur Antworten.** Eine Zusage
-- oder Absage aus der alten App setzt `registered` oder `excused`. Was hier
-- entstand – `present`, `absent`, `substitute`, ein Check-in – bleibt.
--
-- **BR-194: Spiele kommen vom Verband, ihre Antworten aus der alten App.**
-- Ein Team der alten App mit Verbandskennung wird hier ein verknüpftes Team
-- (UC-039); der Verbandsabgleich holt seine Spiele, dieser Lauf hängt die
-- Zusagen daran (`swissunihockey:<Spiel>`).
-- ============================================================================

alter table club_members add column if not exists legacy_user_id text
  check (legacy_user_id is null or length(legacy_user_id) between 1 and 80);
create unique index if not exists club_members_legacy_uidx
  on club_members (club_id, legacy_user_id) where legacy_user_id is not null;

alter table teams add column if not exists legacy_team_id text
  check (legacy_team_id is null or length(legacy_team_id) between 1 and 80);
create unique index if not exists teams_legacy_uidx
  on teams (club_id, legacy_team_id) where legacy_team_id is not null;

alter table legacy_sources add column if not exists imported_members   int not null default 0;
alter table legacy_sources add column if not exists imported_responses int not null default 0;

-- ---------------------------------------------------------------------------
-- Mitglieder (BR-192). Eine Liste je Lauf, nicht ein Aufruf je Person:
-- 177 Aufrufe über PostgREST wären ein Lauf von Minuten.
--
-- Zeilen: { legacy_user_id, first_name, last_name, email, roles: [text] }.
--
-- Zuordnung in dieser Reihenfolge: (1) die Firebase-Kennung, (2) ein Konto
-- mit derselben Adresse, (3) ein Mitglied ohne Konto mit derselben
-- Kontaktadresse, (4) neu. Name und Rolle setzt die Quelle nur bei Mitgliedern
-- ohne Konto – wer hier ein Konto hat, pflegt sein Profil hier (BR-183 gilt
-- für Termine, nicht für Personen). Die Rolle beim Anlegen: «Vorstand» wird
-- admin, «Trainer/in» trainer, alles andere member.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_legacy_members(p_club_id uuid, p_rows jsonb)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row    jsonb;
  v_legacy text;
  v_email  text;
  v_name   text;
  v_role   text;
  v_roles  text[];
  v_id     uuid;
  v_count  int := 0;
begin
  if not exists (select 1 from legacy_sources where club_id = p_club_id) then
    return 0;
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_legacy := nullif(trim(coalesce(v_row->>'legacy_user_id', '')), '');
    if v_legacy is null then continue; end if;

    v_email := nullif(lower(trim(coalesce(v_row->>'email', ''))), '');
    v_name  := nullif(trim(concat_ws(' ',
                 nullif(trim(coalesce(v_row->>'first_name', '')), ''),
                 nullif(trim(coalesce(v_row->>'last_name', '')), ''))), '');
    v_name  := coalesce(v_name, split_part(coalesce(v_email, 'Mitglied'), '@', 1));
    v_roles := coalesce(array(select jsonb_array_elements_text(
                 case when jsonb_typeof(v_row->'roles') = 'array' then v_row->'roles' else '[]'::jsonb end)),
                 '{}');
    v_role  := case
                 when 'Vorstand' = any (v_roles) then 'admin'
                 when 'Trainer/in' = any (v_roles) or 'Trainer' = any (v_roles) then 'trainer'
                 else 'member'
               end;

    select id into v_id from club_members
     where club_id = p_club_id and legacy_user_id = v_legacy;

    if v_id is null and v_email is not null then
      select m.id into v_id
        from club_members m join auth.users u on u.id = m.user_id
       where m.club_id = p_club_id and m.legacy_user_id is null
         and lower(u.email) = v_email
       limit 1;
    end if;

    if v_id is null and v_email is not null then
      select m.id into v_id
        from club_members m join member_contacts c on c.member_id = m.id
       where m.club_id = p_club_id and m.legacy_user_id is null
         and lower(c.email) = v_email
       limit 1;
    end if;

    if v_id is null then
      insert into club_members (club_id, user_id, role, display_name, legacy_user_id)
      values (p_club_id, null, v_role, left(v_name, 120), v_legacy)
      returning id into v_id;
    else
      update club_members
         set legacy_user_id = v_legacy,
             display_name = case when user_id is null then left(v_name, 120) else display_name end
       where id = v_id;
    end if;

    if v_email is not null then
      insert into member_contacts (member_id, email) values (v_id, v_email)
      on conflict (member_id) do update
        set email = coalesce(member_contacts.email, excluded.email);
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Teams (BR-194). Zuordnung: (1) Kennung der alten App, (2) dieselbe
-- Verbandskennung, (3) derselbe Name; sonst neu – mit Verbandskennung als
-- verknüpftes Team, wenn der Verein den Verband verbunden hat (UC-039), sonst
-- als gewöhnliches Team. Der Trigger `teams_federation_guard` lässt den Dienst
-- durch: Er hat kein `auth.uid()`.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_legacy_team(
  p_club_id            uuid,
  p_legacy_team_id     text,
  p_name               text,
  p_federation_team_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id   uuid;
  v_fed  text := nullif(trim(coalesce(p_federation_team_id, '')), '');
  v_name text := left(trim(coalesce(p_name, '')), 120);
begin
  if not exists (select 1 from legacy_sources where club_id = p_club_id) then
    return null;
  end if;
  if coalesce(trim(p_legacy_team_id), '') = '' or v_name = '' then
    return null;
  end if;

  select id into v_id from teams
   where club_id = p_club_id and legacy_team_id = p_legacy_team_id;

  if v_id is null and v_fed is not null then
    select id into v_id from teams
     where club_id = p_club_id and federation = 'swissunihockey' and federation_team_id = v_fed;
  end if;

  if v_id is null then
    select id into v_id from teams
     where club_id = p_club_id
       and (lower(name) = lower(v_name) or lower(coalesce(federation_name, '')) = lower(v_name))
     limit 1;
  end if;

  if v_id is null then
    if v_fed is not null and exists (
         select 1 from federation_connections
          where club_id = p_club_id and federation = 'swissunihockey' and status = 'active') then
      insert into teams (club_id, name, federation, federation_team_id, federation_name)
      values (p_club_id, v_name, 'swissunihockey', v_fed, v_name)
      returning id into v_id;
    else
      insert into teams (club_id, name) values (p_club_id, v_name)
      returning id into v_id;
    end if;
  end if;

  update teams set legacy_team_id = p_legacy_team_id where id = v_id;
  return v_id;
end;
$$;

-- Team-Zugehörigkeit: ergänzen, nie entfernen (BR-184).
create or replace function public.add_legacy_team_members(p_team_id uuid, p_legacy_user_ids text[])
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team  teams;
  v_count int;
begin
  select * into v_team from teams where id = p_team_id;
  if not found or v_team.legacy_team_id is null then
    return 0;
  end if;

  insert into team_members (team_id, member_id, role)
  select p_team_id, m.id, 'player'
    from club_members m
   where m.club_id = v_team.club_id
     and m.legacy_user_id = any (coalesce(p_legacy_user_ids, '{}'))
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Termine: neu mit Team und dem Typ `training`. Rumpf sonst wie `0069`.
-- ---------------------------------------------------------------------------
drop function if exists public.upsert_legacy_event(
  uuid, text, text, text, text, timestamptz, timestamptz, text, int, boolean, text, jsonb);

create or replace function public.upsert_legacy_event(
  p_club_id          uuid,
  p_external_id      text,
  p_type             text,
  p_title            text,
  p_why              text,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz default null,
  p_location         text default null,
  p_capacity_needed  int default null,
  p_cancelled        boolean default false,
  p_cancelled_reason text default null,
  p_shifts           jsonb default '[]'::jsonb,
  p_team_id          uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_shift jsonb;
  v_keep  text[] := '{}';
  v_why   text;
begin
  if not exists (select 1 from legacy_sources where club_id = p_club_id) then
    return null;
  end if;
  if p_type not in ('social','helper','training') then
    raise exception 'Die bisherige App liefert Anlässe, Helfer-Events und Trainings, nicht «%»', p_type;
  end if;
  if coalesce(trim(p_title), '') = '' or p_starts_at is null then
    return null;
  end if;
  if p_team_id is not null and not exists (
       select 1 from teams where id = p_team_id and club_id = p_club_id) then
    return null;
  end if;

  v_why := coalesce(nullif(left(trim(coalesce(p_why, '')), 500), ''),
                    'Aus der bisherigen myclub-App übernommen');

  insert into events (
    club_id, team_id, type, title, why, starts_at, ends_at, location,
    capacity_needed, cancelled_at, cancelled_reason, external_id,
    published_at, is_sample
  )
  values (
    p_club_id, p_team_id, p_type,
    left(trim(p_title), 160), v_why, p_starts_at,
    case when p_ends_at > p_starts_at then p_ends_at else null end,
    nullif(left(trim(coalesce(p_location, '')), 200), ''),
    case when coalesce(p_capacity_needed, 0) >= 1 then p_capacity_needed else null end,
    case when p_cancelled then now() else null end,
    case when p_cancelled
         then coalesce(nullif(left(trim(coalesce(p_cancelled_reason, '')), 500), ''),
                       'In der bisherigen App abgesagt')
         else null end,
    p_external_id, now(), false
  )
  on conflict (club_id, external_id) where external_id is not null
  do update set
    team_id          = excluded.team_id,
    type             = excluded.type,
    title            = excluded.title,
    why              = excluded.why,
    starts_at        = excluded.starts_at,
    ends_at          = excluded.ends_at,
    location         = excluded.location,
    capacity_needed  = excluded.capacity_needed,
    cancelled_at     = case when excluded.cancelled_at is null then null
                            else coalesce(events.cancelled_at, excluded.cancelled_at) end,
    cancelled_reason = excluded.cancelled_reason
  returning id into v_id;

  for v_shift in select * from jsonb_array_elements(coalesce(p_shifts, '[]'::jsonb))
  loop
    if coalesce(v_shift->>'external_id', '') = '' then continue; end if;
    v_keep := v_keep || (v_shift->>'external_id');

    insert into event_shifts (event_id, external_id, title, starts_at, ends_at,
                              needed, points, point_rule_code)
    values (
      v_id,
      v_shift->>'external_id',
      left(coalesce(nullif(trim(v_shift->>'title'), ''), 'Schicht'), 160),
      (v_shift->>'starts_at')::timestamptz,
      (v_shift->>'ends_at')::timestamptz,
      greatest(coalesce((v_shift->>'needed')::int, 1), 1),
      greatest(coalesce((v_shift->>'points')::int, 0), 0),
      'shift_done'
    )
    on conflict (event_id, external_id) where external_id is not null
    do update set
      title     = excluded.title,
      starts_at = excluded.starts_at,
      ends_at   = excluded.ends_at,
      needed    = excluded.needed,
      points    = excluded.points;
  end loop;

  delete from event_shifts s
   where s.event_id = v_id
     and s.external_id is not null
     and not (s.external_id = any (v_keep))
     and not exists (select 1 from attendance a where a.shift_id = s.id);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Zusagen (BR-193). Eine Liste je Lauf.
--
-- Zeilen: { event_external_id, shift_external_id?, legacy_user_id,
--           status: boolean, changed_at? }.
-- `status` ist die Antwort der alten App: wahr = Zusage, falsch = Absage.
-- Fehlt Termin, Schicht oder Person, zählt die Zeile als nicht zuordenbar –
-- ein Spiel etwa, das der Verbandsabgleich noch nicht gebracht hat.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_legacy_attendance(p_club_id uuid, p_rows jsonb)
returns table (matched int, unmatched int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row     jsonb;
  v_event   uuid;
  v_shift   uuid;
  v_member  uuid;
  v_status  text;
  v_at      timestamptz;
begin
  matched := 0;
  unmatched := 0;
  if not exists (select 1 from legacy_sources where club_id = p_club_id) then
    return next;
    return;
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    select e.id into v_event from events e
     where e.club_id = p_club_id and e.external_id = v_row->>'event_external_id';
    select m.id into v_member from club_members m
     where m.club_id = p_club_id and m.legacy_user_id = v_row->>'legacy_user_id';

    v_shift := null;
    if coalesce(v_row->>'shift_external_id', '') <> '' and v_event is not null then
      select s.id into v_shift from event_shifts s
       where s.event_id = v_event and s.external_id = v_row->>'shift_external_id';
      if v_shift is null then v_event := null; end if;
    end if;

    if v_event is null or v_member is null then
      unmatched := unmatched + 1;
      continue;
    end if;

    v_status := case when (v_row->>'status')::boolean then 'registered' else 'excused' end;
    v_at := coalesce(nullif(v_row->>'changed_at', '')::timestamptz, now());

    insert into attendance (event_id, shift_id, member_id, status, responded_at)
    values (v_event, v_shift, v_member, v_status, v_at)
    on conflict (event_id, member_id, shift_id) do update
       set status = excluded.status,
           responded_at = excluded.responded_at
     where attendance.status in ('registered','excused');

    matched := matched + 1;
  end loop;

  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Das Ergebnis: neu mit Mitgliedern und Antworten.
-- ---------------------------------------------------------------------------
drop function if exists public.report_legacy_sync(uuid, boolean, text, int);

create or replace function public.report_legacy_sync(
  p_club_id   uuid,
  p_ok        boolean,
  p_error     text default null,
  p_count     int  default null,
  p_members   int  default null,
  p_responses int  default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row    legacy_sources;
  v_person record;
begin
  select * into v_row from legacy_sources where club_id = p_club_id for update;
  if not found then
    raise exception 'Diese Quelle besteht nicht';
  end if;

  if p_ok then
    update legacy_sources
       set status = 'active',
           last_sync_at = now(),
           last_error = null,
           imported_events    = coalesce(p_count, imported_events),
           imported_members   = coalesce(p_members, imported_members),
           imported_responses = coalesce(p_responses, imported_responses)
     where club_id = p_club_id;
    return;
  end if;

  update legacy_sources
     set last_error = left(coalesce(p_error, 'unbekannt'), 500),
         status = case
           when v_row.status = 'pending' then 'error'
           when v_row.last_sync_at is null
             or now() - v_row.last_sync_at > interval '3 days' then 'error'
           else v_row.status
         end
   where club_id = p_club_id;

  if v_row.status <> 'error'
     and (select status from legacy_sources where club_id = p_club_id) = 'error' then
    for v_person in
      select m.user_id from club_members m
       where m.club_id = p_club_id
         and m.role in ('admin','superadmin')
         and m.status <> 'left'
         and m.user_id is not null
    loop
      perform notify(
        v_person.user_id, 'system', 'Die Übernahme aus der bisherigen App meldet einen Fehler',
        null, '/tabs/profile/legacy', p_club_id
      );
    end loop;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- BR-192, zweite Hälfte: Wer mit der Adresse aus der alten App beitritt,
-- übernimmt sein Mitglied ohne Konto – samt Team, Zusagen und Rolle.
-- Rumpf sonst wie `0059`.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_invite(
  p_code         text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user      uuid := auth.uid();
  v_invite    invites;
  v_member_id uuid;
  v_is_new    boolean := false;
  v_name      text;
  v_email     text;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_invite from invites where code = lower(trim(p_code)) for update;
  if not found then
    raise exception 'Einladungscode unbekannt';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'Diese Einladung wurde zurückgezogen';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Dieser Einladungscode ist abgelaufen';
  end if;

  if v_invite.uses >= v_invite.max_uses then
    raise exception 'Dieser Einladungscode wurde bereits zu oft verwendet';
  end if;

  v_name := nullif(trim(coalesce(p_display_name, '')), '');

  select id into v_member_id
  from club_members
  where club_id = v_invite.club_id and user_id = v_user;

  -- Das Mitglied ohne Konto mit derselben Adresse (BR-192): Es bekommt das
  -- Konto, seine Rolle aus der alten App bleibt, sein Name auch – es sei
  -- denn, die Person nennt beim Beitritt einen.
  if v_member_id is null then
    select email into v_email from auth.users where id = v_user;
    select m.id into v_member_id
      from club_members m join member_contacts c on c.member_id = m.id
     where m.club_id = v_invite.club_id
       and m.user_id is null
       and m.status <> 'left'
       and v_email is not null
       and lower(c.email) = lower(v_email)
     limit 1;
    if v_member_id is not null then
      update club_members
         set user_id = v_user,
             display_name = coalesce(v_name, display_name)
       where id = v_member_id;
      v_is_new := true;
    end if;
  end if;

  if v_member_id is null then
    insert into club_members (club_id, user_id, role, display_name)
    values (
      v_invite.club_id,
      v_user,
      v_invite.role,
      coalesce(
        v_name,
        (select nullif(raw_user_meta_data->>'full_name', '') from auth.users where id = v_user),
        split_part((select email from auth.users where id = v_user), '@', 1)
      )
    )
    returning id into v_member_id;
    v_is_new := true;
  end if;

  if v_invite.team_id is not null then
    insert into team_members (team_id, member_id)
    values (v_invite.team_id, v_member_id)
    on conflict do nothing;
  end if;

  if v_is_new and v_invite.created_by is not null
     and v_invite.created_by <> v_member_id then
    perform award_points(v_invite.created_by, 'member_referred', 'invite', v_invite.id);
  end if;

  update invites set uses = uses + 1 where id = v_invite.id;

  return v_invite.club_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte.
-- ---------------------------------------------------------------------------
revoke execute on function public.upsert_legacy_members(uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.upsert_legacy_members(uuid, jsonb) to service_role;

revoke execute on function public.upsert_legacy_team(uuid, text, text, text) from public, anon, authenticated;
grant  execute on function public.upsert_legacy_team(uuid, text, text, text) to service_role;

revoke execute on function public.add_legacy_team_members(uuid, text[]) from public, anon, authenticated;
grant  execute on function public.add_legacy_team_members(uuid, text[]) to service_role;

revoke execute on function public.upsert_legacy_event(
  uuid, text, text, text, text, timestamptz, timestamptz, text, int, boolean, text, jsonb, uuid)
  from public, anon, authenticated;
grant  execute on function public.upsert_legacy_event(
  uuid, text, text, text, text, timestamptz, timestamptz, text, int, boolean, text, jsonb, uuid)
  to service_role;

revoke execute on function public.upsert_legacy_attendance(uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.upsert_legacy_attendance(uuid, jsonb) to service_role;

revoke execute on function public.report_legacy_sync(uuid, boolean, text, int, int, int)
  from public, anon, authenticated;
grant  execute on function public.report_legacy_sync(uuid, boolean, text, int, int, int) to service_role;

revoke execute on function public.redeem_invite(text, text) from public, anon;
grant  execute on function public.redeem_invite(text, text) to authenticated;

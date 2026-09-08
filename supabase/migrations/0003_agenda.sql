-- ============================================================================
-- 0003_agenda: Termine, Helfer-Schichten, Anwesenheit, QR-Check-in
-- MVP-Scope §2.1 und §4: Helfer-Schichten bleiben Terminorganisation, ihre
-- Bestätigung bucht direkt in den Punkte-Ledger.
-- ============================================================================

create table events (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references clubs(id) on delete cascade,
  team_id         uuid references teams(id) on delete cascade,
  type            text not null
                    check (type in ('training','match','cup','tournament','gv','social','helper')),
  title           text not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  location        text,
  -- Rotiert pro Termin; nur wer vor Ort ist, kann den Code lesen.
  qr_token        text unique not null default encode(extensions.gen_random_bytes(16), 'hex'),
  point_rule_code text,
  created_at      timestamptz not null default now()
);
create index events_club_starts_idx on events(club_id, starts_at);

create table event_shifts (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  title           text not null,
  starts_at       timestamptz,
  ends_at         timestamptz,
  needed          int not null default 1,
  point_rule_code text
);
create index event_shifts_event_idx on event_shifts(event_id);

create table attendance (
  event_id      uuid not null references events(id) on delete cascade,
  shift_id      uuid references event_shifts(id) on delete cascade,
  member_id     uuid not null references club_members(id) on delete cascade,
  status        text not null default 'registered'
                  check (status in ('registered','present','excused','absent','substitute')),
  reason        text,
  checked_in_at timestamptz,
  confirmed_by  uuid references club_members(id) on delete set null,
  primary key (event_id, member_id)
);
create index attendance_member_idx on attendance(member_id);

-- ---------------------------------------------------------------------------
-- QR-Check-in. Prüft Token und Zeitfenster serverseitig und bucht die Punkte
-- in derselben Transaktion (Architektur §7.1).
-- ---------------------------------------------------------------------------
create or replace function public.check_in(p_event_id uuid, p_qr_token text)
returns table (points_awarded int, already_checked_in boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event    events;
  v_member   uuid;
  v_existing attendance;
  v_points   int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  if v_event.qr_token is distinct from p_qr_token then
    raise exception 'QR-Code ungültig';
  end if;

  -- Check-in ist ab zwei Stunden vor Beginn bis vier Stunden nach Ende offen.
  if now() < v_event.starts_at - interval '2 hours'
     or now() > coalesce(v_event.ends_at, v_event.starts_at) + interval '4 hours' then
    raise exception 'Check-in ist für diesen Termin nicht offen';
  end if;

  v_member := current_member_id(v_event.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  select * into v_existing
  from attendance
  where event_id = p_event_id and member_id = v_member;

  if found and v_existing.status = 'present' then
    return query select 0, true;
    return;
  end if;

  insert into attendance (event_id, member_id, status, checked_in_at)
  values (p_event_id, v_member, 'present', now())
  on conflict (event_id, member_id)
  do update set status = 'present', checked_in_at = now();

  if v_event.point_rule_code is not null then
    v_points := award_points(
      v_member, v_event.point_rule_code, 'attendance', p_event_id, null
    );
  end if;

  return query select v_points, false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schicht-Bestätigung durch den Vorstand bzw. das OK.
-- Ersetzt das frühere Helferpunkte-Konto (MVP-Scope §4).
-- ---------------------------------------------------------------------------
create or replace function public.confirm_shift(p_event_id uuid, p_member_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club_id    uuid;
  v_shift_id   uuid;
  v_rule_code  text;
  v_confirmer  uuid;
begin
  select e.club_id, a.shift_id
    into v_club_id, v_shift_id
  from attendance a
  join events e on e.id = a.event_id
  where a.event_id = p_event_id and a.member_id = p_member_id;

  if v_club_id is null then
    raise exception 'Anmeldung nicht gefunden';
  end if;

  if not is_club_admin(v_club_id) then
    raise exception 'Nur der Vorstand kann Schichten bestätigen';
  end if;

  v_confirmer := current_member_id(v_club_id);

  select coalesce(s.point_rule_code, e.point_rule_code)
    into v_rule_code
  from events e
  left join event_shifts s on s.id = v_shift_id
  where e.id = p_event_id;

  update attendance
     set status = 'present',
         confirmed_by = v_confirmer,
         checked_in_at = coalesce(checked_in_at, now())
   where event_id = p_event_id and member_id = p_member_id;

  if v_rule_code is null then
    return 0;
  end if;

  return award_points(p_member_id, v_rule_code, 'shift', p_event_id, null);
end;
$$;

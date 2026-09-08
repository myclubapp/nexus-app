-- ============================================================================
-- 0004_tasks_news: Aufgaben-Marktplatz, News, In-App-Inbox
-- ============================================================================

create table tasks (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references clubs(id) on delete cascade,
  team_id       uuid references teams(id) on delete set null,
  title         text not null,
  description   text,
  category      text,
  points        int not null default 0,
  task_type     text not null default 'oneoff'
                  check (task_type in ('oneoff','recurring','season_role')),
  due_at        timestamptz,
  max_assignees int not null default 1,
  status        text not null default 'open'
                  check (status in ('open','claimed','submitted','done','expired')),
  created_by    uuid not null references club_members(id) on delete cascade,
  created_at    timestamptz not null default now()
);
create index tasks_club_status_idx on tasks(club_id, status);

create table task_assignments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks(id) on delete cascade,
  member_id    uuid not null references club_members(id) on delete cascade,
  claimed_at   timestamptz not null default now(),
  submitted_at timestamptz,
  proof_url    text,
  confirmed_at timestamptz,
  confirmed_by uuid references club_members(id) on delete set null,
  kudos        text,
  unique (task_id, member_id)
);

create table news (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid references clubs(id) on delete cascade,
  team_id      uuid references teams(id) on delete cascade,
  source       text not null default 'club' check (source in ('club','team','federation')),
  title        text not null,
  body         text,
  image_url    text,
  published_at timestamptz not null default now()
);
create index news_club_published_idx on news(club_id, published_at desc);

-- Die Inbox ist der Fallback, der 100% der Mitglieder erreicht – auch ohne
-- Push-Erlaubnis (Architektur §3.3).
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  club_id    uuid references clubs(id) on delete cascade,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);

create table push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text unique not null,
  platform   text not null check (platform in ('android_ntfy','ios_apns','webpush')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Aufgabe übernehmen. Die Kapazitätsprüfung gehört auf den Server, sonst
-- übernehmen zwei Personen gleichzeitig dieselbe Aufgabe.
-- ---------------------------------------------------------------------------
create or replace function public.claim_task(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task   tasks;
  v_member uuid;
  v_taken  int;
  v_id     uuid;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Aufgabe nicht gefunden';
  end if;

  v_member := current_member_id(v_task.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  if v_task.status not in ('open','claimed') then
    raise exception 'Diese Aufgabe ist nicht mehr offen';
  end if;

  select count(*) into v_taken from task_assignments where task_id = p_task_id;
  if v_taken >= v_task.max_assignees then
    raise exception 'Diese Aufgabe ist bereits vergeben';
  end if;

  insert into task_assignments (task_id, member_id)
  values (p_task_id, v_member)
  returning id into v_id;

  if v_taken + 1 >= v_task.max_assignees then
    update tasks set status = 'claimed' where id = p_task_id;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bestätigung durch den Vorstand bucht die Punkte (Architektur §7.4).
-- ---------------------------------------------------------------------------
create or replace function public.confirm_task(p_assignment_id uuid, p_kudos text default null)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment task_assignments;
  v_task       tasks;
begin
  select * into v_assignment from task_assignments where id = p_assignment_id;
  if not found then
    raise exception 'Zuweisung nicht gefunden';
  end if;

  select * into v_task from tasks where id = v_assignment.task_id;

  if not is_club_admin(v_task.club_id) then
    raise exception 'Nur der Vorstand kann Aufgaben bestätigen';
  end if;

  if v_assignment.confirmed_at is not null then
    return 0;
  end if;

  update task_assignments
     set confirmed_at = now(),
         confirmed_by = current_member_id(v_task.club_id),
         kudos = coalesce(p_kudos, kudos)
   where id = p_assignment_id;

  update tasks set status = 'done' where id = v_task.id;

  -- Anders als beim Training trägt die Aufgabe ihren Punktwert selbst; die
  -- Regel 'task_done' liefert nur die Säule fürs Reporting. Deshalb wird hier
  -- direkt gebucht statt über award_points(), das den Regelwert nähme.
  insert into point_transactions
    (club_id, member_id, rule_code, points, season, source_type, source_id, note)
  values
    (v_task.club_id, v_assignment.member_id, 'task_done', v_task.points,
     season_label(v_task.club_id), 'task', v_task.id, v_task.title)
  on conflict do nothing;

  if not found then
    return 0;
  end if;

  return v_task.points;
end;
$$;

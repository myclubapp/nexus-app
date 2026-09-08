-- ============================================================================
-- 0015_events: Termin erstellen, absagen, als Serie anlegen (UC-009)
--
-- `events` besteht seit 0003, trägt aber nur die Hälfte dessen, was das
-- Entitätsmodell verlangt: keine Serie, kein Warum, keinen Absagegrund,
-- keine erfassende Person. Ohne die lässt sich weder A1 (Serie) noch A4
-- (Absage mit Grund) umsetzen.
--
-- Die Berechtigung ist hier weiter gefasst als sonst: BR-033 gibt sie
-- Trainer:innen **und** dem Vorstand. Die bestehende Policy `events_admin_write`
-- kennt nur den Vorstand und wird deshalb ersetzt.
-- ============================================================================

create table if not exists event_series (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  team_id    uuid references teams(id) on delete set null,
  -- Rhythmus, Wochentag, Uhrzeit und Enddatum – die Form steht im Client
  -- (src/lib/eventSeries.ts), damit die Vorschau und die Erzeugung
  -- dieselbe Regel lesen.
  rule       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists event_series_club_idx on event_series(club_id);

alter table events add column if not exists series_id uuid
  references event_series(id) on delete set null;
alter table events add column if not exists why text;
alter table events add column if not exists capacity_needed int;
alter table events add column if not exists cancelled_at timestamptz;
alter table events add column if not exists cancelled_reason text;
alter table events add column if not exists is_sample boolean not null default false;
alter table events add column if not exists created_by uuid
  references club_members(id) on delete set null;
-- Für UC-031: der Teilnehmerkreis einer Sitzung über Ämter statt Namen.
alter table events add column if not exists audience_role_ids jsonb;

-- `meeting` fehlte; das Entitätsmodell nennt es (UC-095).
alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check
  check (type in ('training','match','cup','tournament','gv','social','helper','meeting'));

-- A5: Das Ende liegt nach dem Beginn.
alter table events drop constraint if exists events_time_check;
alter table events add constraint events_time_check
  check (ends_at is null or ends_at > starts_at);

-- BR-035: Eine Absage trägt immer ihren Grund.
alter table events drop constraint if exists events_cancel_check;
alter table events add constraint events_cancel_check
  check (
    (cancelled_at is null and cancelled_reason is null)
    or (cancelled_at is not null and coalesce(trim(cancelled_reason), '') <> '')
  );

-- BR-036: Aufrufe tragen ein ausgefülltes Warum, bevor sie sichtbar werden.
-- Als Constraint und nicht nur als Formularprüfung (C-011).
alter table events drop constraint if exists events_why_check;
alter table events add constraint events_why_check
  check (
    type not in ('helper','gv','social')
    or is_sample
    or coalesce(trim(why), '') <> ''
  );

create index if not exists events_series_idx on events(series_id);

-- ---------------------------------------------------------------------------
-- BR-033: Termine erfassen Trainer:innen und der Vorstand.
--
-- `events_admin_write` aus 0006 lässt nur den Vorstand schreiben. Eine
-- Trainer:in käme damit nicht an ihr eigenes Training.
-- ---------------------------------------------------------------------------
create or replace function public.is_club_trainer(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from club_members
    where club_id = p_club_id
      and user_id = auth.uid()
      and role in ('trainer','admin','superadmin')
      and status <> 'left'
  );
$$;

drop policy if exists events_admin_write on events;
create policy events_trainer_write on events
  for all using (is_club_trainer(club_id)) with check (is_club_trainer(club_id));

drop policy if exists shifts_admin_write on event_shifts;
create policy shifts_trainer_write on event_shifts
  for all using (
    exists (select 1 from events e where e.id = event_id and is_club_trainer(e.club_id))
  ) with check (
    exists (select 1 from events e where e.id = event_id and is_club_trainer(e.club_id))
  );

alter table event_series enable row level security;
drop policy if exists event_series_read on event_series;
create policy event_series_read on event_series
  for select using (is_club_member(club_id));
drop policy if exists event_series_write on event_series;
create policy event_series_write on event_series
  for all using (is_club_trainer(club_id)) with check (is_club_trainer(club_id));

-- ---------------------------------------------------------------------------
-- Termin absagen (A4).
--
-- Als Funktion, weil daran drei Dinge hängen, die zusammengehören: der
-- Vermerk, die Sperre für Zu- und Absagen und die Nachricht an alle
-- Betroffenen. Der Grund ist Pflicht (BR-035).
-- ---------------------------------------------------------------------------
create or replace function public.cancel_event(
  p_event_id uuid,
  p_reason   text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_reason text;
  v_person record;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  if not is_club_trainer(v_event.club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand sagen Termine ab';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Eine Absage braucht einen Grund';
  end if;

  if v_event.cancelled_at is not null then
    -- Zweimal absagen ändert nichts und benachrichtigt niemanden erneut.
    return;
  end if;

  update events
     set cancelled_at = now(), cancelled_reason = v_reason
   where id = p_event_id;

  -- Der Grund erreicht alle Betroffenen, nicht nur die Zugesagten.
  for v_person in
    select distinct m.user_id
    from club_members m
    left join team_members tm on tm.member_id = m.id
    where m.club_id = v_event.club_id
      and m.status <> 'left'
      and m.user_id is not null
      and (v_event.team_id is null or tm.team_id = v_event.team_id)
  loop
    perform notify(
      v_person.user_id, 'event',
      'Abgesagt: ' || v_event.title,
      v_reason, '/tabs/agenda', v_event.club_id
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Betroffene über einen neuen Termin benachrichtigen (Schritt 10).
--
-- Getrennt vom Anlegen: Der Termin entsteht über die Tabelle (die Policy
-- prüft die Rolle), und erst danach geht die Nachricht raus. So bleibt das
-- Anlegen ein gewöhnliches Insert und die Zustellung nachvollziehbar.
-- ---------------------------------------------------------------------------
create or replace function public.announce_event(p_event_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_person record;
  v_count  int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  if not is_club_trainer(v_event.club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand kündigen Termine an';
  end if;

  -- Beispielinhalte lösen keine Zustellung aus (BR-161).
  if v_event.is_sample then
    return 0;
  end if;

  for v_person in
    select distinct m.user_id
    from club_members m
    left join team_members tm on tm.member_id = m.id
    where m.club_id = v_event.club_id
      and m.status <> 'left'
      and m.user_id is not null
      and (v_event.team_id is null or tm.team_id = v_event.team_id)
  loop
    perform notify(
      v_person.user_id, 'event',
      v_event.title,
      to_char(v_event.starts_at at time zone 'Europe/Zurich', 'DD.MM.YYYY HH24:MI'),
      '/tabs/agenda', v_event.club_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.is_club_trainer(uuid) from public;
grant  execute on function public.is_club_trainer(uuid) to anon, authenticated;

revoke execute on function public.cancel_event(uuid, text) from public, anon;
grant  execute on function public.cancel_event(uuid, text) to authenticated;

revoke execute on function public.announce_event(uuid) from public, anon;
grant  execute on function public.announce_event(uuid) to authenticated;

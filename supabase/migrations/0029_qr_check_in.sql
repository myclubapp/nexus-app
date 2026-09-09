-- ============================================================================
-- 0029_qr_check_in: Der Code beweist wieder etwas (UC-014)
--
-- `events.qr_token` steht seit 0003 als gewöhnliche Spalte in `events`, und
-- `events_read` erlaubt jedem Vereinsmitglied das Lesen der ganzen Zeile. Damit
-- konnte jedes Mitglied über /rest/v1/events das Token abholen und von zu
-- Hause aus einchecken – das Zeitfenster hielt, die Anwesenheit nicht.
--
-- Genau das soll ein QR-Code verhindern: Er ist der Beweis, im Raum gewesen zu
-- sein. Ein Token, das alle lesen können, beweist nichts. BR-055 verlangt ein
-- Token je Termin, BR-056 die serverseitige Prüfung – beides bleibt, aber das
-- Geheimnis muss auch eines sein.
--
-- Eine Spaltenberechtigung (`revoke select (qr_token)`) wäre der kürzere Weg,
-- bricht aber jedes `select *` der App. Deshalb eine eigene Tabelle mit
-- eigener Policy.
-- ============================================================================

create table if not exists event_qr_tokens (
  event_id uuid primary key references events(id) on delete cascade,
  token    text unique not null default encode(extensions.gen_random_bytes(16), 'hex')
);

-- Bestehende Termine behalten ihr Token, sonst würden gedruckte oder offene
-- Codes ungültig. Im `do`-Block, weil die Spalte nach einem ersten Lauf nicht
-- mehr besteht und ein zweiter sonst an ihr scheiterte.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'events'
                and column_name = 'qr_token') then
    insert into event_qr_tokens (event_id, token)
    select id, qr_token from events
    on conflict (event_id) do nothing;
  end if;

  -- Termine, die es ohne Spalte schon gibt, bekommen ein frisches Token.
  insert into event_qr_tokens (event_id)
  select id from events
  on conflict (event_id) do nothing;
end $$;

alter table event_qr_tokens enable row level security;

-- Nur, wer den Code auch anzeigen darf (FR-034).
drop policy if exists event_qr_tokens_read on event_qr_tokens;
create policy event_qr_tokens_read on event_qr_tokens
  for select using (
    exists (select 1 from events e
             where e.id = event_id and is_club_trainer(e.club_id))
  );

-- Jeder neue Termin bekommt sein Token (BR-055).
create or replace function public.issue_event_qr_token()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into event_qr_tokens (event_id) values (new.id)
  on conflict (event_id) do nothing;
  return new;
end;
$$;

drop trigger if exists events_issue_qr_token on events;
create trigger events_issue_qr_token
  after insert on events
  for each row execute function public.issue_event_qr_token();

-- Die alte Spalte ist damit ein offenes Geheimnis ohne Zweck.
alter table events drop column if exists qr_token;

-- ---------------------------------------------------------------------------
-- Der Check-in liest das Token jetzt aus der geschützten Tabelle.
-- ---------------------------------------------------------------------------
create or replace function public.check_in(p_event_id uuid, p_qr_token text)
returns table (points_awarded int, already_checked_in boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event    events;
  v_token    text;
  v_member   uuid;
  v_existing attendance;
  v_points   int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  -- A3: Wer nicht dazugehört, checkt nicht ein.
  v_member := current_member_id(v_event.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  if v_event.cancelled_at is not null then
    raise exception 'Dieser Termin wurde abgesagt';
  end if;

  -- A2: Das Token gehört zu genau einem Termin (BR-055).
  select token into v_token from event_qr_tokens where event_id = p_event_id;
  if v_token is distinct from p_qr_token then
    raise exception 'Dieser Code gehört nicht zu diesem Termin';
  end if;

  -- A1 und BR-054: 30 Minuten vor Beginn bis Terminende; ohne Endzeit gilt
  -- eine Standarddauer von drei Stunden.
  if now() < v_event.starts_at - interval '30 minutes'
     or now() > coalesce(v_event.ends_at, v_event.starts_at + interval '3 hours') then
    raise exception 'Der Code ist ausserhalb des Zeitfensters nicht gültig';
  end if;

  select * into v_existing
    from attendance
   where event_id = p_event_id and member_id = v_member and shift_id is null;

  -- A4 und BR-057: Ein zweiter Scan bestätigt, bucht aber nicht nach.
  if found and v_existing.status = 'present' then
    return query select 0, true;
    return;
  end if;

  insert into attendance (event_id, member_id, shift_id, status, checked_in_at)
  values (p_event_id, v_member, null, 'present', now())
  on conflict (event_id, member_id, shift_id)
  do update set status = 'present', checked_in_at = now();

  if v_event.point_rule_code is not null then
    v_points := award_points(
      v_member, v_event.point_rule_code, 'attendance', p_event_id, null
    );
  end if;

  return query select v_points, false;
end;
$$;

revoke execute on function public.check_in(uuid, text) from public, anon;
grant  execute on function public.check_in(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- A6: Erfassung durch die Trainer:in.
--
-- Wer kein Smartphone dabei hat, war deswegen nicht weniger anwesend. Die
-- Buchung läuft über denselben Weg wie der Check-in – `award_points()` mit dem
-- Regelwert des Termins, weil ein Termin anders als eine Aufgabe keinen
-- eigenen Punktwert trägt (CLAUDE.md).
-- ---------------------------------------------------------------------------
create or replace function public.mark_attendance(
  p_event_id  uuid,
  p_member_id uuid,
  p_present   boolean default true
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_points int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  -- BR-033: Anwesenheit erfassen Trainer:innen und der Vorstand.
  if not is_club_trainer(v_event.club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand erfassen die Anwesenheit';
  end if;

  if not exists (select 1 from club_members
                  where id = p_member_id and club_id = v_event.club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  if not p_present then
    -- Zurücknehmen heisst: kein Anwesenheitsvermerk mehr. Die Buchung bleibt –
    -- korrigiert wird sie mit einer Gegenbuchung (BR-052).
    update attendance
       set status = 'absent',
           confirmed_by = current_member_id(v_event.club_id)
     where event_id = p_event_id and member_id = p_member_id and shift_id is null;
    return 0;
  end if;

  insert into attendance (event_id, member_id, shift_id, status, checked_in_at,
                          confirmed_by)
  values (p_event_id, p_member_id, null, 'present', now(),
          current_member_id(v_event.club_id))
  on conflict (event_id, member_id, shift_id) do update
     set status = 'present',
         checked_in_at = coalesce(attendance.checked_in_at, now()),
         confirmed_by = current_member_id(v_event.club_id);

  -- BR-057: Der Ledger dedupliziert über (Mitglied, Regel, Termin) – doppelt
  -- gebucht wird auch dann nicht, wenn jemand zuerst scannt und die Trainer:in
  -- ihn danach nochmals markiert.
  if v_event.point_rule_code is not null then
    v_points := award_points(
      p_member_id, v_event.point_rule_code, 'attendance', p_event_id, null
    );
  end if;

  return v_points;
end;
$$;

revoke execute on function public.mark_attendance(uuid, uuid, boolean) from public, anon;
grant  execute on function public.mark_attendance(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Schritt 2 und A6: Wer gehört zu diesem Termin, und wie hat er geantwortet?
-- ---------------------------------------------------------------------------
create or replace function public.event_roster(p_event_id uuid)
returns table (
  member_id    uuid,
  display_name text,
  status       text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_event events;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  if not is_club_trainer(v_event.club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand sehen die Teilnehmerliste';
  end if;

  return query
    select cm.id,
           cm.display_name,
           coalesce(a.status, 'open')
      from club_members cm
      left join attendance a
        on a.member_id = cm.id and a.event_id = p_event_id and a.shift_id is null
     where cm.club_id = v_event.club_id
       and cm.status <> 'left'
       -- Bei einem Team-Termin geht es nur um dieses Team.
       and (v_event.team_id is null
            or exists (select 1 from team_members tm
                        where tm.member_id = cm.id and tm.team_id = v_event.team_id))
     order by cm.display_name;
end;
$$;

revoke execute on function public.event_roster(uuid) from public, anon;
grant  execute on function public.event_roster(uuid) to authenticated;

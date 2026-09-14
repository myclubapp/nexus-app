-- ============================================================================
-- 0073_trainer_team_scope: Trainer:innen haben Team-Scope, der Vorstand
-- Vereins-Scope
--
-- Bis hier war `is_club_trainer()` zwei Dinge zugleich: «darf planen» und
-- «sieht den ganzen Verein». `event_in_scope()` (`0057`), `task_in_scope()`
-- (`0034`) und die Lese-Policies für News, Serien, Schichten und QR-Token
-- hatten alle denselben Zweig `or is_club_trainer(club_id)`. Eine Trainer:in
-- las damit jeden Team-Termin samt Teilnehmerliste, jede Team-Aufgabe und jede
-- Team-News des Vereins – und die Schreib-Policies liessen sie Termine fremder
-- Teams bearbeiten, absagen und löschen.
--
-- Entscheid (2026-09-13): **Trainer:innen sind wie Mitglieder abgegrenzt.**
-- Sie sehen und planen ihre eigenen Teams, dazu das, was dem ganzen Verein
-- gilt. Den Vereins-Scope haben nur der Vorstand, Admin und Sportchef:in.
-- Im Einzelnen:
--
--   1. Vereinsweites (Termin, Aufgabe, News ohne `team_id`) legt nur der
--      Vorstand an. Eine Trainer:in schreibt für ihr Team aus.
--   2. «Ihr Team» ist jede Zeile in `team_members` – unabhängig von der
--      Teamrolle. So rechnet `health_signal_in_reach()` seit `0040`.
--   3. Kennzahlen bekommen Trainer:innen nur für ihre Teams
--      (`team_health`, `team_mood`) und für Personen, die sie begleiten
--      (`value_dimensions`, `emergency_contact`, `training_streak`).
--      Vereinsweite Kennzahlen (`connection_ratio`, Routing) gehören dem
--      Vorstand.
--
-- Die Regel steht damit an drei Stellen, nicht an fünfzig:
--
--   `is_club_board(club)`            – Vereins-Scope: sportchef, admin, superadmin
--   `can_plan_for_team(club, team)`  – Vorstand, oder Trainer:in dieses Teams
--   `can_follow_member(club, member)` – Vorstand, oder Trainer:in, die ein
--                                       Team mit der Person teilt
--
-- `is_club_trainer()` bleibt bestehen und heisst ab hier nur noch «darf
-- überhaupt planen». Über die Reichweite entscheidet sie nicht mehr. Wer eine
-- neue Policy oder Funktion schreibt, nimmt eine der drei Funktionen oben;
-- ein `is_club_trainer()` in einer Reichweiten-Prüfung ist ab hier ein Befund.
--
-- Unverändert bleibt `health_signal_in_reach()`: Dort hat die Sportchef:in
-- seit `0059` absichtlich einen Bereichs-Scope (Vision §4), und Trainer:innen
-- waren schon immer auf ihr Team begrenzt. `health_definitions()` bleibt für
-- Trainer:innen offen – es sind die Schwellwerte des Vereins, keine
-- Personendaten, und ohne sie sind die eigenen Teamzahlen nicht lesbar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Die drei Reichweiten-Funktionen.
-- ---------------------------------------------------------------------------
create or replace function public.is_club_board(p_club_id uuid)
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
      and role in ('sportchef','admin','superadmin')
      and status <> 'left'
  );
$$;

-- Ein `team_id` von null heisst «der ganze Verein» – und dafür braucht es den
-- Vorstand. Eine Trainer:in ohne Team plant deshalb gar nichts.
create or replace function public.can_plan_for_team(p_club_id uuid, p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select is_club_board(p_club_id)
      or (
        p_team_id is not null
        and is_club_trainer(p_club_id)
        and exists (
          select 1 from team_members tm
           where tm.team_id = p_team_id
             and tm.member_id = current_member_id(p_club_id)
        )
      );
$$;

-- Wer eine Person begleitet: der Vorstand, oder eine Trainer:in, die mit ihr
-- in mindestens einem Team steht. Bisher stand dieser Join dreimal im Code
-- (`value_dimensions`, `emergency_contact`, `health_signal_in_reach`).
create or replace function public.can_follow_member(p_club_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select is_club_board(p_club_id)
      or (
        is_club_trainer(p_club_id)
        and exists (
          select 1
            from team_members mine
            join team_members theirs on theirs.team_id = mine.team_id
           where mine.member_id = current_member_id(p_club_id)
             and theirs.member_id = p_member_id
        )
      );
$$;

revoke execute on function public.is_club_board(uuid)              from public, anon;
revoke execute on function public.can_plan_for_team(uuid, uuid)    from public, anon;
revoke execute on function public.can_follow_member(uuid, uuid)    from public, anon;
grant  execute on function public.is_club_board(uuid)              to authenticated;
grant  execute on function public.can_plan_for_team(uuid, uuid)    to authenticated;
grant  execute on function public.can_follow_member(uuid, uuid)    to authenticated;

-- ---------------------------------------------------------------------------
-- Die beiden Scope-Funktionen: der Planer-Zweig wird zum Vorstands-Zweig.
-- Wortgleich zueinander, wie in `0057` begründet.
-- ---------------------------------------------------------------------------
create or replace function public.event_in_scope(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from events e
     where e.id = p_event_id
       and is_club_member(e.club_id)
       and (
         -- Ein Vereinstermin gilt allen.
         e.team_id is null
         -- Der Vorstand sieht den ganzen Vereinskalender.
         or is_club_board(e.club_id)
         -- Alle anderen – Trainer:innen eingeschlossen – ihre Teams.
         or exists (
           select 1 from team_members tm
            where tm.team_id = e.team_id
              and tm.member_id = current_member_id(e.club_id)
         )
       )
  );
$$;

create or replace function public.task_in_scope(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from tasks t
     where t.id = p_task_id
       and is_club_member(t.club_id)
       and (
         -- Ein Vereinsaufruf gilt allen.
         t.team_id is null
         -- Der Vorstand sieht alle Aufrufe des Vereins.
         or is_club_board(t.club_id)
         -- Alle anderen – Trainer:innen eingeschlossen – ihre Teams.
         or exists (
           select 1
             from team_members tm
            where tm.team_id = t.team_id
              and tm.member_id = current_member_id(t.club_id)
         )
       )
  );
$$;

-- ---------------------------------------------------------------------------
-- Termine: lesen, schreiben, Serie, Schichten, QR-Token.
--
-- Entwürfe sieht, wer für den Termin planen darf – ein Vereinsentwurf also
-- nur der Vorstand. Die Schreib-Policies prüfen `team_id` der Zeile selbst,
-- in `with check` auch den neuen Wert: Ein Termin lässt sich nicht in ein
-- fremdes Team verschieben.
-- ---------------------------------------------------------------------------
drop policy if exists events_read on events;
create policy events_read on events
  for select using (
    (published_at is not null or can_plan_for_team(club_id, team_id))
    and event_in_scope(id)
  );

drop policy if exists events_trainer_write on events;
create policy events_trainer_write on events
  for all
  using      (can_plan_for_team(club_id, team_id))
  with check (can_plan_for_team(club_id, team_id));

drop policy if exists event_series_read on event_series;
create policy event_series_read on event_series
  for select using (
    is_club_member(club_id)
    and (
      team_id is null
      or is_club_board(club_id)
      or exists (
        select 1 from team_members tm
         where tm.team_id = event_series.team_id
           and tm.member_id = current_member_id(event_series.club_id)
      )
    )
  );

drop policy if exists event_series_write on event_series;
create policy event_series_write on event_series
  for all
  using      (can_plan_for_team(club_id, team_id))
  with check (can_plan_for_team(club_id, team_id));

drop policy if exists shifts_read on event_shifts;
create policy shifts_read on event_shifts
  for select using (
    exists (
      select 1 from events e
       where e.id = event_shifts.event_id
         and (e.published_at is not null or can_plan_for_team(e.club_id, e.team_id))
    )
    and event_in_scope(event_id)
  );

drop policy if exists shifts_trainer_write on event_shifts;
create policy shifts_trainer_write on event_shifts
  for all
  using (
    exists (select 1 from events e
             where e.id = event_id and can_plan_for_team(e.club_id, e.team_id))
  )
  with check (
    exists (select 1 from events e
             where e.id = event_id and can_plan_for_team(e.club_id, e.team_id))
  );

drop policy if exists event_qr_tokens_read on event_qr_tokens;
create policy event_qr_tokens_read on event_qr_tokens
  for select using (
    exists (
      select 1 from events e
       where e.id = event_qr_tokens.event_id
         and can_plan_for_team(e.club_id, e.team_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Aufgaben.
-- ---------------------------------------------------------------------------
drop policy if exists tasks_read on tasks;
create policy tasks_read on tasks
  for select using (
    -- Entwurf (A3) und Abgelaufenes (A4) gehören der ausschreibenden Seite:
    -- Das eine ist noch kein Aufruf, das andere keiner mehr.
    (status not in ('draft', 'expired') or can_plan_for_team(club_id, team_id))
    and task_in_scope(id)
  );

drop policy if exists tasks_trainer_insert on tasks;
create policy tasks_trainer_insert on tasks
  for insert with check (
    can_plan_for_team(club_id, team_id) and created_by = current_member_id(club_id)
  );

drop policy if exists tasks_trainer_update on tasks;
create policy tasks_trainer_update on tasks
  for update
  using      (can_plan_for_team(club_id, team_id))
  with check (can_plan_for_team(club_id, team_id));

drop policy if exists tasks_trainer_delete on tasks;
create policy tasks_trainer_delete on tasks
  for delete using (can_plan_for_team(club_id, team_id));

-- ---------------------------------------------------------------------------
-- News.
-- ---------------------------------------------------------------------------
drop policy if exists news_read on news;
create policy news_read on news
  for select using (
    is_club_member(club_id)
    and (
      team_id is null
      or is_club_board(club_id)
      or exists (
        select 1 from team_members tm
         where tm.team_id = news.team_id
           and tm.member_id = current_member_id(news.club_id)
      )
    )
  );

drop policy if exists news_trainer_write on news;
create policy news_trainer_write on news
  for all
  using      (can_plan_for_team(club_id, team_id))
  with check (can_plan_for_team(club_id, team_id));

-- ---------------------------------------------------------------------------
-- Routing der Fürsorge-Hinweise: eine Vereinseinstellung, die der Vorstand
-- liest und pflegt.
-- ---------------------------------------------------------------------------
drop policy if exists health_alert_routing_read on health_alert_routing;
create policy health_alert_routing_read on health_alert_routing
  for select using (is_club_board(club_id));

-- ---------------------------------------------------------------------------
-- Die Funktionen – jeweils die jüngste Fassung, nur die Reichweiten-Prüfung
-- ist anders. Wortgleich zur Vorlage, damit ein Diff die Änderung zeigt.
-- ---------------------------------------------------------------------------

-- --- Termine (0015, 0021, 0029, 0030, 0032, 0049) --------------------------

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

  if not can_plan_for_team(v_event.club_id, v_event.team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand sagen Termine ab';
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

  if not can_plan_for_team(v_event.club_id, v_event.team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand kündigen Termine an';
  end if;

  -- Beispielinhalte lösen keine Zustellung aus (BR-161).
  if v_event.is_sample then
    return 0;
  end if;

  -- BR-133: Steht ein Empfängerkreis aus Ämtern, gilt er – aufgelöst über die
  -- **aktuellen** Inhaber:innen, nicht über eine gespeicherte Namensliste.
  if coalesce(jsonb_array_length(v_event.audience_role_ids), 0) > 0 then
    for v_person in
      select * from committee_members(v_event.club_id, v_event.audience_role_ids)
    loop
      perform notify(
        v_person.user_id, 'event', v_event.title,
        to_char(v_event.starts_at at time zone 'Europe/Zurich', 'DD.MM.YYYY HH24:MI'),
        '/tabs/agenda', v_event.club_id);
      v_count := v_count + 1;
    end loop;
    return v_count;
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

create or replace function public.publish_event(p_event_id uuid)
returns table (notified int, muted boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_muted  boolean;
  v_count  int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  -- UC-011 Precondition: Der Helferaufruf geht an den ganzen Verein.
  if v_event.type = 'helper' then
    if not is_club_admin(v_event.club_id) then
      raise exception 'Nur der Vorstand schreibt einen Helferaufruf aus';
    end if;
  elsif not can_plan_for_team(v_event.club_id, v_event.team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand schreiben aus';
  end if;

  if v_event.cancelled_at is not null then
    raise exception 'Dieser Termin wurde abgesagt';
  end if;

  -- Zweimal ausschreiben ändert nichts und benachrichtigt niemanden erneut.
  if v_event.published_at is not null then
    return query select 0, false;
    return;
  end if;

  -- BR-043: Ein Aufruf ohne Sinnzusammenhang wird nicht publiziert. Der
  -- Constraint deckt das publizierte Event ab; hier steht es nochmals, weil
  -- ein Entwurf ohne Warum bis hierher kommen darf.
  if v_event.type in ('helper','gv','social')
     and coalesce(trim(v_event.why), '') = '' then
    raise exception 'Ein Aufruf braucht sein Warum, bevor er ausgeschrieben wird';
  end if;

  -- Ein Helfer-Event ohne Schicht wäre ein Aufruf, dem niemand folgen kann.
  if v_event.type = 'helper'
     and not exists (select 1 from event_shifts where event_id = p_event_id) then
    raise exception 'Ein Helfer-Event braucht mindestens eine Schicht';
  end if;

  update events set published_at = now() where id = p_event_id;

  v_muted := call_is_muted(v_event.club_id);

  -- A3: Bei aktiver sanfter Sperre bleibt das Event sichtbar, der Push
  -- unterbleibt. Der Zähler bekommt trotzdem seinen Eintrag – der Aufruf
  -- ist ergangen, auch wenn er leiser war.
  if not v_muted then
    select announce_event(p_event_id) into v_count;
  end if;

  perform log_club_message(v_event.club_id, 'call', 'event:' || v_event.type);

  return query select v_count, v_muted;
end;
$$;

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
  if not can_plan_for_team(v_event.club_id, v_event.team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand erfassen die Anwesenheit';
  end if;

  -- Ein Entwurf hat nicht stattgefunden, ein abgesagter Termin auch nicht.
  if v_event.published_at is null then
    raise exception 'Dieser Termin ist noch nicht ausgeschrieben';
  end if;

  if v_event.cancelled_at is not null then
    raise exception 'Dieser Termin wurde abgesagt';
  end if;

  if not exists (select 1 from club_members
                  where id = p_member_id and club_id = v_event.club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  -- Bei einem Team-Termin geht es um dieses Team. `event_roster()` filtert so,
  -- also darf die Erfassung nicht weiter reichen als die Liste, aus der sie
  -- aufgerufen wird.
  if v_event.team_id is not null
     and not exists (select 1 from team_members tm
                      where tm.member_id = p_member_id
                        and tm.team_id = v_event.team_id) then
    raise exception 'Dieses Mitglied gehört nicht zum Team des Termins';
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

  if not can_plan_for_team(v_event.club_id, v_event.team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand sehen die Teilnehmerliste';
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

create or replace function public.remind_undecided(p_event_id uuid)
returns table (notified int, last_reminder timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
  v_team uuid;
begin
  select club_id, team_id into v_club, v_team from events where id = p_event_id;
  if v_club is null then
    raise exception 'Termin nicht gefunden';
  end if;

  -- BR-033: Erinnern dürfen Trainer:innen und der Vorstand.
  if not can_plan_for_team(v_club, v_team) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand erinnern';
  end if;

  return query select * from remind_undecided_internal(p_event_id);
end;
$$;


-- --- Aufgaben (0033, 0036) -------------------------------------------------

create or replace function public.create_task(
  p_club_id         uuid,
  p_title           text,
  p_why             text,
  p_category        text,
  p_points          int,
  p_due_at          timestamptz default null,
  p_max_assignees   int default 1,
  p_description     text default null,
  p_team_id         uuid default null,
  p_recurrence_days int default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid;
  v_task   uuid;
begin
  if not can_plan_for_team(p_club_id, p_team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand schreiben Aufgaben aus';
  end if;

  v_member := current_member_id(p_club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'Eine Aufgabe braucht einen Titel';
  end if;

  -- Ein Team aus einem fremden Verein ergäbe einen Geltungsbereich, den
  -- niemand sieht.
  if p_team_id is not null
     and not exists (select 1 from teams where id = p_team_id and club_id = p_club_id) then
    raise exception 'Dieses Team gehört nicht zu diesem Verein';
  end if;

  insert into tasks (
    club_id, team_id, title, description, why, category, points,
    task_type, due_at, max_assignees, status, created_by, recurrence_days
  )
  values (
    p_club_id, p_team_id, trim(p_title), nullif(trim(p_description), ''),
    nullif(trim(p_why), ''), p_category, greatest(coalesce(p_points, 0), 0),
    case when p_recurrence_days is null then 'oneoff' else 'recurring' end,
    p_due_at, greatest(coalesce(p_max_assignees, 1), 1), 'draft', v_member,
    p_recurrence_days
  )
  returning id into v_task;

  return v_task;
end;
$$;

create or replace function public.publish_task(p_task_id uuid)
returns table (notified int, muted boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task tasks;
begin
  -- Gesperrt gelesen: Zwei gleichzeitige Publikationen stellten sonst zweimal
  -- zu, weil beide den Entwurf sähen.
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Aufgabe nicht gefunden';
  end if;

  if not can_plan_for_team(v_task.club_id, v_task.team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand schreiben Aufgaben aus';
  end if;

  -- Zweimal ausschreiben ändert nichts und benachrichtigt niemanden erneut.
  if v_task.status <> 'draft' then
    return query select 0, false;
    return;
  end if;

  -- A1/BR-069: Der Constraint deckt den publizierten Datensatz ab; hier steht
  -- es nochmals, weil ein Entwurf ohne Warum bis hierher kommen darf.
  if coalesce(trim(v_task.why), '') = '' then
    raise exception 'Eine Aufgabe braucht ihr Warum, bevor sie ausgeschrieben wird';
  end if;

  update tasks set status = 'open' where id = p_task_id;

  return query select * from announce_task(p_task_id);
end;
$$;

create or replace function public.confirm_task(
  p_assignment_id uuid,
  p_kudos         text default null
)
returns table (points int, booked boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment task_assignments;
  v_task       tasks;
  v_rule       point_rules;
  v_confirmer  uuid;
  v_open       int;
  v_taken      int;
  v_user       uuid;
  v_kudos      text;
  v_points     int := 0;
begin
  select * into v_assignment
    from task_assignments where id = p_assignment_id for update;
  if not found then
    raise exception 'Zuweisung nicht gefunden';
  end if;

  select * into v_task from tasks where id = v_assignment.task_id;

  -- Die Voraussetzung nennt trainer **oder** admin.
  if not can_plan_for_team(v_task.club_id, v_task.team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand bestätigen Aufgaben';
  end if;

  v_confirmer := current_member_id(v_task.club_id);

  -- BR-080: Wer eine Aufgabe selbst übernommen hat, bestätigt sie nicht selbst.
  -- Das Entitätsmodell verlangt dasselbe: `confirmed_by` ist nie identisch mit
  -- `member_id`.
  if v_confirmer = v_assignment.member_id then
    raise exception 'Die eigene Übernahme bestätigt jemand anderes';
  end if;

  -- A4: Zweimal bestätigen ändert nichts und dankt nicht ein zweites Mal.
  if v_assignment.confirmed_at is not null then
    return query select 0, false;
    return;
  end if;

  v_kudos := nullif(trim(p_kudos), '');

  update task_assignments
     set confirmed_at = now(),
         confirmed_by = v_confirmer,
         kudos = coalesce(v_kudos, kudos)
   where id = p_assignment_id;

  -- A2 aus UC-018: Erledigt ist die Aufgabe erst, wenn sie voll ist **und**
  -- alle Übernahmen bestätigt sind. Sonst verlöre die zweite Person ihre
  -- Aufgabe, weil die erste bestätigt wurde.
  select count(*) into v_taken from task_assignments where task_id = v_task.id;
  select count(*) into v_open
    from task_assignments
   where task_id = v_task.id and confirmed_at is null;

  if v_taken >= v_task.max_assignees and v_open = 0 then
    update tasks set status = 'done' where id = v_task.id;
  end if;

  select user_id into v_user from club_members where id = v_assignment.member_id;

  -- BR-065: Gibt es die Regel, und ist sie aktiv? Ohne sie vergibt der Verein
  -- für Aufgaben keine Punkte – dieselbe Antwort, die `award_points()` gibt.
  -- Die Aufgabe gilt trotzdem als erledigt: Die Anerkennung hängt nicht an der
  -- Zahl (V7, A3).
  select * into v_rule
    from point_rules
   where club_id = v_task.club_id and code = 'task_done' and is_active;

  if found and not rule_limit_reached(v_assignment.member_id, v_rule)
     and v_task.points > 0 and not v_task.is_sample then
    -- BR-077: der Punktwert **der Aufgabe**; die Regel liefert die Säule.
    -- BR-079: `source_id` ist die Aufgabe – der Dedupe-Index verwirft eine
    -- zweite Buchung still.
    insert into point_transactions
      (club_id, member_id, rule_code, points, season, source_type, source_id, note)
    values
      (v_task.club_id, v_assignment.member_id, 'task_done', v_task.points,
       season_label(v_task.club_id), 'task', v_task.id, v_task.title)
    on conflict do nothing;

    if found then
      v_points := v_task.points;
    end if;
  end if;

  -- Schritt 7 und BR-078: Der Dank ist die Nachricht, die Zahl steht
  -- nachgeordnet im Text. Ohne Dank trägt die Nachricht wenigstens den
  -- Aufgabentitel – aber nie eine Null als Aussage über den Beitrag.
  if v_user is not null and not v_task.is_sample then
    perform notify(
      v_user,
      'points',
      coalesce(v_kudos, 'Danke für deinen Einsatz'),
      v_task.title
        || case when v_points > 0
                then ' – ' || v_points || ' Punkte gutgeschrieben'
                else '' end,
      '/tabs/profile',
      v_task.club_id
    );
  end if;

  return query select v_points, true;
end;
$$;

create or replace function public.reject_task(
  p_assignment_id uuid,
  p_note          text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment task_assignments;
  v_task       tasks;
  v_user       uuid;
begin
  select * into v_assignment
    from task_assignments where id = p_assignment_id for update;
  if not found then
    raise exception 'Zuweisung nicht gefunden';
  end if;

  select * into v_task from tasks where id = v_assignment.task_id;

  if not can_plan_for_team(v_task.club_id, v_task.team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand entscheiden über Aufgaben';
  end if;

  if v_assignment.confirmed_at is not null then
    raise exception 'Diese Aufgabe ist bereits bestätigt';
  end if;

  if coalesce(trim(p_note), '') = '' then
    raise exception 'Zur Nachbesserung gehört ein Hinweis, was fehlt';
  end if;

  -- Zurück auf übernommen: Die Person behält die Aufgabe, nur die Meldung ist
  -- zurückgenommen.
  update task_assignments
     set submitted_at = null
   where id = p_assignment_id;

  if v_task.status = 'submitted' then
    update tasks set status = 'claimed' where id = v_task.id;
  end if;

  select user_id into v_user from club_members where id = v_assignment.member_id;
  if v_user is not null and not v_task.is_sample then
    perform notify(
      v_user, 'task', v_task.title, trim(p_note),
      '/tabs/marketplace?task=' || v_task.id, v_task.club_id
    );
  end if;
end;
$$;

create or replace function public.task_roster(p_task_id uuid)
returns table (
  assignment_id uuid,
  member_id     uuid,
  display_name  text,
  claimed_at    timestamptz,
  submitted_at  timestamptz,
  proof_url     text,
  confirmed_at  timestamptz,
  kudos         text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
  v_team uuid;
begin
  select club_id, team_id into v_club, v_team from tasks where id = p_task_id;
  if v_club is null then
    raise exception 'Aufgabe nicht gefunden';
  end if;

  if not can_plan_for_team(v_club, v_team) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand sehen die Übernahmen';
  end if;

  return query
    select a.id, a.member_id, m.display_name, a.claimed_at, a.submitted_at,
           a.proof_url, a.confirmed_at, a.kudos
      from task_assignments a
      join club_members m on m.id = a.member_id
     where a.task_id = p_task_id
     -- Zwei Übernahmen desselben Augenblicks – etwa aus einem Import – hätten
     -- ohne zweites Merkmal keine feste Reihenfolge, und die Liste spränge bei
     -- jedem Aufruf.
     order by a.claimed_at, m.display_name, a.id;
end;
$$;


-- --- News (0043, 0055) -----------------------------------------------------

create or replace function public.publish_news(
  p_title     text,
  p_body      text,
  p_club_id   uuid,
  p_team_id   uuid    default null,
  p_image_url text    default null,
  p_source    text    default 'club'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_news   uuid;
  v_person record;
begin
  if not can_plan_for_team(p_club_id, p_team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand schreiben News';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'Eine News braucht einen Titel';
  end if;

  if p_team_id is not null
     and not exists (select 1 from teams where id = p_team_id and club_id = p_club_id) then
    raise exception 'Dieses Team gehört nicht zu diesem Verein';
  end if;

  insert into news (club_id, team_id, source, title, body, image_url)
  values (
    p_club_id, p_team_id,
    -- Seit `0055` steht `board` in der Liste: Eine News aus einer
    -- Vorstandsantwort trägt ihren Ursprung, und der Puls erkennt sie daran.
    case when p_source in ('club','team','federation','website','board') then p_source
         else 'club' end,
    trim(p_title), nullif(trim(p_body), ''), nullif(trim(p_image_url), '')
  )
  returning id into v_news;

  -- BR-110: Die Inbox erreicht alle, unabhängig von Push.
  -- BR-109: und nur den gewählten Geltungsbereich.
  for v_person in
    select distinct m.user_id
      from club_members m
      left join team_members tm on tm.member_id = m.id
     where m.club_id = p_club_id
       and m.status <> 'left'
       and m.user_id is not null
       and (p_team_id is null or tm.team_id = p_team_id)
  loop
    perform notify(
      v_person.user_id, 'news', trim(p_title),
      left(coalesce(nullif(trim(p_body), ''), ''), 160),
      '/tabs/dashboard', p_club_id
    );
  end loop;

  -- BR-111: Eine News ist eine Verbindung. Das ist der Eintrag, der die sanfte
  -- Sperre aus UC-011 wieder löst.
  perform log_club_message(p_club_id, 'connection', 'news:' || p_source);

  return v_news;
end;
$$;

create or replace function public.retract_news(p_news_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
  v_team uuid;
begin
  select club_id, team_id into v_club, v_team from news where id = p_news_id;
  if v_club is null then
    raise exception 'News nicht gefunden';
  end if;

  if not can_plan_for_team(v_club, v_team) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand ziehen News zurück';
  end if;

  delete from news where id = p_news_id;
end;
$$;


-- --- Kennzahlen (0042, 0044, 0050, 0056, 0063, 0066) -----------------------

create or replace function public.value_dimensions(
  p_club_id   uuid,
  p_member_id uuid default null
)
returns table (
  dimension  text,
  own_value  int,
  team_value int,
  club_value int,
  collected  boolean,
  group_size int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
-- Die Spaltennamen aus `returns table` werden in PL/pgSQL zu Variablen und
-- kollidieren mit den gleichnamigen Spalten der Abfrage unten. Gemeint ist
-- immer die Spalte.
#variable_conflict use_column
declare
  v_self    uuid;
  v_target  uuid;
  v_team    uuid;
  v_season  text;
  v_min     int;
begin
  v_self := current_member_id(p_club_id);
  if v_self is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  v_target := coalesce(p_member_id, v_self);

  -- A4: Fremde Diagramme sieht nur, wer die Person auch begleitet.
  if v_target <> v_self then
    if not can_follow_member(p_club_id, v_target) then
      raise exception 'Dieses Profil gehört nicht in deinen Bereich';
    end if;
  end if;

  v_season := season_label(p_club_id);
  v_min := coalesce(
    (select nullif(c.settings->'dimensions'->>'minGroup','')::int
       from clubs c where c.id = p_club_id), 3);

  select tm.team_id into v_team
    from team_members tm where tm.member_id = v_target limit 1;

  return query
  with per_member as (
    -- Punkte je Person und Dimension in der laufenden Saison.
    select
      t.member_id,
      dimension_of_pillar(coalesce(t.pillar, r.pillar)::smallint) as dimension,
      sum(t.points)::int as points
    from point_transactions t
    left join point_rules r on r.club_id = t.club_id and r.code = t.rule_code
    where t.club_id = p_club_id
      and t.season = v_season
      and dimension_of_pillar(coalesce(t.pillar, r.pillar)::smallint) is not null
    group by 1, 2
  ),
  scale as (
    -- Hundert ist der höchste Wert, den in dieser Saison jemand im Verein in
    -- dieser Dimension erreicht hat. So liegen eigene Werte und
    -- Vergleichslinien auf **derselben** Skala.
    select dimension, greatest(max(points), 1) as top
      from per_member group by dimension
  ),
  dims as (
    -- Alle fünf Dimensionen, auch die ohne jede Buchung: Sie fehlen sonst im
    -- Diagramm, statt als «nicht erhoben» dazustehen (BR-103).
    select unnest(array['engagement','volunteering','finance','network','loyalty']) as dimension
  ),
  -- Eine Dimension gilt als erhoben, wenn der Verein mindestens eine **aktive**
  -- Regel in einer ihrer Säulen führt (A2).
  collected_dims as (
    select dimension_of_pillar(r.pillar) as dimension
      from point_rules r
     where r.club_id = p_club_id and r.is_active
       and dimension_of_pillar(r.pillar) is not null
     group by 1
  )
  select
    d.dimension,
    coalesce(round(100.0 * own.points / s.top)::int, 0),
    case
      when team_stat.members >= v_min
        then coalesce(round(100.0 * team_stat.avg_points / s.top)::int, 0)
    end,
    case
      when club_stat.members >= v_min
        then coalesce(round(100.0 * club_stat.avg_points / s.top)::int, 0)
    end,
    (c.dimension is not null),
    coalesce(team_stat.members, 0)
  from dims d
  left join scale s on s.dimension = d.dimension
  left join collected_dims c on c.dimension = d.dimension
  left join per_member own
    on own.dimension = d.dimension and own.member_id = v_target
  left join lateral (
    select count(*)::int as members, avg(pm.points) as avg_points
      from per_member pm
      join team_members tm on tm.member_id = pm.member_id
     where pm.dimension = d.dimension and tm.team_id = v_team
  ) team_stat on true
  left join lateral (
    select count(*)::int as members, avg(pm.points) as avg_points
      from per_member pm
     where pm.dimension = d.dimension
  ) club_stat on true
  order by array_position(
    array['engagement','volunteering','finance','network','loyalty'], d.dimension);
end;
$$;

create or replace function public.connection_ratio(
  p_club_id uuid,
  p_days    int default 56
)
returns table (connections int, calls int, last_connection timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  -- Ausdrücklich abweisen statt Nullen zurückgeben: Eine Quote «0 zu 0» liest
  -- sich wie «der Verein schweigt», nicht wie «das darfst du nicht sehen».
  if not is_club_board(p_club_id) then
    raise exception 'Nur der Vorstand sieht die Verbindungs-Quote';
  end if;

  return query
    select
      count(*) filter (where kind = 'connection')::int,
      count(*) filter (where kind = 'call')::int,
      max(sent_at) filter (where kind = 'connection')
    from club_message_log
    where club_id = p_club_id
      and sent_at > now() - make_interval(days => greatest(coalesce(p_days, 56), 1));
end;
$$;

create or replace function public.team_mood(p_team_id uuid)
returns table (
  average   numeric,
  responses int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_club  uuid;
  v_days  int;
  v_avg   numeric;
  v_count int;
begin
  select t.club_id into v_club from teams t where t.id = p_team_id;
  if v_club is null then
    raise exception 'Team nicht gefunden';
  end if;

  if not can_plan_for_team(v_club, p_team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand sehen Teamwerte';
  end if;

  v_days := coalesce(
    nullif((select c.settings->'checkin'->>'windowDays' from clubs c where c.id = v_club), '')::int,
    28);

  select round(avg(r.value_num), 2), count(*)
    into v_avg, v_count
    from checkin_responses r
    join events e on e.id = r.event_id
   where e.team_id = p_team_id
     and r.value_num is not null
     and r.created_at > now() - make_interval(days => v_days);

  -- BR-140: Darunter gar nichts.
  if coalesce(v_count, 0) < 5 then
    return;
  end if;

  return query select v_avg, v_count;
end;
$$;

create or replace function public.team_health(p_club_id uuid)
returns table (
  team_id      uuid,
  team_name    text,
  members      int,
  invitations  int,
  answered     int,
  attended     int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_min    int;
  v_member uuid;
begin
  if not is_club_trainer(p_club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand sehen Teamzahlen';
  end if;

  v_min    := health_threshold(p_club_id, 'minGroup', 5)::int;
  v_member := current_member_id(p_club_id);

  return query
  with in_reach as (
    -- BR-096: Der Vorstand sieht den Verein, Trainer:innen ihre Teams.
    select t.id, t.name
      from teams t
     where t.club_id = p_club_id
       and (is_club_board(p_club_id)
            or exists (select 1 from team_members tm
                        where tm.team_id = t.id and tm.member_id = v_member))
  ),
  sized as (
    select r.id, r.name,
           (select count(*)::int from team_members tm where tm.team_id = r.id) as size
      from in_reach r
  ),
  past as (
    select s.id as team_id, e.id as event_id
      from sized s
      join events e on e.team_id = s.id
     where e.published_at is not null
       and e.cancelled_at is null
       and not e.is_sample
       and e.starts_at between now() - interval '90 days' and now()
  )
  select
    s.id, s.name, s.size,
    (s.size * (select count(*)::int from past p where p.team_id = s.id)),
    (select count(*)::int from past p
       join attendance a on a.event_id = p.event_id and a.shift_id is null
      where p.team_id = s.id),
    (select count(*)::int from past p
       join attendance a on a.event_id = p.event_id and a.shift_id is null
      where p.team_id = s.id and a.status = 'present')
    from sized s
   where s.size >= v_min
   order by s.name;
end;
$$;

create or replace function public.emergency_contact(p_member_id uuid)
returns table (emergency_name text, emergency_phone text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_member club_members;
begin
  select * into v_member from club_members where id = p_member_id;
  if not found then
    return;
  end if;

  if not (v_member.user_id = auth.uid() or can_follow_member(v_member.club_id, p_member_id)) then
    return;
  end if;

  return query
    select c.emergency_name, c.emergency_phone
      from member_contacts c
     where c.member_id = p_member_id;
end;
$$;

create or replace function public.training_streak(p_member_id uuid, p_today date default current_date)
returns int
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_member    club_members;
  v_week      date;
  v_streak    int := 0;
  v_present   boolean;
  v_scheduled boolean;
begin
  select * into v_member from club_members where id = p_member_id;
  if not found then
    return 0;
  end if;

  if auth.uid() is not null
     and v_member.user_id is distinct from auth.uid()
     and not can_follow_member(v_member.club_id, p_member_id) then
    return 0;
  end if;

  v_week := (date_trunc('week', p_today::timestamp) - interval '7 days')::date;

  for i in 1..52 loop
    select exists (
      select 1 from attendance a
        join events e on e.id = a.event_id
       where a.member_id = p_member_id
         and a.status = 'present'
         and e.type = 'training'
         and e.starts_at >= v_week and e.starts_at < v_week + 7
    ) into v_present;

    if v_present then
      v_streak := v_streak + 1;
    else
      select exists (
        select 1 from events e
         where e.club_id = v_member.club_id
           and e.type = 'training'
           and e.cancelled_at is null
           and not e.is_sample
           and e.starts_at >= v_week and e.starts_at < v_week + 7
           and (
             e.team_id is null
             or exists (select 1 from team_members tm
                         where tm.team_id = e.team_id and tm.member_id = p_member_id)
           )
      ) into v_scheduled;
      if v_scheduled then
        exit;
      end if;
    end if;

    v_week := v_week - 7;
  end loop;

  return v_streak;
end;
$$;


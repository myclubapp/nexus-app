-- ============================================================================
-- 0080_contribution_goal: Das Saisonziel für den Beitrag (UC-042)
--
-- Die bisherige myclub-App verlangte vier Helferpunkte je Saison und führte
-- dafür ein **zweites Konto** neben dem Punktesystem: `helferPunkte` am
-- Mitglied war das Soll, `totalPoints` das Ist, eine Schicht zählte meist 1,
-- der Zeitraum kam aus zwei Datumsfeldern am Verein. Zwei Konten, zwei Skalen,
-- zwei Zeiträume – die Quelle der Verwirrung.
--
-- Der MVP-Schnitt hat das Soll gestrichen (§2.1) und die Rangliste nach
-- Säule 3 an seine Stelle gesetzt. Diese Migration baut die dort genannte
-- **Ausbaustufe**: ein Saisonziel auf dem bestehenden Ledger, in derselben
-- Einheit wie jede andere Punktzahl, als zuschaltbares Modul mit Voreinstellung
-- «aus» (BR-199). Ein Verein, der nach dem MVP-Schnitt arbeitet, merkt davon
-- nichts.
--
-- Fünf Teile:
--   1. Der Punktwert einer übernommenen Schicht kommt aus ihrer Dauer (BR-204)
--   2. Was «Beitrag» heisst, steht einmal (BR-198)
--   3. Das Soll, zweistufig (BR-200)
--   4. Die Sichten: Vorstand sieht alle, Mitglied sieht sich (BR-201)
--   5. Dank bei Zielerreichung und ein namenloses Vorstands-Signal (BR-202)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Der Punktwert einer Schicht ist ihre Dauer (BR-204).
--
-- `upsert_legacy_event()` hat den Wert aus der alten App unverändert
-- übernommen. Beim ersten Verein waren das 96 von 105 Schichten mit dem Wert
-- **1** – während eine hier angelegte Schicht 25 bis 100 vergibt. Damit wäre
-- die verwirrende alte Zählweise im neuen Ledger gelandet, und ein halber Tag
-- hätte je nach Herkunft 1 oder 50 Punkte gebracht.
--
-- Ein fremder Wert ist keine Punktzahl dieser Skala. Die Dauer ist die
-- gemeinsame Grösse, die beide Systeme kennen.
--
-- **Gegenstück zu `suggestedShiftPoints()` in `app/src/lib/shift.ts`.** Laufen
-- die beiden auseinander, schlägt das Formular etwas anderes vor, als die
-- Übernahme bucht – dieselbe Gefahr wie bei `season_label()`/`seasonLabel()`.
-- ---------------------------------------------------------------------------
create or replace function public.suggested_shift_points(p_minutes int)
returns int
language sql
immutable
as $$
  select case
    when p_minutes is null or p_minutes <= 0 then 0
    when p_minutes <= 120 then 25   -- bis zwei Stunden
    when p_minutes <= 300 then 50   -- halber Tag
    else 100                        -- ganzer Tag
  end;
$$;

-- Rumpf wie `0075`; geändert ist nur die Herleitung des Punktwerts in der
-- Schichtschleife. Der Wert aus der alten App wird nicht mehr gelesen.
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

  -- BR-188: Der Ersatzsatz gilt den Aufrufen, für die BR-036 ein Warum
  -- verlangt. Ein Training bleibt ohne Beschreibung einfach ohne Warum.
  v_why := nullif(left(trim(coalesce(p_why, '')), 500), '');
  if v_why is null and p_type in ('social', 'helper') then
    v_why := 'Aus der bisherigen myclub-App übernommen';
  end if;

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
      -- BR-204: der Punktwert kommt aus der **Dauer**, nicht aus dem Wert
      -- der alten App. Ein fremder Wert ist keine Punktzahl dieser Skala.
      suggested_shift_points((extract(epoch from (
        (v_shift->>'ends_at')::timestamptz - (v_shift->>'starts_at')::timestamptz
      )) / 60)::int),
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

revoke execute on function public.upsert_legacy_event(
  uuid, text, text, text, text, timestamptz, timestamptz, text, int, boolean, text, jsonb, uuid)
  from public, anon, authenticated;

-- Die schon übernommenen Schichten nachziehen. **Nur solche ohne Buchung** –
-- ein bestätigter Einsatz wird nicht nachträglich umbewertet (BR-052); dort
-- steht die Zahl bereits im Ledger, und der Ledger ist die Wahrheit.
update event_shifts s
   set points = suggested_shift_points(
         (extract(epoch from (s.ends_at - s.starts_at)) / 60)::int)
 where s.external_id is not null
   and s.point_rule_code = 'shift_done'
   and not exists (
     select 1 from point_transactions t
      where t.source_type = 'shift' and t.source_id = s.id);

-- ---------------------------------------------------------------------------
-- 2. Was «Beitrag» heisst, steht einmal (BR-198).
--
-- Säule 3 ist das freiwillige Engagement (Helfereinsatz, Fahrdienst,
-- Vorstandsarbeit), Säule 7 der Marktplatz (übernommene Aufgaben, Ämter).
-- Beides zusammen ist «wer trägt» – dieselbe Menge, die
-- `responsibility_concentration()` seit `0056` zählt.
--
-- Ohne diese Funktion stünde die Definition an vier Stellen: in der Übersicht
-- des Vorstands, in der Karte des Mitglieds, im Signal und in der
-- Verantwortungsverteilung. Vier Stellen laufen auseinander; dann rechnet der
-- Vorstand anders als das Mitglied.
-- ---------------------------------------------------------------------------
create or replace function public.contribution_pillars()
returns int[]
language sql
immutable
as $$
  select array[3, 7];
$$;

-- `responsibility_concentration()` auf dieselbe Quelle umstellen. **Die
-- Kennzahl ändert sich nicht**: Sie zählt weiterhin die *Anzahl* Buchungen je
-- Mitglied, nicht deren Summe. Ausgetauscht ist allein die Liste der Säulen.
create or replace function public.responsibility_concentration(p_club_id uuid)
returns table (
  contributors int,
  carriers     int,
  members      int,
  efforts      int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_season text;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand sieht die Verantwortungsverteilung';
  end if;

  v_season := season_label(p_club_id);

  return query
  with effort as (
    select t.member_id, count(*)::int as n
      from point_transactions t
      join point_rules r on r.club_id = t.club_id and r.code = t.rule_code
     where t.club_id = p_club_id
       and t.season = v_season
       and r.pillar = any (contribution_pillars())
     group by t.member_id
  ),
  ranked as (
    select n,
           sum(n) over (order by n desc, member_id) as running,
           sum(n) over () as total,
           row_number() over (order by n desc, member_id) as rank
      from effort
  )
  select
    (select count(*)::int from effort),
    coalesce((select min(rank)::int from ranked
               where running::numeric >= total * 0.8), 0),
    (select count(*)::int from club_members m
      where m.club_id = p_club_id and m.status = 'active'),
    coalesce((select sum(n)::int from effort), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Das Soll, zweistufig (BR-200).
--
-- Das Ziel des Vereins steht in `clubs.settings.goal.seasonPoints`; ein
-- abweichendes Ziel an der Mitgliedschaft. **Null ist ein gültiges Ziel** und
-- heisst «befreit» – nicht «nicht gesetzt». Ehrenmitglieder, Passivmitglieder
-- und wer ein Amt trägt, brauchen diesen Unterschied.
-- ---------------------------------------------------------------------------
alter table club_members
  add column if not exists season_goal_points int
    check (season_goal_points is null or season_goal_points >= 0);

comment on column club_members.season_goal_points is
  'UC-042 BR-200: abweichendes Saisonziel. NULL = Vereinsziel gilt, 0 = befreit.';

create or replace function public.contribution_goal(p_club_id uuid, p_member_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select m.season_goal_points from club_members m
      where m.id = p_member_id and m.club_id = p_club_id),
    nullif(((select c.settings from clubs c where c.id = p_club_id)
             -> 'goal' ->> 'seasonPoints'), '')::int
  );
$$;

-- Die Ampelstufe. **Eine** Definition, nicht je Sicht eine eigene: Die
-- Schwellen (voll, halb) sind aus der bisherigen App übernommen, und zwei
-- gleiche `case`-Ketten wären zwei Gelegenheiten, sie auseinanderlaufen zu
-- lassen – genau das Muster, das BR-198 für die Säulen ausschliesst.
create or replace function public.contribution_state(p_earned int, p_goal int)
returns text
language sql
immutable
as $fn$
  select case
    when p_goal is null              then 'unset'
    when p_goal = 0                  then 'exempt'
    when p_earned >= p_goal          then 'reached'
    when p_earned >= p_goal * 0.5    then 'onTrack'
    else 'open'
  end;
$fn$;

-- Die geleisteten Beitragspunkte einer Saison. Ohne Saison die laufende.
create or replace function public.contribution_points(
  p_club_id   uuid,
  p_member_id uuid,
  p_season    text default null
)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(t.points), 0)::int
    from point_transactions t
    join point_rules r on r.club_id = t.club_id and r.code = t.rule_code
   where t.club_id = p_club_id
     and t.member_id = p_member_id
     and t.season = coalesce(p_season, season_label(p_club_id))
     and r.pillar = any (contribution_pillars());
$$;

-- ---------------------------------------------------------------------------
-- 4. Die Sichten.
--
-- BR-201: Ist, Soll und Rückstand **fremder** Mitglieder sieht nur der
-- Vorstand. Das Mitglied sieht sich selbst. Eine Liste der Säumigen für die
-- Mitgliedschaft gibt es nicht – wer zurückliegt, bekommt Angebote, keine
-- Mahnung (V7, K3). Deshalb zwei Funktionen mit verschiedenen Prüfungen und
-- nicht eine mit einem Parameter.
-- ---------------------------------------------------------------------------
create or replace function public.contribution_overview(p_club_id uuid)
returns table (
  member_id   uuid,
  name        text,
  avatar_url  text,
  goal        int,
  earned      int,
  remaining   int,
  state       text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_season text;
begin
  -- NFR-039: serverseitig, nicht im Client gefiltert.
  if not is_club_board(p_club_id) then
    raise exception 'Nur der Vorstand sieht die Beiträge der Saison';
  end if;

  v_season := season_label(p_club_id);

  return query
  select
    m.id,
    m.display_name,
    m.avatar_url,
    g.goal,
    e.earned,
    -- Ohne Ziel keine Restzahl: Ein Rückstand ohne Massstab wäre eine
    -- erfundene Zahl.
    case when g.goal is null then null else greatest(g.goal - e.earned, 0) end,
    contribution_state(e.earned, g.goal)
  from club_members m
  cross join lateral (select contribution_goal(p_club_id, m.id) as goal) g
  cross join lateral (select contribution_points(p_club_id, m.id, v_season) as earned) e
  where m.club_id = p_club_id
    and m.status = 'active'
  -- Wer am weitesten zurückliegt, steht zuoberst: Die Liste ist zum Handeln
  -- da, nicht zum Nachschlagen.
  order by
    case when g.goal is null or g.goal = 0 then 1 else 0 end,
    case when g.goal is null or g.goal = 0 then 0
         else least(e.earned::numeric / nullif(g.goal, 0), 1) end,
    m.display_name;
end;
$$;

-- Der eigene Stand. Gibt nichts zurück, wenn das Modul aus ist oder kein Ziel
-- gilt – die Karte erscheint dann gar nicht (A2, A3, A7).
create or replace function public.my_contribution_goal(p_club_id uuid)
returns table (
  season    text,
  goal      int,
  earned    int,
  remaining int,
  state     text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid;
  v_goal   int;
  v_earned int;
  v_season text;
begin
  v_member := current_member_id(p_club_id);
  if v_member is null then
    return;
  end if;

  -- BR-199: ohne Modul kein Saisonziel. `module_enabled()` aus `0052` ist die
  -- eine Stelle, die das entscheidet.
  if not module_enabled(p_club_id, 'goal') then
    return;
  end if;

  v_goal := contribution_goal(p_club_id, v_member);
  if v_goal is null or v_goal = 0 then
    return;
  end if;

  v_season := season_label(p_club_id);
  v_earned := contribution_points(p_club_id, v_member, v_season);

  return query select
    v_season,
    v_goal,
    v_earned,
    greatest(v_goal - v_earned, 0),
    contribution_state(v_earned, v_goal);
end;
$$;

-- Das abweichende Ziel setzen (FR-159).
create or replace function public.set_contribution_goal(
  p_member_id uuid,
  p_goal      int
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
begin
  select club_id into v_club from club_members where id = p_member_id;
  if v_club is null then
    raise exception 'Mitglied nicht gefunden';
  end if;

  if not is_club_board(v_club) then
    raise exception 'Nur der Vorstand setzt das Saisonziel';
  end if;

  if p_goal is not null and p_goal < 0 then
    raise exception 'Ein Ziel unter null gibt es nicht';
  end if;

  update club_members set season_goal_points = p_goal where id = p_member_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5a. Dank bei Zielerreichung (A5).
--
-- Ein Trigger und nicht drei Ergänzungen in `award_points()`, `confirm_shift()`
-- und `confirm_task()`: Die Frage «ist das Ziel jetzt erreicht?» hängt an der
-- Buchung, nicht am Weg dorthin. Drei Stellen wären drei Gelegenheiten, eine
-- zu vergessen.
--
-- Die Nachricht nennt den Beitrag und dankt; sie vergleicht nicht mit anderen
-- (BR-201) und nennt keinen Rang.
-- ---------------------------------------------------------------------------
create or replace function public.contribution_goal_reached()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_goal   int;
  v_before int;
  v_pillar int;
  v_user   uuid;
begin
  if not module_enabled(new.club_id, 'goal') then
    return new;
  end if;

  select r.pillar into v_pillar
    from point_rules r
   where r.club_id = new.club_id and r.code = new.rule_code;

  if v_pillar is null or not (v_pillar = any (contribution_pillars())) then
    return new;
  end if;

  v_goal := contribution_goal(new.club_id, new.member_id);
  if v_goal is null or v_goal = 0 then
    return new;
  end if;

  -- Der Stand **vor** dieser Buchung. Ohne den Vergleich käme der Dank bei
  -- jeder weiteren Buchung erneut.
  v_before := contribution_points(new.club_id, new.member_id, new.season) - new.points;

  if v_before >= v_goal or v_before + new.points < v_goal then
    return new;
  end if;

  select user_id into v_user from club_members where id = new.member_id;
  if v_user is not null then
    perform notify(
      v_user,
      'points',
      'Saisonziel erreicht',
      'Dein Beitrag für diese Saison ist beisammen. Danke dafür.',
      '/tabs/profile',
      new.club_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists contribution_goal_reached_trg on point_transactions;
create trigger contribution_goal_reached_trg
  after insert on point_transactions
  for each row execute function contribution_goal_reached();

-- ---------------------------------------------------------------------------
-- 5b. Das Vorstands-Signal (FR-162, BR-202).
--
-- Es **zählt und fragt**, es führt keine Namen auf. Die Namen stehen in der
-- Übersicht, die ohnehin nur der Vorstand sieht; das Signal wäre sonst ein
-- zweiter Weg zu derselben Person – und der erste, der ohne Anlass kommt.
--
-- Die Frist steht als Schwelle neben den übrigen (`health_definitions()`),
-- damit ein Verein sie wie jede andere verschieben kann.
-- ---------------------------------------------------------------------------
alter table health_signals drop constraint if exists health_signals_signal_type_check;
alter table health_signals add constraint health_signals_signal_type_check
  check (signal_type in (
    'attendance_drop','streak_broken','silent_churn','no_response',
    'invoice_overdue','comms_pause','connection_ratio',
    'inputs_unanswered','succession_gap','contribution_gap'));

alter table health_alert_routing drop constraint if exists health_alert_routing_signal_type_check;
alter table health_alert_routing add constraint health_alert_routing_signal_type_check
  check (signal_type in (
    'attendance_drop','streak_broken','silent_churn','no_response',
    'invoice_overdue','comms_pause','connection_ratio',
    'inputs_unanswered','succession_gap','contribution_gap'));

create or replace function public.health_definitions(p_club_id uuid)
returns table (key text, value numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_club_trainer(p_club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand sehen die Definitionen';
  end if;

  return query
  select d.key, health_threshold(p_club_id, d.key, d.fallback)
    from (values
      ('activeDays',       60::numeric),
      ('silentDays',       60),
      ('noResponseEvents',  3),
      ('attendanceDropFrom', 0.7),
      ('attendanceDropTo',   0.5),
      ('longTenureYears',    3),
      ('minGroup',           5),
      -- UC-042: Wochen vor Saisonende, ab denen fehlende Beiträge auffallen.
      ('contributionGapWeeks', 8)
    ) as d(key, fallback);
end;
$$;

-- Das Ende der laufenden Saison. Gegenstück zu `season_label()`: Wer die
-- Saison benennt, muss auch sagen, wann sie endet – sonst rechnet das Signal
-- mit einem Kalenderjahr, während die Rangliste eine Saison zeigt.
create or replace function public.season_end(p_club_id uuid, p_at timestamptz default now())
returns date
language plpgsql
stable
as $$
declare
  v_start date;
  v_first int;
begin
  select season_start into v_start from clubs where id = p_club_id;

  if v_start is null then
    return make_date(extract(year from p_at)::int, 12, 31);
  end if;

  v_first := extract(year from p_at)::int;
  if (extract(month from p_at), extract(day from p_at))
     < (extract(month from v_start), extract(day from v_start)) then
    v_first := v_first - 1;
  end if;

  -- Der Tag vor dem nächsten Saisonstart – gerechnet aus dem **Startdatum
  -- selbst** plus ganzen Jahren, nicht über `make_date(jahr, monat, tag)`.
  -- Beginnt die Saison am 29. Februar, wirft `make_date` in jedem
  -- Nicht-Schaltjahr «date field value out of range» und risse den Detektor
  -- mit; die Addition eines Jahres-Intervalls rechnet still auf den
  -- 28. Februar herunter.
  return ((v_start
           + make_interval(years => v_first + 1 - extract(year from v_start)::int))::date
          - 1);
end;
$$;

create or replace function public.detect_contribution_gaps(p_club_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club   record;
  v_count  int := 0;
  v_weeks  numeric;
  v_left   int;
  v_open   int;
begin
  for v_club in
    select c.id from clubs c
     where (p_club_id is null or c.id = p_club_id)
  loop
    -- BR-199: ohne Modul kein Signal.
    if not module_enabled(v_club.id, 'goal') then
      continue;
    end if;

    v_weeks := health_threshold(v_club.id, 'contributionGapWeeks', 8);
    v_left  := (season_end(v_club.id) - current_date);

    -- Nur im Fenster vor dem Saisonende. Davor ist ein fehlender Beitrag kein
    -- Befund, sondern der normale Anfang einer Saison.
    if v_left < 0 or v_left > v_weeks * 7 then
      continue;
    end if;

    select count(*)::int into v_open
      from club_members m
     where m.club_id = v_club.id
       and m.status = 'active'
       and coalesce(contribution_goal(v_club.id, m.id), 0) > 0
       and contribution_points(v_club.id, m.id) = 0;

    if v_open = 0 then
      continue;
    end if;

    -- BR-202: die **Zahl**, keine Namen. Nur die Zahl und nicht zusätzlich
    -- die Wochen: Das Signal entsteht ohnehin nur im Fenster vor dem
    -- Saisonende, und ein zusammengesetztes `detail` («12:5») müsste die
    -- Anzeige auseinandernehmen – dieselbe Zahl, zwei Lesarten.
    insert into health_signals
      (club_id, member_id, team_id, signal_type, severity, detail)
    values
      (v_club.id, null, null, 'contribution_gap', 'info', v_open::text)
    on conflict do nothing;

    if found then
      v_count := v_count + 1;
      perform notify_signal_owners(
        (select id from health_signals
          where club_id = v_club.id and signal_type = 'contribution_gap'));
    end if;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte.
--
-- Eine neue `security definer`-Funktion ist sofort ein offener Endpunkt:
-- Postgres vergibt `execute` an PUBLIC, Supabase zusätzlich an `anon` und
-- `authenticated` (CLAUDE.md, Vorlage `0007`). Die Lesefunktionen prüfen ihre
-- Reichweite selbst und dürfen von Angemeldeten aufgerufen werden; die
-- Rechenhilfen und der Detektor nicht.
-- ---------------------------------------------------------------------------
revoke execute on function public.contribution_goal(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.contribution_points(uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.contribution_goal_reached()
  from public, anon, authenticated;
revoke execute on function public.detect_contribution_gaps(uuid)
  from public, anon, authenticated;

revoke execute on function public.contribution_overview(uuid) from public, anon;
grant  execute on function public.contribution_overview(uuid) to authenticated;

revoke execute on function public.my_contribution_goal(uuid) from public, anon;
grant  execute on function public.my_contribution_goal(uuid) to authenticated;

revoke execute on function public.set_contribution_goal(uuid, int) from public, anon;
grant  execute on function public.set_contribution_goal(uuid, int) to authenticated;

revoke execute on function public.season_end(uuid, timestamptz) from public, anon;
grant  execute on function public.season_end(uuid, timestamptz) to authenticated;

revoke execute on function public.suggested_shift_points(int) from public, anon;
grant  execute on function public.suggested_shift_points(int) to authenticated;

revoke execute on function public.contribution_pillars() from public, anon;
grant  execute on function public.contribution_pillars() to authenticated;

revoke execute on function public.contribution_state(int, int) from public, anon;
grant  execute on function public.contribution_state(int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Auftrag: einmal pro Woche, montags früh – neben den Nachfolge-Lücken.
-- ---------------------------------------------------------------------------
select cron.unschedule('contribution-gaps')
 where exists (select 1 from cron.job where jobname = 'contribution-gaps');
select cron.schedule('contribution-gaps', '40 5 * * 1',
  $cron$select public.detect_contribution_gaps();$cron$);

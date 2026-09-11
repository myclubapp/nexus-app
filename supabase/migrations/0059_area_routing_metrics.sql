-- ============================================================================
-- 0059_area_routing_metrics: Bereichsrolle, Hinweis-Routing, zwei Kennzahlen
--
-- Vier Befunde aus der Prüfung gegen `docs/vision.md`, in einer Migration,
-- weil sie dieselben Funktionen berühren:
--
--   1. **Sportchef:in** (Vision §4, FR-063, offener Punkt 1 des Katalogs).
--      Die Rolle führt einen **Bereich** – mehrere Teams, nicht den Verein.
--      Ein Bereich ist ein Wort an Team und Person (`area`); wer keins trägt,
--      führt alle Teams. Kein eigenes Objekt: Ein Bereich, den man verwalten
--      müsste, wäre die Struktur, die K7 gerade nicht verlangt.
--   2. **Rollenbasiertes Routing** (FR-063): je Signaltyp, welche Rollen den
--      Hinweis erhalten. `HEALTH_ALERT_ROUTING` stand im Entitätsmodell und
--      nirgends sonst. Ohne Eintrag gilt die bisherige Zustellung – ein
--      Verein, der nichts einstellt, verliert nichts.
--   3. **90-Tage-Aktivierung** und **Silent-Churn-Erkennung** (Vision §12).
--      Beide sind Erfolgsdefinitionen der Plattform und fehlten in
--      `club_health()`.
--   4. **Ein Team löschen** braucht einen Riegel: `events.team_id` kaskadiert,
--      und ein Vorstand, der ein Team entfernt, will nicht dessen Termine
--      mitlöschen.
--
-- Dazu, klein: Säule 5 bekommt ihre Quelle (die Einladung), Säule 2 ihre
-- Regel (aus).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Die Bereichsrolle.
-- ---------------------------------------------------------------------------
alter table club_members drop constraint if exists club_members_role_check;
alter table club_members add constraint club_members_role_check
  check (role in ('member','trainer','sportchef','admin','superadmin'));

-- Der Bereich: ein Wort, frei gewählt («Aktive», «Junioren», «Breitensport»).
-- Ein Team ohne Bereich gehört zu keinem; eine Sportchef:in ohne Bereich
-- führt alle.
alter table teams        add column if not exists area text
  check (area is null or length(trim(area)) between 1 and 40);
alter table club_members add column if not exists area text
  check (area is null or length(trim(area)) between 1 and 40);

-- Trainer-Rechte gelten auch für die Bereichsrolle: Sie plant für ihre Teams.
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
      and role in ('trainer','sportchef','admin','superadmin')
      and status <> 'left'
  );
$$;

-- ---------------------------------------------------------------------------
-- Reichweite eines Hinweises (BR-096), jetzt mit Bereich.
--
-- Vorstand: der Verein. Sportchef:in: die Teams ihres Bereichs – und ein
-- Personensignal, wenn die Person in einem davon ist. Trainer:in: das eigene
-- Team. Wortgleich zu `0040`, plus der mittlere Zweig.
-- ---------------------------------------------------------------------------
create or replace function public.area_covers_team(p_member_id uuid, p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from club_members me
      left join teams t on t.id = p_team_id
     where me.id = p_member_id
       and me.role = 'sportchef'
       and (me.area is null or (t.area is not null and lower(t.area) = lower(me.area)))
  );
$$;

create or replace function public.health_signal_in_reach(p_signal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from health_signals s
     where s.id = p_signal_id
       and (
         is_club_admin(s.club_id)
         or (
           is_club_trainer(s.club_id)
           and (
             -- Team-Signal: eigenes Team oder Team im eigenen Bereich.
             exists (
               select 1 from team_members tm
                where tm.team_id = s.team_id
                  and tm.member_id = current_member_id(s.club_id)
             )
             or (s.team_id is not null
                 and area_covers_team(current_member_id(s.club_id), s.team_id))
             -- Personensignal: die Person ist in einem meiner Teams …
             or (
               s.member_id is not null
               and exists (
                 select 1
                   from team_members mine
                   join team_members theirs on theirs.team_id = mine.team_id
                  where mine.member_id = current_member_id(s.club_id)
                    and theirs.member_id = s.member_id
               )
             )
             -- … oder in einem Team meines Bereichs.
             or (
               s.member_id is not null
               and exists (
                 select 1 from team_members theirs
                  where theirs.member_id = s.member_id
                    and area_covers_team(current_member_id(s.club_id), theirs.team_id)
               )
             )
           )
         )
       )
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Das Routing je Signaltyp (FR-063).
-- ---------------------------------------------------------------------------
create table if not exists health_alert_routing (
  club_id        uuid not null references clubs(id) on delete cascade,
  signal_type    text not null check (signal_type in (
                   'attendance_drop','streak_broken','silent_churn','no_response',
                   'invoice_overdue','comms_pause','connection_ratio',
                   'inputs_unanswered','succession_gap')),
  recipient_role text not null check (recipient_role in ('trainer','sportchef','admin')),
  primary key (club_id, signal_type, recipient_role)
);

alter table health_alert_routing enable row level security;

drop policy if exists health_alert_routing_read on health_alert_routing;
create policy health_alert_routing_read on health_alert_routing
  for select using (is_club_trainer(club_id));

-- Geschrieben wird über die Funktion: Ein Routing, das jemand anders setzt,
-- wäre die Zustellung von Fürsorge-Hinweisen an Unzuständige.
create or replace function public.set_health_routing(
  p_club_id     uuid,
  p_signal_type text,
  p_roles       text[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand legt fest, wer Hinweise erhält';
  end if;

  delete from health_alert_routing
   where club_id = p_club_id and signal_type = p_signal_type;

  -- Eine leere Liste heisst «zurück auf die Vorgabe», nicht «an niemanden»:
  -- Ein Hinweis ohne Empfänger:in wäre das Versanden, das BR-128 ausschliesst.
  foreach v_role in array coalesce(p_roles, '{}'::text[]) loop
    insert into health_alert_routing (club_id, signal_type, recipient_role)
    values (p_club_id, p_signal_type, v_role)
    on conflict do nothing;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Zustellung mit Routing.
--
-- Ohne Eintrag: wie bisher – Vereinssignale an den Vorstand, Personensignale
-- an die Trainer:innen der Person und den Vorstand. Mit Einträgen: genau die
-- genannten Rollen, jede in ihrer Reichweite. Die **Reichweite** bleibt
-- BR-096, das Routing sagt nur, wer eine Meldung bekommt.
-- ---------------------------------------------------------------------------
create or replace function public.notify_signal_owners(p_signal_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_signal health_signals;
  v_person record;
  v_count  int := 0;
  v_routed boolean;
begin
  select * into v_signal from health_signals where id = p_signal_id;
  if not found then
    return 0;
  end if;

  v_routed := exists (select 1 from health_alert_routing
                       where club_id = v_signal.club_id
                         and signal_type = v_signal.signal_type);

  for v_person in
    select distinct m.user_id
      from club_members m
     where m.club_id = v_signal.club_id
       and m.status <> 'left'
       and m.user_id is not null
       and m.id is distinct from v_signal.member_id
       and (
         -- Vorstand: bei Vereinssignalen immer, bei Personensignalen wie bisher
         -- – es sei denn, das Routing nimmt ihn heraus.
         (m.role in ('admin','superadmin')
          and (not v_routed or exists (
                select 1 from health_alert_routing r
                 where r.club_id = v_signal.club_id
                   and r.signal_type = v_signal.signal_type
                   and r.recipient_role = 'admin')))
         -- Trainer:in: Personensignal einer Person aus dem eigenen Team.
         or (m.role = 'trainer'
             and v_signal.member_id is not null
             and (not v_routed or exists (
                   select 1 from health_alert_routing r
                    where r.club_id = v_signal.club_id
                      and r.signal_type = v_signal.signal_type
                      and r.recipient_role = 'trainer'))
             and exists (
               select 1
                 from team_members mine
                 join team_members theirs on theirs.team_id = mine.team_id
                where mine.member_id = m.id
                  and theirs.member_id = v_signal.member_id))
         -- Sportchef:in: nur, wenn das Routing sie nennt – ihr Bereich.
         or (m.role = 'sportchef'
             and v_routed
             and exists (
               select 1 from health_alert_routing r
                where r.club_id = v_signal.club_id
                  and r.signal_type = v_signal.signal_type
                  and r.recipient_role = 'sportchef')
             and (
               (v_signal.team_id is not null and area_covers_team(m.id, v_signal.team_id))
               or (v_signal.member_id is not null and exists (
                     select 1 from team_members theirs
                      where theirs.member_id = v_signal.member_id
                        and area_covers_team(m.id, theirs.team_id)))
               or (v_signal.member_id is null and v_signal.team_id is null and m.area is null)
             ))
       )
  loop
    -- Der Text nennt keinen Namen: Eine Push-Nachricht landet auf einem
    -- Sperrbildschirm, den auch andere sehen (NFR-022).
    perform notify(
      v_person.user_id, 'health', 'Ein Hinweis wartet auf dich',
      null, '/tabs/profile/health', v_signal.club_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Silent-Churn-Erkennung (Vision §12): ein anonymer Zähler.
--
-- «Anteil der Austritte, die vorher als Signal erschienen sind.» Gezählt wird
-- beim Austritt, je Saison, **ohne Personenbezug** – die Zeile trägt zwei
-- Zahlen und keinen Namen (BR-097). Gelöste Hinweise sind physisch weg; der
-- Zähler sieht also, was beim Austritt **noch offen** war. Das untertreibt
-- eher, und das ist die richtige Richtung.
-- ---------------------------------------------------------------------------
create table if not exists club_churn_stats (
  club_id         uuid not null references clubs(id) on delete cascade,
  season          text not null,
  left_count      int  not null default 0,
  signalled_count int  not null default 0,
  primary key (club_id, season)
);

alter table club_churn_stats enable row level security;
drop policy if exists club_churn_stats_read on club_churn_stats;
create policy club_churn_stats_read on club_churn_stats
  for select using (is_club_admin(club_id));

create or replace function public.count_churn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_signalled boolean;
begin
  if new.status = 'left' and old.status <> 'left' then
    v_signalled := exists (
      select 1 from health_signals s
       where s.member_id = new.id
         and s.detected_at > now() - interval '90 days');

    insert into club_churn_stats (club_id, season, left_count, signalled_count)
    values (new.club_id, season_label(new.club_id), 1, case when v_signalled then 1 else 0 end)
    on conflict (club_id, season) do update
      set left_count      = club_churn_stats.left_count + 1,
          signalled_count = club_churn_stats.signalled_count
                            + case when v_signalled then 1 else 0 end;
  end if;
  return new;
end;
$$;

drop trigger if exists club_members_count_churn on club_members;
create trigger club_members_count_churn
  after update of status on club_members
  for each row execute function count_churn();

-- ---------------------------------------------------------------------------
-- `club_health()` mit den beiden Erfolgskennzahlen aus Vision §12.
--
-- **90-Tage-Aktivierung**: Anteil der Neumitglieder mit mindestens drei
-- Teilnahmen in den ersten 90 Tagen. Gezählt werden nur Mitglieder, deren
-- 90 Tage **vorbei** sind – wer vor drei Wochen kam, ist noch keine Zahl.
-- Zeitraum: Beitritte des letzten Jahres.
-- ---------------------------------------------------------------------------
drop function if exists public.club_health(uuid);

create or replace function public.club_health(p_club_id uuid)
returns table (
  members              int,
  activated            int,
  prev_activated       int,
  active               int,
  active_days          int,
  newcomers            int,
  newcomers_activated  int,
  left_count           int,
  left_signalled       int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_season      text;
  v_prev_season text;
  v_days        int;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand sieht die Vereins-Übersicht';
  end if;

  v_season      := season_label(p_club_id);
  v_prev_season := season_label(p_club_id, now() - interval '1 year');
  v_days        := health_threshold(p_club_id, 'activeDays', 60)::int;

  return query
  select
    (select count(*)::int from club_members m
      where m.club_id = p_club_id and m.status = 'active'),

    (select count(distinct t.member_id)::int from point_transactions t
      join club_members m on m.id = t.member_id and m.status = 'active'
     where t.club_id = p_club_id and t.season = v_season),

    (select count(distinct t.member_id)::int from point_transactions t
      where t.club_id = p_club_id and t.season = v_prev_season),

    (select count(*)::int from club_members m
      where m.club_id = p_club_id and m.status = 'active'
        and (
          exists (select 1 from point_transactions t
                   where t.member_id = m.id
                     and t.created_at > now() - make_interval(days => v_days))
          or exists (select 1 from attendance a
                      join events e on e.id = a.event_id
                     where a.member_id = m.id
                       and e.starts_at > now() - make_interval(days => v_days))
        )),

    v_days,

    (select count(*)::int from club_members m
      where m.club_id = p_club_id
        and m.member_since between current_date - 365 and current_date - 90),

    (select count(*)::int from club_members m
      where m.club_id = p_club_id
        and m.member_since between current_date - 365 and current_date - 90
        and (select count(*) from attendance a
               join events e on e.id = a.event_id
              where a.member_id = m.id
                and a.status = 'present'
                and e.starts_at::date between m.member_since and m.member_since + 90) >= 3),

    (select coalesce(sum(c.left_count), 0)::int from club_churn_stats c
      where c.club_id = p_club_id and c.season = v_season),

    (select coalesce(sum(c.signalled_count), 0)::int from club_churn_stats c
      where c.club_id = p_club_id and c.season = v_season);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Ein Team löschen – mit Riegel.
--
-- `events.team_id` und `news.team_id` kaskadieren. Ein Team mit Terminen,
-- Aufgaben oder News zu löschen hiesse, Vergangenheit zu löschen; der Riegel
-- sagt, was noch dranhängt. Die Mitgliedschaften im Team fallen weg – das
-- ist der Sinn des Löschens.
-- ---------------------------------------------------------------------------
create or replace function public.delete_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team teams;
  v_events int; v_tasks int; v_news int;
begin
  select * into v_team from teams where id = p_team_id;
  if not found then
    raise exception 'Team nicht gefunden';
  end if;
  if not is_club_admin(v_team.club_id) then
    raise exception 'Nur der Vorstand löscht Teams';
  end if;

  select count(*) into v_events from events where team_id = p_team_id;
  select count(*) into v_tasks  from tasks  where team_id = p_team_id;
  select count(*) into v_news   from news   where team_id = p_team_id;

  if v_events + v_tasks + v_news > 0 then
    raise exception 'Dieses Team hat noch % Termine, % Aufgaben und % News – löse sie zuerst vom Team',
      v_events, v_tasks, v_news;
  end if;

  delete from team_members where team_id = p_team_id;
  delete from teams where id = p_team_id;
end;
$$;

-- Bestehende Vereine bekommen die beiden neuen Regeln ebenfalls.
insert into point_rules (club_id, pillar, code, label, points, is_active, meta)
select c.id, 5, 'member_referred', 'Mitglied geworben', 50, true, '{}'::jsonb
  from clubs c
 where not exists (select 1 from point_rules r where r.club_id = c.id and r.code = 'member_referred');
insert into point_rules (club_id, pillar, code, label, points, is_active, meta)
select c.id, 2, 'substitute_ready', 'Ersatzbereitschaft', 15, false, '{}'::jsonb
  from clubs c
 where not exists (select 1 from point_rules r where r.club_id = c.id and r.code = 'substitute_ready');

-- ---------------------------------------------------------------------------
-- Rechte.
-- ---------------------------------------------------------------------------
revoke execute on function public.area_covers_team(uuid, uuid) from public, anon;
grant  execute on function public.area_covers_team(uuid, uuid) to authenticated;

revoke execute on function public.set_health_routing(uuid, text, text[]) from public, anon;
grant  execute on function public.set_health_routing(uuid, text, text[]) to authenticated;

revoke execute on function public.count_churn() from public, anon, authenticated;

revoke execute on function public.club_health(uuid) from public, anon;
grant  execute on function public.club_health(uuid) to authenticated;

revoke execute on function public.delete_team(uuid) from public, anon;
grant  execute on function public.delete_team(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Säule 5 und die Vorgabe-Regeln (Rümpfe aus 0009 und 0017, ergänzt).
-- ---------------------------------------------------------------------------
create or replace function public.redeem_invite(
  p_code         text,
  p_display_name text default null
)
returns uuid -- die id des Vereins, dem die Person nun angehört
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
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- `for update` serialisiert gleichzeitige Einlösungen: ohne die Sperre
  -- kämen bei der letzten freien Einlösung zwei Personen durch.
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
  -- A3/BR-008: Eine bestehende Mitgliedschaft bleibt unverändert. Eine erneut
  -- eingelöste Einladung hebt insbesondere keine Rolle an.

  -- A4: Die Team-Zuordnung wird auch dann ergänzt, wenn die Mitgliedschaft
  -- schon bestand.
  if v_invite.team_id is not null then
    insert into team_members (team_id, member_id)
    values (v_invite.team_id, v_member_id)
    on conflict do nothing;
  end if;

  -- Säule 5 (Vision §7): «geworbene Mitglieder». Die Quelle ist die
  -- Einladung selbst – wer sie erstellt hat, hat geworben. Nur beim ersten
  -- Beitritt, nie beim erneuten Einlösen, und nie für sich selbst. Fehlt die
  -- Regel oder ist sie aus, gibt `award_points()` 0 zurück; der Ledger
  -- dedupliziert über die Einladung als Quelle.
  if v_is_new and v_invite.created_by is not null
     and v_invite.created_by <> v_member_id then
    perform award_points(v_invite.created_by, 'member_referred', 'invite', v_invite.id);
  end if;

  update invites set uses = uses + 1 where id = v_invite.id;

  return v_invite.club_id;
end;
$$;

create or replace function public.seed_point_rules(p_club_id uuid, p_club_kind text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_club_kind = 'music' then
    insert into point_rules (club_id, pillar, code, label, points, meta) values
      (p_club_id, 1, 'training_attend', 'Probe besucht',            10, '{"max_per_week": 3}'),
      (p_club_id, 2, 'match_attend',    'Auftritt oder Konzert',    25, '{}'),
      (p_club_id, 4, 'event_attend',    'Vereinsanlass besucht',    15, '{}');
  elsif p_club_kind = 'neighborhood' then
    insert into point_rules (club_id, pillar, code, label, points, meta) values
      (p_club_id, 1, 'training_attend', 'Treffen besucht',          10, '{"max_per_week": 3}'),
      (p_club_id, 4, 'event_attend',    'Anlass besucht',           15, '{}');
  else
    insert into point_rules (club_id, pillar, code, label, points, meta) values
      (p_club_id, 1, 'training_attend', 'Training besucht',         10, '{"max_per_week": 4}'),
      (p_club_id, 2, 'match_attend',    'Spiel bestritten',         25, '{}'),
      (p_club_id, 4, 'event_attend',    'Vereinsanlass besucht',    15, '{}');
  end if;

  insert into point_rules (club_id, pillar, code, label, points, meta) values
    (p_club_id, 3, 'shift_done',      'Helfereinsatz geleistet',    50, '{}'),
    (p_club_id, 4, 'assembly_attend', 'Versammlung besucht',        30, '{}'),
    (p_club_id, 5, 'loyalty_year',    'Ein weiteres Vereinsjahr',  100, '{}'),
    (p_club_id, 6, 'invoice_on_time', 'Rechnung pünktlich bezahlt', 40, '{}'),
    -- UC-010 A1: Wer rechtzeitig absagt, macht die Planung möglich.
    (p_club_id, 6, 'decline_early',   'Rechtzeitig abgemeldet',      5, '{}'),
    (p_club_id, 7, 'task_done',       'Aufgabe erledigt',           20, '{}');

  -- Vision §7, Säule 5: geworbene Mitglieder. Die Quelle ist die Einladung
  -- (`redeem_invite()` seit `0059`).
  -- Vision §7, Säule 2: Ersatzbereitschaft. Es gibt noch keine Datenquelle –
  -- die Regel steht deshalb **aus**, damit der Verein sie von Hand buchen
  -- kann (UC-021), ohne dass sie irgendwo als Versprechen erscheint.
  insert into point_rules (club_id, pillar, code, label, points, is_active, meta) values
    (p_club_id, 5, 'member_referred',  'Mitglied geworben',   50, true,  '{}'),
    (p_club_id, 2, 'substitute_ready', 'Ersatzbereitschaft',  15, false, '{}');
end;
$$;

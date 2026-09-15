-- ============================================================================
-- 0093_finance_dimension: «Finanzen» bekommt endlich seine Quelle (UC-024,
-- UC-036, BR-209)
--
-- Der Befund: Die Dimension «Finanzen» stand seit `0042` dauerhaft auf «nicht
-- erhoben» – nicht, weil nichts gebucht würde, sondern weil die Regel
-- `invoice_on_time` («Rechnung pünktlich bezahlt», 40 Punkte, seit `0005`) in
-- **Säule 6** liegt und Säule 6 auf `loyalty` abbildet. Pünktliches Zahlen
-- zählte damit zur Treue, und die Achse «Finanzen» blieb leer, obwohl das
-- Rechnungsmodul seit `0054` bucht und seit UC-046/047 auch Rechnungen stellt.
--
-- Säule 6 heisst «Verlässlichkeit & Administration» und trägt zwei
-- verschiedene Dinge: das Antwortverhalten (`decline_early`) und die
-- Zahlungsmoral (`invoice_on_time`). Die Säule ist also gröber als die
-- Dimension.
--
-- Sandros Entscheid vom 15.09.2026: **Der Regelcode entscheidet, nicht die
-- Säule.** Keine achte Säule – «die sieben Säulen» stehen im Konzept und in
-- `check (pillar between 1 and 7)`; die Punktevergabe selbst ändert sich um
-- keinen Punkt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Die Dimension einer **Buchung**: erst die Ausnahme, dann die Säule.
--
-- `dimension_of_pillar()` bleibt, was es ist – die Dimension einer Säule.
-- Diese Funktion hier ist die feinere Frage, und sie ist ab jetzt die, die
-- zählt: Netzdiagramm, Ranglistenfilter und Auswahl lesen sie.
-- ---------------------------------------------------------------------------
create or replace function public.dimension_of_rule(
  p_pillar smallint,
  p_code   text
)
returns text
language sql
immutable
as $$
  select case
    -- Zahlungsmoral ist keine Verlässlichkeit: Sie gehört zu «Finanzen»,
    -- der einzigen Dimension ohne eigene Säule (BR-209).
    when p_code = 'invoice_on_time' then 'finance'
    else dimension_of_pillar(p_pillar)
  end;
$$;

revoke execute on function public.dimension_of_rule(smallint, text) from public, anon;
grant  execute on function public.dimension_of_rule(smallint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- value_dimensions aus `0073`, auf `dimension_of_rule()` umgestellt.
--
-- Zwei Stellen: die Buchungen selbst und die Frage, ob eine Dimension
-- überhaupt erhoben wird (A2). Führt der Verein `invoice_on_time` aktiv, ist
-- «Finanzen» ab sofort erhoben und zeigt einen Wert statt eines Worts.
-- ---------------------------------------------------------------------------
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
    select
      t.member_id,
      dimension_of_rule(coalesce(t.pillar, r.pillar)::smallint, t.rule_code) as dimension,
      sum(t.points)::int as points
    from point_transactions t
    left join point_rules r on r.club_id = t.club_id and r.code = t.rule_code
    where t.club_id = p_club_id
      and t.season = v_season
      and dimension_of_rule(coalesce(t.pillar, r.pillar)::smallint, t.rule_code) is not null
    group by 1, 2
  ),
  scale as (
    select dimension, greatest(max(points), 1) as top
      from per_member group by dimension
  ),
  dims as (
    select unnest(array['engagement','volunteering','finance','network','loyalty']) as dimension
  ),
  collected_dims as (
    select dimension_of_rule(r.pillar::smallint, r.code) as dimension
      from point_rules r
     where r.club_id = p_club_id and r.is_active
       and dimension_of_rule(r.pillar::smallint, r.code) is not null
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

-- ---------------------------------------------------------------------------
-- club_pillars aus `0092`: Eine Dimension kann jetzt ohne eigene Säule
-- bestehen.
--
-- «Finanzen» entsteht aus einer Regel innerhalb von Säule 6, nicht aus einer
-- Säule. In der Auswahl der Rangliste steht sie deshalb als Gruppe **ohne**
-- Säulenzeilen: wählbar als ganze Dimension, und ehrlich darüber, dass es
-- darunter nichts Feineres zu wählen gibt.
-- ---------------------------------------------------------------------------
drop function if exists public.club_pillars(uuid);

create or replace function public.club_pillars(p_club_id uuid)
returns table (pillar smallint, dimension text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with used as (
    select r.pillar::smallint as pillar
      from point_rules r
     where r.club_id = p_club_id
       and r.is_active
    union
    select coalesce(t.pillar, r.pillar)::smallint
      from point_transactions t
      left join point_rules r
        on r.club_id = t.club_id and r.code = t.rule_code
     where t.club_id = p_club_id
  ),
  -- Dimensionen, die dieser Verein bucht, ohne dass eine ganze Säule ihnen
  -- entspricht – heute genau «Finanzen».
  loose as (
    select distinct d.dimension
      from (
        select dimension_of_rule(r.pillar::smallint, r.code) as dimension
          from point_rules r
         where r.club_id = p_club_id and r.is_active
        union
        select dimension_of_rule(coalesce(t.pillar, r.pillar)::smallint, t.rule_code)
          from point_transactions t
          left join point_rules r
            on r.club_id = t.club_id and r.code = t.rule_code
         where t.club_id = p_club_id
      ) d
     where d.dimension is not null
       and not exists (
         select 1 from used u
          where u.pillar is not null
            and dimension_of_pillar(u.pillar) = d.dimension
       )
  )
  select u.pillar, dimension_of_pillar(u.pillar)
    from used u
   where u.pillar is not null
     and is_club_member(p_club_id)
  union all
  select null::smallint, l.dimension
    from loose l
   where is_club_member(p_club_id)
   order by 1 nulls last;
$$;

revoke execute on function public.club_pillars(uuid) from public, anon;
grant  execute on function public.club_pillars(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- leaderboard_rows und team_ranking_rows aus `0092`, ebenfalls auf
-- `dimension_of_rule()` umgestellt: Wer «Finanzen» wählt, sieht die
-- Zahlungspunkte – und wer «Treue» wählt, sieht sie **nicht** mehr mit.
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard_rows(
  p_club_id   uuid,
  p_team_id   uuid     default null,
  p_period    text     default 'season',
  p_pillar    smallint default null,
  p_limit     int      default 20,
  p_season    text     default null,
  p_dimension text     default null
)
returns table (
  member_id    uuid,
  display_name text,
  avatar_url   text,
  total_points int,
  rank         int,
  is_self      boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_self   uuid;
  v_since  timestamptz;
  v_season text;
  v_dim    text;
begin
  if not is_club_member(p_club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  v_self := current_member_id(p_club_id);
  v_season := coalesce(nullif(trim(p_season), ''), season_label(p_club_id));
  v_dim := nullif(trim(p_dimension), '');

  v_since := case p_period
               when 'week'  then now() - interval '7 days'
               when 'month' then now() - interval '30 days'
             end;

  return query
  with scored as (
    select
      m.id           as member_id,
      m.display_name,
      m.avatar_url,
      sum(t.points)::int as total_points
    from club_members m
    join point_transactions t on t.member_id = m.id
    left join point_rules r
      on r.club_id = t.club_id and r.code = t.rule_code
    where m.club_id = p_club_id
      and m.leaderboard_opt_in
      and m.status <> 'left'
      and t.club_id = p_club_id
      and (
        p_team_id is null
        or exists (
          select 1 from team_members tm
           where tm.member_id = m.id and tm.team_id = p_team_id
        )
      )
      and (p_pillar is null or coalesce(t.pillar, r.pillar) = p_pillar)
      and (
        v_dim is null
        or dimension_of_rule(coalesce(t.pillar, r.pillar)::smallint, t.rule_code) = v_dim
      )
      and (
        case
          when p_period = 'season' then t.season = v_season
          when v_since is not null  then t.created_at >= v_since
          else true
        end
      )
    group by m.id, m.display_name, m.avatar_url
  ),
  ranked as (
    select
      s.*,
      rank() over (order by s.total_points desc)::int as rank
    from scored s
  )
  select
    ranked.member_id,
    ranked.display_name,
    ranked.avatar_url,
    ranked.total_points,
    ranked.rank,
    ranked.member_id = v_self
  from ranked
  where ranked.rank <= greatest(coalesce(p_limit, 20), 1)
     or ranked.member_id = v_self
  order by ranked.rank, ranked.display_name;
end;
$$;

create or replace function public.team_ranking_rows(
  p_club_id   uuid,
  p_period    text     default 'season',
  p_pillar    smallint default null,
  p_season    text     default null,
  p_dimension text     default null
)
returns table (
  team_id      uuid,
  team_name    text,
  member_count int,
  total_points int,
  avg_points   numeric,
  rank         int,
  is_mine      boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_self   uuid;
  v_since  timestamptz;
  v_season text;
  v_dim    text;
begin
  if not is_club_member(p_club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  v_self := current_member_id(p_club_id);
  v_season := coalesce(nullif(trim(p_season), ''), season_label(p_club_id));
  v_dim := nullif(trim(p_dimension), '');

  v_since := case p_period
               when 'week'  then now() - interval '7 days'
               when 'month' then now() - interval '30 days'
             end;

  return query
  with visible as (
    select tm.team_id, m.id as member_id
      from team_members tm
      join club_members m on m.id = tm.member_id
     where m.club_id = p_club_id
       and m.status <> 'left'
       and m.leaderboard_opt_in
  ),
  scored as (
    select v.team_id,
           count(distinct v.member_id)::int   as member_count,
           coalesce(sum(t.points), 0)::int    as total_points
      from visible v
      left join point_transactions t
        on t.member_id = v.member_id
       and t.club_id = p_club_id
       and (
         p_pillar is null
         or coalesce(
              t.pillar,
              (select r.pillar from point_rules r
                where r.club_id = t.club_id and r.code = t.rule_code)
            ) = p_pillar
       )
       and (
         v_dim is null
         or dimension_of_rule(
              coalesce(
                t.pillar,
                (select r.pillar from point_rules r
                  where r.club_id = t.club_id and r.code = t.rule_code)
              )::smallint,
              t.rule_code
            ) = v_dim
       )
       and (
         case
           when p_period = 'season' then t.season = v_season
           when v_since is not null  then t.created_at >= v_since
           else true
         end
       )
     group by v.team_id
  ),
  ranked as (
    select tm.id                                          as team_id,
           tm.name                                        as team_name,
           s.member_count,
           s.total_points,
           round(s.total_points::numeric / s.member_count, 1) as avg_points,
           rank() over (order by s.total_points::numeric / s.member_count desc)::int as rank,
           exists (
             select 1 from team_members x
              where x.team_id = tm.id and x.member_id = v_self
           )                                              as is_mine
      from scored s
      join teams tm on tm.id = s.team_id
     where s.member_count >= 2
  )
  select r.team_id, r.team_name, r.member_count, r.total_points, r.avg_points, r.rank, r.is_mine
    from ranked r
   order by r.rank, r.team_name;
end;
$$;

revoke execute on function public.leaderboard_rows(uuid, uuid, text, smallint, int, text, text)
  from public, anon;
grant  execute on function public.leaderboard_rows(uuid, uuid, text, smallint, int, text, text)
  to authenticated;
revoke execute on function public.team_ranking_rows(uuid, text, smallint, text, text)
  from public, anon;
grant  execute on function public.team_ranking_rows(uuid, text, smallint, text, text)
  to authenticated;
revoke execute on function public.value_dimensions(uuid, uuid) from public, anon;
grant  execute on function public.value_dimensions(uuid, uuid) to authenticated;

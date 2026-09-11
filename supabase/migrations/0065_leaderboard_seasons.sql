-- ============================================================================
-- 0065_leaderboard_seasons: Saisonarchiv (Konzept §7.3)
--
-- «Saisonrangliste (wird am Ende der Saison archiviert)». Archiviert wird
-- nichts – die Buchungen tragen ihr Saison-Label (0002), und eine vergangene
-- Saison ist eine Abfrage mit einem anderen Label. Beide Ranglisten-Funktionen
-- bekommen dafür `p_season`; ohne Angabe gilt die laufende Saison wie bisher.
-- `club_seasons()` nennt, welche Saisons es zu wählen gibt.
-- ============================================================================

create or replace function public.club_seasons(p_club_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct t.season
    from point_transactions t
   where t.club_id = p_club_id
     and is_club_member(p_club_id)
   order by t.season desc;
$$;

revoke execute on function public.club_seasons(uuid) from public, anon;
grant  execute on function public.club_seasons(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- leaderboard_rows aus 0039, um `p_season` ergänzt. Die alte Signatur fällt,
-- damit PostgREST nicht zwischen zwei Überladungen raten muss.
-- ---------------------------------------------------------------------------
drop function if exists public.leaderboard_rows(uuid, uuid, text, smallint, int);

create or replace function public.leaderboard_rows(
  p_club_id uuid,
  p_team_id uuid     default null,
  p_period  text     default 'season',
  p_pillar  smallint default null,
  p_limit   int      default 20,
  p_season  text     default null
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
begin
  if not is_club_member(p_club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  v_self := current_member_id(p_club_id);
  v_season := coalesce(nullif(trim(p_season), ''), season_label(p_club_id));

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

revoke execute on function public.leaderboard_rows(uuid, uuid, text, smallint, int, text)
  from public, anon;
grant  execute on function public.leaderboard_rows(uuid, uuid, text, smallint, int, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- team_ranking_rows aus 0062, um `p_season` ergänzt.
-- ---------------------------------------------------------------------------
drop function if exists public.team_ranking_rows(uuid, text, smallint);

create or replace function public.team_ranking_rows(
  p_club_id uuid,
  p_period  text     default 'season',
  p_pillar  smallint default null,
  p_season  text     default null
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
begin
  if not is_club_member(p_club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  v_self := current_member_id(p_club_id);
  v_season := coalesce(nullif(trim(p_season), ''), season_label(p_club_id));

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

revoke execute on function public.team_ranking_rows(uuid, text, smallint, text) from public, anon;
grant  execute on function public.team_ranking_rows(uuid, text, smallint, text) to authenticated;

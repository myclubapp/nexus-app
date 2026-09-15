-- ============================================================================
-- 0092_leaderboard_dimension_filter: die Rangliste lernt das Vokabular der
-- Stärken (FR-048, UC-022)
--
-- Zwei Auswahllisten für dieselbe Sache: Die Rangliste filtert nach den sieben
-- Säulen, «Meine Stärken» zeigt die fünf Dimensionen – und nirgends im UI
-- steht, dass «Ehrenamt» aus Säule 3 und 7 besteht. Die Abbildung existiert
-- seit `0042` (`dimension_of_pillar`), aber nur der Server kennt sie.
--
-- Diese Migration bringt sie an die Oberfläche, ohne sie zu verdoppeln:
--
--   1. `club_pillars()` sagt dem Client, **welche** Säulen dieser Verein
--      überhaupt führt und **an welcher Dimension** sie hängen. Die App
--      gruppiert damit die Auswahl, ohne die Zuordnung selbst zu kennen.
--   2. `leaderboard_rows()` und `team_ranking_rows()` bekommen `p_dimension`.
--      Wer «Ehrenamt» wählt, sieht Säule 3 und 7 zusammen – gerechnet über
--      dieselbe Funktion, die auch das Netzdiagramm rechnet.
--
-- Die Säule bleibt einzeln wählbar: FR-048 ist ausdrücklich «Helferpunkte
-- Säule 3» als Ersatz fürs frühere Helfer-Reporting. «Ehrenamt» enthält
-- zusätzlich den Marktplatz und beantwortet diese Frage **nicht**.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Welche Säulen hat dieser Verein – und wohin gehören sie?
--
-- Zwei Quellen, weil beide Fälle vorkommen:
--   * aktive Regeln – was der Verein heute führt (dieselbe Lesart wie
--     `collected` in `0042`),
--   * vorhandene Buchungen – was er geführt **hat**. Ohne sie verschwände eine
--     abgeschaltete Säule aus der Auswahl, obwohl das Saisonarchiv (`0065`)
--     ihre Ränge noch zeigt.
--
-- Der Ledger ist seit `0037` nicht mehr fremdlesbar; die Liste der belegten
-- Säulen darf ein Mitglied kennen – wie die Liste der Saisons (`club_seasons`).
-- ---------------------------------------------------------------------------
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
  )
  select u.pillar, dimension_of_pillar(u.pillar)
    from used u
   where u.pillar is not null
     and is_club_member(p_club_id)
   order by u.pillar;
$$;

revoke execute on function public.club_pillars(uuid) from public, anon;
grant  execute on function public.club_pillars(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- leaderboard_rows aus `0065`, um `p_dimension` ergänzt.
--
-- Die alte Signatur fällt, damit PostgREST nicht zwischen zwei Überladungen
-- raten muss.
-- ---------------------------------------------------------------------------
drop function if exists public.leaderboard_rows(uuid, uuid, text, smallint, int, text);

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
      -- Die Dimension ist das Dach über den Säulen; gerechnet wird sie mit
      -- derselben Abbildung wie das Netzdiagramm (`0042`), nicht mit einer
      -- zweiten Liste im Client.
      and (
        v_dim is null
        or dimension_of_pillar(coalesce(t.pillar, r.pillar)::smallint) = v_dim
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

revoke execute on function public.leaderboard_rows(uuid, uuid, text, smallint, int, text, text)
  from public, anon;
grant  execute on function public.leaderboard_rows(uuid, uuid, text, smallint, int, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- team_ranking_rows aus `0065`, um `p_dimension` ergänzt.
-- ---------------------------------------------------------------------------
drop function if exists public.team_ranking_rows(uuid, text, smallint, text);

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
         or dimension_of_pillar(
              coalesce(
                t.pillar,
                (select r.pillar from point_rules r
                  where r.club_id = t.club_id and r.code = t.rule_code)
              )::smallint
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

revoke execute on function public.team_ranking_rows(uuid, text, smallint, text, text)
  from public, anon;
grant  execute on function public.team_ranking_rows(uuid, text, smallint, text, text)
  to authenticated;

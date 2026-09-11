-- ============================================================================
-- 0062_team_ranking: Team gegen Team (Konzept §7.3)
--
-- «Welches Team hat im Durchschnitt am meisten Punkte pro Mitglied?» – die
-- dritte Sicht der Rangliste neben Verein und eigenem Team. Sie fördert das
-- Wir-Gefühl, nicht den Einzelkampf (Konzept §1): Gezählt wird der
-- Durchschnitt, damit ein grosses Team nicht allein durch seine Grösse vorn
-- liegt.
--
-- Dieselben Regeln wie `leaderboard_rows()` (0039): Zeitraum rollend, Säule
-- über Buchung oder Regel, Opt-out zählt nicht mit (BR-091). Dazu eine
-- eigene: **Ein Team aus weniger als zwei sichtbaren Mitgliedern erscheint
-- nicht.** Eine Teamzeile mit einer Person wäre eine Personenzeile – und
-- könnte jemanden zeigen, der sich aus der Rangliste abgemeldet hat.
-- ============================================================================

create or replace function public.team_ranking_rows(
  p_club_id uuid,
  p_period  text     default 'season',
  p_pillar  smallint default null
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
  v_self  uuid;
  v_since timestamptz;
begin
  if not is_club_member(p_club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  v_self := current_member_id(p_club_id);

  v_since := case p_period
               when 'week'  then now() - interval '7 days'
               when 'month' then now() - interval '30 days'
             end;

  return query
  with visible as (
    -- Wer zählt: aktive Mitglieder mit Opt-in, je Team.
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
           when p_period = 'season' then t.season = season_label(p_club_id)
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

revoke execute on function public.team_ranking_rows(uuid, text, smallint) from public, anon;
grant  execute on function public.team_ranking_rows(uuid, text, smallint) to authenticated;

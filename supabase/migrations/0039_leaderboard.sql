-- ============================================================================
-- 0039_leaderboard: Rangliste mit Zeitraum, Säule und Team (UC-022)
--
-- Die Seite steht – und ihre wichtigste Hälfte funktionierte nicht. Die
-- Team-Rangliste war unerreichbar, weil die Seite die Team-Id nie übergab.
-- Dazu fehlten die beiden Achsen, die die Rangliste erst brauchbar machen:
-- der Zeitraum (FR-049 – ohne ihn sieht ein Neumitglied nie etwas anderes als
-- die Jahresbesten) und die Säule (FR-048 – die frühere Helfer-Auswertung ohne
-- eigenes Modul).
--
-- Und eine Regel, die bisher nirgends stand: **Die eigene Position ist immer
-- sichtbar** (BR-090), auch wenn sie ausserhalb des angezeigten Ausschnitts
-- liegt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Eine Definition der Rangfolge, nicht zwei.
--
-- Die Sicht `leaderboard` und diese Funktion wären zwei Beschreibungen
-- derselben Sache – genau die Art Doppelung, die in diesem Projekt schon
-- zweimal auseinandergelaufen ist. Die Sicht weicht.
-- ---------------------------------------------------------------------------
drop view if exists public.leaderboard;

create or replace function public.leaderboard_rows(
  p_club_id uuid,
  p_team_id uuid    default null,
  p_period  text    default 'season',
  p_pillar  smallint default null,
  p_limit   int     default 20
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
  v_self  uuid;
  v_since timestamptz;
begin
  if not is_club_member(p_club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  v_self := current_member_id(p_club_id);

  -- Rollende Zeiträume und keine Kalendermonate: «damit auch Neumitglieder
  -- sichtbar werden» meint die letzten Wochen, nicht den angebrochenen Monat.
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
    -- Die Säule steht bei einer Buchung von Hand an der Buchung selbst und
    -- sonst an ihrer Regel (UC-021). Dieselbe Reihenfolge wie `bookingPillar()`
    -- in der App.
    left join point_rules r
      on r.club_id = t.club_id and r.code = t.rule_code
    where m.club_id = p_club_id
      -- BR-091: Wer die Anzeige abgewählt hat, erscheint nirgends – sammelt
      -- aber weiter Punkte.
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
          when p_period = 'season' then t.season = season_label(p_club_id)
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
  -- A3 und BR-090: die vorderen Ränge **und** die eigene Zeile. Eine Rangliste,
  -- in der man sich selbst nicht findet, beantwortet die einzige Frage nicht,
  -- die man an sie hat.
  where ranked.rank <= greatest(coalesce(p_limit, 20), 1)
     or ranked.member_id = v_self
  order by ranked.rank, ranked.display_name;
end;
$$;

revoke execute on function public.leaderboard_rows(uuid, uuid, text, smallint, int)
  from public, anon;
grant  execute on function public.leaderboard_rows(uuid, uuid, text, smallint, int)
  to authenticated;

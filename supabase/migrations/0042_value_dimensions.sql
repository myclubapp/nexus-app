-- ============================================================================
-- 0042_value_dimensions: die fünf Wertdimensionen (UC-024)
--
-- BR-100: keine neue Datenerhebung. Alles kommt aus `point_transactions` und
-- `point_rules` – denselben Tabellen, aus denen schon das Dashboard und die
-- Rangliste lesen.
--
-- Zwei Regeln bestimmen den Zuschnitt:
--   BR-103  Nicht erhoben ist **nicht null**. «Finanzen» hat heute keine
--           Quelle (Rechnungen kommen mit UC-036); sie als «0 von 100» zu
--           zeichnen wäre eine Aussage über die Person, die niemand gemeint hat.
--   BR-104  Ein Durchschnitt über zwei Personen verrät die zweite. Unter der
--           Mindestgrösse gibt es keine Vergleichslinie.
--
-- Die Rechnung gehört auf den Server: Seit `0037` liest niemand mehr fremde
-- Buchungen, ein Team-Durchschnitt liesse sich im Client gar nicht bilden.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Die Abbildung der sieben Säulen auf die fünf Dimensionen.
--
-- Sie steht **einmal**, hier. Die App liest sie und rechnet nicht mit.
-- ---------------------------------------------------------------------------
create or replace function public.dimension_of_pillar(p_pillar smallint)
returns text
language sql
immutable
as $$
  select case p_pillar
    when 1 then 'engagement'   -- Trainingsengagement
    when 2 then 'engagement'   -- Wettkampf
    when 3 then 'volunteering' -- Freiwilliges Engagement
    when 7 then 'volunteering' -- Marktplatz
    when 4 then 'network'      -- Vereinsleben
    when 5 then 'loyalty'      -- Wachstum & Treue
    when 6 then 'loyalty'      -- Verlässlichkeit
  end;
$$;

/**
 * Die fünf Dimensionen einer Person, mit Vergleichslinien.
 *
 * `p_member_id` ist die Führungssicht (A4, FR-072): Eine Trainer:in darf das
 * Diagramm eines Mitglieds ihres Teams als Gesprächsgrundlage öffnen. Ohne
 * Angabe gilt die eigene Person.
 */
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
    if not (
      is_club_admin(p_club_id)
      or (
        is_club_trainer(p_club_id)
        and exists (
          select 1
            from team_members mine
            join team_members theirs on theirs.team_id = mine.team_id
           where mine.member_id = v_self and theirs.member_id = v_target
        )
      )
    ) then
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

revoke execute on function public.dimension_of_pillar(smallint) from public, anon;
grant  execute on function public.dimension_of_pillar(smallint) to authenticated;

revoke execute on function public.value_dimensions(uuid, uuid) from public, anon;
grant  execute on function public.value_dimensions(uuid, uuid) to authenticated;

-- ============================================================================
-- 0014_point_rules: Punkteregeln konfigurieren (UC-016)
--
-- `point_rules` und die Policy `point_rules_admin_write` bestehen seit 0002
-- bzw. 0006. Was fehlt, sind die Regeln über den Regeln:
--   BR-066  Eine Regel trägt nie einen negativen Wert. Ein Punkteabzug als
--           Dauereinrichtung widerspricht dem ganzen Konzept – negative
--           Buchungen entstehen ausschliesslich als Korrektur (UC-021).
--   BR-064  Ein technischer Code existiert je Verein höchstens einmal.
--   BR-065  Häufigkeitsgrenzen gelten serverseitig, nicht im Frontend.
-- ============================================================================

-- BR-066: Kein Punkteabzug als Regel.
alter table point_rules drop constraint if exists point_rules_points_check;
alter table point_rules add constraint point_rules_points_check
  check (points >= 0);

-- BR-064 besteht bereits als `unique (club_id, code)` aus 0002 – hier nur
-- festgehalten, damit die Regel im Migrationsverlauf auffindbar ist.

-- ---------------------------------------------------------------------------
-- Häufigkeitsgrenze allgemein prüfen (BR-065, A5).
--
-- `award_points()` kannte bisher nur `max_per_week`. Die Spezifikation nennt
-- «Höchstzahl je Zeitraum» – Woche, Monat und Saison. Die Prüfung gehört in
-- die Buchungsfunktion, damit das Frontend sie nicht umgehen kann.
-- ---------------------------------------------------------------------------
create or replace function public.rule_limit_reached(
  p_member_id uuid,
  p_rule      point_rules
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_max    int;
  v_period text;
  v_since  timestamptz;
  v_used   int;
begin
  -- `max_per_week` bleibt als Kurzform bestehen; die bestehenden Vorlagen
  -- aus seed_point_rules() verwenden sie.
  v_max := nullif(p_rule.meta->>'max_per_week', '')::int;
  if v_max is not null then
    v_period := 'week';
  else
    v_max := nullif(p_rule.meta->>'max_per_period', '')::int;
    v_period := coalesce(nullif(p_rule.meta->>'period', ''), 'week');
  end if;

  if v_max is null then
    return false;
  end if;

  v_since := case v_period
    when 'day'    then date_trunc('day', now())
    when 'week'   then date_trunc('week', now())
    when 'month'  then date_trunc('month', now())
    when 'season' then null
    else date_trunc('week', now())
  end;

  select count(*) into v_used
  from point_transactions
  where member_id = p_member_id
    and rule_code = p_rule.code
    and (v_since is null or created_at >= v_since);

  return v_used >= v_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- award_points() neu, mit der allgemeinen Grenze.
--
-- Der übrige Ablauf bleibt: keine Regel oder eine inaktive heisst «dieser
-- Verein vergibt dafür keine Punkte» und ist kein Fehler.
-- ---------------------------------------------------------------------------
create or replace function public.award_points(
  p_member_id   uuid,
  p_rule_code   text,
  p_source_type text,
  p_source_id   uuid default null,
  p_note        text default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club_id uuid;
  v_rule    point_rules;
  v_season  text;
begin
  select club_id into v_club_id from club_members where id = p_member_id;
  if v_club_id is null then
    raise exception 'Mitglied % existiert nicht', p_member_id;
  end if;

  select * into v_rule
  from point_rules
  where club_id = v_club_id and code = p_rule_code and is_active;

  if not found then
    -- Keine Regel heisst: Der Verein vergibt für diesen Anlass keine Punkte.
    -- Das gilt auch für den Nur-Dank-Modus (A4), der den Wert auf null setzt.
    return 0;
  end if;

  if rule_limit_reached(p_member_id, v_rule) then
    return 0;
  end if;

  v_season := season_label(v_club_id);

  insert into point_transactions
    (club_id, member_id, rule_code, points, season, source_type, source_id, note)
  values
    (v_club_id, p_member_id, p_rule_code, v_rule.points, v_season,
     p_source_type, p_source_id, p_note)
  on conflict do nothing;

  if not found then
    return 0;
  end if;

  return v_rule.points;
end;
$$;

-- ---------------------------------------------------------------------------
-- Eine ganze Säule aus- oder einschalten (A2).
--
-- Als Funktion, weil es eine Aktion ist: Sieben einzelne Aufrufe aus dem
-- Client hinterliessen bei einem Abbruch eine halb abgeschaltete Säule.
-- ---------------------------------------------------------------------------
create or replace function public.set_pillar_active(
  p_club_id uuid,
  p_pillar  smallint,
  p_active  boolean
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand ändert Punkteregeln';
  end if;

  -- BR-067: Deaktivierte Standardregeln werden nicht gelöscht, nur stillgelegt.
  update point_rules
     set is_active = p_active
   where club_id = p_club_id and pillar = p_pillar;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.rule_limit_reached(uuid, point_rules)
  from public, anon, authenticated;
grant execute on function public.rule_limit_reached(uuid, point_rules)
  to service_role;

revoke execute on function public.set_pillar_active(uuid, smallint, boolean)
  from public, anon;
grant execute on function public.set_pillar_active(uuid, smallint, boolean)
  to authenticated;

-- award_points() bleibt die interne Buchungsroutine (0007_function_grants).
revoke execute on function public.award_points(uuid, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.award_points(uuid, text, text, uuid, text)
  to service_role;

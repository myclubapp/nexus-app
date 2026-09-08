-- ============================================================================
-- 0002_points: Der eine Punkte-Ledger
-- MVP-Scope §4: Es gibt genau einen Ledger. Kein separates Helferpunkte-Konto.
-- Architektur §10: Clients schreiben NIE direkt in point_transactions.
-- ============================================================================

create table point_rules (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references clubs(id) on delete cascade,
  pillar    smallint not null check (pillar between 1 and 7),
  code      text not null,
  label     text not null,
  points    int not null,
  is_active boolean not null default true,
  -- z.B. {"max_per_week": 3} – wird in award_points() geprüft.
  meta      jsonb not null default '{}'::jsonb,
  unique (club_id, code)
);

create table point_transactions (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  member_id   uuid not null references club_members(id) on delete cascade,
  rule_code   text,
  points      int not null,
  season      text not null,
  source_type text not null,
  source_id   uuid,
  note        text,
  created_by  uuid references club_members(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index point_tx_member_season_idx on point_transactions(member_id, season);
create index point_tx_club_season_idx on point_transactions(club_id, season);

-- Eine Buchung pro Quelle: verhindert doppelte Punkte bei Doppel-Check-in.
create unique index point_tx_unique_source_idx
  on point_transactions(member_id, rule_code, source_id)
  where source_id is not null;

-- ---------------------------------------------------------------------------
-- Saison-Label wie '2026/27'. Muss mit src/lib/season.ts im Client
-- übereinstimmen, sonst zeigt die App eine andere Saison als die Datenbank.
-- ---------------------------------------------------------------------------
create or replace function public.season_label(p_club_id uuid, p_at timestamptz default now())
returns text
language plpgsql
stable
as $$
declare
  v_start date;
  v_first int;
begin
  select season_start into v_start from clubs where id = p_club_id;

  if v_start is null then
    return to_char(p_at, 'YYYY');
  end if;

  v_first := extract(year from p_at)::int;
  if (extract(month from p_at), extract(day from p_at))
     < (extract(month from v_start), extract(day from v_start)) then
    v_first := v_first - 1;
  end if;

  return v_first::text || '/' || lpad(((v_first + 1) % 100)::text, 2, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Der einzige Schreibpfad in den Ledger.
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
  v_max     int;
  v_used    int;
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
    return 0;
  end if;

  v_season := season_label(v_club_id);

  -- Rate-Limit aus point_rules.meta (Architektur §10).
  v_max := nullif(v_rule.meta->>'max_per_week', '')::int;
  if v_max is not null then
    select count(*) into v_used
    from point_transactions
    where member_id = p_member_id
      and rule_code = p_rule_code
      and created_at >= date_trunc('week', now());
    if v_used >= v_max then
      return 0;
    end if;
  end if;

  insert into point_transactions
    (club_id, member_id, rule_code, points, season, source_type, source_id, note)
  values
    (v_club_id, p_member_id, p_rule_code, v_rule.points, v_season, p_source_type, p_source_id, p_note)
  on conflict do nothing;

  if not found then
    return 0;
  end if;

  return v_rule.points;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard. Als View gehalten, solange die Vereine klein sind; bei Bedarf
-- wird daraus eine Materialized View mit pg_cron-Refresh (Architektur §1).
-- Mitglieder ohne Opt-in erscheinen nicht – Jugendschutz und Datensparsamkeit.
-- ---------------------------------------------------------------------------
create or replace view public.leaderboard
with (security_invoker = true)
as
select
  m.club_id,
  tm.team_id,
  m.id as member_id,
  m.display_name,
  m.avatar_url,
  t.season,
  t.total_points,
  rank() over (
    partition by m.club_id, tm.team_id, t.season
    order by t.total_points desc
  )::int as rank
from club_members m
join (
  select member_id, season, sum(points)::int as total_points
  from point_transactions
  group by member_id, season
) t on t.member_id = m.id
left join team_members tm on tm.member_id = m.id
where m.leaderboard_opt_in
  and m.status <> 'left';

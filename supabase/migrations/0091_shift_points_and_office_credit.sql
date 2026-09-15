-- ============================================================================
-- 0091_shift_points_and_office_credit: Der Einsatz als Massstab
--
-- Die Prüfung des Punktesystems am 14.09.2026 hat zwei Dinge gezeigt:
--
--   1. Die **Schichtleiter** aus `0080` (25 / 50 / 100 nach drei Dauerstufen)
--      arbeitet mit Klippen: Bei exakt 120 und 300 Minuten verdoppelt sich der
--      Wert um eine Minute, und oberhalb von fünf Stunden ist sie offen – die
--      Sammelschicht des Jubiläums (40 Plätze über 14 Stunden) bekam denselben
--      Wert wie eine Schicht von fünf Stunden und einer Minute.
--   2. Die **Ämter** tragen die Skala der bisherigen App noch als Text
--      (`points_label`: «4», «7», «1-4», «3 + Lohn + Spesen»). Es gibt keine
--      Regel, keine Buchung und deshalb keinen einzigen Punkt dafür im Ledger –
--      obwohl 25 Sitze besetzt sind und ein Juniorentrainer 60 Stunden pro
--      Saison leistet. Beim Saisonziel stünde er auf null.
--
-- Beides hat denselben Massstab: **den Einsatz**. Ein Einsatz ist ein halber
-- Tag, vier Stunden, und so viel wert wie die Regel `shift_done` sagt (50).
-- Vier Einsätze sind das Saisonziel (200). Ein alter Helferpunkt war genau so
-- ein Einsatz – 96 der 105 übernommenen Schichten trugen den Wert 1.
--
-- Sechs Teile:
--   1. Der Schichtwert ist die Dauer, gemessen am Einsatz (BR-205)
--   2. Die 105 übernommenen Schichten nachziehen
--   3. Das Amt bekommt einen echten Punktwert (BR-206)
--   4. Die Inhaber:innen mit ihren Mitgliedschaften verknüpfen
--   5. Die Amtszeit als Buchungsquelle, quartalsweise (BR-207)
--   6. Rechte
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Der Schichtwert ist die Dauer, gemessen am Einsatz (BR-205).
--
-- Statt drei Eimern eine Ableitung:
--
--     Punkte = min( ceil(Minuten × Einsatzwert / 1200) × 5 ,  Einsatzwert × 2 )
--
-- 1200 ist `240 Minuten × 5`: vier Stunden sind ein Einsatz, gerundet wird auf
-- das Fünferraster. Der Deckel ist der ganze Tag (acht Stunden, zwei
-- Einsätze) – **niemand leistet mehr als einen Tag in einer Schicht**. Wer
-- länger eingeteilt ist, bekommt zwei Schichten; eine Sammelschicht über einen
-- ganzen Anlass ist keine Schicht, sondern eine fehlende Planung.
--
-- Der Wert hängt am Regelwert von `shift_done` und nicht an einer Konstanten:
-- Ein Verein, der sein Saisonziel verschiebt, verschiebt diese Regel – und
-- Schichtvorschlag, Zielvorschlag (`suggestedSeasonGoal()`) und Ämterschlüssel
-- folgen gemeinsam. Eine zweite Konstante wäre eine zweite Wahrheit.
--
-- **Gegenstück zu `suggestedShiftPoints()` in `app/src/lib/shift.ts`.** Laufen
-- die beiden auseinander, schlägt das Formular etwas anderes vor, als die
-- Übernahme bucht – dieselbe Gefahr wie bei `season_label()`/`seasonLabel()`.
-- ---------------------------------------------------------------------------

-- Der Einsatzwert des Vereins. Ohne Regel gilt 50, damit ein Verein ohne
-- eigene Punkteordnung nicht plötzlich Schichten zu null vergibt.
create or replace function public.club_shift_base(p_club_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select r.points from point_rules r
      where r.club_id = p_club_id and r.code = 'shift_done'),
    50);
$$;

comment on function public.club_shift_base(uuid) is
  'BR-205: der Wert eines Einsatzes (halber Tag, 4 h) – Massstab für Schichten und Ämter.';

-- Die alte Stufenfunktion weicht der Ableitung. Der Aufrufer
-- `upsert_legacy_event()` wird weiter unten mitgezogen; Postgres verfolgt
-- Funktionsaufrufe im Rumpf nicht, das Nachziehen ist Handarbeit.
drop function if exists public.suggested_shift_points(int);

create or replace function public.suggested_shift_points(p_minutes int, p_base int)
returns int
language sql
immutable
as $$
  select case
    when p_minutes is null or p_minutes <= 0 or coalesce(p_base, 0) <= 0 then 0
    else least(
      ceil(p_minutes::numeric * p_base / 1200)::int * 5,
      p_base * 2
    )
  end;
$$;

comment on function public.suggested_shift_points(int, int) is
  'BR-205: Punktwert einer Schicht aus ihrer Dauer, gedeckelt auf einen ganzen Tag.';

-- Rumpf wie `0080`; geändert ist nur die Herleitung des Punktwerts in der
-- Schichtschleife – sie misst jetzt am Einsatzwert des Vereins.
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
  v_base  int;
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

  -- Einmal je Anlass geholt und nicht je Schicht: der Wert ändert sich
  -- innerhalb eines Aufrufs nicht.
  v_base := club_shift_base(p_club_id);

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
      -- BR-204/BR-205: der Punktwert kommt aus der **Dauer**, gemessen am
      -- Einsatz. Ein fremder Wert ist keine Punktzahl dieser Skala.
      suggested_shift_points((extract(epoch from (
        (v_shift->>'ends_at')::timestamptz - (v_shift->>'starts_at')::timestamptz
      )) / 60)::int, v_base),
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

-- ---------------------------------------------------------------------------
-- 2. Die übernommenen Schichten nachziehen.
--
-- Wie in `0080`: **nur übernommene Schichten** (`external_id is not null`) und
-- **nur solche ohne Buchung**. Eine von Hand angelegte Schicht trägt den Wert,
-- den der Vorstand ihr gegeben hat; ein bestätigter Einsatz wird nicht
-- nachträglich umbewertet (BR-052), dort steht die Zahl bereits im Ledger.
-- ---------------------------------------------------------------------------
update event_shifts s
   set points = suggested_shift_points(
         (extract(epoch from (s.ends_at - s.starts_at)) / 60)::int,
         club_shift_base(e.club_id))
  from events e
 where e.id = s.event_id
   and s.external_id is not null
   and s.point_rule_code = 'shift_done'
   and not exists (
     select 1 from point_transactions t
      where t.source_type = 'shift' and t.source_id = s.id);

-- ---------------------------------------------------------------------------
-- 3. Das Amt bekommt einen echten Punktwert (BR-206).
--
-- `points_label` bleibt, wofür es gedacht war: der Text am Factsheet, der auch
-- «+ Lohn + Spesen» sagen kann. Was **gebucht** wird, ist eine Zahl, und eine
-- Zahl gehört in eine Zahlenspalte. Ein Textfeld, aus dem jemand rechnet, ist
-- eine Einladung zu vier verschiedenen Parsern an vier Stellen.
-- ---------------------------------------------------------------------------
alter table functionary_roles
  add column if not exists season_points int
    check (season_points is null or season_points between 0 and 10000);

comment on column functionary_roles.season_points is
  'BR-206: Punktwert des Amtes für eine ganze Saison. NULL = noch nicht festgelegt, 0 = ohne Punkte.';

-- Rückrechnung aus der Vereinsskala: Helferpunkte × Einsatzwert.
-- Bei einer Spanne («1-4») gilt der obere Wert – das Factsheet nennt ihn als
-- den Aufwand, für den das Amt ausgeschrieben ist; nach unten korrigiert der
-- Vorstand. Was gar nicht mit einer Ziffer beginnt (das Präsidium hat kein
-- Label), bleibt **null** und wartet auf einen Entscheid: eine erfundene Zahl
-- wäre schlechter als eine fehlende.
update functionary_roles r
   set season_points = (coalesce(
         nullif(substring(r.points_label from '^\s*\d+\s*[-–]\s*(\d+)'), ''),
         nullif(substring(r.points_label from '^\s*(\d+)'), '')
       ))::int * club_shift_base(r.club_id)
 where r.season_points is null
   and r.points_label ~ '^\s*\d';

-- Den Wert setzen, ohne das ganze Factsheet zu schreiben. Eine eigene
-- Funktion und kein neuer Parameter an `save_office()`: Ein zusätzlicher
-- Parameter mit Vorgabewert `null` würde bei jedem Speichern aus dem Formular,
-- das ihn nicht kennt, den Punktwert stillschweigend löschen.
create or replace function public.set_office_points(p_role_id uuid, p_points int)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
begin
  select club_id into v_club from functionary_roles where id = p_role_id;
  if v_club is null then
    raise exception 'Dieses Amt gibt es nicht';
  end if;
  if not is_club_admin(v_club) then
    raise exception 'Nur der Vorstand setzt den Punktwert eines Amtes';
  end if;
  if p_points is not null and (p_points < 0 or p_points > 10000) then
    raise exception 'Ein Amt trägt zwischen 0 und 10000 Punkten je Saison';
  end if;

  update functionary_roles set season_points = p_points where id = p_role_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Die Inhaber:innen mit ihren Mitgliedschaften verknüpfen.
--
-- BR-184 erlaubt eine Inhaber:in ohne Konto – beim ersten Verein steht
-- **jeder** der 25 besetzten Sitze nur als Name da, weil der Vorstand die
-- Ämter erfasst hat, bevor die Mitglieder übernommen waren. Eine Buchung
-- braucht aber eine `member_id`. Was der Anzeigename eindeutig trifft, wird
-- hier verknüpft; der Rest bleibt Handarbeit im Ämter-Bildschirm.
--
-- Drei Bedingungen, damit die Zuordnung nicht rät:
--   * genau **ein** Mitglied trägt diesen Namen im Verein,
--   * es ist nicht ausgetreten,
--   * es hält diesen Sitz nicht schon (der Unique-Index würde sonst brechen).
-- ---------------------------------------------------------------------------
update functionary_holders h
   set member_id = m.id
  from functionary_roles r, club_members m
 where h.role_id = r.id
   and h.member_id is null
   and m.club_id = r.club_id
   and m.status <> 'left'
   and lower(trim(m.display_name)) = lower(trim(h.display_name))
   and (select count(*) from club_members m2
         where m2.club_id = r.club_id
           and m2.status <> 'left'
           and lower(trim(m2.display_name)) = lower(trim(h.display_name))) = 1
   and not exists (select 1 from functionary_holders h2
                    where h2.role_id = h.role_id and h2.member_id = m.id);

-- ---------------------------------------------------------------------------
-- 5. Die Amtszeit als Buchungsquelle (BR-207).
--
-- Ein Sitz besteht über Saisons hinweg, eine Buchung gilt für eine. Der
-- Dedupe-Index des Ledgers läuft über `(member_id, rule_code, source_id)` und
-- kennt **keine Saison**: Wäre die Inhaber-Zeile die Quelle, bekäme ein Amt
-- seine Punkte genau einmal und in der zweiten Saison nie wieder.
--
-- Deshalb eine Zeile je Amt, Person, Saison **und Quartal**. Das Quartal ist
-- nicht nur Buchhaltung: Schreibt das Amt erst im Mai gut, steht eine
-- Juniorentrainerin acht Monate lang auf null, die Ampel lügt, und
-- `detect_contribution_gaps()` zählt sie als säumig. Ein Viertel je Quartal
-- hält die Anzeige ehrlich (Konzept §4.1, «oder quartalsweise anteilig»).
-- ---------------------------------------------------------------------------
create table if not exists functionary_terms (
  id           uuid primary key default gen_random_uuid(),
  role_id      uuid not null references functionary_roles(id) on delete cascade,
  member_id    uuid not null references club_members(id) on delete cascade,
  season       text not null,
  period       smallint not null check (period between 1 and 4),
  points       int not null default 0 check (points >= 0),
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid references club_members(id) on delete set null,
  unique (role_id, member_id, season, period)
);

create index if not exists functionary_terms_member_idx
  on functionary_terms(member_id, season);

alter table functionary_terms enable row level security;

-- BR-201 sinngemäss: Wer wie viel für sein Amt bekommen hat, geht den Verein
-- nicht an. Das Mitglied sieht sich, der Vorstand sieht alle.
drop policy if exists functionary_terms_read on functionary_terms;
create policy functionary_terms_read on functionary_terms
  for select using (
    exists (select 1 from functionary_roles r
             where r.id = role_id
               and (is_club_board(r.club_id)
                    or member_id = current_member_id(r.club_id)))
  );

drop policy if exists functionary_terms_write on functionary_terms;
create policy functionary_terms_write on functionary_terms
  for all using (
    exists (select 1 from functionary_roles r
             where r.id = role_id and is_club_admin(r.club_id))
  ) with check (
    exists (select 1 from functionary_roles r
             where r.id = role_id and is_club_admin(r.club_id))
  );

-- Die Regel. Der Punktwert steht bei **0**, weil die Amtszeit ihren Wert
-- selbst trägt – wie die Aufgabe (BR-077) und die Schicht (BR-042). Die Regel
-- liefert die Säule: 7, der Marktplatz, zu dem die Ämter gehören. Damit zählt
-- ein Amt über `contribution_pillars()` auf das Saisonziel.
insert into point_rules (club_id, pillar, code, label, points, is_active, meta)
select c.id, 7, 'office_held', 'Amt ausgeübt', 0, true, '{}'::jsonb
  from clubs c
 where not exists (select 1 from point_rules x
                    where x.club_id = c.id and x.code = 'office_held');

-- Neue Vereine bekommen sie beim Gründen. Rumpf wie `0064`, ergänzt um die
-- eine Zeile am Ende.
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

  -- Säule 5, Konzept §4.1: Vereinstreue mit Meilensteinen. `loyalty_year` gilt
  -- jedem Jubiläum, `loyalty_milestone` zusätzlich bei 5, 10 und 20 Jahren –
  -- die Jahre stehen in `meta`, damit ein Verein sie verschieben kann.
  insert into point_rules (club_id, pillar, code, label, points, is_active, meta) values
    (p_club_id, 5, 'loyalty_milestone', 'Treue-Meilenstein', 200, true, '{"years": [5, 10, 20]}');

  -- Säule 1, Konzept §4.1: Trainingsserie und Pünktlichkeit. Die Serie ist
  -- aktiv – sie belohnt Dranbleiben, nicht Leistung. Pünktlichkeit steht aus
  -- («optional aktivierbar»): Zwei Punkte für «vor Beginn da» sind für manche
  -- Vereine Ansporn, für andere Druck (V7).
  insert into point_rules (club_id, pillar, code, label, points, is_active, meta) values
    (p_club_id, 1, 'training_streak_4', 'Trainingsserie: 4 Wochen', 25, true,  '{}'),
    (p_club_id, 1, 'training_streak_8', 'Trainingsserie: 8 Wochen', 60, true,  '{}'),
    (p_club_id, 1, 'punctual',          'Pünktlich da',              2, false, '{}');

  -- UC-042/BR-207: die Amtszeit. Wert 0, weil die Amtszeit ihren Punktwert
  -- selbst trägt; die Regel liefert die Säule.
  insert into point_rules (club_id, pillar, code, label, points, is_active, meta) values
    (p_club_id, 7, 'office_held', 'Amt ausgeübt', 0, true, '{}');
end;
$$;

-- Das laufende Quartal der Saison. Gegenstück zu `season_label()` und
-- `season_end()`: Wer die Saison benennt, muss auch sagen, in welchem Viertel
-- sie gerade steht – sonst rechnet die Gutschrift mit Kalenderquartalen,
-- während die Rangliste eine Saison zeigt.
create or replace function public.season_period(p_club_id uuid, p_at timestamptz default now())
returns smallint
language plpgsql
stable
as $$
declare
  v_start  date;
  v_months int;
begin
  select season_start into v_start from clubs where id = p_club_id;

  if v_start is null then
    v_months := extract(month from p_at)::int - 1;
  else
    v_months := (extract(year from p_at)::int - extract(year from v_start)::int) * 12
              + (extract(month from p_at)::int - extract(month from v_start)::int);
    -- Der Tag im Monat entscheidet den Randfall: Beginnt die Saison am 15.,
    -- gehört der 14. noch zum vorigen Monat der Saison.
    if extract(day from p_at) < extract(day from v_start) then
      v_months := v_months - 1;
    end if;
    v_months := v_months % 12;
    if v_months < 0 then
      v_months := v_months + 12;
    end if;
  end if;

  return least(4, greatest(1, (v_months / 3) + 1))::smallint;
end;
$$;

-- Ein Viertel des Saisonwerts gutschreiben.
--
-- Gebucht wird **direkt** und nicht über `award_points()`: Wie die Aufgabe
-- trägt die Amtszeit ihren Wert selbst, der Regelcode liefert nur die Säule
-- (CLAUDE.md). `source_id` ist die Amtszeit-Zeile – damit hält der
-- Dedupe-Index zwei Quartale auseinander und verwirft eine zweite Buchung
-- desselben Quartals still.
create or replace function public.confirm_office_term(
  p_role_id   uuid,
  p_member_id uuid,
  p_period    smallint default null,
  p_season    text default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role    functionary_roles;
  v_season  text;
  v_period  smallint;
  v_share   int;
  v_term    uuid;
  v_user    uuid;
  v_by      uuid;
begin
  select * into v_role from functionary_roles where id = p_role_id;
  if not found then
    raise exception 'Dieses Amt gibt es nicht';
  end if;

  -- NFR-039: serverseitig geprüft, nicht im UI versteckt.
  if not is_club_admin(v_role.club_id) then
    raise exception 'Nur der Vorstand schreibt Ämter gut';
  end if;

  if not exists (select 1 from club_members
                  where id = p_member_id and club_id = v_role.club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  -- Nur, wer den Sitz auch hält. «Ad interim» zählt mit: Die Arbeit wird
  -- geleistet, unabhängig davon, ob die Nachfolge schon geregelt ist.
  if not exists (select 1 from functionary_holders
                  where role_id = p_role_id and member_id = p_member_id) then
    raise exception 'Diese Person hält dieses Amt nicht';
  end if;

  -- Ohne festgelegten Wert keine Gutschrift. Das ist kein Fehler, sondern der
  -- Normalfall für ein Amt, über das der Vorstand noch nicht entschieden hat.
  if coalesce(v_role.season_points, 0) <= 0 then
    return 0;
  end if;

  v_season := coalesce(nullif(trim(p_season), ''), season_label(v_role.club_id));
  v_period := coalesce(p_period, season_period(v_role.club_id));

  -- Das letzte Quartal trägt den Rest, damit vier Viertel den ganzen Wert
  -- ergeben und nicht drei Punkte fehlen.
  if v_period = 4 then
    v_share := v_role.season_points - 3 * (v_role.season_points / 4);
  else
    v_share := v_role.season_points / 4;
  end if;

  v_by := current_member_id(v_role.club_id);

  insert into functionary_terms (role_id, member_id, season, period, points, confirmed_by)
  values (p_role_id, p_member_id, v_season, v_period, v_share, v_by)
  on conflict (role_id, member_id, season, period) do nothing
  returning id into v_term;

  -- Schon gutgeschrieben: Der Stand bleibt, eine zweite Nachricht unterbleibt.
  if v_term is null then
    return 0;
  end if;

  insert into point_transactions
    (club_id, member_id, rule_code, points, season, source_type, source_id, note)
  values
    (v_role.club_id, p_member_id, 'office_held', v_share, v_season,
     'office', v_term, v_role.title)
  on conflict do nothing;

  select user_id into v_user from club_members where id = p_member_id;
  if v_user is not null and v_share > 0 then
    perform notify(
      v_user,
      'points',
      'Amt gutgeschrieben',
      v_role.title || ' – ' || v_share || ' Punkte für dieses Quartal',
      '/tabs/profile',
      v_role.club_id
    );
  end if;

  return v_share;
end;
$$;

-- Ein Quartal für den ganzen Verein. Ohne diese Funktion müsste der Vorstand
-- 25 Sitze einzeln bestätigen – und täte es nicht.
create or replace function public.confirm_office_period(
  p_club_id uuid,
  p_period  smallint default null,
  p_season  text default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_holder record;
  v_count  int := 0;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand schreibt Ämter gut';
  end if;

  for v_holder in
    select h.role_id, h.member_id
      from functionary_holders h
      join functionary_roles r on r.id = h.role_id
     where r.club_id = p_club_id
       and h.member_id is not null
       and coalesce(r.season_points, 0) > 0
  loop
    if confirm_office_term(v_holder.role_id, v_holder.member_id, p_period, p_season) > 0 then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Rechte.
--
-- Eine neue `security definer`-Funktion ist sofort ein offener Endpunkt:
-- Postgres vergibt `execute` an PUBLIC, Supabase zusätzlich an `anon` und
-- `authenticated` (CLAUDE.md, Vorlage `0007`). `revoke … from anon` allein
-- wirkt nicht – `anon` zieht sein Recht aus PUBLIC.
--
-- Die Rechenhilfen prüfen keine Reichweite und bleiben intern; die drei
-- Funktionen, die der Vorstand aufruft, prüfen selbst und dürfen an
-- Angemeldete.
-- ---------------------------------------------------------------------------
revoke execute on function public.club_shift_base(uuid)
  from public, anon, authenticated;
revoke execute on function public.suggested_shift_points(int, int)
  from public, anon, authenticated;
revoke execute on function public.upsert_legacy_event(
  uuid, text, text, text, text, timestamptz, timestamptz, text, int, boolean, text, jsonb, uuid)
  from public, anon, authenticated;
revoke execute on function public.seed_point_rules(uuid, text)
  from public, anon, authenticated;

revoke execute on function public.set_office_points(uuid, int) from public, anon;
grant  execute on function public.set_office_points(uuid, int) to authenticated;

revoke execute on function public.season_period(uuid, timestamptz) from public, anon;
grant  execute on function public.season_period(uuid, timestamptz) to authenticated;

revoke execute on function public.confirm_office_term(uuid, uuid, smallint, text) from public, anon;
grant  execute on function public.confirm_office_term(uuid, uuid, smallint, text) to authenticated;

revoke execute on function public.confirm_office_period(uuid, smallint, text) from public, anon;
grant  execute on function public.confirm_office_period(uuid, smallint, text) to authenticated;

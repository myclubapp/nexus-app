-- ============================================================================
-- 0064_streaks: Trainingsserie und Pünktlichkeit (Konzept §4.1, Säule 1)
--
-- Zwei Regeln des Konzepts, die es bisher nicht gab: der **Streak-Bonus**
-- («Trainingsserie, 4 Wochen ohne Ausfall: 25; 8 Wochen: 60») und die
-- **Pünktlichkeit** («vor Trainingsbeginn da: 2, optional aktivierbar»).
--
-- **Was eine Serie ist:** Wochen, in denen die Person in mindestens einem
-- Training war – ohne Unterbruch. Eine Woche, in der ihre Teams gar kein
-- Training hatten (Ferien, Hallensperre), zählt weder dafür noch dagegen:
-- «ohne Ausfall» meint den eigenen Ausfall, nicht den des Vereins. Gebucht
-- wird beim Erreichen von 4, 8, 12, 16 … Wochen – bei jedem Vielfachen von
-- acht der grosse Bonus, sonst der kleine. Bei drei Wochen sagt die App, dass
-- ein Training bis zum Bonus fehlt (Konzept §10, «Streak-Warnung»).
--
-- Gerechnet wird wöchentlich über abgeschlossene Wochen – eine laufende Woche
-- kann noch werden. Dedupliziert über Mitglied und Wochenbeginn.
-- ============================================================================

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
end;
$$;

-- Bestehende Vereine bekommen die drei Regeln ebenfalls.
insert into point_rules (club_id, pillar, code, label, points, is_active, meta)
select c.id, 1, r.code, r.label, r.points, r.is_active, '{}'::jsonb
  from clubs c
  cross join (values
    ('training_streak_4', 'Trainingsserie: 4 Wochen', 25, true),
    ('training_streak_8', 'Trainingsserie: 8 Wochen', 60, true),
    ('punctual',          'Pünktlich da',              2, false)
  ) as r(code, label, points, is_active)
 where not exists (select 1 from point_rules x where x.club_id = c.id and x.code = r.code);

-- ---------------------------------------------------------------------------
-- Die Serie einer Person, in Wochen, bis zum Ende der letzten abgeschlossenen
-- Woche vor `p_today`. Eine reine Rechnung – sie schreibt nichts.
-- ---------------------------------------------------------------------------
create or replace function public.training_streak(p_member_id uuid, p_today date default current_date)
returns int
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_member    club_members;
  v_week      date;
  v_streak    int := 0;
  v_present   boolean;
  v_scheduled boolean;
begin
  select * into v_member from club_members where id = p_member_id;
  if not found then
    return 0;
  end if;

  -- Die letzte abgeschlossene Woche (Montag bis Sonntag).
  v_week := (date_trunc('week', p_today::timestamp) - interval '7 days')::date;

  for i in 1..52 loop
    select exists (
      select 1 from attendance a
        join events e on e.id = a.event_id
       where a.member_id = p_member_id
         and a.status = 'present'
         and e.type = 'training'
         and e.starts_at >= v_week and e.starts_at < v_week + 7
    ) into v_present;

    if v_present then
      v_streak := v_streak + 1;
    else
      -- Gab es in dieser Woche überhaupt ein Training für ihre Teams?
      select exists (
        select 1 from events e
         where e.club_id = v_member.club_id
           and e.type = 'training'
           and e.cancelled_at is null
           and not e.is_sample
           and e.starts_at >= v_week and e.starts_at < v_week + 7
           and (
             e.team_id is null
             or exists (select 1 from team_members tm
                         where tm.team_id = e.team_id and tm.member_id = p_member_id)
           )
      ) into v_scheduled;
      if v_scheduled then
        exit;
      end if;
      -- Keine Trainingswoche: zählt nicht, bricht nicht.
    end if;

    v_week := v_week - 7;
  end loop;

  return v_streak;
end;
$$;

-- ---------------------------------------------------------------------------
-- Der wöchentliche Lauf: Bonus buchen, Warnung senden.
-- ---------------------------------------------------------------------------
create or replace function public.award_streaks(p_today date default current_date)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row    record;
  v_streak int;
  v_week   date;
  v_booked int := 0;
begin
  v_week := (date_trunc('week', p_today::timestamp) - interval '7 days')::date;

  for v_row in
    select m.id, m.user_id, m.club_id
      from club_members m
      join clubs c on c.id = m.club_id
     where m.status <> 'left'
       and m.user_id is not null
       and not c.is_demo
       and exists (select 1 from point_rules r
                    where r.club_id = m.club_id and r.is_active
                      and r.code in ('training_streak_4', 'training_streak_8'))
  loop
    v_streak := training_streak(v_row.id, p_today);

    if v_streak > 0 and v_streak % 8 = 0 then
      if award_points(v_row.id, 'training_streak_8', 'streak',
                      md5(v_row.id::text || ':streak:' || v_week)::uuid,
                      v_streak || ' Wochen Trainingsserie') > 0 then
        v_booked := v_booked + 1;
      end if;
    elsif v_streak > 0 and v_streak % 4 = 0 then
      if award_points(v_row.id, 'training_streak_4', 'streak',
                      md5(v_row.id::text || ':streak:' || v_week)::uuid,
                      v_streak || ' Wochen Trainingsserie') > 0 then
        v_booked := v_booked + 1;
      end if;
    elsif v_streak % 4 = 3 then
      -- Konzept §10: «Noch 1 Training und du sicherst dir deinen Streak-Bonus!»
      perform notify(
        v_row.user_id, 'points',
        'Noch ein Training bis zum Serien-Bonus',
        v_streak || ' Wochen am Stück – die nächste Woche macht den Bonus voll.',
        '/tabs/agenda', v_row.club_id
      );
    end if;
  end loop;

  return v_booked;
end;
$$;

revoke execute on function public.training_streak(uuid, date) from public, anon;
grant  execute on function public.training_streak(uuid, date) to authenticated;
revoke execute on function public.award_streaks(date) from public, anon, authenticated;

-- Montag früh, nach der Woche, die zählt.
select cron.unschedule('streak-award')
 where exists (select 1 from cron.job where jobname = 'streak-award');
select cron.schedule('streak-award', '5 6 * * 1',
  $cron$select public.award_streaks();$cron$);

-- ---------------------------------------------------------------------------
-- Pünktlichkeit: `check_in()` aus 0029 (QR-Token-Tabelle), um eine Buchung ergänzt.
-- ---------------------------------------------------------------------------
create or replace function public.check_in(p_event_id uuid, p_qr_token text)
returns table (points_awarded int, already_checked_in boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event    events;
  v_token    text;
  v_member   uuid;
  v_existing attendance;
  v_points   int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  -- A3: Wer nicht dazugehört, checkt nicht ein.
  v_member := current_member_id(v_event.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  if v_event.cancelled_at is not null then
    raise exception 'Dieser Termin wurde abgesagt';
  end if;

  -- A2: Das Token gehört zu genau einem Termin (BR-055).
  select token into v_token from event_qr_tokens where event_id = p_event_id;
  if v_token is distinct from p_qr_token then
    raise exception 'Dieser Code gehört nicht zu diesem Termin';
  end if;

  -- A1 und BR-054: 30 Minuten vor Beginn bis Terminende; ohne Endzeit gilt
  -- eine Standarddauer von drei Stunden.
  if now() < v_event.starts_at - interval '30 minutes'
     or now() > coalesce(v_event.ends_at, v_event.starts_at + interval '3 hours') then
    raise exception 'Der Code ist ausserhalb des Zeitfensters nicht gültig';
  end if;

  select * into v_existing
    from attendance
   where event_id = p_event_id and member_id = v_member and shift_id is null;

  -- A4 und BR-057: Ein zweiter Scan bestätigt, bucht aber nicht nach.
  if found and v_existing.status = 'present' then
    return query select 0, true;
    return;
  end if;

  insert into attendance (event_id, member_id, shift_id, status, checked_in_at)
  values (p_event_id, v_member, null, 'present', now())
  on conflict (event_id, member_id, shift_id)
  do update set status = 'present', checked_in_at = now();

  if v_event.point_rule_code is not null then
    v_points := award_points(
      v_member, v_event.point_rule_code, 'attendance', p_event_id, null
    );
  end if;

  -- Säule 1, «Pünktlichkeit (vor Trainingsbeginn da)»: Wer vor dem Beginn
  -- einscannt, bekommt die Regel `punctual` – sofern der Verein sie
  -- eingeschaltet hat; sonst gibt `award_points()` 0 zurück. Dedupliziert
  -- über den Termin wie die Teilnahme selbst.
  if now() < v_event.starts_at then
    v_points := v_points + award_points(v_member, 'punctual', 'attendance', p_event_id, null);
  end if;

  return query select v_points, false;
end;
$$;

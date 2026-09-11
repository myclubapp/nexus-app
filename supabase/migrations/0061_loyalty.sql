-- ============================================================================
-- 0061_loyalty: Vereinstreue wird automatisch gebucht (Konzept §4.1, Säule 5)
--
-- Die Regel `loyalty_year` («Ein weiteres Vereinsjahr») stand seit `0002` im
-- Regelwerk jedes Vereins – und nichts buchte sie. Das Konzept sagt
-- «Automatisch»: Ein Jubiläum ist kein Anlass, den jemand von Hand erfassen
-- muss, und ein Mitglied, das seit zehn Jahren dabei ist, soll das nicht dem
-- Vorstand in Erinnerung rufen müssen.
--
-- Zwei Regeln, ein Lauf: `loyalty_year` bei jedem vollendeten Vereinsjahr,
-- `loyalty_milestone` zusätzlich bei den Jahren aus `meta.years` (5, 10, 20).
-- Beide sind gewöhnliche Punkteregeln – der Verein ändert Wert und Aktivität
-- wie bei jeder anderen (FR-038, FR-040).
--
-- **Kein Rückwirken über Jahre:** Der Lauf bucht nur Jubiläen der letzten
-- sieben Tage. Ein migrierter Bestandsverein bekommt damit keine Flut von
-- Nachbuchungen – die nächsten Jubiläen kommen von selbst. Sieben Tage, weil
-- ein Cron, der einmal ausfällt, nichts verpassen soll.
--
-- Dedupliziert über `(member_id, rule_code, source_id)` wie jede Buchung: Die
-- Quelle ist ein aus Mitglied und Jahr abgeleiteter Schlüssel.
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
end;
$$;

-- Bestehende Vereine bekommen die neue Regel ebenfalls.
insert into point_rules (club_id, pillar, code, label, points, is_active, meta)
select c.id, 5, 'loyalty_milestone', 'Treue-Meilenstein', 200, true, '{"years": [5, 10, 20]}'::jsonb
  from clubs c
 where not exists (select 1 from point_rules r where r.club_id = c.id and r.code = 'loyalty_milestone');

-- ---------------------------------------------------------------------------
-- Der Lauf.
--
-- `p_today` ist ein Parameter, damit sich der Lauf prüfen lässt, ohne auf ein
-- echtes Jubiläum zu warten. Gebucht wird über `award_points()` – die
-- Rate-Limits, der Saisonstempel und die Deduplikation gelten damit wie bei
-- jeder Punktequelle (CLAUDE.md: Punkte schreibt nur der Server).
-- ---------------------------------------------------------------------------
create or replace function public.award_loyalty(p_today date default current_date)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row        record;
  v_years      int;
  v_anniv      date;
  v_milestones int[];
  v_booked     int := 0;
begin
  for v_row in
    select m.id, m.club_id, m.user_id, m.member_since
      from club_members m
      join clubs c on c.id = m.club_id
     where m.status <> 'left'
       and m.user_id is not null
       and not c.is_demo
       and m.member_since <= p_today - interval '1 year'
  loop
    v_years := extract(year from age(p_today, v_row.member_since))::int;
    v_anniv := (v_row.member_since + make_interval(years => v_years))::date;

    -- Nur Jubiläen der letzten sieben Tage – kein Rückwirken über Jahre.
    if v_anniv <= p_today - 7 then
      continue;
    end if;

    if award_points(
         v_row.id, 'loyalty_year', 'loyalty',
         md5(v_row.id::text || ':year:' || v_years)::uuid,
         v_years || '. Vereinsjahr'
       ) > 0 then
      v_booked := v_booked + 1;
      perform notify(
        v_row.user_id, 'points',
        'Danke für ' || v_years || ' Jahre im Verein',
        null, '/tabs/profile/points', v_row.club_id
      );
    end if;

    select array(
             select value::int
               from jsonb_array_elements_text(coalesce(r.meta->'years', '[5,10,20]'::jsonb)) as value
           )
      into v_milestones
      from point_rules r
     where r.club_id = v_row.club_id and r.code = 'loyalty_milestone';

    if v_years = any(coalesce(v_milestones, array[5, 10, 20])) then
      perform award_points(
        v_row.id, 'loyalty_milestone', 'loyalty',
        md5(v_row.id::text || ':milestone:' || v_years)::uuid,
        v_years || ' Jahre Vereinstreue'
      );
    end if;
  end loop;

  return v_booked;
end;
$$;

revoke execute on function public.award_loyalty(date) from public, anon, authenticated;

-- Einmal täglich, früh – ein Jubiläum hat kein Zeitfenster.
select cron.unschedule('loyalty-award')
 where exists (select 1 from cron.job where jobname = 'loyalty-award');
select cron.schedule('loyalty-award', '50 5 * * *',
  $cron$select public.award_loyalty();$cron$);

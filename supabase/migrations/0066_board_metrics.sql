-- ============================================================================
-- 0066_board_metrics: Symmetrie – die Reaktionszeiten der Führung (V5)
--
-- MVP-Scope §11.8, V5: «Führungs-Reaktionszeiten werden mit denselben
-- Instrumenten sichtbar wie Mitglieder-Signale – Antwortzeit des Vorstands auf
-- Inputs, Triage-Zeit der Trainer auf Fürsorge-Hinweise, Vakanz-Dauer von
-- Ämtern.» Bisher gab es die Signale (K5), aber keine Zahlen dazu.
--
-- Drei Kennzahlen aus Daten, die es schon gibt – nichts Neues wird erhoben:
--   Inputs:   wie lange bis zur dokumentierten Antwort (letzte 180 Tage),
--             wie viele offen, wie viele länger als 14 Tage offen;
--   Hinweise: wie viele Fürsorge-Hinweise offen, der älteste in Tagen;
--   Ämter:    wie viele vakant, im Schnitt seit wie vielen Tagen.
--
-- Vakanz-Dauer ist eine Näherung: Ein Amt ohne Inhaber:in zählt ab dem Tag,
-- an dem es angelegt oder die letzte Zuordnung gelöst wurde – beides steht
-- nicht getrennt; genommen wird `created_at`. Der Katalog kennt keine
-- Vakanz-Historie (K4 ist auf Nachfolge-Vorlauf beschränkt).
--
-- Nur der Vorstand liest die Zahlen – sie handeln von ihm selbst; das ist der
-- Sinn der Symmetrie. Keine Personen, nur Summen: Signal, kein Urteil (K5).
-- ============================================================================

create or replace function public.board_response_metrics(p_club_id uuid)
returns table (
  inputs_answered   int,
  inputs_avg_hours  numeric,
  inputs_open       int,
  inputs_overdue    int,
  signals_open      int,
  signals_oldest_days int,
  vacancies         int,
  vacancy_avg_days  numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand sieht seine Reaktionszeiten';
  end if;

  return query
  select
    (select count(*)::int from meeting_inputs i
      where i.club_id = p_club_id
        and i.responded_at is not null
        and i.created_at >= now() - interval '180 days'),
    (select round(avg(extract(epoch from (i.responded_at - i.created_at)) / 3600)::numeric, 1)
       from meeting_inputs i
      where i.club_id = p_club_id
        and i.responded_at is not null
        and i.created_at >= now() - interval '180 days'),
    (select count(*)::int from meeting_inputs i
      where i.club_id = p_club_id
        and i.status in ('open', 'scheduled', 'in_progress')),
    (select count(*)::int from meeting_inputs i
      where i.club_id = p_club_id
        and i.status in ('open', 'scheduled', 'in_progress')
        and i.created_at < now() - interval '14 days'),
    (select count(*)::int from health_signals s
      where s.club_id = p_club_id and s.status = 'open'),
    (select coalesce(max(extract(day from now() - s.detected_at))::int, 0)
       from health_signals s
      where s.club_id = p_club_id and s.status = 'open'),
    (select count(*)::int from functionary_roles r
      where r.club_id = p_club_id and r.holder_member_id is null),
    (select round(avg(extract(epoch from (now() - r.created_at)) / 86400)::numeric, 0)
       from functionary_roles r
      where r.club_id = p_club_id and r.holder_member_id is null);
end;
$$;

revoke execute on function public.board_response_metrics(uuid) from public, anon;
grant  execute on function public.board_response_metrics(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Nachtrag zu 0064: `training_streak()` ist über PostgREST erreichbar und
-- verriet damit die Trainingsserie **jeder** Person. Jetzt: die eigene, oder
-- als Trainer:in/Vorstand des Vereins – der Lauf (ohne Sitzung) bleibt frei.
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

  if auth.uid() is not null
     and v_member.user_id is distinct from auth.uid()
     and not is_club_trainer(v_member.club_id) then
    return 0;
  end if;

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
    end if;

    v_week := v_week - 7;
  end loop;

  return v_streak;
end;
$$;

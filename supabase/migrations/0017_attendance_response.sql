-- ============================================================================
-- 0017_attendance_response: Auf einen Termin zu- oder absagen (UC-010)
--
-- Die Antwort läuft heute als direkter Upsert auf `attendance`. Das trägt den
-- Hauptablauf, aber nicht die Regeln drumherum:
--   BR-038  Die Antwort ist bis Terminbeginn änderbar, danach zählt die
--           tatsächliche Anwesenheit.
--   BR-040  Punkte für eine rechtzeitige Abmeldung entstehen nur bei einer
--           Absage mehr als 24 Stunden vorher – und nur einmal je Termin.
--   A3      Ein abgesagter Termin nimmt keine Antworten mehr entgegen.
--
-- All das gehört auf den Server: Ein Client, der die Frist selbst rechnet,
-- kann sie auch umgehen (C-010, C-011).
-- ============================================================================

-- Das Entitätsmodell nennt das Feld `decline_reason`; `reason` aus 0003 war
-- allgemeiner gemeint. Umbenennen statt danebenlegen, damit es nur eines gibt.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'attendance' and column_name = 'reason'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'attendance' and column_name = 'decline_reason'
  ) then
    alter table attendance rename column reason to decline_reason;
  end if;
end $$;

alter table attendance add column if not exists decline_reason text;
alter table attendance add column if not exists responded_at timestamptz;

-- Die Regel für die rechtzeitige Abmeldung gehört zur Verlässlichkeit
-- (Säule 6). Bestehende Vereine bekommen sie hier, neue über
-- seed_point_rules().
insert into point_rules (club_id, pillar, code, label, points, is_active)
select c.id, 6, 'decline_early', 'Rechtzeitig abgemeldet', 5, true
from clubs c
where not exists (
  select 1 from point_rules r where r.club_id = c.id and r.code = 'decline_early'
);

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
end;
$$;

-- ---------------------------------------------------------------------------
-- Frist der Abmeldeprämie (BR-040). Eigene Funktion, damit die App dieselbe
-- Grenze anzeigen kann, die der Server anwendet.
-- ---------------------------------------------------------------------------
create or replace function public.decline_is_early(p_starts_at timestamptz)
returns boolean
language sql
immutable
as $$
  select p_starts_at - now() > interval '24 hours';
$$;

-- ---------------------------------------------------------------------------
-- Zu- oder absagen.
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_event(
  p_event_id uuid,
  p_status   text,
  p_reason   text default null
)
returns table (points_awarded int, is_early boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_member uuid;
  v_early  boolean;
  v_points int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  -- A3: Ein abgesagter Termin nimmt keine Antworten mehr entgegen.
  if v_event.cancelled_at is not null then
    raise exception 'Dieser Termin wurde abgesagt';
  end if;

  -- BR-038: Bis Terminbeginn änderbar; danach zählt die Anwesenheit.
  if v_event.starts_at <= now() then
    raise exception 'Der Termin hat begonnen; jetzt zählt die Anwesenheit';
  end if;

  -- Der Status `present` bleibt dem Check-in und der Bestätigung vorbehalten.
  if p_status not in ('registered', 'excused') then
    raise exception 'Unzulässige Antwort: %', p_status;
  end if;

  v_member := current_member_id(v_event.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  v_early := decline_is_early(v_event.starts_at);

  -- BR-037: Eine Antwort je Mitglied und Termin; eine neue ersetzt die alte.
  insert into attendance (event_id, member_id, status, decline_reason, responded_at)
  values (
    p_event_id, v_member, p_status,
    case when p_status = 'excused' then nullif(trim(coalesce(p_reason, '')), '') end,
    now()
  )
  on conflict (event_id, member_id) do update
    set status         = excluded.status,
        decline_reason = excluded.decline_reason,
        responded_at   = excluded.responded_at;

  -- A1 Schritt 4 und BR-040: Punkte nur bei rechtzeitiger Absage. Die
  -- Dedup-Regel des Ledgers über (member, rule, source) sorgt dafür, dass
  -- sie je Termin höchstens einmal entstehen – auch wenn jemand zwischen
  -- Zusage und Absage hin und her wechselt (A2).
  if p_status = 'excused' and v_early then
    v_points := award_points(v_member, 'decline_early', 'attendance', p_event_id, null);
  end if;

  -- BR-039: Eine Absage führt nie zu einem Punkteabzug. Es gibt hier keinen
  -- Zweig, der Punkte entzieht – das ist die ganze Umsetzung dieser Regel.
  return query select v_points, v_early;
end;
$$;

revoke execute on function public.decline_is_early(timestamptz) from public, anon;
grant  execute on function public.decline_is_early(timestamptz) to authenticated;

revoke execute on function public.respond_to_event(uuid, text, text) from public, anon;
grant  execute on function public.respond_to_event(uuid, text, text) to authenticated;

-- ============================================================================
-- 0097_next_contributions_one_per_event: höchstens ein Schicht-Vorschlag
--                                        je Termin (UC-020, BR-083)
--
-- `next_contributions()` gibt für jede unterbesetzte Schicht eine Zeile zurück
-- – und trägt als `ref_id` bewusst nicht die Schicht, sondern ihren **Termin**,
-- weil der Vorschlag in die Agenda führt (siehe `0037`). Beides zusammen heisst:
-- Ein Helferanlass mit zwölf Schichten liefert bis zu zwölf Zeilen mit
-- derselben Kennung.
--
-- Nachgemessen am Anlass «Heimrunde Junioren D» (zwölf Schichten, mehrere
-- unterbesetzt): Die Liste der fünf nächsten Beiträge bestand aus fünf
-- Zeilen desselben Anlasses. Im Browser meldete React zusätzlich
-- «Encountered two children with the same key, `shift-<Termin-Id>`» – die
-- Anzeige führt `kind` und `ref_id` als Schlüssel, und der war doppelt.
--
-- Der Schnitt liegt in der Abfrage, nicht in der Anzeige: Wenn alle Zeilen
-- an dieselbe Adresse führen, ist die zweite keine zweite Auskunft. Ab hier
-- steht je Termin die **früheste** unterbesetzte Schicht – dieselbe Regel wie
-- die Sortierung der ganzen Liste: Was zuerst drängt, steht vorn. Wer den
-- Vorschlag antippt, sieht am Termin ohnehin alle offenen Schichten.
-- ============================================================================

create or replace function public.next_contributions(
  p_club_id uuid,
  p_limit   int default 5
)
returns table (
  kind    text,
  ref_id  uuid,
  title   text,
  detail  text,
  points  int,
  when_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid;
begin
  v_member := current_member_id(p_club_id);
  if v_member is null then
    return;
  end if;

  return query
  -- a) Der nächste Termin, auf den ich noch nicht geantwortet habe.
  with events_open as (
    select
      'event'::text as kind,
      e.id as ref_id,
      e.title,
      e.type as detail,
      (select r.points from point_rules r
        where r.club_id = e.club_id and r.code = e.point_rule_code and r.is_active) as points,
      e.starts_at as when_at
    from events e
    left join team_members tm
      on tm.team_id = e.team_id and tm.member_id = v_member
    where e.club_id = p_club_id
      and e.published_at is not null
      and e.cancelled_at is null
      and not e.is_sample
      and e.starts_at > now()
      -- Ein Helfer-Event ist kein Vorschlag: Der Beitrag ist die Schicht, und
      -- die steht unten. Beides zu nennen hiesse, denselben Anlass zweimal
      -- vorzuschlagen – einmal sogar ohne Punktwert.
      and e.type <> 'helper'
      and (e.team_id is null or tm.member_id is not null)
      and not exists (
        select 1 from attendance a
         where a.event_id = e.id and a.member_id = v_member and a.shift_id is null
      )
  ),
  -- b) Schichten mit Unterdeckung, in die ich nicht eingetragen bin –
  --    höchstens eine je Termin (`distinct on`), die früheste. Ein Anlass mit
  --    einem Dutzend Schichten füllte sonst die ganze Liste, und weil alle
  --    Zeilen denselben Termin tragen, wäre es zwölfmal derselbe Vorschlag.
  shifts_open as (
    select distinct on (e.id)
      'shift'::text as kind,
      -- Nicht die Schicht, sondern ihr **Termin**: Der Vorschlag führt in die
      -- Agenda, und die hebt Termine hervor, nicht Schichten. Mit der
      -- Schicht-Id landete der Tipp auf einer Seite ohne Treffer.
      e.id as ref_id,
      s.title,
      e.title as detail,
      s.points,
      s.starts_at as when_at
    from event_shifts s
    join events e on e.id = s.event_id
    where e.club_id = p_club_id
      and e.published_at is not null
      and e.cancelled_at is null
      and not e.is_sample
      and s.starts_at > now()
      and s.needed > (
        select count(*) from attendance a
         where a.shift_id = s.id and a.status in ('registered','present')
      )
      and not exists (
        select 1 from attendance a
         where a.shift_id = s.id and a.member_id = v_member
      )
    -- `s.id` als letztes Glied, damit bei gleicher Anfangszeit immer dieselbe
    -- Schicht gewinnt: Ein Vorschlag, der bei jedem Abruf wechselt, sieht wie
    -- ein Fehler aus.
    order by e.id, s.starts_at, s.id
  ),
  -- c) Offene Aufgaben in meinem Geltungsbereich, die ich nicht halte.
  tasks_open as (
    select
      'task'::text as kind,
      t.id as ref_id,
      t.title,
      t.category as detail,
      t.points,
      t.due_at as when_at
    from tasks t
    where t.club_id = p_club_id
      and t.status = 'open'
      and not t.is_sample
      and task_in_scope(t.id)
      and t.max_assignees > (select count(*) from task_assignments a where a.task_id = t.id)
      and not exists (
        select 1 from task_assignments a
         where a.task_id = t.id and a.member_id = v_member
      )
  )
  select * from (
    select * from events_open
    union all select * from shifts_open
    union all select * from tasks_open
  ) all_open
  -- Ohne Datum steht ein Vorschlag hinten, nicht vorn: Was einen Termin hat,
  -- drängt.
  order by when_at nulls last
  limit greatest(coalesce(p_limit, 5), 1);
end;
$$;

revoke execute on function public.next_contributions(uuid, int) from public, anon;
grant  execute on function public.next_contributions(uuid, int) to authenticated;

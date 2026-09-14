-- ============================================================================
-- 0075_legacy_training_without_why: Übernommene Trainings ohne erfundenes Warum
--
-- BR-188 (UC-040) gibt einem Anlass oder Helfer-Event aus der bisherigen App
-- ohne Beschreibung den Satz «Aus der bisherigen myclub-App übernommen» als
-- Warum – weil BR-036 für Aufrufe ein Warum verlangt (`events_why_check`).
-- Ein Training ist kein Aufruf: Es darf ohne Warum stehen, und die App zeigt
-- den Abschnitt «Wozu dient das?» dann gar nicht. `0071` hat die Import-
-- funktion auf Trainings ausgedehnt, den Ersatzsatz aber nicht auf Aufrufe
-- beschränkt – seither trägt jedes übernommene Training den Satz.
--
-- Zwei Schritte: Die Funktion erfindet für Trainings kein Warum mehr, und die
-- schon übernommenen Trainings verlieren den Satz. Eine Beschreibung aus der
-- alten App bleibt, wo sie ist – nur der Ersatz fällt weg. Der nächtliche
-- Lauf überschreibt `why` ohnehin (BR-183); ohne diese Änderung käme der Satz
-- am nächsten Morgen zurück.
-- ============================================================================

-- Rumpf wie `0071`; geändert ist nur die Herleitung von `v_why`.
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
      greatest(coalesce((v_shift->>'points')::int, 0), 0),
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

-- `create or replace` behält die Rechte aus `0071`; hier noch einmal
-- ausgeschrieben, damit die Datei für sich allein lesbar ist (CLAUDE.md).
revoke execute on function public.upsert_legacy_event(
  uuid, text, text, text, text, timestamptz, timestamptz, text, int, boolean, text, jsonb, uuid)
  from public, anon, authenticated;
grant  execute on function public.upsert_legacy_event(
  uuid, text, text, text, text, timestamptz, timestamptz, text, int, boolean, text, jsonb, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Die schon übernommenen Trainings: nur der Ersatzsatz fällt weg. Ein Warum,
-- das jemand hier von Hand gesetzt hat, oder eine Beschreibung aus der alten
-- App trägt einen anderen Wortlaut und bleibt.
-- ---------------------------------------------------------------------------
update events
   set why = null
 where type = 'training'
   and external_id like 'legacy:training:%'
   and why = 'Aus der bisherigen myclub-App übernommen';

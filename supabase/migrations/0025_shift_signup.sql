-- ============================================================================
-- 0025_shift_signup: Eine Schicht übernehmen und wieder abgeben (UC-012)
--
-- Der Schlüssel von `attendance` stammt aus einer Zeit, in der die Tabelle nur
-- Zu- und Absagen zu Terminen trug. Dort ist «eine Antwort pro Person und
-- Termin» richtig. Für Schichten ist er falsch: A3 erlaubt ausdrücklich
-- mehrere Schichten desselben Anlasses, solange sie sich nicht überschneiden.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Der Schlüssel: eine Antwort je Termin, aber eine Zeile je Schicht.
--
-- `shift_id` ist nullbar, und ein Primärschlüssel duldet kein NULL. Also ein
-- Surrogatschlüssel plus ein eindeutiger Index mit `nulls not distinct` –
-- ohne diesen Zusatz behandelt Postgres zwei NULL-Werte als verschieden, und
-- jemand könnte demselben Termin beliebig oft zusagen.
-- ---------------------------------------------------------------------------
alter table attendance add column if not exists id uuid not null default gen_random_uuid();

alter table attendance drop constraint if exists attendance_pkey;
alter table attendance add primary key (id);

drop index if exists attendance_event_member_shift_idx;
create unique index attendance_event_member_shift_idx
  on attendance (event_id, member_id, shift_id) nulls not distinct;

-- ---------------------------------------------------------------------------
-- Die beiden bestehenden Upserts nennen `on conflict (event_id, member_id)`.
-- Ohne passenden eindeutigen Index scheitern sie zur Laufzeit; der Zielindex
-- heisst jetzt anders und trägt eine Spalte mehr.
-- ---------------------------------------------------------------------------
create or replace function public.check_in(p_event_id uuid, p_qr_token text)
returns table (points_awarded int, already_checked_in boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event    events;
  v_member   uuid;
  v_existing attendance;
  v_points   int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  v_member := current_member_id(v_event.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  if v_event.qr_token is distinct from p_qr_token then
    raise exception 'Dieser Code gehört nicht zu diesem Termin';
  end if;

  -- NFR-016: 30 Minuten vor Beginn bis Terminende.
  if now() < v_event.starts_at - interval '30 minutes'
     or now() > coalesce(v_event.ends_at, v_event.starts_at + interval '4 hours') then
    raise exception 'Der Code ist ausserhalb des Zeitfensters nicht gültig';
  end if;

  -- Der Check-in gilt dem Termin als Ganzem, nicht einer einzelnen Schicht.
  select * into v_existing
    from attendance
   where event_id = p_event_id and member_id = v_member and shift_id is null;

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

  return query select v_points, false;
end;
$$;

revoke execute on function public.check_in(uuid, text) from public, anon;
grant  execute on function public.check_in(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Zu- und Absage gelten weiterhin dem Termin, also der Zeile ohne Schicht.
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
  v_event   events;
  v_member  uuid;
  v_early   boolean := false;
  v_points  int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  if p_status not in ('registered','excused') then
    raise exception 'Unbekannte Antwort';
  end if;

  v_member := current_member_id(v_event.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  if v_event.cancelled_at is not null then
    raise exception 'Dieser Termin wurde abgesagt';
  end if;

  if v_event.starts_at <= now() then
    raise exception 'Der Termin hat begonnen; jetzt zählt die Anwesenheit';
  end if;

  if p_status = 'excused' then
    v_early := decline_is_early(v_event.starts_at);
  end if;

  insert into attendance (event_id, member_id, shift_id, status, decline_reason,
                          responded_at)
  values (p_event_id, v_member, null, p_status,
          case when p_status = 'excused' then p_reason end, now())
  on conflict (event_id, member_id, shift_id) do update
     set status = excluded.status,
         decline_reason = excluded.decline_reason,
         responded_at = excluded.responded_at;

  -- BR-040: Die Prämie entsteht einmal je Termin; der Ledger dedupliziert.
  if p_status = 'excused' and v_early then
    v_points := award_points(v_member, 'decline_early', 'attendance', p_event_id, null);
  end if;

  return query select v_points, v_early;
end;
$$;

revoke execute on function public.respond_to_event(uuid, text, text) from public, anon;
grant  execute on function public.respond_to_event(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Eine Schicht übernehmen (Schritte 3–5, A1, A4).
--
-- Die Besetzungsgrenze gehört auf den Server und hinter eine Sperre: Zwei
-- Personen, die gleichzeitig auf den letzten Platz tippen, würden sonst beide
-- durchkommen. `for update` auf der Schicht serialisiert genau diesen Fall.
-- ---------------------------------------------------------------------------
create or replace function public.take_shift(
  p_shift_id uuid,
  -- A4: Eine Überschneidung ist kein Verbot, sondern eine Rückfrage.
  p_accept_overlap boolean default false
)
returns table (filled int, needed int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shift  event_shifts;
  v_event  events;
  v_member uuid;
  v_filled int;
begin
  -- Die Sperre steht vor jeder Zählung, sonst zählt sie einen veralteten Stand.
  select * into v_shift from event_shifts where id = p_shift_id for update;
  if not found then
    raise exception 'Schicht nicht gefunden';
  end if;

  select * into v_event from events where id = v_shift.event_id;

  v_member := current_member_id(v_event.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  -- A2 aus UC-011: In einen Entwurf trägt sich niemand ein.
  if v_event.published_at is null then
    raise exception 'Dieser Aufruf ist noch nicht ausgeschrieben';
  end if;

  if v_event.cancelled_at is not null then
    raise exception 'Dieser Termin wurde abgesagt';
  end if;

  if v_shift.ends_at <= now() then
    raise exception 'Diese Schicht ist vorbei';
  end if;

  -- BR-046: Eine Schicht nimmt höchstens so viele Personen auf, wie sie braucht.
  -- Absagen belegen keinen Platz.
  select count(*) into v_filled
    from attendance
   where shift_id = p_shift_id and status in ('registered','present');

  if v_filled >= v_shift.needed
     and not exists (select 1 from attendance
                      where shift_id = p_shift_id and member_id = v_member) then
    raise exception 'Diese Schicht ist bereits voll';
  end if;

  -- A4: Überschneidet sie sich mit einer schon übernommenen Schicht? Berührung
  -- zählt nicht – wer um 12:00 aufhört und um 12:00 anfängt, hat zwei
  -- anschliessende Schichten.
  if not p_accept_overlap
     and exists (
       select 1
         from attendance a
         join event_shifts s on s.id = a.shift_id
        where a.member_id = v_member
          and a.shift_id is not null
          and a.shift_id <> p_shift_id
          and a.status in ('registered','present')
          and s.starts_at < v_shift.ends_at
          and s.ends_at   > v_shift.starts_at
     ) then
    raise exception 'overlap';
  end if;

  -- BR-045: Die Eintragung allein erzeugt keine Punkte. Sie entstehen erst
  -- mit der Bestätigung des tatsächlichen Einsatzes (UC-013).
  insert into attendance (event_id, member_id, shift_id, status, responded_at)
  values (v_shift.event_id, v_member, p_shift_id, 'registered', now())
  on conflict (event_id, member_id, shift_id) do update
     set status = 'registered', responded_at = now();

  select count(*) into v_filled
    from attendance
   where shift_id = p_shift_id and status in ('registered','present');

  return query select v_filled, v_shift.needed;
end;
$$;

revoke execute on function public.take_shift(uuid, boolean) from public, anon;
grant  execute on function public.take_shift(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Sich wieder austragen (A2, BR-047).
--
-- Keine Sperrfrist, kein Punkteabzug. Wird die Schicht dadurch kurzfristig
-- unterbesetzt, erfährt es die Organisation – das ist die einzige Folge.
-- ---------------------------------------------------------------------------
create or replace function public.release_shift(p_shift_id uuid)
returns table (filled int, needed int, warned boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shift   event_shifts;
  v_event   events;
  v_member  uuid;
  v_filled  int;
  v_warned  boolean := false;
  v_person  record;
begin
  select * into v_shift from event_shifts where id = p_shift_id;
  if not found then
    raise exception 'Schicht nicht gefunden';
  end if;

  select * into v_event from events where id = v_shift.event_id;
  v_member := current_member_id(v_event.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  delete from attendance
   where shift_id = p_shift_id and member_id = v_member;

  select count(*) into v_filled
    from attendance
   where shift_id = p_shift_id and status in ('registered','present');

  -- A2 Schritt 2: unterbesetzt **und** weniger als 48 Stunden bis zum Beginn.
  if v_filled < v_shift.needed
     and v_shift.starts_at - now() < interval '48 hours'
     and v_shift.starts_at > now() then
    for v_person in
      select cm.user_id
        from club_members cm
       where cm.club_id = v_event.club_id
         and cm.role in ('admin','superadmin')
         and cm.user_id is not null
    loop
      perform notify(
        v_person.user_id,
        'event',
        'Schicht ist unterbesetzt',
        v_shift.title || ' – ' || v_filled || ' von ' || v_shift.needed || ' besetzt',
        '/tabs/agenda',
        v_event.club_id
      );
      v_warned := true;
    end loop;
  end if;

  return query select v_filled, v_shift.needed, v_warned;
end;
$$;

revoke execute on function public.release_shift(uuid) from public, anon;
grant  execute on function public.release_shift(uuid) to authenticated;

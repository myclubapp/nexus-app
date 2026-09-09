-- ============================================================================
-- 0026_shift_signup_hardening: Nacharbeiten zur Umschlüsselung (UC-012)
--
-- 0025 hat `attendance` umgeschlüsselt und zwei der drei Schreibstellen
-- mitgezogen. Der Code-Review hat die dritte gefunden – und die Anzeigeseite,
-- an der die Besetzungsgrenze vorbeiführte.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Eine Schicht gehört zu ihrem Termin. Deklarativ, nicht per Konvention.
--
-- Ohne diese Bindung liess sich eine Zeile mit dem eigenen `event_id` und
-- einer **fremden** `shift_id` einfügen. `take_shift()` und `release_shift()`
-- zählen über `where shift_id = …` ohne Join – die fremde Schicht hätte als
-- besetzt gegolten.
--
-- Der zusammengesetzte Fremdschlüssel greift bei `match simple` nicht, wenn
-- eine Spalte NULL ist. Genau richtig: Die Zeile ohne Schicht (Zusage, Absage,
-- Check-in) bleibt erlaubt.
-- ---------------------------------------------------------------------------
alter table event_shifts drop constraint if exists event_shifts_id_event_key;
alter table event_shifts add constraint event_shifts_id_event_key
  unique (id, event_id);

-- Verwaiste Kombinationen zuerst begradigen, sonst scheitert der Schlüssel.
update attendance a
   set shift_id = null
 where a.shift_id is not null
   and not exists (select 1 from event_shifts s
                    where s.id = a.shift_id and s.event_id = a.event_id);

alter table attendance drop constraint if exists attendance_shift_event_fkey;
alter table attendance add constraint attendance_shift_event_fkey
  foreign key (shift_id, event_id) references event_shifts(id, event_id)
  on delete cascade;

-- ---------------------------------------------------------------------------
-- 2. Schichten schreibt nur `take_shift()`, nicht der Client.
--
-- Die Policies aus 0006 prüfen Mitgliedschaft und Status, aber nicht die
-- Besetzungsgrenze. Ein direkter POST auf /rest/v1/attendance mit einer
-- vollen `shift_id` ging damit durch, und ein PATCH konnte die eigene Zeile
-- auf eine andere Schicht umhängen. BR-046 stand nur in der Funktion, und an
-- der Funktion liess sich vorbeigehen.
--
-- Vorbild ist `task_assignments`: Das Übernehmen läuft über `claim_task()`,
-- der Client schreibt nicht selbst. Zu- und Absage bleiben direkt möglich –
-- dort gibt es keine Grenze zu wahren.
-- ---------------------------------------------------------------------------
drop policy if exists attendance_write_self on attendance;
create policy attendance_write_self on attendance
  for insert with check (
    member_id = (select current_member_id(e.club_id) from events e where e.id = event_id)
    and status in ('registered','excused','absent')
    and shift_id is null
    and exists (select 1 from events e
                 where e.id = event_id and e.published_at is not null)
  );

drop policy if exists attendance_update_self on attendance;
create policy attendance_update_self on attendance
  for update using (
    member_id = (select current_member_id(e.club_id) from events e where e.id = event_id)
    and shift_id is null
  ) with check (
    member_id = (select current_member_id(e.club_id) from events e where e.id = event_id)
    and status in ('registered','excused','absent')
    and shift_id is null
  );

-- ---------------------------------------------------------------------------
-- 3. `take_shift()`: die Ausnahme für Eingetragene war zu weit.
--
-- Sie prüfte nur, *ob* eine Zeile besteht, nicht welchen Status sie trägt.
-- Wer sich auf `excused` setzte, gab den Platz frei – zwei andere rückten
-- nach – und holte ihn sich mit `take_shift` zurück: drei Personen auf zwei
-- Plätzen. Derselbe Ablauf entsteht ohne Absicht, wenn der Vorstand jemanden
-- auf `absent` setzt.
--
-- Dazu N4: Ein bestätigter Einsatz (`present`) wird nicht zurückgestuft.
-- ---------------------------------------------------------------------------
create or replace function public.take_shift(
  p_shift_id uuid,
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
  select * into v_shift from event_shifts where id = p_shift_id for update;
  if not found then
    raise exception 'Schicht nicht gefunden';
  end if;

  select * into v_event from events where id = v_shift.event_id;

  v_member := current_member_id(v_event.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  if v_event.published_at is null then
    raise exception 'Dieser Aufruf ist noch nicht ausgeschrieben';
  end if;

  if v_event.cancelled_at is not null then
    raise exception 'Dieser Termin wurde abgesagt';
  end if;

  if v_shift.ends_at <= now() then
    raise exception 'Diese Schicht ist vorbei';
  end if;

  -- Wer bereits bestätigt ist, hat den Einsatz hinter sich.
  if exists (select 1 from attendance
              where shift_id = p_shift_id and member_id = v_member
                and status = 'present') then
    raise exception 'Dieser Einsatz ist bereits bestätigt';
  end if;

  -- BR-046: Absagen belegen keinen Platz – deshalb zählt nur, wer zählt.
  select count(*) into v_filled
    from attendance
   where shift_id = p_shift_id and status in ('registered','present');

  -- Die Ausnahme gilt nur, wer den Platz **belegt**. Eine Zeile auf `excused`
  -- oder `absent` ist kein Platz, sondern seine Rückgabe.
  if v_filled >= v_shift.needed
     and not exists (select 1 from attendance
                      where shift_id = p_shift_id and member_id = v_member
                        and status in ('registered','present')) then
    raise exception 'Diese Schicht ist bereits voll';
  end if;

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

  -- BR-045: Die Eintragung allein erzeugt keine Punkte.
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
-- 4. `release_shift()`: nur melden, wenn tatsächlich etwas frei wurde.
--
-- Die Meldung hing allein am Zustand der Schicht, nicht am eigenen Austrag.
-- Wer nie eingetragen war, konnte den Aufruf wiederholen und jedem Mitglied
-- des Vorstands beliebig viele Benachrichtigungen schicken.
--
-- Dazu M8: Ein bestätigter Einsatz wird nicht gelöscht. BR-047 meint das
-- Austragen aus einer bevorstehenden Schicht; der Beleg zu einer Buchung
-- darf nicht verschwinden, sonst lässt sich nicht mehr zeigen, wofür es
-- Punkte gab (UC-025).
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
  v_deleted int;
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

  if exists (select 1 from attendance
              where shift_id = p_shift_id and member_id = v_member
                and status = 'present') then
    raise exception 'Ein bestätigter Einsatz lässt sich nicht zurücknehmen';
  end if;

  delete from attendance
   where shift_id = p_shift_id and member_id = v_member;
  get diagnostics v_deleted = row_count;

  select count(*) into v_filled
    from attendance
   where shift_id = p_shift_id and status in ('registered','present');

  -- Wer nichts ausgetragen hat, löst auch keine Meldung aus.
  if v_deleted = 0 then
    return query select v_filled, v_shift.needed, false;
    return;
  end if;

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

-- ---------------------------------------------------------------------------
-- 5. `check_in()`: die Standarddauer sind drei Stunden, nicht vier.
--
-- 0025 musste die Funktion wegen `on conflict` ohnehin anfassen und hat dabei
-- das Zeitfenster auf NFR-016 gebracht – aber mit vier Stunden Ersatzdauer.
-- BR-054 nennt drei. Sonst unverändert.
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

  -- NFR-016 und BR-054: 30 Minuten vor Beginn bis Terminende; ohne Endzeit
  -- gilt eine Standarddauer von drei Stunden.
  if now() < v_event.starts_at - interval '30 minutes'
     or now() > coalesce(v_event.ends_at, v_event.starts_at + interval '3 hours') then
    raise exception 'Der Code ist ausserhalb des Zeitfensters nicht gültig';
  end if;

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
-- 6. `confirm_shift()`: die dritte Schreibstelle, und zugleich BR-042.
--
-- Die Funktion aus 0003 findet ihre Zeile über `(event_id, member_id)`. Seit
-- 0025 gibt es davon mehrere, und plpgsql nimmt bei `select … into` still eine
-- beliebige: Getroffen wurde vielleicht die Zeile ohne Schicht, das `update`
-- setzte **alle** Zeilen der Person auf `present`, und gebucht wurde mit
-- `source_id = event_id`.
--
-- Der letzte Punkt ist zugleich die offene Stelle aus UC-011: Der Ledger
-- dedupliziert über `(member_id, rule_code, source_id)`, und alle Schichten
-- tragen denselben Regelcode. Zwei Schichten desselben Anlasses ergaben damit
-- **eine** Buchung – BR-042 («ein halber Tag zählt anders als ein ganzer»)
-- war so gar nicht erfüllbar.
--
-- Die neue Fassung nimmt die Schicht als Bezugsgrösse: Sie identifiziert die
-- Zeile eindeutig, sie trägt den Punktwert (0019), und als `source_id` macht
-- sie jede Schicht zu einer eigenen Quelle.
-- ---------------------------------------------------------------------------
-- `create or replace` kann Parameternamen nicht ändern; aus `p_event_id`
-- wird `p_shift_id`. Also erst weg, dann neu – nebenbei ist damit die alte,
-- falsche Fassung sicher nicht mehr unter /rest/v1/rpc/ erreichbar.
drop function if exists public.confirm_shift(uuid, uuid);

create function public.confirm_shift(p_shift_id uuid, p_member_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shift     event_shifts;
  v_event     events;
  v_confirmer uuid;
  v_existing  attendance;
begin
  select * into v_shift from event_shifts where id = p_shift_id;
  if not found then
    raise exception 'Schicht nicht gefunden';
  end if;

  select * into v_event from events where id = v_shift.event_id;

  if not is_club_admin(v_event.club_id) then
    raise exception 'Nur der Vorstand kann Schichten bestätigen';
  end if;

  select * into v_existing
    from attendance
   where shift_id = p_shift_id and member_id = p_member_id;
  if not found then
    raise exception 'Für diese Schicht besteht keine Eintragung';
  end if;

  v_confirmer := current_member_id(v_event.club_id);

  update attendance
     set status = 'present',
         confirmed_by = v_confirmer,
         checked_in_at = coalesce(checked_in_at, now())
   where shift_id = p_shift_id and member_id = p_member_id;

  -- BR-042: der Punktwert **der Schicht**, nicht der der Regel. Wie die
  -- Aufgabe trägt die Schicht ihren Wert selbst (0019), der Regelcode liefert
  -- nur die Säule fürs Reporting – deshalb wird direkt gebucht statt über
  -- `award_points()`, das den Regelwert nähme (CLAUDE.md).
  --
  -- `source_id` ist die **Schicht**. Der Dedupe-Index läuft über
  -- (member_id, rule_code, source_id); mit der Event-ID ergäben zwei
  -- Schichten desselben Anlasses eine einzige Buchung.
  insert into point_transactions
    (club_id, member_id, rule_code, points, season, source_type, source_id, note)
  values
    (v_event.club_id, p_member_id, v_shift.point_rule_code, v_shift.points,
     season_label(v_event.club_id), 'shift', p_shift_id, v_shift.title)
  on conflict do nothing;

  if not found then
    return 0;
  end if;

  return v_shift.points;
end;
$$;

revoke execute on function public.confirm_shift(uuid, uuid) from public, anon;
grant  execute on function public.confirm_shift(uuid, uuid) to authenticated;

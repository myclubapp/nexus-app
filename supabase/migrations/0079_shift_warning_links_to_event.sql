-- ============================================================================
-- 0079_shift_warning_links_to_event: Auch die Warnung «Schicht ist
-- unterbesetzt» führt zum Termin
--
-- Nachtrag zu 0078. Dort haben `cancel_event()` und `announce_event()` die
-- Kennung in den Verweis bekommen; `release_shift()` (0077) blieb aussen vor,
-- weil unklar war, wer an der Funktion arbeitet. Geklärt: niemand.
--
-- Die Meldung meint eine bestimmte Schicht an einem bestimmten Termin – und
-- geht an den Vorstand, der etwas tun soll. `/tabs/agenda` legte ihm die ganze
-- Liste vor; mit der Kennung öffnet sich der Termin als Blatt, samt Zeile zu
-- den Schichten (`linkTarget()` in `src/lib/linkTarget.ts`, `LinkedDetail`).
--
-- Nur der Verweis ändert sich. Der Rest ist wortgleich zu 0077, damit ein Diff
-- zeigt, dass die Absage-Logik unberührt bleibt.
-- ============================================================================

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
  v_before  text;
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

  select status into v_before
    from attendance
   where shift_id = p_shift_id and member_id = v_member;

  if v_before = 'present' then
    raise exception 'Ein bestätigter Einsatz lässt sich nicht zurücknehmen';
  end if;

  -- Eine Absage ohne vorherige Eintragung ist ein neuer Eintrag. Sie setzt
  -- deshalb voraus, dass der Aufruf überhaupt läuft – dieselben zwei
  -- Bedingungen, die `take_shift()` ans Übernehmen knüpft. Wer bereits eine
  -- Zeile hat, kommt auch aus einem abgesagten Termin wieder heraus.
  if v_before is null then
    if v_event.published_at is null then
      raise exception 'Dieser Aufruf ist noch nicht ausgeschrieben';
    end if;
    if v_event.cancelled_at is not null then
      raise exception 'Dieser Termin wurde abgesagt';
    end if;
  end if;

  insert into attendance (event_id, member_id, shift_id, status, responded_at)
  values (v_shift.event_id, v_member, p_shift_id, 'excused', now())
  on conflict (event_id, member_id, shift_id) do update
     set status = 'excused', responded_at = now();

  select count(*) into v_filled
    from attendance
   where shift_id = p_shift_id and status in ('registered','present');

  -- Wer keinen Platz belegt hatte, gibt auch keinen zurück.
  if v_before is distinct from 'registered' then
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
        '/tabs/agenda?event=' || v_event.id,
        v_event.club_id
      );
      v_warned := true;
    end loop;
  end if;

  return query select v_filled, v_shift.needed, v_warned;
end;
$$;

-- `create or replace` lässt die Rechte stehen; sie hier trotzdem nochmals,
-- weil eine `security definer`-Funktion ohne `revoke` als offener Endpunkt
-- unter `/rest/v1/rpc/` hinge (CLAUDE.md, 0007_function_grants).
revoke execute on function public.release_shift(uuid) from public, anon;
grant  execute on function public.release_shift(uuid) to authenticated;

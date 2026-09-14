-- ---------------------------------------------------------------------------
-- 0077: Die Absage an einer Schicht wird festgehalten (UC-012, A2).
--
-- Bisher löschte `release_shift()` die Zeile in `attendance`. Damit war die
-- Entscheidung «ich kann hier nicht» nach dem Neuladen verschwunden: Die
-- Schicht stand wieder auf «noch frei», und wer sich schon entschieden hatte,
-- bekam dieselbe Frage erneut vorgelegt. Wer nie eingetragen war, konnte
-- überhaupt nicht absagen – es gab nichts zu löschen.
--
-- Neu setzt die Funktion den Stand auf `excused`: derselbe Stand, den der
-- Vorstand in der Einsatzliste vergibt (`set_shift_absence`, 0027), und
-- derselbe, den ein Termin für eine Absage trägt (0017). Eine Absage belegt
-- keinen Platz – `take_shift()` (0026), `shift_roster()` und `shiftCoverage()`
-- im Client zählen seit je nur `registered` und `present`. Die Schicht bleibt
-- also für andere offen, und wer abgesagt hat, kann sie später wieder
-- übernehmen: Genau diesen Weg hält 0026 schon offen.
--
-- Die Meldung an den Vorstand (A2: unterbesetzt **und** weniger als 48 Stunden
-- bis zum Beginn) hängt jetzt am **vorherigen** Stand. Nur wer eingetragen
-- war, gibt einen Platz zurück; eine Absage ohne vorherige Eintragung nimmt
-- niemandem etwas weg und meldet deshalb nichts.
--
-- BR-047 bleibt: keine Sperrfrist, kein Punkteabzug. BR-052 ebenso – ein
-- bestätigter Einsatz wird nicht zurückgenommen, sondern gegengebucht.
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
        '/tabs/agenda',
        v_event.club_id
      );
      v_warned := true;
    end loop;
  end if;

  return query select v_filled, v_shift.needed, v_warned;
end;
$$;

-- Wie bei jeder `security definer`-Funktion: Postgres vergibt `execute` an
-- PUBLIC, Supabase zusätzlich an `anon`. Ohne `revoke` hinge die Absage als
-- offener Endpunkt unter `/rest/v1/rpc/` (CLAUDE.md, 0007_function_grants).
revoke execute on function public.release_shift(uuid) from public, anon;
grant  execute on function public.release_shift(uuid) to authenticated;

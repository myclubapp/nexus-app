-- ============================================================================
-- 0028_shift_confirmation_rules: Die Regel gilt auch für die Schicht (UC-013)
--
-- `confirm_shift()` bucht seit 0026 direkt, weil die Schicht ihren Punktwert
-- selbst trägt (BR-042). Dabei ging verloren, was `award_points()` sonst
-- nebenbei prüft: ob es die Regel überhaupt noch gibt, ob sie aktiv ist und
-- ob ihre Häufigkeitsgrenze erreicht ist.
--
-- Der Punktwert bleibt der der Schicht. Geprüft wird die **Regel** – die
-- beiden Dinge stehen nicht im Widerspruch: Der Regelcode sagt, ob und wie oft
-- gebucht wird, die Schicht sagt, wie viel.
-- ============================================================================

-- Der Rückgabewert war mehrdeutig: 0 hiess «schon gebucht» **und** «gebucht,
-- Wert 0». Im Nur-Dank-Modus (FR-040) meldete die App deshalb «bereits
-- bestätigt», obwohl sie gerade zum ersten Mal bestätigt hatte.
drop function if exists public.confirm_shift(uuid, uuid);

create function public.confirm_shift(p_shift_id uuid, p_member_id uuid)
returns table (points int, booked boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shift     event_shifts;
  v_event     events;
  v_rule      point_rules;
  v_confirmer uuid;
  v_user      uuid;
  v_points    int := 0;
begin
  select * into v_shift from event_shifts where id = p_shift_id;
  if not found then
    raise exception 'Schicht nicht gefunden';
  end if;

  select * into v_event from events where id = v_shift.event_id;

  -- BR-053: Nur Verantwortliche bestätigen.
  if not is_club_admin(v_event.club_id) then
    raise exception 'Nur der Vorstand kann Schichten bestätigen';
  end if;

  if not exists (select 1 from club_members
                  where id = p_member_id and club_id = v_event.club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  v_confirmer := current_member_id(v_event.club_id);

  -- A2: Wer nicht eingetragen war, wird es jetzt – und ist im selben Zug
  -- bestätigt. Die Besetzungsgrenze gilt hier bewusst nicht: BR-046 schützt
  -- die Planung, nicht die Vergangenheit.
  insert into attendance (event_id, member_id, shift_id, status, confirmed_by,
                          checked_in_at)
  values (v_shift.event_id, p_member_id, p_shift_id, 'present', v_confirmer, now())
  on conflict (event_id, member_id, shift_id) do update
     set status = 'present',
         confirmed_by = v_confirmer,
         checked_in_at = coalesce(attendance.checked_in_at, now());

  -- Gibt es die Regel, und ist sie aktiv? Ohne sie vergibt der Verein für
  -- diesen Anlass keine Punkte – dieselbe Antwort, die `award_points()` gibt.
  -- Der Einsatz gilt trotzdem als bestätigt: Die Anerkennung hängt nicht an
  -- der Zahl (V7).
  select * into v_rule
    from point_rules
   where club_id = v_event.club_id
     and code = v_shift.point_rule_code
     and is_active;
  if not found then
    return query select 0, false;
    return;
  end if;

  -- BR-065: Häufigkeitsgrenzen gelten serverseitig. Sie hingen bisher an
  -- `award_points()` und damit gerade nicht an der Schicht – eine Grenze, die
  -- sich im Regel-UI setzen liess und wirkungslos blieb.
  if rule_limit_reached(p_member_id, v_rule) then
    return query select 0, false;
    return;
  end if;

  -- BR-042: der Punktwert **der Schicht**; der Regelcode liefert die Säule.
  -- BR-051: `source_id` ist die Schicht – der Dedupe-Index verwirft die
  -- zweite Buchung still (A3), hält aber zwei Schichten desselben Anlasses
  -- auseinander.
  insert into point_transactions
    (club_id, member_id, rule_code, points, season, source_type, source_id, note)
  values
    (v_event.club_id, p_member_id, v_shift.point_rule_code, v_shift.points,
     season_label(v_event.club_id), 'shift', p_shift_id, v_shift.title)
  on conflict do nothing;

  if not found then
    -- A3: schon gebucht. Der Status steht, eine zweite Nachricht unterbleibt.
    return query select 0, false;
    return;
  end if;

  v_points := v_shift.points;

  -- Schritt 5: die Gutschrift melden. Im Nur-Dank-Modus gibt es nichts
  -- gutzuschreiben – eine Nachricht «0 Punkte» wäre genau die Zahl, die V7
  -- vermeiden will.
  select user_id into v_user from club_members where id = p_member_id;
  if v_user is not null and v_points > 0 then
    perform notify(
      v_user,
      'points',
      'Einsatz bestätigt',
      v_shift.title || ' – ' || v_points || ' Punkte gutgeschrieben',
      '/tabs/profile',
      v_event.club_id
    );
  end if;

  return query select v_points, true;
end;
$$;

revoke execute on function public.confirm_shift(uuid, uuid) from public, anon;
grant  execute on function public.confirm_shift(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Schritt 2 und A2: Wer steht auf der Liste, und wen könnte man ergänzen?
--
-- A2 verlangt, dass der Vorstand jemanden **hinzufügt**. Dafür braucht das
-- Blatt die Mitglieder, die noch nicht auf der Liste stehen – und zwar
-- serverseitig gefiltert, damit die Rollenprüfung an einer Stelle bleibt.
-- ---------------------------------------------------------------------------
create or replace function public.shift_candidates(p_shift_id uuid)
returns table (member_id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_shift event_shifts;
  v_event events;
begin
  select * into v_shift from event_shifts where id = p_shift_id;
  if not found then
    raise exception 'Schicht nicht gefunden';
  end if;

  select * into v_event from events where id = v_shift.event_id;

  if not is_club_admin(v_event.club_id) then
    raise exception 'Nur der Vorstand sieht die Einsatzliste';
  end if;

  return query
    select cm.id, cm.display_name
      from club_members cm
     where cm.club_id = v_event.club_id
       and cm.status <> 'left'
       and not exists (select 1 from attendance a
                        where a.shift_id = p_shift_id and a.member_id = cm.id)
     order by cm.display_name;
end;
$$;

revoke execute on function public.shift_candidates(uuid) from public, anon;
grant  execute on function public.shift_candidates(uuid) to authenticated;

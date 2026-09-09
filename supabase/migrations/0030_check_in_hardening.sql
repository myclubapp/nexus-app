-- ============================================================================
-- 0030_check_in_hardening: Nacharbeiten zum Check-in (UC-014)
--
-- `check_in()` prüft, ob der Termin abgesagt wurde; `mark_attendance()` prüfte
-- es nicht. Über die REST-Schnittstelle liessen sich damit Punkte für einen
-- Anlass buchen, der nicht stattgefunden hat. Die Oberfläche verdeckt das – der
-- Endpunkt stand offen, und genau das ist der Grund, warum die Prüfung in die
-- Funktion gehört und nicht ins UI (C-011).
-- ============================================================================

create or replace function public.mark_attendance(
  p_event_id  uuid,
  p_member_id uuid,
  p_present   boolean default true
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_points int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  -- BR-033: Anwesenheit erfassen Trainer:innen und der Vorstand.
  if not is_club_trainer(v_event.club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand erfassen die Anwesenheit';
  end if;

  -- Ein Entwurf hat nicht stattgefunden, ein abgesagter Termin auch nicht.
  if v_event.published_at is null then
    raise exception 'Dieser Termin ist noch nicht ausgeschrieben';
  end if;

  if v_event.cancelled_at is not null then
    raise exception 'Dieser Termin wurde abgesagt';
  end if;

  if not exists (select 1 from club_members
                  where id = p_member_id and club_id = v_event.club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  -- Bei einem Team-Termin geht es um dieses Team. `event_roster()` filtert so,
  -- also darf die Erfassung nicht weiter reichen als die Liste, aus der sie
  -- aufgerufen wird.
  if v_event.team_id is not null
     and not exists (select 1 from team_members tm
                      where tm.member_id = p_member_id
                        and tm.team_id = v_event.team_id) then
    raise exception 'Dieses Mitglied gehört nicht zum Team des Termins';
  end if;

  if not p_present then
    -- Zurücknehmen heisst: kein Anwesenheitsvermerk mehr. Die Buchung bleibt –
    -- korrigiert wird sie mit einer Gegenbuchung (BR-052).
    update attendance
       set status = 'absent',
           confirmed_by = current_member_id(v_event.club_id)
     where event_id = p_event_id and member_id = p_member_id and shift_id is null;
    return 0;
  end if;

  insert into attendance (event_id, member_id, shift_id, status, checked_in_at,
                          confirmed_by)
  values (p_event_id, p_member_id, null, 'present', now(),
          current_member_id(v_event.club_id))
  on conflict (event_id, member_id, shift_id) do update
     set status = 'present',
         checked_in_at = coalesce(attendance.checked_in_at, now()),
         confirmed_by = current_member_id(v_event.club_id);

  -- BR-057: Der Ledger dedupliziert über (Mitglied, Regel, Termin) – doppelt
  -- gebucht wird auch dann nicht, wenn jemand zuerst scannt und die Trainer:in
  -- ihn danach nochmals markiert.
  if v_event.point_rule_code is not null then
    v_points := award_points(
      p_member_id, v_event.point_rule_code, 'attendance', p_event_id, null
    );
  end if;

  return v_points;
end;
$$;

revoke execute on function public.mark_attendance(uuid, uuid, boolean) from public, anon;
grant  execute on function public.mark_attendance(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Die Trigger-Funktion ist `security definer` und braucht denselben Entzug.
--
-- PostgREST veröffentlicht Funktionen mit Rückgabetyp `trigger` zwar nicht,
-- und Postgres lehnt den Direktaufruf ohnehin ab. Die Regel aus CLAUDE.md ist
-- aber ausnahmslos formuliert, damit man sie nicht jedes Mal neu abwägen muss.
-- ---------------------------------------------------------------------------
revoke execute on function public.issue_event_qr_token()
  from public, anon, authenticated;

-- ============================================================================
-- 0027_shift_confirmation: Den Einsatz bestätigen (UC-013)
--
-- Die Buchung selbst steht seit 0026 richtig: `confirm_shift()` nimmt den
-- Punktwert der Schicht und die Schicht als Quelle. Was fehlt, sind die
-- Schritte drumherum – die Zustellung an die bestätigte Person (Schritt 5),
-- der Weg für kurzfristig Eingesprungene (A2) und der für die, die nicht
-- erschienen sind (A1).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A1: Wer nicht da war, bekommt keine Punkte – aber einen Status.
--
-- Eine eigene Funktion und kein direktes `update`: Seit 0026 schreibt der
-- Client keine Schicht-Zeilen mehr, und diese Regel soll nicht die einzige
-- Ausnahme davon werden. Sie prüft ausserdem, dass hier **nur** die
-- Nicht-Anwesenheit gesetzt wird – `present` bleibt der Bestätigung
-- vorbehalten, die dabei bucht.
-- ---------------------------------------------------------------------------
create or replace function public.set_shift_absence(
  p_shift_id  uuid,
  p_member_id uuid,
  p_status    text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shift event_shifts;
  v_event events;
begin
  if p_status not in ('excused','absent') then
    raise exception 'Nur entschuldigt oder abwesend';
  end if;

  select * into v_shift from event_shifts where id = p_shift_id;
  if not found then
    raise exception 'Schicht nicht gefunden';
  end if;

  select * into v_event from events where id = v_shift.event_id;

  -- BR-053: Die Prüfung steht in der Funktion, nicht im UI.
  if not is_club_admin(v_event.club_id) then
    raise exception 'Nur der Vorstand kann Schichten bestätigen';
  end if;

  -- Eine bereits gebuchte Bestätigung wird nicht durch einen Statuswechsel
  -- zurückgenommen: BR-052 verlangt dafür eine Gegenbuchung (UC-021).
  if exists (select 1 from attendance
              where shift_id = p_shift_id and member_id = p_member_id
                and status = 'present') then
    raise exception 'Dieser Einsatz ist bestätigt; eine Korrektur braucht eine Gegenbuchung';
  end if;

  update attendance
     set status = p_status,
         confirmed_by = current_member_id(v_event.club_id)
   where shift_id = p_shift_id and member_id = p_member_id;

  if not found then
    raise exception 'Für diese Schicht besteht keine Eintragung';
  end if;
end;
$$;

revoke execute on function public.set_shift_absence(uuid, uuid, text) from public, anon;
grant  execute on function public.set_shift_absence(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Bestätigen, benachrichtigen – und A2 in derselben Bewegung.
--
-- Schritt 5 verlangt die Zustellung an die bestätigte Person: Eine Gutschrift,
-- von der niemand erfährt, ist keine Würdigung. Sie steht in derselben
-- Transaktion wie die Buchung, damit nicht das eine ohne das andere geschieht.
--
-- A2 «kurzfristig eingesprungen»: Wer mitgeholfen hat, ohne eingetragen zu
-- sein, wird eingetragen und bestätigt in einem Schritt. Die Besetzungsgrenze
-- gilt hier bewusst nicht – BR-046 schützt die Planung, nicht die Vergangenheit,
-- und wer da war, war da.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_shift(p_shift_id uuid, p_member_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shift     event_shifts;
  v_event     events;
  v_confirmer uuid;
  v_user      uuid;
  v_points    int;
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

  -- Das Mitglied muss zum selben Verein gehören – sonst liesse sich über eine
  -- fremde member_id in einen anderen Verein hineinbuchen.
  if not exists (select 1 from club_members
                  where id = p_member_id and club_id = v_event.club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  v_confirmer := current_member_id(v_event.club_id);

  -- A2: Wer nicht eingetragen war, wird es jetzt – und ist im selben Zug
  -- bestätigt.
  insert into attendance (event_id, member_id, shift_id, status, confirmed_by,
                          checked_in_at)
  values (v_shift.event_id, p_member_id, p_shift_id, 'present', v_confirmer, now())
  on conflict (event_id, member_id, shift_id) do update
     set status = 'present',
         confirmed_by = v_confirmer,
         checked_in_at = coalesce(attendance.checked_in_at, now());

  -- BR-042: der Punktwert **der Schicht**. Wie die Aufgabe trägt sie ihren
  -- Wert selbst (0019); der Regelcode liefert nur die Säule fürs Reporting.
  -- Deshalb wird direkt gebucht statt über `award_points()`, das den
  -- Regelwert nähme (CLAUDE.md).
  --
  -- BR-051: `source_id` ist die Schicht. Der Dedupe-Index über
  -- (member_id, rule_code, source_id) verwirft die zweite Buchung still (A3),
  -- hält aber zwei Schichten desselben Anlasses auseinander.
  insert into point_transactions
    (club_id, member_id, rule_code, points, season, source_type, source_id, note)
  values
    (v_event.club_id, p_member_id, v_shift.point_rule_code, v_shift.points,
     season_label(v_event.club_id), 'shift', p_shift_id, v_shift.title)
  on conflict do nothing;

  if not found then
    -- A3: schon gebucht. Der Status steht, eine zweite Nachricht unterbleibt.
    return 0;
  end if;

  v_points := v_shift.points;

  -- Schritt 5: die Gutschrift melden. Nur wenn wirklich gebucht wurde und
  -- der Wert nicht null ist – im Nur-Dank-Modus (FR-040) gibt es nichts
  -- gutzuschreiben, wohl aber einen bestätigten Einsatz.
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

  return v_points;
end;
$$;

revoke execute on function public.confirm_shift(uuid, uuid) from public, anon;
grant  execute on function public.confirm_shift(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Schritt 2: Wer ist für diese Schicht eingetragen?
--
-- Die Namen stehen in `club_members`, die Einträge in `attendance` – ein Join,
-- den der Client sonst über zwei Abfragen zusammensetzen müsste. Als Funktion,
-- weil sie zugleich die Rolle prüft: Die Anwesenheitsliste einer Schicht geht
-- den Verein nichts an, sie geht den Vorstand etwas an.
-- ---------------------------------------------------------------------------
create or replace function public.shift_roster(p_shift_id uuid)
returns table (
  member_id    uuid,
  display_name text,
  status       text,
  confirmed    boolean
)
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
    select cm.id, cm.display_name, a.status, a.status = 'present'
      from attendance a
      join club_members cm on cm.id = a.member_id
     where a.shift_id = p_shift_id
     order by cm.display_name;
end;
$$;

revoke execute on function public.shift_roster(uuid) from public, anon;
grant  execute on function public.shift_roster(uuid) to authenticated;

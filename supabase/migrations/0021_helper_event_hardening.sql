-- ============================================================================
-- 0021_helper_event_hardening: Nacharbeiten am Helferaufruf (UC-011)
--
-- Fünf Befunde des Code-Reviews zu 0018, alle am selben Ort: Der Aufruf war
-- richtig gedacht, aber an den Rändern zu weich.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Der Zähler war über die RPC-Schnittstelle offen.
--
-- `club_message_log_read` behält die Daten dem Vorstand des eigenen Vereins
-- vor. `last_connection_at()` und `call_is_muted()` sind `security definer`,
-- prüfen keine Rolle und standen `authenticated` offen – ein beliebiges
-- angemeldetes Konto konnte über /rest/v1/rpc mit einer fremden club_id genau
-- die Angaben abholen, die die Policy schützt (NFR-011).
--
-- Beide werden nur aus `publish_event()` gebraucht, also aus der eigenen
-- Definer-Kette. Damit ist der Entzug die ganze Lösung: Innerhalb einer
-- Definer-Funktion greift das Ausführungsrecht des Eigentümers.
-- ---------------------------------------------------------------------------
revoke execute on function public.last_connection_at(uuid)
  from public, anon, authenticated;
revoke execute on function public.call_is_muted(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Ausschreiben war wiederholbar – und damit auch die Benachrichtigung.
--
-- 0018 setzte `published_at` nur beim ersten Mal, kündigte aber jedes Mal an.
-- Ein zweiter Tipp auf «Ausschreiben», solange die Liste noch den alten Stand
-- zeigt, schickte allen Mitgliedern eine zweite Nachricht. `cancel_event()`
-- macht es an derselben Stelle ausdrücklich anders.
--
-- Dazu zwei Prüfungen, die fehlten: ein abgesagter Termin wird nicht mehr
-- ausgeschrieben, und ein Helferaufruf – der den ganzen Verein erreicht und
-- kein Team kennt – bleibt dem Vorstand vorbehalten, wie es die Precondition
-- von UC-011 verlangt.
-- ---------------------------------------------------------------------------
create or replace function public.publish_event(p_event_id uuid)
returns table (notified int, muted boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_muted  boolean;
  v_count  int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  -- UC-011 Precondition: Der Helferaufruf geht an den ganzen Verein.
  if v_event.type = 'helper' then
    if not is_club_admin(v_event.club_id) then
      raise exception 'Nur der Vorstand schreibt einen Helferaufruf aus';
    end if;
  elsif not is_club_trainer(v_event.club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand schreiben aus';
  end if;

  if v_event.cancelled_at is not null then
    raise exception 'Dieser Termin wurde abgesagt';
  end if;

  -- Zweimal ausschreiben ändert nichts und benachrichtigt niemanden erneut.
  if v_event.published_at is not null then
    return query select 0, false;
    return;
  end if;

  -- BR-043: Ein Aufruf ohne Sinnzusammenhang wird nicht publiziert. Der
  -- Constraint deckt das publizierte Event ab; hier steht es nochmals, weil
  -- ein Entwurf ohne Warum bis hierher kommen darf.
  if v_event.type in ('helper','gv','social')
     and coalesce(trim(v_event.why), '') = '' then
    raise exception 'Ein Aufruf braucht sein Warum, bevor er ausgeschrieben wird';
  end if;

  -- Ein Helfer-Event ohne Schicht wäre ein Aufruf, dem niemand folgen kann.
  if v_event.type = 'helper'
     and not exists (select 1 from event_shifts where event_id = p_event_id) then
    raise exception 'Ein Helfer-Event braucht mindestens eine Schicht';
  end if;

  update events set published_at = now() where id = p_event_id;

  v_muted := call_is_muted(v_event.club_id);

  -- A3: Bei aktiver sanfter Sperre bleibt das Event sichtbar, der Push
  -- unterbleibt. Der Zähler bekommt trotzdem seinen Eintrag – der Aufruf
  -- ist ergangen, auch wenn er leiser war.
  if not v_muted then
    select announce_event(p_event_id) into v_count;
  end if;

  perform log_club_message(v_event.club_id, 'call', 'event:' || v_event.type);

  return query select v_count, v_muted;
end;
$$;

revoke execute on function public.publish_event(uuid) from public, anon;
grant  execute on function public.publish_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Event und Schichten entstehen zusammen oder gar nicht.
--
-- Der Client legte zuerst das Event an und dann die Schichten. Bricht die
-- Verbindung dazwischen ab, bleibt ein Entwurf ohne Schichten zurück, den
-- niemand mehr löschen kann, und der zweite Versuch legt einen weiteren an.
--
-- Eine Funktion, eine Transaktion. Nebenbei erzwingt sie die Postcondition
-- «mindestens eine Schicht» schon beim Anlegen statt erst beim Publizieren.
-- ---------------------------------------------------------------------------
create or replace function public.create_helper_event(
  p_title    text,
  p_why      text,
  p_starts_at timestamptz,
  p_ends_at  timestamptz,
  p_location text,
  p_shifts   jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club   uuid;
  v_member uuid;
  v_event  uuid;
begin
  select cm.club_id, cm.id into v_club, v_member
    from club_members cm
   where cm.user_id = auth.uid()
     and cm.role in ('admin','superadmin')
   limit 1;

  if v_club is null then
    raise exception 'Nur der Vorstand schreibt einen Helferaufruf aus';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'Ein Helferaufruf braucht einen Titel';
  end if;

  if jsonb_typeof(p_shifts) <> 'array' or jsonb_array_length(p_shifts) = 0 then
    raise exception 'Ein Helfer-Event braucht mindestens eine Schicht';
  end if;

  -- Immer als Entwurf: `publish_event()` macht daraus einen Aufruf. So ist A2
  -- kein Sonderweg, sondern der Normalfall, bei dem der zweite Schritt
  -- einfach ausbleibt.
  insert into events (club_id, type, title, why, starts_at, ends_at, location,
                      created_by, published_at)
  values (v_club, 'helper', trim(p_title), nullif(trim(coalesce(p_why, '')), ''),
          p_starts_at, p_ends_at, nullif(trim(coalesce(p_location, '')), ''),
          v_member, null)
  returning id into v_event;

  insert into event_shifts (event_id, title, starts_at, ends_at, needed, points,
                            point_rule_code)
  select v_event,
         trim(s->>'title'),
         (s->>'starts_at')::timestamptz,
         (s->>'ends_at')::timestamptz,
         (s->>'needed')::int,
         (s->>'points')::int,
         coalesce(s->>'point_rule_code', 'shift_done')
    from jsonb_array_elements(p_shifts) as s;

  return v_event;
end;
$$;

revoke execute on function
  public.create_helper_event(text, text, timestamptz, timestamptz, text, jsonb)
  from public, anon;
grant execute on function
  public.create_helper_event(text, text, timestamptz, timestamptz, text, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Die Anwesenheits-Policies kannten den Entwurf nicht.
--
-- 0018 hat `events_read` und `shifts_read` am `published_at` aufgehängt,
-- `attendance` aber nicht. Wer die UUID eines Entwurfs kennt, konnte sich dort
-- eintragen. Schwer auszunutzen, aber eine Lücke in der Kette.
-- ---------------------------------------------------------------------------
drop policy if exists attendance_write_self on attendance;
create policy attendance_write_self on attendance
  for insert with check (
    member_id = (select current_member_id(e.club_id) from events e where e.id = event_id)
    and status in ('registered','excused','absent')
    and exists (select 1 from events e
                 where e.id = event_id and e.published_at is not null)
  );

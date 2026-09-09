-- ============================================================================
-- 0031_remind_undecided: Unentschlossene erinnern (UC-015)
--
-- Eine Erinnerung ist der leiseste Eingriff im ganzen System und der am
-- leichtesten zu missbrauchende: Ein Knopf, der jedem Mitglied eine Nachricht
-- schickt, wird ohne Grenze zum Ärgernis. Deshalb steht die Frist in der
-- Datenbank und nicht im Knopf (BR-060), und der Kreis der Empfänger ergibt
-- sich aus der Antwortlage, nicht aus einer Auswahl (BR-059).
-- ============================================================================

-- Schritt 7: Der Zeitpunkt gehört an den Termin – aus ihm ergibt sich A1.
alter table events add column if not exists reminded_at timestamptz;

-- ---------------------------------------------------------------------------
-- Wer hat noch nicht geantwortet?
--
-- Betroffen ist bei einem Team-Termin nur dieses Team, sonst der ganze Verein –
-- dieselbe Grundgesamtheit wie beim Teilnehmerstand. Nähme man immer die
-- Vereinsgrösse, erinnerte ein Team-Training den halben Verein.
-- ---------------------------------------------------------------------------
create or replace function public.count_undecided(p_event_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
    from club_members cm
   where cm.club_id = (select club_id from events where id = p_event_id)
     and cm.status <> 'left'
     and cm.user_id is not null
     and (
       (select team_id from events where id = p_event_id) is null
       or exists (select 1 from team_members tm
                   where tm.member_id = cm.id
                     and tm.team_id = (select team_id from events where id = p_event_id))
     )
     and not exists (
       select 1 from attendance a
        where a.event_id = p_event_id
          and a.member_id = cm.id
          and a.shift_id is null
     );
$$;

revoke execute on function public.count_undecided(uuid) from public, anon;
grant  execute on function public.count_undecided(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Erinnern (Schritte 3–7, A1, A2).
--
-- BR-061: Die Erinnerung ist eine Verbindung, kein Aufruf – sie zählt in
-- keiner Richtung. Deshalb **kein** `log_club_message()` hier: Ein Verein, der
-- nur noch erinnert, hat damit weder erzählt noch um Hilfe gebeten, und die
-- sanfte Sperre aus BR-044 soll das weder belohnen noch bestrafen.
-- ---------------------------------------------------------------------------
create or replace function public.remind_undecided(p_event_id uuid)
returns table (notified int, last_reminder timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_person record;
  v_count  int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  -- BR-033: Erinnern dürfen Trainer:innen und der Vorstand.
  if not is_club_trainer(v_event.club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand erinnern';
  end if;

  if v_event.published_at is null then
    raise exception 'Dieser Termin ist noch nicht ausgeschrieben';
  end if;

  if v_event.cancelled_at is not null then
    raise exception 'Dieser Termin wurde abgesagt';
  end if;

  if v_event.starts_at <= now() then
    raise exception 'Der Termin hat begonnen';
  end if;

  -- A1 und BR-060: höchstens alle 24 Stunden.
  if v_event.reminded_at is not null
     and now() - v_event.reminded_at < interval '24 hours' then
    return query select 0, v_event.reminded_at;
    return;
  end if;

  -- Beispielinhalte lösen keine Zustellung aus (BR-161).
  if v_event.is_sample then
    return query select 0, v_event.reminded_at;
    return;
  end if;

  -- BR-059: ausschliesslich Mitglieder ohne Antwort. Wer zu- oder abgesagt
  -- hat, wird nicht erneut angesprochen.
  for v_person in
    select cm.user_id
      from club_members cm
     where cm.club_id = v_event.club_id
       and cm.status <> 'left'
       and cm.user_id is not null
       and (v_event.team_id is null
            or exists (select 1 from team_members tm
                        where tm.member_id = cm.id and tm.team_id = v_event.team_id))
       and not exists (
         select 1 from attendance a
          where a.event_id = p_event_id
            and a.member_id = cm.id
            and a.shift_id is null
       )
  loop
    -- BR-062: Der Weg führt direkt zur Antwort, nicht in eine Suche.
    perform notify(
      v_person.user_id,
      'event',
      'Kommst du?',
      v_event.title || ' – ' ||
        to_char(v_event.starts_at at time zone 'Europe/Zurich', 'DD.MM.YYYY HH24:MI'),
      '/tabs/agenda?event=' || p_event_id,
      v_event.club_id
    );
    v_count := v_count + 1;
  end loop;

  -- A2: War niemand offen, gilt der Termin nicht als erinnert – sonst
  -- verbrauchte ein wirkungsloser Aufruf die Frist für einen wirksamen.
  if v_count = 0 then
    return query select 0, v_event.reminded_at;
    return;
  end if;

  update events set reminded_at = now() where id = p_event_id;

  return query select v_count, now();
end;
$$;

revoke execute on function public.remind_undecided(uuid) from public, anon;
grant  execute on function public.remind_undecided(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- A3: Die automatische Erinnerung.
--
-- Nur für Vereine, die sie ausdrücklich aktiviert haben – eine App, die von
-- sich aus Nachrichten verschickt, ist genau das, was der Entlastungstest
-- (K6b) verhindern soll. 48 Stunden vor Beginn, ein Lauf je Stunde.
-- ---------------------------------------------------------------------------
create or replace function public.send_due_reminders()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event record;
  v_count int := 0;
  v_sent  int;
begin
  for v_event in
    select e.id
      from events e
      join clubs c on c.id = e.club_id
     where e.published_at is not null
       and e.cancelled_at is null
       and not e.is_sample
       and e.starts_at > now()
       and e.starts_at <= now() + interval '48 hours'
       and (e.reminded_at is null or now() - e.reminded_at >= interval '24 hours')
       and coalesce((c.settings->'reminders'->>'autoRemind')::boolean, false)
  loop
    -- Dieselbe Routine wie beim Knopf: Sie kennt Frist, Kreis und Vermerk.
    -- Ein zweiter Weg mit eigener Logik liefe unweigerlich auseinander.
    select notified into v_sent from remind_undecided_internal(v_event.id);
    if v_sent > 0 then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- Der Cron-Lauf hat keine Sitzung und damit keine Rolle; `remind_undecided()`
-- verlangt aber eine Trainer:in. Deshalb eine interne Fassung ohne die
-- Rollenprüfung – und mit dem Entzug, der sie intern hält.
create or replace function public.remind_undecided_internal(p_event_id uuid)
returns table (notified int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_person record;
  v_count  int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    return query select 0;
    return;
  end if;

  if v_event.reminded_at is not null
     and now() - v_event.reminded_at < interval '24 hours' then
    return query select 0;
    return;
  end if;

  for v_person in
    select cm.user_id
      from club_members cm
     where cm.club_id = v_event.club_id
       and cm.status <> 'left'
       and cm.user_id is not null
       and (v_event.team_id is null
            or exists (select 1 from team_members tm
                        where tm.member_id = cm.id and tm.team_id = v_event.team_id))
       and not exists (
         select 1 from attendance a
          where a.event_id = p_event_id and a.member_id = cm.id and a.shift_id is null
       )
  loop
    perform notify(
      v_person.user_id, 'event', 'Kommst du?',
      v_event.title || ' – ' ||
        to_char(v_event.starts_at at time zone 'Europe/Zurich', 'DD.MM.YYYY HH24:MI'),
      '/tabs/agenda?event=' || p_event_id, v_event.club_id
    );
    v_count := v_count + 1;
  end loop;

  if v_count > 0 then
    update events set reminded_at = now() where id = p_event_id;
  end if;

  return query select v_count;
end;
$$;

revoke execute on function public.remind_undecided_internal(uuid)
  from public, anon, authenticated;
revoke execute on function public.send_due_reminders() from public, anon, authenticated;

-- `cron.schedule` ist über den Namen idempotent – ein zweiter Lauf der
-- Migration legt keinen zweiten Auftrag an.
select cron.schedule(
  'event-auto-reminders',
  '7 * * * *',
  $cron$select public.send_due_reminders();$cron$
);

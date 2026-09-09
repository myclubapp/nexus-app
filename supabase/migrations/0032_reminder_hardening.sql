-- ============================================================================
-- 0032_reminder_hardening: Eine Regel, einmal geschrieben (UC-015)
--
-- 0031 trug den Empfängerkreis zweimal: einmal in `remind_undecided()` mit
-- Rollenprüfung, einmal in `remind_undecided_internal()` für den Cron-Lauf,
-- der keine Sitzung und damit keine Rolle hat. Heute sind beide Fassungen
-- Zeichen für Zeichen gleich – morgen wäre es Zufall.
--
-- Die Auflösung geht in die umgekehrte Richtung als gebaut: Kreis **und**
-- Wächter gehören nach innen, und `remind_undecided()` wird die Hülle, die
-- die Rolle prüft. Die Rollenprüfung bleibt damit genau dort, wo sie war.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- `count_undecided()` war ein offener Endpunkt: `security definer`, für
-- `authenticated` freigegeben und ohne Mitgliedschaftsprüfung. Damit liess
-- sich mit einer fremden Termin-Id die Antwortlage eines fremden Vereins
-- abfragen – an der RLS vorbei, die genau das verhindern soll (NFR-011).
-- ---------------------------------------------------------------------------
create or replace function public.count_undecided(p_event_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_event events;
  v_count int;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  if not is_club_member(v_event.club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  select count(*)::int into v_count
    from club_members cm
   where cm.club_id = v_event.club_id
     and cm.status <> 'left'
     -- Wer kein Anmeldekonto hat, lässt sich nicht erreichen und zählt
     -- deshalb auch nicht als «noch offen».
     and cm.user_id is not null
     and (v_event.team_id is null
          or exists (select 1 from team_members tm
                      where tm.member_id = cm.id and tm.team_id = v_event.team_id))
     and not exists (
       select 1 from attendance a
        where a.event_id = p_event_id
          and a.member_id = cm.id
          and a.shift_id is null
     );

  return v_count;
end;
$$;

revoke execute on function public.count_undecided(uuid) from public, anon;
grant  execute on function public.count_undecided(uuid) to authenticated;

-- Der Rückgabetyp der internen Fassung wächst um den Zeitpunkt; `create or
-- replace` kann ihn nicht ändern. Erst weg, in Abhängigkeitsreihenfolge.
drop function if exists public.send_due_reminders();
drop function if exists public.remind_undecided_internal(uuid);

-- ---------------------------------------------------------------------------
-- Die eine Routine: Wächter, Frist, Kreis, Vermerk.
--
-- `for update` auf dem Termin serialisiert die Fristprüfung. Ohne die Sperre
-- lesen zwei Sitzungen – zwei Trainer:innen, oder eine Trainer:in gleichzeitig
-- mit dem Cron-Lauf – beide `reminded_at is null`, laufen beide durch die
-- Schleife, und jede unentschlossene Person bekommt zwei Nachrichten.
-- ---------------------------------------------------------------------------
create function public.remind_undecided_internal(p_event_id uuid)
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
  select * into v_event from events where id = p_event_id for update;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  -- Die Wächter stehen hier und nicht beim Aufrufer: Der Cron-Lauf filtert
  -- zwar auch, aber eine Regel, die von der `where`-Klausel ihres Aufrufers
  -- abhängt, gilt beim zweiten Aufrufer nicht mehr.
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
    return query select 0, null::timestamptz;
    return;
  end if;

  -- BR-059: ausschliesslich Mitglieder ohne Antwort auf den **Termin**. Eine
  -- übernommene Schicht ist keine Zusage zum Anlass – sie sagt, dass jemand
  -- hilft, nicht, dass er kommt.
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
    return query select 0, null::timestamptz;
    return;
  end if;

  update events set reminded_at = now() where id = p_event_id;

  return query select v_count, now();
end;
$$;

-- Die Hülle: prüft die Rolle und reicht durch.
create or replace function public.remind_undecided(p_event_id uuid)
returns table (notified int, last_reminder timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
begin
  select club_id into v_club from events where id = p_event_id;
  if v_club is null then
    raise exception 'Termin nicht gefunden';
  end if;

  -- BR-033: Erinnern dürfen Trainer:innen und der Vorstand.
  if not is_club_trainer(v_club) then
    raise exception 'Nur Trainer:innen und der Vorstand erinnern';
  end if;

  return query select * from remind_undecided_internal(p_event_id);
end;
$$;

revoke execute on function public.remind_undecided(uuid) from public, anon;
grant  execute on function public.remind_undecided(uuid) to authenticated;
revoke execute on function public.remind_undecided_internal(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A3: Der Cron-Lauf.
--
-- Ein Fehler an einem einzigen Termin riss bisher den ganzen Lauf mit: keine
-- Erinnerung für irgendeinen Verein, kein Vermerk, und der nächste Lauf
-- scheiterte an derselben Zeile wieder. Jetzt scheitert ein Termin für sich.
--
-- Ausgelöst wird **einmal**: A3 nennt den Moment «der Termin beginnt in 48
-- Stunden», nicht ein Fenster, das sich täglich wiederholt. Wer öfter erinnern
-- will, tut es von Hand.
-- ---------------------------------------------------------------------------
create or replace function public.send_due_reminders(p_limit int default 200)
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
       and e.reminded_at is null
       and coalesce((c.settings->'reminders'->>'autoRemind')::boolean, false)
     order by e.starts_at
     limit p_limit
  loop
    begin
      select notified into v_sent from remind_undecided_internal(v_event.id);
      if v_sent > 0 then
        v_count := v_count + 1;
      end if;
    exception when others then
      -- Ein Termin, an dem etwas klemmt, darf die übrigen nicht mitnehmen.
      raise warning 'Erinnerung zu % fehlgeschlagen: %', v_event.id, sqlerrm;
    end;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.send_due_reminders(int)
  from public, anon, authenticated;

select cron.unschedule('event-auto-reminders')
 where exists (select 1 from cron.job where jobname = 'event-auto-reminders');

select cron.schedule(
  'event-auto-reminders',
  '7 * * * *',
  $cron$select public.send_due_reminders();$cron$
);

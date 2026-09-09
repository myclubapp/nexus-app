-- ============================================================================
-- 0040_health_signals: Fürsorge-Hinweise erzeugen und triagieren (UC-023)
--
-- Ein Frühwarnsystem über Menschen kann Fürsorge sein oder Überwachung. Die
-- Spezifikation zieht die Grenze mit sechs Regeln, von denen fünf Verbote
-- sind – und diese Migration ist der Ort, an dem sie gelten:
--
--   BR-094  Nur Teilnahmedaten. Gelesen werden `attendance`, `events` und
--           `club_message_log`. Nichts sonst.
--   BR-096  Strikte Rollen-Reichweite – in der Policy, nicht in der Abfrage.
--   BR-097  Verfall statt Akte: gelöst heisst gelöscht.
--   BR-098  Keine automatischen Konsequenzen: Ein Signal bucht nichts, ändert
--           keinen Status und schreibt dem betroffenen Mitglied nicht.
--
-- `club_members.health_opt_out` steht seit 0013 und wurde von niemandem
-- gelesen. Ab hier wird es gelesen (A5).
-- ============================================================================

create table if not exists health_signals (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  -- Leer bei Vereinssignalen (A3).
  member_id   uuid references club_members(id) on delete cascade,
  team_id     uuid references teams(id) on delete cascade,
  signal_type text not null check (signal_type in (
    'attendance_drop','streak_broken','silent_churn','no_response',
    'invoice_overdue','comms_pause','connection_ratio',
    'inputs_unanswered','succession_gap'
  )),
  severity    text not null check (severity in ('info','attention','urgent')),
  -- Der **konkrete** Anlass, nicht der Ratschlag: «3 von 4 Terminen ohne
  -- Antwort». Die fürsorgliche Formulierung und die Gesprächsimpulse stehen in
  -- den Übersetzungen (BR-095) – ein deutscher Satz in der Datenbank wäre in
  -- drei von vier Sprachen falsch.
  detail      text not null,
  status      text not null default 'open'
                check (status in ('open','in_contact','resolved')),
  owned_by    uuid references club_members(id) on delete set null,
  detected_at timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days'
);

create index if not exists health_signals_club_idx
  on health_signals(club_id, status, detected_at desc);

-- Ein Signal je Anlass. Ohne diesen Index erzeugte jeder Lauf denselben
-- Hinweis erneut, und die Liste wäre nach einer Woche unlesbar.
create unique index if not exists health_signals_unique_idx
  on health_signals (club_id, signal_type, member_id, team_id)
  nulls not distinct;

alter table health_signals enable row level security;

-- ---------------------------------------------------------------------------
-- BR-096: Strikte Rollen-Reichweite.
--
-- Der Vorstand sieht den Verein. Trainer:innen sehen **ihr Team** – und ein
-- personenbezogenes Signal nur, wenn die Person in einem ihrer Teams ist.
-- Mitglieder sehen hier gar nichts; was der Verein über sie weiss, zeigt die
-- Transparenz-Seite (UC-025).
--
-- Als eigene Funktion, weil dieselbe Frage in der Policy **und** in
-- `set_signal_status()` beantwortet werden muss. Zwei Kopien wären zwei
-- Reichweiten.
-- ---------------------------------------------------------------------------
create or replace function public.health_signal_in_reach(p_signal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from health_signals s
     where s.id = p_signal_id
       and (
         is_club_admin(s.club_id)
         or (
           is_club_trainer(s.club_id)
           and (
             exists (
               select 1 from team_members tm
                where tm.team_id = s.team_id
                  and tm.member_id = current_member_id(s.club_id)
             )
             or (
               s.member_id is not null
               and exists (
                 select 1
                   from team_members mine
                   join team_members theirs on theirs.team_id = mine.team_id
                  where mine.member_id = current_member_id(s.club_id)
                    and theirs.member_id = s.member_id
               )
             )
           )
         )
       )
  );
$$;

drop policy if exists health_signals_read on health_signals;
create policy health_signals_read on health_signals
  for select using (health_signal_in_reach(id));

-- Geschrieben wird ausschliesslich aus den Funktionen unten.

-- ---------------------------------------------------------------------------
-- Die Schwellen.
--
-- Der Anforderungskatalog lässt sie ausdrücklich offen (offener Punkt 2,
-- FR-075). Sie stehen deshalb in den Vereinseinstellungen und sind änderbar,
-- bevor es eine Oberfläche dafür gibt – nicht als Zahl mitten im Code.
-- ---------------------------------------------------------------------------
create or replace function public.health_threshold(
  p_club_id uuid,
  p_key     text,
  p_default numeric
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select nullif(c.settings->'health'->'thresholds'->>p_key, '')::numeric
       from clubs c where c.id = p_club_id),
    p_default
  );
$$;

-- ---------------------------------------------------------------------------
-- Erzeugung (FR-062, FR-067).
--
-- Fünf Typen aus den Daten, die es gibt. `invoice_overdue`, `inputs_unanswered`,
-- `succession_gap` und `streak_broken` stehen im Constraint, aber ihre Module
-- existieren noch nicht – ein Signal ohne Datengrundlage wäre eine Behauptung.
--
-- A4: Der Deckel je Team. A5: Wer abbestellt hat, bekommt kein
-- personenbezogenes Signal – fliesst aber weiter in Aggregate ein.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Schritt 1: Die zuständigen Personen erfahren von einem neuen Hinweis.
--
-- Wer zuständig ist, sagt BR-096: Bei einem personenbezogenen Signal die
-- Trainer:innen der Teams, in denen die Person ist – bei einem Vereinssignal
-- der Vorstand (A3).
--
-- **Nicht** benachrichtigt wird das betroffene Mitglied. Ein Signal ist ein
-- Anlass für ein Gespräch unter Verantwortlichen, keine Mitteilung an die
-- Person (BR-098); was der Verein über sie weiss, zeigt ihr die
-- Transparenz-Seite (UC-025).
-- ---------------------------------------------------------------------------
create or replace function public.notify_signal_owners(p_signal_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_signal health_signals;
  v_person record;
  v_count  int := 0;
begin
  select * into v_signal from health_signals where id = p_signal_id;
  if not found then
    return 0;
  end if;

  for v_person in
    select distinct m.user_id
      from club_members m
     where m.club_id = v_signal.club_id
       and m.status <> 'left'
       and m.user_id is not null
       and (
         -- Vereinssignal: an den Vorstand.
         (v_signal.member_id is null and m.role in ('admin','superadmin'))
         -- Personenbezogenes Signal: an die Trainer:innen ihrer Teams **und**
         -- an den Vorstand, der die Ebene darüber ist.
         or (
           v_signal.member_id is not null
           and m.id <> v_signal.member_id
           and (
             m.role in ('admin','superadmin')
             or (
               m.role = 'trainer'
               and exists (
                 select 1
                   from team_members mine
                   join team_members theirs on theirs.team_id = mine.team_id
                  where mine.member_id = m.id
                    and theirs.member_id = v_signal.member_id
               )
             )
           )
         )
       )
  loop
    -- Der Text nennt keinen Namen: Eine Push-Nachricht landet auf einem
    -- Sperrbildschirm, den auch andere sehen (NFR-022).
    perform notify(
      v_person.user_id, 'health', 'Ein Hinweis wartet auf dich',
      null, '/tabs/profile/health', v_signal.club_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.detect_health_signals(p_club_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club     record;
  v_person   record;
  v_count    int := 0;
  v_max_open int;
  v_no_resp  int;
  v_days     int;
  v_drop     numeric;
  v_before   numeric;
  v_open     int;
  v_last     timestamptz;
  v_conn     int;
  v_calls    int;
begin
  for v_club in
    select c.id, c.settings from clubs c
     where p_club_id is null or c.id = p_club_id
  loop
    v_max_open := coalesce(
      nullif(v_club.settings->'health'->>'maxOpenPerTeam', '')::int, 5);
    v_no_resp  := health_threshold(v_club.id, 'noResponseEvents', 3)::int;
    v_days     := health_threshold(v_club.id, 'silentDays', 60)::int;
    v_drop     := health_threshold(v_club.id, 'attendanceDropTo', 0.5);
    v_before   := health_threshold(v_club.id, 'attendanceDropFrom', 0.7);

    -- ---- Personenbezogene Signale ----------------------------------------
    for v_person in
      select m.id as member_id,
             (select tm.team_id from team_members tm
               where tm.member_id = m.id limit 1) as team_id
        from club_members m
       where m.club_id = v_club.id
         and m.status = 'active'
         and m.user_id is not null
         -- A5/NFR-022: kein personenbezogenes Signal ohne Zustimmung.
         and not m.health_opt_out
    loop
      -- A4: Deckel je Team. Ist er erreicht, entsteht nichts Neues, bis
      -- triagiert wurde.
      select count(*) into v_open
        from health_signals s
       where s.club_id = v_club.id
         and s.status <> 'resolved'
         and s.team_id is not distinct from v_person.team_id;
      if v_open >= v_max_open then
        continue;
      end if;

      -- «Keine Reaktion»: die letzten N ausgeschriebenen Termine im
      -- Geltungsbereich der Person, alle ohne Antwort.
      declare
        v_events int;
        v_answered int;
        v_present int;
        v_total int;
      begin
        select count(*), count(*) filter (where a.id is not null)
          into v_events, v_answered
          from (
            select e.id
              from events e
              left join team_members tm
                on tm.team_id = e.team_id and tm.member_id = v_person.member_id
             where e.club_id = v_club.id
               and e.published_at is not null
               and e.cancelled_at is null
               and not e.is_sample
               and e.starts_at < now()
               and (e.team_id is null or tm.member_id is not null)
             order by e.starts_at desc
             limit v_no_resp
          ) recent
          left join attendance a
            on a.event_id = recent.id
           and a.member_id = v_person.member_id
           and a.shift_id is null;

        if v_events >= v_no_resp and v_answered = 0 then
          insert into health_signals
            (club_id, member_id, team_id, signal_type, severity, detail)
          values
            (v_club.id, v_person.member_id, v_person.team_id, 'no_response',
             'attention', v_events || '/' || v_events)
          on conflict do nothing;
          if found then
            v_count := v_count + 1;
            perform notify_signal_owners(
              (select id from health_signals
                where club_id = v_club.id and member_id = v_person.member_id
                  and signal_type = 'no_response'));
          end if;
          continue;
        end if;

        -- «Silent Churn»: seit N Tagen keine Anwesenheit und keine Antwort.
        if not exists (
          select 1 from attendance a
            join events e on e.id = a.event_id
           where a.member_id = v_person.member_id
             and e.club_id = v_club.id
             and coalesce(a.checked_in_at, e.starts_at) > now() - make_interval(days => v_days)
        ) then
          insert into health_signals
            (club_id, member_id, team_id, signal_type, severity, detail)
          values
            (v_club.id, v_person.member_id, v_person.team_id, 'silent_churn',
             'urgent', v_days::text)
          on conflict do nothing;
          if found then
            v_count := v_count + 1;
            perform notify_signal_owners(
              (select id from health_signals
                where club_id = v_club.id and member_id = v_person.member_id
                  and signal_type = 'silent_churn'));
          end if;
          continue;
        end if;

        -- «Beteiligungsrückgang»: früher über der einen Schwelle, jetzt unter
        -- der anderen.
        select
          count(*) filter (where a.status = 'present'),
          count(*)
          into v_present, v_total
          from events e
          left join team_members tm
            on tm.team_id = e.team_id and tm.member_id = v_person.member_id
          left join attendance a
            on a.event_id = e.id and a.member_id = v_person.member_id
           and a.shift_id is null
         where e.club_id = v_club.id
           and e.published_at is not null
           and e.cancelled_at is null
           and not e.is_sample
           and e.starts_at between now() - make_interval(days => v_days) and now()
           and (e.team_id is null or tm.member_id is not null);

        if v_total >= 4 and v_present::numeric / v_total < v_drop then
          declare
            v_prev_present int;
            v_prev_total int;
          begin
            select
              count(*) filter (where a.status = 'present'),
              count(*)
              into v_prev_present, v_prev_total
              from events e
              left join team_members tm
                on tm.team_id = e.team_id and tm.member_id = v_person.member_id
              left join attendance a
                on a.event_id = e.id and a.member_id = v_person.member_id
               and a.shift_id is null
             where e.club_id = v_club.id
               and e.published_at is not null
               and e.cancelled_at is null
               and not e.is_sample
               and e.starts_at between now() - make_interval(days => v_days * 2)
                                   and now() - make_interval(days => v_days)
               and (e.team_id is null or tm.member_id is not null);

            if v_prev_total >= 4
               and v_prev_present::numeric / v_prev_total >= v_before then
              insert into health_signals
                (club_id, member_id, team_id, signal_type, severity, detail)
              values
                (v_club.id, v_person.member_id, v_person.team_id,
                 'attendance_drop', 'attention',
                 v_present || '/' || v_total)
              on conflict do nothing;
              if found then
                v_count := v_count + 1;
                perform notify_signal_owners(
                  (select id from health_signals
                    where club_id = v_club.id and member_id = v_person.member_id
                      and signal_type = 'attendance_drop'));
              end if;
            end if;
          end;
        end if;
      end;
    end loop;

    -- ---- Vereinssignale (A3, FR-067) --------------------------------------
    -- «Kommunikationspause»: seit vier Wochen keine Verbindungs-Nachricht.
    -- Ein Verein, der noch **nie** eine versendet hat, wird nicht ermahnt –
    -- er hat gerade erst angefangen.
    v_last := last_connection_at(v_club.id);
    if v_last is not null and now() - v_last > interval '28 days' then
      insert into health_signals
        (club_id, member_id, team_id, signal_type, severity, detail)
      values
        (v_club.id, null, null, 'comms_pause', 'attention',
         extract(day from now() - v_last)::int::text)
      on conflict do nothing;
      if found then
        v_count := v_count + 1;
        perform notify_signal_owners(
          (select id from health_signals
            where club_id = v_club.id and signal_type = 'comms_pause'));
      end if;
    end if;

    -- «Verbindungs-Quote gekippt» (K1): mehr Aufrufe als Verbindungen über
    -- acht Wochen.
    select
      count(*) filter (where kind = 'connection'),
      count(*) filter (where kind = 'call')
      into v_conn, v_calls
      from club_message_log
     where club_id = v_club.id
       and sent_at > now() - interval '56 days';

    if v_calls >= 3 and v_calls > v_conn * 2 then
      insert into health_signals
        (club_id, member_id, team_id, signal_type, severity, detail)
      values
        (v_club.id, null, null, 'connection_ratio', 'info',
         v_conn || ':' || v_calls)
      on conflict do nothing;
      if found then
        v_count := v_count + 1;
        perform notify_signal_owners(
          (select id from health_signals
            where club_id = v_club.id and signal_type = 'connection_ratio'));
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schritte 6 bis 9: Triage (FR-064, BR-099).
--
-- BR-097: «gelöst» ist kein Status, den man aufbewahrt – der Hinweis
-- verschwindet. Es entsteht keine Akte über das Mitglied.
--
-- A1: Wer sich bereits kümmert, bleibt eingetragen. Das **Lösen** bleibt
-- trotzdem allen Zuständigen offen – sonst bliebe ein Hinweis liegen, wenn die
-- zuständige Person ausfällt.
-- ---------------------------------------------------------------------------
create or replace function public.set_signal_status(
  p_signal_id uuid,
  p_status    text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_signal health_signals;
  v_member uuid;
begin
  select * into v_signal from health_signals where id = p_signal_id for update;
  if not found then
    raise exception 'Hinweis nicht gefunden';
  end if;

  -- BR-096: dieselbe Reichweite wie in der Policy, aus derselben Funktion.
  if not health_signal_in_reach(p_signal_id) then
    raise exception 'Dieser Hinweis gehört nicht in deinen Bereich';
  end if;

  if p_status not in ('open','in_contact','resolved') then
    raise exception 'Unbekannter Status';
  end if;

  v_member := current_member_id(v_signal.club_id);

  if p_status = 'resolved' then
    -- BR-097: physisch löschen, nicht als erledigt markieren.
    delete from health_signals where id = p_signal_id;
    return 'deleted';
  end if;

  if p_status = 'in_contact' then
    -- A1: Wer zuerst da war, bleibt zuständig.
    if v_signal.status = 'in_contact' and v_signal.owned_by is not null
       and v_signal.owned_by <> v_member then
      return 'taken';
    end if;
    update health_signals
       set status = 'in_contact', owned_by = v_member
     where id = p_signal_id;
    return 'in_contact';
  end if;

  update health_signals set status = 'open', owned_by = null
   where id = p_signal_id;
  return 'open';
end;
$$;

-- ---------------------------------------------------------------------------
-- A2 und BR-097: Verfall statt Akte.
-- ---------------------------------------------------------------------------
create or replace function public.expire_health_signals()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  delete from health_signals where expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.health_signal_in_reach(uuid) from public, anon;
grant  execute on function public.health_signal_in_reach(uuid) to authenticated;

revoke execute on function public.health_threshold(uuid, text, numeric)
  from public, anon, authenticated;
revoke execute on function public.notify_signal_owners(uuid)
  from public, anon, authenticated;

revoke execute on function public.detect_health_signals(uuid)
  from public, anon, authenticated;
revoke execute on function public.expire_health_signals()
  from public, anon, authenticated;

revoke execute on function public.set_signal_status(uuid, text) from public, anon;
grant  execute on function public.set_signal_status(uuid, text) to authenticated;

-- Täglich früh: Signale sind Frühwarnung, keine Live-Überwachung (BR-094).
select cron.unschedule('health-detect')
 where exists (select 1 from cron.job where jobname = 'health-detect');
select cron.schedule(
  'health-detect', '41 5 * * *',
  $cron$select public.detect_health_signals();$cron$
);

select cron.unschedule('health-expire')
 where exists (select 1 from cron.job where jobname = 'health-expire');
select cron.schedule(
  'health-expire', '11 4 * * *',
  $cron$select public.expire_health_signals();$cron$
);

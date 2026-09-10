-- ============================================================================
-- 0044_club_pulse: der Vereins-Puls (UC-027)
--
-- Der Puls ist der Gegenpol zu allem, was dieses System an Aufrufen kennt.
-- Helfergesuche, Aufgaben-Vorschläge, Erinnerungen – jede dieser Funktionen
-- bittet. Der Puls **erzählt**, und ohne ihn kippt die Verbindungs-Quote
-- (BR-116, K1).
--
-- Die entscheidende Regel ist BR-115: Freigabe in zwei Minuten. Der Entwurf
-- ist vollständig vorkomponiert; die Freigabe verlangt keine Texterstellung.
-- Ein Vorstand, der jede Woche einen Text schreiben müsste, schriebe ihn nach
-- vier Wochen nicht mehr.
--
-- Dazu die zweite Hälfte von FR-070: Die Quote wird seit `0018` gezählt und
-- **nirgends gezeigt**.
-- ============================================================================

create table if not exists club_pulses (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  -- BR-113: Die drei Fragen in fester Reihenfolge. Sie stehen im Datenmodell
  -- und nicht in der Ansicht – eine Ansicht kann man umsortieren.
  happening   jsonb not null default '[]'::jsonb,
  working_on  jsonb not null default '[]'::jsonb,
  join_in     jsonb not null default '[]'::jsonb,
  intro       text,
  status      text not null default 'draft'
                check (status in ('draft','sent','discarded')),
  composed_at timestamptz not null default now(),
  sent_at     timestamptz,
  released_by uuid references club_members(id) on delete set null
);

create index if not exists club_pulses_club_idx
  on club_pulses(club_id, composed_at desc);

-- Ein Entwurf je Verein und Woche. Ohne diesen Index legte der wöchentliche
-- Lauf bei jedem Anlauf einen weiteren an.
create unique index if not exists club_pulses_open_draft_idx
  on club_pulses (club_id)
  where status = 'draft';

alter table club_pulses enable row level security;

-- Entwürfe gehören dem Vorstand, versendete Pulse allen Mitgliedern: Wer ihn
-- in der Inbox hat, muss ihn auch öffnen können (A4).
drop policy if exists club_pulses_read on club_pulses;
create policy club_pulses_read on club_pulses
  for select using (
    is_club_admin(club_id)
    or (status = 'sent' and is_club_member(club_id))
  );

-- ---------------------------------------------------------------------------
-- FR-070: die Verbindungs-Quote, endlich sichtbar.
--
-- Gezählt wird sie seit `0018`. Dass sie nirgends steht, ist der Grund, warum
-- ein Vorstand bis heute nicht sieht, ob sein Verein nur bittet.
-- ---------------------------------------------------------------------------
create or replace function public.connection_ratio(
  p_club_id uuid,
  p_days    int default 56
)
returns table (connections int, calls int, last_connection timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  -- Ausdrücklich abweisen statt Nullen zurückgeben: Eine Quote «0 zu 0» liest
  -- sich wie «der Verein schweigt», nicht wie «das darfst du nicht sehen».
  if not is_club_trainer(p_club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand sehen die Verbindungs-Quote';
  end if;

  return query
    select
      count(*) filter (where kind = 'connection')::int,
      count(*) filter (where kind = 'call')::int,
      max(sent_at) filter (where kind = 'connection')
    from club_message_log
    where club_id = p_club_id
      and sent_at > now() - make_interval(days => greatest(coalesce(p_days, 56), 1));
end;
$$;

-- ---------------------------------------------------------------------------
-- Schritt 1: den Entwurf komponieren.
--
-- Drei Quellen, drei Abschnitte. «Woran wir arbeiten» nennt die Spezifikation
-- als dokumentierte Vorstandsantworten (UC-030) – die es noch nicht gibt.
-- Bis dahin stehen dort die **laufenden** Aufgaben: das, woran gerade jemand
-- arbeitet. Inhaltlich nah, und keine Erfindung.
--
-- A3: Wären alle drei Abschnitte leer, entsteht **kein** Entwurf. Ein Puls
-- ohne Inhalt wäre ein Aufruf zur Aufmerksamkeit ohne Gegenwert.
-- ---------------------------------------------------------------------------
create or replace function public.compose_club_pulse(p_club_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club     record;
  v_happening jsonb;
  v_working  jsonb;
  v_join     jsonb;
  v_pulse    uuid;
  v_person   record;
  v_count    int := 0;
begin
  for v_club in
    select c.id from clubs c where p_club_id is null or c.id = p_club_id
  loop
    -- Ein offener Entwurf genügt; der nächste Lauf überschreibt ihn nicht.
    if exists (select 1 from club_pulses
                where club_id = v_club.id and status = 'draft') then
      continue;
    end if;

    -- «Was passiert»: die Termine der kommenden vierzehn Tage.
    select coalesce(jsonb_agg(item order by item->>'at'), '[]'::jsonb)
      into v_happening
      from (
        select jsonb_build_object(
                 'kind', 'event', 'id', e.id, 'title', e.title,
                 'at', e.starts_at, 'detail', e.type) as item
          from events e
         where e.club_id = v_club.id
           and e.published_at is not null
           and e.cancelled_at is null
           and not e.is_sample
           and e.starts_at between now() and now() + interval '14 days'
         order by e.starts_at
         limit 8
      ) x;

    -- «Woran wir arbeiten»: die laufenden Aufgaben.
    select coalesce(jsonb_agg(item), '[]'::jsonb)
      into v_working
      from (
        select jsonb_build_object(
                 'kind', 'task', 'id', t.id, 'title', t.title,
                 'at', t.due_at, 'detail', t.category) as item
          from tasks t
         where t.club_id = v_club.id
           and t.status in ('claimed','submitted')
           and not t.is_sample
         order by t.due_at nulls last
         limit 6
      ) x;

    -- «Wo du dabei sein kannst»: offene Aufgaben und unterbesetzte Schichten.
    select coalesce(jsonb_agg(item), '[]'::jsonb)
      into v_join
      from (
        select jsonb_build_object(
                 'kind', 'task', 'id', t.id, 'title', t.title,
                 'at', t.due_at, 'detail', t.category) as item,
               t.due_at as at
          from tasks t
         where t.club_id = v_club.id
           and t.status = 'open'
           and not t.is_sample
           and t.max_assignees > (select count(*) from task_assignments a
                                   where a.task_id = t.id)
        union all
        select jsonb_build_object(
                 'kind', 'shift', 'id', s.id, 'title', s.title,
                 'at', s.starts_at, 'detail', e.title) as item,
               s.starts_at as at
          from event_shifts s
          join events e on e.id = s.event_id
         where e.club_id = v_club.id
           and e.published_at is not null
           and e.cancelled_at is null
           and not e.is_sample
           and s.starts_at > now()
           and s.needed > (select count(*) from attendance a
                            where a.shift_id = s.id
                              and a.status in ('registered','present'))
         order by at nulls last
         limit 8
      ) x;

    -- A3: nichts zu berichten.
    if jsonb_array_length(v_happening) = 0
       and jsonb_array_length(v_working) = 0
       and jsonb_array_length(v_join) = 0 then
      continue;
    end if;

    insert into club_pulses (club_id, happening, working_on, join_in)
    values (v_club.id, v_happening, v_working, v_join)
    returning id into v_pulse;

    v_count := v_count + 1;

    -- Schritt 2: Der Vorstand erfährt, dass etwas bereitliegt.
    for v_person in
      select m.user_id from club_members m
       where m.club_id = v_club.id
         and m.role in ('admin','superadmin')
         and m.status <> 'left'
         and m.user_id is not null
    loop
      perform notify(
        v_person.user_id, 'pulse', 'Der Vereins-Puls liegt bereit',
        null, '/tabs/profile/pulse', v_club.id
      );
    end loop;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schritte 6 bis 8: freigeben.
--
-- Die Auswahl kommt als Liste der **behaltenen** Einträge zurück – wer nichts
-- streicht, übergibt nichts und bekommt den Entwurf, wie er ist (BR-115).
-- ---------------------------------------------------------------------------
create or replace function public.release_pulse(
  p_pulse_id uuid,
  p_intro    text default null,
  p_keep     jsonb default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pulse  club_pulses;
  v_person record;
  v_count  int := 0;
  v_intro  text;
begin
  select * into v_pulse from club_pulses where id = p_pulse_id for update;
  if not found then
    raise exception 'Puls nicht gefunden';
  end if;

  if not is_club_admin(v_pulse.club_id) then
    raise exception 'Nur der Vorstand gibt den Puls frei';
  end if;

  if v_pulse.status <> 'draft' then
    return 0;
  end if;

  v_intro := nullif(trim(p_intro), '');

  -- Gestrichene Einträge fallen weg. `p_keep` ist eine Liste von Ids; fehlt
  -- sie, bleibt alles stehen.
  if p_keep is not null then
    update club_pulses
       set happening = (
             select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(happening) e
              where p_keep ? (e->>'id')),
           working_on = (
             select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(working_on) e
              where p_keep ? (e->>'id')),
           join_in = (
             select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(join_in) e
              where p_keep ? (e->>'id'))
     where id = p_pulse_id;
    select * into v_pulse from club_pulses where id = p_pulse_id;
  end if;

  update club_pulses
     set status = 'sent',
         sent_at = now(),
         intro = v_intro,
         released_by = current_member_id(v_pulse.club_id)
   where id = p_pulse_id;

  -- Schritt 7: an **alle** Mitglieder – der Puls kennt keinen Geltungsbereich.
  for v_person in
    select m.user_id from club_members m
     where m.club_id = v_pulse.club_id
       and m.status <> 'left'
       and m.user_id is not null
  loop
    perform notify(
      v_person.user_id, 'pulse', 'Der Vereins-Puls',
      coalesce(v_intro, 'Was passiert, woran wir arbeiten, wo du dabei sein kannst.'),
      '/tabs/pulse/' || p_pulse_id, v_pulse.club_id
    );
    v_count := v_count + 1;
  end loop;

  -- BR-116: Der Puls ist die Verbindungs-Routine. Dieser Eintrag ist es, der
  -- die sanfte Sperre aus UC-011 löst.
  perform log_club_message(v_pulse.club_id, 'connection', 'pulse');

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- A2: «Diese Woche nicht».
--
-- Der Zeitpunkt des letzten Pulses bleibt unverändert und fliesst weiter in
-- die Symmetrie-Prüfung ein: Ein Verein, der jede Woche verwirft, sieht seine
-- Quote kippen. Das ist die Absicht der Regel, kein Versehen.
-- ---------------------------------------------------------------------------
create or replace function public.discard_pulse(p_pulse_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
begin
  select club_id into v_club from club_pulses
   where id = p_pulse_id and status = 'draft';
  if v_club is null then
    raise exception 'Entwurf nicht gefunden';
  end if;

  if not is_club_admin(v_club) then
    raise exception 'Nur der Vorstand entscheidet über den Puls';
  end if;

  update club_pulses set status = 'discarded' where id = p_pulse_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- A1: automatischer Versand nach 48 Stunden – nur, wenn der Verein es
-- ausdrücklich eingeschaltet hat.
-- ---------------------------------------------------------------------------
create or replace function public.auto_release_pulses()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pulse record;
  v_count int := 0;
begin
  for v_pulse in
    select p.id, p.club_id
      from club_pulses p
      join clubs c on c.id = p.club_id
     where p.status = 'draft'
       and p.composed_at < now() - interval '48 hours'
       and coalesce((c.settings->'pulse'->>'autoRelease')::boolean, false)
  loop
    begin
      -- Der automatische Versand hat keine bestätigende Person; freigegeben
      -- wird der Entwurf, wie er ist.
      update club_pulses
         set status = 'sent', sent_at = now()
       where id = v_pulse.id;

      perform notify(m.user_id, 'pulse', 'Der Vereins-Puls',
        'Was passiert, woran wir arbeiten, wo du dabei sein kannst.',
        '/tabs/pulse/' || v_pulse.id, v_pulse.club_id)
        from club_members m
       where m.club_id = v_pulse.club_id
         and m.status <> 'left' and m.user_id is not null;

      perform log_club_message(v_pulse.club_id, 'connection', 'pulse');
      v_count := v_count + 1;
    exception when others then
      raise warning 'Puls % konnte nicht versendet werden: %', v_pulse.id, sqlerrm;
    end;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.compose_club_pulse(uuid)
  from public, anon, authenticated;
revoke execute on function public.auto_release_pulses()
  from public, anon, authenticated;

revoke execute on function public.connection_ratio(uuid, int) from public, anon;
grant  execute on function public.connection_ratio(uuid, int) to authenticated;

revoke execute on function public.release_pulse(uuid, text, jsonb) from public, anon;
grant  execute on function public.release_pulse(uuid, text, jsonb) to authenticated;

revoke execute on function public.discard_pulse(uuid) from public, anon;
grant  execute on function public.discard_pulse(uuid) to authenticated;

-- Montags früh komponieren, danach stündlich prüfen, ob etwas automatisch raus soll.
select cron.unschedule('pulse-compose')
 where exists (select 1 from cron.job where jobname = 'pulse-compose');
select cron.schedule('pulse-compose', '13 6 * * 1',
  $cron$select public.compose_club_pulse();$cron$);

select cron.unschedule('pulse-auto-release')
 where exists (select 1 from cron.job where jobname = 'pulse-auto-release');
select cron.schedule('pulse-auto-release', '43 * * * *',
  $cron$select public.auto_release_pulses();$cron$);

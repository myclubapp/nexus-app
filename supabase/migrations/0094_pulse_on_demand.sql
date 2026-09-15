-- ============================================================================
-- 0094_pulse_on_demand: den Puls-Entwurf von Hand anstossen (UC-027, A3)
--
-- Der Puls entsteht seit `0044` ausschliesslich im wöchentlichen Lauf
-- (montags, `cron` «pulse-compose»). Das ist die richtige Routine – aber es
-- ist der **einzige** Weg. Wer das Modul an einem Dienstag einschaltet, sieht
-- bis zum nächsten Montag «Diese Woche liegt kein Entwurf vor» und hat auf
-- dieser Seite nichts zu tun. Genau so war es bei Kadetten Unihockey
-- Schaffhausen: Modul an, Vorstand da, Material da – und `club_pulses` leer.
--
-- Dieser Nachtrag ändert nichts am Charakter des Pulses. Der Entwurf wird
-- weiterhin **komponiert** und nicht geschrieben (BR-115); neu ist nur, dass
-- der Vorstand den Anstoss selbst geben kann, statt auf den Montag zu warten.
--
-- Zwei Dinge sind dabei zu beachten:
--
-- 1. `compose_club_pulse()` benachrichtigt den ganzen Vorstand, dass etwas
--    bereitliegt. Wer den Knopf selbst drückt, steht schon auf der Seite – er
--    bekäme eine Meldung über seine eigene Handlung. Die Funktion nimmt darum
--    eine Person aus.
-- 2. Der Anstoss ist kein Versand. Freigegeben wird weiterhin über
--    `release_pulse()`, und der eindeutige Index auf offenen Entwürfen lässt
--    ohnehin nur einen zu.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- `compose_club_pulse` bekommt einen zweiten Parameter.
--
-- Ein zweiter Parameter mit Vorgabewert wäre eine **Überladung**: der Aufruf
-- `compose_club_pulse()` aus dem Cron-Auftrag wäre danach mehrdeutig und der
-- wöchentliche Lauf bräche mit «function is not unique». Die alte Signatur
-- muss deshalb fallen, bevor die neue entsteht.
-- ---------------------------------------------------------------------------
drop function if exists public.compose_club_pulse(uuid);

create or replace function public.compose_club_pulse(
  p_club_id   uuid default null,
  p_skip_user uuid default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club     record;
  v_happening jsonb;
  v_decisions jsonb;
  v_working  jsonb;
  v_join     jsonb;
  v_pulse    uuid;
  v_person   record;
  v_count    int := 0;
begin
  for v_club in
    select c.id from clubs c where p_club_id is null or c.id = p_club_id
  loop
    -- UC-034: Ohne das Modul entsteht nichts.
    if not module_enabled(v_club.id, 'pulse') then
      continue;
    end if;

    if exists (select 1 from club_pulses
                where club_id = v_club.id and status = 'draft') then
      continue;
    end if;

    -- «Was passiert»: die Vereinstermine der kommenden vierzehn Tage.
    select coalesce(jsonb_agg(item order by item->>'at'), '[]'::jsonb)
      into v_happening
      from (
        select jsonb_build_object(
                 'kind', 'event', 'id', e.id, 'title', e.title,
                 'at', e.starts_at, 'detail', e.type) as item
          from events e
         where e.club_id = v_club.id
           and e.team_id is null
           and e.published_at is not null
           and e.cancelled_at is null
           and not e.is_sample
           and e.starts_at between now() and now() + interval '14 days'
         order by e.starts_at
         limit 8
      ) x;

    -- «Woran wir arbeiten»: publizierte Vorstandsantworten, dann laufende
    -- Aufgaben des ganzen Vereins.
    select coalesce(jsonb_agg(item order by at desc), '[]'::jsonb)
      into v_decisions
      from (
        select jsonb_build_object(
                 'kind', 'decision', 'id', n.id, 'title', n.title,
                 'at', n.published_at, 'detail', null) as item,
               n.published_at as at
          from news n
         where n.club_id = v_club.id
           and n.source = 'board'
           and n.team_id is null
           and not n.is_sample
           and n.published_at > now() - interval '14 days'
         order by n.published_at desc
         limit 4
      ) x;

    select coalesce(jsonb_agg(item), '[]'::jsonb)
      into v_working
      from (
        select jsonb_build_object(
                 'kind', 'task', 'id', t.id, 'title', t.title,
                 'at', t.due_at, 'detail', t.category) as item
          from tasks t
         where t.club_id = v_club.id
           and t.team_id is null
           and t.status in ('claimed','submitted')
           and not t.is_sample
         order by t.due_at nulls last
         limit 6
      ) x;

    v_working := v_decisions || v_working;

    -- «Wo du dabei sein kannst»: offene Vereinsaufgaben und unterbesetzte
    -- Schichten von Vereinsterminen.
    select coalesce(jsonb_agg(item), '[]'::jsonb)
      into v_join
      from (
        select jsonb_build_object(
                 'kind', 'task', 'id', t.id, 'title', t.title,
                 'at', t.due_at, 'detail', t.category) as item,
               t.due_at as at
          from tasks t
         where t.club_id = v_club.id
           and t.team_id is null
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
           and e.team_id is null
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

    for v_person in
      select m.user_id from club_members m
       where m.club_id = v_club.id
         and m.role in ('admin','superadmin')
         and m.status <> 'left'
         and m.user_id is not null
         -- Wer den Entwurf selbst angestossen hat, steht bereits davor.
         and (p_skip_user is null or m.user_id <> p_skip_user)
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
-- Der Anstoss von Hand.
--
-- Rückgabe ist die Id des offenen Entwurfs – oder `null`, wenn es nichts zu
-- erzählen gibt (A3). Das ist der Unterschied, den die Oberfläche braucht:
-- «hier ist dein Entwurf» liest sich anders als «der Verein hat diese Woche
-- nichts anzukündigen».
-- ---------------------------------------------------------------------------
create or replace function public.request_club_pulse(p_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pulse uuid;
begin
  -- Derselbe Kreis, der den Puls freigibt, stellt ihn auch zusammen.
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand stellt den Vereins-Puls zusammen';
  end if;

  if not module_enabled(p_club_id, 'pulse') then
    raise exception 'Das Modul Vereins-Puls ist in diesem Verein nicht eingeschaltet';
  end if;

  -- Liegt schon ein Entwurf, gibt es nichts zu komponieren: Der eindeutige
  -- Index lässt nur einen offenen zu, und `compose_club_pulse` überspringt
  -- den Verein ohnehin.
  select id into v_pulse
    from club_pulses
   where club_id = p_club_id and status = 'draft';
  if found then
    return v_pulse;
  end if;

  perform compose_club_pulse(p_club_id, auth.uid());

  select id into v_pulse
    from club_pulses
   where club_id = p_club_id and status = 'draft';

  return v_pulse;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte.
--
-- `compose_club_pulse` bleibt dem Cron vorbehalten – die neue Signatur bringt
-- ihre eigenen Grants mit, und Postgres vergibt sie an PUBLIC. Der Weg für
-- Angemeldete ist `request_club_pulse`, das die Rolle selbst prüft.
-- ---------------------------------------------------------------------------
revoke execute on function public.compose_club_pulse(uuid, uuid)
  from public, anon, authenticated;

revoke execute on function public.request_club_pulse(uuid) from public, anon;
grant  execute on function public.request_club_pulse(uuid) to authenticated;

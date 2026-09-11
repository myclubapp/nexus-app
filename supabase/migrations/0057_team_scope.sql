-- ============================================================================
-- 0057_team_scope: der Geltungsbereich gilt für alle Entitäten
--
-- `tasks` (seit `0034`) und `news` (seit `0043`) sind nach Team abgegrenzt:
-- Was einem Team gehört, liest nur, wer in diesem Team ist – der Vorstand und
-- Trainer:innen ausgenommen, weil sie es ausschreiben. Die Agenda hatte diese
-- Abgrenzung **nicht**: `is_club_member(club_id)` genügte, und damit las jedes
-- Vereinsmitglied jeden Team-Termin samt Teilnehmerliste.
--
-- Das war keine Lücke im Code, sondern eine, die zwischen zwei Migrationen
-- entstanden ist: `0018` schrieb die Policy, bevor es die Regel gab, und die
-- Regel kam mit `0034` nur für Aufgaben. Diese Migration zieht nach – und zwar
-- für die ganze Kette, die am Termin hängt: Serien, Schichten, Antworten und
-- QR-Token. Eine Teilnehmerliste ist nicht weniger schützenswert als der
-- Termin, zu dem sie gehört.
--
-- **Die Regel, die ab hier für jede neue Entität gilt:** Trägt eine Tabelle
-- einen `team_id`, dann liest sie nur, wer in diesem Team ist oder den Verein
-- führt. Ein `is_club_member(club_id)` allein ist ab hier ein Befund.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Der Geltungsbereich eines Termins – eine Funktion, vier Policies.
--
-- Wortgleich zu `task_in_scope()` aus `0034`, und zwar mit Absicht: Zwei
-- Formulierungen derselben Regel laufen auseinander, sobald eine davon
-- geändert wird.
-- ---------------------------------------------------------------------------
create or replace function public.event_in_scope(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from events e
     where e.id = p_event_id
       and is_club_member(e.club_id)
       and (
         -- Ein Vereinstermin gilt allen.
         e.team_id is null
         -- Wer plant, sieht auch, was er für andere Teams geplant hat – sonst
         -- verlöre der Vorstand den halben Vereinskalender aus dem Blick.
         or is_club_trainer(e.club_id)
         or exists (
           select 1 from team_members tm
            where tm.team_id = e.team_id
              and tm.member_id = current_member_id(e.club_id)
         )
       )
  );
$$;

revoke execute on function public.event_in_scope(uuid) from public, anon;
grant  execute on function public.event_in_scope(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Der Termin selbst.
--
-- Die zweite Bedingung bleibt, wie sie war: Ein Entwurf gehört der planenden
-- Seite, bis er publiziert ist.
-- ---------------------------------------------------------------------------
drop policy if exists events_read on events;
create policy events_read on events
  for select using (
    (published_at is not null or is_club_trainer(club_id))
    and event_in_scope(id)
  );

-- ---------------------------------------------------------------------------
-- Die Serie.
--
-- Sie trägt denselben `team_id` wie ihre Termine. Wer die Termine nicht sieht,
-- braucht die Regel dahinter erst recht nicht.
-- ---------------------------------------------------------------------------
drop policy if exists event_series_read on event_series;
create policy event_series_read on event_series
  for select using (
    is_club_member(club_id)
    and (
      team_id is null
      or is_club_trainer(club_id)
      or exists (
        select 1 from team_members tm
         where tm.team_id = event_series.team_id
           and tm.member_id = current_member_id(event_series.club_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Schichten, Antworten und QR-Token hängen am Termin.
--
-- Sie prüfen ab hier **dieselbe** Funktion, statt die Vereinsmitgliedschaft
-- selbst nachzubauen. Eine Teilnehmerliste ist nicht weniger schützenswert als
-- der Termin, zu dem sie gehört.
-- ---------------------------------------------------------------------------
drop policy if exists shifts_read on event_shifts;
create policy shifts_read on event_shifts
  for select using (
    exists (
      select 1 from events e
       where e.id = event_shifts.event_id
         and (e.published_at is not null or is_club_trainer(e.club_id))
    )
    and event_in_scope(event_id)
  );

drop policy if exists attendance_read on attendance;
create policy attendance_read on attendance
  for select using (event_in_scope(event_id));

drop policy if exists event_qr_tokens_read on event_qr_tokens;
create policy event_qr_tokens_read on event_qr_tokens
  for select using (
    exists (
      select 1 from events e
       where e.id = event_qr_tokens.event_id
         and is_club_trainer(e.club_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Folge für den Vereins-Puls (UC-027).
--
-- Der Puls ist **eine** Nachricht an alle. Stünde darin der Termin eines
-- einzelnen Teams, gäbe er preis, was die Policy oben gerade verbirgt – und
-- zwar an alle Mitglieder gleichzeitig. Er nimmt deshalb ab hier nur, was dem
-- ganzen Verein gilt: Termine, Aufgaben und Schichten ohne Team.
--
-- Das macht den Puls nicht ärmer, sondern richtiger: «Was passiert» heisst,
-- was im Verein passiert. Was im Team passiert, steht in der Agenda des Teams.
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

revoke execute on function public.compose_club_pulse(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Der Geltungsbereich gilt auch beim Schreiben.
--
-- Eine Policy, die das Lesen abgrenzt und das Schreiben nicht, grenzt nichts
-- ab: Wer eine Termin-Id kennt, sagte sonst einem fremden Team zu und stünde
-- in dessen Teilnehmerliste. Die Rümpfe sind wortgleich aus `0053`; neu ist
-- allein `event_in_scope()`.
-- ---------------------------------------------------------------------------
drop policy if exists attendance_write_self on attendance;
create policy attendance_write_self on attendance
  for insert with check (
    member_id = (select current_member_id(e.club_id) from events e where e.id = event_id)
    and status in ('registered','excused','absent')
    and shift_id is null
    and exists (select 1 from events e
                 where e.id = event_id
                   and e.published_at is not null
                   and not e.is_sample)
    and event_in_scope(event_id)
  );

drop policy if exists attendance_update_self on attendance;
create policy attendance_update_self on attendance
  for update using (
    member_id = (select current_member_id(e.club_id) from events e where e.id = event_id)
    and shift_id is null
    and event_in_scope(event_id)
  ) with check (
    member_id = (select current_member_id(e.club_id) from events e where e.id = event_id)
    and status in ('registered','excused','absent')
    and shift_id is null
    and exists (select 1 from events e
                 where e.id = event_id and not e.is_sample)
    and event_in_scope(event_id)
  );

-- ---------------------------------------------------------------------------
-- Dasselbe für das Übernehmen einer Schicht.
--
-- Der Rumpf ist wortgleich aus `0053`; neu ist die eine Prüfung nach der
-- Mitgliedschaft. Ein Helfereinsatz an einem Team-Termin gehört diesem Team.
-- ---------------------------------------------------------------------------
create or replace function public.take_shift(
  p_shift_id uuid,
  p_accept_overlap boolean default false
)
returns table (filled int, needed int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shift  event_shifts;
  v_event  events;
  v_member uuid;
  v_filled int;
begin
  select * into v_shift from event_shifts where id = p_shift_id for update;
  if not found then
    raise exception 'Schicht nicht gefunden';
  end if;

  select * into v_event from events where id = v_shift.event_id;

  -- UC-037/A2: dasselbe für die Schicht eines Beispiel-Helfer-Events.
  if v_event.is_sample then
    raise exception 'Das ist ein Beispielinhalt – er lässt sich nicht übernehmen';
  end if;


  v_member := current_member_id(v_event.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  if v_event.published_at is null then
    raise exception 'Dieser Aufruf ist noch nicht ausgeschrieben';
  end if;

  -- Seit `0057`: Ein Helfereinsatz an einem Team-Termin gehört diesem Team.
  if not event_in_scope(v_shift.event_id) then
    raise exception 'Dieser Termin gehört einem anderen Team';
  end if;

  if v_event.cancelled_at is not null then
    raise exception 'Dieser Termin wurde abgesagt';
  end if;

  if v_shift.ends_at <= now() then
    raise exception 'Diese Schicht ist vorbei';
  end if;

  -- Wer bereits bestätigt ist, hat den Einsatz hinter sich.
  if exists (select 1 from attendance
              where shift_id = p_shift_id and member_id = v_member
                and status = 'present') then
    raise exception 'Dieser Einsatz ist bereits bestätigt';
  end if;

  -- BR-046: Absagen belegen keinen Platz – deshalb zählt nur, wer zählt.
  select count(*) into v_filled
    from attendance
   where shift_id = p_shift_id and status in ('registered','present');

  -- Die Ausnahme gilt nur, wer den Platz **belegt**. Eine Zeile auf `excused`
  -- oder `absent` ist kein Platz, sondern seine Rückgabe.
  if v_filled >= v_shift.needed
     and not exists (select 1 from attendance
                      where shift_id = p_shift_id and member_id = v_member
                        and status in ('registered','present')) then
    raise exception 'Diese Schicht ist bereits voll';
  end if;

  if not p_accept_overlap
     and exists (
       select 1
         from attendance a
         join event_shifts s on s.id = a.shift_id
        where a.member_id = v_member
          and a.shift_id is not null
          and a.shift_id <> p_shift_id
          and a.status in ('registered','present')
          and s.starts_at < v_shift.ends_at
          and s.ends_at   > v_shift.starts_at
     ) then
    raise exception 'overlap';
  end if;

  -- BR-045: Die Eintragung allein erzeugt keine Punkte.
  insert into attendance (event_id, member_id, shift_id, status, responded_at)
  values (v_shift.event_id, v_member, p_shift_id, 'registered', now())
  on conflict (event_id, member_id, shift_id) do update
     set status = 'registered', responded_at = now();

  select count(*) into v_filled
    from attendance
   where shift_id = p_shift_id and status in ('registered','present');

  return query select v_filled, v_shift.needed;
end;
$$;

revoke execute on function public.take_shift(uuid, boolean) from public, anon;
grant  execute on function public.take_shift(uuid, boolean) to authenticated;

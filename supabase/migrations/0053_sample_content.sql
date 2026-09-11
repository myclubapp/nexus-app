-- ============================================================================
-- 0053_sample_content: Beispielinhalte verwalten (UC-037)
--
-- **BR-165: «Kein Bildschirm ohne Inhalt oder Erklärung.»** Ein neu gegründeter
-- Verein sieht heute fünf leere Tabs, und eine leere Fläche erklärt nichts.
--
-- **BR-162: «Beispiele machen keine Arbeit.»** Sie verschwinden mit dem ersten
-- eigenen Inhalt derselben Art, nach Ablauf der Frist oder mit **einer**
-- Aktion. Einzeln aufräumen muss sie niemand.
--
-- **BR-161: «Beispiele sind folgenlos»** ist halb gebaut: `is_sample` sperrt
-- seit `0015`/`0033` Zustellung, Erinnerung, Punktebuchung und
-- Verbindungs-Quote. Hier kommt die andere Hälfte dazu – heute lässt sich eine
-- Beispielaufgabe **übernehmen** und einem Beispieltermin **zusagen** (A2).
-- ============================================================================

-- Die Einführungs-Beiträge brauchen ihre Kennzeichnung wie alles andere.
alter table news add column if not exists is_sample boolean not null default false;
create index if not exists news_sample_idx on news(club_id) where is_sample;

-- FR-145/BR-166: Der Demo-Verein ist ein eigener Mandant.
alter table clubs add column if not exists is_demo boolean not null default false;
create unique index if not exists clubs_single_demo_idx on clubs(is_demo) where is_demo;

-- ---------------------------------------------------------------------------
-- A2 und BR-161: Ein Beispiel ist nichts, worauf man zusagen kann.
--
-- Die Policy liess die Zusage bisher zu. Eine Zusage zu einem erfundenen
-- Termin ist keine Zusage – sie wäre eine Verabredung mit niemandem.
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
  );

drop policy if exists attendance_update_self on attendance;
create policy attendance_update_self on attendance
  for update using (
    member_id = (select current_member_id(e.club_id) from events e where e.id = event_id)
    and shift_id is null
  ) with check (
    member_id = (select current_member_id(e.club_id) from events e where e.id = event_id)
    and status in ('registered','excused','absent')
    and shift_id is null
    and exists (select 1 from events e
                 where e.id = event_id and not e.is_sample)
  );

-- Und dasselbe für das Übernehmen. Die Rümpfe sind wortgleich aus `0034` und
-- `0026` übernommen; neu ist allein die Sperre.
create or replace function public.claim_task(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task   tasks;
  v_member uuid;
  v_taken  int;
  v_id     uuid;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Aufgabe nicht gefunden';
  end if;

  -- UC-037/A2: Eine Beispielaufgabe ist nichts, was man übernehmen kann. Sie
  -- steht da, um zu zeigen, wie eine Ausschreibung aussieht – wer sie annimmt,
  -- hätte eine Zusage an niemanden gegeben.
  if v_task.is_sample then
    raise exception 'Das ist ein Beispielinhalt – er lässt sich nicht übernehmen';
  end if;

  v_member := current_member_id(v_task.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  -- Schritt 4 aus UC-017: Eine Aufgabe für ein Team ist kein Angebot an alle.
  if not task_in_scope(p_task_id) then
    raise exception 'Diese Aufgabe gilt für ein anderes Team';
  end if;

  if v_task.status not in ('open','claimed') then
    raise exception 'Diese Aufgabe ist nicht mehr offen';
  end if;

  select count(*) into v_taken from task_assignments where task_id = p_task_id;
  if v_taken >= v_task.max_assignees then
    raise exception 'Diese Aufgabe ist bereits vergeben';
  end if;

  insert into task_assignments (task_id, member_id)
  values (p_task_id, v_member)
  returning id into v_id;

  if v_taken + 1 >= v_task.max_assignees then
    update tasks set status = 'claimed' where id = p_task_id;
  end if;

  return v_id;
end;
$$;

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

-- ---------------------------------------------------------------------------
-- Die Beispielinhalte anlegen (FR-134, FR-139 bis FR-142).
--
-- BR-164: Titel und Kategorien folgen der Vereinsart. Der Wortlaut liegt in der
-- Datenbank und nicht in den Sprachdateien – wie bei den Check-in-Fragen
-- (UC-032): Er gehört dem Verein, der ihn übernehmen oder löschen kann.
-- ---------------------------------------------------------------------------
create or replace function public.seed_sample_content(p_club_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind    text;
  v_admin   uuid;
  v_first   text;
  v_second  text;
  v_helper  text;
  v_event   uuid;
  v_count   int := 0;
begin
  select c.club_kind into v_kind from clubs c where c.id = p_club_id;
  if v_kind is null then
    raise exception 'Verein nicht gefunden';
  end if;

  -- Ohne Vorstandsperson gäbe es niemanden, der die Inhalte «erfasst» hat.
  select m.id into v_admin from club_members m
   where m.club_id = p_club_id and m.role in ('admin','superadmin')
   order by m.member_since limit 1;
  if v_admin is null then
    return 0;
  end if;

  -- Zweimal anlegen wäre doppelt aufzuräumen.
  if exists (select 1 from events e where e.club_id = p_club_id and e.is_sample) then
    return 0;
  end if;

  -- BR-164: die Begriffe der Vereinsart.
  if v_kind = 'music' then
    v_first  := 'Beispiel: Probe am Mittwoch';
    v_second := 'Beispiel: Konzert im Gemeindesaal';
    v_helper := 'Beispiel: Helfende fürs Konzert';
  elsif v_kind = 'culture' then
    v_first  := 'Beispiel: Treffen am Mittwoch';
    v_second := 'Beispiel: Aufführung im Gemeindesaal';
    v_helper := 'Beispiel: Helfende für die Aufführung';
  elsif v_kind = 'youth' then
    v_first  := 'Beispiel: Gruppenstunde am Mittwoch';
    v_second := 'Beispiel: Lager-Vorbereitungstag';
    v_helper := 'Beispiel: Helfende fürs Lager';
  elsif v_kind = 'neighborhood' then
    v_first  := 'Beispiel: Quartiertreff am Mittwoch';
    v_second := 'Beispiel: Frühlingsputz';
    v_helper := 'Beispiel: Helfende fürs Quartierfest';
  else
    v_first  := 'Beispiel: Training am Mittwoch';
    v_second := 'Beispiel: Spiel gegen Beispieldorf';
    v_helper := 'Beispiel: Helfende fürs Heimturnier';
  end if;

  -- FR-141: zwei Termine.
  insert into events (club_id, type, title, why, starts_at, ends_at,
                      created_by, is_sample, published_at)
  values
    (p_club_id, case when v_kind in ('music','culture') then 'social' else 'training' end,
     v_first, 'Damit die Agenda zeigt, wie ein Termin aussieht.',
     now() + interval '3 days', now() + interval '3 days 2 hours',
     v_admin, true, now()),
    (p_club_id, case when v_kind = 'sport' then 'match' else 'social' end,
     v_second, 'Damit du siehst, wie Zu- und Absage funktionieren.',
     now() + interval '10 days', now() + interval '10 days 3 hours',
     v_admin, true, now());
  v_count := v_count + 2;

  -- FR-140: ein Helfer-Event mit zwei Schichten.
  insert into events (club_id, type, title, why, starts_at, ends_at,
                      created_by, is_sample, published_at)
  values (p_club_id, 'helper', v_helper,
          'Ohne Helfende findet der Anlass nicht statt – so sieht ein Aufruf aus.',
          now() + interval '17 days', now() + interval '17 days 6 hours',
          v_admin, true, now())
  returning id into v_event;

  insert into event_shifts (event_id, title, starts_at, ends_at, needed, point_rule_code)
  values
    (v_event, 'Beispiel: Aufbau', now() + interval '17 days',
     now() + interval '17 days 3 hours', 2, 'helper_shift'),
    (v_event, 'Beispiel: Abbau', now() + interval '17 days 3 hours',
     now() + interval '17 days 6 hours', 2, 'helper_shift');
  v_count := v_count + 1;

  -- FR-139: drei Aufgaben.
  insert into tasks (club_id, title, why, description, category, points,
                     status, created_by, is_sample, max_assignees)
  values
    (p_club_id, 'Beispiel: Kuchen für den Anlass backen',
     'Weil ein Anlass ohne Kuchen nur ein Termin ist.',
     'So sieht eine gute Ausschreibung aus: kurzer Titel, ein Warum, ein Wert.',
     'catering', 20, 'open', v_admin, true, 3),
    (p_club_id, 'Beispiel: Bewilligung einholen',
     'Ohne sie darf der Anlass nicht stattfinden.',
     'Aufgaben dürfen auch unspektakulär sein – sichtbar sollen sie trotzdem werden.',
     'organisation', 30, 'open', v_admin, true, 1),
    (p_club_id, 'Beispiel: Fotos vom Anlass sammeln',
     'Damit der Verein sich später daran erinnert.',
     'Eine kleine Aufgabe mit kleinem Wert – auch das ist ein Beitrag.',
     'communication', 10, 'open', v_admin, true, 1);
  v_count := v_count + 3;

  -- FR-142 und FR-143: drei Einführungs-Beiträge. Sie erklären die drei Dinge,
  -- die ein Mitglied als Erstes wissen will.
  insert into news (club_id, source, title, body, is_sample) values
    (p_club_id, 'club', 'Was die Punkte bedeuten',
     E'Punkte zeigen, wer den Verein trägt – nicht, wer besser ist.\n\n'
     'Du bekommst sie fürs Dabeisein, fürs Übernehmen von Aufgaben und für '
     'Helfereinsätze. Sie schreibt immer der Server, nie jemand von Hand. '
     'Und du entscheidest selbst, ob du in der Rangliste erscheinst.', true),
    (p_club_id, 'club', 'Wo du beitragen kannst',
     E'Im Marktplatz stehen Aufgaben, die der Verein zu vergeben hat.\n\n'
     'Jede trägt ein Warum: Du siehst, wofür es sie braucht, bevor du zusagst. '
     'Wenn du magst, hinterlegst du ein Beitrags-Profil – dann kommen die '
     'passenden Aufgaben zu dir, statt dass du suchen musst.', true),
    (p_club_id, 'club', 'Was dein Verein über dich sieht',
     E'Weniger, als du vielleicht denkst.\n\n'
     'Unter «Was sieht mein Verein?» in deinem Profil steht jede Datenart, aus '
     'der ein Hinweis entstehen kann – und ausdrücklich auch, was **nicht** '
     'erhoben wird: keine App-Nutzung, keine Lesebestätigungen, kein Standort. '
     'Widersprechen kannst du dort ebenfalls.', true);
  v_count := v_count + 3;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-134: Die Gründung legt sie an.
--
-- Der Rumpf ist wortgleich aus `0008` übernommen; neu ist allein der Aufruf am
-- Ende. Er steht in einem eigenen Block: Eine misslungene Erstbefüllung darf
-- die Gründung nicht scheitern lassen.
-- ---------------------------------------------------------------------------
create or replace function public.create_club(
  p_name         text,
  p_club_kind    text default 'other',
  p_season_start date default null,
  p_kind_label   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user     uuid := auth.uid();
  v_club_id  uuid;
  v_slug     text;
  v_suffix   int := 0;
  v_name     text;
  v_kind     text;
  v_settings jsonb;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  v_name := trim(p_name);
  if length(v_name) < 2 then
    raise exception 'Der Vereinsname ist zu kurz';
  end if;

  -- Eine unbekannte Vereinsart fiele sonst in den check-Constraint und
  -- brächte eine Meldung, die niemandem hilft.
  v_kind := coalesce(nullif(trim(p_club_kind), ''), 'other');
  if v_kind not in ('sport','music','culture','youth','neighborhood','other') then
    raise exception 'Unbekannte Vereinsart: %', v_kind;
  end if;

  -- A1: Der Kurzname bekommt eine Unterscheidung, bis er eindeutig ist.
  v_slug := slugify(v_name);
  if v_slug = '' then
    v_slug := 'verein';
  end if;
  while exists (select 1 from clubs where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := coalesce(nullif(slugify(v_name), ''), 'verein') || '-' || v_suffix;
  end loop;

  v_settings := jsonb_build_object('labels', default_event_labels(v_kind));

  -- Bei «Anderes» trägt der Verein seine eigene Bezeichnung; club_kind bleibt
  -- 'other', damit die Vorlagenlogik weiterhin greift (BR-001).
  if nullif(trim(coalesce(p_kind_label, '')), '') is not null then
    v_settings := v_settings || jsonb_build_object('kindLabel', trim(p_kind_label));
  end if;

  insert into clubs (name, slug, club_kind, season_start, settings)
  values (
    v_name,
    v_slug,
    v_kind,
    coalesce(p_season_start, default_season_start(v_kind)),
    v_settings
  )
  returning id into v_club_id;

  -- BR-003: Die gründende Person ist der erste Vorstand. Ohne diesen Schritt
  -- hätte der neue Verein niemanden, der ihn verwalten darf.
  insert into club_members (club_id, user_id, role, display_name)
  values (
    v_club_id,
    v_user,
    'admin',
    coalesce(
      (select nullif(raw_user_meta_data->>'full_name', '') from auth.users where id = v_user),
      split_part((select email from auth.users where id = v_user), '@', 1)
    )
  );

  perform seed_point_rules(v_club_id, v_kind);

  -- FR-134: Die Gründung legt die Beispielinhalte an.
  --
  -- In einem eigenen Block, damit eine misslungene Erstbefüllung die Gründung
  -- nicht scheitern lässt: «Der Verein startet ohne Beispielinhalte; die
  -- Gründung selbst gilt trotzdem als erfolgreich» (Failure Postcondition).
  begin
    perform seed_sample_content(v_club_id);
  exception when others then
    raise warning 'Beispielinhalte konnten nicht angelegt werden: %', sqlerrm;
  end;

  return v_club_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-136 und BR-163: alles in **einem** Schritt entfernen.
--
-- Gelöscht wird ausschliesslich, was `is_sample` trägt. Ein Inhalt, der aus
-- einem Beispiel hervorgegangen ist, hat die Kennzeichnung verloren und bleibt
-- deshalb unangetastet.
-- ---------------------------------------------------------------------------
create or replace function public.drop_sample_content(p_club_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int := 0;
  v_part  int;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand entfernt Beispielinhalte';
  end if;

  delete from news where club_id = p_club_id and is_sample;
  get diagnostics v_part = row_count; v_count := v_count + v_part;

  delete from tasks where club_id = p_club_id and is_sample;
  get diagnostics v_part = row_count; v_count := v_count + v_part;

  -- Die Schichten hängen am Termin und gehen mit ihm (`on delete cascade`).
  delete from events where club_id = p_club_id and is_sample;
  get diagnostics v_part = row_count; v_count := v_count + v_part;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- A3: einen Beispielinhalt übernehmen.
--
-- Die Kennzeichnung fällt weg – und damit gelten Zustellung, Punkte und
-- Verbindungs-Quote ab sofort. Ausgeschrieben wird dabei **nicht** erneut: Wer
-- eine Vorlage übernimmt, will sie bearbeiten, nicht verschicken.
-- ---------------------------------------------------------------------------
create or replace function public.adopt_sample(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
begin
  if p_kind = 'event' then
    select club_id into v_club from events where id = p_id and is_sample;
  elsif p_kind = 'task' then
    select club_id into v_club from tasks where id = p_id and is_sample;
  elsif p_kind = 'news' then
    select club_id into v_club from news where id = p_id and is_sample;
  else
    raise exception 'Unbekannte Art: %', p_kind;
  end if;

  if v_club is null then
    raise exception 'Beispielinhalt nicht gefunden';
  end if;

  if not is_club_admin(v_club) then
    raise exception 'Nur der Vorstand übernimmt Beispielinhalte';
  end if;

  if p_kind = 'event' then
    update events set is_sample = false where id = p_id;
  elsif p_kind = 'task' then
    update tasks set is_sample = false where id = p_id;
  else
    update news set is_sample = false where id = p_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-137 und A1: der Verfall.
--
-- Zwei Anlässe, und der erste ist der wichtigere: **Sobald der Verein einen
-- eigenen Inhalt derselben Art hat**, sind die Beispiele dieser Art überflüssig
-- (Schritt 6). Der zweite ist die Frist.
--
-- A4: Die Einführungs-Beiträge bleiben, bis der Verein seine **erste eigene
-- News** publiziert – sie erklären die App, nicht den Verein.
-- ---------------------------------------------------------------------------
create or replace function public.expire_sample_content()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club   record;
  v_days   int;
  v_person record;
  v_count  int := 0;
  v_part   int;
  -- Je Verein gezählt: `v_count` summiert über alle und taugt nicht als
  -- Bedingung für eine Meldung an **diesen** Vorstand.
  v_here   int;
begin
  for v_club in
    select c.id, c.settings, c.created_at
      from clubs c
     where not c.is_demo
       and (exists (select 1 from events e where e.club_id = c.id and e.is_sample)
            or exists (select 1 from tasks t where t.club_id = c.id and t.is_sample)
            or exists (select 1 from news n where n.club_id = c.id and n.is_sample))
  loop
    v_days := coalesce(
      nullif(v_club.settings->'sample'->>'days','')::int, 30);

    if v_club.created_at < now() - make_interval(days => v_days) then
      -- Die Frist ist um: alles weg, und der Vorstand erfährt es einmal.
      v_here := 0;
      delete from news where club_id = v_club.id and is_sample;
      get diagnostics v_part = row_count; v_here := v_here + v_part;
      delete from tasks where club_id = v_club.id and is_sample;
      get diagnostics v_part = row_count; v_here := v_here + v_part;
      delete from events where club_id = v_club.id and is_sample;
      get diagnostics v_part = row_count; v_here := v_here + v_part;
      v_count := v_count + v_here;

      if v_here > 0 then
        for v_person in
          select m.user_id from club_members m
           where m.club_id = v_club.id
             and m.role in ('admin','superadmin')
             and m.status <> 'left' and m.user_id is not null
        loop
          perform notify(v_person.user_id, 'general',
                         'Die Beispielinhalte sind verschwunden',
                         null, '/tabs/agenda', v_club.id);
        end loop;
      end if;
      continue;
    end if;

    -- Schritt 6: eigene Inhalte derselben Art verdrängen die Beispiele.
    if exists (select 1 from events e
                where e.club_id = v_club.id and not e.is_sample) then
      delete from events where club_id = v_club.id and is_sample;
      get diagnostics v_part = row_count; v_count := v_count + v_part;
    end if;

    if exists (select 1 from tasks t
                where t.club_id = v_club.id and not t.is_sample) then
      delete from tasks where club_id = v_club.id and is_sample;
      get diagnostics v_part = row_count; v_count := v_count + v_part;
    end if;

    -- A4: Die Einführungs-Beiträge bleiben länger – bis zur ersten eigenen News.
    if exists (select 1 from news n
                where n.club_id = v_club.id and not n.is_sample) then
      delete from news where club_id = v_club.id and is_sample;
      get diagnostics v_part = row_count; v_count := v_count + v_part;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-145 und BR-166: der Demo-Verein.
--
-- Ein eigener Mandant, der nachts zurückgesetzt wird. Was hier geschieht,
-- wirkt sich auf keinen echten Verein aus – es gibt keine Verbindung zwischen
-- den beiden ausser der, dass dieselbe App sie zeigt.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_demo_club()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
  v_host uuid;
begin
  select id into v_club from clubs where is_demo;
  if v_club is not null then
    return v_club;
  end if;

  insert into clubs (name, slug, club_kind, is_demo, settings)
  values ('Demo-Verein', 'demo', 'sport', true,
          jsonb_build_object('modules',
            jsonb_build_object('voice', true, 'meeting', true, 'checkin', true,
                               'pulse', true, 'health', true)))
  returning id into v_club;

  -- Eine Vorstandsperson ohne Konto: Sie trägt die Inhalte, meldet sich aber
  -- nie an. So gehört der Demo-Verein niemandem.
  insert into club_members (club_id, user_id, role, display_name)
  values (v_club, null, 'admin', 'Demo-Vorstand')
  returning id into v_host;

  insert into club_members (club_id, user_id, role, display_name) values
    (v_club, null, 'trainer', 'Toni Trainer'),
    (v_club, null, 'member', 'Ana Beispiel'),
    (v_club, null, 'member', 'Ben Muster'),
    (v_club, null, 'member', 'Cem Probe');

  perform seed_point_rules(v_club, 'sport');
  perform seed_checkin_prompts(v_club);
  perform seed_sample_content(v_club);

  return v_club;
end;
$$;

-- A5: beitreten. Wer hier landet, ist Mitglied wie jedes andere – **nicht**
-- Vorstand: Ein Gast soll die App sehen, nicht sie umbauen.
create or replace function public.join_demo_club()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  v_club := ensure_demo_club();

  insert into club_members (club_id, user_id, role, display_name)
  values (v_club, v_user, 'member',
          coalesce(
            (select nullif(raw_user_meta_data->>'full_name','') from auth.users where id = v_user),
            'Gast'))
  on conflict (club_id, user_id) do nothing;

  return v_club;
end;
$$;

-- BR-166: der nächtliche Reset. Alles, was Besucher:innen angelegt haben,
-- verschwindet – die Beispielinhalte entstehen neu.
create or replace function public.reset_demo_club()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club  uuid;
  v_count int := 0;
begin
  select id into v_club from clubs where is_demo;
  if v_club is null then
    return 0;
  end if;

  -- Erst die Inhalte, dann die Gäste: Umgekehrt räumte die Kaskade schon auf,
  -- und die Zählung stünde auf einer Zahl, die nichts mehr bedeutet.
  delete from point_transactions where member_id in
    (select id from club_members where club_id = v_club);
  delete from news where club_id = v_club;
  delete from tasks where club_id = v_club;
  delete from events where club_id = v_club;
  delete from voice_notes where club_id = v_club;
  delete from meeting_inputs where club_id = v_club;
  delete from health_signals where club_id = v_club;

  delete from club_members where club_id = v_club and user_id is not null;
  get diagnostics v_count = row_count;

  perform seed_sample_content(v_club);
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte.
-- ---------------------------------------------------------------------------
revoke execute on function public.drop_sample_content(uuid) from public, anon;
grant  execute on function public.drop_sample_content(uuid) to authenticated;

revoke execute on function public.adopt_sample(text, uuid) from public, anon;
grant  execute on function public.adopt_sample(text, uuid) to authenticated;

revoke execute on function public.join_demo_club() from public, anon;
grant  execute on function public.join_demo_club() to authenticated;

-- Interne Routinen: Sie haben als eigener Endpunkt keinen Zweck.
revoke execute on function public.seed_sample_content(uuid)
  from public, anon, authenticated;
revoke execute on function public.ensure_demo_club()
  from public, anon, authenticated;
revoke execute on function public.expire_sample_content()
  from public, anon, authenticated;
revoke execute on function public.reset_demo_club()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Aufträge.
-- ---------------------------------------------------------------------------
select cron.unschedule('sample-expire')
 where exists (select 1 from cron.job where jobname = 'sample-expire');
select cron.schedule('sample-expire', '40 4 * * *',
  $cron$select public.expire_sample_content();$cron$);

select cron.unschedule('demo-reset')
 where exists (select 1 from cron.job where jobname = 'demo-reset');
select cron.schedule('demo-reset', '10 3 * * *',
  $cron$select public.reset_demo_club();$cron$);

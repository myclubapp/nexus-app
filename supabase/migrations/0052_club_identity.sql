-- ============================================================================
-- 0052_club_identity: Vereinsidentität, Begriffe und Module (UC-034)
--
-- Zwei Regeln bestimmen diese Migration.
--
-- **BR-148: Vier Sprachen.** `clubs.settings.labels` hält heute **ein** Wort je
-- Terminart, das in allen vier Sprachen erscheint. Ein Verein, der «Probe»
-- sagt, sagt auf Französisch «répétition» – heute kann er das nicht hinterlegen.
--
-- **BR-150: Module im Tempo des Vereins.** Weitere Module werden vorgeschlagen,
-- nie automatisch aktiviert (K7). Ab hier sind Stimme, Sitzungen, Check-ins,
-- Puls und Cockpit standardmässig **aus**. Sie sind gebaut und bleiben es –
-- sichtbar werden sie, wenn der Vorstand sie einschaltet.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Begriffe je Sprache.
--
-- Aus `{"training": "Probe"}` wird `{"training": {"de":"Probe","fr":"Probe",
-- "it":"Probe","en":"Probe"}}`. Alle vier bekommen denselben Text, weil genau
-- das das heutige Verhalten ist – die Umstellung ändert nichts, sie macht es
-- nur benennbar. Wer danach übersetzt, überschreibt einzelne Sprachen.
-- ---------------------------------------------------------------------------
update clubs c
   set settings = jsonb_set(
         c.settings,
         '{labels}',
         (select jsonb_object_agg(
                   key,
                   jsonb_build_object('de', value, 'fr', value,
                                      'it', value, 'en', value))
            from jsonb_each_text(c.settings->'labels')))
 where jsonb_typeof(c.settings->'labels') = 'object'
   -- Nur Vereine, deren Begriffe noch Texte sind. Ein bereits umgestellter
   -- Verein trägt Objekte und bleibt unberührt – die Migration ist damit
   -- wiederholbar.
   and exists (select 1 from jsonb_each(c.settings->'labels') e
                where jsonb_typeof(e.value) = 'string');

-- ---------------------------------------------------------------------------
-- Die Module.
--
-- Ein Modul ist an, wenn `settings.modules.<name>` **wahr** ist. Fehlt der
-- Eintrag, ist es aus – das ist der Unterschied zu jeder anderen Einstellung
-- dieser App und mit Absicht so: BR-149 sagt, Konfiguration sei Kür, und K7
-- sagt, womit ein Verein startet. Ein Modul, das ungefragt da ist, wäre keine
-- progressive Aktivierung.
-- ---------------------------------------------------------------------------
create or replace function public.module_enabled(p_club_id uuid, p_module text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (c.settings->'modules'->>p_module)::boolean
       from clubs c where c.id = p_club_id),
    false);
$$;

-- ---------------------------------------------------------------------------
-- Wer ein Modul bereits benutzt, behält es.
--
-- «Standardmässig aus» gilt für **neue** Vereine. Einem Verein, der seit Wochen
-- Anliegen schreibt, das Modul wegzunehmen, wäre keine progressive Aktivierung,
-- sondern ein Datenverlust aus Sicht der Bedienenden – die Anliegen wären noch
-- da und niemand käme mehr hin.
-- ---------------------------------------------------------------------------
update clubs c
   set settings = jsonb_set(
         c.settings,
         '{modules}',
         coalesce(c.settings->'modules', '{}'::jsonb) || jsonb_strip_nulls(
           jsonb_build_object(
             'voice',   case when exists (select 1 from voice_notes v
                                           where v.club_id = c.id) then true end,
             'meeting', case when exists (select 1 from meeting_inputs i
                                           where i.club_id = c.id)
                              or exists (select 1 from functionary_roles r
                                          where r.club_id = c.id) then true end,
             'checkin', case when exists (select 1 from checkin_responses r
                                           where r.club_id = c.id) then true end,
             'pulse',   case when exists (select 1 from club_pulses p
                                           where p.club_id = c.id) then true end,
             'health',  case when exists (select 1 from health_signals h
                                           where h.club_id = c.id) then true end)))
 where exists (select 1 from voice_notes v where v.club_id = c.id)
    or exists (select 1 from meeting_inputs i where i.club_id = c.id)
    or exists (select 1 from functionary_roles r where r.club_id = c.id)
    or exists (select 1 from checkin_responses r where r.club_id = c.id)
    or exists (select 1 from club_pulses p where p.club_id = c.id)
    or exists (select 1 from health_signals h where h.club_id = c.id);

-- ---------------------------------------------------------------------------
-- Die Sperren an den bestehenden Funktionen.
--
-- Das Ausblenden im Client ist Bequemlichkeit, nicht Schutz (C-011). Ein
-- abgeschaltetes Modul muss auch dann nichts tun, wenn jemand die Funktion
-- direkt aufruft.
-- ---------------------------------------------------------------------------

-- UC-029: ein Anliegen entsteht nur, wenn «Stimme» an ist. Der Rumpf ist
-- wortgleich aus `0046` übernommen; neu ist allein die Sperre.
create or replace function public.submit_voice_note(
  p_club_id     uuid,
  p_kind        text,
  p_transcript  text,
  p_target_member uuid default null,
  p_target_role text default null,
  p_target_team uuid default null,
  p_token_hash  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid;
  v_text   text;
  v_note   uuid;
  v_person record;
begin
  -- UC-034/BR-150: Ein abgeschaltetes Modul tut nichts – auch dann
  -- nicht, wenn jemand die Funktion direkt aufruft (C-011).
  if not module_enabled(p_club_id, 'voice') then
    raise exception 'Das Modul «Stimme» ist in diesem Verein nicht aktiv';
  end if;

  v_member := current_member_id(p_club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  v_text := nullif(trim(p_transcript), '');
  if v_text is null then
    raise exception 'Ein Anliegen braucht seinen Text';
  end if;

  if p_kind not in ('self_reflection','coach_log','feedback','anonymous') then
    raise exception 'Unbekannte Art';
  end if;

  -- A5: Das Kontingent gilt auch für anonyme Anliegen – es zählt die Person,
  -- ohne sie am Anliegen festzuhalten.
  if voice_quota_left(p_club_id) <= 0 then
    raise exception 'Für diesen Monat ist das Kontingent ausgeschöpft';
  end if;

  if p_kind = 'anonymous' then
    if coalesce(trim(p_token_hash), '') = '' then
      raise exception 'Ohne Ticket gäbe es keinen Rückweg für die Antwort';
    end if;

    -- BR-122: kein Autor, kein Zeitstempel. Der Constraint erzwingt es; hier
    -- steht es nochmals, damit man beim Lesen nicht danach suchen muss.
    insert into voice_notes
      (club_id, kind, transcript, anon_token_hash, created_week)
    values
      (p_club_id, 'anonymous', v_text, p_token_hash,
       to_char(now(), 'IYYY-"W"IW'))
    returning id into v_note;
  else
    insert into voice_notes
      (club_id, kind, author_member_id, target_member_id, target_role,
       target_team_id, transcript, created_week, created_at)
    values
      (p_club_id, p_kind, v_member,
       case when p_kind = 'feedback' then p_target_member end,
       case when p_kind = 'feedback' then p_target_role end,
       case when p_kind = 'feedback' then p_target_team end,
       v_text, to_char(now(), 'IYYY-"W"IW'), now())
    returning id into v_note;
  end if;

  -- Schritt 9: die Empfänger:innen benachrichtigen. Private Anliegen erreichen
  -- niemanden – sie sind das Gegenteil einer Nachricht.
  if p_kind in ('feedback','anonymous') then
    for v_person in
      select distinct m.user_id
        from club_members m
       where m.club_id = p_club_id
         and m.status <> 'left'
         and m.user_id is not null
         and (
           (p_kind = 'anonymous' and m.role in ('admin','superadmin'))
           or (p_kind = 'feedback' and (
                 m.id = p_target_member
                 or (p_target_role = 'admin' and m.role in ('admin','superadmin'))
                 or (p_target_role = 'trainer' and m.role = 'trainer')
                 or (p_target_team is not null and m.role = 'trainer'
                     and exists (select 1 from team_members tm
                                  where tm.team_id = p_target_team
                                    and tm.member_id = m.id))
               ))
         )
    loop
      -- Der Text steht **nicht** in der Nachricht: Er gehört in die App, nicht
      -- auf einen Sperrbildschirm.
      perform notify(
        v_person.user_id, 'input', 'Ein Anliegen ist eingegangen',
        null, '/tabs/profile/voice', p_club_id
      );
    end loop;
  end if;

  return v_note;
end;
$$;

-- UC-031: ein Sitzungs-Input entsteht nur, wenn «Sitzungen» an ist.
create or replace function public.submit_meeting_input(
  p_club_id    uuid,
  p_body       text,
  p_roles      jsonb,
  p_anonymous  boolean default false,
  p_token_hash text default null,
  p_source_note uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid;
  v_text   text;
  v_input  uuid;
  v_person record;
  v_known  int;
begin
  -- UC-034/BR-150: Ein abgeschaltetes Modul tut nichts – auch dann
  -- nicht, wenn jemand die Funktion direkt aufruft (C-011).
  if not module_enabled(p_club_id, 'meeting') then
    raise exception 'Das Modul «Sitzungen» ist in diesem Verein nicht aktiv';
  end if;

  v_member := current_member_id(p_club_id);
  if v_member is null then
    raise exception 'Nur Mitglieder reichen Inputs ein';
  end if;

  v_text := nullif(trim(p_body), '');
  if v_text is null then
    raise exception 'Ohne Text kein Input';
  end if;

  if jsonb_typeof(p_roles) <> 'array' or jsonb_array_length(p_roles) = 0 then
    raise exception 'Wähle das Zielgremium';
  end if;

  -- Jede genannte Kennung muss ein Amt **dieses** Vereins sein. Ohne diese
  -- Prüfung liesse sich ein Input an ein fremdes Gremium adressieren und wäre
  -- dort über die Policy lesbar.
  select count(*) into v_known
    from functionary_roles r
   where r.club_id = p_club_id
     and p_roles @> jsonb_build_array(r.id::text);
  if v_known <> jsonb_array_length(p_roles) then
    raise exception 'Unbekanntes Amt im Zielgremium';
  end if;

  -- Die Quelle muss ein eigenes Anliegen sein: Sonst liesse sich fremdes
  -- Gesagtes in ein Gremium tragen (BR-123).
  if p_source_note is not null then
    if not exists (select 1 from voice_notes n
                    where n.id = p_source_note
                      and n.club_id = p_club_id
                      and n.author_member_id = v_member) then
      raise exception 'Dieses Anliegen gehört dir nicht';
    end if;
  end if;

  if p_anonymous then
    if coalesce(trim(p_token_hash), '') = '' then
      raise exception 'Ohne Ticket kein anonymer Input';
    end if;
    insert into meeting_inputs
      (club_id, body, committee_role_ids, anon_token_hash, source_voice_note_id)
    values
      (p_club_id, v_text, p_roles, p_token_hash, p_source_note)
    returning id into v_input;
  else
    insert into meeting_inputs
      (club_id, body, committee_role_ids, author_member_id, source_voice_note_id)
    values
      (p_club_id, v_text, p_roles, v_member, p_source_note)
    returning id into v_input;
  end if;

  -- Schritt 6: an die **aktuellen** Amtsinhaber:innen.
  for v_person in select * from committee_members(p_club_id, p_roles) loop
    perform notify(v_person.user_id, 'input', 'Ein Input ist eingegangen',
                   null, '/tabs/profile/meeting', p_club_id);
  end loop;

  return v_input;
end;
$$;

-- ---------------------------------------------------------------------------
-- Die Aufträge folgen derselben Sperre.
--
-- `0050` las bisher `settings.checkin.enabled` und behandelte ein fehlendes
-- Feld als **an**. Ab hier entscheidet `modules.checkin`, und der fehlende
-- Eintrag heisst **aus**.
-- ---------------------------------------------------------------------------
create or replace function public.detect_checkins()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row     record;
  v_context text;
  v_invite  uuid;
  v_count   int := 0;
begin
  for v_row in
    select a.member_id, a.status, a.shift_id, e.id as event_id, e.type,
           e.club_id, e.title, m.user_id
      from attendance a
      join events e on e.id = a.event_id
      join club_members m on m.id = a.member_id
     where coalesce(e.ends_at, e.starts_at) between now() - interval '24 hours' and now()
       and e.published_at is not null
       and e.cancelled_at is null
       and not e.is_sample
       and m.status <> 'left'
       and m.user_id is not null
       and module_enabled(e.club_id, 'checkin')
  loop
    v_invite := null;
    v_context := checkin_context(v_row.type, v_row.status, v_row.shift_id);
    if v_context is null then
      continue;
    end if;

    if not exists (select 1 from checkin_prompts p
                    where p.club_id = v_row.club_id
                      and p.context = v_context
                      and p.is_active) then
      continue;
    end if;

    insert into checkin_invitations (club_id, member_id, event_id, context)
    values (v_row.club_id, v_row.member_id, v_row.event_id, v_context)
    on conflict do nothing
    returning id into v_invite;

    if v_invite is null then
      continue;
    end if;

    perform notify(v_row.user_id, 'checkin', 'Wie ging es dir?',
                   v_row.title, '/tabs/profile/mood', v_row.club_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.ask_office_load()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row    record;
  v_invite uuid;
  v_count  int := 0;
begin
  for v_row in
    select r.club_id, r.holder_member_id as member_id, m.user_id
      from functionary_roles r
      join club_members m on m.id = r.holder_member_id
     where m.status <> 'left'
       and m.user_id is not null
       and module_enabled(r.club_id, 'checkin')
       and not exists (
         select 1 from checkin_invitations i
          where i.member_id = r.holder_member_id
            and i.context = 'office_load'
            and i.created_at > now() - interval '90 days')
  loop
    v_invite := null;
    insert into checkin_invitations (club_id, member_id, context)
    values (v_row.club_id, v_row.member_id, 'office_load')
    on conflict do nothing
    returning id into v_invite;

    if v_invite is null then
      continue;
    end if;

    perform notify(v_row.user_id, 'checkin', 'Wie tragfähig fühlt sich dein Amt an?',
                   null, '/tabs/profile/mood', v_row.club_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- A2 und BR-150: der Vorschlag.
--
-- Er **aktiviert nichts**. Er sagt dem Vorstand, dass der Verein eine Grösse
-- erreicht hat, ab der ein Modul trägt – und begründet es mit der Zahl, nicht
-- mit einer Behauptung.
--
-- Vorgeschlagen wird je Modul höchstens einmal: Ein Vorschlag, der wiederkehrt,
-- ist eine Aufforderung.
-- ---------------------------------------------------------------------------
create table if not exists club_module_suggestions (
  club_id     uuid not null references clubs(id) on delete cascade,
  module      text not null,
  suggested_at timestamptz not null default now(),
  primary key (club_id, module)
);

alter table club_module_suggestions enable row level security;

drop policy if exists club_module_suggestions_read on club_module_suggestions;
create policy club_module_suggestions_read on club_module_suggestions
  for select using (is_club_admin(club_id));

create or replace function public.suggest_modules()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club   record;
  v_person record;
  v_active int;
  v_module text;
  v_count  int := 0;
  -- Die Schwellen. Sie stehen hier und nicht in den Vereinseinstellungen: Eine
  -- Schwelle, die jeder Verein selbst setzt, ist keine.
  v_thresholds constant jsonb :=
    '{"checkin": 20, "voice": 40, "meeting": 40, "pulse": 25, "health": 30}'::jsonb;
begin
  for v_club in select c.id, c.settings from clubs c loop
    select count(*) into v_active
      from club_members m
     where m.club_id = v_club.id and m.status = 'active';

    for v_module in select jsonb_object_keys(v_thresholds) loop
      -- Schon an, schon vorgeschlagen oder noch zu klein: nichts tun.
      if module_enabled(v_club.id, v_module) then
        continue;
      end if;
      if exists (select 1 from club_module_suggestions s
                  where s.club_id = v_club.id and s.module = v_module) then
        continue;
      end if;
      if v_active < (v_thresholds->>v_module)::int then
        continue;
      end if;

      insert into club_module_suggestions (club_id, module)
      values (v_club.id, v_module)
      on conflict do nothing;

      for v_person in
        select m.user_id from club_members m
         where m.club_id = v_club.id
           and m.role in ('admin','superadmin')
           and m.status <> 'left' and m.user_id is not null
      loop
        perform notify(v_person.user_id, 'general',
                       'Ein Modul könnte jetzt tragen',
                       v_active::text, '/tabs/profile/club', v_club.id);
      end loop;

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte.
-- ---------------------------------------------------------------------------
revoke execute on function public.module_enabled(uuid, text) from public, anon;
grant  execute on function public.module_enabled(uuid, text) to authenticated;

revoke execute on function public.suggest_modules() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Der Auftrag. Wöchentlich – eine Schwelle wird nicht stündlich überschritten.
-- ---------------------------------------------------------------------------
select cron.unschedule('module-suggest')
 where exists (select 1 from cron.job where jobname = 'module-suggest');
select cron.schedule('module-suggest', '5 9 * * 3',
  $cron$select public.suggest_modules();$cron$);

-- ============================================================================
-- 0047_answer_voice_notes: Anliegen beantworten (UC-030)
--
-- BR-128 ist der Satz, um den es geht: «Speak-up braucht Listen-up.» Ein
-- Anliegen kann abgelehnt werden, aber nicht versanden. `0046` hat die eine
-- Hälfte gebaut – ohne diese hier wäre sie ein Briefkasten ohne Leerung.
--
-- Der schwierigste Teil ist BR-129: **Antwort trotz Anonymität.** Der Rückkanal
-- läuft ausschliesslich über den Prüfwert des lokalen Tickets. Wer angemeldet
-- ist, spielt dabei keine Rolle – sonst tauchte die Identität doch wieder auf.
-- ============================================================================

-- Der Faden. Für ein anonymes Anliegen ist er der **einzige** Weg zurück.
create table if not exists voice_note_messages (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references voice_notes(id) on delete cascade,
  -- `board` oder `author`. Ein Name steht hier nie: Beim anonymen Faden gäbe
  -- es keinen, und beim gerichteten steht er schon am Anliegen.
  author_side text not null check (author_side in ('board','author')),
  body        text not null check (length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists voice_note_messages_note_idx
  on voice_note_messages(note_id, created_at);

alter table voice_note_messages enable row level security;

-- Lesbar ist ein Faden, wenn das Anliegen lesbar ist. Die Regel steht damit
-- an **einer** Stelle – in der Policy von `voice_notes`.
drop policy if exists voice_note_messages_read on voice_note_messages;
create policy voice_note_messages_read on voice_note_messages
  for select using (
    exists (select 1 from voice_notes n where n.id = note_id)
  );

alter table voice_notes add column if not exists answered_at timestamptz;
alter table voice_notes add column if not exists answered_by uuid
  references club_members(id) on delete set null;
-- A6: gemeldet heisst aus der Inbox, nicht gelöscht.
alter table voice_notes add column if not exists flagged_at timestamptz;

-- BR-128: Ein Endstatus ohne Antwort wäre genau das Versanden, das die Regel
-- ausschliesst.
alter table voice_notes drop constraint if exists voice_notes_answer_check;
alter table voice_notes add constraint voice_notes_answer_check
  check (
    status not in ('answered','declined')
    or coalesce(trim(response), '') <> ''
  );

-- ---------------------------------------------------------------------------
-- Darf diese Person dieses Anliegen bearbeiten?
--
-- Dieselbe Frage wie in der Lese-Policy – und deshalb dieselbe Antwort, aus
-- einer Funktion. Zwei Kopien wären zwei Reichweiten.
-- ---------------------------------------------------------------------------
create or replace function public.can_handle_note(p_note_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from voice_notes n
     where n.id = p_note_id
       -- Private Anliegen bearbeitet niemand – sie sind an niemanden gerichtet.
       and n.kind in ('feedback','anonymous')
       and (
         (n.kind = 'anonymous' and is_club_admin(n.club_id))
         or (
           n.kind = 'feedback'
           and exists (
             select 1 from club_members me
              where me.id = current_member_id(n.club_id)
                and (
                  n.target_member_id = me.id
                  or (n.target_role = 'admin' and me.role in ('admin','superadmin'))
                  or (n.target_role = 'trainer' and me.role = 'trainer')
                  or (
                    n.target_team_id is not null
                    and me.role = 'trainer'
                    and exists (select 1 from team_members tm
                                 where tm.team_id = n.target_team_id
                                   and tm.member_id = me.id)
                  )
                )
           )
         )
       )
  );
$$;

-- ---------------------------------------------------------------------------
-- Schritt 4: der Statuswechsel (FR-092).
-- ---------------------------------------------------------------------------
create or replace function public.set_note_status(
  p_note_id uuid,
  p_status  text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not can_handle_note(p_note_id) then
    raise exception 'Dieses Anliegen ist nicht an dich gerichtet';
  end if;

  if p_status not in ('open','in_progress') then
    raise exception 'Ein Endstatus entsteht nur mit einer Antwort';
  end if;

  update voice_notes set status = p_status where id = p_note_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schritte 5 bis 7: antworten (FR-099).
--
-- A4 ist derselbe Weg mit `p_decline`: Auch eine Ablehnung ist eine Antwort –
-- BR-128 lässt keinen Endstatus ohne sie zu.
-- ---------------------------------------------------------------------------
create or replace function public.answer_voice_note(
  p_note_id uuid,
  p_answer  text,
  p_decline boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_note   voice_notes;
  v_text   text;
  v_user   uuid;
begin
  select * into v_note from voice_notes where id = p_note_id for update;
  if not found then
    raise exception 'Anliegen nicht gefunden';
  end if;

  if not can_handle_note(p_note_id) then
    raise exception 'Dieses Anliegen ist nicht an dich gerichtet';
  end if;

  v_text := nullif(trim(p_answer), '');
  if v_text is null then
    raise exception 'Zu einem Entscheid gehört seine Begründung';
  end if;

  update voice_notes
     set response = v_text,
         status = case when p_decline then 'declined' else 'answered' end,
         answered_at = now(),
         answered_by = current_member_id(v_note.club_id)
   where id = p_note_id;

  insert into voice_note_messages (note_id, author_side, body)
  values (p_note_id, 'board', v_text);

  -- Schritt 7: zustellen – **ausser** bei anonym. Dort gibt es niemanden, dem
  -- man zustellen könnte, und genau das ist die Absicht (BR-129). Die Antwort
  -- wird abgeholt.
  if v_note.kind = 'feedback' and v_note.author_member_id is not null then
    select user_id into v_user from club_members where id = v_note.author_member_id;
    if v_user is not null then
      perform notify(
        v_user, 'input', 'Auf dein Anliegen gibt es eine Antwort',
        null, '/tabs/profile/voice', v_note.club_id
      );
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- A1 und FR-091: der anonyme Faden.
--
-- **Nur** das Ticket zählt. Die Funktion fragt nicht, wer ruft – sie prüft den
-- Wert. Wäre sie an die Anmeldung gebunden, liefe der Rückkanal doch über die
-- Identität, und BR-129 wäre gebrochen.
-- ---------------------------------------------------------------------------
create or replace function public.anon_thread(p_token_hash text)
returns table (
  note_id     uuid,
  transcript  text,
  status      text,
  created_week text,
  messages    jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    n.id, n.transcript, n.status, n.created_week,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'side', m.author_side, 'body', m.body, 'at', m.created_at)
               order by m.created_at)
        from voice_note_messages m where m.note_id = n.id
    ), '[]'::jsonb)
  from voice_notes n
  where n.kind = 'anonymous'
    and n.anon_token_hash = p_token_hash
    and coalesce(trim(p_token_hash), '') <> '';
$$;

-- Nachfassen, ohne sich zu erkennen zu geben. Es entsteht **kein** neues
-- Anliegen: Sonst zählte jede Rückfrage gegen das Kontingent, und der Faden
-- zerfiele in Einzelstücke.
create or replace function public.follow_up_anon(
  p_token_hash text,
  p_body       text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_note voice_notes;
  v_text text;
  v_person record;
begin
  v_text := nullif(trim(p_body), '');
  if v_text is null then
    raise exception 'Ohne Text kein Nachfassen';
  end if;

  select * into v_note from voice_notes
   where kind = 'anonymous'
     and anon_token_hash = p_token_hash
     and coalesce(trim(p_token_hash), '') <> '';
  if not found then
    raise exception 'Zu diesem Ticket gibt es keinen Faden';
  end if;

  insert into voice_note_messages (note_id, author_side, body)
  values (v_note.id, 'author', v_text);

  -- Der Faden lebt wieder – der Status geht zurück auf «in Arbeit», damit die
  -- Anmahnung ihn erneut erfasst, wenn niemand reagiert.
  update voice_notes set status = 'in_progress' where id = v_note.id;

  for v_person in
    select m.user_id from club_members m
     where m.club_id = v_note.club_id
       and m.role in ('admin','superadmin')
       and m.status <> 'left' and m.user_id is not null
  loop
    perform notify(v_person.user_id, 'input', 'Im anonymen Faden gibt es eine Rückfrage',
                   null, '/tabs/profile/voice', v_note.club_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- A3 und FR-093: aus dem Wort eine Handlung.
-- ---------------------------------------------------------------------------
create or replace function public.convert_note_to_task(
  p_note_id  uuid,
  p_title    text,
  p_why      text,
  p_category text,
  p_points   int,
  p_due_at   timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_note voice_notes;
  v_task uuid;
begin
  select * into v_note from voice_notes where id = p_note_id;
  if not found then
    raise exception 'Anliegen nicht gefunden';
  end if;

  if not can_handle_note(p_note_id) then
    raise exception 'Dieses Anliegen ist nicht an dich gerichtet';
  end if;

  -- BR-130: höchstens **eine** Aufgabe je Anliegen.
  if v_note.converted_task_id is not null then
    raise exception 'Aus diesem Anliegen ist bereits eine Aufgabe entstanden';
  end if;

  -- Das Transkript wird die Beschreibung (A3, Schritt 1).
  v_task := create_task(
    v_note.club_id, p_title, p_why, p_category, p_points, p_due_at, 1,
    v_note.transcript, null, null
  );

  update voice_notes set converted_task_id = v_task where id = p_note_id;
  return v_task;
end;
$$;

-- ---------------------------------------------------------------------------
-- A6: Missbrauch melden.
--
-- Eine «im Verein bestimmte Stelle» gibt es im Datenmodell nicht. Das Anliegen
-- verschwindet deshalb aus der Inbox der Empfänger:in und bleibt dem Vorstand
-- sichtbar – gelöscht wird es nicht: Wer meldet, entscheidet nicht allein.
-- ---------------------------------------------------------------------------
create or replace function public.flag_note(p_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not can_handle_note(p_note_id) then
    raise exception 'Dieses Anliegen ist nicht an dich gerichtet';
  end if;

  update voice_notes set flagged_at = now() where id = p_note_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- A5, FR-094, BR-131: Unbeantwortetes wird sichtbar.
--
-- `inputs_unanswered` steht seit `0040` im Constraint und hatte bis heute
-- keine Datenquelle. Ab jetzt schon – nach denselben Regeln wie jedes andere
-- Signal.
-- ---------------------------------------------------------------------------
create or replace function public.flag_unanswered_notes()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club  record;
  v_days  int;
  v_open  int;
  v_count int := 0;
begin
  for v_club in select c.id, c.settings from clubs c loop
    v_days := coalesce(
      nullif(v_club.settings->'voice'->>'answerDays','')::int, 14);

    select count(*) into v_open
      from voice_notes n
     where n.club_id = v_club.id
       and n.kind in ('feedback','anonymous')
       and n.status in ('open','in_progress')
       and n.flagged_at is null
       -- Anonyme Anliegen tragen keinen Zeitstempel; die Kalenderwoche genügt,
       -- um «zu lange her» zu erkennen (BR-122 bleibt unangetastet).
       and coalesce(
             n.created_at,
             to_date(n.created_week, 'IYYY-"W"IW')::timestamptz
           ) < now() - make_interval(days => v_days);

    if v_open = 0 then
      continue;
    end if;

    insert into health_signals
      (club_id, member_id, team_id, signal_type, severity, detail)
    values
      (v_club.id, null, null, 'inputs_unanswered', 'attention', v_open::text)
    on conflict do nothing;

    if found then
      v_count := v_count + 1;
      perform notify_signal_owners(
        (select id from health_signals
          where club_id = v_club.id and signal_type = 'inputs_unanswered'));
    end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.can_handle_note(uuid) from public, anon;
grant  execute on function public.can_handle_note(uuid) to authenticated;

revoke execute on function public.set_note_status(uuid, text) from public, anon;
grant  execute on function public.set_note_status(uuid, text) to authenticated;

revoke execute on function public.answer_voice_note(uuid, text, boolean) from public, anon;
grant  execute on function public.answer_voice_note(uuid, text, boolean) to authenticated;

-- Der anonyme Rückkanal fragt nicht nach der Anmeldung – aber `anon` braucht
-- er trotzdem nicht: Die App ist angemeldet, das Ticket ist der Ausweis.
revoke execute on function public.anon_thread(text) from public, anon;
grant  execute on function public.anon_thread(text) to authenticated;

revoke execute on function public.follow_up_anon(text, text) from public, anon;
grant  execute on function public.follow_up_anon(text, text) to authenticated;

revoke execute on function public.convert_note_to_task(uuid, text, text, text, int, timestamptz)
  from public, anon;
grant  execute on function public.convert_note_to_task(uuid, text, text, text, int, timestamptz)
  to authenticated;

revoke execute on function public.flag_note(uuid) from public, anon;
grant  execute on function public.flag_note(uuid) to authenticated;

revoke execute on function public.flag_unanswered_notes()
  from public, anon, authenticated;

select cron.unschedule('voice-unanswered')
 where exists (select 1 from cron.job where jobname = 'voice-unanswered');
select cron.schedule('voice-unanswered', '17 5 * * *',
  $cron$select public.flag_unanswered_notes();$cron$);

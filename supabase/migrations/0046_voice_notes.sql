-- ============================================================================
-- 0046_voice_notes: «Stimme» – Anliegen erfassen und adressieren (UC-029)
--
-- Der Kern dieses Use Case ist nicht das Mikrofon, sondern BR-122:
--
--   «Für anonyme Anliegen existiert keine Spalte, die die Autorschaft
--    aufnehmen könnte.»
--
-- Das ist eine Zusage, die man in der Tabellendefinition sehen muss – nicht
-- eine Berechtigungsregel, die etwas verbirgt, das trotzdem dasteht. Der
-- Constraint unten ist deshalb der wichtigste Teil dieser Migration.
--
-- Ebenso BR-123: Selbstreflexion und Trainer-Logbuch sind **ausschliesslich**
-- für ihre Verfasser:innen lesbar. Auch nicht für den Vorstand.
--
-- Nicht enthalten: Aufnahme und Transkription. `SpeechRecognition` im Browser
-- schickt das Audio zu Google und ist durch BR-125 ausgeschlossen; ein Modell
-- auf dem Gerät wäre ein Paket von zig Megabyte. A4 der Spezifikation nennt
-- den Textweg ohnehin als regulären Ablauf.
-- ============================================================================

create table if not exists voice_notes (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references clubs(id) on delete cascade,
  kind             text not null check (kind in
                      ('self_reflection','coach_log','feedback','anonymous')),
  author_member_id uuid references club_members(id) on delete cascade,
  target_member_id uuid references club_members(id) on delete set null,
  target_role      text check (target_role in ('trainer','sportchef','admin')),
  target_team_id   uuid references teams(id) on delete set null,
  transcript       text not null check (length(transcript) between 1 and 5000),
  audio_url        text,
  status           text not null default 'open'
                     check (status in ('open','in_progress','answered','resolved','declined')),
  response         text check (response is null or length(response) <= 2000),
  anon_token_hash  text,
  converted_task_id uuid references tasks(id) on delete set null,
  -- BR-122: die Kalenderwoche genügt. Ein genauer Zeitstempel wäre bei wenigen
  -- Absendenden bereits ein Personenbezug.
  created_week     text not null,
  created_at       timestamptz
);

-- ---------------------------------------------------------------------------
-- BR-122 als Constraint.
--
-- Ohne ihn wäre die Anonymität eine Absichtserklärung. Mit ihm scheitert das
-- Einfügen – auch aus einer `security definer`-Funktion heraus, auch aus einem
-- Versehen, auch in fünf Jahren.
-- ---------------------------------------------------------------------------
alter table voice_notes drop constraint if exists voice_notes_anonymous_check;
alter table voice_notes add constraint voice_notes_anonymous_check
  check (
    case when kind = 'anonymous'
      then author_member_id is null
           and created_at is null
           and anon_token_hash is not null
      else author_member_id is not null
    end
  );

-- Ein privates Anliegen richtet sich an niemanden.
alter table voice_notes drop constraint if exists voice_notes_private_check;
alter table voice_notes add constraint voice_notes_private_check
  check (
    kind not in ('self_reflection','coach_log')
    or (target_member_id is null and target_role is null and target_team_id is null)
  );

create index if not exists voice_notes_club_idx on voice_notes(club_id, status);
create index if not exists voice_notes_author_idx on voice_notes(author_member_id);

alter table voice_notes enable row level security;

-- ---------------------------------------------------------------------------
-- BR-123 und die Adressierung, als Policy.
--
-- Vier Fälle, und der erste ist der strengste: Was privat ist, sieht **nur**
-- die verfassende Person.
-- ---------------------------------------------------------------------------
drop policy if exists voice_notes_read on voice_notes;
create policy voice_notes_read on voice_notes
  for select using (
    -- Eigenes – jeder Art.
    author_member_id = current_member_id(club_id)
    -- Gerichtetes: an mich, an meine Rolle, an mein Team.
    or (
      kind = 'feedback'
      and (
        target_member_id = current_member_id(club_id)
        -- **Genau** die gewählte Rolle, nicht «mindestens diese Rolle».
        -- `is_club_trainer()` schliesst den Vorstand ein; wer sein Anliegen an
        -- Trainer:innen richtet, hat aber Trainer:innen gemeint. Für einen
        -- Feedback-Kanal ist dieser Unterschied der ganze Punkt.
        or exists (
          select 1 from club_members me
           where me.id = current_member_id(club_id)
             and (
               (voice_notes.target_role = 'admin'
                 and me.role in ('admin','superadmin'))
               or (voice_notes.target_role = 'trainer' and me.role = 'trainer')
               or (
                 voice_notes.target_team_id is not null
                 and me.role = 'trainer'
                 and exists (
                   select 1 from team_members tm
                    where tm.team_id = voice_notes.target_team_id
                      and tm.member_id = me.id
                 )
               )
             )
        )
      )
    )
    -- Anonymes geht an den Vorstand.
    or (kind = 'anonymous' and is_club_admin(club_id))
  );

-- ---------------------------------------------------------------------------
-- A5: das Kontingent.
-- ---------------------------------------------------------------------------
create or replace function public.voice_quota_left(p_club_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select greatest(
    coalesce((select nullif(c.settings->'voice'->>'monthlyQuota','')::int
                from clubs c where c.id = p_club_id), 10)
    - (select count(*)::int from voice_notes v
        where v.club_id = p_club_id
          and v.author_member_id = current_member_id(p_club_id)
          and v.created_at > date_trunc('month', now())),
    0);
$$;

-- ---------------------------------------------------------------------------
-- Schritte 6 bis 9: absenden.
--
-- Der Text kommt fertig geprüft an (BR-121) – diese Funktion schreibt ihn,
-- sie erzeugt ihn nicht.
--
-- Für den anonymen Fall nimmt sie **nur** den Prüfwert des Tickets entgegen.
-- Das Token selbst bleibt auf dem Gerät; wer es verliert, verliert den
-- Rückkanal. Das ist der Preis echter Anonymität, und er ist gewollt.
-- ---------------------------------------------------------------------------
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

revoke execute on function public.voice_quota_left(uuid) from public, anon;
grant  execute on function public.voice_quota_left(uuid) to authenticated;

revoke execute on function public.submit_voice_note(uuid, text, text, uuid, text, uuid, text)
  from public, anon;
grant  execute on function public.submit_voice_note(uuid, text, text, uuid, text, uuid, text)
  to authenticated;
